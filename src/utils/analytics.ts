// Analítica de producto, con CONSENTIMIENTO por delante (ANALYTICS-1 P1-A).
//
// Reglas duras:
//   - track()/identify() NO hacen nada salvo consentimiento ACCEPTED (y sin GPC/DNT).
//   - Eventos generados en UNKNOWN/DECLINED se DESCARTAN (nunca se encolan ni se envían
//     retroactivamente al aceptar). La cola solo existe para el hueco "accepted pero el
//     script del proveedor aún no cargó".
//   - PostHog SOLO se inicializa cuando: consent ACCEPTED + host de PRODUCCIÓN + hay
//     VITE_POSTHOG_KEY. Sin key → proveedor DESACTIVADO (estado por defecto de Gate B).
//   - Config endurecida: EU host, autocapture/pageview/heatmaps OFF, replay OFF,
//     person_profiles 'identified_only', respect_dnt. Sin captura de DOM/URL/inputs.
//   - reset() suelta identidad del proveedor + limpia la cola (frontera de cuenta).
//
// El resto de la app usa SOLO esta fachada (track/identify/reset/…); nunca window.posthog.
import { analyticsAllowed, storeAnalyticsConsent, type AnalyticsConsent } from './analyticsConsent';

type Props = Record<string, string | number | boolean | null | undefined>;

interface Sink {
  track: (event: string, props?: Props) => void;
  identify: (id: string, traits?: Props) => void;
  reset: () => void;
}

let sink: Sink | null = null;
let providerLoading = false;
const queue: Array<{ kind: 'track' | 'identify'; a: string; b?: Props }> = [];
const MAX_QUEUE = 100;

const PROD_HOSTS = ['healthyspaceclub.com', 'www.healthyspaceclub.com'];
const EU_HOST = 'https://eu.i.posthog.com';

function isProdHost(): boolean {
  try { return typeof location !== 'undefined' && PROD_HOSTS.includes(location.hostname); } catch { return false; }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function resolveSink(): Sink | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  if (w.posthog?.capture) {
    return {
      track: (e, p) => { try { w.posthog.capture(e, p); } catch { /* noop */ } },
      identify: (id, t) => { try { w.posthog.identify(id, t); } catch { /* noop */ } },
      reset: () => { try { w.posthog.reset?.(); } catch { /* noop */ } },
    };
  }
  return null;
}

/**
 * Carga el snippet oficial de PostHog on-demand e inicializa con la config endurecida.
 * Idempotente. Solo lo llama initializeProviderIfAllowed() tras validar consent+host+key.
 */
function loadPostHog(key: string): void {
  const w = window as any;
  if (w.posthog?.__loaded || providerLoading) return;
  providerLoading = true;
  // Snippet oficial (array-stub + carga de array.js) — condensado.
  (function (t, e) {
    let o: any, n: any, p: any, r: any; if (!e.__SV) {
      w.posthog = e; e._i = []; e.init = function (i: any, s: any, a: any) {
        function g(t: any, e: any) { const o = e.split('.'); o.length === 2 && (t = t[o[0]], e = o[1]); t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); }; }
        p = t.createElement('script'); p.type = 'text/javascript'; p.async = true; p.src = s.api_host + '/static/array.js';
        r = t.getElementsByTagName('script')[0]; r.parentNode.insertBefore(p, r);
        let u = e; a !== undefined ? u = e[a] = [] : a = 'posthog'; u.people = u.people || [];
        u.toString = function (t: any) { let e = 'posthog'; return a !== 'posthog' && (e += '.' + a), t || (e += ' (stub)'), e; };
        u.people.toString = function () { return u.toString(1) + '.people (stub)'; };
        o = 'capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys onSessionId'.split(' ');
        for (n = 0; n < o.length; n++) g(u, o[n]); e._i.push([i, s, a]);
      }; e.__SV = 1;
    }
  })(document, w.posthog || []);
  w.posthog.init(key, {
    api_host: EU_HOST,
    autocapture: false,
    capture_pageview: false,
    capture_heatmaps: false,
    disable_session_recording: true,
    person_profiles: 'identified_only',
    respect_dnt: true,
  });
  sink = resolveSink();
  flush();
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function flush() {
  if (!sink) return;
  for (const it of queue) {
    if (it.kind === 'track') sink.track(it.a, it.b);
    else sink.identify(it.a, it.b);
  }
  queue.length = 0;
}

/**
 * Inicializa el proveedor SOLO si está permitido: consent ACCEPTED (sin GPC/DNT) +
 * host de producción + VITE_POSTHOG_KEY presente. Sin cualquiera de esos → NO-OP
 * (proveedor desactivado). Idempotente.
 */
export function initializeProviderIfAllowed(): void {
  if (sink) return;
  if (!analyticsAllowed()) return;                 // unknown/declined/GPC/DNT → nada
  if (!isProdHost()) return;                        // localhost/previews → nada
  const key = (import.meta.env.VITE_POSTHOG_KEY as string | undefined) ?? '';
  if (!key) return;                                 // sin key → proveedor OFF (Gate B)
  try { loadPostHog(key); } catch { /* noop */ }
}

/** Arranque: si el usuario ya había aceptado, intenta traer el proveedor. */
export function initAnalytics(): void {
  sink = sink ?? resolveSink();
  if (analyticsAllowed()) { initializeProviderIfAllowed(); if (sink) flush(); }
}

export function track(event: string, props?: Props): void {
  if (!analyticsAllowed()) return;                  // UNKNOWN/DECLINED/GPC/DNT → descartar
  sink = sink ?? resolveSink();
  if (sink) { sink.track(event, props); return; }
  // Accepted pero el proveedor aún no cargó → cola acotada (se vacía en loadPostHog).
  if (queue.length < MAX_QUEUE) queue.push({ kind: 'track', a: event, b: props });
  if (import.meta.env.DEV) console.debug('[analytics] track', event, props ?? '');
}

export function identify(id: string, traits?: Props): void {
  if (!analyticsAllowed()) return;                  // nunca identificar sin consentimiento
  sink = sink ?? resolveSink();
  if (sink) { sink.identify(id, traits); return; }
  if (queue.length < MAX_QUEUE) queue.push({ kind: 'identify', a: id, b: traits });
  if (import.meta.env.DEV) console.debug('[analytics] identify', id, traits ?? '');
}

/**
 * ANALYTICS-1 · P0/P1-A · suelta la identidad del proveedor + descarta la cola local.
 * Frontera de cuenta (logout / A→B) y retiro de consentimiento. Seguro sin proveedor.
 */
export function reset(): void {
  try {
    if (typeof window !== 'undefined') {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      const w = window as any;
      w.posthog?.reset?.();
    }
  } catch { /* noop — un fallo del proveedor nunca debe romper el logout */ }
  queue.length = 0;
  if (import.meta.env.DEV) console.debug('[analytics] reset');
}

/**
 * Cambia el consentimiento (device-level). ACCEPTED → persiste + intenta init del
 * proveedor (el caller identifica al usuario actual si hay sesión). DECLINED → persiste +
 * opt-out/reset del proveedor + limpia la cola; no vuelve a capturar tras recargar.
 */
export function setAnalyticsConsent(state: 'accepted' | 'declined'): void {
  storeAnalyticsConsent(state);
  if (state === 'accepted') {
    initializeProviderIfAllowed();
  } else {
    // Retiro: cortar captura futura y soltar identidad. La preferencia DECLINED persiste
    // → en la próxima carga analyticsAllowed()=false y el proveedor no se inicializa.
    try {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      const w = window as any;
      w.posthog?.opt_out_capturing?.();
    } catch { /* noop */ }
    reset();
    sink = null;
  }
}

// ANALYTICS-1 · P1-A · clasificación de error SEGURA: solo nombres de tipo de la
// allowlist llegan a analytics. error.name puede ser arbitrario (un Error custom puede
// fijarlo a texto de usuario) → cualquier valor fuera de la lista cae a 'UnknownError'.
const ERROR_KINDS = new Set([
  'Error', 'TypeError', 'ReferenceError', 'RangeError', 'SyntaxError', 'EvalError',
  'URIError', 'AggregateError', 'NetworkError', 'AbortError', 'TimeoutError',
]);
export function errorKind(name: unknown): string {
  const n = typeof name === 'string' ? name : '';
  return ERROR_KINDS.has(n) ? n : 'UnknownError';
}

export type { AnalyticsConsent };
