import { supabase } from '../lib/supabase';
import type { CompletedSession, Modality } from '../types';

/**
 * Shape de la entrada `exercises` (jsonb) en la tabla workout_log.
 * - Para yoga: `planned` trae { duration, repetitions?, sides? }
 * - Para fuerza/cardio: `planned` trae { sets, reps, rest, tip? }
 * - `performed` queda para Sesión 4 (tracking de reps/kg reales)
 * - `variant_id` queda para Sesión 4
 */
export interface ExerciseLogItem {
  exercise_id: string;
  order: number;
  planned?: Record<string, unknown>;
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
}

/**
 * Finaliza una sesión de entrenamiento.
 *
 * Persistencia en 2 capas:
 * 1. Zustand `completedSessions` (vía addCompletedSession) — BLOCANTE, sin él analyzeWorkoutHistory falla
 * 2. Supabase `workout_log` (insert) — NON-bloqueante, solo si hay userId
 *
 * Si Supabase falla, el flujo del usuario NO se rompe — solo log de warning.
 */
export async function finishWorkoutSession(
  payload: FinishSessionPayload,
  addCompletedSession: (session: CompletedSession) => void,
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
  };
  addCompletedSession(session);

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
    });

    if (error) {
      console.warn('[workoutLogger] Supabase insert failed:', error.message);
    }
  } catch (e) {
    console.warn('[workoutLogger] Supabase insert exception:', e);
  }
}
