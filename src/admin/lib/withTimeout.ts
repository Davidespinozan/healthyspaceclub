/**
 * Carrea una consulta de supabase contra un timeout. supabase-js NO pone timeout al
 * fetch: un socket estancado dejaría el `await` colgado para siempre y la página del
 * panel atascada en "Cargando…". Al vencer, resolvemos con la MISMA forma que un
 * error normal ({ data:null, error }) para que el `if (error)` que ya tiene cada hook
 * lo maneje igual que un fallo de red — sin necesidad de tocar su lógica.
 */
export function withTimeout<T extends { error: unknown }>(
  q: PromiseLike<T>,
  ms = 12_000,
  label = 'consulta',
): Promise<T> {
  return Promise.race([
    Promise.resolve(q),
    new Promise<T>((resolve) =>
      setTimeout(
        () => resolve({ data: null, error: { message: `timeout (${label})` } } as unknown as T),
        ms,
      ),
    ),
  ]);
}
