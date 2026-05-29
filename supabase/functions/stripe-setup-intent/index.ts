// ════════════════════════════════════════════════════════════════
// stripe-setup-intent — Edge Function (Deno) · verify_jwt = true
// Asegura el Stripe Customer del user y crea un SetupIntent para colectar
// la tarjeta con Payment Element (SetupIntent-first, sin redirect).
// El cliente confirma con stripe.confirmSetup() y luego llama a
// stripe-create-subscription con el payment_method resultante.
// ════════════════════════════════════════════════════════════════
import { corsHeaders, json } from '../_shared/cors.ts';
import { getUser } from '../_shared/auth.ts';
import { getAdmin } from '../_shared/supabaseAdmin.ts';
import { getStripe } from '../_shared/stripe.ts';
import { getOrCreateCustomer } from '../_shared/customer.ts';

interface SetupBody {
  locale?: 'es' | 'en';
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

  let body: SetupBody = {};
  try {
    body = await req.json();
  } catch {
    // body opcional
  }
  const locale = body.locale === 'en' ? 'en' : 'es';

  const stripe = getStripe();
  const admin = getAdmin();

  try {
    const customerId = await getOrCreateCustomer(stripe, admin, user, locale);

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      usage: 'off_session',
      payment_method_types: ['card'],
    });

    return json({ clientSecret: setupIntent.client_secret }, 200);
  } catch (e) {
    console.error('[stripe-setup-intent] error:', e instanceof Error ? e.message : e);
    return json({ message: 'No se pudo preparar el método de pago' }, 500);
  }
});
