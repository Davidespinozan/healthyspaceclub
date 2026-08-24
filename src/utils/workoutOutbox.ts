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
export async function upsertWorkoutRow(row: PendingWorkoutRow): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('workout_log')
      .upsert(row, { onConflict: 'user_id,client_session_id', ignoreDuplicates: true });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Reintenta TODAS las sesiones pendientes del usuario actual. Se llama al abrir la app,
 * al recuperar conexión (`online`) y al volver a foco. Idempotente: cada éxito quita la fila
 * de la cola; los fallos permanecen para el próximo intento (nunca se pierden en silencio).
 */
export async function flushPendingWorkouts(): Promise<{ flushed: number; remaining: number }> {
  const store = useAppStore.getState();
  const userId = store.user?.id;
  const pending = store.pendingWorkoutSync;
  // Guard de reset: si un reset de entrenamiento está en curso, NO reintentar (evita re-insertar
  // una sesión antigua en workout_log justo después del DELETE remoto).
  if (flushSuspended || !userId || pending.length === 0) return { flushed: 0, remaining: pending.length };
  let flushed = 0;
  for (const row of pending.filter((r) => r.user_id === userId)) {
    // Un reset iniciado a mitad del loop lo detiene ANTES del próximo upsert.
    if (flushSuspended) break;
    const ok = await upsertWorkoutRow(row);
    if (ok) {
      useAppStore.getState().dequeuePendingWorkout(row.client_session_id);
      flushed++;
    }
  }
  return { flushed, remaining: useAppStore.getState().pendingWorkoutSync.length };
}
