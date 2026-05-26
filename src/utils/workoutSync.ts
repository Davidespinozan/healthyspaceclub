// Sync de workout_log entre Supabase y completedSessions local — Lote Track-2.
//
// completedSessions ya vive en Zustand (localStorage). workout_log ya se
// inserta a Supabase al terminar (finishWorkoutSession, non-bloqueante).
// Pero al login NO se hidrata workout_log de vuelta → el historial NO
// viajaba entre dispositivos (asimetría con food_log/meal_progress).
//
// Este módulo cierra la asimetría con dos funciones puras testeables:
//   1. mapWorkoutLogRowToSession(row): CompletedSession
//   2. mergeWorkoutSessions(local, remote): { merged, toPush }
//
// Dedup por completedAtIso (timestamp ms único en la práctica — NO
// agregamos id al shape de CompletedSession, retrocompat preservada).
// Merge = UNIÓN: cualquier sesión presente en local Y/O en remote
// sobrevive. toPush = lo que local tiene y remote no, para backfill.

import type { CompletedSession, LoggedSet, Modality } from '../types';

/**
 * Shape mínimo de una row de workout_log que mapeamos.
 * Acepta `unknown` en jsonb para tolerancia a data malformada / vieja.
 */
export interface WorkoutLogRow {
  date_local: string;
  completed_at: string;
  modality: string;
  duration_minutes: number;
  exercises_completed: number;
  exercises_total: number;
  exercises: unknown; // jsonb — Array<ExerciseLogItem>
}

/**
 * Shape de un item dentro del jsonb `exercises`. Espejo de ExerciseLogItem
 * en workoutLogger.ts pero declarado acá local para no acoplar el sync
 * a la firma de inserción.
 */
interface ExerciseLogItemShape {
  exercise_id: string;
  order?: number;
  planned?: { sets?: number };
  performed?: {
    sets?: Array<LoggedSet | null>;
  };
}

function isExerciseLogItem(x: unknown): x is ExerciseLogItemShape {
  return !!x && typeof x === 'object' && typeof (x as { exercise_id?: unknown }).exercise_id === 'string';
}

/**
 * Mapea una row de workout_log al shape CompletedSession.
 *
 * Reconstruye loggedSets aplanando exercises[].performed.sets en orden
 * de ejecución (mismo patrón que el WorkoutPlayer emite originalmente).
 *
 * - Si NINGÚN ejercicio tiene performed → loggedSets undefined (sesión
 *   sin tracking, igual que el flag opcional en la interfaz).
 * - Si algún ejercicio del plan no tiene performed → no agrega slots
 *   para él (consistente con el spec: "ejercicio no entrenado → no
 *   agrega slots").
 * - Si performed.sets es más corto que planned.sets → padding con null
 *   (sets que faltaban por completar al cerrar la sesión).
 *
 * Tolerante a data malformada: rows con `exercises` no-array, items
 * sin exercise_id, etc. son ignorados o reemplazados por defaults
 * defensivos.
 */
export function mapWorkoutLogRowToSession(row: WorkoutLogRow): CompletedSession {
  const exercisesRaw = Array.isArray(row.exercises) ? row.exercises : [];
  const exercises: ExerciseLogItemShape[] = exercisesRaw.filter(isExerciseLogItem);

  const exerciseIds = exercises.map(e => e.exercise_id);

  const flat: Array<LoggedSet | null> = [];
  let anyPerformed = false;
  for (const ex of exercises) {
    if (!ex.performed) continue; // no entrenado → no agrega slots
    anyPerformed = true;
    const performedSets = Array.isArray(ex.performed.sets) ? ex.performed.sets : [];
    const plannedSets = typeof ex.planned?.sets === 'number'
      ? ex.planned.sets
      : performedSets.length;
    for (let i = 0; i < plannedSets; i++) {
      flat.push(performedSets[i] ?? null);
    }
  }

  const session: CompletedSession = {
    date: row.date_local,
    completedAtIso: row.completed_at,
    modality: row.modality as Modality,
    exerciseIds,
    durationSeconds: row.duration_minutes * 60,
    exercisesCompleted: row.exercises_completed,
    exercisesTotal: row.exercises_total,
  };
  if (anyPerformed) session.loggedSets = flat;
  return session;
}

/**
 * Mergea sesiones locales con remotas — UNIÓN con dedup por completedAtIso.
 *
 * - Remote primero: las sesiones que vienen del server son la fuente
 *   más probable de ser "completa" (workout_log tiene todos los campos).
 * - Local después: si local tiene una sesión con un completedAtIso que
 *   remote NO tiene, se agrega + va a toPush para backfill.
 * - Sesiones inmutables: una vez completada, no se edita. No hay caso
 *   de conflict-resolution per-campo.
 *
 * @returns merged: todas las sesiones únicas ordenadas por completedAtIso ASC.
 *          toPush: las sesiones que local tenía y remote no (para subir).
 */
export function mergeWorkoutSessions(
  local: CompletedSession[],
  remote: CompletedSession[],
): { merged: CompletedSession[]; toPush: CompletedSession[] } {
  const byTime = new Map<string, CompletedSession>();
  for (const s of remote) {
    if (s.completedAtIso) byTime.set(s.completedAtIso, s);
  }
  const toPush: CompletedSession[] = [];
  for (const s of local) {
    if (!s.completedAtIso) continue;
    if (!byTime.has(s.completedAtIso)) {
      byTime.set(s.completedAtIso, s);
      toPush.push(s);
    }
  }
  const merged = [...byTime.values()].sort(
    (a, b) => a.completedAtIso.localeCompare(b.completedAtIso),
  );
  return { merged, toPush };
}
