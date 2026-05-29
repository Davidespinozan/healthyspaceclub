// ════════════════════════════════════════════════════════════════
// stripe-checkout — Edge Function (Deno) · verify_jwt = true
// Crea una Checkout Session de suscripción para el user autenticado.
// Get-or-create del Stripe Customer, trial de 3 días con tarjeta en puerta.
// El secret key vive en Deno.env, nunca en el cliente.
// ════════════════════════════════════════════════════════════════
import { corsHeaders, json } from '../_shared/cors.ts';
import { getUser } from '../_shared/auth.ts';
import { getAdmin } from '../_shared/supabaseAdmin.ts';
import { getStripe } from '../_shared/stripe.ts';
import { resolvePriceId } from '../_shared/resolvePrice.ts';
import { lookupKeyFor } from '../_shared/lookupKeys.ts';

interface CheckoutBody {
  region?: string;
  cycle?: string;
  lookupKey?: string;
  locale?: 'es' | 'en';
  successUrl?: string;
  cancelUrl?: string;
}

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
  if (!user.email) return json({ message: 'La cuenta no tiene email' }, 400);

  let body: CheckoutBody;
  try {
    body = await req.json();
  } catch {
    return json({ message: 'Body inválido' }, 400);
  }

  // Resolver lookup_key: directa o derivada de region+cycle (server elige la key).
  const lookupKey = body.lookupKey ?? lookupKeyFor(body.region ?? '', body.cycle ?? '');
  if (!lookupKey) {
    return json({ message: 'region/cycle inválidos' }, 400);
  }

  const successUrl = body.successUrl ?? Deno.env.get('STRIPE_SUCCESS_URL');
  const cancelUrl = body.cancelUrl ?? Deno.env.get('STRIPE_CANCEL_URL');
  if (!successUrl || !cancelUrl) {
    return json({ message: 'Falta success_url / cancel_url' }, 400);
  }

  const stripe = getStripe();
  const admin = getAdmin();
  const locale = body.locale === 'en' ? 'en' : 'es';

  try {
    const priceId = await resolvePriceId(stripe, lookupKey);

    // ── Get-or-create del Stripe Customer ───────────────────────
    const { data: profile } = await admin
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let customerId: string | null = profile?.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          email: user.email,
          metadata: { supabase_user_id: user.id },
          preferred_locales: [locale],
        },
        { idempotencyKey: `customer_${user.id}` },
      );
      customerId = customer.id;

      // Persistir ANTES de crear la sesión → evita carrera con el webhook.
      // service_role: el trigger guard_user_profiles_billing lo permite.
      const { error: upErr } = await admin
        .from('user_profiles')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', user.id);
      if (upErr) {
        console.error('[stripe-checkout] no se pudo guardar customer_id:', upErr.message);
        return json({ message: 'No se pudo preparar el checkout' }, 500);
      }
    }

    // ── Checkout Session ────────────────────────────────────────
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 3,
        trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
        metadata: { supabase_user_id: user.id },
      },
      payment_method_collection: 'always', // tarjeta en puerta durante el trial
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
    });

    return json({ url: session.url }, 200);
  } catch (e) {
    console.error('[stripe-checkout] error:', e instanceof Error ? e.message : e);
    return json({ message: 'No se pudo crear el checkout' }, 500);
  }
});
