import { describe, it, expect } from 'vitest';
import {
  parseModerationResponse,
  aggregateDecisions,
  mapDecisionToOutcome,
  validateImageInput,
  base64Bytes,
  isValidBase64,
  VALID_CATEGORIES,
  MAX_IMAGE_BYTES,
  type ImageInput,
} from '../clubModerationDecision';
import { MODERATION_SYSTEM_PROMPT } from '../../../supabase/functions/club-moderate/moderationPrompt';

// SOCIAL-2A · lógica PURA de moderación (parse/agregación/mapeo/validación).
const b64 = (bytes: number) => 'A'.repeat(Math.ceil((bytes * 4) / 3 / 4) * 4); // base64 válido de ~bytes

describe('SOCIAL-2A · aggregateDecisions', () => {
  it('A · todo ALLOW → ALLOW', () => expect(aggregateDecisions(['ALLOW', 'ALLOW', 'ALLOW'])).toBe('ALLOW'));
  it('B · cualquier BLOCK → BLOCK', () => expect(aggregateDecisions(['ALLOW', 'BLOCK'])).toBe('BLOCK'));
  it('C · cualquier REVIEW (sin BLOCK) → REVIEW', () => expect(aggregateDecisions(['ALLOW', 'REVIEW'])).toBe('REVIEW'));
  it('D · BLOCK domina a REVIEW', () => expect(aggregateDecisions(['REVIEW', 'BLOCK', 'ALLOW'])).toBe('BLOCK'));
  it('vacío → REVIEW (nunca ALLOW sin evidencia)', () => expect(aggregateDecisions([])).toBe('REVIEW'));
});

describe('SOCIAL-2A · parseModerationResponse (fail-closed)', () => {
  it('parsea JSON válido y filtra categorías desconocidas (O)', () => {
    const v = parseModerationResponse('{"decision":"BLOCK","categories":["SEXUAL_EXPLICIT","NOPE"],"reason_code":"porn"}');
    expect(v).toEqual({ decision: 'BLOCK', categories: ['SEXUAL_EXPLICIT'], reason_code: 'porn' });
  });
  it('extrae el objeto aunque venga con texto alrededor', () => {
    expect(parseModerationResponse('aquí tienes: {"decision":"ALLOW","categories":[]} fin')?.decision).toBe('ALLOW');
  });
  it('E · decisión desconocida → null', () => expect(parseModerationResponse('{"decision":"MAYBE"}')).toBeNull());
  it('F · JSON malformado → null', () => expect(parseModerationResponse('{decision: BLOCK')).toBeNull());
  it('sin objeto → null', () => expect(parseModerationResponse('no json here')).toBeNull());
  it('decision ausente → null', () => expect(parseModerationResponse('{"categories":["HATE"]}')).toBeNull());
  it('categorías no-array → []', () => expect(parseModerationResponse('{"decision":"ALLOW","categories":"x"}')?.categories).toEqual([]));
});

describe('SOCIAL-2A · mapDecisionToOutcome (fail-closed)', () => {
  it('ALLOW → PUBLISHED', () => expect(mapDecisionToOutcome('ALLOW')).toBe('PUBLISHED'));
  it('BLOCK → BLOCKED_BY_POLICY', () => expect(mapDecisionToOutcome('BLOCK')).toBe('BLOCKED_BY_POLICY'));
  it('REVIEW → REVIEW_REQUIRED', () => expect(mapDecisionToOutcome('REVIEW')).toBe('REVIEW_REQUIRED'));
  it('G · ERROR → MODERATION_UNAVAILABLE (timeout/5xx)', () => expect(mapDecisionToOutcome('ERROR')).toBe('MODERATION_UNAVAILABLE'));
  it('H · null/undefined → MODERATION_UNAVAILABLE (rate-limit/desconocido)', () => {
    expect(mapDecisionToOutcome(null)).toBe('MODERATION_UNAVAILABLE');
    expect(mapDecisionToOutcome(undefined)).toBe('MODERATION_UNAVAILABLE');
  });
});

describe('SOCIAL-2A · validateImageInput (input hygiene, fail-closed)', () => {
  const img = (over: Partial<ImageInput> = {}): ImageInput => ({ mimeType: 'image/jpeg', base64: b64(1000), ...over });
  it('L · MIME seguro + tamaño ok → ok', () => expect(validateImageInput([img(), img({ mimeType: 'image/png' }), img({ mimeType: 'image/webp' })])).toEqual({ ok: true }));
  it('0 imágenes → ok (post solo-texto)', () => expect(validateImageInput([])).toEqual({ ok: true }));
  it('K · >4 imágenes → too_many_images', () => expect(validateImageInput([img(), img(), img(), img(), img()])).toEqual({ ok: false, error: 'too_many_images' }));
  it('M · MIME no permitido (gif) → bad_mime', () => expect(validateImageInput([img({ mimeType: 'image/gif' })])).toEqual({ ok: false, error: 'bad_mime' }));
  it('I · base64 malformado → bad_base64', () => expect(validateImageInput([img({ base64: 'not!base64!!' })])).toEqual({ ok: false, error: 'bad_base64' }));
  it('J · imagen sobredimensionada → image_too_large', () => expect(validateImageInput([img({ base64: b64(MAX_IMAGE_BYTES + 5000) })])).toEqual({ ok: false, error: 'image_too_large' }));
});

describe('SOCIAL-2A · base64 helpers', () => {
  it('base64Bytes aproxima los bytes decodificados', () => { expect(base64Bytes(b64(1000))).toBeGreaterThanOrEqual(996); expect(base64Bytes(b64(1000))).toBeLessThanOrEqual(1004); });
  it('isValidBase64 rechaza charset inválido y longitud no múltiplo de 4', () => {
    expect(isValidBase64('QUJD')).toBe(true);
    expect(isValidBase64('AB*C')).toBe(false);
    expect(isValidBase64('ABC')).toBe(false);
    expect(isValidBase64('')).toBe(false);
  });
});

describe('SOCIAL-2A · P · el prompt codifica el contrato fitness-allow', () => {
  it('permite explícitamente exposición corporal atlética', () => {
    for (const s of ['sin camiseta', 'sports bra', 'bikini', 'progreso', 'culturismo', 'glúteos', 'de la verga']) {
      expect(MODERATION_SYSTEM_PROMPT.toLowerCase()).toContain(s.toLowerCase());
    }
  });
  it('bloquea contenido sexual explícito y define REVIEW para lo ambiguo', () => {
    expect(MODERATION_SYSTEM_PROMPT).toContain('Pornografía');
    expect(MODERATION_SYSTEM_PROMPT).toContain('BLOCK');
    expect(MODERATION_SYSTEM_PROMPT).toContain('REVIEW');
  });
  it('marca el caption como dato no confiable (anti prompt-injection)', () => {
    expect(MODERATION_SYSTEM_PROMPT.toLowerCase()).toContain('no son instrucciones');
  });
  it('las 9 categorías del enum están en el prompt', () => {
    for (const c of VALID_CATEGORIES) expect(MODERATION_SYSTEM_PROMPT).toContain(c);
  });
});
