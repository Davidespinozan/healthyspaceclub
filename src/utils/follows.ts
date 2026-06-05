// Grafo social: seguir / dejar de seguir + contadores. La seguridad vive en RLS
// (solo puedes insertar/borrar follows tuyos).
import { supabase } from '../lib/supabase';

export async function followUser(targetId: string): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth?.user?.id;
  if (!me || me === targetId) return false;
  const { error } = await supabase.from('follows').insert({ follower_id: me, following_id: targetId });
  if (error && !String(error.message).includes('duplicate')) {
    console.warn('[follows] follow failed:', error.message);
    return false;
  }
  return true;
}

export async function unfollowUser(targetId: string): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth?.user?.id;
  if (!me) return false;
  const { error } = await supabase.from('follows').delete()
    .eq('follower_id', me).eq('following_id', targetId);
  if (error) {
    console.warn('[follows] unfollow failed:', error.message);
    return false;
  }
  return true;
}

/** ¿El usuario actual sigue a `targetId`? */
export async function isFollowing(targetId: string): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth?.user?.id;
  if (!me) return false;
  const { data } = await supabase.from('follows')
    .select('following_id')
    .eq('follower_id', me).eq('following_id', targetId)
    .maybeSingle();
  return !!data;
}

/** Seguidores y seguidos de un usuario. */
export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [f1, f2] = await Promise.all([
    supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', userId),
  ]);
  return { followers: f1.count ?? 0, following: f2.count ?? 0 };
}

/** IDs que el usuario actual sigue (para el feed de "Siguiendo"). */
export async function getFollowingIds(): Promise<string[]> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth?.user?.id;
  if (!me) return [];
  const { data } = await supabase.from('follows').select('following_id').eq('follower_id', me);
  return (data ?? []).map(r => (r as { following_id: string }).following_id);
}
