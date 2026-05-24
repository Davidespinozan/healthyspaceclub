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
}): Promise<CachedWorkout & { razon?: string }> {
  const { candidates, equipment, targetCount, goal, intensity, userName, dayLabel, context, userProfile, locale } = params;
  const profileBlock = buildUserProfileBlock(userProfile);

  // Para cada candidato, seleccionar la variante específica que aplica al equipo
  // del usuario. Si tiene overrides (sets/reps/rest), usar esos en vez de los del patrón.
  const candidatesCompact = candidates.map(c => {
    const variant = selectVariantForEquipment(c, equipment);
    const effectiveName = variant ? `${c.name} — ${variant.name}` : c.name;
    const effectiveSets = variant?.defaultSets ?? c.defaultSets;
    const effectiveReps = variant?.defaultReps ?? c.defaultReps;
    const effectiveRest = variant?.defaultRest ?? c.defaultRest;
    return `${c.id} | ${effectiveName} | ${c.muscleGroup} | ${c.type} | sets:${effectiveSets} reps:${effectiveReps} rest:${effectiveRest}s`;
  }).join('\n');

  const intensityInstruction = intensity === 'baja'
    ? 'Intensidad BAJA: reduce sets 30%, reps más bajas, descansos más largos'
    : intensity === 'alta'
    ? 'Intensidad ALTA: sets altos, peso/reps desafiantes, descansos ajustados al goal'
    : 'Intensidad MEDIA: sets y reps estándar según defaults de cada ejercicio';

  const prompt = buildWorkoutOrchestratorPrompt({
    dayLabel, userName, profileBlock, context, candidatesCompact,
    targetCount, goal, intensityInstruction, intensity, locale,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  try {
    const data = await callAI(
      { max_tokens: 1200, messages: [{ role: 'user', content: prompt }] },
      controller.signal,
    );
    const raw = data.content?.[0]?.text ?? '{}';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(cleaned);
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
