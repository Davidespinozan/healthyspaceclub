// Mapeos PUROS Stripe → enum interno. Única fuente de la traducción status→plan.
// Enum interno: 'none' | 'trial' | 'pro' (alineado con el CHECK de user_profiles).
export type Plan = 'none' | 'trial' | 'pro';
export type BillingCycle = 'monthly' | 'annual';

export function mapStripeStatusToPlan(status: string): Plan {
  switch (status) {
    case 'trialing':
      return 'trial';
    case 'active':
    case 'past_due': // gracia: dejamos que el dunning de Stripe haga su trabajo
      return 'pro';
    case 'canceled':
    case 'unpaid':
    case 'incomplete':
    case 'incomplete_expired':
      return 'none';
    default:
      return 'none';
  }
}

export function billingCycleFromInterval(interval: string): BillingCycle | null {
  if (interval === 'month') return 'monthly';
  if (interval === 'year') return 'annual';
  return null;
}
