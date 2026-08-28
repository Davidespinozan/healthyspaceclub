import { describe, it, expect, afterEach, vi } from 'vitest';
import html from '../../../index.html?raw';
import pkgRaw from '../../../package.json?raw';

// ANALYTICS-1 · P0 · reset() de identidad + cola, y bootstrap de PostHog endurecido/OFF.
// El módulo tiene estado a nivel de módulo (sink/queue) → se re-importa fresco por bloque.

type W = typeof window & { posthog?: unknown; analytics?: unknown };
const w = () => globalThis as unknown as W;

async function freshAnalytics() {
  vi.resetModules();
  return await import('../analytics');
}

afterEach(() => {
  delete (w() as { posthog?: unknown }).posthog;
  delete (w() as { analytics?: unknown }).analytics;
});

// ── §13 · reset primitive ─────────────────────────────────────────────────────
describe('§13 reset()', () => {
  it('A · sin proveedor → no lanza', async () => {
    const a = await freshAnalytics();
    expect(() => a.reset()).not.toThrow();
  });

  it('B · PostHog presente → posthog.reset() llamado exactamente una vez', async () => {
    const reset = vi.fn();
    (w() as { posthog?: unknown }).posthog = { capture: vi.fn(), identify: vi.fn(), reset };
    const a = await freshAnalytics();
    a.reset();
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('C · Segment-compatible → analytics.reset() soportado', async () => {
    const reset = vi.fn();
    (w() as { analytics?: unknown }).analytics = { track: vi.fn(), identify: vi.fn(), reset };
    const a = await freshAnalytics();
    a.reset();
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('D · cola pendiente NO se vacía a un sink que aparece DESPUÉS del reset', async () => {
    const a = await freshAnalytics();
    a.track('pre_logout_event_A');           // encolado (sin proveedor)
    a.reset();                               // descarta la cola de A
    const capture = vi.fn();
    (w() as { posthog?: unknown }).posthog = { capture, identify: vi.fn(), reset: vi.fn() };
    a.initAnalytics();                       // aparece el proveedor y vacía la cola
    expect(capture).not.toHaveBeenCalledWith('pre_logout_event_A', undefined);
    expect(capture).not.toHaveBeenCalled();  // la cola quedó vacía tras reset
  });

  it('E · track normal sigue funcionando tras reset', async () => {
    const capture = vi.fn();
    (w() as { posthog?: unknown }).posthog = { capture, identify: vi.fn(), reset: vi.fn() };
    const a = await freshAnalytics();
    a.initAnalytics();
    a.reset();
    a.track('after_reset', { ok: true });
    expect(capture).toHaveBeenCalledWith('after_reset', { ok: true });
  });

  it('F · cap de 100 eventos intacto', async () => {
    const a = await freshAnalytics();
    for (let i = 0; i < 150; i++) a.track(`e${i}`);   // sin sink → encola, cap 100
    const capture = vi.fn();
    (w() as { posthog?: unknown }).posthog = { capture, identify: vi.fn(), reset: vi.fn() };
    a.initAnalytics();
    expect(capture.mock.calls.length).toBe(100);
  });
});

// ── §14 · transiciones de cuenta (simulación de la lógica del handler) ─────────
// Reproduce la decisión de App.tsx SIN montar todo App: reset() SOLO si hay un dueño
// previo DISTINTO, antes de identify(B). anon→A y mismo-user no resetean.
describe('§14 account transitions', () => {
  function makeHandler(a: Awaited<ReturnType<typeof freshAnalytics>>) {
    let dataOwnerId: string | null = null;
    return {
      get owner() { return dataOwnerId; },
      signedIn(userId: string) {
        if (dataOwnerId && dataOwnerId !== userId) a.reset();   // A→B ANTES de identify(B)
        a.identify(userId);
        dataOwnerId = userId;                                    // ensureDataOwner reclama
      },
      tokenRefreshed(_userId: string) { /* el handler real NO identifica ni resetea */ },
      signedOut() { a.reset(); dataOwnerId = null; },
    };
  }

  it('1 · anon→A: identify(A), sin reset (enlaza actividad anónima)', async () => {
    const reset = vi.fn(); const identify = vi.fn();
    (w() as { posthog?: unknown }).posthog = { capture: vi.fn(), identify, reset };
    const a = await freshAnalytics(); a.initAnalytics();
    const h = makeHandler(a); h.signedIn('A');
    expect(identify).toHaveBeenCalledWith('A', undefined);
    expect(reset).not.toHaveBeenCalled();
  });

  it('2 · TOKEN_REFRESHED del mismo user → sin reset', async () => {
    const reset = vi.fn();
    (w() as { posthog?: unknown }).posthog = { capture: vi.fn(), identify: vi.fn(), reset };
    const a = await freshAnalytics(); a.initAnalytics();
    const h = makeHandler(a); h.signedIn('A'); h.tokenRefreshed('A');
    expect(reset).not.toHaveBeenCalled();
  });

  it('3 · SIGNED_OUT → reset', async () => {
    const reset = vi.fn();
    (w() as { posthog?: unknown }).posthog = { capture: vi.fn(), identify: vi.fn(), reset };
    const a = await freshAnalytics(); a.initAnalytics();
    const h = makeHandler(a); h.signedIn('A'); h.signedOut();
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('4 · A→B: reset ocurre ANTES de identify(B)', async () => {
    const calls: string[] = [];
    const reset = vi.fn(() => calls.push('reset'));
    const identify = vi.fn((id: string) => calls.push(`identify:${id}`));
    (w() as { posthog?: unknown }).posthog = { capture: vi.fn(), identify, reset };
    const a = await freshAnalytics(); a.initAnalytics();
    const h = makeHandler(a); h.signedIn('A'); h.signedIn('B');
    expect(calls).toEqual(['identify:A', 'reset', 'identify:B']);
  });

  it('5 · eventos de A encolados nunca se atribuyen a B', async () => {
    // Sin sink al inicio → A encola; logout limpia; luego aparece proveedor y B identifica.
    const a = await freshAnalytics();
    const h = makeHandler(a);
    h.signedIn('A');                 // sink null → identify(A) encolado
    a.track('A_did_something');      // encolado bajo contexto de A
    h.signedOut();                   // reset() vacía la cola
    const capture = vi.fn(); const identify = vi.fn();
    (w() as { posthog?: unknown }).posthog = { capture, identify, reset: vi.fn() };
    a.initAnalytics();               // aparece proveedor
    h.signedIn('B');                 // identify(B)
    expect(capture).not.toHaveBeenCalledWith('A_did_something', undefined);
    expect(identify).toHaveBeenCalledWith('B', undefined);
  });

  it('6 · logout sin proveedor → no crash', async () => {
    const a = await freshAnalytics();
    const h = makeHandler(a); h.signedIn('A');
    expect(() => h.signedOut()).not.toThrow();
  });

  it('7 · A→SIGNED_OUT→B: reset en logout, sin doble reset al identificar a B', async () => {
    const calls: string[] = [];
    const reset = vi.fn(() => calls.push('reset'));
    const identify = vi.fn((id: string) => calls.push(`identify:${id}`));
    (w() as { posthog?: unknown }).posthog = { capture: vi.fn(), identify, reset };
    const a = await freshAnalytics(); a.initAnalytics();
    const h = makeHandler(a);
    h.signedIn('A'); h.signedOut(); h.signedIn('B');
    // logout ya reseteó → B entra con dueño null → NO se resetea otra vez (anon→B).
    expect(calls).toEqual(['identify:A', 'reset', 'identify:B']);
    expect(reset).toHaveBeenCalledTimes(1);
  });
});

// ── §15/§16 · provider OFF + config endurecida (index.html) ────────────────────
describe('§15/§16 bootstrap endurecido y desactivado', () => {
  it('§15 · sin dependencia de SDK de analytics en package.json', () => {
    expect(pkgRaw).not.toMatch(/"posthog-js"|"@segment|"analytics-node"|"mixpanel/);
  });
  it('§15 · el bloque PostHog sigue COMENTADO (desactivado)', () => {
    const start = html.indexOf('OBSERVABILIDAD (PostHog)');
    const openComment = html.lastIndexOf('<!--', start);
    const closeComment = html.indexOf('-->', start);
    expect(openComment).toBeGreaterThanOrEqual(0);
    expect(closeComment).toBeGreaterThan(start);       // el init vive dentro del comentario
    expect(html.indexOf('posthog.init', start)).toBeLessThan(closeComment);
  });
  it('§15 · placeholder de key, sin key real', () => {
    expect(html).toContain('TU_POSTHOG_KEY');
    expect(html).not.toMatch(/phc_[A-Za-z0-9]{20,}/);  // formato de key real de PostHog
  });
  it('§16 · config segura: autocapture/pageview/replay OFF, identified_only', () => {
    expect(html).toMatch(/autocapture:\s*false/);
    expect(html).toMatch(/capture_pageview:\s*false/);
    expect(html).toMatch(/disable_session_recording:\s*true/);
    expect(html).toMatch(/capture_heatmaps:\s*false/);
    expect(html).toMatch(/person_profiles:\s*'identified_only'/);
    expect(html).toMatch(/api_host:\s*'https:\/\/eu\.i\.posthog\.com'/);
  });
  it('§16 · gate de host de producción (no localhost/previews)', () => {
    expect(html).toContain("location.hostname");
    expect(html).toMatch(/'healthyspaceclub\.com'/);
    expect(html).toMatch(/'www\.healthyspaceclub\.com'/);
  });
});
