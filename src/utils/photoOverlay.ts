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
    // Dim uniforme suave: el texto (centrado/arriba/abajo, según estilo) siempre legible.
    ctx.fillStyle = 'rgba(6,20,16,0.30)'; ctx.fillRect(0, 0, W, H);
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

  // 3) CONTENIDO por estilo. Todo el texto pasa por helpers ACOTADOS (fit/wrap) →
  //    imposible desbordar el borde de 1080. maxW = ancho seguro (W - 2·PAD).
  //    Regla anti-clutter (≤3 niveles): con `stat`, el NÚMERO es el héroe y NO se
  //    dibuja `subtitle` (el subtítulo solo aparece en momentos sin número).
  const maxW = W - PAD * 2;
  const kicker = art.title && art.title.trim() ? art.title.toUpperCase() : '';

  if (style === 'stat' && art.stat) {
    // ── NÚMERO — data-first: número héroe centrado, simétrico, peso 800. ──
    const cx = W / 2;
    const numPx = fitFontPx(ctx, art.stat.big, '800', maxW, 460, 200);
    const baseY = H * 0.56;
    if (kicker) {
      ctx.fillStyle = soft; ctx.font = `600 34px ${FONT}`;
      drawTracked(ctx, kicker, cx, baseY - numPx * 0.72 - 34, 5, 'center');
    }
    ctx.fillStyle = cream; ctx.font = `800 ${numPx}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.fillText(art.stat.big, cx, baseY); ctx.textAlign = 'left';
    ctx.fillStyle = gold; ctx.font = `700 48px ${FONT}`;
    drawTracked(ctx, art.stat.label.toUpperCase(), cx, baseY + 96, 6, 'center');
  } else if (style === 'editorial') {
    // ── EDITORIAL — minimal/fashion: tercio superior, peso LIGERO (300), regla de
    //    hilo dorada, mucho aire intencional debajo. ──
    const topY = H * 0.34;
    if (art.stat) {
      const numPx = fitFontPx(ctx, art.stat.big, '300', maxW, 360, 170);
      ctx.fillStyle = cream; ctx.font = `300 ${numPx}px ${FONT}`;
      ctx.fillText(art.stat.big, PAD, topY);
      ctx.fillStyle = gold; ctx.fillRect(PAD, topY + 44, 120, 3);
      ctx.fillStyle = soft; ctx.font = `500 40px ${FONT}`;
      drawTracked(ctx, art.stat.label.toUpperCase(), PAD, topY + 116, 8);
      if (kicker) { ctx.fillStyle = 'rgba(216,176,100,0.9)'; ctx.font = `700 26px ${FONT}`; drawTracked(ctx, kicker, PAD, topY - numPx * 0.82, 6); }
    } else {
      // sin número: el título (ligero) es el héroe, acotado a ≤3 líneas.
      ctx.fillStyle = cream;
      const bottom = drawHeadline(ctx, kicker, PAD, topY, maxW, 100, '300', 3);
      if (art.subtitle) { ctx.fillStyle = soft; ctx.font = `500 40px ${FONT}`; drawTracked(ctx, art.subtitle.toUpperCase(), PAD, bottom + 70, 6); }
    }
  } else {
    // ── OSCURO — bold/athletic: anclado abajo-izquierda, peso 800, tipo de "tarjeta
    //    de actividad". Funciona con foto (sobre el scrim inferior). ──
    ctx.textAlign = 'left';
    if (art.stat) {
      // Anclado abajo pero fuera de la zona de UI de Story (~250px inferiores).
      if (kicker) { ctx.fillStyle = gold; ctx.font = `700 42px ${FONT}`; drawTracked(ctx, kicker, PAD, H - 360, 5); }
      const numPx = fitFontPx(ctx, art.stat.big, '800', maxW, 240, 150);
      ctx.fillStyle = cream; ctx.font = `800 ${numPx}px ${FONT}`;
      ctx.fillText(art.stat.big, PAD, H - 220);
      ctx.fillStyle = soft; ctx.font = `600 44px ${FONT}`;
      drawTracked(ctx, art.stat.label.toUpperCase(), PAD, H - 156, 4);
    } else {
      // sin número: título héroe abajo, ≤3 líneas, acotado, fuera de la zona de UI.
      ctx.fillStyle = cream;
      drawHeadlineBottom(ctx, kicker, PAD, H - 230, maxW, 104, '800', 3);
      if (art.subtitle) { ctx.fillStyle = gold; ctx.font = `700 40px ${FONT}`; drawTracked(ctx, art.subtitle.toUpperCase(), PAD, H - 168, 5); }
    }
  }

  // 4) Sin footer-tagline obligatorio (VISUAL-P0 §5): la MARCA arriba firma el objeto;
  //    el eslogan como filler de plantilla se elimina para no parecer anuncio.

  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.92));
  if (!blob) throw new Error('compose failed');
  return blob;
}

// ── Helpers de texto ACOTADO (imposible desbordar 1080) ──────────────────────
const FIT_MIN = 120;

/** Mayor tamaño (px) del rango que hace que `text` quepa en una línea ≤ maxW. */
function fitFontPx(ctx: CanvasRenderingContext2D, text: string, weight: string, maxW: number, startPx: number, minPx: number): number {
  let px = startPx;
  while (px > minPx) {
    ctx.font = `${weight} ${px}px ${FONT}`;
    if (ctx.measureText(text).width <= maxW) break;
    px -= 8;
  }
  return px;
}

/** Ancho de un texto con letter-spacing manual (para acotar/centrar). */
function trackedWidth(ctx: CanvasRenderingContext2D, text: string, spacing: number): number {
  let w = 0; for (const ch of text) w += ctx.measureText(ch).width + spacing;
  return Math.max(0, w - spacing);
}

/** Dibuja con letter-spacing; align 'left' desde x, o 'center' centrado en x. La
 *  fuente ya debe estar seteada. Se asume que el llamador acotó el tamaño. */
function drawTracked(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, align: 'left' | 'center' = 'left') {
  const prev = ctx.textAlign; ctx.textAlign = 'left';
  let cx = align === 'center' ? x - trackedWidth(ctx, text, spacing) / 2 : x;
  for (const ch of text) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + spacing; }
  ctx.textAlign = prev;
}

/** Envuelve en líneas ≤ maxW (sin tracking). */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = []; let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** Titular multilínea que ENCOGE la fuente hasta caber en ≤ maxLines. Ancla la
 *  PRIMERA línea en baseline `y`, crece hacia abajo. Devuelve el baseline inferior. */
function drawHeadline(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, startPx: number, weight: string, maxLines: number): number {
  let px = startPx, lines: string[] = [];
  while (px > FIT_MIN) {
    ctx.font = `${weight} ${px}px ${FONT}`;
    lines = wrapLines(ctx, text, maxW);
    if (lines.length <= maxLines) break;
    px -= 8;
  }
  const lineH = px * 1.04;
  lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * lineH));
  return y + (lines.length - 1) * lineH;
}

/** Igual que drawHeadline pero anclado por ABAJO: la ÚLTIMA línea queda en baseline
 *  `yBottom`, el bloque crece hacia arriba (para composición abajo-izquierda). */
function drawHeadlineBottom(ctx: CanvasRenderingContext2D, text: string, x: number, yBottom: number, maxW: number, startPx: number, weight: string, maxLines: number): void {
  let px = startPx, lines: string[] = [];
  while (px > FIT_MIN) {
    ctx.font = `${weight} ${px}px ${FONT}`;
    lines = wrapLines(ctx, text, maxW);
    if (lines.length <= maxLines) break;
    px -= 8;
  }
  const lineH = px * 1.04;
  const topBaseline = yBottom - (lines.length - 1) * lineH;
  lines.forEach((ln, i) => ctx.fillText(ln, x, topBaseline + i * lineH));
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
