// ─────────────────────────────────────────────────────────────────────────
// supplementalWorkout — "Generarme más" (D1). Trabajo ADICIONAL tras completar una sesión de fuerza,
// dosificado por el DÉFICIT SEMANAL REAL (incluyendo la sesión recién terminada). Decisión del coach:
// genera hasta N (techo 3) SOLO si hay volumen legítimo pendiente; 0 si la semana ya está cubierta.
//
// Reutiliza el pipeline P4 (computeWeeklyVolume → déficit → buildSessionSlots → filtro playable), NO
// rellena tiempo, NO inventa volumen, NO toca la sesión original ni el grouping (series rectas).
// ─────────────────────────────────────────────────────────────────────────
import type { Exercise, MuscleGroup, Equipment, CompletedSession, WorkoutEntry, TrainingGoal } from '../types';
import type { Implement } from './equipmentImplement';
import { computeWeeklyVolume, playableVariantsForContext } from './workoutPlanner';
import { buildSessionSlots, patternCap } from './sessionSlots';
import { movementPatternOf } from './movementPattern';
import { categorize, type Category } from './sessionPrescription';

const MAX_EXTRA = 3;

export type SupplementalResult =
  | { status: 'covered' }                                                   // sin déficit útil → 0 ejercicios
  | { status: 'gap'; muscles: string[] }                                    // hay déficit pero sin candidato equipo+video
  | { status: 'ok'; exerciseIds: string[]; count: number;                   // 1..N ejercicios adicionales
      slots: Array<{ muscle: MuscleGroup; pattern: string | null }> };

/**
 * Calcula el trabajo suplementario tras una sesión. `completedSessions` DEBE incluir la sesión recién
 * terminada (por eso el déficit ya la descuenta). NO muta nada; devuelve ids a ejecutar o el motivo.
 */
export function buildSupplementalPlan(input: {
  completedSessions: CompletedSession[];   // incluye la sesión recién terminada
  bank: Exercise[];
  weeklyTarget: Record<string, number>;    // series/semana por músculo (P3)
  dayMuscles: MuscleGroup[];
  doneExerciseIds: string[];               // ejecutados HOY (dedup + anchors para patrón)
  equipmentList: Equipment[];
  allowed?: Set<Implement>;
  workoutLog?: WorkoutEntry[];
  trainingGoal?: TrainingGoal;
  maxExtra?: number;
}): SupplementalResult {
  const goal: TrainingGoal = input.trainingGoal ?? 'hipertrofia';
  const maxExtra = Math.max(0, input.maxExtra ?? MAX_EXTRA);
  const bankById = new Map(input.bank.map(e => [e.id, e]));

  // 1) Déficit restante por músculo (con la sesión recién terminada ya contada).
  const done = computeWeeklyVolume(input.completedSessions, input.bank, 7, input.workoutLog ?? []);
  const remaining: Record<string, number> = {};
  let totalRemaining = 0;
  for (const m of input.dayMuscles) {
    const r = Math.max(0, (input.weeklyTarget[m] ?? 0) - (done[m] ?? 0));
    remaining[m] = r; totalRemaining += r;
  }
  if (totalRemaining <= 0 || maxExtra === 0) return { status: 'covered' };

  // 2) Lo YA ejecutado hoy como anchors → marca patrones cubiertos (dedup por patrón) y consume dosis.
  const doneAnchors = input.doneExerciseIds
    .map(id => bankById.get(id))
    .filter((e): e is Exercise => !!e && e.muscleGroup !== 'cardio')
    .map(e => ({ id: e.id, muscle: e.muscleGroup, pattern: movementPatternOf(e), role: categorize(e) as Category }));

  // 3) Reusa buildSessionSlots con el déficit como allocation; timeCap = anchors + maxExtra → los slots
  //    NUEVOS (sin filledBy) son el supplemental, acotados a maxExtra.
  const slots = buildSessionSlots({
    dayMuscles: input.dayMuscles, trainingGoal: goal, allocation: remaining,
    anchors: doneAnchors, timeCap: doneAnchors.length + maxExtra,
  });
  const newSlots = slots.filter(s => !s.filledBy).slice(0, maxExtra);
  if (newSlots.length === 0) return { status: 'covered' };

  // 4) Llena cada slot con un candidato PLAYABLE (equipo+gear+video), del músculo+patrón, NO duplicado
  //    hoy, respetando patternCap (contando lo ya hecho).
  const cap = patternCap(goal);
  const patternCount: Record<string, number> = {};
  for (const a of doneAnchors) if (a.pattern) patternCount[a.pattern] = (patternCount[a.pattern] ?? 0) + 1;
  const used = new Set(input.doneExerciseIds);
  const picked: string[] = [];
  const pickedSlots: Array<{ muscle: MuscleGroup; pattern: string | null }> = [];
  const gapMuscles: string[] = [];

  for (const slot of newSlots) {
    const wantPattern = slot.patterns[0] ?? null;
    if (wantPattern && (patternCount[wantPattern] ?? 0) >= cap) { gapMuscles.push(slot.muscle); continue; }
    const cand = input.bank.find(e =>
      !used.has(e.id) && e.muscleGroup === slot.muscle && !e.isYoga &&
      (wantPattern ? movementPatternOf(e) === wantPattern : true) &&
      playableVariantsForContext(e, input.equipmentList, input.allowed).length > 0,
    );
    if (!cand) { gapMuscles.push(slot.muscle); continue; }
    used.add(cand.id); picked.push(cand.id);
    pickedSlots.push({ muscle: slot.muscle, pattern: wantPattern });
    if (wantPattern) patternCount[wantPattern] = (patternCount[wantPattern] ?? 0) + 1;
  }

  if (picked.length === 0) return { status: 'gap', muscles: [...new Set(gapMuscles)] };
  return { status: 'ok', exerciseIds: picked, count: picked.length, slots: pickedSlots };
}
