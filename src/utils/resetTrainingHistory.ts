// ─────────────────────────────────────────────────────────────────────────────
// resetTrainingHistoryForCurrentUser · HERRAMIENTA DEV-ONLY
//
// Deja al usuario AUTENTICADO en estado "virgen de entrenamiento" para poder correr
// smokes reproducibles del Composer / cardio / fuerza. Semántica:
//
//   "Este usuario conserva su cuenta, perfil y configuración, pero NUNCA ha entrenado."
//
// Borra EXCLUSIVAMENTE historial deportivo del user_id autenticado, en tres capas y
// en ORDEN OBLIGATORIO (remoto → Zustand → localStorage):
//
//   1. REMOTO   · DELETE workout_log WHERE user_id = <uid>
//               · UPDATE user_profiles SET daily_workout = null (+ daily_workout_regen = null)
//   2. ZUSTAND  · vacía los 13 campos de entrenamiento a su shape inicial REAL
//   3. STORAGE  · elimina las keys crudas de resume/celebración de entrenamiento
//
// NO toca: auth, perfil, obData, onboarding, preferencias (hsc_session_min /
// hsc_priority_muscles), userPlan/subscription/trial, TDEE, nutrición (weekly_plan,
// food_log, meal_progress, shopping, weight_log), streak_count/last_active_date,
// life system, exercise_videos, catálogo, workout_cache compartida, ni datos de otros
// usuarios.
//
// SEGURIDAD CRÍTICA:
//   · Exige un user.id string válido. Sin sesión → ABORTA (throw), sin remoto ni local.
//   · El DELETE remoto SIEMPRE lleva `.eq('user_id', <uid>)`. Nunca .neq, nunca sin filtro.
//   · Si el borrado remoto falla → THROW explícito. NO se muta el estado local y NO se
//     declara RESET_OK (el caller ve el error).
//   · Suspende el OUTBOX durante todo el reset (guard en workoutOutbox) para que ningún
//     flush en vuelo re-inserte una sesión antigua tras el DELETE.
//
// Motores INTACTOS: no importa ni toca cardioMain, sessionComposer, computeWeeklyCardio,
// weeklyCardioPolicy, dailyCardioPlacement, sessionEndReason, prescribeSession,
// progression/e1RM, D1 ni la lógica de WorkoutPlayer. Solo borra DATOS.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase as realSupabase } from '../lib/supabase';
import { useAppStore } from '../store';
import { suspendWorkoutFlush, resumeWorkoutFlush } from './workoutOutbox';

/** Keys crudas de localStorage del dominio de ENTRENAMIENTO (nunca se hace localStorage.clear()). */
export const TRAINING_STORAGE_KEYS = [
  'workout-player-progress', // WorkoutPlayer resume (PROGRESS_KEY)
  'yoga-flow-progress',      // YogaFlowPlayer resume
  'day-complete-celebrated', // guard de celebración de día completo
] as const;

/**
 * Shape mínimo del cliente Supabase que consume el reset. El cliente real lo satisface;
 * los tests inyectan un doble que registra las llamadas.
 */
interface SupabaseLike {
  from(table: string): {
    delete(): { eq(col: string, val: string): PromiseLike<{ error: unknown }> };
    update(values: Record<string, unknown>): { eq(col: string, val: string): PromiseLike<{ error: unknown }> };
  };
}

export interface ResetTrainingDeps {
  /** Cliente Supabase (default: el real). Inyectable para tests. */
  supabase?: SupabaseLike;
  /** Storage crudo (default: localStorage; null = entorno sin storage). Inyectable para tests. */
  storage?: Pick<Storage, 'removeItem'> | null;
}

export interface ResetTrainingResult {
  ok: true;
  userId: string;
  deletedWorkoutLog: true;
  clearedDailyWorkoutRemote: true;
  clearedLocalFields: number;
  clearedStorageKeys: string[];
}

/** Campos de entrenamiento del store con su shape INICIAL REAL (ver src/store/index.ts). */
function localTrainingReset() {
  return {
    completedSessions: [],
    pendingWorkoutSync: [],
    lastExercisePerformance: {},
    workoutLog: [],
    blockAnchors: [],
    rirLog: [],
    readinessLog: [],
    todayCheckin: null,
    activityLog: [],
    dailyWorkout: null,
    pendingSupplemental: false,
    pendingWorkoutModality: null,
    dailyWorkoutRegenCount: { date: '', countByModality: {} },
  };
}

/**
 * Resetea el historial de entrenamiento del usuario autenticado. Ver cabecera del módulo.
 * @throws si no hay user.id válido, o si falla el borrado remoto (no muta local en ese caso).
 */
export async function resetTrainingHistoryForCurrentUser(
  deps: ResetTrainingDeps = {},
): Promise<ResetTrainingResult> {
  const sb: SupabaseLike = deps.supabase ?? (realSupabase as unknown as SupabaseLike);
  const storage: Pick<Storage, 'removeItem'> | null =
    deps.storage !== undefined
      ? deps.storage
      : (typeof localStorage !== 'undefined' ? localStorage : null);

  // ── 0. SEGURIDAD · exige user.id string válido. Sin sesión → ABORTA (sin remoto, sin local). ──
  const userId = useAppStore.getState().user?.id;
  if (!userId || typeof userId !== 'string') {
    throw new Error('[resetTrainingHistory] abort: no authenticated user.id — reset requires a valid session.');
  }

  // ── Guard anti-carrera: suspende el OUTBOX durante TODO el reset. ──
  suspendWorkoutFlush();
  try {
    // ── 1. REMOTO PRIMERO ──
    const del = await sb.from('workout_log').delete().eq('user_id', userId);
    if (del.error) {
      throw new Error(`[resetTrainingHistory] remote DELETE workout_log failed: ${describeErr(del.error)}`);
    }
    const nowIso = new Date().toISOString();
    const upd = await sb.from('user_profiles').update({
      daily_workout: null,
      daily_workout_updated_at: nowIso,
      // daily_workout_regen pertenece EXCLUSIVAMENTE al dominio de generación de entrenamiento.
      daily_workout_regen: null,
      daily_workout_regen_updated_at: nowIso,
      updated_at: nowIso,
    }).eq('user_id', userId);
    if (upd.error) {
      throw new Error(`[resetTrainingHistory] remote UPDATE user_profiles failed: ${describeErr(upd.error)}`);
    }

    // ── 2. LOCAL ZUSTAND (solo tras remoto OK) — shapes iniciales reales del store. ──
    const localFields = localTrainingReset();
    useAppStore.setState(localFields);

    // ── 3. LOCALSTORAGE crudo (solo dominio de entrenamiento; jamás localStorage.clear()). ──
    const clearedStorageKeys: string[] = [];
    if (storage) {
      for (const key of TRAINING_STORAGE_KEYS) {
        try { storage.removeItem(key); clearedStorageKeys.push(key); } catch { /* storage lleno/denegado */ }
      }
    }

    return {
      ok: true,
      userId,
      deletedWorkoutLog: true,
      clearedDailyWorkoutRemote: true,
      clearedLocalFields: Object.keys(localFields).length,
      clearedStorageKeys,
    };
  } finally {
    // Reactiva el outbox pase lo que pase. En éxito la cola ya quedó vacía; en fallo remoto
    // la cola local NO se tocó (no mutamos local si el remoto falló) → nada se pierde ni duplica.
    resumeWorkoutFlush();
  }
}

/** Mensaje legible de un error de Supabase (o cualquier cosa) para el throw explícito. */
function describeErr(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return String(err);
}
