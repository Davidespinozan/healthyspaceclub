// ════════════════════════════════════════════════════════════════
// stripe-create-subscription — Edge Function (Deno) · verify_jwt = true
// Crea la suscripción HSC Pro (trial 3 días, tarjeta en puerta) con el
// payment_method ya confirmado vía SetupIntent en la UI propia (Elements).
// NO escribe user_profiles: el webhook (customer.subscription.created →
// 'trialing' → 'trial') sincroniza el estado.
// ════════════════════════════════════════════════════════════════
import { corsHeaders, json } from '../_shared/cors.ts';
import { getUser } from '../_shared/auth.ts';
import { getAdmin } from '../_shared/supabaseAdmin.ts';
import { getStripe } from '../_shared/stripe.ts';
import { resolvePriceId } from '../_shared/resolvePrice.ts';
import { lookupKeyFor } from '../_shared/lookupKeys.ts';

interface SubBody {
  region?: string;
  cycle?: string;
  paymentMethodId?: string;
}

const BLOCKING_STATUSES = new Set(['trialing', 'active', 'past_due', 'unpaid']);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ message: 'Método no permitido' }, 405);

  let user;
  try {
    user = await getUser(req);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  let body: SubBody;
  try {
    body = await req.json();
  } catch {
    return json({ message: 'Body inválido' }, 400);
  }
  if (!body.paymentMethodId) return json({ message: 'Falta paymentMethodId' }, 400);

  // region/cycle en el MISMO formato que stripe-checkout (cycle: 'monthly'|'annual').
  const lookupKey = lookupKeyFor(body.region ?? '', body.cycle ?? '');
  if (!lookupKey) return json({ message: 'region/cycle inválidos' }, 400);

  const stripe = getStripe();
  const admin = getAdmin();

  // Resolver customer (debe existir: el setup-intent lo creó antes).
  const { data: profile } = await admin
    .from('user_profiles')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();
  const customerId: string | null = profile?.stripe_customer_id ?? null;
  if (!customerId) {
    return json({ message: 'No hay cliente de pago; iniciá el método de pago primero' }, 400);
  }

  try {
    // Guard anti-duplicado: chequear en Stripe (autoritativo, evita la carrera
    // con el webhook que mantiene user_profiles).
    const existing = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
    if (existing.data.some((s) => BLOCKING_STATUSES.has(s.status))) {
      return json({ message: 'Ya tenés una suscripción activa' }, 409);
    }

    const priceId = await resolvePriceId(stripe, lookupKey);

    // PM como default del customer (ya quedó adjunto al confirmar el SetupIntent).
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: body.paymentMethodId },
    });

    const sub = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: 3,
      default_payment_method: body.paymentMethodId,
      trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
      metadata: { supabase_user_id: user.id },
    });

    return json({ status: sub.status, subscriptionId: sub.id }, 200);
  } catch (e) {
    console.error('[stripe-create-subscription] error:', e instanceof Error ? e.message : e);
    return json({ message: 'No se pudo crear la suscripción' }, 500);
  }
});
