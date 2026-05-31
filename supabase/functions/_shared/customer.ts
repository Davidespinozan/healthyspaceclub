// Get-or-create del Stripe Customer + persistencia de stripe_customer_id.
// Mismo comportamiento que el inline de stripe-checkout (que se deja intacto),
// reusable por las functions de Elements (setup-intent / create-subscription).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { Stripe } from './stripe.ts';
import type { AuthedUser } from './auth.ts';

export async function getOrCreateCustomer(
  stripe: Stripe,
  admin: SupabaseClient,
  user: AuthedUser,
  locale: 'es' | 'en' = 'es',
): Promise<string> {
  const { data: profile } = await admin
    .from('user_profiles')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  const existing: string | null = profile?.stripe_customer_id ?? null;
  if (existing) return existing;

  // Anti-duplicados: si la DB perdió el id, reusar el customer ya existente en Stripe (por email).
  if (user.email) {
    const found = await stripe.customers.list({ email: user.email, limit: 100 });
    const match =
      found.data.find((c) => c.metadata?.supabase_user_id === user.id) ??
      found.data[0] ??
      null;
    if (match) {
      await admin
        .from('user_profiles')
        .upsert({ user_id: user.id, stripe_customer_id: match.id }, { onConflict: 'user_id' });
      return match.id;
    }
  }

  const customer = await stripe.customers.create(
    {
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
      preferred_locales: [locale],
    },
    { idempotencyKey: `customer_${user.id}` },
  );

  // Persistir ANTES de seguir → evita carrera con el webhook.
  // UPSERT (no update): en el flujo signup→pago→onboarding la fila de user_profiles
  // todavía no existe al pagar (la crea finishOnboardingCalc en el onboarding, que
  // ocurre DESPUÉS). Un .update() afectaría 0 filas y el stripe_customer_id nunca se
  // guardaría → stripe-create-subscription daría "No hay cliente de pago". El upsert
  // crea la fila si falta; el onboarding luego mergea por user_id sin conflicto.
  // service_role: el trigger guard_user_profiles_billing permite escribir billing.
  const { error } = await admin
    .from('user_profiles')
    .upsert({ user_id: user.id, stripe_customer_id: customer.id }, { onConflict: 'user_id' });
  if (error) {
    throw new Error(`No se pudo guardar el customer: ${error.message}`);
  }

  return customer.id;
}
