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

  const customer = await stripe.customers.create(
    {
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
      preferred_locales: [locale],
    },
    { idempotencyKey: `customer_${user.id}` },
  );

  // Persistir ANTES de seguir → evita carrera con el webhook.
  // service_role: el trigger guard_user_profiles_billing lo permite.
  const { error } = await admin
    .from('user_profiles')
    .update({ stripe_customer_id: customer.id })
    .eq('user_id', user.id);
  if (error) {
    throw new Error(`No se pudo guardar el customer: ${error.message}`);
  }

  return customer.id;
}
