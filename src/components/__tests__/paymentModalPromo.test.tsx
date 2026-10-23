import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

// ═══════════════════════════════════════════════════════════════════════════
// D.3 · C1 · PaymentModal con código promocional. El descuento solo lo conoce Stripe al
// confirmar (stripe-create-subscription), así que con un código escrito el modal no puede
// anunciar el precio de lista como próximo cobro, ni una fecha de cobro, ni un CTA con
// importe. Sin código, todo queda como estaba. Todo con mocks: sin Stripe ni Supabase.
// ═══════════════════════════════════════════════════════════════════════════

const state = {
  language: 'es' as 'es' | 'en',
  user: { id: 'user-test' },
  region: 'LATAM' as const,
  payInfo: { plan: 'Mensual', price: '$249 MXN', period: '', currency: 'MXN' as const, cycle: 'monthly' as 'monthly' | 'yearly' },
  closeModal: vi.fn(),
  goTo: vi.fn(),
  setUserName: vi.fn(),
  setObData: vi.fn(),
};
vi.mock('../../store', () => {
  const useAppStore = Object.assign(
    (sel: (s: typeof state) => unknown) => sel(state),
    { getState: () => state, setState: vi.fn() },
  );
  return { useAppStore };
});
vi.mock('../../lib/supabase', () => ({ supabase: {} }));
vi.mock('../../utils/analytics', () => ({ track: vi.fn() }));

// Formulario de tarjeta simulado: expone el CTA que recibe y dispara onPaymentMethod
// con un payment method ficticio; muestra el error si la creación falla (como el real).
vi.mock('../CardCollectForm', async () => {
  const { useState } = await import('react');
  return {
    default: ({ ctaLabel, onPaymentMethod }: { ctaLabel: string; onPaymentMethod: (pm: string) => Promise<void> }) => {
      const [err, setErr] = useState<string | null>(null);
      return (
        <div>
          {err && <div data-testid="card-error">{err}</div>}
          <button data-testid="cta" onClick={() => { onPaymentMethod('pm_test_mock').catch((e: Error) => setErr(e.message)); }}>{ctaLabel}</button>
        </div>
      );
    },
  };
});

const createSubscription = vi.fn();
vi.mock('../../utils/stripe', async (orig) => {
  const real = await orig<typeof import('../../utils/stripe')>();
  return { ...real, createSubscription: (...a: unknown[]) => createSubscription(...a) };
});

import PaymentModal from '../modals/PaymentModal';

const MONEY = /[$€]\s?\d/;
const summary = () => document.querySelector('.pay-trial')!.textContent ?? '';
const cta = () => screen.getByTestId('cta').textContent ?? '';
const typePromo = (code: string) => fireEvent.change(screen.getByLabelText(/Código promocional|Promo code/), { target: { value: code } });

beforeEach(() => {
  state.language = 'es';
  state.payInfo = { ...state.payInfo, cycle: 'monthly' };
  createSubscription.mockReset(); state.closeModal.mockReset(); state.goTo.mockReset();
});
afterEach(() => cleanup());

describe('C1 · sin código promocional (comportamiento aprobado intacto)', () => {
  it('anuncia fecha de cobro y precio de lista, y el CTA lleva el importe', () => {
    render(<PaymentModal />);
    expect(summary()).toMatch(/El .+ se cobrará\$249 MXN/);
    expect(summary()).toContain('Si cancelas antes de esa fecha, no se te cobra nada');
    expect(summary()).not.toContain('Precio regular');
    expect(cta()).toBe('Empezar trial gratis · $249 MXN/después');
  });

  it('confirmar sin código llama a createSubscription sin promoCode y sigue al onboarding', async () => {
    createSubscription.mockResolvedValue({ status: 'trialing', subscriptionId: 'sub_mock' });
    render(<PaymentModal />);
    fireEvent.click(screen.getByTestId('cta'));
    await waitFor(() => expect(state.goTo).toHaveBeenCalledWith('onboarding'));
    expect(createSubscription).toHaveBeenCalledWith({ region: 'LATAM', cycle: 'monthly', paymentMethodId: 'pm_test_mock', promoCode: '' });
  });
});

describe('C1 · código escrito, aún sin validar', () => {
  it('muestra «Precio regular», no anuncia fecha de cobro y el CTA no lleva importe', () => {
    render(<PaymentModal />);
    typePromo('ig100');
    expect(summary()).toContain('Precio regular$249 MXN');
    expect(summary()).not.toMatch(/se cobrará/);
    expect(summary()).not.toMatch(/antes de esa fecha/);
    expect(summary()).toContain('Si tu código es válido, el descuento se aplicará al confirmar.');
    expect(summary()).toContain('El importe y la fecha de futuros cobros dependerán de las condiciones de la promoción.');
    expect(summary()).toContain('Tu prueba gratuita dura 3 días: si cancelas durante la prueba, no se te cobra nada.');
    expect(summary()).toContain('Hoy pagas$0');
    expect(cta()).toBe('Empezar trial gratis');
    expect(cta()).not.toMatch(MONEY);
    // No afirma que el código se validó ni que se aplicó.
    expect(document.body.textContent).not.toMatch(/aplicado|validado|descuento de \d|\d+\s?% de descuento/i);
  });

  it('solo espacios no cuenta como código: vuelve al copy normal', () => {
    render(<PaymentModal />);
    typePromo('   ');
    expect(summary()).toMatch(/se cobrará/);
    expect(cta()).toMatch(MONEY);
  });

  it('borrar el código restaura el copy aprobado', () => {
    render(<PaymentModal />);
    typePromo('IG100');
    typePromo('');
    expect(summary()).toMatch(/El .+ se cobrará\$249 MXN/);
    expect(cta()).toBe('Empezar trial gratis · $249 MXN/después');
  });

  it('anual: mismo criterio con el precio anual', () => {
    state.payInfo = { ...state.payInfo, cycle: 'yearly' };
    render(<PaymentModal />);
    typePromo('FUNDADORES');
    expect(summary()).toContain('Precio regular$1,990 MXN');
    expect(cta()).toBe('Empezar trial gratis');
  });
});

describe('C1 · validación real en el servidor (mock)', () => {
  it('código inválido: el modal no avanza, muestra el error y no promete nada', async () => {
    createSubscription.mockRejectedValue(new Error('Código promocional inválido o expirado'));
    render(<PaymentModal />);
    typePromo('NOEXISTE');
    fireEvent.click(screen.getByTestId('cta'));
    await waitFor(() => expect(screen.getByTestId('card-error').textContent).toContain('inválido'));
    expect(createSubscription).toHaveBeenCalledWith({ region: 'LATAM', cycle: 'monthly', paymentMethodId: 'pm_test_mock', promoCode: 'NOEXISTE' });
    expect(state.goTo).not.toHaveBeenCalled();
    expect(state.closeModal).not.toHaveBeenCalled();
    expect(cta()).toBe('Empezar trial gratis');
  });

  it.each([
    ['descuento parcial', 'IG50'],
    ['descuento del 100 %', 'FUNDADORES'],
  ])('código válido con %s: antes de confirmar no se muestra ningún importe descontado; la llamada es la misma', async (_caso, code) => {
    createSubscription.mockResolvedValue({ status: 'trialing', subscriptionId: 'sub_mock' });
    render(<PaymentModal />);
    typePromo(code);
    // La UI no conoce el descuento: no hay importe distinto del precio regular.
    const amounts = summary().match(/[$€][\d,.]+/g);
    expect(amounts).toEqual(['$0', '$249']);
    fireEvent.click(screen.getByTestId('cta'));
    await waitFor(() => expect(state.goTo).toHaveBeenCalledWith('onboarding'));
    expect(createSubscription).toHaveBeenCalledTimes(1);
    expect(createSubscription).toHaveBeenCalledWith({ region: 'LATAM', cycle: 'monthly', paymentMethodId: 'pm_test_mock', promoCode: code });
    expect(state.closeModal).toHaveBeenCalled();
  });
});

describe('C1 · inglés', () => {
  it('sin código: copy aprobado en inglés', () => {
    state.language = 'en';
    render(<PaymentModal />);
    expect(summary()).toMatch(/You'll be charged on .+\$249 MXN/);
    expect(cta()).toBe('Start free trial · $249 MXN/after');
  });

  it('con código: precio regular, nota de promoción y CTA sin importe', () => {
    state.language = 'en';
    render(<PaymentModal />);
    typePromo('TIKTOK100');
    expect(summary()).toContain('Regular price$249 MXN');
    expect(summary()).not.toMatch(/charged on/);
    expect(summary()).toContain('If your code is valid, the discount will be applied when you confirm.');
    expect(summary()).toContain("The amount and date of future charges will depend on the promotion's terms.");
    expect(summary()).toContain("Your free trial lasts 3 days: cancel during the trial and you won't be charged.");
    expect(cta()).toBe('Start free trial');
  });
});
