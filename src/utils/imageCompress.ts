/**
 * Comprime una imagen al aspect ratio elegido antes de subirla a Supabase.
 *
 * Dos modos:
 *  - Center-crop (default): recorta centrado al aspect ratio pedido.
 *  - Explicit-crop: si recibe `cropPixels` (típicamente de react-easy-crop),
 *    usa esa región exacta del source en lugar de center-crop.
 *
 * Aspect ratios soportados (regla: dimensión menor = 1080):
 *  - '1:1'  → output 1080×1080  (cuadrado clásico)
 *  - '3:4'  → output 1080×1440  (vertical — match con cámara nativa iPhone)
 *  - '4:3'  → output 1440×1080  (horizontal — match con cámara nativa iPhone)
 *
 * JPEG 0.85 quality por defecto.
 */

export type AspectRatio = '1:1' | '3:4' | '4:3';

export interface CropPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CompressImageOptions {
  aspectRatio?: AspectRatio;
  /** Región exacta del source a recortar (de react-easy-crop). Si se omite, center-crop. */
  cropPixels?: CropPixels;
  /** Quality JPEG entre 0 y 1. Default 0.85. */
  quality?: number;
}

const DIMENSIONS: Record<AspectRatio, { w: number; h: number }> = {
  '1:1': { w: 1080, h: 1080 },
  '3:4': { w: 1080, h: 1440 },
  '4:3': { w: 1440, h: 1080 },
};

export async function compressImage(
  file: File,
  options: CompressImageOptions = {},
): Promise<Blob> {
  const aspectRatio = options.aspectRatio ?? '1:1';
  const quality = options.quality ?? 0.85;

  if (!file.type.startsWith('image/')) return file;

  const originalKB = Math.round(file.size / 1024);
  const img = await loadImage(file);

  const { w: targetW, h: targetH } = DIMENSIONS[aspectRatio];

  // Determinar región de recorte del source
  let srcX = 0, srcY = 0, srcW = img.width, srcH = img.height;
  if (options.cropPixels) {
    srcX = options.cropPixels.x;
    srcY = options.cropPixels.y;
    srcW = options.cropPixels.width;
    srcH = options.cropPixels.height;
  } else {
    // Center-crop al aspect ratio pedido
    const targetAspect = targetW / targetH;
    const srcAspect = img.width / img.height;
    if (srcAspect > targetAspect) {
      // Source más ancho: crop laterales
      srcW = img.height * targetAspect;
      srcX = (img.width - srcW) / 2;
    } else {
      // Source más alto: crop top/bottom
      srcH = img.width / targetAspect;
      srcY = (img.height - srcH) / 2;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, targetW, targetH);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
      'image/jpeg',
      quality,
    );
  });

  const compressedKB = Math.round(blob.size / 1024);
  const reduction = Math.round(100 - (compressedKB / originalKB) * 100);
  console.log(
    `[compressImage:${aspectRatio}] ${file.name}: ${originalKB}KB → ${compressedKB}KB (${reduction}% reduction)`,
  );

  return blob;
}

/**
 * Backwards-compat: avatar legacy callsite. Equivale a compressImage(file, { aspectRatio: '1:1' }).
 * @deprecated Usá compressImage directamente.
 */
export function compressImageSquare(file: File, _maxSize?: number, quality?: number): Promise<Blob> {
  return compressImage(file, { aspectRatio: '1:1', quality });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}
