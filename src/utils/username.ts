// Fase 1A · Identidad social — helpers de @usuario.
// El handle es case-insensitive, formato [a-z0-9_]{3,20}. La unicidad y el
// claim atómico viven en Postgres (claim_username / is_username_available).

import { supabase } from '../lib/supabase';

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** ¿El handle cumple el formato? (no chequea disponibilidad). */
export function isValidUsernameFormat(handle: string): boolean {
  return USERNAME_RE.test(handle);
}

/**
 * Sugiere un @usuario a partir del nombre: minúsculas, sin acentos, espacios→_,
 * solo [a-z0-9_], recortado al máximo. Rellena con dígitos si queda muy corto.
 */
export function suggestUsername(name: string | undefined | null): string {
  const base = (name || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')   // todo lo no alfanumérico → _
    .replace(/_+/g, '_')           // colapsa _ repetidos
    .replace(/^_+|_+$/g, '')       // sin _ al inicio/fin
    .slice(0, USERNAME_MAX);
  if (base.length >= USERNAME_MIN) return base;
  // Nombre vacío o demasiado corto → handle genérico estable-ish.
  return (base || 'user').padEnd(USERNAME_MIN, '0').slice(0, USERNAME_MAX);
}

/** ¿Está libre el handle? (incluye perfiles privados, vía RPC SECURITY DEFINER). */
export async function checkUsernameAvailable(handle: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_username_available', { candidate: handle });
  if (error) {
    console.warn('[username] availability check failed:', error.message);
    return false; // ante la duda, no afirmamos disponible
  }
  return data === true;
}

export type ClaimResult = 'ok' | 'taken' | 'invalid' | 'error';

/** Reclama el handle para el usuario actual (atómico, race-safe). */
export async function claimUsername(handle: string): Promise<ClaimResult> {
  const { data, error } = await supabase.rpc('claim_username', { candidate: handle });
  if (error) {
    console.warn('[username] claim failed:', error.message);
    return 'error';
  }
  if (data === 'ok' || data === 'taken' || data === 'invalid') return data;
  return 'error';
}
