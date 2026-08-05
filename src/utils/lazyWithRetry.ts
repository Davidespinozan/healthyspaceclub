import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * React.lazy endurecido para una PWA que se redespliega seguido.
 *
 * Problema real: tras un deploy, el index.html que el usuario ya tiene en memoria
 * referencia chunks con hash VIEJO que el CDN ya no sirve. Al navegar a una pantalla
 * lazy, `import()` rechaza (chunk 404) → el usuario ve la pantalla de error, o si el
 * fetch se ESTANCA, un Suspense fallback en blanco para siempre.
 *
 * Fix: (1) timeout — un import que cuelga se corta y cuenta como fallo; (2) una sola
 * recarga automática (flag en sessionStorage para no entrar en loop) que trae el
 * index.html + chunks frescos; (3) si aun tras recargar sigue fallando, se propaga el
 * error para que ErrorBoundary lo muestre (no insistir). En éxito se limpia el flag.
 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('chunk timeout')), ms)),
  ]);
}

function ss(): Storage | null {
  try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null; } catch { return null; }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  name: string,
): LazyExoticComponent<T> {
  const KEY = `chunk-reload-${name}`;
  return lazy(async () => {
    try {
      const mod = await withTimeout(factory(), 12_000);
      ss()?.removeItem(KEY); // cargó bien → permite recargar en un futuro deploy
      return mod;
    } catch (e) {
      const store = ss();
      // ¿Ya recargamos por este chunk y volvió a fallar? No insistir → error visible.
      if (store?.getItem(KEY)) throw e;
      store?.setItem(KEY, '1');
      window.location.reload();
      // La página se está recargando; devolvemos una promesa que nunca resuelve para
      // no parpadear un error antes de que el reload tome efecto.
      return new Promise<{ default: T }>(() => {});
    }
  });
}
