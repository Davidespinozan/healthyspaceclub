import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import type { SubscriptionInfo } from '../../utils/stripe';

// ═══════════════════════════════════════════════════════════════════════════
// MB-B · «Mi Plan» muestra el ciclo REAL de la suscripción y no presenta un precio
// de lista como importe del primer cobro. Todo con mocks: sin Stripe, sin Supabase,
// sin cuentas reales. Las funciones que modifican la suscripción no deben llamarse.
// ═══════════════════════════════════════════════════════════════════════════

const state = { language: 'es' as 'es' | 'en', trialEndsAt: null, streakCount: 0 };
vi.mock('../../store', () => {
  const useAppStore = Object.assign(
    (sel: (s: typeof state) => unknown) => sel(state),
    { getState: () => state },
  );
  return { useAppStore };
});
vi.mock('../../lib/supabase', () => ({ supabase: {} }));
vi.mock('../../hooks/useCurrentUserId', () => ({ useCurrentUserId: () => 'user-test' }));
vi.mock('../../utils/analytics', () => ({ track: vi.fn() }));
vi.mock('../CardCollectForm', () => ({ default: () => null }));

const sub = vi.fn<() => Promise<SubscriptionInfo | null>>();
const cancelSubscription = vi.fn();
const changeSubscription = vi.fn();
const updatePaymentMethod = vi.fn();
vi.mock('../../utils/stripe', async (orig) => {
  const real = await orig<typeof import('../../utils/stripe')>();
  return {
    ...real,
    getSubscription: () => sub(),
    getPaymentMethod: async () => null,
    getPaymentHistory: async () => [],
    cancelSubscription: (...a: unknown[]) => cancelSubscription(...a),
    changeSubscription: (...a: unknown[]) => changeSubscription(...a),
    updatePaymentMethod: (...a: unknown[]) => updatePaymentMethod(...a),
  };
});

import ManagePlanSheet from '../sheets/ManagePlanSheet';

const DATE = new Date('2026-11-05T12:00:00Z');
const DATE_ES = DATE.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

function makeSub(over: Partial<SubscriptionInfo>): SubscriptionInfo {
  return {
    plan: 'trial', billingCycle: null, nextRenewalDate: DATE, paymentMethod: null,
    status: 'trialing', trialEndsAt: DATE, cancelAtPeriodEnd: false, ...over,
  };
}

async function mount(s: SubscriptionInfo | null, lang: 'es' | 'en' = 'es') {
  state.language = lang;
  sub.mockResolvedValue(s);
  render(<ManagePlanSheet onClose={() => {}} />);
  await waitFor(() => expect(sub).toHaveBeenCalled());
  // espera a que el estado deje de ser el inicial (la tarjeta de estado se actualiza)
  await waitFor(() => expect(document.querySelector('.mps-pm-empty-text')).not.toBeNull());
}

const statusSub = () => document.querySelector('.mps-status-card .mps-status-sub')?.textContent ?? null;
const statusLine = () => document.querySelector('.mps-status-card .mps-status-line')?.textContent ?? null;
const cards = () => [...document.querySelectorAll('.mps-plan-card')] as HTMLElement[];
const selected = () => cards().map((c) => c.classList.contains('mps-plan-card--selected'));
const trialNotes = () => cards().map((c) => c.querySelector('.mps-plan-sub')?.textContent ?? null);
const switchButtons = () => document.querySelectorAll('.mps-plan-cta-secondary, .mps-plan-cta-primary').length;
const MONEY = /[$€]\s?\d/;

beforeEach(() => { sub.mockReset(); cancelSubscription.mockReset(); changeSubscription.mockReset(); updatePaymentMethod.mockReset(); });
afterEach(() => {
  cleanup();
  expect(cancelSubscription).not.toHaveBeenCalled();
  expect(changeSubscription).not.toHaveBeenCalled();
  expect(updatePaymentMethod).not.toHaveBeenCalled();
});

describe('MB-B · prueba gratuita', () => {
  it('mensual: fecha + «Mensual», sin importe; nota solo en la tarjeta mensual', async () => {
    await mount(makeSub({ billingCycle: 'monthly' }));
    expect(statusSub()).toContain('Tu primer cobro será el');
    expect(statusSub()).toContain(DATE_ES);
    expect(statusSub()).toContain('Mensual');
    expect(statusSub()).not.toMatch(MONEY);
    expect(selected()).toEqual([true, false]);
    expect(trialNotes()[0]).toContain(DATE_ES);
    expect(trialNotes()[1]).toBeNull();
  });

  it('anual: fecha + «Anual», nunca «/mes» ni importe; nota solo en la tarjeta anual', async () => {
    await mount(makeSub({ billingCycle: 'yearly' }));
    expect(statusSub()).toContain(DATE_ES);
    expect(statusSub()).toContain('Anual');
    expect(statusSub()).not.toContain('/mes');
    expect(statusSub()).not.toMatch(MONEY);
    expect(selected()).toEqual([false, true]);
    expect(trialNotes()[0]).toBeNull();
    expect(trialNotes()[1]).toContain(DATE_ES);
  });

  it('ciclo NULL: conserva la fecha, no infiere mensual, no marca tarjeta ni ofrece cambio', async () => {
    await mount(makeSub({ billingCycle: null }));
    expect(statusSub()).toContain(DATE_ES);
    expect(statusSub()).not.toContain('Mensual');
    expect(statusSub()).not.toContain('Anual');
    expect(statusSub()).not.toMatch(MONEY);
    expect(selected()).toEqual([false, false]);
    expect(trialNotes()).toEqual([null, null]);
    expect(switchButtons()).toBe(0);
  });

  it('sin fecha: mensaje neutro, no inventa fecha ni dice «Sin plan activo»', async () => {
    await mount(makeSub({ billingCycle: 'yearly', nextRenewalDate: null, trialEndsAt: null }));
    expect(statusLine()).toBe('Estás en tu prueba gratuita.');
    expect(statusSub()).toBeNull();
    expect(trialNotes()).toEqual([null, null]);
  });

  it('cancelación programada: muestra la fecha de fin y la nota «no se renovará» en el ciclo real', async () => {
    await mount(makeSub({ billingCycle: 'yearly', cancelAtPeriodEnd: true }));
    expect(statusLine()).toContain('Se cancelará el');
    expect(statusLine()).toContain(DATE_ES);
    expect(trialNotes()[0]).toBeNull();
    expect(trialNotes()[1]).toContain('no se renovará');
  });
});

describe('MB-B · suscripción activa (comportamiento previo conservado con ciclo conocido)', () => {
  it('mensual: renovación + precio de lista /mes', async () => {
    await mount(makeSub({ plan: 'pro', status: 'active', billingCycle: 'monthly', trialEndsAt: null }));
    expect(statusLine()).toContain('Tu plan se renueva el');
    expect(statusSub()).toMatch(/\/mes$/);
    expect(selected()).toEqual([true, false]);
  });

  it('anual: renovación + precio de lista /año', async () => {
    await mount(makeSub({ plan: 'pro', status: 'active', billingCycle: 'yearly', trialEndsAt: null }));
    expect(statusSub()).toMatch(/\/año$/);
    expect(selected()).toEqual([false, true]);
  });

  it('ciclo NULL: renovación sin importe atado a un ciclo supuesto', async () => {
    await mount(makeSub({ plan: 'pro', status: 'active', billingCycle: null, trialEndsAt: null }));
    expect(statusLine()).toContain('Tu plan se renueva el');
    expect(statusSub()).toBeNull();
    expect(selected()).toEqual([false, false]);
  });

  it('sin fecha: «Tu plan está activo.» en lugar de «Sin plan activo»', async () => {
    await mount(makeSub({ plan: 'pro', status: 'active', billingCycle: 'monthly', nextRenewalDate: null, trialEndsAt: null }));
    expect(statusLine()).toBe('Tu plan está activo.');
  });
});

describe('MB-B · sin suscripción y datos incompletos', () => {
  it('sin suscripción (null): «Sin plan activo.»', async () => {
    await mount(null);
    expect(statusLine()).toBe('Sin plan activo.');
    expect(selected()).toEqual([false, false]);
  });

  it('cancelada: «Sin plan activo.»', async () => {
    await mount(makeSub({ plan: 'none', status: 'canceled', billingCycle: 'monthly', nextRenewalDate: null, trialEndsAt: null }));
    expect(statusLine()).toBe('Sin plan activo.');
  });
});

describe('MB-B · inglés', () => {
  it('anual en prueba: «First charge on … · Yearly», sin importe ni textos en español', async () => {
    await mount(makeSub({ billingCycle: 'yearly' }), 'en');
    expect(statusSub()).toContain('First charge on');
    expect(statusSub()).toContain('Yearly');
    expect(statusSub()).not.toMatch(MONEY);
    expect(statusSub()).not.toContain('/mo');
  });

  it('sin fecha: mensaje neutro en inglés', async () => {
    await mount(makeSub({ billingCycle: null, nextRenewalDate: null, trialEndsAt: null }), 'en');
    expect(statusLine()).toBe("You're on your free trial.");
  });
});
