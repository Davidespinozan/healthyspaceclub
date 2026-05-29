// Factory del client Stripe para Deno.
// CRÍTICO: el httpClient default del SDK usa el http de Node y NO corre en Deno.
// Hay que pasarle createFetchHttpClient(). Pineamos el mismo major que el devDep (^22).
// apiVersion: omitida a propósito → usa el default del SDK v22.
import Stripe from 'npm:stripe@^22';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY no está configurada');
  _stripe = new Stripe(key, {
    httpClient: Stripe.createFetchHttpClient(),
  });
  return _stripe;
}

// Re-export de la clase para acceder a estáticos (createSubtleCryptoProvider en el webhook).
export { Stripe };
