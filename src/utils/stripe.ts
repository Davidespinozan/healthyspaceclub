/**
 * stripe.ts — single source of truth para todo lo relacionado a pagos.
 *
 * Hoy las funciones de gestión son mocks honestos (lanzan STRIPE_NOT_WIRED
 * o retornan derivaciones del store). Cuando Stripe esté cableado, solo este
 * archivo cambia — la UI no se toca.
 */

import { getCachedRegion, regionFromLanguage, pricingForCurrency, PRICING, type Region } from './region';
import { supabase } from '../lib/supabase';
import { Capacitor } from '@capacitor/core';

export type BillingCycle = 'monthly' | 'yearly';
// Ciclo en el formato que esperan las edge functions / lookup_keys (region.ts).
export type CheckoutCycle = 'monthly' | 'annual';
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
// Llamadas reales a las Edge Functions de Stripe (Stripe-1)
// ============================================================

/** Shape crudo que devuelve stripe-get-subscription (lo mantiene el webhook). */
export interface SubscriptionStatus {
  subscription_status: 'none' | 'trial' | 'pro';
  subscription_period_end: string | null;
  plan_id: string | null;
  billing_cycle: CheckoutCycle | null;
}

/**
 * Crea una Checkout Session (suscripción) vía edge function y devuelve su URL.
 * invoke() adjunta el JWT del usuario autenticado automáticamente.
 * Lanza un Error con mensaje claro si falla (la UI lo muestra).
 */
export async function createCheckout(opts: {
  region: Region;
  cycle: CheckoutCycle;
  locale?: 'es' | 'en';
}): Promise<string> {
  const { data, error } = await supabase.functions.invoke('stripe-checkout', {
    body: { region: opts.region, cycle: opts.cycle, locale: opts.locale ?? 'es' },
  });
  if (error) throw new Error(error.message || 'No se pudo iniciar el checkout');
  if (!data?.url) throw new Error('El checkout no devolvió URL');
  return data.url as string;
}

/** Lee el estado de suscripción crudo desde user_profiles (vía edge function). */
export async function fetchSubscriptionStatus(): Promise<SubscriptionStatus> {
  const { data, error } = await supabase.functions.invoke('stripe-get-subscription');
  if (error) throw new Error(error.message || 'No se pudo leer la suscripción');
  return {
    subscription_status: (data?.subscription_status ?? 'none') as SubscriptionStatus['subscription_status'],
    subscription_period_end: data?.subscription_period_end ?? null,
    plan_id: data?.plan_id ?? null,
    billing_cycle: (data?.billing_cycle ?? null) as SubscriptionStatus['billing_cycle'],
  };
}

/** Abre el Customer Portal de Stripe. Listo para Stripe-2b. */
export async function openPortal(returnUrl?: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('stripe-portal', {
    body: returnUrl ? { returnUrl } : {},
  });
  if (error) throw new Error(error.message || 'No se pudo abrir el portal');
  if (!data?.url) throw new Error('El portal no devolvió URL');
  return data.url as string;
}

/**
 * Redirige a una URL de Stripe (checkout/portal).
 * Web: navegación directa (el retorno lo maneja /checkout/success por pathname).
 * Native (Capacitor): in-app browser; al cerrarse dispara onNativeReturn
 * (el success_url redirige DENTRO del browser, no en el webview de la app).
 */
export async function openCheckoutUrl(url: string, onNativeReturn?: () => void): Promise<void> {
  if (Capacitor.getPlatform() !== 'web') {
    const { Browser } = await import('@capacitor/browser');
    if (onNativeReturn) {
      const sub = await Browser.addListener('browserFinished', () => {
        sub.remove();
        onNativeReturn();
      });
    }
    await Browser.open({ url });
  } else {
    window.location.href = url;
  }
}

/**
 * Estado de suscripción mapeado a SubscriptionInfo (lo consume ManagePlanSheet).
 * Lee la edge function; devuelve null si falla (no rompe la UI de gestión).
 * El parámetro userId queda por compatibilidad de firma — la edge function
 * resuelve el user desde el JWT.
 */
export async function getSubscription(_userId?: string): Promise<SubscriptionInfo | null> {
  try {
    const s = await fetchSubscriptionStatus();
    const periodEnd = s.subscription_period_end ? new Date(s.subscription_period_end) : null;
    const billingCycle: BillingCycle | null =
      s.billing_cycle === 'annual' ? 'yearly' : s.billing_cycle === 'monthly' ? 'monthly' : null;
    const plan = s.subscription_status;
    const status: SubscriptionInfo['status'] =
      plan === 'trial' ? 'trialing' : plan === 'pro' ? 'active' : 'canceled';
    return {
      plan,
      billingCycle,
      nextRenewalDate: periodEnd,
      paymentMethod: null,
      status,
      trialEndsAt: plan === 'trial' ? periodEnd : null,
      cancelAtPeriodEnd: false,
    };
  } catch (e) {
    console.error('[stripe] getSubscription falló:', e instanceof Error ? e.message : e);
    return null;
  }
}

/** TODO(stripe-2b): query Stripe PaymentMethod via Edge Function. */
export async function getPaymentMethod(_userId: string): Promise<PaymentMethod | null> {
  return null;
}

/** TODO(stripe-2b): query Stripe Invoices via Edge Function. */
export async function getPaymentHistory(_userId: string): Promise<PaymentHistoryEntry[]> {
  return [];
}

/** TODO(stripe-2b): gestión vía Customer Portal (openPortal). */
export async function updatePaymentMethod(): Promise<string> {
  return openPortal();
}
