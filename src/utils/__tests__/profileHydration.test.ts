import { describe, it, expect } from 'vitest';
import {
  runProfileHydration,
  resolveProfileOutcome,
  fetchWithTimeout,
  shouldShowAccountLoader,
  type HydrationDeps,
} from '../profileHydration';

// ════════════════════════════════════════════════════════════════
// MVP-RESILIENCE-1 · hidratación resiliente de perfil (pura/inyectable). Un usuario
// que vuelve NUNCA cae a onboarding por un fallo transitorio; usuario nuevo real sí.
// ════════════════════════════════════════════════════════════════

/* eslint-disable @typescript-eslint/no-explicit-any */
function makeDeps(over: Partial<HydrationDeps> & { results?: any[] } = {}) {
  const calls = { fetch: 0, resolvedRow: null as any, resolvedEmpty: 0 };
  let i = 0;
  const results = over.results ?? [];
  const deps: HydrationDeps = {
    fetchProfile: async () => { calls.fetch++; return results[i++] ?? { data: null, error: { message: 'x' } }; },
    sleep: async () => { /* fake: no espera real */ },
    isCurrent: () => true,
    onResolvedRow: (d) => { calls.resolvedRow = d; },
    onResolvedEmpty: () => { calls.resolvedEmpty++; },
    retryDelays: [0, 0, 0, 0],
    ...over,
  };
  return { deps, calls };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

describe('resolveProfileOutcome', () => {
  it('A · fila → resolved-row', () => expect(resolveProfileOutcome({ data: { start_date: '2026-01-01' }, error: null })).toBe('resolved-row'));
  it('B · sin fila y sin error → resolved-empty (usuario NUEVO real)', () => expect(resolveProfileOutcome({ data: null, error: null })).toBe('resolved-empty'));
  it('C · error → retry', () => expect(resolveProfileOutcome({ data: null, error: { message: 'rls' } })).toBe('retry'));
  it('D · timeout → retry', () => expect(resolveProfileOutcome({ data: null, error: null, timedOut: true })).toBe('retry'));
});

describe('runProfileHydration', () => {
  it('A · fila al primer intento → resolved + hidrata', async () => {
    const { deps, calls } = makeDeps({ results: [{ data: { start_date: '2026-01-01', tdee: 2000 }, error: null }] });
    expect(await runProfileHydration(deps)).toBe('resolved');
    expect(calls.resolvedRow).toEqual({ start_date: '2026-01-01', tdee: 2000 });
    expect(calls.fetch).toBe(1);
  });
  it('B · usuario nuevo (no-row, no-error) → resolved (onboarding legítimo), NO error', async () => {
    const { deps, calls } = makeDeps({ results: [{ data: null, error: null }] });
    expect(await runProfileHydration(deps)).toBe('resolved');
    expect(calls.resolvedEmpty).toBe(1);
    expect(calls.resolvedRow).toBe(null);
  });
  it('E · fallan 2 intentos y al 3º llega la fila → resolved', async () => {
    const { deps, calls } = makeDeps({ results: [
      { data: null, error: { message: 'net' } },
      { data: null, error: null, timedOut: true },
      { data: { start_date: '2026-02-02' }, error: null },
    ] });
    expect(await runProfileHydration(deps)).toBe('resolved');
    expect(calls.fetch).toBe(3);
  });
  it('F · todos los intentos rápidos fallan → error (muestra retry UX, NO onboarding)', async () => {
    const { deps, calls } = makeDeps({ results: [
      { data: null, error: { message: 'e' } }, { data: null, error: { message: 'e' } },
      { data: null, error: { message: 'e' } }, { data: null, error: { message: 'e' } },
    ] });
    expect(await runProfileHydration(deps)).toBe('error');
    expect(calls.resolvedEmpty).toBe(0); // JAMÁS trata el fallo como usuario nuevo
    expect(calls.fetch).toBe(4);
  });
  it('H/I · si deja de ser el usuario actual (cambio de cuenta) → aborta, NO aplica', async () => {
    let current = true;
    const { deps, calls } = makeDeps({
      results: [{ data: { start_date: '2026-01-01' }, error: null }],
      isCurrent: () => current,
      // apaga isCurrent tras el primer sleep (antes de aplicar)
      sleep: async () => { current = false; },
      retryDelays: [10, 10],
    });
    expect(await runProfileHydration(deps)).toBe('idle');
    expect(calls.resolvedRow).toBe(null); // datos de A nunca pisan a B
  });
  it('J · no hot-loop: acotado a la longitud de retryDelays', async () => {
    const { deps, calls } = makeDeps({ results: [], retryDelays: [0, 0, 0] });
    await runProfileHydration(deps);
    expect(calls.fetch).toBe(3); // exactamente 3 intentos, no infinito
  });
});

describe('fetchWithTimeout', () => {
  it('D · un fetch estancado resuelve como timedOut (no cuelga)', async () => {
    const res = await fetchWithTimeout(() => new Promise(() => { /* nunca resuelve */ }), 5, async () => {});
    expect(res.timedOut).toBe(true);
    expect(res.data).toBe(null);
  });
  it('pasa data/error de un fetch que resuelve', async () => {
    const res = await fetchWithTimeout(async () => ({ data: { x: 1 }, error: null }), 100);
    expect(res).toEqual({ data: { x: 1 }, error: null });
  });
});

describe('K/L/M/N · shouldShowAccountLoader (render-gate)', () => {
  const base = { authenticated: true, currentScreen: 'onboarding' };
  it('idle/loading/error en onboarding → muestra loader (NO onboarding)', () => {
    expect(shouldShowAccountLoader({ ...base, profileResolution: 'idle' })).toBe(true);
    expect(shouldShowAccountLoader({ ...base, profileResolution: 'loading' })).toBe(true);
    expect(shouldShowAccountLoader({ ...base, profileResolution: 'error' })).toBe(true);
  });
  it('resolved en onboarding → NO loader (usuario nuevo real ve onboarding)', () => {
    expect(shouldShowAccountLoader({ ...base, profileResolution: 'resolved' })).toBe(false);
  });
  it('no autenticado → nunca loader', () => {
    expect(shouldShowAccountLoader({ authenticated: false, currentScreen: 'onboarding', profileResolution: 'loading' })).toBe(false);
  });
  it('otra pantalla (no onboarding) → nunca loader', () => {
    expect(shouldShowAccountLoader({ authenticated: true, currentScreen: 'dashboard', profileResolution: 'loading' })).toBe(false);
    expect(shouldShowAccountLoader({ authenticated: true, currentScreen: 'login', profileResolution: 'error' })).toBe(false);
  });
});
