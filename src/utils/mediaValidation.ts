import type { TranslationKey } from '../i18n/es';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

// Devuelve una CLAVE i18n (no un string fijo) + params opcionales, para que el
// componente que lo llama localice el mensaje con t(). El util solo importa el
// TYPE de i18n, sin acoplarse al runtime de traducción.
export interface MediaValidationResult {
  valid: boolean;
  errorKey?: TranslationKey;
  errorParams?: Record<string, string | number>;
}

export function validateMediaFile(file: File, allowVideo = false): MediaValidationResult {
  const allowedTypes = allowVideo
    ? [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES]
    : ALLOWED_IMAGE_TYPES;

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      errorKey: allowVideo ? 'media.typeVideo' : 'media.typeImage',
    };
  }

  const isVideo = file.type.startsWith('video/');
  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  const maxLabel = isVideo ? '50MB' : '10MB';

  if (file.size > maxSize) {
    return {
      valid: false,
      errorKey: 'media.tooLarge',
      errorParams: { max: maxLabel },
    };
  }

  // Check file extension matches MIME type
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const validExtensions = isVideo
    ? ['mp4', 'mov', 'webm']
    : ['jpg', 'jpeg', 'png', 'webp', 'gif'];

  if (!validExtensions.includes(ext)) {
    return {
      valid: false,
      errorKey: 'media.badExt',
    };
  }

  return { valid: true };
}
