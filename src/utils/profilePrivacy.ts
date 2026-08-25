// PROFILE-1 · Gate B — helpers de privacidad de perfil + fiabilidad de guardado.
// La AUTORIDAD de is_public es remota (user_profiles). Estos helpers son puros o
// aceptan un cliente inyectable (para test) y solo tocan la columna is_public —
// NUNCA columnas de billing/admin (las bloquea guard_user_profiles_billing).

import { supabase as realSupabase } from '../lib/supabase';

// Forma mínima que necesitamos del cliente (permite inyectar un doble en tests).
/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = { from: (table: string) => any };
/* eslint-enable @typescript-eslint/no-explicit-any */

export const BIO_MAX = 100;

/** ¿Pasar de público→privado requiere confirmación? (privado→público es inmediato). */
export function privateToggleNeedsConfirm(current: boolean, next: boolean): boolean {
  return current === true && next === false;
}

/** ¿El perfil es visible para renderizar? Uno mismo SIEMPRE (lee su propia fila);
 *  otros SOLO si la vista is_public-gated (public_profiles) devolvió fila. Este es
 *  el guard que cierra la enumeración de perfiles privados por terceros. */
export function isProfileViewable(profileRow: unknown | null | undefined, isSelf: boolean): boolean {
  return isSelf || profileRow != null;
}

/** Conteo real de posts: usa el count EXACTO del servidor; cae al length cargado
 *  solo si el count falta (antes el modal mostraba posts.length con LIMIT 50 →
 *  subcontaba a partir de 51). */
export function resolvePostCount(exactCount: number | null | undefined, loadedLength: number): number {
  return typeof exactCount === 'number' ? exactCount : loadedLength;
}

/** Cap duro del bio a 100 chars (una sola fuente de verdad). */
export function capBio(s: string): string {
  return s.slice(0, BIO_MAX);
}

/** Lee is_public remoto (autoridad). Devuelve null si no hay fila / error.
 *  null/undefined en la columna se trata como PÚBLICO (el default del backend). */
export async function fetchProfileIsPublic(userId: string, db: Db = realSupabase): Promise<boolean | null> {
  try {
    const { data, error } = await db.from('user_profiles').select('is_public').eq('user_id', userId).maybeSingle();
    if (error || !data) return null;
    return (data as { is_public?: boolean | null }).is_public !== false;
  } catch {
    return null;
  }
}

/** Persiste is_public en la fila propia (RLS: owner-only). Escribe SOLO is_public.
 *  Devuelve true en éxito; false ante error (el caller revierte la UI, sin falso éxito). */
export async function persistProfileIsPublic(userId: string, isPublic: boolean, db: Db = realSupabase): Promise<boolean> {
  try {
    const { error } = await db.from('user_profiles').update({ is_public: isPublic }).eq('user_id', userId);
    return !error;
  } catch {
    return false;
  }
}
