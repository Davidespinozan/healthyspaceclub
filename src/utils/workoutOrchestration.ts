// Funciones de orquestación de workouts: llaman a la IA (vía callAI) con el
// prompt construido por los builders de src/ai/prompts/workoutOrchestrator.ts,
// parsean el JSON de respuesta y validan/ajustan el output.
//
// Mudadas desde DailyTrainer.tsx en el Lote DT-A (descomposición).
// CERO cambio de comportamiento — son las mismas funciones, en otro archivo.
//
// Distinción de nombres:
//   - src/ai/prompts/workoutOrchestrator.ts → builders de prompts
//   - src/utils/workoutOrchestration.ts (este) → lógica que llama la IA
//
// Ambas son top-level y puras respecto a React (cero hooks, cero store).

import { selectVariantForEquipment } from './workoutPlanner';
import { buildUserProfileBlock } from '../ai/profile';
import {
  buildWorkoutOrchestratorPrompt,
  buildYogaOrchestratorPrompt,
} from '../ai/prompts/workoutOrchestrator';
import { callAI } from './aiProxy';
import type { Exercise, Equipment, Goal, UserProfile, YogaPlan } from '../types';
import type { AppLanguage } from '../store';
import type { CachedWorkout } from './workoutCache';

// Compañero de entrenamiento (modo invitado): datos mínimos para que la IA
// ajuste la prescripción por persona. No requiere cuenta — los captura un
// formulario rápido (Fase 2 · entrenar con alguien).
export interface PartnerInput {
  name: string;
  nivel?: 'principiante' | 'intermedio' | 'avanzado' | string;
  equipment?: Equipment[];
  goalLabel?: string;
}

/** Bloque de perfil del compañero para el prompt (legible por el modelo). */
function buildPartnerProfileBlock(partner: PartnerInput): string {
  const lines: string[] = [];
  if (partner.nivel) lines.push(`- Nivel: ${partner.nivel}`);
  if (partner.equipment && partner.equipment.length) lines.push(`- Equipo disponible: ${partner.equipment.join(', ')}`);
  if (partner.goalLabel) lines.push(`- Objetivo: ${partner.goalLabel}`);
  return lines.length ? lines.join('\n') : '- Sin datos adicionales (asume nivel similar al usuario)';
}

/** Resume el último rendimiento de un ejercicio para el prompt: "22.5kg×10,10,8"
 *  (peso libre), "×12,12,10" (peso corporal/banda) o "" si no hay registro. */
export function formatLastPerf(sets?: { reps: number; kg: number }[]): string {
  const done = (sets ?? []).filter((s) => s.reps > 0);
  if (!done.length) return '';
  const kg = Math.max(...done.map((s) => s.kg));
  const reps = done.map((s) => s.reps).join(',');
  return kg > 0 ? `${kg}kg×${reps}` : `×${reps}`;
}

export async function orchestrateWorkout(params: {
  candidates: Exercise[];
  equipment: Equipment[];
  targetCount: number;
  goal: Goal;
  intensity: 'baja' | 'media' | 'alta';
  userName: string;
  dayLabel: string;
  context: string;
  userProfile?: UserProfile;
  locale?: AppLanguage;
  partner?: PartnerInput;
  // Último rendimiento por exercise-id (para sobrecarga progresiva: la IA ve lo que
  // levantaste la última vez y prescribe una progresión, no reps genéricas).
  lastPerf?: Record<string, { sets: { reps: number; kg: number }[] }>;
}): Promise<CachedWorkout & { razon?: string }> {
  const { candidates, equipment, targetCount, goal, intensity, userName, dayLabel, context, userProfile, locale, partner, lastPerf } = params;
  const profileBlock = buildUserProfileBlock(userProfile);

  // Para cada candidato, seleccionar la variante específica que aplica al equipo
  // del usuario. Si tiene overrides (sets/reps/rest), usar esos en vez de los del patrón.
  const candidatesCompact = candidates.map(c => {
    const variant = selectVariantForEquipment(c, equipment);
    const effectiveName = variant ? `${c.name} — ${variant.name}` : c.name;
    const effectiveSets = variant?.defaultSets ?? c.defaultSets;
    const effectiveReps = variant?.defaultReps ?? c.defaultReps;
    const effectiveRest = variant?.defaultRest ?? c.defaultRest;
    // Sobrecarga progresiva: adjunta el último rendimiento real si existe.
    const perf = formatLastPerf(lastPerf?.[c.id]?.sets);
    const perfStr = perf ? ` | última vez: ${perf}` : '';
    return `${c.id} | ${effectiveName} | ${c.muscleGroup} | ${c.type} | sets:${effectiveSets} reps:${effectiveReps} rest:${effectiveRest}s${perfStr}`;
  }).join('\n');

  const intensityInstruction = intensity === 'baja'
    ? 'Intensidad BAJA: reduce sets 30%, reps más bajas, descansos más largos'
    : intensity === 'alta'
    ? 'Intensidad ALTA: sets altos, peso/reps desafiantes, descansos ajustados al goal'
    : 'Intensidad MEDIA: sets y reps estándar según defaults de cada ejercicio';

  const prompt = buildWorkoutOrchestratorPrompt({
    dayLabel, userName, profileBlock, context, candidatesCompact,
    targetCount, goal, intensityInstruction, intensity, locale, equipment,
    partner: partner
      ? { name: partner.name, profileBlock: buildPartnerProfileBlock(partner) }
      : undefined,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  try {
    const data = await callAI(
      // 1200 era muy bajo: con 7-9 ejercicios + tips, y en pareja con reps/tip
      // del compañero, la respuesta se cortaba → JSON inválido ("unterminated
      // string"). 3000 da margen suficiente.
      { max_tokens: 3000, messages: [{ role: 'user', content: prompt }] },
      controller.signal,
    );
    const raw = data.content?.[0]?.text ?? '{}';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      // JSON truncado/malformado (p.ej. respuesta cortada): no expongas el
      // SyntaxError crudo al usuario; pide reintentar.
      throw new Error('No se pudo generar la rutina completa. Intenta de nuevo.');
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error('La generación tardó demasiado. Intenta de nuevo.');
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function orchestratePowerVinyasa(params: {
  candidates: Exercise[];
  targetDurationSeconds: number;
  userName: string;
  context: string;
  painArea?: string;
  userProfile?: UserProfile;
  locale?: AppLanguage;
}): Promise<YogaPlan> {
  const profileBlock = buildUserProfileBlock(params.userProfile);

  const candidatesInfo = params.candidates.map(p =>
    `${p.id} | base: ${p.defaultDuration}s | ${p.muscleGroup} | ${p.difficulty}`
  ).join('\n');

  const minutes = Math.round(params.targetDurationSeconds / 60);
  const minSec = Math.floor(params.targetDurationSeconds * 0.95);
  const maxSec = Math.ceil(params.targetDurationSeconds * 1.05);

  const painInstruction = params.painArea
    ? `\n\nEVITA poses que comprometan: ${params.painArea}.`
    : '';

  const prompt = buildYogaOrchestratorPrompt({
    userName: params.userName,
    profileBlock,
    context: params.context,
    candidatesInfo,
    minutes,
    targetDurationSeconds: params.targetDurationSeconds,
    minSec,
    maxSec,
    painInstruction,
    locale: params.locale,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  let yogaPlan: YogaPlan;
  try {
    const data = await callAI(
      { max_tokens: 3000, messages: [{ role: 'user', content: prompt }] },
      controller.signal,
    );
    const raw = data.content?.[0]?.text ?? '{}';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    yogaPlan = JSON.parse(cleaned) as YogaPlan;
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error('La generación tardó demasiado. Intenta de nuevo.');
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

  // Validación de duración total
  const actualDuration = yogaPlan.poses.reduce((sum, p) => sum + p.duration, 0);
  const diff = Math.abs(actualDuration - params.targetDurationSeconds);
  const tolerance = params.targetDurationSeconds * 0.1;
  if (diff > tolerance) {
    console.warn(`[power-vinyasa] duración ${actualDuration}s vs target ${params.targetDurationSeconds}s (diff: ${diff}s)`);
  }

  // Validación: savasana al final es obligatorio
  const lastPose = yogaPlan.poses[yogaPlan.poses.length - 1];
  if (lastPose?.id !== 'savasana') {
    console.warn('[power-vinyasa] Savasana no está al final, forzando');
    yogaPlan.poses = yogaPlan.poses.filter(p => p.id !== 'savasana');
    yogaPlan.poses.push({ id: 'savasana', duration: 300, tip_personalizado: 'Suelta, recibe el flow' });
  }

  return yogaPlan;
}
