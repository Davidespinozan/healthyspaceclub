// ─────────────────────────────────────────────────────────────────────────
// strengthWarmup — PREPARACIÓN de sesiones de FUERZA derivada de la RUTINA FINAL (no del reloj).
//
// Fix de warm-up: (1) DURACIÓN con autoridad fisiológica propia (~5–8 min, +excepciones reales),
// DESACOPLADA del tiempo disponible; (2) contenido ESPECÍFICO a los patrones/músculos reales de la
// sesión, con fallback DIGNO (nunca yoga genérico para un día de fuerza); (3) aproximación que NOMBRA
// el primer compuesto real. NO toca P4/allocateTime/prescripción/ledger/restFor — solo compone el bloque
// de preparación a partir de outputs ya existentes. Aplica SOLO a strength-day (cardio/yoga sin cambio).
// ─────────────────────────────────────────────────────────────────────────
import type { Exercise, Equipment, MuscleGroup, TrainingGoal } from '../types';
import { isReproducibleStation, cardioEquipmentFor } from './workoutPlanner';
import { categorize } from './sessionPrescription';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * DURACIÓN de la preparación de fuerza — necesidad FISIOLÓGICA, no % del tiempo disponible.
 * Base ~6 min (general + específica + aproximación). Sube SOLO con señales reales YA modeladas:
 * fuerza pesada, readiness baja, bajo impacto (mayor/movilidad limitada), dolor/limitación. Cap ligero
 * por tiempo disponible para no desproporcionar sesiones cortas (NO para escalar con el reloj):
 * 60/90/120 con las mismas señales → mismos minutos.
 */
export function strengthWarmupMinutes(input: {
  trainingGoal?: TrainingGoal;
  readinessLow?: boolean;
  lowImpactMode?: boolean;
  hasPain?: boolean;
  availableMinutes: number;
}): number {
  let m = 6;
  if (input.trainingGoal === 'fuerza') m += 2;   // cargas pesadas → más series de aproximación
  if (input.lowImpactMode) m += 2;               // mayor / movilidad limitada → más preparación
  if (input.readinessLow) m += 1;
  if (input.hasPain) m += 1;
  // Cap que SOLO muerde en sesiones cortas (≤~28 min): jamás sube por tener más tiempo.
  const cap = Math.max(5, Math.round(input.availableMinutes * 0.25));
  return clamp(m, 5, Math.min(10, cap));
}

/**
 * RAISE (eleva pulso) equipment-aware: en Full Gym prefiere una máquina de cardio (ergómetro) antes que
 * marcha en el lugar; si no, un cardio de bajo impacto reproducible. Siempre bajo impacto (seguridad en
 * frío). Devuelve el Exercise o null.
 */
export function pickWarmupRaise(bank: Exercise[], equipment: Equipment[], hasFullGym: boolean): Exercise | null {
  const eq = cardioEquipmentFor(equipment);
  const pool = bank.filter(ex =>
    ex.muscleGroup === 'cardio' && (ex.roles ?? []).includes('warmup') &&
    ex.equipment.some(e => eq.includes(e)) && ex.impact !== 'high' && ex.fallRisk !== true &&
    isReproducibleStation(ex, eq),
  );
  if (hasFullGym) {
    const machine = pool.find(ex => ex.equipment.includes('gym'));
    if (machine) return machine;
  }
  return pool.find(ex => ex.impact === 'low') ?? pool[0] ?? null;
}

export type WarmupRegion = 'upper' | 'lower' | 'mixed' | 'core';

// GATE SEMÁNTICO de elegibilidad (NO ranking/cobertura): músculo PRIMARIO que una activación debe
// tener para ser apropiada a la región de HOY. Evita que un core isométrico gane MOVILIZA en un día de
// upper/lower/mixed solo por tener video. NO decide prioridades de entrenamiento — la rutina/anchors/P4
// siguen siendo la autoridad; esto solo filtra qué activación es semánticamente coherente con el warm-up.
const REGION_TARGET: Record<WarmupRegion, MuscleGroup[]> = {
  upper: ['espalda', 'hombros', 'pecho'],
  lower: ['gluteo', 'cuadriceps', 'isquios'],
  mixed: ['gluteo', 'espalda', 'hombros'],   // caderas + hombros (las articulaciones del día mixto)
  core: ['core'],
};

/**
 * ACTIVACIÓN ESPECÍFICA con video, COHERENTE con la región del día: type='activacion' (NO yoga), músculo
 * PRIMARIO en REGION_TARGET[region], usable con el equipo y reproducible (clip). Sin candidato → null (el
 * caller usa el fallback textual por región). Un core isométrico solo es elegible cuando region==='core'.
 * NUNCA yoga. El gate por región es de ELEGIBILIDAD, no de ranking (devuelve el primero del banco).
 */
export function pickSpecificActivation(bank: Exercise[], region: WarmupRegion, equipment: Equipment[]): Exercise | null {
  const eq = cardioEquipmentFor(equipment);
  const usable = (ex: Exercise) => ex.equipment.some(e => eq.includes(e) || e === 'cuerpo');
  const targets = REGION_TARGET[region];
  const pool = bank.filter(ex =>
    ex.type === 'activacion' && !ex.isYoga && usable(ex) &&
    targets.includes(ex.muscleGroup as MuscleGroup) &&   // gate por músculo PRIMARIO (no secundario)
    isReproducibleStation(ex, eq),
  );
  return pool[0] ?? null;
}

const UPPER = new Set<string>(['pecho', 'espalda', 'hombros', 'biceps', 'triceps']);
const LOWER = new Set<string>(['cuadriceps', 'isquios', 'gluteo', 'pantorrillas']);

/** Región dominante de la sesión (para el fallback textual de movilidad): upper | lower | mixed | core. */
export function warmupRegion(exercises: Array<{ id: string }>, bank: Exercise[]): WarmupRegion {
  const byId = new Map(bank.map(e => [e.id, e]));
  let up = 0, lo = 0;
  for (const e of exercises) {
    const ex = byId.get(e.id);
    if (!ex) continue;
    if (UPPER.has(ex.muscleGroup)) up++;
    else if (LOWER.has(ex.muscleGroup)) lo++;
  }
  if (up && lo) return 'mixed';
  if (up) return 'upper';
  if (lo) return 'lower';
  return 'core';
}

/**
 * PRIMER ejercicio para la aproximación (nombrar en el potentiate). Preferencia: primer anchor en el
 * ORDEN → primer main-compound → primer compuesto → primer ejercicio. Devuelve el Exercise o null
 * (sesión sin compuesto → el caller usa una nota genérica, sin inventar aproximación pesada).
 */
export function firstApproachExercise(
  exercises: Array<{ id: string }>, anchorIds: string[], bank: Exercise[],
): Exercise | null {
  const byId = new Map(bank.map(e => [e.id, e]));
  const anchorSet = new Set(anchorIds);
  const resolve = (id?: string) => (id ? byId.get(id) ?? null : null);
  const firstAnchor = exercises.find(e => anchorSet.has(e.id));
  if (firstAnchor) return resolve(firstAnchor.id);
  const firstMain = exercises.find(e => { const ex = byId.get(e.id); return !!ex && categorize(ex) === 'main-compound'; });
  if (firstMain) return resolve(firstMain.id);
  const firstComp = exercises.find(e => { const ex = byId.get(e.id); return !!ex && ex.type === 'compuesto'; });
  if (firstComp) return resolve(firstComp.id);
  return resolve(exercises[0]?.id);
}
