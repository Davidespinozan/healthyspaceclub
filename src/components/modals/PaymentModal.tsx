import { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../../store';
import { useT } from '../../i18n';
import TermsSheet from '../sheets/TermsSheet';
import PrivacySheet from '../sheets/PrivacySheet';
import { useEmailSignup } from '../../hooks/useEmailSignup';
import { createSubscription, getPriceInfo, formatPrice, type BillingCycle } from '../../utils/stripe';
import { getCachedRegion, regionFromLanguage } from '../../utils/region';
import CardCollectForm from '../CardCollectForm';

function formatBillDate(date: Date, lang: string): string {
  return date.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-MX', { day: 'numeric', month: 'long' });
}

// ── Fase 1: cuenta (reusa useEmailSignup) ──────────────────────────
function AccountPhase({ onAuthed }: { onAuthed: (firstName: string) => void }) {
  const { t } = useT();
  const goTo = useAppStore(s => s.goTo);
  const closeModal = useAppStore(s => s.closeModal);
  const su = useEmailSignup();
  const emailTaken = /registrad|already|exist/i.test(su.error);
  // Confirmación de correo y contraseña (evita typos en el registro de pago).
  const [confirmEmail, setConfirmEmail] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [matchError, setMatchError] = useState('');

  async function handleContinue() {
    if (su.email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      setMatchError(t('signup.emailMismatch'));
      return;
    }
    if (su.password !== confirmPassword) {
      setMatchError(t('signup.passwordMismatch'));
      return;
    }
    setMatchError('');
    const { outcome } = await su.submit();
    if (outcome === 'session') onAuthed(su.firstName);
    // 'error' / 'needs-confirmation' → su.error ya tiene el mensaje (no avanzamos).
  }

  return (
    <>
      <div className="pay-secure">{t('pay.accountIntro')}</div>
      <div className="pay-lbl">{t('signup.nameLabel')}</div>
      <input className="pay-inp" type="text" placeholder={t('signup.namePlaceholder')} autoComplete="name"
        value={su.name} onChange={(e) => su.setName(e.target.value)} />
      <div className="pay-lbl">{t('signup.emailLabel')}</div>
      <input className="pay-inp" type="email" placeholder={t('signup.emailPlaceholder')} autoComplete="email"
        value={su.email} onChange={(e) => { su.setEmail(e.target.value); setMatchError(''); }} />
      <div className="pay-lbl">{t('signup.emailConfirmLabel')}</div>
      <input className="pay-inp" type="email" placeholder={t('signup.emailConfirmPlaceholder')} autoComplete="off"
        onPaste={(e) => e.preventDefault()}
        value={confirmEmail} onChange={(e) => { setConfirmEmail(e.target.value); setMatchError(''); }} />
      <div className="pay-lbl">{t('signup.passwordLabel')}</div>
      <input className="pay-inp" type="password" placeholder={t('signup.passwordPlaceholder')} autoComplete="new-password"
        value={su.password} onChange={(e) => { su.setPassword(e.target.value); setMatchError(''); }} />
      <div className="pay-lbl">{t('signup.passwordConfirmLabel')}</div>
      <input className="pay-inp" type="password" placeholder={t('signup.passwordConfirmPlaceholder')} autoComplete="new-password"
        value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setMatchError(''); }} />
      <label className="signup-tos">
        <input type="checkbox" checked={su.acceptedTerms} onChange={e => su.setAcceptedTerms(e.target.checked)} />
        <span>
          {t('signup.tosAccept')}{' '}
          <button type="button" className="signup-tos-link" onClick={() => su.setShowTerms(true)}>{t('signup.tosTerms')}</button>
          {' '}{t('signup.tosAnd')}{' '}
          <button type="button" className="signup-tos-link" onClick={() => su.setShowPrivacy(true)}>{t('signup.tosPrivacy')}</button>.
        </span>
      </label>

      {matchError && (
        <div style={{ color: '#ff8a8a', fontSize: '.8rem', margin: '4px 0 10px', textAlign: 'center' }}>
          {matchError}
        </div>
      )}

      {su.error && (
        <div style={{ color: '#ff8a8a', fontSize: '.8rem', margin: '4px 0 10px', textAlign: 'center' }}>
          {su.error}
          {emailTaken && (
            <> <button type="button" className="signup-tos-link" onClick={() => { closeModal(); goTo('login'); }}>
              {t('pay.alreadyLogin')}
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
          {t('pay.continue')}
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
  const { t } = useT();
  const base: React.CSSProperties = {
    flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
    border: '1.5px solid', fontSize: '.85rem', textAlign: 'center', lineHeight: 1.2,
    background: 'transparent', transition: 'all .15s',
  };
  const on: React.CSSProperties = { ...base, borderColor: 'var(--amber)', background: 'rgba(191,160,101,.16)', color: '#F6F2EA', fontWeight: 600 };
  const off: React.CSSProperties = { ...base, borderColor: 'rgba(255,255,255,.14)', color: 'rgba(234,223,198,.55)' };

  return (
    <div style={{ display: 'flex', gap: 12, margin: '16px 28px 16px' }}>
      <button type="button" style={cycle === 'yearly' ? on : off} onClick={() => onChange('yearly')}>
        {t('paywall.cycleYearly')}
        {savingsPct > 0 && (
          <span style={{ display: 'block', fontSize: '.68rem', color: 'var(--amber)', fontWeight: 700 }}>
            {t('paywall.save', { pct: savingsPct })}
          </span>
        )}
      </button>
      <button type="button" style={cycle === 'monthly' ? on : off} onClick={() => onChange('monthly')}>
        {t('paywall.cycleMonthly')}
      </button>
    </div>
  );
}

// ── Modal (shell + fases) ──────────────────────────────────────────
export default function PaymentModal() {
  const { t } = useT();
  const language = useAppStore(s => s.language);
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
  const planName = isYearly ? t('paywall.cycleYearly') : t('paywall.cycleMonthly');
  const periodLabel = isYearly
    ? t('paywall.yearlyPeriod', { monthly: formatPrice(priceInfo.yearlyMonthly, priceInfo.currency) })
    : t('paywall.monthlyPeriod');
  const zeroToday = priceInfo.currency === 'EUR' ? '€0' : '$0';

  const billDateLabel = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return formatBillDate(d, language);
  }, [language]);

  // Cerrar con Escape (estándar de modal + accesibilidad por teclado).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeModal]);

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
      <div className="pay-box" role="dialog" aria-modal="true" aria-label={t('pay.planSelected')}
        style={{ maxHeight: '90dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div className="pay-head">
          <div>
            <div className="pay-plan-lbl">{t('pay.planSelected')}</div>
            <div className="pay-plan-name">{planName}</div>
            <div className="pay-plan-price">{priceLabel}</div>
            <div className="pay-plan-period">{periodLabel}</div>
          </div>
          <button className="pay-x" onClick={closeModal} aria-label={t('common.close')}>✕</button>
        </div>

        {/* Selector de ciclo — disponible antes de la tarjeta, en ambas fases */}
        <CycleToggle cycle={cycle} onChange={setCycle} savingsPct={priceInfo.yearlyDiscount} />

        {/* Resumen de trial — visible en ambas fases */}
        <div className="pay-trial">
          <div className="pay-trial-row">
            <span className="pay-trial-lbl">{t('pay.todayPay')}</span>
            <span className="pay-trial-val pay-trial-val-free">{zeroToday}</span>
          </div>
          <div className="pay-trial-row">
            <span className="pay-trial-lbl">{t('pay.billOn', { date: billDateLabel })}</span>
            <span className="pay-trial-val">{priceLabel}</span>
          </div>
          <ul className="pay-trial-notes">
            <li>{t('pay.note1')}</li>
            <li>{t('pay.note2')}</li>
          </ul>
        </div>

        <div className="pay-body">
          <div className="pay-step-hint" style={{ fontSize: '.72rem', color: 'var(--txt2)', marginBottom: 8, textAlign: 'center' }}>
            {phase === 'account' ? t('pay.step1') : t('pay.step2')}
          </div>
          {phase === 'account' ? (
            <AccountPhase onAuthed={onAuthed} />
          ) : alreadySub ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <p style={{ marginBottom: 16 }}>{t('pay.alreadySub')}</p>
              <button className="btn-pay" onClick={() => { closeModal(); goTo('onboarding'); }}>{t('pay.goToApp')}</button>
            </div>
          ) : (
            <CardCollectForm
              ctaLabel={t('pay.cta', { price: priceLabel })}
              onPaymentMethod={handleSubscribe}
            />
          )}
        </div>
      </div>
    </div>
  );
}
