// MVP-RESILIENCE-1 · Gate B — hidratación de perfil RESILIENTE y provider-agnóstica.
// Pura/inyectable: el orquestador decide el estado de resolución sin tocar Supabase ni
// el store directamente (App.tsx inyecta el fetch real + los setters). Invariante:
// onboarding SOLO se muestra cuando la resolución terminó y el perfil realmente no
// tiene start_date; estado desconocido/loading/error → pantalla neutral, NUNCA onboarding.

export type ProfileResolution = 'idle' | 'loading' | 'resolved' | 'error';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ProfileFetchResult { data: any; error: any; timedOut?: boolean; }

/** Clasifica el resultado de un intento: fila → resolved-row; sin fila y sin error/
 *  timeout → resolved-empty (usuario NUEVO real, no es error); error/timeout → retry. */
export function resolveProfileOutcome(r: ProfileFetchResult): 'resolved-row' | 'resolved-empty' | 'retry' {
  if (r.data) return 'resolved-row';
  if (!r.error && !r.timedOut) return 'resolved-empty';
  return 'retry';
}

// Secuencia de reintentos rápida y ACOTADA (no hot-loop): inmediato, 400, 800, 1600ms.
export const HYDRATION_RETRY_DELAYS = [0, 400, 800, 1600] as const;

export interface HydrationDeps {
  fetchProfile: () => Promise<ProfileFetchResult>;
  sleep: (ms: number) => Promise<void>;
  /** Guard anti-cambio-de-cuenta: si deja de ser el usuario actual, se aborta y NO se
   *  aplica el resultado (evita hidratar el store de B con datos de A). */
  isCurrent: () => boolean;
  onResolvedRow: (data: any) => void;
  onResolvedEmpty: () => void;
  retryDelays?: readonly number[];
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Corre la hidratación con reintentos acotados. Devuelve el estado final:
 *  'resolved' (fila o usuario nuevo), 'error' (agotó reintentos rápidos) o 'idle'
 *  (se abortó por cambio de cuenta — no se aplicó nada). */
export async function runProfileHydration(deps: HydrationDeps): Promise<ProfileResolution> {
  const delays = deps.retryDelays ?? HYDRATION_RETRY_DELAYS;
  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) await deps.sleep(delays[i]);
    if (!deps.isCurrent()) return 'idle';
    const res = await deps.fetchProfile();
    if (!deps.isCurrent()) return 'idle';
    const outcome = resolveProfileOutcome(res);
    if (outcome === 'resolved-row') { deps.onResolvedRow(res.data); return 'resolved'; }
    if (outcome === 'resolved-empty') { deps.onResolvedEmpty(); return 'resolved'; }
    // retry → siguiente intento
  }
  return 'error';
}

/** Envuelve un fetch con timeout por-request (como el loader de suscripción): un socket
 *  estancado no puede colgar la hidratación para siempre. */
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function fetchWithTimeout(
  fetcher: () => Promise<{ data: any; error: any }>,
  timeoutMs = 10_000,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<ProfileFetchResult> {
  const timeout = sleep(timeoutMs).then(() => ({ data: null, error: null, timedOut: true }) as ProfileFetchResult);
  const real = fetcher().then((r) => ({ data: r.data, error: r.error }) as ProfileFetchResult);
  return Promise.race([real, timeout]);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Render-gate PURO: ¿mostrar la pantalla neutral de carga de cuenta en vez de
 *  onboarding? Sí cuando el usuario está autenticado, la ruta es 'onboarding' y la
 *  resolución del perfil AÚN no terminó (idle/loading/error). Independiente del
 *  proveedor de auth. */
export function shouldShowAccountLoader(opts: {
  authenticated: boolean;
  currentScreen: string;
  profileResolution: ProfileResolution;
}): boolean {
  return opts.authenticated && opts.currentScreen === 'onboarding' && opts.profileResolution !== 'resolved';
}
