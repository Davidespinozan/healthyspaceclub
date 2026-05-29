// ════════════════════════════════════════════════════════════════
// stripe-portal — Edge Function (Deno) · verify_jwt = true
// Crea una sesión del Customer Portal de Stripe para gestionar la
// suscripción (cambiar método de pago, cancelar, etc.).
// El Customer Portal debe estar configurado en el dashboard de Stripe.
// ════════════════════════════════════════════════════════════════
import { corsHeaders, json } from '../_shared/cors.ts';
import { getUser } from '../_shared/auth.ts';
import { getAdmin } from '../_shared/supabaseAdmin.ts';
import { getStripe } from '../_shared/stripe.ts';

interface PortalBody {
  returnUrl?: string;
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

  let body: PortalBody = {};
  try {
    body = await req.json();
  } catch {
    // body opcional
  }

  const returnUrl = body.returnUrl ?? Deno.env.get('STRIPE_PORTAL_RETURN_URL');
  if (!returnUrl) return json({ message: 'Falta return_url' }, 400);

  const admin = getAdmin();
  const { data: profile } = await admin
    .from('user_profiles')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  const customerId = profile?.stripe_customer_id ?? null;
  if (!customerId) {
    return json({ message: 'No hay suscripción asociada a esta cuenta' }, 400);
  }

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return json({ url: session.url }, 200);
  } catch (e) {
    console.error('[stripe-portal] error:', e instanceof Error ? e.message : e);
    return json({ message: 'No se pudo abrir el portal' }, 500);
  }
});
