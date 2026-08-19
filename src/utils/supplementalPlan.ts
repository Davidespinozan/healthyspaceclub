// ─────────────────────────────────────────────────────────────────────────
// supplementalPlan — convierte el resultado del CORE (buildSupplementalPlan) en EJERCICIOS DE PLAN
// ejecutables por la infraestructura existente (WorkoutPlan → WorkoutPlayer). Prescribe con el MISMO
// motor determinista que la sesión normal (prescribeSession: series/reps/rest/rir/topKg/backoff desde
// la cadena mesociclo→déficit→esquema). SERIES RECTAS: NO asigna `group` (sin biseries/triseries).
// La variante playable la resuelve el player en runtime (selectVariantForEquipment) — igual que un plan
// normal. NO toca P1–P6/volumen/progression: solo consume sus outputs.
// ─────────────────────────────────────────────────────────────────────────
import type { Exercise, TrainingGoal } from '../types';
import { prescribeSession, type Phase } from './sessionPrescription';

/** Ejercicio de plan supplemental — mismo shape que un ejercicio del plan normal, SIN `group`. */
export interface SupplementalPlanExercise {
  id: string;
  sets: number;
  reps: string;
  rest: number;
  rir?: number;
  topKg?: number;
  backoffKg?: number;
  tip_personalizado: string;
}

/**
 * Prescribe los ejercicios supplemental (ids ya elegidos por el core) reutilizando prescribeSession.
 * `allocation` = déficit semanal restante por músculo (la misma dosis que dirigió al core). El orden de
 * salida respeta `exerciseIds`. mainMinutes alto → no recorta por tiempo (el techo de nº ya lo puso el
 * core, techo 3). Sin variante sellada: el player elige la playable con el gear actual (contrato ya cerrado).
 */
export function buildSupplementalExercises(input: {
  exerciseIds: string[];
  bank: Exercise[];
  allocation: Record<string, number>;
  trainingGoal: TrainingGoal;
  phase: Phase;
  level?: string;
  lastPerf?: Record<string, { sets: { reps: number; kg: number; rir?: number }[] }>;
}): SupplementalPlanExercise[] {
  const byId = new Map(input.bank.map(e => [e.id, e]));
  const exs = input.exerciseIds
    .map(id => byId.get(id))
    .filter((e): e is Exercise => !!e)
    .map(e => ({ id: e.id, muscleGroup: e.muscleGroup }));
  const bankById = new Map(input.bank.map(e => [e.id, { id: e.id, name: e.name, type: e.type }]));

  const items = prescribeSession({
    exercises: exs, bankById, allocation: input.allocation,
    trainingGoal: input.trainingGoal, phase: input.phase, level: input.level,
    mainMinutes: 999, lastPerf: input.lastPerf,
  });
  const byExId = new Map(items.map(it => [it.ex.id, it]));

  const out: SupplementalPlanExercise[] = [];
  for (const id of input.exerciseIds) {
    const b = byId.get(id);
    if (!b) continue;
    const it = byExId.get(id);
    if (!it) {
      out.push({ id, sets: b.defaultSets, reps: b.defaultReps, rest: b.defaultRest, tip_personalizado: '' });
      continue;
    }
    const p = it.prescription;
    out.push({
      id,
      sets: p.sets,
      reps: p.reps,
      rest: p.rest,
      rir: p.rir,
      ...(p.topKg != null && { topKg: p.topKg }),
      ...(p.backoffKg != null && { backoffKg: p.backoffKg }),
      tip_personalizado: '',
    });
  }
  return out;
}
