import { supabase } from '../lib/supabase';

/** Extrae el path dentro del bucket 'club' desde una URL pública (o null). */
function clubPathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.split('/club/')[1] ?? null;
}

/**
 * Borra un post del Club junto con TODAS sus imágenes en storage (best-effort).
 *
 * - Borra la fila en `club_posts` (vía RLS: el dueño, o un admin para moderar).
 * - Limpia el archivo single (`photoUrl`) y los multi-imagen (`photoUrls`) del
 *   bucket 'club'. La policy de storage sólo deja borrar los propios / admin.
 * - DB deletion es autoritativa: si el remove del storage falla, se loggea pero
 *   NO bloquea (la fila ya está borrada; el archivo queda orphan para un job de
 *   limpieza posterior).
 *
 * @throws si el DELETE del DB falla (RLS denegado, conexión, etc.)
 */
export async function deleteClubPost(
  postId: string,
  photoUrl: string | null,
  photoUrls?: string[] | null,
): Promise<void> {
  const { error } = await supabase.from('club_posts').delete().eq('id', postId);
  if (error) throw error;

  const paths = [photoUrl, ...(photoUrls ?? [])]
    .map(clubPathFromUrl)
    .filter((p): p is string => !!p);
  const unique = [...new Set(paths)];
  if (unique.length > 0) {
    try {
      await supabase.storage.from('club').remove(unique);
    } catch (e) {
      console.warn('[deleteClubPost] storage remove failed (no-blocking):', e);
    }
  }
}
