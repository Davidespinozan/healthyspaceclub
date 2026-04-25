/**
 * Comprime y recorta una imagen al formato cuadrado 1:1 antes de subirla a Supabase.
 *
 * - Recorta a cuadrado 1:1 desde el centro
 * - Resize a max 1080x1080 (suficiente para mostrar full-bleed en cualquier pantalla)
 * - Convierte a JPEG con quality 0.85 (balance peso/calidad)
 *
 * Resultado típico: archivos de 4-8 MB → 200-400 KB (20× menos peso).
 *
 * @param file - Archivo original del input file
 * @param maxSize - Tamaño máximo del lado del cuadrado (default 1080)
 * @param quality - Calidad JPEG entre 0 y 1 (default 0.85)
 * @returns Promise<Blob> - Blob JPEG cuadrado optimizado
 */
export async function compressImageSquare(
  file: File,
  maxSize: number = 1080,
  quality: number = 0.85
): Promise<Blob> {
  // Si no es imagen, devolver original sin modificar
  if (!file.type.startsWith('image/')) {
    return file;
  }

  const originalKB = Math.round(file.size / 1024);

  // Cargar la imagen
  const img = await loadImage(file);

  // Calcular el cuadrado de recorte centrado
  const sourceSize = Math.min(img.width, img.height);
  const sourceX = (img.width - sourceSize) / 2;
  const sourceY = (img.height - sourceSize) / 2;

  // Tamaño de salida (cap a maxSize)
  const targetSize = Math.min(sourceSize, maxSize);

  // Canvas para procesar
  const canvas = document.createElement('canvas');
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  // Mejor calidad de resize
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Dibujar la imagen recortada al cuadrado y redimensionada
  ctx.drawImage(
    img,
    sourceX, sourceY, sourceSize, sourceSize,  // crop source
    0, 0, targetSize, targetSize                // dest
  );

  // Convertir a Blob JPEG
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error('Canvas toBlob failed')),
      'image/jpeg',
      quality
    );
  });

  const compressedKB = Math.round(blob.size / 1024);
  const reduction = Math.round(100 - (compressedKB / originalKB) * 100);
  console.log(`[compressImageSquare] ${file.name}: ${originalKB}KB → ${compressedKB}KB (${reduction}% reduction)`);

  return blob;
}

/**
 * Helper interno: carga un File como HTMLImageElement.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    img.src = url;
  });
}
