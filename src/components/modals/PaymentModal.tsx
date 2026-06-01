import { useState, useMemo } from 'react';
import { useAppStore } from '../../store';
import TermsSheet from '../sheets/TermsSheet';
import PrivacySheet from '../sheets/PrivacySheet';
import { useEmailSignup } from '../../hooks/useEmailSignup';
import { createSubscription, getPriceInfo, formatPrice, type BillingCycle } from '../../utils/stripe';
import { getCachedRegion, regionFromLanguage } from '../../utils/region';
import CardCollectForm from '../CardCollectForm';

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
  const { payInfo, user, region, closeModal, goTo, setUserName, setObData } = useAppStore();
  // Si ya hay sesión activa, arrancamos directo en la fase de tarjeta.
  const [phase, setPhase] = useState<'account' | 'card'>(user ? 'card' : 'account');
  // Ciclo seleccionable en el modal — ANUAL preseleccionado.
  const [cycle, setCycle] = useState<BillingCycle>(payInfo.cycle ?? 'yearly');
  const [alreadySub, setAlreadySub] = useState(false);

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

  // Con la PM confirmada por CardCollectForm → crear la suscripción (alta).
  async function handleSubscribe(paymentMethodId: string) {
    const resolvedRegion = region ?? getCachedRegion() ?? regionFromLanguage();
    try {
      const { status } = await createSubscription({ region: resolvedRegion, cycle, paymentMethodId });
      // ⚠️ Protección 2 (carrera con webhook): set optimista del status.
      useAppStore.setState({
        subscriptionStatus: status === 'active' ? 'pro' : 'trial',
        subscriptionStatusLoadedFor: useAppStore.getState().user?.id ?? null,
      });
      closeModal();
      goTo('onboarding');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (/activa|already|409|suscrip/i.test(msg)) {
        setAlreadySub(true);
        return; // CardCollectForm no muestra error: el modal pasa a la vista "ya tenés sub".
      }
      throw e; // otro error → CardCollectForm lo muestra y deja reintentar.
    }
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
          {phase === 'account' ? (
            <AccountPhase onAuthed={onAuthed} />
          ) : alreadySub ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <p style={{ marginBottom: 16 }}>Ya tenés una suscripción activa.</p>
              <button className="btn-pay" onClick={() => { closeModal(); goTo('onboarding'); }}>Ir a la app</button>
            </div>
          ) : (
            <CardCollectForm
              ctaLabel={`🔒 Empezar trial gratis · ${priceLabel}/después`}
              onPaymentMethod={handleSubscribe}
            />
          )}
        </div>
      </div>
    </div>
  );
}
