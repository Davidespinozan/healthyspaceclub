// SOCIAL-2A · Lógica PURA de decisión de moderación (sin I/O). Es la autoridad
// de FORMA del veredicto: parseo estricto, agregación y mapeo fail-closed. La
// Edge Function `club-moderate` (Deno) replica esta misma lógica server-side;
// aquí vive la versión canónica y testeada. NO decide política de contenido
// (eso lo hace Claude en el servidor) — solo valida/normaliza el veredicto.

export type ModerationDecision = 'ALLOW' | 'REVIEW' | 'BLOCK';
export const VALID_DECISIONS: readonly ModerationDecision[] = ['ALLOW', 'REVIEW', 'BLOCK'];

export const VALID_CATEGORIES = [
  'SEXUAL_EXPLICIT', 'GRAPHIC_VIOLENCE', 'THREAT', 'HATE', 'HARASSMENT',
  'ILLEGAL_OR_DANGEROUS', 'SEXUAL_SUGGESTIVE', 'SPAM_SCAM', 'OTHER_UNSAFE',
] as const;
export type ModerationCategory = typeof VALID_CATEGORIES[number];

/** Outcome tipado que ve el cliente. ERROR/desconocido → MODERATION_UNAVAILABLE. */
export type ModerationOutcome =
  | 'PUBLISHED'              // ALLOW
  | 'BLOCKED_BY_POLICY'      // BLOCK
  | 'REVIEW_REQUIRED'        // REVIEW
  | 'MODERATION_UNAVAILABLE'; // fallo técnico (fail-closed)

export interface ModerationVerdict {
  decision: ModerationDecision;
  categories: ModerationCategory[];
  reason_code: string;
}

// Límites de entrada (input hygiene, NO política de contenido).
export const MAX_IMAGES = 4;
export const MAX_IMAGE_BYTES = 1_500_000; // ~1.5 MB por imagen ya comprimida
export const MAX_CAPTION_CHARS = 150;      // alineado con MAX_CAPTION del Club
export const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Bytes decodificados aproximados de una cadena base64 (sin data: prefix). */
export function base64Bytes(b64: string): number {
  if (!b64) return 0;
  const clean = b64.replace(/=+$/, '');
  return Math.floor((clean.length * 3) / 4);
}

/** ¿`s` es base64 plausible (charset válido, longitud múltiplo de 4)? */
export function isValidBase64(s: string): boolean {
  if (typeof s !== 'string' || s.length === 0) return false;
  if (s.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(s);
}

export interface ImageInput { mimeType: string; base64: string }

/** Valida las imágenes ANTES de gastar una llamada a Claude. Fail-closed. */
export function validateImageInput(
  images: ImageInput[] | undefined,
): { ok: true } | { ok: false; error: string } {
  const imgs = images ?? [];
  if (imgs.length > MAX_IMAGES) return { ok: false, error: 'too_many_images' };
  for (const img of imgs) {
    if (!img || !ALLOWED_MIME.has(img.mimeType)) return { ok: false, error: 'bad_mime' };
    if (!isValidBase64(img.base64)) return { ok: false, error: 'bad_base64' };
    if (base64Bytes(img.base64) > MAX_IMAGE_BYTES) return { ok: false, error: 'image_too_large' };
  }
  return { ok: true };
}

/**
 * Parseo ESTRICTO de la respuesta cruda del modelo → veredicto validado, o null
 * (que el caller trata como fallo técnico → fail-closed). Extrae el primer
 * objeto JSON, valida `decision` contra el enum y filtra categorías desconocidas.
 */
export function parseModerationResponse(raw: string): ModerationVerdict | null {
  if (typeof raw !== 'string') return null;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  let obj: unknown;
  try { obj = JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  const decision = o.decision;
  if (typeof decision !== 'string' || !VALID_DECISIONS.includes(decision as ModerationDecision)) {
    return null; // decisión ausente/desconocida → fail-closed
  }
  const validSet = new Set<string>(VALID_CATEGORIES);
  const categories = Array.isArray(o.categories)
    ? (o.categories.filter((c): c is ModerationCategory => typeof c === 'string' && validSet.has(c)))
    : [];
  const reason_code = typeof o.reason_code === 'string' ? o.reason_code.slice(0, 64) : '';
  return { decision: decision as ModerationDecision, categories, reason_code };
}

/**
 * Agrega varios veredictos parciales (defensivo, por si en el futuro se moderan
 * imágenes por separado): cualquier BLOCK → BLOCK; si no, cualquier REVIEW →
 * REVIEW; solo todo-ALLOW → ALLOW. Lista vacía → REVIEW (nunca ALLOW sin evidencia).
 */
export function aggregateDecisions(decisions: ModerationDecision[]): ModerationDecision {
  if (decisions.length === 0) return 'REVIEW';
  if (decisions.includes('BLOCK')) return 'BLOCK';
  if (decisions.includes('REVIEW')) return 'REVIEW';
  return 'ALLOW';
}

/** Mapea un veredicto (o null/ERROR) al outcome tipado del cliente. Fail-closed. */
export function mapDecisionToOutcome(decision: ModerationDecision | 'ERROR' | null | undefined): ModerationOutcome {
  switch (decision) {
    case 'ALLOW': return 'PUBLISHED';
    case 'BLOCK': return 'BLOCKED_BY_POLICY';
    case 'REVIEW': return 'REVIEW_REQUIRED';
    default: return 'MODERATION_UNAVAILABLE'; // ERROR, null, undefined, desconocido
  }
}
