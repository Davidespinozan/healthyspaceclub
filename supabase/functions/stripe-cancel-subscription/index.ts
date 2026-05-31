// ════════════════════════════════════════════════════════════════
// stripe-cancel-subscription — Edge Function (Deno) · verify_jwt = true
// Marca cancel_at_period_end:true en la suscripción activa del customer.
// NO escribe user_profiles: el webhook (customer.subscription.updated)
// persiste el flag (evita carreras). Idempotente si ya estaba marcada.
// ════════════════════════════════════════════════════════════════
import { corsHeaders, json } from '../_shared/cors.ts';
import { getUser } from '../_shared/auth.ts';
import { getAdmin } from '../_shared/supabaseAdmin.ts';
import { getStripe } from '../_shared/stripe.ts';

const CANCELABLE = new Set(['trialing', 'active', 'past_due', 'unpaid']);

// deno-lint-ignore no-explicit-any
function periodEndISO(sub: any): string | null {
  const item = sub?.items?.data?.[0];
  const epoch = sub?.current_period_end ?? item?.current_period_end ?? null;
  return typeof epoch === 'number' ? new Date(epoch * 1000).toISOString() : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ message: 'Método no permitido' }, 405);

  let user;
  try { user = await getUser(req); }
  catch (e) { if (e instanceof Response) return e; throw e; }

  try {
    const stripe = getStripe();
    const admin = getAdmin();

    const { data: profile } = await admin
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const customerId: string | null = profile?.stripe_customer_id ?? null;
    if (!customerId) return json({ message: 'No hay cliente de pago' }, 400);

    const subs = await stripe.subscriptions.list({
      customer: customerId, status: 'all', limit: 100,
    });
    const sub = subs.data.find((s) => CANCELABLE.has(s.status));
    if (!sub) return json({ message: 'No hay suscripción activa para cancelar' }, 404);

    const target = sub.cancel_at_period_end
      ? sub  // ya estaba marcada → idempotente
      : await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });

    return json({
      status: target.status,
      cancelAtPeriodEnd: target.cancel_at_period_end,
      cancelAt: periodEndISO(target),
    }, 200);
  } catch (e) {
    console.error('[stripe-cancel-subscription] error:', e);
    return json({ message: 'No se pudo cancelar la suscripción' }, 500);
  }
});