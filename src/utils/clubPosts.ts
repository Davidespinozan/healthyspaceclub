import { supabase } from '../lib/supabase';

/**
 * Borra un post del Club junto con su archivo en storage (best-effort).
 *
 * - Borra la fila en `club_posts` (vía RLS: solo dueño puede).
 * - Si tenía photo_url, intenta limpiar el archivo en el bucket 'club'.
 * - Si el remove del storage falla, lo loggea pero NO bloquea (la fila ya
 *   está borrada y el archivo queda como orphan — más adelante un job de
 *   limpieza lo agarra).
 *
 * @throws si el DELETE del DB falla (RLS denegado, conexión, etc.)
 */
export async function deleteClubPost(postId: string, photoUrl: string | null): Promise<void> {
  const { error } = await supabase.from('club_posts').delete().eq('id', postId);
  if (error) throw error;

  if (photoUrl) {
    const path = photoUrl.split('/club/')[1];
    if (path) {
      try {
        await supabase.storage.from('club').remove([path]);
      } catch (e) {
        console.warn('[deleteClubPost] storage remove failed (no-blocking):', e);
      }
    }
  }
}
