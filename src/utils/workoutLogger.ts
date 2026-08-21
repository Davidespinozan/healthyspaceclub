import { dayKey } from './localDate';
import { newSessionId, upsertWorkoutRow } from './workoutOutbox';
import type { CompletedSession, Modality, LoggedSet, PendingWorkoutRow } from '../types';

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
  /** P1 · ¿fue una sesión de DESCARGA? Se persiste en CompletedSession para derivar el
   *  inicio del bloque de mesociclo (reset tras deload). */
  isDeload?: boolean;
  /** P2-B · Día LOCAL SELLADO al generar/iniciar el workout (dayKey). Si el workout cruza
   *  medianoche, la sesión pertenece a ESTE día (inicio), no al reloj de fin. Sin él, cae a hoy. */
  sessionDate?: string;
  /** D1 · Origen de la sesión ('supplemental' = "Generarme más"). Ausente = sesión prescrita normal.
   *  Se persiste en CompletedSession.source; NO altera modality ni la fila de workout_log. */
  source?: 'prescribed' | 'supplemental' | 'manual';
}

/** Operaciones del outbox inyectadas (P2-A) — mantiene finishWorkoutSession honesta y testeable. */
export interface WorkoutOutboxOps {
  enqueue: (row: PendingWorkoutRow) => void;
  dequeue: (clientSessionId: string) => void;
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
  markActiveDay: (day?: string) => Promise<void>,
  outbox?: WorkoutOutboxOps,
): Promise<void> {
  const now = new Date();
  // P2-A · identidad estable de la sesión (idempotencia del outbox + dedup cross-device).
  const sessionId = newSessionId();
  // P2-B · el workout pertenece a su día SELLADO al iniciar (no al reloj de fin, que puede
  // haber cruzado medianoche). Sin sessionDate (legacy/otros flujos) cae al día local de fin.
  const sessionDay = payload.sessionDate ?? dayKey(now);

  // 1. Persistir en Zustand (BLOCANTE)
  const session: CompletedSession = {
    sessionId,
    date: sessionDay,
    completedAtIso: now.toISOString(),
    modality: payload.modality,
    exerciseIds: payload.exercises.map(e => e.exercise_id),
    durationSeconds: payload.durationSeconds,
    exercisesCompleted: payload.exercisesCompleted,
    exercisesTotal: payload.exercisesTotal,
    ...(payload.loggedSets && payload.loggedSets.length > 0 && { loggedSets: payload.loggedSets }),
    ...(payload.isDeload && { isDeload: true }),
    // D1 · marca supplemental (backward-compat: sin source la sesión es prescrita normal). No viaja a
    // workout_log (su client_session_id ya la distingue); solo distingue label/conteo en el cliente.
    ...(payload.source && payload.source !== 'prescribed' && { source: payload.source }),
    // BLOQUE 3 (D5) · sets performed por ejercicio (para el historial de fuerza que consumen
    // P1·e1RMTrend y P5·weak-point). Misma fuente que loggedSets, vista por-ejercicio.
    ...(() => {
      const perEx = payload.exercises
        .filter(e => e.performed && !e.performed.skipped)
        .map(e => ({
          id: e.exercise_id,
          sets: (e.performed!.sets.filter((s): s is LoggedSet => s != null) as LoggedSet[])
            .filter(s => s.reps > 0 || s.kg > 0)
            // PRESCRIPCIÓN ≠ DESEMPEÑO: conserva repsUnconfirmed en el historial por-ejercicio →
            // e1RM/volumen/display NO pueden confundir la sugerencia con reps reales.
            // F2C-9C.1 · conserva el rol de ejecución por set (warmup/cooldown/working). Ausente = working (legacy).
            .map(s => ({ reps: s.reps, kg: s.kg, ...(s.rir != null && { rir: s.rir }), ...(s.repsUnconfirmed && { repsUnconfirmed: true as const }), ...(s.role && { role: s.role }) })),
        }))
        .filter(e => e.sets.length > 0);
      return perEx.length > 0 ? { exercises: perEx } : {};
    })(),
  };
  addCompletedSession(session);

  // 2. ENCOLAR la fila de sync (si hay userId) ANTES de cualquier await → no hay ventana entre el
  // guardado local y el encolado: si la app muere aquí, la sesión sigue pendiente (no se pierde).
  // `client_session_id` = clave de idempotencia (índice único server). `date_local` = día SELLADO.
  const row: PendingWorkoutRow | null = payload.userId
    ? {
        user_id: payload.userId,
        client_session_id: sessionId,
        date_local: sessionDay,
        // completed_at = instante REAL de fin (≠ sessionDate). Ordering/round-trip legacy.
        completed_at: now.toISOString(),
        modality: payload.modality,
        duration_minutes: Math.max(0, Math.round(payload.durationSeconds / 60)),
        target_duration_minutes: Math.max(0, Math.round(payload.targetDurationSeconds / 60)),
        equipment: payload.equipment,
        day_type: payload.dayType ?? null,
        exercises: payload.exercises,
        exercises_completed: payload.exercisesCompleted,
        exercises_total: payload.exercisesTotal,
        coach_reason: payload.coachReason ?? null,
        generation_method: payload.generationMethod ?? null,
        partner_user_id: payload.partnerUserId ?? null,
        partner_name: payload.partnerName ?? null,
      }
    : null;
  if (row) outbox?.enqueue(row);

  // 3. Racha del día (idempotente) — usa el día SELLADO.
  await markActiveDay(sessionDay);

  // 4. Intento de sync idempotente. Éxito → sale de la cola; fallo → queda para el próximo flush
  // (app-open / online / foco). Reintentar nunca duplica (índice único). Anon (row null): solo local.
  if (!row) return;
  const ok = await upsertWorkoutRow(row);
  if (ok) outbox?.dequeue(sessionId);
}
