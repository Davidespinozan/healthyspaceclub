import { describe, it, expect } from 'vitest';
import {
  purgeDeletedAccountLocalState,
  interpretDeleteResult,
  mapDeleteCode,
  DELETE_PURGE_KEYS,
  DELETE_PRESERVE_KEYS,
} from '../deleteAccount';

// ════════════════════════════════════════════════════════════════
// ACCOUNT-DELETE-1 · Gate B — capa cliente. Purga local + interpretación de códigos.
// ════════════════════════════════════════════════════════════════

function makeStorage(seed: Record<string, string>) {
  const map = new Map(Object.entries(seed));
  return {
    map,
    removeItem: (k: string) => { map.delete(k); },
  };
}

describe('purga local por-usuario (más agresiva que logout)', () => {
  const seed = {
    'hsc-store': 'x', 'hsc-life-system-v2': 'x', 'hsc-hsm-outbox': 'x',
    'workout-player-progress': 'x', 'yoga-flow-progress': 'x', 'day-complete-celebrated': 'x',
    'hsc_session_min': 'x', 'hsc_priority_muscles': 'x', 'hsc_ref_nudge_done': 'x', 'hsc_ref': 'x',
    // preservadas (globales):
    'hsc_region': 'MX', 'hsc_country': 'MX', 'hsc-video-availability-v1': 'x',
  };

  it('P/Q/R/S/T · remueve hsc-store, HSM outbox, ephemeral training, ref keys', () => {
    const s = makeStorage(seed);
    purgeDeletedAccountLocalState(s);
    for (const k of DELETE_PURGE_KEYS) expect(s.map.has(k)).toBe(false);
  });
  it('X · pendingWorkoutSync se va porque el blob hsc-store se remueve entero', () => {
    const s = makeStorage(seed);
    expect(DELETE_PURGE_KEYS).toContain('hsc-store'); // pendingWorkoutSync vive dentro del blob
    purgeDeletedAccountLocalState(s);
    expect(s.map.has('hsc-store')).toBe(false);
  });
  it('U/V/W · preserva llaves globales (region, country, video cache)', () => {
    const s = makeStorage(seed);
    purgeDeletedAccountLocalState(s);
    for (const k of DELETE_PRESERVE_KEYS) expect(s.map.has(k)).toBe(true);
  });
  it('no cruza: ninguna llave preservada está en la lista de purga', () => {
    for (const k of DELETE_PRESERVE_KEYS) expect(DELETE_PURGE_KEYS as readonly string[]).not.toContain(k);
  });
  it('idempotente ante llave ausente (no lanza)', () => {
    const s = makeStorage({});
    expect(() => purgeDeletedAccountLocalState(s)).not.toThrow();
  });
});

describe('AA/AB · mapeo de códigos del servidor → reason seguro (sin exponer detalles)', () => {
  it('ok', () => expect(interpretDeleteResult({ ok: true }, null)).toEqual({ ok: true }));
  it('REQUIRES_SUPPORT → support', () => expect(mapDeleteCode('ACCOUNT_DELETE_REQUIRES_SUPPORT')).toEqual({ ok: false, reason: 'support' }));
  it('BILLING_CLEANUP_FAILED → billing', () => expect(mapDeleteCode('BILLING_CLEANUP_FAILED')).toEqual({ ok: false, reason: 'billing' }));
  it('ACCOUNT_DELETE_FAILED → unknown', () => expect(mapDeleteCode('ACCOUNT_DELETE_FAILED')).toEqual({ ok: false, reason: 'unknown' }));
  it('code desconocido → unknown', () => expect(mapDeleteCode('WEIRD')).toEqual({ ok: false, reason: 'unknown' }));
  it('body con code (non-2xx) → mapeado', () => {
    expect(interpretDeleteResult({ ok: false, code: 'BILLING_CLEANUP_FAILED' }, { message: 'x' })).toEqual({ ok: false, reason: 'billing' });
  });
  it('solo error de transporte (sin body) → network', () => {
    expect(interpretDeleteResult(null, { message: 'fetch failed' })).toEqual({ ok: false, reason: 'network' });
  });
  it('nada → unknown', () => expect(interpretDeleteResult(null, null)).toEqual({ ok: false, reason: 'unknown' }));
  it('el reason nunca es texto crudo — solo enums acotados', () => {
    const reasons = ['network', 'billing', 'support', 'unknown'];
    for (const c of ['ACCOUNT_DELETE_REQUIRES_SUPPORT', 'BILLING_CLEANUP_FAILED', 'ACCOUNT_DELETE_FAILED', 'ZZZ']) {
      const r = mapDeleteCode(c);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(reasons).toContain(r.reason);
    }
  });
});
