import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  signInWithProvider,
  normalizeProviderAuthError,
  safeOriginCallback,
  signedInScreen,
  isProviderEnabled,
  ENABLED_PROVIDERS,
  type AuthProvider,
} from '../authProviders';

// ════════════════════════════════════════════════════════════════
// AUTH-PROVIDERS · Gate B — helper de OAuth. Pruebas deterministas, sin llamadas
// reales a Google/Apple. El helper SOLO autentica: no toca user_profiles/Stripe/
// metadata; redirect siempre same-origin; errores → enum seguro.
// ════════════════════════════════════════════════════════════════

// Doble del cliente: registra la llamada a auth.signInWithOAuth y NADA más (prueba
// que el helper no toca .from()/Stripe). `from` lanza si se llegara a usar.
/* eslint-disable @typescript-eslint/no-explicit-any */
function makeClient(opts: { error?: unknown; throw?: boolean } = {}) {
  const calls: { oauth: any[]; fromCalled: boolean } = { oauth: [], fromCalled: false };
  const client = {
    auth: {
      signInWithOAuth: (args: any) => {
        calls.oauth.push(args);
        if (opts.throw) return Promise.reject(new Error('network down'));
        return Promise.resolve({ data: {}, error: opts.error ?? null });
      },
    },
    from: () => { calls.fromCalled = true; throw new Error('helper must not touch the DB'); },
  };
  return { client: client as any, calls };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const ORIGIN = 'https://healthyspaceclub.com';
beforeEach(() => {
  vi.stubGlobal('window', { location: { origin: ORIGIN } });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('A/B · signInWithProvider llama a signInWithOAuth con el provider correcto', () => {
  it('A · google', async () => {
    const { client, calls } = makeClient();
    const r = await signInWithProvider('google', client);
    expect(r.ok).toBe(true);
    expect(calls.oauth[0].provider).toBe('google');
  });
  it('B · apple', async () => {
    const { client, calls } = makeClient();
    await signInWithProvider('apple', client);
    expect(calls.oauth[0].provider).toBe('apple');
  });
});

describe('C · redirectTo es SAME-ORIGIN y no es override-able externamente', () => {
  it('redirectTo = origin actual + "/"', async () => {
    const { client, calls } = makeClient();
    await signInWithProvider('google', client);
    expect(calls.oauth[0].options.redirectTo).toBe(`${ORIGIN}/`);
  });
  it('safeOriginCallback deriva del origin, nunca de un input', () => {
    expect(safeOriginCallback()).toBe(`${ORIGIN}/`);
  });
  it('la firma no acepta ningún parámetro de redirect (solo provider + client)', () => {
    // signInWithProvider(provider, client?) — no hay canal para un redirect arbitrario.
    expect(signInWithProvider.length).toBeLessThanOrEqual(2);
  });
});

describe('D/E · el helper NO escribe user_profiles ni llama a Stripe', () => {
  it('solo invoca auth.signInWithOAuth; jamás client.from()', async () => {
    const { client, calls } = makeClient();
    await signInWithProvider('google', client);
    expect(calls.fromCalled).toBe(false);
    expect(calls.oauth.length).toBe(1);
  });
});

describe('F/G · errores → enum seguro; nunca se devuelve el texto crudo', () => {
  it('cancelado', () => expect(normalizeProviderAuthError({ message: 'User cancelled the flow' })).toBe('cancelled'));
  it('access_denied', () => expect(normalizeProviderAuthError({ message: 'access_denied' })).toBe('cancelled'));
  it('red', () => expect(normalizeProviderAuthError({ message: 'network request failed' })).toBe('network'));
  it('provider deshabilitado', () => expect(normalizeProviderAuthError({ message: 'Provider is not enabled' })).toBe('provider_unavailable'));
  it('oauth/redirect/state', () => expect(normalizeProviderAuthError({ message: 'invalid oauth state' })).toBe('oauth_failed'));
  it('desconocido', () => expect(normalizeProviderAuthError({ message: 'weird' })).toBe('unknown'));
  it('vacío/nulo', () => { expect(normalizeProviderAuthError(null)).toBe('unknown'); expect(normalizeProviderAuthError('')).toBe('unknown'); });
  it('un error inmediato devuelve {ok:false, reason:enum} — sin message crudo', async () => {
    const { client } = makeClient({ error: { message: 'Provider apple is not enabled in this project' } });
    const r = await signInWithProvider('apple', client);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('provider_unavailable');
    expect(JSON.stringify(r)).not.toContain('not enabled'); // nada de texto crudo
  });
  it('una excepción de red → {ok:false, reason:network}', async () => {
    const { client } = makeClient({ throw: true });
    const r = await signInWithProvider('google', client);
    expect(r).toEqual({ ok: false, reason: 'network' });
  });
});

describe('H/I/J/K · ruteo post-SIGNED_IN por startDate, independiente del proveedor', () => {
  it('H · sin startDate (nuevo usuario OAuth) → onboarding', () => {
    expect(signedInScreen('')).toBe('onboarding');
    expect(signedInScreen(null)).toBe('onboarding');
    expect(signedInScreen(undefined)).toBe('onboarding');
  });
  it('I/J · con startDate (usuario ya onboardeado) → dashboard (el gate de suscripción decide paywall downstream)', () => {
    expect(signedInScreen('2026-08-01')).toBe('dashboard');
  });
  it('K · la decisión no recibe ni depende del proveedor', () => {
    // signedInScreen no tiene parámetro de provider → mismo resultado para google/apple.
    const providers: AuthProvider[] = ['google', 'apple'];
    for (const _p of providers) expect(signedInScreen('2026-08-01')).toBe('dashboard');
  });
});

describe('L · callback reload idempotente a nivel de helper', () => {
  it('llamar dos veces no acumula efectos fuera de auth (sin writes)', async () => {
    const { client, calls } = makeClient();
    await signInWithProvider('google', client);
    await signInWithProvider('google', client);
    expect(calls.fromCalled).toBe(false); // nunca escribe; el reload lo maneja detectSessionInUrl/getSession
  });
});

describe('P/Q · payload de analytics y relay de Apple', () => {
  it('P · el reason es un enum acotado (sin PII/token/email)', () => {
    const reasons = ['cancelled', 'provider_unavailable', 'network', 'oauth_failed', 'unknown'];
    for (const raw of ['access_denied', 'network fail', 'provider not enabled', 'oauth state', 'zzz', '']) {
      expect(reasons).toContain(normalizeProviderAuthError({ message: raw }));
    }
  });
  it('Q · un email relay de Apple no cambia nada del helper (email no es parámetro)', async () => {
    // El helper nunca recibe ni inspecciona el email; la identidad es auth.uid().
    const { client, calls } = makeClient();
    await signInWithProvider('apple', client);
    expect(calls.oauth[0]).not.toHaveProperty('email');
    expect(JSON.stringify(calls.oauth[0])).not.toContain('@');
  });
});

// ════════════════════════════════════════════════════════════════
// GOOGLE LIVE SMOKE — gate de disponibilidad por-proveedor. Refleja el estado real
// de Supabase: Google LIVE, Apple DORMIDO (external.apple=false). Determinista.
// ════════════════════════════════════════════════════════════════
describe('ENABLED_PROVIDERS · gate Google-only (Apple dormido)', () => {
  it('Google está expuesto', () => {
    expect(isProviderEnabled('google')).toBe(true);
    expect(ENABLED_PROVIDERS).toContain('google');
  });
  it('Apple NO está expuesto mientras external.apple=false', () => {
    expect(isProviderEnabled('apple')).toBe(false);
    expect(ENABLED_PROVIDERS).not.toContain('apple');
  });
  it('la lista no trae proveedores sorpresa', () => {
    for (const p of ENABLED_PROVIDERS) expect(['google', 'apple']).toContain(p);
  });
});
