/**
 * stripe.ts — single source of truth para todo lo relacionado a pagos.
 *
 * Hoy las funciones de gestión son mocks honestos (lanzan STRIPE_NOT_WIRED
 * o retornan derivaciones del store). Cuando Stripe esté cableado, solo este
 * archivo cambia — la UI no se toca.
 */

import { useAppStore } from '../store';

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

/** Detecta la región del user por timezone del navegador. */
export function getUserRegion(): Currency {
  // TODO(stripe): refinar con IP geolookup en server-side cuando esté Stripe wired
  if (typeof Intl === 'undefined') return 'USD';
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  if (tz.includes('Mexico') || tz.includes('Tijuana') || tz.includes('Monterrey')) return 'MXN';
  if (tz.includes('Madrid') || tz.includes('Europe') || tz.includes('Atlantic/Canary')) return 'EUR';
  return 'USD';
}

export function getPriceInfo(currency?: Currency): PriceInfo {
  const c = currency ?? getUserRegion();
  const PRICES: Record<Currency, PriceInfo> = {
    MXN: { currency: 'MXN', monthly: 199, yearly: 1499, yearlyDiscount: 37, yearlyMonthly: 124.92, yearlySavings: 889 },
    EUR: { currency: 'EUR', monthly: 14,  yearly: 109,  yearlyDiscount: 35, yearlyMonthly: 9.08,   yearlySavings: 59 },
    USD: { currency: 'USD', monthly: 17,  yearly: 129,  yearlyDiscount: 37, yearlyMonthly: 10.75,  yearlySavings: 75 },
  };
  return PRICES[c];
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

export const STRIPE_NOT_WIRED_MESSAGE =
  'Sistema de pagos en activación. Hablá con el coach para gestionar tu plan mientras tanto.';
