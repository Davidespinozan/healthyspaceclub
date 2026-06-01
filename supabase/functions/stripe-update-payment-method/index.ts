// ════════════════════════════════════════════════════════════════
// stripe-update-payment-method — Edge Function (Deno) · verify_jwt = true
// Cambia el método de pago default del customer Y de la sub activa.
// La PM ya viene attachada (la attachó el SetupIntent del cliente).
// SEGURIDAD: el customer SIEMPRE se deriva del JWT (nunca del body).
// v1: cubre trialing/active. past_due NO se fuerza (deferido a v1.1) — pero
// devolvemos subscriptionStatus como gancho del híbrido futuro.
// ════════════════════════════════════════════════════════════════
import { corsHeaders, json } from '../_shared/cors.ts';
import { getUser } from '../_shared/auth.ts';
import { getAdmin } from '../_shared/supabaseAdmin.ts';
import { getStripe } from '../_shared/stripe.ts';

const LIVE = new Set(['trialing', 'active', 'past_due']);

interface Body { paymentMethodId?: string }

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

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ message: 'Body inválido' }, 400);
  }
  const paymentMethodId = body.paymentMethodId;
  if (!paymentMethodId) return json({ message: 'Falta paymentMethodId' }, 400);

  const admin = getAdmin();
  const { data: profile } = await admin
    .from('user_profiles')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();
  const customerId: string | null = profile?.stripe_customer_id ?? null;
  if (!customerId) return json({ message: 'No hay cliente de pago' }, 400);

  try {
    const stripe = getStripe();

    // 1) Default del customer.
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // 2) Default de la sub viva (si hay) — mismo patrón que cancel-subscription.
    const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
    const sub = subs.data.find((s) => LIVE.has(s.status));
    if (sub) {
      await stripe.subscriptions.update(sub.id, { default_payment_method: paymentMethodId });
    }

    // 3) Detach best-effort de las tarjetas viejas (un fallo NO rompe la operación).
    try {
      const pms = await stripe.paymentMethods.list({ customer: customerId, type: 'card' });
      for (const p of pms.data) {
        if (p.id !== paymentMethodId) {
          try { await stripe.paymentMethods.detach(p.id); } catch { /* ignorar PM individual */ }
        }
      }
    } catch (e) {
      console.error('[stripe-update-payment-method] detach falló (best-effort):', e instanceof Error ? e.message : e);
    }

    // 4) Leer la card del PM nuevo para devolverla.
    const newPm = await stripe.paymentMethods.retrieve(paymentMethodId);
    // deno-lint-ignore no-explicit-any
    const card = (newPm as any)?.card;

    return json({
      ok: true,
      subscriptionStatus: sub?.status ?? 'none',
      paymentMethod: card
        ? { brand: card.brand, last4: card.last4, expMonth: card.exp_month, expYear: card.exp_year }
        : null,
    }, 200);
  } catch (e) {
    console.error('[stripe-update-payment-method] error:', e instanceof Error ? e.message : e);
    return json({ message: 'No se pudo cambiar el método de pago' }, 500);
  }
});
