import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock del cliente supabase: solo interceptamos functions.invoke.
const invokeMock = vi.fn();
vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invokeMock(...a) } },
}));

import { moderateAndPublish, blobToBase64, type ModeratePostInput } from '../clubContentModeration';

const okImg = { mimeType: 'image/jpeg' as const, base64: 'QUJDRA==' }; // "ABCD"

describe('SOCIAL-2A · moderateAndPublish (cliente, fail-closed)', () => {
  beforeEach(() => invokeMock.mockReset());

  it('PUBLISHED pasa el post', async () => {
    invokeMock.mockResolvedValue({ data: { outcome: 'PUBLISHED', post: { id: 'p1' } }, error: null });
    const r = await moderateAndPublish({ text: 'hola' });
    expect(r).toEqual({ outcome: 'PUBLISHED', post: { id: 'p1' } });
  });

  it('BLOCK/REVIEW se propagan tal cual', async () => {
    invokeMock.mockResolvedValue({ data: { outcome: 'BLOCKED_BY_POLICY' }, error: null });
    expect((await moderateAndPublish({ text: 'x' })).outcome).toBe('BLOCKED_BY_POLICY');
    invokeMock.mockResolvedValue({ data: { outcome: 'REVIEW_REQUIRED' }, error: null });
    expect((await moderateAndPublish({ text: 'x' })).outcome).toBe('REVIEW_REQUIRED');
  });

  it('error de invoke (429/5xx/timeout, error-object de supabase) → MODERATION_UNAVAILABLE (no publica)', async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect((await moderateAndPublish({ text: 'x' })).outcome).toBe('MODERATION_UNAVAILABLE');
  });

  it('data nula sin error → fail-closed (defensa)', async () => {
    invokeMock.mockResolvedValue({ data: null, error: null });
    expect((await moderateAndPublish({ text: 'x' })).outcome).toBe('MODERATION_UNAVAILABLE');
  });

  it('outcome desconocido del server → fail-closed', async () => {
    invokeMock.mockResolvedValue({ data: { outcome: 'WHATEVER' }, error: null });
    expect((await moderateAndPublish({ text: 'x' })).outcome).toBe('MODERATION_UNAVAILABLE');
  });

  it('N · pre-check local (>4 imágenes) rechaza SIN invocar (no fallback a insert directo)', async () => {
    const many = Array.from({ length: 5 }, () => okImg);
    const r = await moderateAndPublish({ images: many });
    expect(r.outcome).toBe('MODERATION_UNAVAILABLE');
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('R · el payload a la función NO contiene PII (solo campos de contenido)', async () => {
    invokeMock.mockResolvedValue({ data: { outcome: 'PUBLISHED', post: {} }, error: null });
    const input: ModeratePostInput = {
      text: 'entrené fuerte', images: [okImg], post_context: 'workout',
      workout_summary: 'Piernas · 45m', coauthor_id: null, aspect_ratio: '1:1',
    };
    await moderateAndPublish(input);
    const body = invokeMock.mock.calls[0][1].body as Record<string, unknown>;
    const allowed = new Set(['text', 'images', 'post_context', 'workout_summary', 'meal_summary', 'coauthor_id', 'aspect_ratio']);
    for (const k of Object.keys(body)) expect(allowed.has(k)).toBe(true);
    for (const forbidden of ['user_id', 'username', 'email', 'display_name', 'weight', 'streak', 'tdee', 'avatar_url']) {
      expect(forbidden in body).toBe(false);
    }
  });
});

describe('SOCIAL-2A · blobToBase64', () => {
  it('convierte un Blob a base64 puro (sin prefijo data:)', async () => {
    const blob = new Blob([new Uint8Array([65, 66, 67, 68])], { type: 'image/jpeg' }); // ABCD
    const b64 = await blobToBase64(blob);
    expect(b64).toBe('QUJDRA==');
    expect(b64).not.toContain('data:');
  });
});
