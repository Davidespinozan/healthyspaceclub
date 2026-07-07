// Estilo Strava: toma la FOTO del usuario y le monta encima sus stats + el logo
// HSC, con un scrim para legibilidad. El resultado se comparte afuera con orgullo
// (navigator.share). Todo en cliente, sin subir nada.

export interface OverlayOpts {
  brand: string;                              // "HEALTHY SPACE CLUB"
  headline: string;                           // "ENTRENÉ HOY"
  stats: { big: string; label: string }[];    // [{big:'45', label:'MIN'}, ...]
}

const FONT = "'Montserrat', -apple-system, 'Helvetica Neue', Arial, sans-serif";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Dibuja texto con letter-spacing manual desde x (alineado a la izquierda).
function trackedLeft(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
}

export async function composeStatPhoto(photo: Blob, opts: OverlayOpts): Promise<Blob> {
  const W = 1080, H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // 1) Foto del usuario, cover-fit (centrada, recortada para llenar el marco).
  const url = URL.createObjectURL(photo);
  try {
    const img = await loadImage(url);
    const scale = Math.max(W / img.width, H / img.height);
    const dw = img.width * scale, dh = img.height * scale;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  } finally {
    URL.revokeObjectURL(url);
  }

  // 2) Scrim: oscurece la parte inferior para que el texto siempre se lea.
  const scrim = ctx.createLinearGradient(0, H * 0.42, 0, H);
  scrim.addColorStop(0, 'rgba(6,20,16,0)');
  scrim.addColorStop(1, 'rgba(6,20,16,0.86)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, W, H);
  // Halo superior sutil para el logo.
  const top = ctx.createLinearGradient(0, 0, 0, 220);
  top.addColorStop(0, 'rgba(6,20,16,0.45)');
  top.addColorStop(1, 'rgba(6,20,16,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, 220);

  const gold = '#D8B064';
  const cream = '#F4EFE3';
  const soft = 'rgba(244,239,227,0.72)';
  const PAD = 64;

  // 3) Logo/marca arriba-izquierda.
  ctx.textAlign = 'left';
  ctx.fillStyle = cream;
  ctx.font = `700 30px ${FONT}`;
  trackedLeft(ctx, opts.brand.toUpperCase(), PAD, 92, 7);
  // línea dorada bajo la marca
  ctx.fillStyle = gold;
  ctx.fillRect(PAD, 108, 66, 4);

  // 4) Bloque de stats abajo-izquierda (estilo Strava).
  ctx.fillStyle = gold;
  ctx.font = `700 34px ${FONT}`;
  trackedLeft(ctx, opts.headline.toUpperCase(), PAD, H - 260, 5);

  const cols = opts.stats.slice(0, 3);
  const colW = (W - PAD * 2) / cols.length;
  cols.forEach((s, i) => {
    const x = PAD + i * colW;
    ctx.fillStyle = cream;
    ctx.font = `800 110px ${FONT}`;
    ctx.fillText(s.big, x, H - 120);
    ctx.fillStyle = soft;
    ctx.font = `600 30px ${FONT}`;
    trackedLeft(ctx, s.label.toUpperCase(), x, H - 74, 3);
  });

  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.92));
  if (!blob) throw new Error('compose failed');
  return blob;
}

export type ShareResult = 'shared' | 'unsupported';

export async function shareImage(blob: Blob, text: string, url: string): Promise<ShareResult> {
  const file = new File([blob], 'hsc.jpg', { type: 'image/jpeg' });
  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
  try {
    if (nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], text });
      return 'shared';
    }
    if (nav.share) {
      await nav.share({ text, url });
      return 'shared';
    }
  } catch {
    return 'shared'; // canceló el sheet nativo → no es error
  }
  return 'unsupported';
}
