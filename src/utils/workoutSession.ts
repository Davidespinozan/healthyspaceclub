import type { LoggedSet } from '../types';
import type { CachedWorkout } from './workoutCache';
import { parseRepsToNumber } from './workoutLogger';

// Shape mínimo del ejercicio en el plan (subset de CachedWorkout.exercises[number]).
// Linkeo al source-of-truth para que si el shape cambia, TS lo flaguea.
export type WorkoutExercise = CachedWorkout['exercises'][number];

/**
 * Posición plana en `loggedSets` donde comienzan los sets del ejercicio dado.
 * loggedSets es plano en orden de ejecución: [ex0-s0, ex0-s1, ..., ex1-s0, ...].
 */
export function startPosFor(exerciseIdx: number, exercises: WorkoutExercise[]): number {
  return exercises.slice(0, exerciseIdx).reduce((acc, ex) => acc + ex.sets, 0);
}

/**
 * Pre-fill del kg para el próximo set del ejercicio actual: último kg non-null
 * registrado en esa franja, o 0 si no hay previos.
 */
export function prefilledKgForCurrent(
  loggedSets: Array<LoggedSet | null>,
  startPos: number,
): number {
  for (let i = loggedSets.length - 1; i >= startPos; i--) {
    const entry = loggedSets[i];
    if (entry) return entry.kg;
  }
  return 0;
}

/**
 * Marca el próximo set pendiente del ejercicio actual. Pre-fill: reps del rango
 * objetivo (ej. "8-10" → 10), kg del último set non-null del MISMO ejercicio.
 *
 * Retorna `restSeconds: null` si era la última serie del ejercicio (no arranca rest).
 * Si todos los sets ya están registrados, devuelve loggedSets sin cambios.
 */
export function markSet(
  loggedSets: Array<LoggedSet | null>,
  currentExerciseIndex: number,
  exercises: WorkoutExercise[],
): { newLoggedSets: Array<LoggedSet | null>; restSeconds: number | null } {
  const currentEx = exercises[currentExerciseIndex];
  if (!currentEx) return { newLoggedSets: loggedSets, restSeconds: null };

  const startPos = startPosFor(currentExerciseIndex, exercises);
  const setsRegistered = Math.max(0, loggedSets.length - startPos);
  if (setsRegistered >= currentEx.sets) {
    return { newLoggedSets: loggedSets, restSeconds: null };
  }

  const parsedReps = parseRepsToNumber(currentEx.reps);
  const lastKg = prefilledKgForCurrent(loggedSets, startPos);
  const newEntry: LoggedSet = { reps: parsedReps, kg: lastKg };
  const newLoggedSets = [...loggedSets, newEntry];

  const willBeLastSet = setsRegistered + 1 >= currentEx.sets;
  const restSeconds = willBeLastSet ? null : (currentEx.rest || 60);

  return { newLoggedSets, restSeconds };
}

/**
 * Edita el valor de un set ya registrado, en su posición plana correcta.
 * Si el set aún no se registró (flatIdx fuera del array), devuelve loggedSets sin cambios.
 * Clamps reps/kg a ≥ 0 (defensive — no debería pasar pero el contrato downstream lo asume).
 */
export function editSetAt(
  loggedSets: Array<LoggedSet | null>,
  exerciseIdx: number,
  setIdx: number,
  exercises: WorkoutExercise[],
  newEntry: LoggedSet,
): Array<LoggedSet | null> {
  const flatIdx = startPosFor(exerciseIdx, exercises) + setIdx;
  if (flatIdx >= loggedSets.length) return loggedSets;
  const next = [...loggedSets];
  next[flatIdx] = {
    reps: Math.max(0, newEntry.reps),
    kg: Math.max(0, newEntry.kg),
  };
  return next;
}

/**
 * Pad con nulls los sets del ejercicio actual que quedaron sin marcar antes de
 * avanzar al siguiente ejercicio. Preserva la longitud requerida por el contrato:
 * `loggedSets.length === Σ exercises[0..currentExerciseIndex].sets` al salir.
 */
export function padForNextExercise(
  loggedSets: Array<LoggedSet | null>,
  currentExerciseIndex: number,
  exercises: WorkoutExercise[],
): Array<LoggedSet | null> {
  const currentEx = exercises[currentExerciseIndex];
  if (!currentEx) return loggedSets;
  const startPos = startPosFor(currentExerciseIndex, exercises);
  const setsRegistered = Math.max(0, loggedSets.length - startPos);
  const missing = currentEx.sets - setsRegistered;
  if (missing <= 0) return loggedSets;
  return [...loggedSets, ...new Array<LoggedSet | null>(missing).fill(null)];
}

/**
 * Pad defensive hasta la longitud total esperada por el contrato.
 * Idempotente: si ya está al total (o más), devuelve loggedSets sin cambios.
 */
export function padToTotal(
  loggedSets: Array<LoggedSet | null>,
  exercises: WorkoutExercise[],
): Array<LoggedSet | null> {
  const total = exercises.reduce((acc, ex) => acc + ex.sets, 0);
  if (loggedSets.length >= total) return loggedSets;
  const padded = [...loggedSets];
  while (padded.length < total) padded.push(null);
  return padded;
}

/**
 * Cuenta ejercicios con al menos 1 set non-null (i.e. el usuario llegó a marcar
 * o registrar al menos una serie del ejercicio). Skipped completo (todos null)
 * NO cuenta como completado.
 */
export function computeExercisesCompleted(
  loggedSets: Array<LoggedSet | null>,
  exercises: WorkoutExercise[],
): number {
  let count = 0;
  let pos = 0;
  for (const ex of exercises) {
    const slice = loggedSets.slice(pos, pos + ex.sets);
    if (slice.some(s => s !== null && s !== undefined)) count++;
    pos += ex.sets;
  }
  return count;
}

export interface SessionStats {
  totalSetsCompleted: number;
  exercisesCompleted: number;
  totalKg: number;
  minutes: number;
  durationSeconds: number;
}

/**
 * Stats agregados de la sesión actual. `now` y `startedAt` en ms epoch.
 * Si `startedAt <= 0`, `minutes`/`durationSeconds` son 0 (sesión no iniciada).
 */
export function computeSessionStats(
  loggedSets: Array<LoggedSet | null>,
  startedAt: number,
  now: number,
  exercises: WorkoutExercise[],
): SessionStats {
  const totalSetsCompleted = loggedSets.filter(s => s !== null).length;
  const exercisesCompleted = computeExercisesCompleted(loggedSets, exercises);
  const totalKg = loggedSets.reduce((acc, s) => acc + (s?.kg ?? 0), 0);
  const durationSeconds = startedAt > 0 ? Math.round((now - startedAt) / 1000) : 0;
  const minutes = startedAt > 0 ? Math.round((now - startedAt) / 60000) : 0;
  return { totalSetsCompleted, exercisesCompleted, totalKg, minutes, durationSeconds };
}

export interface OnCompletePayload {
  exercisesCompleted: number;
  totalSetsCompleted: number;
  durationSeconds: number;
  loggedSets: Array<LoggedSet | null>;
}

/**
 * Construye el payload exacto que onComplete debe emitir al finalizar la sesión.
 * CRÍTICO — este shape es el contrato downstream que alimenta:
 *   - DailyTrainer → groupLoggedSetsByExercise → finishWorkoutSession
 *   - Zustand `completedSessions` (racha/historial)
 *   - Supabase `workout_log.performed`
 *
 * Garantiza loggedSets.length === Σ exercises[i].sets vía padToTotal defensive.
 */
export function buildOnCompletePayload(
  loggedSets: Array<LoggedSet | null>,
  startedAt: number,
  now: number,
  exercises: WorkoutExercise[],
): OnCompletePayload {
  const padded = padToTotal(loggedSets, exercises);
  const totalSetsCompleted = padded.filter(s => s !== null).length;
  const exercisesCompleted = computeExercisesCompleted(padded, exercises);
  const durationSeconds = startedAt > 0 ? Math.round((now - startedAt) / 1000) : 0;
  return {
    exercisesCompleted,
    totalSetsCompleted,
    durationSeconds,
    loggedSets: padded,
  };
}

export interface ResumeState {
  currentExerciseIndex: number;
  startedAt: number;
  loggedSets: Array<LoggedSet | null>;
}

/**
 * Valida y hidrata el state guardado en localStorage para ofrecer resume.
 * Devuelve null si:
 *   - JSON corrupto / no parseable
 *   - workoutDate ≠ today (sesión de otro día)
 *   - planHash ≠ expected (plan distinto al actual)
 *   - currentExerciseIndex fuera de rango (0 = recién empezado, no se ofrece resume;
 *     ≥ totalExercises = ya terminó, no tiene sentido resumir)
 *
 * Los campos individuales tienen fallback seguros (startedAt → 0, loggedSets → []).
 */
// ══════════════════════════════════════════════════════════════
// SUPERSERIES — secuencia de ejecución + store 2D (Lote Supersets-4)
//
// Diseño seguro: las series se guardan POR EJERCICIO (estructura 2D). Solo el
// RECORRIDO se intercala (encadenado). Al aplanar por ejercicio, el payload
// downstream (racha/historial/Supabase) queda idéntico — el contrato no cambia.
// ══════════════════════════════════════════════════════════════

export type LoggedByExercise = Array<Array<LoggedSet | null>>;

/** Step de ejecución. `chained` = encadena con el siguiente (sin descanso). */
export interface ExecStep {
  exIndex: number;   // ejercicio en workout.exercises
  setNum: number;    // 1-based
  restAfter: number; // segundos de descanso tras este step (0 = sin descanso)
  chained: boolean;  // true = "sin descanso · ahora [siguiente]" (mismo grupo, misma vuelta)
}

/**
 * Construye el orden de ejecución. Series rectas: set1, set2... (descanso entre
 * sets, no tras el último). Grupos (mismo `group` consecutivo): se intercalan por
 * vuelta — A-v1, B-v1, DESCANSO, A-v2, B-v2... (sin descanso entre miembros de la
 * vuelta; descanso al cerrar la vuelta, salvo la última). Sets disparejos: cada
 * miembro aparece solo en las vueltas que le tocan.
 */
export function buildExecutionSequence(exercises: WorkoutExercise[]): ExecStep[] {
  const steps: ExecStep[] = [];
  let i = 0;
  while (i < exercises.length) {
    const g = exercises[i].group;
    if (g) {
      const members: number[] = [];
      let j = i;
      while (j < exercises.length && exercises[j].group === g) { members.push(j); j++; }
      const maxRounds = Math.max(...members.map(m => exercises[m].sets || 1));
      for (let r = 1; r <= maxRounds; r++) {
        const active = members.filter(m => r <= (exercises[m].sets || 1));
        active.forEach((m, k) => {
          const lastInRound = k === active.length - 1;
          const lastRound = r === maxRounds;
          steps.push({
            exIndex: m,
            setNum: r,
            // descanso solo al cerrar la vuelta, y no tras la última vuelta del grupo
            restAfter: lastInRound && !lastRound ? (exercises[m].rest || 60) : 0,
            chained: !lastInRound, // encadena con el siguiente miembro de la vuelta
          });
        });
      }
      i = j;
    } else {
      const S = exercises[i].sets || 1;
      for (let s = 1; s <= S; s++) {
        steps.push({
          exIndex: i,
          setNum: s,
          restAfter: s < S ? (exercises[i].rest || 60) : 0, // descanso entre sets, no tras el último
          chained: false,
        });
      }
      i++;
    }
  }
  return steps;
}

/** Estructura 2D inicial: una franja de nulls por ejercicio (largo = sets). */
export function initLoggedByExercise(exercises: WorkoutExercise[]): LoggedByExercise {
  return exercises.map(ex => new Array<LoggedSet | null>(ex.sets || 1).fill(null));
}

/** Escribe (o limpia) un set en su slot 2D, inmutable. */
export function setLogAt(
  logged: LoggedByExercise,
  exIndex: number,
  setIdx: number,
  entry: LoggedSet | null,
): LoggedByExercise {
  return logged.map((arr, i) => (i === exIndex ? arr.map((v, j) => (j === setIdx ? entry : v)) : arr));
}

/** Aplana a flat per-exercise contiguo — el shape del contrato downstream. */
export function flattenByExercise(logged: LoggedByExercise): Array<LoggedSet | null> {
  return logged.flat();
}

/** Último kg non-null registrado del ejercicio (pre-fill del próximo set). */
export function lastKgForExercise(logged: LoggedByExercise, exIndex: number): number {
  const arr = logged[exIndex] || [];
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i]) return arr[i]!.kg;
  }
  return 0;
}

/** Cuántos sets non-null lleva el ejercicio. */
export function setsDoneForExercise(logged: LoggedByExercise, exIndex: number): number {
  return (logged[exIndex] || []).filter(s => s !== null).length;
}

export function parseResumeState(
  rawJson: string | null | undefined,
  expectedPlanHash: string,
  today: string,
  totalExercises: number,
): ResumeState | null {
  if (!rawJson) return null;
  try {
    const data = JSON.parse(rawJson);
    if (!data || typeof data !== 'object') return null;
    if (data.workoutDate !== today) return null;
    if (data.planHash !== expectedPlanHash) return null;
    const idx = data.currentExerciseIndex;
    if (typeof idx !== 'number' || idx <= 0 || idx >= totalExercises) return null;
    const startedAt = typeof data.startedAt === 'number' ? data.startedAt : 0;
    const loggedSets = Array.isArray(data.loggedSets) ? data.loggedSets : [];
    return { currentExerciseIndex: idx, startedAt, loggedSets };
  } catch {
    return null;
  }
}
