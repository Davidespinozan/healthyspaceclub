import { supabase } from '../lib/supabase';
import { compressImageSquare } from './imageCompress';
import { validateMediaFile } from './mediaValidation';
import type { TranslationKey } from '../i18n/es';

export interface UploadAvatarResult {
  url: string;
  errorKey?: never;
}

export interface UploadAvatarError {
  url?: never;
  errorKey: TranslationKey;
  errorParams?: Record<string, string | number>;
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
    return { errorKey: check.errorKey ?? 'media.uploadFailed', errorParams: check.errorParams };
  }

  let compressed: Blob;
  try {
    compressed = await compressImageSquare(file, 720, 0.85);
  } catch (e) {
    console.error('[uploadAvatar] compress failed:', e);
    return { errorKey: 'media.processFailed' };
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
      return { errorKey: 'media.uploadFailed' };
    }
  } catch (e) {
    console.error('[uploadAvatar] upload failed:', e);
    return { errorKey: 'media.uploadFailed' };
  }

  const { data } = supabase.storage.from('avatar').getPublicUrl(path);
  const url = `${data.publicUrl}?t=${Date.now()}`;
  return { url };
}
