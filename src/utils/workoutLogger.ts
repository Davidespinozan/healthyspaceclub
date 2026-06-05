import { supabase } from '../lib/supabase';
import type { CompletedSession, Modality, LoggedSet } from '../types';

/**
 * Shape de la entrada `exercises` (jsonb) en la tabla workout_log.
 * - Para yoga: `planned` trae { duration, repetitions?, sides? }
 * - Para fuerza/cardio: `planned` trae { sets, reps, rest, tip? }
 * - `performed` (Sesión 4): reps/kg reales medidos por el WorkoutPlayer
 * - `variant_id` queda para Sesión 5+
 */
export interface ExerciseLogItem {
  exercise_id: string;
  order: number;
  planned?: Record<string, unknown>;
  performed?: {
    sets: Array<LoggedSet | null>;
    skipped?: boolean;
    completed_at?: string;
  };
}

/**
 * Parsea el string `reps` del plan a número para pre-rellenar el input de log-set.
 * Casos cubiertos:
 *   "10" → 10
 *   "8-10" → 10 (último número del rango)
 *   "12-15 por lado" → 15
 *   "30 seg" → 30 (segundos como número trackeable)
 *   "" / undefined / "sin números" → 0
 */
export function parseRepsToNumber(reps: string | undefined): number {
  if (!reps) return 0;
  const matches = reps.match(/(\d+)/g);
  if (!matches || matches.length === 0) return 0;
  return Number(matches[matches.length - 1]);
}

/**
 * Agrupa `loggedSets` (array plano en orden de ejecución) en arrays por ejercicio,
 * respetando el plan (cada ejercicio tiene N series).
 * Retorna una matriz: para cada ejercicio del plan, sus series logueadas.
 */
export function groupLoggedSetsByExercise(
  loggedSets: Array<LoggedSet | null>,
  exercises: Array<{ sets: number }>,
): Array<Array<LoggedSet | null>> {
  const result: Array<Array<LoggedSet | null>> = [];
  let pos = 0;
  for (const ex of exercises) {
    const slice: Array<LoggedSet | null> = [];
    for (let s = 0; s < ex.sets; s++) {
      slice.push(loggedSets[pos] ?? null);
      pos++;
    }
    result.push(slice);
  }
  return result;
}

export interface FinishSessionPayload {
  /** UUID del usuario si está autenticado, null si es anon (solo guarda local). */
  userId: string | null;
  modality: Modality;
  exercises: ExerciseLogItem[];
  exercisesCompleted: number;
  exercisesTotal: number;
  /** Duración real medida (segundos). El SQL lo guarda como minutos redondeados. */
  durationSeconds: number;
  /** Duración planificada (segundos). El SQL lo guarda como minutos redondeados. */
  targetDurationSeconds: number;
  /** "gym" | "cuerpo" | "ligas" — required por el SQL. */
  equipment: string;
  /** Opcional: "upper" | "lower" | ... — para analytics. */
  dayType?: string;
  /** Opcional: razón del coach al generar este workout. */
  coachReason?: string;
  /** Opcional: "cache_hit" | "ai_generated" | "manual" — para analytics. */
  generationMethod?: string;
  /**
   * Opcional: sets logueados con reps/kg reales (Sesión 4).
   * Se persiste en Zustand `CompletedSession.loggedSets`.
   * El Supabase row los recibe estructurados dentro de `exercises[i].performed`.
   */
  loggedSets?: Array<LoggedSet | null>;
  /** Modo pareja (Fase 3): cuenta del compañero conectado (null si invitado). */
  partnerUserId?: string | null;
  /** Modo pareja: nombre del compañero, para "entrenaste con X". */
  partnerName?: string | null;
}

/**
 * Finaliza una sesión de entrenamiento.
 *
 * Persistencia en 3 capas:
 * 1. Zustand `completedSessions` (vía addCompletedSession) — BLOCANTE, sin él analyzeWorkoutHistory falla
 * 2. Racha del día (vía markActiveDay) — BLOCANTE, único disparador vivo desde Lote Racha-1
 * 3. Supabase `workout_log` (insert) — NON-bloqueante, solo si hay userId
 *
 * Si Supabase falla, el flujo del usuario NO se rompe — solo log de warning.
 *
 * `markActiveDay` se recibe explícita por parámetro (no via useAppStore.getState
 * interno) para mantener la función honesta sobre sus dependencias y poder
 * mockearla en tests, igual que `addCompletedSession`.
 */
export async function finishWorkoutSession(
  payload: FinishSessionPayload,
  addCompletedSession: (session: CompletedSession) => void,
  markActiveDay: () => Promise<void>,
): Promise<void> {
  const now = new Date();

  // 1. Persistir en Zustand (BLOCANTE)
  // `date` en UTC YYYY-MM-DD para consistencia con WorkoutEntry existente
  const session: CompletedSession = {
    date: now.toISOString().split('T')[0],
    completedAtIso: now.toISOString(),
    modality: payload.modality,
    exerciseIds: payload.exercises.map(e => e.exercise_id),
    durationSeconds: payload.durationSeconds,
    exercisesCompleted: payload.exercisesCompleted,
    exercisesTotal: payload.exercisesTotal,
    ...(payload.loggedSets && payload.loggedSets.length > 0 && { loggedSets: payload.loggedSets }),
  };
  addCompletedSession(session);

  // 2. Marcar el día como activo para la racha (idempotente por día)
  await markActiveDay();

  // 2. Insertar en Supabase (NON-bloqueante)
  if (!payload.userId) {
    // Anon: solo guardamos local
    return;
  }

  try {
    // date_local en zona horaria del usuario (sv-SE devuelve YYYY-MM-DD)
    const dateLocal = now.toLocaleDateString('sv-SE');

    const { error } = await supabase.from('workout_log').insert({
      user_id: payload.userId,
      date_local: dateLocal,
      modality: payload.modality,
      duration_minutes: Math.max(0, Math.round(payload.durationSeconds / 60)),
      target_duration_minutes: Math.max(0, Math.round(payload.targetDurationSeconds / 60)),
      equipment: payload.equipment,
      day_type: payload.dayType,
      exercises: payload.exercises,
      exercises_completed: payload.exercisesCompleted,
      exercises_total: payload.exercisesTotal,
      coach_reason: payload.coachReason,
      generation_method: payload.generationMethod,
      partner_user_id: payload.partnerUserId ?? null,
      partner_name: payload.partnerName ?? null,
    });

    if (error) {
      console.warn('[workoutLogger] Supabase insert failed:', error.message);
    }
  } catch (e) {
    console.warn('[workoutLogger] Supabase insert exception:', e);
  }
}
