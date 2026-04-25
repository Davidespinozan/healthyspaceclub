import { supabase } from '../lib/supabase';
import { compressImageSquare } from './imageCompress';
import { validateMediaFile } from './mediaValidation';

export interface UploadAvatarResult {
  url: string;
  error?: never;
}

export interface UploadAvatarError {
  url?: never;
  error: string;
}

export type UploadAvatarOutcome = UploadAvatarResult | UploadAvatarError;

/**
 * Upload an avatar image to Supabase Storage with automatic compression.
 * - Validates with validateMediaFile
 * - Compresses to max 720x720 square JPEG quality 0.85 (~80-150 KB typical)
 * - Forces .jpg extension (prevents orphan files in bucket)
 * - Uploads to 'avatar' bucket with upsert
 * - Returns the public URL with cache-busting timestamp
 */
export async function uploadAvatar(file: File, userId: string): Promise<UploadAvatarOutcome> {
  const check = validateMediaFile(file);
  if (!check.valid) {
    return { error: check.error || 'Archivo no válido' };
  }

  let compressed: Blob;
  try {
    compressed = await compressImageSquare(file, 720, 0.85);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al procesar la imagen';
    return { error: `No se pudo procesar la imagen: ${msg}` };
  }

  const path = `${userId}.jpg`;
  try {
    const { error: uploadErr } = await supabase.storage
      .from('avatar')
      .upload(path, compressed, {
        upsert: true,
        contentType: 'image/jpeg',
      });
    if (uploadErr) {
      return { error: `Error al subir: ${uploadErr.message}` };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error de red';
    return { error: `Error al subir: ${msg}` };
  }

  const { data } = supabase.storage.from('avatar').getPublicUrl(path);
  const url = `${data.publicUrl}?t=${Date.now()}`;
  return { url };
}
