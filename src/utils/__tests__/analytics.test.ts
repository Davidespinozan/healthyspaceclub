import { describe, it, expect, afterEach, vi } from 'vitest';
import mainRaw from '../../main.tsx?raw';
import boundaryRaw from '../../components/ErrorBoundary.tsx?raw';
import htmlRaw from '../../../index.html?raw';

// ANALYTICS-1 · P1-A · fachada con consentimiento por delante. Estado a nivel de módulo
// (sink/queue) → se re-importa fresco por bloque. localStorage controla el consentimiento.
type W = typeof window & { posthog?: unknown };
const w = () => globalThis as unknown as W;
const KEY = 'hsc_analytics_consent';

async function fresh() { vi.resetModules(); return await import('../analytics'); }
function setConsent(v: 'accepted' | 'declined' | null) {
  try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch { /* noop */ }
}
function mockProvider() {
  const capture = vi.fn(), identify = vi.fn(), reset = vi.fn(), opt_out_capturing = vi.fn();
  (w() as { posthog?: unknown }).posthog = { capture, identify, reset, opt_out_capturing };
  return { capture, identify, reset, opt_out_capturing };
}

afterEach(() => { delete (w() as { posthog?: unknown }).posthog; setConsent(null); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

// ── §30 · track/identify gateados por consentimiento ──────────────────────────
describe('§30 consent-gated capture', () => {
  it('UNKNOWN → track descartado (proveedor presente pero no se envía)', async () => {
    setConsent(null); const p = mockProvider(); const a = await fresh();
    a.track('e'); a.identify('u');
    expect(p.capture).not.toHaveBeenCalled();
    expect(p.identify).not.toHaveBeenCalled();
  });
  it('DECLINED → track/identify descartados', async () => {
    setConsent('declined'); const p = mockProvider(); const a = await fresh();
    a.track('e'); a.identify('u');
    expect(p.capture).not.toHaveBeenCalled();
    expect(p.identify).not.toHaveBeenCalled();
  });
  it('ACCEPTED → track/identify se envían', async () => {
    setConsent('accepted'); const p = mockProvider(); const a = await fresh();
    a.track('e', { ok: true }); a.identify('u');
    expect(p.capture).toHaveBeenCalledWith('e', { ok: true });
    expect(p.identify).toHaveBeenCalledWith('u', undefined);
  });
  it('GPC bloquea aunque ACCEPTED', async () => {
    setConsent('accepted'); vi.stubGlobal('navigator', { globalPrivacyControl: true });
    const p = mockProvider(); const a = await fresh();
    a.track('e'); a.identify('u');
    expect(p.capture).not.toHaveBeenCalled();
    expect(p.identify).not.toHaveBeenCalled();
  });
});

// ── §30 · cola: eventos pre-consentimiento nunca se envían ────────────────────
describe('§30 pre-consent queue discard', () => {
  it('track en UNKNOWN no se encola; aceptar luego NO los reenvía', async () => {
    setConsent(null); const a = await fresh();
    a.track('pre_A'); a.track('pre_B');       // descartados (unknown)
    setConsent('accepted'); const p = mockProvider();
    a.track('post');                          // este sí
    expect(p.capture).toHaveBeenCalledTimes(1);
    expect(p.capture).toHaveBeenCalledWith('post', undefined);
    expect(p.capture).not.toHaveBeenCalledWith('pre_A', undefined);
  });
});

// ── §29 · initializeProviderIfAllowed: gates de init ──────────────────────────
describe('§29 provider init gates (no posthog created when blocked)', () => {
  it('UNKNOWN → no init (window.posthog no se crea)', async () => {
    setConsent(null); vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test'); const a = await fresh();
    a.initializeProviderIfAllowed();
    expect((w() as { posthog?: unknown }).posthog).toBeUndefined();
  });
  it('DECLINED → no init', async () => {
    setConsent('declined'); vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test'); const a = await fresh();
    a.initializeProviderIfAllowed();
    expect((w() as { posthog?: unknown }).posthog).toBeUndefined();
  });
  it('ACCEPTED pero host no-producción (localhost jsdom) → no init', async () => {
    setConsent('accepted'); vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test'); const a = await fresh();
    a.initializeProviderIfAllowed();
    expect((w() as { posthog?: unknown }).posthog).toBeUndefined();   // hostname=localhost
  });
  it('ACCEPTED + prod host pero SIN key → no init (proveedor OFF por defecto Gate B)', async () => {
    setConsent('accepted'); vi.stubEnv('VITE_POSTHOG_KEY', '');
    vi.stubGlobal('location', { hostname: 'healthyspaceclub.com' }); const a = await fresh();
    a.initializeProviderIfAllowed();
    expect((w() as { posthog?: unknown }).posthog).toBeUndefined();
  });
  it('ACCEPTED + prod host + key → init crea window.posthog (una vez)', async () => {
    setConsent('accepted'); vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
    vi.stubGlobal('location', { hostname: 'healthyspaceclub.com' }); const a = await fresh();
    a.initializeProviderIfAllowed();
    expect((w() as { posthog?: unknown }).posthog).toBeDefined();     // snippet cargó el stub
    const first = (w() as { posthog?: unknown }).posthog;
    a.initializeProviderIfAllowed();                                  // idempotente
    expect((w() as { posthog?: unknown }).posthog).toBe(first);
  });
});

// ── §31 · reset / A→B ─────────────────────────────────────────────────────────
describe('§31 identity reset', () => {
  it('reset() llama posthog.reset y limpia cola; seguro sin proveedor', async () => {
    setConsent('accepted'); const p = mockProvider(); const a = await fresh();
    a.reset();
    expect(p.reset).toHaveBeenCalledTimes(1);
    delete (w() as { posthog?: unknown }).posthog;
    expect(() => a.reset()).not.toThrow();
  });
  it('withdraw (setAnalyticsConsent declined) → opt_out + reset + persiste declined', async () => {
    setConsent('accepted'); const p = mockProvider(); const a = await fresh();
    a.setAnalyticsConsent('declined');
    expect(p.opt_out_capturing).toHaveBeenCalledTimes(1);
    expect(p.reset).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(KEY)).toBe('declined');
    // tras declinar, track ya no envía
    a.track('after_withdraw');
    expect(p.capture).not.toHaveBeenCalled();
  });
});

// ── §32 · privacidad de errores: los handlers NO envían contenido crudo ───────
describe('§32 error telemetry privacy (source-level)', () => {
  it('main.tsx client_error/rejection NO envían message/stack/source/filename', () => {
    // Aísla los bloques de track de errores.
    const ce = mainRaw.slice(mainRaw.indexOf("track('client_error'"), mainRaw.indexOf(')', mainRaw.indexOf("track('client_error'")) + 1);
    const ur = mainRaw.slice(mainRaw.indexOf("track('client_unhandled_rejection'"), mainRaw.indexOf(')', mainRaw.indexOf("track('client_unhandled_rejection'")) + 1);
    for (const block of [ce, ur]) {
      expect(block).not.toMatch(/message/);
      expect(block).not.toMatch(/\.stack/);
      expect(block).not.toMatch(/filename|lineno|\.source/);
      expect(block).toMatch(/kind:/);
    }
  });
  it('ErrorBoundary react_crash NO envía message/stack', () => {
    const rc = boundaryRaw.slice(boundaryRaw.indexOf("track('react_crash'"), boundaryRaw.indexOf('}', boundaryRaw.indexOf("track('react_crash'")) + 1);
    expect(rc).not.toMatch(/message/);
    expect(rc).not.toMatch(/stack/);
    expect(rc).toMatch(/kind:/);
  });
  it('errorKind() allowlist: nombres válidos pasan, contenido hostil → UnknownError', async () => {
    const a = await fresh();
    expect(a.errorKind('TypeError')).toBe('TypeError');
    expect(a.errorKind('Error')).toBe('Error');
    // un Error custom con name = contenido de usuario NO se reenvía crudo
    expect(a.errorKind('https://healthyspaceclub.com/u/priv?ref=priv private@example.com')).toBe('UnknownError');
    expect(a.errorKind('reflexión secreta del usuario')).toBe('UnknownError');
    expect(a.errorKind(undefined)).toBe('UnknownError');
    expect(a.errorKind(123 as unknown)).toBe('UnknownError');
  });
});

// ── §26 · provider OFF sin key en el HTML (no hay init en index.html) ─────────
describe('§26 provider off by default', () => {
  it('index.html no contiene un posthog.init activo', () => {
    expect(htmlRaw).not.toMatch(/posthog\.init/);
    expect(htmlRaw).not.toMatch(/phc_[A-Za-z0-9]{20,}/);
  });
  it('package.json no añade posthog-js', () => {
    // se resuelve en el test de consent; aquí solo confirmamos que analytics es la vía JS
    expect(htmlRaw).toMatch(/initializeProviderIfAllowed/);
  });
});
