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
const DATE_EN = DATE.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });

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
    expect(statusSub()).toBe(`Tu prueba gratuita termina el ${DATE_ES}. Ciclo de facturación: Mensual`);
    expect(statusSub()).not.toMatch(/cobro/i);
    expect(statusSub()).not.toMatch(MONEY);
    expect(selected()).toEqual([true, false]);
    expect(trialNotes()[0]).toContain(DATE_ES);
    expect(trialNotes()[1]).toBeNull();
  });

  it('anual: fecha + «Anual», nunca «/mes» ni importe; nota solo en la tarjeta anual', async () => {
    await mount(makeSub({ billingCycle: 'yearly' }));
    expect(statusSub()).toBe(`Tu prueba gratuita termina el ${DATE_ES}. Ciclo de facturación: Anual`);
    expect(statusSub()).not.toContain('/mes');
    expect(statusSub()).not.toMatch(MONEY);
    expect(selected()).toEqual([false, true]);
    expect(trialNotes()[0]).toBeNull();
    expect(trialNotes()[1]).toContain(DATE_ES);
  });

  it('ciclo NULL: conserva la fecha, no infiere mensual, no marca tarjeta ni ofrece cambio', async () => {
    await mount(makeSub({ billingCycle: null }));
    expect(statusSub()).toBe(`Tu prueba gratuita termina el ${DATE_ES}.`);
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

describe('MB-B + D.3 C2 · suscripción activa: fecha y ciclo reales, sin importe de lista', () => {
  it('mensual: renovación + ciclo, sin precio de lista como importe de renovación', async () => {
    await mount(makeSub({ plan: 'pro', status: 'active', billingCycle: 'monthly', trialEndsAt: null }));
    expect(statusLine()).toContain('Tu plan se renueva el');
    expect(statusLine()).toContain(DATE_ES);
    expect(statusSub()).toBe('Ciclo de facturación: Mensual');
    expect(statusSub()).not.toMatch(MONEY);
    expect(selected()).toEqual([true, false]);
  });

  it('anual: renovación + ciclo, sin «/año» ni importe', async () => {
    await mount(makeSub({ plan: 'pro', status: 'active', billingCycle: 'yearly', trialEndsAt: null }));
    expect(statusSub()).toBe('Ciclo de facturación: Anual');
    expect(statusSub()).not.toMatch(MONEY);
    expect(statusSub()).not.toContain('/año');
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

describe('D.3 C2 · ningún estado presenta un importe como cobro real', () => {
  it.each([
    ['trial mensual', { billingCycle: 'monthly' as const }],
    ['trial anual', { billingCycle: 'yearly' as const }],
    ['trial ciclo NULL', { billingCycle: null }],
    ['trial sin fecha', { billingCycle: 'yearly' as const, nextRenewalDate: null, trialEndsAt: null }],
    ['cancelación programada', { billingCycle: 'monthly' as const, cancelAtPeriodEnd: true }],
    ['activo mensual', { plan: 'pro' as const, status: 'active' as const, billingCycle: 'monthly' as const, trialEndsAt: null }],
    ['activo anual', { plan: 'pro' as const, status: 'active' as const, billingCycle: 'yearly' as const, trialEndsAt: null }],
    ['activo ciclo NULL', { plan: 'pro' as const, status: 'active' as const, billingCycle: null, trialEndsAt: null }],
    ['activo sin fecha', { plan: 'pro' as const, status: 'active' as const, billingCycle: 'monthly' as const, nextRenewalDate: null, trialEndsAt: null }],
  ])('%s: la tarjeta de estado no muestra importes', async (_caso, over) => {
    await mount(makeSub(over));
    expect(document.querySelector('.mps-status-card')?.textContent ?? '').not.toMatch(MONEY);
  });

  it('las tarjetas de planes se identifican como precios de lista de referencia (ES)', async () => {
    await mount(makeSub({ plan: 'pro', status: 'active', billingCycle: 'monthly', trialEndsAt: null }));
    const note = document.querySelector('.mps-price-note')?.textContent ?? '';
    expect(note).toMatch(/^Precios de lista de referencia en (MXN|EUR|USD)\./);
    expect(note).toContain('No incluyen descuentos promocionales');
    expect(note).toContain('pueden no coincidir con la moneda o el importe de tu suscripción');
  });
});

describe('MB-B · inglés', () => {
  it('anual en prueba: «Your free trial ends on … Billing cycle: Yearly», fecha en inglés, sin importe', async () => {
    await mount(makeSub({ billingCycle: 'yearly' }), 'en');
    expect(statusSub()).toBe(`Your free trial ends on ${DATE_EN}. Billing cycle: Yearly`);
    expect(statusSub()).not.toMatch(/charge|noviembre| de /i);
    expect(statusSub()).not.toMatch(MONEY);
    expect(statusSub()).not.toContain('/mo');
  });

  it('activo anual: «Your plan renews on … · Billing cycle: Yearly», sin importe', async () => {
    await mount(makeSub({ plan: 'pro', status: 'active', billingCycle: 'yearly', trialEndsAt: null }), 'en');
    expect(statusLine()).toContain('Your plan renews on');
    expect(statusSub()).toBe('Billing cycle: Yearly');
    expect(statusSub()).not.toMatch(MONEY);
    expect(statusSub()).not.toContain('/yr');
  });

  it('nota de precios de lista en inglés', async () => {
    await mount(makeSub({ billingCycle: 'monthly' }), 'en');
    const note = document.querySelector('.mps-price-note')?.textContent ?? '';
    expect(note).toMatch(/^Reference list prices in (MXN|EUR|USD)\./);
    expect(note).toContain("may not match your subscription's currency or amount");
  });

  it('sin fecha: mensaje neutro en inglés', async () => {
    await mount(makeSub({ billingCycle: null, nextRenewalDate: null, trialEndsAt: null }), 'en');
    expect(statusLine()).toBe("You're on your free trial.");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D.3B · La fecha del trial es su FIN (subscription_period_end = current_period_end de
// Stripe mientras está en 'trialing'), no un cobro: una promoción puede dejarlo en $0.
// Fechas en el idioma activo, en la zona horaria local, sin saltos de día.
// ═══════════════════════════════════════════════════════════════════════════
const trialTexts = () => [
  document.querySelector('.mps-status-card')?.textContent ?? '',
  document.querySelector('.mps-history-empty')?.textContent ?? '',
  ...cards().map((c) => c.querySelector('.mps-plan-sub')?.textContent ?? ''),
].join(' | ');

describe('D.3B · prueba gratuita: fin de la prueba, no primer cobro', () => {
  it('historial vacío durante la prueba (ES): fin de la prueba, sin «primer cobro»', async () => {
    await mount(makeSub({ billingCycle: 'monthly' }));
    expect(document.querySelector('.mps-history-empty')?.textContent).toBe(`Aún no hay pagos. Tu prueba gratuita termina el ${DATE_ES}.`);
  });

  it('historial vacío durante la prueba (EN)', async () => {
    await mount(makeSub({ billingCycle: 'yearly' }), 'en');
    expect(document.querySelector('.mps-history-empty')?.textContent).toBe(`No payments yet. Your free trial ends on ${DATE_EN}.`);
  });

  it.each(['es', 'en'] as const)('promoción del 100 %% (%s): Mi Plan no afirma ningún cobro ni importe durante la prueba', async (lang) => {
    // Mi Plan no conoce la promoción: con cualquier descuento el texto debe seguir siendo cierto.
    await mount(makeSub({ billingCycle: 'monthly' }), lang);
    expect(trialTexts()).not.toMatch(/cobro|cobrará|charge|charged/i);
    expect(document.querySelector('.mps-status-card')?.textContent ?? '').not.toMatch(MONEY);
  });

  it('cancelación programada en inglés: fecha en inglés', async () => {
    await mount(makeSub({ billingCycle: 'monthly', cancelAtPeriodEnd: true }), 'en');
    expect(statusLine()).toBe(`Cancels on ${DATE_EN}.`);
    expect(trialNotes()[0]).toBe(`Your trial ends on ${DATE_EN} and won't renew.`);
  });

  it('renovación activa en inglés: fecha en inglés', async () => {
    await mount(makeSub({ plan: 'pro', status: 'active', billingCycle: 'monthly', trialEndsAt: null }), 'en');
    expect(statusLine()).toBe(`Your plan renews on ${DATE_EN}.`);
  });
});

describe('D.3B · fechas cerca del cambio de día (zona horaria local, sin desplazamiento UTC)', () => {
  it.each([
    ['23:45 del 5', new Date(2026, 10, 5, 23, 45), '5 de noviembre de 2026', 'November 5, 2026'],
    ['00:10 del 6', new Date(2026, 10, 6, 0, 10), '6 de noviembre de 2026', 'November 6, 2026'],
  ])('%s: mismo día local en ES y EN, también tras pasar por ISO (como llega del servidor)', async (_caso, local, es, en) => {
    const fromServer = new Date(local.toISOString());
    await mount(makeSub({ billingCycle: 'monthly', nextRenewalDate: fromServer, trialEndsAt: fromServer }));
    expect(statusSub()).toBe(`Tu prueba gratuita termina el ${es}. Ciclo de facturación: Mensual`);
    cleanup();
    await mount(makeSub({ billingCycle: 'monthly', nextRenewalDate: fromServer, trialEndsAt: fromServer }), 'en');
    expect(statusSub()).toBe(`Your free trial ends on ${en}. Billing cycle: Monthly`);
  });
});
