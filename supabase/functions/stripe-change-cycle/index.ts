// ════════════════════════════════════════════════════════════════
// stripe-change-cycle — Edge Function (Deno) · verify_jwt = true
// Cambia el price de la suscripción al otro ciclo (mensual↔anual) con
// prorrateo en la próxima factura (create_prorations): el cambio aplica
// al instante; el crédito/cargo prorrateado se suma a la próxima factura.
// NO escribe user_profiles: el webhook (customer.subscription.updated)
// sincroniza billing_cycle/period_end. Idempotente si ya está en el ciclo.
// ════════════════════════════════════════════════════════════════
import { corsHeaders, json } from '../_shared/cors.ts';
import { getUser } from '../_shared/auth.ts';
import { getAdmin } from '../_shared/supabaseAdmin.ts';
import { getStripe } from '../_shared/stripe.ts';
import { resolvePriceId } from '../_shared/resolvePrice.ts';
import { lookupKeyFor } from '../_shared/lookupKeys.ts';

interface ChangeBody {
  region?: string;
  cycle?: string; // 'monthly' | 'annual'
}

const CHANGEABLE = new Set(['trialing', 'active', 'past_due']);

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

  let body: ChangeBody;
  try {
    body = await req.json();
  } catch {
    return json({ message: 'Body inválido' }, 400);
  }

  const lookupKey = lookupKeyFor(body.region ?? '', body.cycle ?? '');
  if (!lookupKey) return json({ message: 'region/cycle inválidos' }, 400);

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
    const sub = subs.data.find((s) => CHANGEABLE.has(s.status));
    if (!sub) return json({ message: 'No hay suscripción activa para cambiar' }, 404);

    const item = sub.items.data[0];
    const newPriceId = await resolvePriceId(stripe, lookupKey);

    // Idempotente: ya está en ese ciclo → no tocar.
    if (item.price.id === newPriceId) {
      return json({ status: sub.status, cycle: body.cycle, unchanged: true }, 200);
    }

    const updated = await stripe.subscriptions.update(sub.id, {
      items: [{ id: item.id, price: newPriceId }],
      proration_behavior: 'create_prorations',
    });

    return json({ status: updated.status, cycle: body.cycle }, 200);
  } catch (e) {
    console.error('[stripe-change-cycle] error:', e instanceof Error ? e.message : e);
    return json({ message: 'No se pudo cambiar el plan' }, 500);
  }
});
