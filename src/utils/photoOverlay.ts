// Estilo Strava: toma la FOTO del usuario y le monta encima sus stats + el logo
// HSC, con un scrim para legibilidad. El resultado se comparte afuera con orgullo
// (navigator.share). Todo en cliente, sin subir nada.

export interface OverlayOpts {
  brand: string;                              // "HEALTHY SPACE CLUB"
  headline: string;                           // "ENTRENÉ HOY"
  stats: { big: string; label: string }[];    // [{big:'45', label:'MIN'}, ...]
  cta?: string;                               // "healthyspaceclub.com" — join hook en los píxeles
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
  // CTA de "únete" grabado en los píxeles: sobrevive al screenshot (que borra el
  // texto/link del share). Sin esto, una repost no trae a nadie de vuelta.
  if (opts.cta) {
    ctx.fillStyle = soft;
    ctx.font = `600 26px ${FONT}`;
    trackedLeft(ctx, opts.cta, PAD, 150, 2);
  }

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

// ─────────────────────────────────────────────────────────────────────────────
// SHARE-2 · P0 · composeShareImage: story 9:16 (1080×1920), foto OPCIONAL, 3 estilos.
// WYSIWYG: el mismo canvas se usa para preview y export. Marca HSC sutil (footer).
// Recibe SOLO strings display-safe (ShareMoment projection) — nunca datos crudos.
// ─────────────────────────────────────────────────────────────────────────────
export type ShareStyleName = 'dark' | 'editorial' | 'stat';
export interface ShareArt {
  title: string;
  subtitle?: string;
  stat?: { big: string; label: string };
  brand: string;      // 'Healthy Space'
  tagline: string;    // 'Cumple, no empieces de nuevo.'
}

function roundedTop(ctx: CanvasRenderingContext2D, W: number, color: string) {
  const g = ctx.createLinearGradient(0, 0, 0, 260);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(6,20,16,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 260);
}

/** Compone la imagen 1080×1920. Sin foto → fondo de marca; con foto → foto full-bleed. */
export async function composeShareImage(args: { art: ShareArt; style: ShareStyleName; photo?: Blob | null }): Promise<Blob> {
  const { art, style, photo } = args;
  const W = 1080, H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const forest = '#0E2521', forestDeep = '#081312';
  const gold = '#D8B064', cream = '#F4EFE3', soft = 'rgba(244,239,227,0.72)';
  const PAD = 84;

  // 1) FONDO — foto full-bleed (cover) o gradiente de marca (dark forest).
  if (photo) {
    const url = URL.createObjectURL(photo);
    try {
      const img = await loadImage(url);
      const scale = Math.max(W / img.width, H / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } finally { URL.revokeObjectURL(url); }
    // Scrim para legibilidad (más fuerte abajo).
    const scrim = ctx.createLinearGradient(0, H * 0.35, 0, H);
    scrim.addColorStop(0, 'rgba(6,20,16,0)'); scrim.addColorStop(1, 'rgba(6,20,16,0.9)');
    ctx.fillStyle = scrim; ctx.fillRect(0, 0, W, H);
    roundedTop(ctx, W, 'rgba(6,20,16,0.5)');
  } else {
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, forest); bg.addColorStop(1, forestDeep);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    // sutil halo dorado radial arriba
    const halo = ctx.createRadialGradient(W * 0.5, H * 0.28, 40, W * 0.5, H * 0.28, W * 0.75);
    halo.addColorStop(0, 'rgba(216,176,100,0.10)'); halo.addColorStop(1, 'rgba(216,176,100,0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
  }

  // 2) MARCA (arriba-izquierda) — sutil, no anuncio.
  ctx.textAlign = 'left';
  ctx.fillStyle = cream; ctx.font = `700 34px ${FONT}`;
  trackedLeft(ctx, art.brand.toUpperCase(), PAD, 116, 8);
  ctx.fillStyle = gold; ctx.fillRect(PAD, 138, 72, 5);

  // 3) CONTENIDO por estilo.
  if (style === 'stat' && art.stat) {
    // Un número héroe gigante centrado + label + título arriba.
    ctx.textAlign = 'center';
    ctx.fillStyle = soft; ctx.font = `600 40px ${FONT}`;
    trackedLeftCenter(ctx, art.title.toUpperCase(), W / 2, H * 0.34, 4);
    ctx.fillStyle = cream; ctx.font = `800 420px ${FONT}`;
    ctx.fillText(art.stat.big, W / 2, H * 0.60);
    ctx.fillStyle = gold; ctx.font = `700 46px ${FONT}`;
    trackedLeftCenter(ctx, art.stat.label.toUpperCase(), W / 2, H * 0.66, 6);
  } else if (style === 'editorial') {
    // Tipografía grande dominante, mínimo, mucho aire.
    ctx.textAlign = 'left';
    ctx.fillStyle = cream; ctx.font = `800 128px ${FONT}`;
    wrapText(ctx, art.title.toUpperCase(), PAD, H * 0.5, W - PAD * 2, 130);
    if (art.stat) {
      ctx.fillStyle = gold; ctx.font = `700 52px ${FONT}`;
      trackedLeft(ctx, `${art.stat.big} ${art.stat.label.toUpperCase()}`, PAD, H * 0.5 + 190, 3);
    } else if (art.subtitle) {
      ctx.fillStyle = soft; ctx.font = `600 48px ${FONT}`;
      trackedLeft(ctx, art.subtitle.toUpperCase(), PAD, H * 0.5 + 180, 4);
    }
  } else {
    // 'dark' — equilibrado: título + subtítulo/stat abajo-izquierda (funciona con foto).
    ctx.textAlign = 'left';
    ctx.fillStyle = gold; ctx.font = `700 46px ${FONT}`;
    if (art.subtitle) trackedLeft(ctx, art.subtitle.toUpperCase(), PAD, H - 360, 5);
    ctx.fillStyle = cream; ctx.font = `800 108px ${FONT}`;
    wrapText(ctx, art.title.toUpperCase(), PAD, H - 250, W - PAD * 2, 112);
    if (art.stat) {
      ctx.fillStyle = cream; ctx.font = `800 96px ${FONT}`;
      ctx.fillText(art.stat.big, PAD, H - 120);
      const bigW = ctx.measureText(art.stat.big).width;   // medir con la MISMA fuente (96px)
      ctx.fillStyle = soft; ctx.font = `600 40px ${FONT}`;
      trackedLeft(ctx, art.stat.label.toUpperCase(), PAD + bigW + 24, H - 132, 3);
    }
  }

  // 4) FOOTER de marca — sutil (tagline).
  ctx.textAlign = 'left';
  ctx.fillStyle = soft; ctx.font = `600 30px ${FONT}`;
  trackedLeft(ctx, art.tagline, PAD, H - 56, 1);

  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.92));
  if (!blob) throw new Error('compose failed');
  return blob;
}

function trackedLeftCenter(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, spacing: number) {
  ctx.save(); ctx.textAlign = 'left';
  let total = 0; for (const ch of text) total += ctx.measureText(ch).width + spacing;
  let x = cx - (total - spacing) / 2;
  for (const ch of text) { ctx.fillText(ch, x, y); x += ctx.measureText(ch).width + spacing; }
  ctx.restore();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
  const words = text.split(' ');
  let line = '', cy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, cy); line = w; cy += lineH; }
    else line = test;
  }
  if (line) ctx.fillText(line, x, cy);
}

export type ShareResult = 'shared' | 'downloaded';

export async function shareImage(blob: Blob, text: string, url: string): Promise<ShareResult> {
  const file = new File([blob], 'hsc.jpg', { type: 'image/jpeg' });
  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
  // En móvil el share con `files` NO manda el campo `url` — solo `text`. Así que el
  // link (con ?ref= para atribución) DEBE ir pegado al texto, o cada compartir sale
  // sin invitación ni crédito para quien comparte.
  const textWithLink = url ? `${text} ${url}` : text;
  try {
    if (nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], text: textWithLink });
      return 'shared';
    }
    if (nav.share) {
      await nav.share({ text, url });
      return 'shared';
    }
  } catch {
    return 'shared'; // canceló el sheet nativo → no es error
  }
  // Sin Web Share API (escritorio: Firefox, algunos Chrome): en vez de no hacer
  // nada, descargamos el JPEG compuesto y copiamos el link al portapapeles.
  try {
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = 'healthy-space-club.jpg';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
  } catch { /* descarga bloqueada → seguimos, al menos intentamos copiar el link */ }
  try { await navigator.clipboard?.writeText(url); } catch { /* sin permiso de portapapeles */ }
  return 'downloaded';
}
