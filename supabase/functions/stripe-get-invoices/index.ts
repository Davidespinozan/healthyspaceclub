// ════════════════════════════════════════════════════════════════
// stripe-get-invoices — Edge Function (Deno) · verify_jwt = true
// Devuelve el historial de pagos (facturas) del customer para "Mi Plan".
// SEGURIDAD: el customer SIEMPRE se deriva del user del JWT (nunca del body).
// Solo lectura. Filtra a facturas con cobro real (amount_paid > 0) o abiertas
// (pendiente/fallido) — las de trial en $0 no son "pagos".
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
  if (!customerId) return json({ invoices: [] }, 200);

  try {
    const stripe = getStripe();
    const list = await stripe.invoices.list({ customer: customerId, limit: 12 });

    const invoices = list.data
      // deno-lint-ignore no-explicit-any
      .filter((inv: any) => (inv.amount_paid ?? 0) > 0 || inv.status === 'open')
      // deno-lint-ignore no-explicit-any
      .map((inv: any) => {
        const paid = inv.amount_paid && inv.amount_paid > 0 ? inv.amount_paid : (inv.amount_due ?? 0);
        const status = inv.status === 'paid' ? 'succeeded'
          : inv.status === 'open' ? 'pending'
          : 'failed';
        return {
          id: inv.id,
          amount: paid / 100,
          currency: (inv.currency ?? 'usd').toUpperCase(),
          date: inv.created ? new Date(inv.created * 1000).toISOString() : null,
          status,
          description: inv.lines?.data?.[0]?.description ?? 'Suscripción HSC Pro',
        };
      });

    return json({ invoices }, 200);
  } catch (e) {
    console.error('[stripe-get-invoices] error:', e instanceof Error ? e.message : e);
    return json({ message: 'No se pudo leer el historial' }, 500);
  }
});
