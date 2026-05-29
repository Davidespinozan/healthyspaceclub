// Resuelve lookup_key → price_id vía Stripe API, con cache a nivel módulo
// (persiste mientras la instancia esté caliente). Los lookup_keys son estables
// y sobreviven test→live; los price_ids no, por eso nunca se hardcodean.
import type { Stripe } from './stripe.ts';

const cache = new Map<string, string>();

export async function resolvePriceId(stripe: Stripe, lookupKey: string): Promise<string> {
  const cached = cache.get(lookupKey);
  if (cached) return cached;

  const res = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  const price = res.data[0];
  if (!price) {
    throw new Error(`No hay price activo en Stripe para lookup_key "${lookupKey}"`);
  }

  cache.set(lookupKey, price.id);
  return price.id;
}
