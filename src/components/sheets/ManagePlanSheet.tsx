import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store';
import { useCurrentUserId } from '../../hooks/useCurrentUserId';
import { openCoachWith } from '../../utils/openCoach';
import {
  getSubscription,
  getPaymentMethod,
  getPaymentHistory,
  getPriceInfo,
  formatPrice,
  formatRenewalDate,
  STRIPE_NOT_WIRED_MESSAGE,
  type BillingCycle,
  type SubscriptionInfo,
  type PaymentMethod,
  type PaymentHistoryEntry,
} from '../../utils/stripe';
import './sheet-base.css';

interface Props {
  onClose: () => void;
}

const FAQ_ITEMS = [
  {
    q: '¿Cuándo se hace el cobro?',
    a: 'Tu trial dura 7 días gratis. Después se hace un cobro mensual o anual según el plan que elijas. Te avisamos 24h antes del primer cobro.',
  },
  {
    q: '¿Qué pasa si cancelo?',
    a: 'Mantenés acceso hasta el final del período que ya pagaste. Después tu cuenta queda en modo gratuito; tus datos quedan guardados por si volvés.',
  },
  {
    q: '¿Puedo cambiar de plan en cualquier momento?',
    a: 'Sí. Si cambiás de mensual a anual, se prorratea el saldo. Si cambiás de anual a mensual, el cambio aplica al próximo ciclo.',
  },
  {
    q: '¿Hay descuentos por pagar anual?',
    a: 'Sí. El plan anual cuesta lo equivalente a aproximadamente 9 meses — ahorrás ~3 meses al año vs pagar mes a mes.',
  },
  {
    q: '¿Cómo elimino mi cuenta y mis datos?',
    a: 'Hablá con el coach o escribí a soporte@stryvstudio.com. Procesamos eliminación dentro de 30 días según GDPR / LFPDPPP.',
  },
];

function planDisplayName(plan: SubscriptionInfo['plan']): string {
  if (plan === 'trial') return 'Trial Gratuito';
  if (plan === 'pro') return 'HSC Pro';
  return 'Sin plan activo';
}

export default function ManagePlanSheet({ onClose }: Props) {
  const userId = useCurrentUserId();
  const { trialEndsAt: storeTrialEndsAt } = useAppStore();

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
    if (window.confirm(`${STRIPE_NOT_WIRED_MESSAGE}\n\n¿Querés hablar con el coach sobre "${action}"?`)) {
      onClose();
      openCoachWith(`Quiero ${action}.`);
    }
  }

  function handleAddPaymentMethod() { notWired('agregar un método de pago'); }
  function handleUpdatePaymentMethod() { notWired('actualizar mi método de pago'); }
  function handleChangeCycle(_target: BillingCycle) { notWired('cambiar mi plan'); }
  function handleConfirmCancel() {
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      setShowCancelConfirm(false);
      notWired('cancelar mi suscripción');
    }, 300);
  }

  const isTrialing = subscription?.status === 'trialing';
  const currentCycle = subscription?.billingCycle ?? 'monthly';
  const renewalDate = subscription?.nextRenewalDate ?? null;

  return createPortal(
    <div className="sh-overlay" onClick={onClose}>
      <div className="sh-sheet" onClick={e => e.stopPropagation()}>
        <div className="sh-handle" />
        <button
          className="sh-close"
          onClick={onClose}
          aria-label="Cerrar"
          type="button"
        >
          ✕
        </button>

        <h1 className="sh-title">Mi Plan</h1>

        {/* SECCIÓN 2 — Estado actual */}
        <section className="mps-section">
          <div className="mps-status-card">
            <span className="mps-status-badge">{planDisplayName(subscription?.plan ?? 'none')}</span>
            {isTrialing && renewalDate ? (
              <>
                <p className="mps-status-line">
                  Te quedan <strong>{Math.max(0, Math.ceil((renewalDate.getTime() - Date.now()) / 86400000))} días</strong> de prueba gratuita.
                </p>
                <p className="mps-status-sub">
                  Tu primer cobro será el {formatRenewalDate(renewalDate)} · {formatPrice(priceInfo.monthly, priceInfo.currency)} / mes
                </p>
              </>
            ) : subscription?.status === 'active' && renewalDate ? (
              <>
                <p className="mps-status-line">
                  Tu plan se renueva el <strong>{formatRenewalDate(renewalDate)}</strong>.
                </p>
                <p className="mps-status-sub">
                  {currentCycle === 'yearly'
                    ? `${formatPrice(priceInfo.yearly, priceInfo.currency)} / año`
                    : `${formatPrice(priceInfo.monthly, priceInfo.currency)} / mes`}
                </p>
              </>
            ) : (
              <p className="mps-status-line">Sin plan activo.</p>
            )}
          </div>
        </section>

        {/* SECCIÓN 3 — Método de pago */}
        <section className="mps-section">
          <h2 className="sh-heading">Método de pago</h2>
          {paymentMethod ? (
            <div className="mps-payment-method-card">
              <div className="mps-pm-brand">{paymentMethod.brand.toUpperCase()}</div>
              <div className="mps-pm-info">
                <div>{paymentMethod.brand.charAt(0).toUpperCase() + paymentMethod.brand.slice(1)} terminada en {paymentMethod.last4}</div>
                <div className="mps-pm-exp">Vence {String(paymentMethod.expMonth).padStart(2, '0')}/{String(paymentMethod.expYear).slice(-2)}</div>
              </div>
              <button type="button" className="mps-pm-update" onClick={handleUpdatePaymentMethod}>
                Actualizar →
              </button>
            </div>
          ) : (
            <div className="mps-payment-method-empty">
              <div className="mps-pm-empty-icon">💳</div>
              <p className="mps-pm-empty-text">Aún no agregaste un método de pago.</p>
              <button type="button" className="sh-cta" onClick={handleAddPaymentMethod}>
                Agregar método de pago →
              </button>
            </div>
          )}
        </section>

        {/* SECCIÓN 4 — Cambiar plan */}
        <section className="mps-section">
          <h2 className="sh-heading">Plan actual y opciones</h2>
          <div className="mps-plan-options">
            <div className={`mps-plan-card${currentCycle === 'monthly' ? ' mps-plan-card--selected' : ''}`}>
              {currentCycle === 'monthly' && <span className="mps-plan-tag">Actual</span>}
              <div className="mps-plan-name">Mensual</div>
              <div className="mps-plan-price">
                {formatPrice(priceInfo.monthly, priceInfo.currency)}
                <span className="mps-plan-price-unit"> /mes</span>
              </div>
              {isTrialing && renewalDate && (
                <p className="mps-plan-sub">
                  Te suscribís cuando termine el trial el {formatRenewalDate(renewalDate)}.
                </p>
              )}
              {!isTrialing && currentCycle === 'yearly' && (
                <button type="button" className="mps-plan-cta-secondary" onClick={() => handleChangeCycle('monthly')}>
                  Cambiar a mensual
                </button>
              )}
            </div>

            <div className={`mps-plan-card${currentCycle === 'yearly' ? ' mps-plan-card--selected' : ''}`}>
              {currentCycle === 'yearly' && <span className="mps-plan-tag">Actual</span>}
              <span className="mps-savings-badge">
                Ahorrás {formatPrice(priceInfo.yearlySavings, priceInfo.currency)} / año
              </span>
              <div className="mps-plan-name">Anual</div>
              <div className="mps-plan-price">
                {formatPrice(priceInfo.yearly, priceInfo.currency)}
                <span className="mps-plan-price-unit"> /año</span>
              </div>
              <div className="mps-plan-equiv">
                Equivale a {formatPrice(priceInfo.yearlyMonthly, priceInfo.currency)} / mes
              </div>
              {isTrialing && renewalDate && (
                <p className="mps-plan-sub">
                  Te suscribís cuando termine el trial el {formatRenewalDate(renewalDate)}.
                </p>
              )}
              {!isTrialing && currentCycle === 'monthly' && (
                <button type="button" className="sh-cta mps-plan-cta-primary" onClick={() => handleChangeCycle('yearly')}>
                  Cambiar a anual y ahorrar →
                </button>
              )}
            </div>
          </div>
        </section>

        {/* SECCIÓN 5 — Historial */}
        <section className="mps-section">
          <h2 className="sh-heading">Historial</h2>
          {history.length === 0 ? (
            <p className="mps-history-empty">
              Aún no hay pagos. {renewalDate && isTrialing
                ? `Tu primer cobro será el ${formatRenewalDate(renewalDate)}.`
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

        {/* SECCIÓN 6 — Cancelar */}
        <section className="mps-section">
          <button type="button" className="mps-cancel-btn" onClick={() => setShowCancelConfirm(true)}>
            Cancelar suscripción
          </button>
        </section>

        {/* SECCIÓN 7 — FAQ */}
        <section className="mps-section">
          <h2 className="sh-heading">Preguntas frecuentes</h2>
          <div className="mps-faq">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className={`mps-faq-item${openFaq === i ? ' mps-faq-item--open' : ''}`}>
                <button
                  type="button"
                  className="mps-faq-q"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                >
                  <span>{item.q}</span>
                  <span className="mps-faq-arrow">{openFaq === i ? '−' : '+'}</span>
                </button>
                {openFaq === i && <p className="mps-faq-a">{item.a}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* Cancel confirm modal */}
        {showCancelConfirm && (
          <div className="mps-modal-overlay" onClick={() => !busy && setShowCancelConfirm(false)}>
            <div className="mps-modal" onClick={e => e.stopPropagation()}>
              <h3 className="mps-modal-title">¿Estás seguro de que querés cancelar?</h3>
              <p className="mps-modal-p">Si cancelás:</p>
              <ul className="sh-list">
                <li>Mantenés acceso hasta {renewalDate ? formatRenewalDate(renewalDate) : 'el final del período'}.</li>
                <li>Después no podrás generar rutinas ni planes con IA.</li>
                <li>Tus datos quedan guardados por si volvés.</li>
              </ul>
              <div className="mps-modal-actions">
                <button
                  type="button"
                  className="sh-cta"
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={busy}
                >
                  No, volver
                </button>
                <button
                  type="button"
                  className="mps-modal-confirm"
                  onClick={handleConfirmCancel}
                  disabled={busy}
                >
                  {busy ? 'Procesando…' : 'Sí, cancelar'}
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
