// AUTH-PROVIDERS · Gate B — helper de OAuth (Google/Apple) en el límite de auth.
// El proveedor SOLO autentica: no crea user_profiles, no toca username, startDate,
// trial ni Stripe, no copia metadata del proveedor. La identidad sigue siendo
// auth.uid(); el ruteo posterior (onboarding/paywall/dashboard) lo decide App por
// startDate + subscriptionStatus, igual que con email/password.

import { supabase } from '../lib/supabase';

export type AuthProvider = 'google' | 'apple';

/** Proveedores expuestos en la UI — fuente de verdad única, por-proveedor e
 *  independiente. Debe reflejar el estado real de Supabase (external.<provider>):
 *  hoy Google está LIVE y Apple sigue OFF (external.apple=false), así que Apple
 *  permanece implementado pero DORMIDO — su botón no se renderiza. Cuando Apple
 *  quede habilitado en Supabase + smoke probado, se añade 'apple' aquí (un solo
 *  cambio, sin tocar el resto). No inferimos disponibilidad en runtime: el build
 *  es estático y esta lista es la representación limpia de qué está activo. */
export const ENABLED_PROVIDERS: readonly AuthProvider[] = ['google'];

/** ¿El proveedor está expuesto en la UI ahora mismo? */
export function isProviderEnabled(provider: AuthProvider): boolean {
  return ENABLED_PROVIDERS.includes(provider);
}

/** Motivo normalizado del fallo — enum estable para UI/analytics (sin PII ni texto crudo). */
export type ProviderAuthReason = 'cancelled' | 'provider_unavailable' | 'network' | 'oauth_failed' | 'unknown';

/** Redirect SIEMPRE derivado del origin actual — nunca de input del usuario/query param.
 *  Evita open-redirect: el callback vuelve a la misma app (misma-origin), donde
 *  detectSessionInUrl intercambia el code por sesión. */
export function safeOriginCallback(): string {
  if (typeof window === 'undefined' || !window.location?.origin) return '/';
  return `${window.location.origin}/`;
}

/** Mapea un error de Supabase/proveedor → motivo enum seguro (nunca expone el crudo). */
export function normalizeProviderAuthError(err: unknown): ProviderAuthReason {
  const msg = (typeof err === 'string' ? err : (err as { message?: string } | null)?.message ?? '').toLowerCase();
  if (!msg) return 'unknown';
  if (msg.includes('cancel') || msg.includes('closed') || msg.includes('denied') || msg.includes('access_denied')) return 'cancelled';
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout') || msg.includes('offline')) return 'network';
  if (msg.includes('provider') && (msg.includes('not enabled') || msg.includes('disabled') || msg.includes('unavailable'))) return 'provider_unavailable';
  if (msg.includes('oauth') || msg.includes('redirect') || msg.includes('state') || msg.includes('code')) return 'oauth_failed';
  return 'unknown';
}

/** Pantalla tras un SIGNED_IN (login/OAuth), decidida SOLO por la autoridad de
 *  onboarding (startDate) — independiente del proveedor. El split paywall-vs-dashboard
 *  lo aplica el gate de suscripción downstream (sin cambios). Nuevo usuario OAuth
 *  (sin startDate) → onboarding; usuario ya onboardeado → dashboard (luego el gate de
 *  suscripción puede mandarlo a paywall). */
export function signedInScreen(startDate: string | null | undefined): 'dashboard' | 'onboarding' {
  return startDate ? 'dashboard' : 'onboarding';
}

export interface StartProviderResult {
  ok: boolean;
  reason?: ProviderAuthReason;
}

/** Inicia OAuth por redirect (no popup). En éxito el navegador se va al proveedor y
 *  vuelve a safeOriginCallback(); el listener de auth de App toma la sesión. Solo un
 *  fallo INMEDIATO (proveedor deshabilitado, red) vuelve aquí con ok=false. */
export async function signInWithProvider(
  provider: AuthProvider,
  client: Pick<typeof supabase, 'auth'> = supabase,
): Promise<StartProviderResult> {
  try {
    const { error } = await client.auth.signInWithOAuth({
      provider,
      options: { redirectTo: safeOriginCallback() },
    });
    if (error) return { ok: false, reason: normalizeProviderAuthError(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: normalizeProviderAuthError(e) };
  }
}
