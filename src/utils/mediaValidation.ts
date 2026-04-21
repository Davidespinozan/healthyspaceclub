const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

export interface MediaValidationResult {
  valid: boolean;
  error?: string;
}

export function validateMediaFile(file: File, allowVideo = false): MediaValidationResult {
  const allowedTypes = allowVideo
    ? [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES]
    : ALLOWED_IMAGE_TYPES;

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: allowVideo
        ? 'Solo se permiten imágenes (JPG, PNG, WebP) y videos (MP4, MOV, WebM).'
        : 'Solo se permiten imágenes (JPG, PNG, WebP).',
    };
  }

  const isVideo = file.type.startsWith('video/');
  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  const maxLabel = isVideo ? '50MB' : '10MB';

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `El archivo es demasiado grande. Máximo ${maxLabel}.`,
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
      error: 'La extensión del archivo no coincide con el tipo permitido.',
    };
  }

  return { valid: true };
}
