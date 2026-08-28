// ANALYTICS-1 · P1-A · Estado de consentimiento de analytics (device/browser-scoped).
//
// PURO: sin proveedor, sin red, sin identidad de cuenta. Una sola llave localStorage.
// GPC/DNT del navegador se respetan SIEMPRE (bloquean captura aunque el estado guardado
// sea 'accepted'), sin guardar ni telemetrizar la señal.
//
// Invariante central: analyticsAllowed() === false ⇒ ni red ni identificador de analytics.

export type AnalyticsConsent = 'unknown' | 'accepted' | 'declined';

const KEY = 'hsc_analytics_consent';

/** Señal de privacidad del navegador (GPC o DNT). Si está activa, NO se captura nada. */
export function privacySignalBlocks(): boolean {
  try {
    if (typeof navigator === 'undefined') return false;
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean; doNotTrack?: string | null; msDoNotTrack?: string | null };
    if (nav.globalPrivacyControl === true) return true;
    const dnt = nav.doNotTrack ?? nav.msDoNotTrack ?? (typeof window !== 'undefined' ? (window as unknown as { doNotTrack?: string | null }).doNotTrack : null);
    if (dnt === '1' || dnt === 'yes') return true;
  } catch { /* noop */ }
  return false;
}

/** Estado GUARDADO (localStorage); valor ausente/inválido → 'unknown'. */
export function readAnalyticsConsent(): AnalyticsConsent {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'accepted' || v === 'declined') return v;
  } catch { /* noop */ }
  return 'unknown';
}

/** Persiste SOLO el estado (accepted/declined). No guarda id/email/timestamp/ip/razón. */
export function storeAnalyticsConsent(state: 'accepted' | 'declined'): void {
  try { localStorage.setItem(KEY, state); } catch { /* noop */ }
}

export function clearAnalyticsConsent(): void {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}

/**
 * Puerta efectiva de captura: SOLO true si no hay señal de privacidad del navegador
 * Y el usuario aceptó explícitamente. Es el gate único de track/identify/init.
 */
export function analyticsAllowed(): boolean {
  return !privacySignalBlocks() && readAnalyticsConsent() === 'accepted';
}

/**
 * ¿Mostrar el banner? Solo cuando el estado es realmente desconocido y no hay señal de
 * privacidad (GPC/DNT ya expresa la elección → no se pregunta, se trata como declined).
 */
export function shouldPromptConsent(): boolean {
  return !privacySignalBlocks() && readAnalyticsConsent() === 'unknown';
}
