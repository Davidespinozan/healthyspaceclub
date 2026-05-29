/**
 * stripe.ts — single source of truth para todo lo relacionado a pagos.
 *
 * Hoy las funciones de gestión son mocks honestos (lanzan STRIPE_NOT_WIRED
 * o retornan derivaciones del store). Cuando Stripe esté cableado, solo este
 * archivo cambia — la UI no se toca.
 */

import { useAppStore } from '../store';
import { getCachedRegion, regionFromLanguage, pricingForCurrency, PRICING } from './region';

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
 * TODO(stripe): reemplazar por fetch a Edge Function
 *   /functions/v1/stripe-get-subscription con JWT del user.
 * Hoy deriva la info del store local: trial activo basado en trialEndsAt,
 * billingCycle siempre 'monthly' (no hay info real de Stripe), sin payment method.
 */
export async function getSubscription(_userId: string): Promise<SubscriptionInfo | null> {
  const store = useAppStore.getState();
  const userPlan = store.userPlan;
  const trialEndsAt = store.trialEndsAt ? new Date(store.trialEndsAt) : null;

  if (!userPlan || userPlan === 'none') {
    return {
      plan: 'none',
      billingCycle: null,
      nextRenewalDate: null,
      paymentMethod: null,
      status: 'canceled',
      trialEndsAt: null,
      cancelAtPeriodEnd: false,
    };
  }

  const isTrialing = !!(trialEndsAt && trialEndsAt > new Date());

  return {
    plan: (userPlan === 'trial' ? 'trial' : 'pro'),
    billingCycle: 'monthly',
    nextRenewalDate: trialEndsAt,
    paymentMethod: null,
    status: isTrialing ? 'trialing' : 'active',
    trialEndsAt,
    cancelAtPeriodEnd: false,
  };
}

/** TODO(stripe): query Stripe PaymentMethod via Edge Function. */
export async function getPaymentMethod(_userId: string): Promise<PaymentMethod | null> {
  return null;
}

/** TODO(stripe): query Stripe Invoices via Edge Function. */
export async function getPaymentHistory(_userId: string): Promise<PaymentHistoryEntry[]> {
  return [];
}

/**
 * TODO(stripe): crear Checkout Session en Edge Function y redirigir a session.url.
 * Mientras no esté cableado, esta función lanza STRIPE_NOT_WIRED.
 */
export async function startCheckout(_billingCycle: BillingCycle, _currency: Currency): Promise<string> {
  throw new Error('STRIPE_NOT_WIRED');
}

/** TODO(stripe): crear Customer Portal session via Edge Function y devolver URL. */
export async function updatePaymentMethod(): Promise<string> {
  throw new Error('STRIPE_NOT_WIRED');
}

/** TODO(stripe): update Stripe subscription al nuevo billing cycle (prorrateo automático). */
export async function changeSubscription(_newCycle: BillingCycle): Promise<void> {
  throw new Error('STRIPE_NOT_WIRED');
}

/**
 * TODO(stripe): cancelar la suscripción.
 * immediate=false → cancel_at_period_end (acceso hasta fin de período).
 * immediate=true  → cancela ya (refund prorrateado si aplica).
 */
export async function cancelSubscription(_immediate: boolean = false): Promise<void> {
  throw new Error('STRIPE_NOT_WIRED');
}
