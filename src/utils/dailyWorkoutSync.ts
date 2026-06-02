// Lógica pura de decisión del sync de dailyWorkout (+ regen count) — Lote Sync-3.
// Gemela de shouldUseRemotePlan (planSync.ts), misma semántica de timestamps.
//
// Diferencia clave de uso: en la hidratación SOLO se actúa sobre 'use_remote'
// (pull remote→local). NO hay auto-backfill local→DB en login — esa fue la
// causa del re-seed que se eliminó. La escritura a DB ocurre únicamente en el
// flujo explícito de generar (saveDailyWorkout / incrementDailyWorkoutRegen).

export type WorkoutSyncDecision = 'use_local' | 'use_remote' | 'noop';

/**
 * Decide qué hacer al hidratar dado el valor local y remoto de la rutina
 * (o del contador de regen). Mismo algoritmo que shouldUseRemotePlan:
 *
 * - local existe, remote no  → 'use_local'
 * - remote existe, local no  → 'use_remote'
 * - ambos existen            → gana el timestamp más nuevo
 * - ambos null               → 'noop'
 *
 * Fechas null/ inválidas se tratan como epoch (lo más viejo posible).
 */
export function shouldUseRemoteWorkout(
  localData: unknown,
  localUpdatedAt: string | null,
  remoteData: unknown,
  remoteUpdatedAt: string | null,
): WorkoutSyncDecision {
  const hasLocal = localData != null;
  const hasRemote = remoteData != null;

  if (!hasLocal && !hasRemote) return 'noop';
  if (hasLocal && !hasRemote) return 'use_local';
  if (!hasLocal && hasRemote) return 'use_remote';

  const localMs = localUpdatedAt ? Date.parse(localUpdatedAt) : 0;
  const remoteMs = remoteUpdatedAt ? Date.parse(remoteUpdatedAt) : 0;
  const local = Number.isFinite(localMs) ? localMs : 0;
  const remote = Number.isFinite(remoteMs) ? remoteMs : 0;

  if (remote > local) return 'use_remote';
  if (local > remote) return 'use_local';
  return 'noop';
}
