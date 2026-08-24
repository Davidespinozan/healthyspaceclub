// SOCIAL-1 · Moderación del Club: reportar contenido, bloquear/desbloquear
// usuarios, y helpers puros para filtrar el feed por bloqueos. La seguridad real
// vive en RLS (club_reports / user_blocks); estos helpers son la capa cliente.
import { supabase } from '../lib/supabase';

export const REPORT_REASONS = ['spam', 'harassment', 'inappropriate', 'misinformation', 'other'] as const;
export type ReportReason = typeof REPORT_REASONS[number];

/** ¿`r` es una razón de reporte válida? (espejo del CHECK de club_reports.reason) */
export function isValidReportReason(r: string): r is ReportReason {
  return (REPORT_REASONS as readonly string[]).includes(r);
}

/**
 * Deriva el user_id dueño de un objeto de storage a partir de su `name`, con la
 * MISMA regla que las policies SQL:
 *   avatar: "<uid>.jpg"        → split_part(name,'.',1)
 *   club:   "<uid>_<ts>[_i]"   → split_part(name,'_',1)
 * Devuelve null si no puede derivarse. Puro (testeable).
 */
export function storagePathOwner(bucket: 'club' | 'avatar', name: string): string | null {
  if (!name) return null;
  const token = bucket === 'avatar' ? name.split('.')[0] : name.split('_')[0];
  return token || null;
}

/**
 * Fusiona los ids bloqueados en ambos sentidos, quita duplicados y al propio
 * usuario. Espejo cliente de hsc_blocked_ids(). Puro (testeable).
 */
export function mergeBlockedIds(iBlocked: string[], blockedMe: string[], self?: string | null): string[] {
  const set = new Set<string>();
  for (const id of iBlocked) if (id) set.add(id);
  for (const id of blockedMe) if (id) set.add(id);
  if (self) set.delete(self);
  return [...set];
}

/** Filtra filas cuyo `key` (p.ej. user_id) esté en el conjunto bloqueado. Puro. */
export function filterBlocked<T>(rows: T[], blockedIds: Iterable<string>, key: (row: T) => string): T[] {
  const blocked = blockedIds instanceof Set ? blockedIds : new Set(blockedIds);
  if (blocked.size === 0) return rows;
  return rows.filter(r => !blocked.has(key(r)));
}

/** Reporta un post O un comentario. Exactamente uno de los dos ids. */
export async function reportContent(args: {
  postId?: string | null;
  commentId?: string | null;
  reason: string;
  details?: string;
}): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth?.user?.id;
  if (!me) return false;
  if (!isValidReportReason(args.reason)) return false;
  const hasPost = !!args.postId, hasComment = !!args.commentId;
  if (hasPost === hasComment) return false; // exactamente uno
  const { error } = await supabase.from('club_reports').insert({
    reporter_id: me,
    post_id: args.postId ?? null,
    comment_id: args.commentId ?? null,
    reason: args.reason,
    details: (args.details ?? '').slice(0, 500),
  });
  if (error && !String(error.message).includes('duplicate')) {
    console.warn('[moderation] report failed:', error.message);
    return false;
  }
  return true; // duplicado = ya reportado → idempotente OK
}

/** Bloquea a `targetId`. Rompe follows en ambos sentidos vía trigger. */
export async function blockUser(targetId: string): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth?.user?.id;
  if (!me || me === targetId) return false;
  const { error } = await supabase.from('user_blocks').insert({ blocker_id: me, blocked_id: targetId });
  if (error && !String(error.message).includes('duplicate')) {
    console.warn('[moderation] block failed:', error.message);
    return false;
  }
  return true;
}

/** Desbloquea a `targetId`. */
export async function unblockUser(targetId: string): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth?.user?.id;
  if (!me) return false;
  const { error } = await supabase.from('user_blocks').delete()
    .eq('blocker_id', me).eq('blocked_id', targetId);
  if (error) {
    console.warn('[moderation] unblock failed:', error.message);
    return false;
  }
  return true;
}

/** Ids a ocultar para el feed (unión bilateral vía RPC SECURITY DEFINER). */
export async function getBlockedIds(): Promise<string[]> {
  const { data, error } = await supabase.rpc('hsc_blocked_ids');
  if (error) {
    console.warn('[moderation] blocked ids failed:', error.message);
    return [];
  }
  return (data ?? []).map((r: { user_id: string }) => r.user_id);
}
