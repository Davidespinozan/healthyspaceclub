// ACCOUNT-DELETE-1 · Gate B — capa cliente de la eliminación de cuenta.
// SIN lógica de borrado: solo invoca la Edge Function server-authoritative
// (delete-account) que deriva la identidad del JWT, y ante éxito purga el estado
// local por-usuario. NO usa service_role, NO toca Stripe/Storage/DB, NO acepta uid.

import { supabase } from '../lib/supabase';

export type DeleteAccountReason = 'network' | 'billing' | 'support' | 'unknown';
export type DeleteAccountResult = { ok: true } | { ok: false; reason: DeleteAccountReason };

// Llaves POR USUARIO a purgar en la eliminación (más agresivo que el logout normal:
// remueve el blob completo 'hsc-store', que incluye pendingWorkoutSync). PRESERVADAS
// a propósito (globales, no identifican al usuario): hsc_region, hsc_country,
// hsc-video-availability-v1, idioma/tema.
export const DELETE_PURGE_KEYS = [
  'hsc-store',
  'hsc-life-system-v2',
  'hsc-hsm-outbox',
  'workout-player-progress',
  'yoga-flow-progress',
  'day-complete-celebrated',
  'hsc_session_min',
  'hsc_priority_muscles',
  'hsc_ref_nudge_done',
  'hsc_ref',
] as const;

const PRESERVE_KEYS = ['hsc_region', 'hsc_country', 'hsc-video-availability-v1'] as const;
export const DELETE_PRESERVE_KEYS = PRESERVE_KEYS;

/** Purga local por-usuario tras una eliminación exitosa. Pura y testeable (storage
 *  inyectable). Nunca toca las llaves globales preservadas. */
export function purgeDeletedAccountLocalState(storage: Pick<Storage, 'removeItem'> = localStorage): void {
  for (const k of DELETE_PURGE_KEYS) {
    try { storage.removeItem(k); } catch { /* noop */ }
  }
}

/** Mapea el code del servidor → reason seguro para la UI (sin exponer detalles). */
export function mapDeleteCode(code: string | undefined): DeleteAccountResult {
  switch (code) {
    case 'ACCOUNT_DELETE_REQUIRES_SUPPORT': return { ok: false, reason: 'support' };
    case 'BILLING_CLEANUP_FAILED': return { ok: false, reason: 'billing' };
    default: return { ok: false, reason: 'unknown' };
  }
}

/** Interpreta el resultado de functions.invoke (pura). data.ok===true → éxito; si hay
 *  code → mapea; si solo hay error de transporte → network. */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function interpretDeleteResult(data: any, error: any): DeleteAccountResult {
  if (data?.ok === true) return { ok: true };
  if (data?.code) return mapDeleteCode(data.code);
  if (error) return { ok: false, reason: 'network' };
  return { ok: false, reason: 'unknown' };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Invoca la Edge Function. Ante éxito server-authoritative: purga local + signOut.
 *  Ante fallo: NO purga y NO cierra sesión (el usuario sigue autenticado y puede
 *  reintentar). La navegación post-éxito la hace el componente (reload a landing). */
export async function deleteMyAccount(): Promise<DeleteAccountResult> {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let data: any = null;
  let error: any = null;
  try {
    const r = await supabase.functions.invoke('delete-account', { body: {} });
    data = r.data;
    error = r.error;
    // functions.invoke deja el body de un non-2xx en error.context (Response).
    if (error && typeof error?.context?.json === 'function') {
      try { data = await error.context.json(); } catch { /* dejamos data como estaba */ }
    }
  } catch {
    return { ok: false, reason: 'network' };
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const result = interpretDeleteResult(data, error);
  if (result.ok) {
    purgeDeletedAccountLocalState();
    try { await supabase.auth.signOut(); } catch { /* la cuenta ya no existe; ignorar */ }
  }
  return result;
}
