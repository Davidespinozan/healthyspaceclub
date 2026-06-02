/**
 * stripe.ts — single source of truth para todo lo relacionado a pagos.
 *
 * Hoy las funciones de gestión son mocks honestos (lanzan STRIPE_NOT_WIRED
 * o retornan derivaciones del store). Cuando Stripe esté cableado, solo este
 * archivo cambia — la UI no se toca.
 */

import { getCachedRegion, regionFromLanguage, pricingForCurrency, PRICING, type Region } from './region';
import { supabase } from '../lib/supabase';

export type BillingCycle = 'monthly' | 'yearly';
export type Currency = 'MXN' | 'EUR' | 'USD';

export interface PriceInfo {
  currency: Currency;
  monthly: number;
  yearly: number;
  yearlyDiscount: number;   // % de ahorro vs pagar mensual 12 veces
  yearlyMonthly: number;    // yearly / 12 para mostrar "equivale a $X/mes"
  yearlySavings: number;    // monto absoluto que se ahorra al año
}

export interface PaymentMethod {
  brand: string;            // 'visa' | 'mastercard' | 'amex' | …
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface SubscriptionInfo {
  plan: 'trial' | 'pro' | 'none';
  billingCycle: BillingCycle | null;
  nextRenewalDate: Date | null;
  paymentMethod: PaymentMethod | null;
  status: 'active' | 'trialing' | 'canceled' | 'past_due' | 'incomplete';
  trialEndsAt: Date | null;
  cancelAtPeriodEnd: boolean;
}

export interface PaymentHistoryEntry {
  id: string;
  amount: number;
  currency: Currency;
  date: Date;
  status: 'succeeded' | 'failed' | 'pending';
  description: string;
}

/**
 * Currency del user, derivada del sistema ÚNICO de detección de región
 * (region.ts: IP vía ipapi.co + cache en localStorage, fallback a navigator.language).
 * Es sync: lee la región que la landing ya cacheó; si no hay cache, infiere por idioma.
 */
export function getUserRegion(): Currency {
  const region = getCachedRegion() ?? regionFromLanguage();
  return PRICING[region].currency;
}

/**
 * Lee los montos base de region.ts (única fuente de verdad) y calcula en runtime
 * los derivados que la UI de pago necesita. No duplica precios.
 */
export function getPriceInfo(currency?: Currency): PriceInfo {
  const c = currency ?? getUserRegion();
  const base = pricingForCurrency(c);
  const monthly = base.monthly;
  const yearly = base.annual;
  return {
    currency: c,
    monthly,
    yearly,
    yearlyDiscount: base.savingsPct,
    yearlyMonthly: Math.round((yearly / 12) * 100) / 100,
    yearlySavings: monthly * 12 - yearly,
  };
}

export function formatPrice(amount: number, currency: Currency): string {
  const symbols: Record<Currency, string> = { MXN: '$', EUR: '€', USD: '$' };
  const locale = currency === 'EUR' ? 'es-ES' : 'es-MX';
  const formatted = amount % 1 === 0
    ? amount.toLocaleString(locale)
    : amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${symbols[currency]}${formatted}`;
}

export function formatRenewalDate(date: Date): string {
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ============================================================
// MOCKS — Stripe las reemplaza cuando se cablee
// ============================================================

/**
 * Lee el estado real desde user_profiles (que el webhook mantiene fresco)
 * vía la edge function stripe-get-subscription. Incluye el billing_cycle real
 * (monthly/annual) — antes estaba hardcodeado en 'monthly'. paymentMethod va
 * por getPaymentMethod aparte. El JWT lo adjunta invoke.
 */
export async function getSubscription(_userId: string): Promise<SubscriptionInfo | null> {
  const { data, error } = await supabase.functions.invoke('stripe-get-subscription', { body: {} });
  if (error) {
    console.error('[stripe] getSubscription falló:', error.message);
    return null;
  }

  const sub = (data?.subscription_status ?? 'none') as 'none' | 'trial' | 'pro';
  const periodEnd = data?.subscription_period_end ? new Date(data.subscription_period_end) : null;
  const billingCycle: BillingCycle | null =
    data?.billing_cycle === 'annual' ? 'yearly'
    : data?.billing_cycle === 'monthly' ? 'monthly'
    : null;

  const plan: SubscriptionInfo['plan'] = sub === 'pro' ? 'pro' : sub === 'trial' ? 'trial' : 'none';
  const status: SubscriptionInfo['status'] =
    sub === 'trial' ? 'trialing' : sub === 'pro' ? 'active' : 'canceled';

  return {
    plan,
    billingCycle,
    nextRenewalDate: periodEnd,
    paymentMethod: null,
    status,
    trialEndsAt: sub === 'trial' ? periodEnd : null,
    cancelAtPeriodEnd: !!data?.cancel_at_period_end,
  };
}

/** Tarjeta default del customer (vía edge function). null si no hay o si falla. */
export async function getPaymentMethod(_userId?: string): Promise<PaymentMethod | null> {
  try {
    const { data, error } = await supabase.functions.invoke('stripe-get-payment-method', { body: {} });
    if (error) throw new Error(error.message || 'No se pudo leer el método de pago');
    return (data?.paymentMethod ?? null) as PaymentMethod | null;
  } catch (e) {
    console.error('[stripe] getPaymentMethod falló:', e instanceof Error ? e.message : e);
    return null;
  }
}

/** Historial de pagos (facturas con cobro real) vía edge function. */
export async function getPaymentHistory(_userId: string): Promise<PaymentHistoryEntry[]> {
  const { data, error } = await supabase.functions.invoke('stripe-get-invoices', { body: {} });
  if (error) {
    console.error('[stripe] getPaymentHistory falló:', error.message);
    return [];
  }
  type RawInvoice = {
    id: string; amount: number; currency: string;
    date: string | null; status: PaymentHistoryEntry['status']; description: string;
  };
  return ((data?.invoices ?? []) as RawInvoice[]).map((e) => ({
    id: e.id,
    amount: e.amount,
    currency: e.currency as Currency,
    date: e.date ? new Date(e.date) : new Date(),
    status: e.status,
    description: e.description,
  }));
}

/**
 * TODO(stripe): crear Checkout Session en Edge Function y redirigir a session.url.
 * Mientras no esté cableado, esta función lanza STRIPE_NOT_WIRED.
 */
export async function startCheckout(_billingCycle: BillingCycle, _currency: Currency): Promise<string> {
  throw new Error('STRIPE_NOT_WIRED');
}

/**
 * Cambia el método de pago default (customer + sub activa) vía edge function.
 * La PM ya quedó attachada al confirmar el SetupIntent en el cliente.
 * Lanza Error con mensaje claro si falla (el caller lo maneja).
 */
export async function updatePaymentMethod(paymentMethodId: string): Promise<{
  ok: boolean;
  subscriptionStatus: string;
  paymentMethod: PaymentMethod | null;
}> {
  const { data, error } = await supabase.functions.invoke('stripe-update-payment-method', {
    body: { paymentMethodId },
  });
  if (error) throw new Error(error.message || 'No se pudo cambiar el método de pago');
  return data;
}

/**
 * Cambia el ciclo de la suscripción (mensual↔anual) vía edge function, con
 * prorrateo en la próxima factura. `cycle` de la app ('monthly'|'yearly') se
 * traduce al formato backend ('monthly'|'annual'). El webhook persiste el
 * nuevo billing_cycle. El JWT lo adjunta invoke.
 */
export async function changeSubscription(
  newCycle: BillingCycle,
  region: Region,
): Promise<{ status: string; cycle: BillingCycle }> {
  const cycle = newCycle === 'yearly' ? 'annual' : 'monthly';
  const { data, error } = await supabase.functions.invoke('stripe-change-cycle', {
    body: { region, cycle },
  });
  if (error) throw new Error(error.message || 'No se pudo cambiar el plan');
  return { status: data.status as string, cycle: newCycle };
}

/**
 * Cancela la suscripción al fin del período (cancel_at_period_end:true) vía edge
 * function. El webhook persiste el flag + fecha en user_profiles. El JWT lo adjunta invoke.
 */
export async function cancelSubscription(): Promise<{
  status: string; cancelAtPeriodEnd: boolean; cancelAt: string | null;
}> {
  const { data, error } = await supabase.functions.invoke('stripe-cancel-subscription', { body: {} });
  if (error) throw new Error(error.message || 'No se pudo cancelar la suscripción');
  return data;
}

// ============================================================
// Stripe Elements (Stripe-2b) — pago en UI propia, SetupIntent-first.
// Aditivo: no reemplaza los mocks de arriba (ManagePlanSheet los sigue usando).
// El JWT lo adjunta supabase.functions.invoke automáticamente.
// ============================================================

/** Asegura el customer y crea un SetupIntent. Devuelve el client_secret para el Payment Element. */
export async function createSetupIntent(): Promise<{ clientSecret: string }> {
  const { data, error } = await supabase.functions.invoke('stripe-setup-intent', { body: {} });
  if (error) throw new Error(error.message || 'No se pudo preparar el método de pago');
  if (!data?.clientSecret) throw new Error('Setup sin client_secret');
  return { clientSecret: data.clientSecret as string };
}

/**
 * Crea la suscripción (trial 3 días) con el payment method ya confirmado.
 * `cycle` es BillingCycle de la app ('monthly'|'yearly'); acá se traduce al
 * formato del backend/lookup_key ('monthly'|'annual') antes de invocar.
 */
export async function createSubscription(p: {
  region: Region;
  cycle: BillingCycle;
  paymentMethodId: string;
}): Promise<{ status: string; subscriptionId: string }> {
  const cycle = p.cycle === 'yearly' ? 'annual' : 'monthly';
  const { data, error } = await supabase.functions.invoke('stripe-create-subscription', {
    body: { region: p.region, cycle, paymentMethodId: p.paymentMethodId },
  });
  if (error) throw new Error(error.message || 'No se pudo crear la suscripción');
  return { status: data.status as string, subscriptionId: data.subscriptionId as string };
}
