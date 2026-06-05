// Fase 1B · Conexiones sociales — capa cliente sobre los RPC de Postgres.
// Toda la seguridad/privacidad vive en las funciones SECURITY DEFINER; aquí solo
// las llamamos y tipamos el resultado.

import { supabase } from '../lib/supabase';

export interface UserSearchResult {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  streak_count: number | null;
}

export interface Partnership {
  partnership_id: string;
  other_id: string;
  other_username: string | null;
  other_name: string | null;
  other_avatar: string | null;
  other_streak: number | null;
  status: 'pending' | 'accepted' | 'declined';
  direction: 'incoming' | 'outgoing';
  created_at: string;
}

export type InviteResult = 'sent' | 'self' | 'exists' | 'error';
export type RespondResult = 'accepted' | 'declined' | 'notfound' | 'error';

/** Busca usuarios por @usuario o nombre (mín. 2 chars, solo perfiles públicos).
 *  Quita el "@" del inicio para que escribir "@pedro" encuentre a "pedro". */
export async function searchUsers(q: string): Promise<UserSearchResult[]> {
  const query = q.trim().replace(/^@+/, '');
  if (query.length < 2) return [];
  const { data, error } = await supabase.rpc('search_users', { q: query });
  if (error) {
    console.warn('[partners] search failed:', error.message);
    return [];
  }
  return (data ?? []) as UserSearchResult[];
}

/** Envía invitación de conexión a un usuario. */
export async function sendInvite(targetId: string): Promise<InviteResult> {
  const { data, error } = await supabase.rpc('send_partner_invite', { target: targetId });
  if (error) {
    console.warn('[partners] invite failed:', error.message);
    return 'error';
  }
  if (data === 'sent' || data === 'self' || data === 'exists') return data;
  return 'error';
}

/** Acepta o rechaza una invitación recibida. */
export async function respondInvite(partnershipId: string, accept: boolean): Promise<RespondResult> {
  const { data, error } = await supabase.rpc('respond_partner_invite', {
    partnership: partnershipId,
    accept,
  });
  if (error) {
    console.warn('[partners] respond failed:', error.message);
    return 'error';
  }
  if (data === 'accepted' || data === 'declined' || data === 'notfound') return data;
  return 'error';
}

/** Lista todas mis conexiones (aceptadas + pendientes, entrantes y salientes). */
export async function listPartnerships(): Promise<Partnership[]> {
  const { data, error } = await supabase.rpc('list_partnerships');
  if (error) {
    console.warn('[partners] list failed:', error.message);
    return [];
  }
  return (data ?? []) as Partnership[];
}

/** Perfil de entrenamiento de un compañero conectado (nivel/equipo), para que la
 *  IA genere la rutina de pareja con datos reales. Lee user_preferences del otro
 *  usuario — requiere que la conexión esté aceptada (RLS / perfil público). */
export interface PartnerTrainingProfile {
  nivel?: string;
  equipment?: string[];
}

/** Entrega la rutina de pareja al daily_workout del compañero (sesión compartida).
 *  Solo surte efecto si están conectados (la función lo valida). */
export async function deliverPartnerWorkout(partnerId: string, plan: unknown): Promise<boolean> {
  const { data, error } = await supabase.rpc('deliver_partner_workout', { partner: partnerId, plan });
  if (error) {
    console.warn('[partners] deliver failed:', error.message);
    return false;
  }
  return data === 'delivered';
}

/** Cuántas veces YO he entrenado con este compañero (de mis propios logs). */
export async function countSessionsWith(partnerId: string): Promise<number> {
  const { count, error } = await supabase
    .from('workout_log')
    .select('id', { count: 'exact', head: true })
    .eq('partner_user_id', partnerId);
  if (error) return 0;
  return count ?? 0;
}

export async function getPartnerTrainingProfile(userId: string): Promise<PartnerTrainingProfile | null> {
  // RPC SECURITY DEFINER: solo devuelve datos si hay conexión aceptada.
  const { data, error } = await supabase.rpc('get_partner_profile', { partner: userId });
  if (error || !data || (Array.isArray(data) && data.length === 0)) return null;
  const row = (Array.isArray(data) ? data[0] : data) as { nivel?: string; equipment_default?: unknown };
  return {
    nivel: row.nivel,
    equipment: (row.equipment_default as string[] | undefined) ?? undefined,
  };
}
