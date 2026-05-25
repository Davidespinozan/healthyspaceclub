// Lógica pura de decisión del backfill push-then-pull para weeklyPlan.
// Lote Sync-1.
//
// Riesgo crítico que esta función previene: si hidratáramos al login con
// `setState({ weeklyPlan: remote })` sin chequear primero, los usuarios
// existentes (David incluido) tienen `weeklyPlan` en localStorage pero
// Supabase está vacío (recién agregamos la columna). Sin esta lógica, el
// pull pisaría el local con null → pérdida del plan.
//
// shouldUseRemotePlan compara local vs remote y dice qué hacer:
// - 'use_local'  → backfill: subir el local a Supabase (mantener local)
// - 'use_remote' → pull: bajar el remote y reemplazar local
// - 'noop'       → ambos null o coinciden, no hacer nada
//
// Patrón idéntico al backfill de streak/milestones que ya existe en App.tsx.

export type PlanSyncDecision = 'use_local' | 'use_remote' | 'noop';

/**
 * Decide qué hacer al hidratar al login dada la versión local y remota
 * del weeklyPlan.
 *
 * - Si remote === null && local !== null → 'use_local' (backfill push)
 * - Si remote !== null && local === null → 'use_remote' (pull)
 * - Si ambos existen → comparar timestamps; el más nuevo gana. Si remote
 *   es estrictamente más nuevo → use_remote. Si local es estrictamente
 *   más nuevo → use_local (re-push para sincronizar el timestamp). Si
 *   son iguales → noop.
 * - Si ambos null → 'noop'
 *
 * Fechas null en cualquier lado se consideran "epoch" (lo más viejo posible).
 */
export function shouldUseRemotePlan(
  localPlan: unknown,
  localUpdatedAt: string | null,
  remotePlan: unknown,
  remoteUpdatedAt: string | null,
): PlanSyncDecision {
  const hasLocal = localPlan != null;
  const hasRemote = remotePlan != null;

  if (!hasLocal && !hasRemote) return 'noop';
  if (hasLocal && !hasRemote) return 'use_local';
  if (!hasLocal && hasRemote) return 'use_remote';

  // Ambos existen — comparar timestamps
  const localMs = localUpdatedAt ? Date.parse(localUpdatedAt) : 0;
  const remoteMs = remoteUpdatedAt ? Date.parse(remoteUpdatedAt) : 0;

  // NaN-safe: si alguna fecha es inválida, se trata como 0
  const local = Number.isFinite(localMs) ? localMs : 0;
  const remote = Number.isFinite(remoteMs) ? remoteMs : 0;

  if (remote > local) return 'use_remote';
  if (local > remote) return 'use_local';
  return 'noop';
}
