import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAppStore } from '../../store';
import TermsSheet from '../sheets/TermsSheet';
import PrivacySheet from '../sheets/PrivacySheet';
import { useEmailSignup } from '../../hooks/useEmailSignup';
import { createSetupIntent, createSubscription, getPriceInfo, formatPrice, type BillingCycle } from '../../utils/stripe';
import { getCachedRegion, regionFromLanguage } from '../../utils/region';

// loadStripe a nivel módulo (el modal es lazy → solo corre al abrirse).
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string);

// Appearance branded (verde/crema del tema HSC).
const appearance = {
  theme: 'flat' as const,
  variables: {
    colorPrimary: '#153330',
    colorBackground: '#FFFFFF',
    colorText: '#153330',
    colorDanger: '#cc3333',
    fontFamily: 'inherit',
    borderRadius: '10px',
  },
};

// Payment Element card-only: sin wallets (Apple/Google Pay). El SetupIntent ya
// restringe a ['card'], así que Link/bank tampoco aparecen.
const paymentElementOptions = {
  layout: 'tabs' as const,
  wallets: { applePay: 'never' as const, googlePay: 'never' as const },
};

function formatBillDate(date: Date): string {
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
}

// ── Fase 1: cuenta (reusa useEmailSignup) ──────────────────────────
function AccountPhase({ onAuthed }: { onAuthed: (firstName: string) => void }) {
  const goTo = useAppStore(s => s.goTo);
  const closeModal = useAppStore(s => s.closeModal);
  const su = useEmailSignup();
  const emailTaken = /registrad|already|exist/i.test(su.error);

  async function handleContinue() {
    const { outcome } = await su.submit();
    if (outcome === 'session') onAuthed(su.firstName);
    // 'error' / 'needs-confirmation' → su.error ya tiene el mensaje (no avanzamos).
  }

  return (
    <>
      <div className="pay-secure">Creá tu cuenta para empezar tu prueba</div>
      <div className="pay-lbl">Nombre completo</div>
      <input className="pay-inp" type="text" placeholder="Tu nombre" autoComplete="name"
        value={su.name} onChange={(e) => su.setName(e.target.value)} />
      <div className="pay-lbl">Correo electrónico</div>
      <input className="pay-inp" type="email" placeholder="tu@correo.com" autoComplete="email"
        value={su.email} onChange={(e) => su.setEmail(e.target.value)} />
      <div className="pay-lbl">Crea una contraseña</div>
      <input className="pay-inp" type="password" placeholder="Mínimo 8 caracteres" autoComplete="new-password"
        value={su.password} onChange={(e) => su.setPassword(e.target.value)} />
      <label className="signup-tos">
        <input type="checkbox" checked={su.acceptedTerms} onChange={e => su.setAcceptedTerms(e.target.checked)} />
        <span>
          Acepto los{' '}
          <button type="button" className="signup-tos-link" onClick={() => su.setShowTerms(true)}>Términos de Servicio</button>
          {' '}y la{' '}
          <button type="button" className="signup-tos-link" onClick={() => su.setShowPrivacy(true)}>Política de Privacidad</button>.
        </span>
      </label>

      {su.error && (
        <div style={{ color: '#cc3333', fontSize: '.8rem', margin: '4px 0 10px', textAlign: 'center' }}>
          {su.error}
          {emailTaken && (
            <> <button type="button" className="signup-tos-link" onClick={() => { closeModal(); goTo('login'); }}>
              ¿Ya tenés cuenta? Iniciá sesión
            </button></>
          )}
        </div>
      )}

      {su.loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0' }}>
          <div className="spinner" />
        </div>
      ) : (
        <button className="btn-pay" onClick={handleContinue} disabled={!su.acceptedTerms}
          style={{ opacity: su.acceptedTerms ? 1 : 0.5, cursor: su.acceptedTerms ? 'pointer' : 'not-allowed' }}>
          Continuar
        </button>
      )}

      {su.showTerms && <TermsSheet onClose={() => su.setShowTerms(false)} />}
      {su.showPrivacy && <PrivacySheet onClose={() => su.setShowPrivacy(false)} />}
    </>
  );
}

// ── Fase 2 (form): confirma SetupIntent + crea suscripción ─────────
function CardForm({ clientSecret, cycle, priceLabel }: { clientSecret: string; cycle: BillingCycle; priceLabel: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const { region, closeModal, goTo } = useAppStore();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadySub, setAlreadySub] = useState(false);

  async function handleConfirm() {
    if (!stripe || !elements) return;
    setProcessing(true);
    setError(null);

    try {
      // 0) Stripe exige elements.submit() ANTES de confirmSetup (primera op async).
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message ?? 'Revisá los datos de la tarjeta.');
        setProcessing(false);
        return;
      }

      // a) Confirmar el SetupIntent (card-only → 3DS in-modal, sin redirect).
      const { error: confirmErr, setupIntent } = await stripe.confirmSetup({
        elements,
        clientSecret,
        redirect: 'if_required',
        confirmParams: { return_url: window.location.origin },
      });
      if (confirmErr) {
        setError(confirmErr.message ?? 'Tu tarjeta fue rechazada. Probá con otra.');
        setProcessing(false);
        return;
      }

      const pm = setupIntent?.payment_method;
      const paymentMethodId = typeof pm === 'string' ? pm : pm?.id;
      if (!paymentMethodId) {
        setError('No se pudo confirmar la tarjeta. Probá de nuevo.');
        setProcessing(false);
        return;
      }

      // b) Crear la suscripción con el PM confirmado y el ciclo seleccionado.
      const resolvedRegion = region ?? getCachedRegion() ?? regionFromLanguage();
      const { status } = await createSubscription({ region: resolvedRegion, cycle, paymentMethodId });
      // ⚠️ Protección 2 (carrera con webhook): set optimista del status para que el
      // gate no rebote a quien ACABA de pagar antes de que el webhook escriba.
      // 'active' → 'pro'; cualquier otro estado de un alta con trial → 'trial'.
      useAppStore.setState({
        subscriptionStatus: status === 'active' ? 'pro' : 'trial',
        subscriptionStatusLoadedFor: useAppStore.getState().user?.id ?? null,
      });
      // c) Éxito → onboarding.
      closeModal();
      goTo('onboarding');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (/activa|already|409|suscrip/i.test(msg)) {
        setAlreadySub(true);
      } else {
        setError('No se pudo crear la suscripción. Reintentá.');
      }
      setProcessing(false);
    }
  }

  if (alreadySub) {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <p style={{ marginBottom: 16 }}>Ya tenés una suscripción activa.</p>
        <button className="btn-pay" onClick={() => { closeModal(); goTo('onboarding'); }}>Ir a la app</button>
      </div>
    );
  }

  return (
    <>
      <div className="pay-secure">Pago seguro — la tarjeta la procesa Stripe.</div>
      <PaymentElement options={paymentElementOptions} />
      {error && (
        <div style={{ color: '#cc3333', fontSize: '.8rem', margin: '10px 0', textAlign: 'center' }}>{error}</div>
      )}
      {processing ? (
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div className="spinner" />
          <div style={{ fontSize: '.8rem', color: 'var(--txt2)' }}>Procesando…</div>
        </div>
      ) : (
        <button className="btn-pay" onClick={handleConfirm} style={{ marginTop: 14 }}>
          🔒 Empezar trial gratis · {priceLabel}/después
        </button>
      )}
    </>
  );
}

// ── Fase 2 (contenedor): trae el clientSecret y monta <Elements> ───
function CardPhase({ cycle, priceLabel }: { cycle: BillingCycle; priceLabel: string }) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fetchSI = useCallback(async () => {
    setLoadErr(null);
    setClientSecret(null);
    try {
      const { clientSecret } = await createSetupIntent();
      setClientSecret(clientSecret);
    } catch {
      setLoadErr('No se pudo preparar el pago. Reintentar.');
    }
  }, []);

  // El SetupIntent se crea UNA sola vez. StrictMode (dev) monta el effect dos
  // veces; sin este guard se crean 2 SetupIntents y el clientSecret cambia tras
  // montar <Elements> ("clientSecret is not a mutable property"), lo que hace que
  // confirmSetup confirme un intent distinto al del Element → 400.
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchSI();
  }, [fetchSI]);

  if (loadErr) {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <p style={{ color: '#cc3333', marginBottom: 16 }}>{loadErr}</p>
        <button className="btn-pay" onClick={fetchSI}>Reintentar</button>
      </div>
    );
  }
  if (!clientSecret) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div className="spinner" />
        <div style={{ fontSize: '.8rem', color: 'var(--txt2)' }}>Preparando el pago seguro…</div>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
      <CardForm clientSecret={clientSecret} cycle={cycle} priceLabel={priceLabel} />
    </Elements>
  );
}

// ── Selector de ciclo (Anual / Mensual) ────────────────────────────
function CycleToggle({ cycle, onChange, savingsPct }: {
  cycle: BillingCycle;
  onChange: (c: BillingCycle) => void;
  savingsPct: number;
}) {
  const base: React.CSSProperties = {
    flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
    border: '1.5px solid', fontSize: '.85rem', textAlign: 'center', lineHeight: 1.2,
    background: 'transparent', transition: 'all .15s',
  };
  const on: React.CSSProperties = { ...base, borderColor: 'var(--amber)', background: 'rgba(191,160,101,.14)', color: 'var(--forest)', fontWeight: 600 };
  const off: React.CSSProperties = { ...base, borderColor: 'rgba(21,51,48,.18)', color: 'var(--txt2)' };

  return (
    <div style={{ display: 'flex', gap: 12, margin: '2px 28px 12px' }}>
      <button type="button" style={cycle === 'yearly' ? on : off} onClick={() => onChange('yearly')}>
        Anual
        {savingsPct > 0 && (
          <span style={{ display: 'block', fontSize: '.68rem', color: 'var(--amber)', fontWeight: 700 }}>
            Ahorrás {savingsPct}%
          </span>
        )}
      </button>
      <button type="button" style={cycle === 'monthly' ? on : off} onClick={() => onChange('monthly')}>
        Mensual
      </button>
    </div>
  );
}

// ── Modal (shell + fases) ──────────────────────────────────────────
export default function PaymentModal() {
  const { payInfo, user, closeModal, setUserName, setObData } = useAppStore();
  // Si ya hay sesión activa, arrancamos directo en la fase de tarjeta.
  const [phase, setPhase] = useState<'account' | 'card'>(user ? 'card' : 'account');
  // Ciclo seleccionable en el modal — ANUAL preseleccionado.
  const [cycle, setCycle] = useState<BillingCycle>(payInfo.cycle ?? 'yearly');

  // Precios derivados de region.ts (vía getPriceInfo) — no hardcodeados.
  const priceInfo = useMemo(() => getPriceInfo(payInfo.currency), [payInfo.currency]);
  const isYearly = cycle === 'yearly';
  const amountSel = isYearly ? priceInfo.yearly : priceInfo.monthly;
  const priceLabel = `${formatPrice(amountSel, priceInfo.currency)} ${priceInfo.currency}`;
  const planName = isYearly ? 'Anual' : 'Mensual';
  const periodLabel = isYearly
    ? `12 meses · ${formatPrice(priceInfo.yearlyMonthly, priceInfo.currency)}/mes`
    : 'Cancela cuando quieras';
  const zeroToday = priceInfo.currency === 'EUR' ? '€0' : '$0';

  const billDateLabel = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return formatBillDate(d);
  }, []);

  function onAuthed(firstName: string) {
    setUserName(firstName);
    setObData('name', firstName);
    setPhase('card');
  }

  return (
    <div className="ov open" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <div className="pay-box" style={{ maxHeight: '90vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div className="pay-head">
          <div>
            <div className="pay-plan-lbl">Plan seleccionado</div>
            <div className="pay-plan-name">{planName}</div>
            <div className="pay-plan-price">{priceLabel}</div>
            <div className="pay-plan-period">{periodLabel}</div>
          </div>
          <button className="pay-x" onClick={closeModal}>✕</button>
        </div>

        {/* Selector de ciclo — disponible antes de la tarjeta, en ambas fases */}
        <CycleToggle cycle={cycle} onChange={setCycle} savingsPct={priceInfo.yearlyDiscount} />

        {/* Resumen de trial — visible en ambas fases */}
        <div className="pay-trial">
          <div className="pay-trial-row">
            <span className="pay-trial-lbl">Hoy pagas</span>
            <span className="pay-trial-val pay-trial-val-free">{zeroToday}</span>
          </div>
          <div className="pay-trial-row">
            <span className="pay-trial-lbl">El {billDateLabel} se cobrará</span>
            <span className="pay-trial-val">{priceLabel}</span>
          </div>
          <ul className="pay-trial-notes">
            <li>Te enviaremos recordatorio 24h antes del cobro</li>
            <li>Cancela en 1 click desde tu perfil</li>
          </ul>
        </div>

        <div className="pay-body">
          <div className="pay-step-hint" style={{ fontSize: '.72rem', color: 'var(--txt2)', marginBottom: 8, textAlign: 'center' }}>
            {phase === 'account' ? 'Paso 1 de 2 · Cuenta' : 'Paso 2 de 2 · Pago'}
          </div>
          {phase === 'account'
            ? <AccountPhase onAuthed={onAuthed} />
            : <CardPhase cycle={cycle} priceLabel={priceLabel} />}
        </div>
      </div>
    </div>
  );
}
