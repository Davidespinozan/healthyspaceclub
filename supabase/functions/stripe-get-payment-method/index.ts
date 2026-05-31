// ════════════════════════════════════════════════════════════════
// stripe-get-payment-method — Edge Function (Deno) · verify_jwt = true
// Devuelve la tarjeta default del customer (brand/last4/exp) para "Mi Plan".
// SEGURIDAD: el customer SIEMPRE se deriva del user del JWT (nunca del body),
// si no un usuario podría leer la tarjeta de otro.
// Solo lectura — no escribe nada.
// ════════════════════════════════════════════════════════════════
import { corsHeaders, json } from '../_shared/cors.ts';
import { getUser } from '../_shared/auth.ts';
import { getAdmin } from '../_shared/supabaseAdmin.ts';
import { getStripe } from '../_shared/stripe.ts';

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

  const admin = getAdmin();
  const { data: profile } = await admin
    .from('user_profiles')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  const customerId: string | null = profile?.stripe_customer_id ?? null;
  if (!customerId) return json({ paymentMethod: null }, 200);

  try {
    const stripe = getStripe();
    const customer = await stripe.customers.retrieve(customerId, {
      expand: ['invoice_settings.default_payment_method'],
    });
    // customer puede ser DeletedCustomer; acceso defensivo.
    // deno-lint-ignore no-explicit-any
    const pm = (customer as any)?.invoice_settings?.default_payment_method;
    const card = pm?.card;
    if (!card) return json({ paymentMethod: null }, 200);

    return json({
      paymentMethod: {
        brand: card.brand,
        last4: card.last4,
        expMonth: card.exp_month,
        expYear: card.exp_year,
      },
    }, 200);
  } catch (e) {
    console.error('[stripe-get-payment-method] error:', e instanceof Error ? e.message : e);
    return json({ message: 'No se pudo leer el método de pago' }, 500);
  }
});