// Analítica agnóstica de proveedor. NO agrega dependencias: reenvía a lo que haya
// en window (PostHog `window.posthog` o Segment `window.analytics`). Mientras no
// enchufes ninguno, hace no-op (y en dev loguea a consola). Los eventos previos a
// tener proveedor se encolan y se vacían en cuanto aparece uno.
//
// Para activarlo: pega el snippet de PostHog (o Segment) en index.html y listo —
// no hay que tocar este archivo ni los callsites.

type Props = Record<string, string | number | boolean | null | undefined>;

interface Sink {
  track: (event: string, props?: Props) => void;
  identify: (id: string, traits?: Props) => void;
}

let sink: Sink | null = null;
const queue: Array<{ kind: 'track' | 'identify'; a: string; b?: Props }> = [];
const MAX_QUEUE = 100;

/* eslint-disable @typescript-eslint/no-explicit-any */
function resolveSink(): Sink | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  if (w.posthog?.capture) {
    return {
      track: (e, p) => { try { w.posthog.capture(e, p); } catch { /* noop */ } },
      identify: (id, t) => { try { w.posthog.identify(id, t); } catch { /* noop */ } },
    };
  }
  if (w.analytics?.track) { // Segment-compatible
    return {
      track: (e, p) => { try { w.analytics.track(e, p); } catch { /* noop */ } },
      identify: (id, t) => { try { w.analytics.identify(id, t); } catch { /* noop */ } },
    };
  }
  return null;
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

/** Llamar una vez al arrancar (después de cargar el snippet del proveedor, si hay). */
export function initAnalytics(): void {
  sink = resolveSink();
  if (sink) flush();
}

export function track(event: string, props?: Props): void {
  sink = sink ?? resolveSink();
  if (sink) { sink.track(event, props); return; }
  if (queue.length < MAX_QUEUE) queue.push({ kind: 'track', a: event, b: props });
  if (import.meta.env.DEV) console.debug('[analytics] track', event, props ?? '');
}

export function identify(id: string, traits?: Props): void {
  sink = sink ?? resolveSink();
  if (sink) { sink.identify(id, traits); return; }
  if (queue.length < MAX_QUEUE) queue.push({ kind: 'identify', a: id, b: traits });
  if (import.meta.env.DEV) console.debug('[analytics] identify', id, traits ?? '');
}
