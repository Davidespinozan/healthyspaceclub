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

/** Notifica en vivo a un usuario (broadcast a su canal personal) para que su
 *  pantalla se actualice al instante, sin recargar. */
function notifyUser(userId: string, event: string) {
  try {
    const ch = supabase.channel(`user:${userId}`);
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        ch.send({ type: 'broadcast', event, payload: {} }).finally(() => {
          setTimeout(() => { try { supabase.removeChannel(ch); } catch { /* noop */ } }, 500);
        });
      }
    });
  } catch { /* noop */ }
}

/** Inserta una notificación in-app para `recipientId` con el actor = usuario
 *  actual (resuelve su username/avatar). No notifica si te lo haces a ti mismo. */
async function pushNotification(
  recipientId: string,
  type: 'partner_invite' | 'partner_accept',
) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const me = auth?.user?.id;
    if (!me || me === recipientId) return;
    const { data: prof } = await supabase
      .from('user_profiles').select('username, avatar_url').eq('user_id', me).single();
    await supabase.from('notifications').insert({
      user_id: recipientId,
      actor_id: me,
      actor_username: prof?.username ?? '',
      actor_avatar_url: prof?.avatar_url ?? '',
      type,
    });
  } catch { /* noop */ }
}

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
  if (data === 'sent') {
    notifyUser(targetId, 'invite');          // aparece al instante en su pantalla
    pushNotification(targetId, 'partner_invite'); // queda en su centro de notificaciones
  }
  if (data === 'sent' || data === 'self' || data === 'exists') return data;
  return 'error';
}

/** Acepta o rechaza una invitación recibida. `inviterId` (opcional) permite
 *  notificar al que invitó cuando aceptas. */
export async function respondInvite(
  partnershipId: string,
  accept: boolean,
  inviterId?: string,
): Promise<RespondResult> {
  const { data, error } = await supabase.rpc('respond_partner_invite', {
    partnership: partnershipId,
    accept,
  });
  if (error) {
    console.warn('[partners] respond failed:', error.message);
    return 'error';
  }
  if (data === 'accepted' && inviterId) {
    notifyUser(inviterId, 'partner_accept');
    pushNotification(inviterId, 'partner_accept');
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
  if (data === 'delivered') {
    // Avisa al compañero para que su rutina de hoy aparezca al instante.
    notifyUser(partnerId, 'partner_workout');
  }
  return data === 'delivered';
}

/** day_type recientes del compañero (últimas ~36h) — para evitar sus músculos
 *  al generar la rutina de pareja. Solo si están conectados (lo valida la función). */
export async function getPartnerRecentDaytypes(partnerId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_partner_recent_daytypes', { partner: partnerId });
  if (error || !Array.isArray(data)) return [];
  return (data as string[]).filter(Boolean);
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
