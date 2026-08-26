// ─────────────────────────────────────────────────────────────────────────────
// OUTBOX IDEMPOTENTE (P2-A) · reintento de sesiones que no llegaron a Supabase.
//
// La sesión se guarda LOCAL primero (completedSessions). Si el insert a workout_log
// falla (offline/red), la fila queda ENCOLADA en `pendingWorkoutSync` (persistido) y se
// reintenta al abrir la app / recuperar conexión. El reintento es IDEMPOTENTE gracias al
// índice único (user_id, client_session_id) + upsert ON CONFLICT DO NOTHING: nunca duplica,
// ni tras un ack de red perdido ni tras una re-sync cross-device.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store';
import type { PendingWorkoutRow } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// WORKOUT-OUTBOX-RESILIENCE-1 (M-3) · política de reintento acotada + cuarentena.
// Una fila que el servidor RECHAZA de forma determinista (FK/NOT NULL/columna
// desconocida) o que falla WORKOUT_SYNC_MAX_ATTEMPTS veces se pone en CUARENTENA:
// se RETIENE (nunca se borra en silencio → completedSessions y la fila siguen
// locales/recuperables) pero el flush automático deja de intentarla → sin hot-loop.
// El estado de reintento vive en un sidecar del store (pendingWorkoutMeta), NUNCA
// en la fila (que se sube tal cual a workout_log).
// ─────────────────────────────────────────────────────────────────────────────
/** Tope de intentos automáticos fallidos antes de cuarentena (no un número mágico). */
export const WORKOUT_SYNC_MAX_ATTEMPTS = 6;

/** Códigos de error DETERMINISTAS/permanentes (Gate A): reintentar no ayuda → cuarentena
 *  inmediata. NO incluye 42501 (RLS/sesión: puede recuperarse tras re-autenticar). */
export const PERMANENT_SYNC_CODES: ReadonlySet<string> = new Set(['23503', '23502', 'PGRST204']);

/** ¿El código es permanente? Puro y testeable. Sin código / red / 5xx / 42501 → retryable. */
export function isPermanentSyncError(code: string | undefined): boolean {
  return code != null && PERMANENT_SYNC_CODES.has(code);
}

/** Resultado normalizado del upsert: solo `ok` + `code` seguro (nunca message/details/PII). */
export type UpsertResult = { ok: true } | { ok: false; code?: string };

// Guard anti-carrera para el RESET de historial de entrenamiento (DEV, ver resetTrainingHistory.ts).
// Mientras está activo, flushPendingWorkouts NO reintenta: una sesión pendiente no puede
// re-insertarse en workout_log durante/después de un reset. El reset lo activa ANTES del borrado
// remoto y lo libera al final (éxito o fallo), de modo que ningún outbox viejo sobrevive/reinserta.
let flushSuspended = false;
/** Suspende el reintento del outbox (usado por el reset de entrenamiento). */
export function suspendWorkoutFlush(): void { flushSuspended = true; }
/** Reactiva el reintento del outbox. */
export function resumeWorkoutFlush(): void { flushSuspended = false; }
/** ¿Está suspendido el flush? (test/introspección) */
export function isWorkoutFlushSuspended(): boolean { return flushSuspended; }

/** UUID de sesión estable (cliente). crypto.randomUUID con fallback para entornos sin él. */
export function newSessionId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch { /* fallthrough */ }
  return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Upsert IDEMPOTENTE de una fila de workout_log. ON CONFLICT (user_id, client_session_id)
 * DO NOTHING: un reintento sobre una sesión ya insertada (o una re-sync desde otro device)
 * no crea un duplicado. Devuelve true si la fila está en el servidor (insertada o ya existente).
 */
export async function upsertWorkoutRow(row: PendingWorkoutRow): Promise<UpsertResult> {
  try {
    const { error } = await supabase
      .from('workout_log')
      .upsert(row, { onConflict: 'user_id,client_session_id', ignoreDuplicates: true });
    // Solo capturamos el CÓDIGO estructurado (PostgREST) para clasificar permanente/transitorio.
    // NUNCA persistimos/logueamos message/details/hint (pueden traer fragmentos del payload).
    if (error) return { ok: false, code: typeof error.code === 'string' ? error.code : undefined };
    return { ok: true };
  } catch {
    return { ok: false }; // red/desconocido → sin código → retryable
  }
}

/**
 * Reintenta TODAS las sesiones pendientes del usuario actual. Se llama al abrir la app,
 * al recuperar conexión (`online`) y al volver a foco. Idempotente: cada éxito quita la fila
 * de la cola; los fallos permanecen para el próximo intento (nunca se pierden en silencio).
 */
// Single-flight: mount+online+focus+hidratación pueden disparar flushes solapados. Un guard
// mínimo evita intentos concurrentes de la misma fila (doble incremento de attempts / tráfico
// redundante). No es un framework de colas; solo serializa el flush. Idempotencia intacta.
let flushing = false;

export async function flushPendingWorkouts(): Promise<{ flushed: number; remaining: number; quarantined: number }> {
  const remainingNow = () => useAppStore.getState().pendingWorkoutSync.length;
  if (flushing) return { flushed: 0, remaining: remainingNow(), quarantined: 0 };
  const store = useAppStore.getState();
  const userId = store.user?.id;
  const pending = store.pendingWorkoutSync;
  // Guard de reset: si un reset de entrenamiento está en curso, NO reintentar (evita re-insertar
  // una sesión antigua en workout_log justo después del DELETE remoto).
  if (flushSuspended || !userId || pending.length === 0) return { flushed: 0, remaining: pending.length, quarantined: 0 };
  flushing = true;
  let flushed = 0;
  let quarantined = 0;
  try {
    for (const row of pending.filter((r) => r.user_id === userId)) {
      // Un reset iniciado a mitad del loop lo detiene ANTES del próximo upsert.
      if (flushSuspended) break;
      // M-3 · saltar filas en cuarentena → CERO llamadas de red para un poison row.
      const meta = useAppStore.getState().pendingWorkoutMeta[row.client_session_id];
      if (meta?.quarantined) continue;
      const res = await upsertWorkoutRow(row);
      if (res.ok) {
        useAppStore.getState().dequeuePendingWorkout(row.client_session_id); // quita fila + meta
        flushed++;
      } else {
        // Falla: registra intento / clasifica. La acción decide cuarentena (permanente o tope)
        // y emite UNA sola vez el evento seguro al transicionar a quarantined.
        const nowQuarantined = useAppStore.getState().recordWorkoutSyncFailure(row.client_session_id, {
          permanent: isPermanentSyncError(res.code),
          code: res.code,
          maxAttempts: WORKOUT_SYNC_MAX_ATTEMPTS,
        });
        if (nowQuarantined) quarantined++;
      }
    }
  } finally {
    flushing = false;
  }
  return { flushed, remaining: remainingNow(), quarantined };
}
