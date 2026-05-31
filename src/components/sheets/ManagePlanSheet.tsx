import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store';
import { useCurrentUserId } from '../../hooks/useCurrentUserId';
import { openCoachWith } from '../../utils/openCoach';
import { useT } from '../../i18n';
import {
  getSubscription,
  cancelSubscription,
  getPaymentMethod,
  getPaymentHistory,
  getPriceInfo,
  formatPrice,
  formatRenewalDate,
  type BillingCycle,
  type SubscriptionInfo,
  type PaymentMethod,
  type PaymentHistoryEntry,
} from '../../utils/stripe';
import './sheet-base.css';

interface Props {
  onClose: () => void;
}

// FAQ items se arman con t() inside del componente para que se localicen.
const FAQ_KEYS = [
  { q: 'managePlan.faq1q', a: 'managePlan.faq1a' },
  { q: 'managePlan.faq2q', a: 'managePlan.faq2a' },
  { q: 'managePlan.faq3q', a: 'managePlan.faq3a' },
  { q: 'managePlan.faq4q', a: 'managePlan.faq4a' },
  { q: 'managePlan.faq5q', a: 'managePlan.faq5a' },
] as const;

export default function ManagePlanSheet({ onClose }: Props) {
  const userId = useCurrentUserId();
  const { t } = useT();
  const { trialEndsAt: storeTrialEndsAt } = useAppStore();

  function planDisplayName(plan: SubscriptionInfo['plan']): string {
    if (plan === 'trial') return t('managePlan.planTrial');
    if (plan === 'pro') return t('managePlan.planPro');
    return t('managePlan.planNone');
  }

  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [history, setHistory] = useState<PaymentHistoryEntry[]>([]);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const priceInfo = getPriceInfo();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [sub, pm, hist] = await Promise.all([
        getSubscription(userId),
        getPaymentMethod(userId),
        getPaymentHistory(userId),
      ]);
      if (cancelled) return;
      setSubscription(sub);
      setPaymentMethod(pm);
      setHistory(hist);
    })();
    return () => { cancelled = true; };
  }, [userId, storeTrialEndsAt]);

  function notWired(action: string) {
    if (window.confirm(`${t('coach.stripeNotWired')}\n\n${t('managePlan.notWiredAsk')} "${action}"?`)) {
      onClose();
      openCoachWith(`Quiero ${action}.`);
    }
  }

  function handleAddPaymentMethod() { notWired(t('managePlan.actionAddPm')); }
  function handleUpdatePaymentMethod() { notWired(t('managePlan.actionUpdatePm')); }
  function handleChangeCycle(_target: BillingCycle) { notWired(t('managePlan.actionChangePlan')); }
  async function handleConfirmCancel() {
    setBusy(true);
    try {
      const res = await cancelSubscription();
      const store = useAppStore.getState();
      store.setCancelAtPeriodEnd(true);
      if (res.cancelAt) store.setSubscriptionPeriodEnd(res.cancelAt);
      setSubscription((prev) => prev ? {
        ...prev,
        cancelAtPeriodEnd: true,
        nextRenewalDate: res.cancelAt ? new Date(res.cancelAt) : prev.nextRenewalDate,
      } : prev);
      setShowCancelConfirm(false);
    } catch {
      window.alert(t('managePlan.cancelError'));
    } finally {
      setBusy(false);
    }
  }

  const isTrialing = subscription?.status === 'trialing';
  const currentCycle = subscription?.billingCycle ?? 'monthly';
  const renewalDate = subscription?.nextRenewalDate ?? null;

  return createPortal(
    <div className="sh-overlay" onClick={onClose}>
      <div className="sh-sheet" onClick={e => e.stopPropagation()}>
        <div className="sh-handle" />
        <div className="sh-header-row">
          <h1 className="sh-title">{t('managePlan.title')}</h1>
          <button
            className="sh-close"
            onClick={onClose}
            aria-label={t('common.close')}
            type="button"
          >
            ✕
          </button>
        </div>

        {/* SECCIÓN 2 — Estado actual */}
        <section className="mps-section">
          <div className="mps-status-card">
            <span className="mps-status-badge">{planDisplayName(subscription?.plan ?? 'none')}</span>
            {subscription?.cancelAtPeriodEnd && renewalDate ? (
              <>
                <p className="mps-status-line">
                  {t('managePlan.cancelsOn')} <strong>{formatRenewalDate(renewalDate)}</strong>.
                </p>
                <p className="mps-status-sub">{t('managePlan.cancelKeepsAccess')}</p>
              </>
            ) : isTrialing && renewalDate ? (
              <>
                <p className="mps-status-line">
                  {t('managePlan.trialDaysLeft')} <strong>{Math.max(0, Math.ceil((renewalDate.getTime() - Date.now()) / 86400000))} {t('settings.daysOther')}</strong> {t('managePlan.trialDaysLeftSuffix')}
                </p>
                <p className="mps-status-sub">
                  {t('managePlan.firstChargeOn')} {formatRenewalDate(renewalDate)} · {formatPrice(priceInfo.monthly, priceInfo.currency)} {t('managePlan.perMonth')}
                </p>
              </>
            ) : subscription?.status === 'active' && renewalDate ? (
              <>
                <p className="mps-status-line">
                  {t('managePlan.renewsOn')} <strong>{formatRenewalDate(renewalDate)}</strong>.
                </p>
                <p className="mps-status-sub">
                  {currentCycle === 'yearly'
                    ? `${formatPrice(priceInfo.yearly, priceInfo.currency)} ${t('managePlan.perYear')}`
                    : `${formatPrice(priceInfo.monthly, priceInfo.currency)} ${t('managePlan.perMonth')}`}
                </p>
              </>
            ) : (
              <p className="mps-status-line">{t('managePlan.noActivePlan')}</p>
            )}
          </div>
        </section>

        {/* SECCIÓN 3 — Método de pago */}
        <section className="mps-section">
          <h2 className="sh-heading">{t('managePlan.paymentMethod')}</h2>
          {paymentMethod ? (
            <div className="mps-payment-method-card">
              <div className="mps-pm-brand">{paymentMethod.brand.toUpperCase()}</div>
              <div className="mps-pm-info">
                <div>{paymentMethod.brand.charAt(0).toUpperCase() + paymentMethod.brand.slice(1)} {t('managePlan.pmEndingIn')} {paymentMethod.last4}</div>
                <div className="mps-pm-exp">{t('managePlan.pmExpires')} {String(paymentMethod.expMonth).padStart(2, '0')}/{String(paymentMethod.expYear).slice(-2)}</div>
              </div>
              <button type="button" className="mps-pm-update" onClick={handleUpdatePaymentMethod}>
                {t('managePlan.pmUpdate')}
              </button>
            </div>
          ) : (
            <div className="mps-payment-method-empty">
              <div className="mps-pm-empty-icon">💳</div>
              <p className="mps-pm-empty-text">{t('managePlan.pmEmpty')}</p>
              <button type="button" className="sh-cta" onClick={handleAddPaymentMethod}>
                {t('managePlan.pmAdd')}
              </button>
            </div>
          )}
        </section>

        {/* SECCIÓN 4 — Cambiar plan */}
        <section className="mps-section">
          <h2 className="sh-heading">{t('managePlan.planSection')}</h2>
          <div className="mps-plan-options">
            <div className={`mps-plan-card${currentCycle === 'monthly' ? ' mps-plan-card--selected' : ''}`}>
              {currentCycle === 'monthly' && <span className="mps-plan-tag">{t('managePlan.planCurrentBadge')}</span>}
              <div className="mps-plan-name">{t('managePlan.cycleMonthly')}</div>
              <div className="mps-plan-price">
                {formatPrice(priceInfo.monthly, priceInfo.currency)}
                <span className="mps-plan-price-unit"> {t('managePlan.perMonth')}</span>
              </div>
              {isTrialing && renewalDate && (
                <p className="mps-plan-sub">
                  {subscription?.cancelAtPeriodEnd
                    ? <>{t('managePlan.trialEndsOn')} {formatRenewalDate(renewalDate)} {t('managePlan.trialEndsNoRenew')}</>
                    : <>{t('managePlan.trialSubscribesOn')} {formatRenewalDate(renewalDate)}.</>}
                </p>
              )}
              {!isTrialing && currentCycle === 'yearly' && (
                <button type="button" className="mps-plan-cta-secondary" onClick={() => handleChangeCycle('monthly')}>
                  {t('managePlan.switchToMonthly')}
                </button>
              )}
            </div>

            <div className={`mps-plan-card${currentCycle === 'yearly' ? ' mps-plan-card--selected' : ''}`}>
              {currentCycle === 'yearly' && <span className="mps-plan-tag">{t('managePlan.planCurrentBadge')}</span>}
              <span className="mps-savings-badge">
                {t('managePlan.saveYearly')} {formatPrice(priceInfo.yearlySavings, priceInfo.currency)} {t('managePlan.saveYearlySuffix')}
              </span>
              <div className="mps-plan-name">{t('managePlan.cycleYearly')}</div>
              <div className="mps-plan-price">
                {formatPrice(priceInfo.yearly, priceInfo.currency)}
                <span className="mps-plan-price-unit"> {t('managePlan.perYear')}</span>
              </div>
              <div className="mps-plan-equiv">
                {t('managePlan.equivalentTo')} {formatPrice(priceInfo.yearlyMonthly, priceInfo.currency)} {t('managePlan.equivalentSuffix')}
              </div>
              {isTrialing && renewalDate && (
                <p className="mps-plan-sub">
                  {subscription?.cancelAtPeriodEnd
                    ? <>{t('managePlan.trialEndsOn')} {formatRenewalDate(renewalDate)} {t('managePlan.trialEndsNoRenew')}</>
                    : <>{t('managePlan.trialSubscribesOn')} {formatRenewalDate(renewalDate)}.</>}
                </p>
              )}
              {!isTrialing && currentCycle === 'monthly' && (
                <button type="button" className="sh-cta mps-plan-cta-primary" onClick={() => handleChangeCycle('yearly')}>
                  {t('managePlan.switchToYearly')}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* SECCIÓN 5 — Historial */}
        <section className="mps-section">
          <h2 className="sh-heading">{t('managePlan.historyTitle')}</h2>
          {history.length === 0 ? (
            <p className="mps-history-empty">
              {t('managePlan.historyEmpty')} {subscription?.cancelAtPeriodEnd
                ? t('managePlan.historyEmptyCanceled')
                : renewalDate && isTrialing
                ? `${t('managePlan.historyEmptyFirstCharge')} ${formatRenewalDate(renewalDate)}.`
                : ''}
            </p>
          ) : (
            <ul className="mps-history-list">
              {history.slice(0, 6).map(entry => (
                <li key={entry.id} className="mps-history-entry">
                  <span className={`mps-history-icon mps-history-icon--${entry.status}`}>
                    {entry.status === 'succeeded' ? '✓' : entry.status === 'pending' ? '⚠' : '✗'}
                  </span>
                  <div className="mps-history-body">
                    <div className="mps-history-desc">{entry.description}</div>
                    <div className="mps-history-date">{formatRenewalDate(entry.date)}</div>
                  </div>
                  <div className="mps-history-amount">
                    {formatPrice(entry.amount, entry.currency)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* SECCIÓN 6 — Cancelar (oculto si ya está marcada para cancelar) */}
        {!subscription?.cancelAtPeriodEnd && (
          <section className="mps-section">
            <button type="button" className="mps-cancel-btn" onClick={() => setShowCancelConfirm(true)}>
              {t('managePlan.cancelSubscription')}
            </button>
          </section>
        )}

        {/* SECCIÓN 7 — FAQ */}
        <section className="mps-section">
          <h2 className="sh-heading">{t('managePlan.faqTitle')}</h2>
          <div className="mps-faq">
            {FAQ_KEYS.map((item, i) => (
              <div key={i} className={`mps-faq-item${openFaq === i ? ' mps-faq-item--open' : ''}`}>
                <button
                  type="button"
                  className="mps-faq-q"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                >
                  <span>{t(item.q)}</span>
                  <span className="mps-faq-arrow">{openFaq === i ? '−' : '+'}</span>
                </button>
                {openFaq === i && <p className="mps-faq-a">{t(item.a)}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* Cancel confirm modal */}
        {showCancelConfirm && (
          <div className="mps-modal-overlay" onClick={() => !busy && setShowCancelConfirm(false)}>
            <div className="mps-modal" onClick={e => e.stopPropagation()}>
              <h3 className="mps-modal-title">{t('managePlan.cancelTitle')}</h3>
              <p className="mps-modal-p">{t('managePlan.cancelIntro')}</p>
              <ul className="sh-list">
                <li>{t('managePlan.cancelKeepAccess')} {renewalDate ? formatRenewalDate(renewalDate) : t('managePlan.cancelKeepAccessFallback')}.</li>
                <li>{t('managePlan.cancelLoseAi')}</li>
                <li>{t('managePlan.cancelDataKept')}</li>
              </ul>
              <div className="mps-modal-actions">
                <button
                  type="button"
                  className="sh-cta"
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={busy}
                >
                  {t('managePlan.cancelNo')}
                </button>
                <button
                  type="button"
                  className="mps-modal-confirm"
                  onClick={handleConfirmCancel}
                  disabled={busy}
                >
                  {busy ? t('common.processing') : t('managePlan.cancelYes')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
