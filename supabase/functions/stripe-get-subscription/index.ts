// ════════════════════════════════════════════════════════════════
// stripe-get-subscription — Edge Function (Deno) · verify_jwt = true
// Devuelve el estado de suscripción desde user_profiles (la fuente de
// verdad que mantiene fresca el webhook). NO consulta Stripe en vivo.
// La carrera post-checkout (volver antes del webhook) la maneja la UX (Stripe-2).
// ════════════════════════════════════════════════════════════════
import { corsHeaders, json } from '../_shared/cors.ts';
import { getUser } from '../_shared/auth.ts';
import { getAdmin } from '../_shared/supabaseAdmin.ts';

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
  const { data: profile, error } = await admin
    .from('user_profiles')
    .select('subscription_status, subscription_period_end, plan_id, billing_cycle')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[stripe-get-subscription] error:', error.message);
    return json({ message: 'No se pudo leer la suscripción' }, 500);
  }

  return json({
    subscription_status: profile?.subscription_status ?? 'none',
    subscription_period_end: profile?.subscription_period_end ?? null,
    plan_id: profile?.plan_id ?? null,
    billing_cycle: profile?.billing_cycle ?? null,
  }, 200);
});
