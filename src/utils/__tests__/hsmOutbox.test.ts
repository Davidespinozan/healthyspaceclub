import { describe, it, expect, vi, beforeEach } from 'vitest';
import { outboxAdd, outboxRemove, enqueueReflection, dequeueReflection, readOutbox, flushHSMOutbox } from '../hsmOutbox';
import type { HSMReflection } from '../hsmRepository';

const mk = (over: Partial<HSMReflection> = {}): HSMReflection => ({ date: '2026-08-01', dimensionId: 'body', questionIndex: 1, questionKey: 'body#1', question: 'q', response: 'r', safetyLevel: 'NORMAL', ...over });

describe('MINDSET-1 · outbox helpers puros', () => {
  it('outboxAdd reemplaza por (date, questionKey) — una pendiente por pregunta/día', () => {
    const q = outboxAdd(outboxAdd([], mk({ response: 'A' })), mk({ response: 'B' }));
    expect(q).toHaveLength(1);
    expect(q[0].response).toBe('B');
  });
  it('outboxAdd conserva otras claves', () => {
    const q = outboxAdd(outboxAdd([], mk()), mk({ questionKey: 'body#2' }));
    expect(q).toHaveLength(2);
  });
  it('outboxRemove quita por clave', () => {
    expect(outboxRemove([mk(), mk({ questionKey: 'body#2' })], '2026-08-01', 'body#1')).toHaveLength(1);
  });
});

describe('MINDSET-1 · outbox local + flush', () => {
  beforeEach(() => { try { localStorage.removeItem('hsc-hsm-outbox'); } catch { /* noop */ } });

  it('enqueue persiste y dequeue quita', () => {
    enqueueReflection(mk());
    expect(readOutbox()).toHaveLength(1);
    dequeueReflection('2026-08-01', 'body#1');
    expect(readOutbox()).toHaveLength(0);
  });

  it('flush exitoso vacía el outbox', async () => {
    enqueueReflection(mk());
    enqueueReflection(mk({ questionKey: 'body#2' }));
    const upsert = vi.fn(async () => true);
    const res = await flushHSMOutbox(upsert);
    expect(res.flushed).toBe(2);
    expect(res.remaining).toBe(0);
    expect(readOutbox()).toHaveLength(0);
  });

  it('flush con fallo conserva los pendientes (offline-safe, sin pérdida)', async () => {
    enqueueReflection(mk());
    const upsert = vi.fn(async () => false);
    const res = await flushHSMOutbox(upsert);
    expect(res.flushed).toBe(0);
    expect(res.remaining).toBe(1);
    expect(readOutbox()).toHaveLength(1);
  });

  it('flush es idempotente: re-vaciar tras éxito no re-sube nada', async () => {
    enqueueReflection(mk());
    const upsert = vi.fn(async () => true);
    await flushHSMOutbox(upsert);
    const res2 = await flushHSMOutbox(upsert);
    expect(res2.flushed).toBe(0);
    expect(upsert).toHaveBeenCalledTimes(1); // sólo la 1ª vez había item
  });

  it('excepción del upsert conserva el item (no pierde el journal)', async () => {
    enqueueReflection(mk());
    const upsert = vi.fn(async () => { throw new Error('net'); });
    const res = await flushHSMOutbox(upsert);
    expect(res.remaining).toBe(1);
  });
});
