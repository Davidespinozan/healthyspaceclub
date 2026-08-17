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
  client_session_id?: string | null; // P2-A · identidad estable (dedup cross-device)
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
    // Recupera la identidad estable de sesión → dedup cross-device por sessionId (P2-A).
    ...(typeof row.client_session_id === 'string' && row.client_session_id
      ? { sessionId: row.client_session_id }
      : {}),
    date: row.date_local,
    completedAtIso: row.completed_at,
    modality: row.modality as Modality,
    exerciseIds,
    durationSeconds: row.duration_minutes * 60,
    exercisesCompleted: row.exercises_completed,
    exercisesTotal: row.exercises_total,
  };
  if (anyPerformed) session.loggedSets = flat;
  // BLOQUE 3 (D5) · vista por-ejercicio (para el historial de fuerza de P1/P5). Conserva RIR.
  const perEx = exercises
    .filter(e => e.performed) // sin sets reales → cae por el guard de abajo (skipped incluido)
    .map(e => ({
      id: e.exercise_id,
      sets: (Array.isArray(e.performed!.sets) ? e.performed!.sets : [])
        .filter((s): s is LoggedSet => !!s && (s.reps > 0 || s.kg > 0))
        // Conserva repsUnconfirmed en el round-trip Supabase → historial fiel (no inventa reps reales).
        .map(s => ({ reps: s.reps, kg: s.kg, ...((s as LoggedSet).rir != null && { rir: (s as LoggedSet).rir }), ...((s as LoggedSet).repsUnconfirmed && { repsUnconfirmed: true as const }) })),
    }))
    .filter(e => e.sets.length > 0);
  if (perEx.length > 0) session.exercises = perEx;
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
  // Dedup por identidad ESTABLE (sessionId) con fallback a completedAtIso para legacy. Se rastrean
  // AMBAS claves para no duplicar una sesión que un lado tiene con sessionId y el otro sin él.
  const byKey = new Map<string, CompletedSession>();
  const seenIds = new Set<string>();
  const seenIso = new Set<string>();
  const add = (s: CompletedSession) => {
    const key = s.sessionId || s.completedAtIso;
    if (!key) return;
    byKey.set(key, s);
    if (s.sessionId) seenIds.add(s.sessionId);
    if (s.completedAtIso) seenIso.add(s.completedAtIso);
  };
  for (const s of remote) add(s);
  const toPush: CompletedSession[] = [];
  for (const s of local) {
    const covered = (!!s.sessionId && seenIds.has(s.sessionId)) || (!!s.completedAtIso && seenIso.has(s.completedAtIso));
    if (covered) continue;
    add(s);
    toPush.push(s);
  }
  const merged = [...byKey.values()].sort(
    (a, b) => (a.completedAtIso || '').localeCompare(b.completedAtIso || ''),
  );
  return { merged, toPush };
}
