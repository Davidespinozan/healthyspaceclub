import { useState, useMemo } from 'react';
import { useAppStore } from '../../store';
import { useT } from '../../i18n';
import { createCheckout, openCheckoutUrl } from '../../utils/stripe';
import { getCachedRegion, regionFromLanguage } from '../../utils/region';

function formatBillDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'es-MX', { day: 'numeric', month: 'long' });
}

export default function PaymentModal() {
  const { payInfo, region, user, closeModal, openModal, setPendingCheckout, goTo } = useAppStore();
  const { t, locale } = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = payInfo.currency ?? '';
  const amount = payInfo.amount ?? 0;
  const displayPrice = payInfo.price; // ya formateado por el caller (ej. "$1,990 MXN")

  const billDateLabel = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3); // trial de 3 días
    return formatBillDate(d, locale);
  }, [locale]);

  async function handleStartCheckout() {
    setError(null);
    const resolvedRegion = region ?? getCachedRegion() ?? regionFromLanguage();
    const cycle = payInfo.cycle ?? 'monthly';

    // Sin sesión: el checkout necesita JWT (verify_jwt). Guardamos la intención
    // y mandamos a signup; App.tsx reanuda el checkout tras el SIGNED_IN.
    if (!user) {
      setPendingCheckout({ region: resolvedRegion, cycle });
      openModal('signup');
      return;
    }

    setLoading(true);
    try {
      const url = await createCheckout({ region: resolvedRegion, cycle, locale });
      await openCheckoutUrl(url, () => {
        // Native: al cerrarse el in-app browser, vamos a la pantalla de retorno (que pollea).
        closeModal();
        goTo('checkout');
      });
      // Web: openCheckoutUrl ya navegó fuera. Mantenemos loading hasta que se vaya.
    } catch (e) {
      console.error('[PaymentModal] checkout error:', e instanceof Error ? e.message : e);
      setError(t('checkout.error'));
      setLoading(false);
    }
  }

  return (
    <div className="ov open" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <div className="pay-box">
        <div className="pay-head">
          <div>
            <div className="pay-plan-lbl">Plan seleccionado</div>
            <div className="pay-plan-name">{payInfo.plan}</div>
            <div className="pay-plan-price">{displayPrice}</div>
            <div className="pay-plan-period">{payInfo.period}</div>
          </div>
          <button className="pay-x" onClick={closeModal}>✕</button>
        </div>

        {/* Trial billing summary — claro, sin sorpresas */}
        <div className="pay-trial">
          <div className="pay-trial-row">
            <span className="pay-trial-lbl">Hoy pagas</span>
            <span className="pay-trial-val pay-trial-val-free">{currency ? `${currency.slice(0, 1) === 'E' ? '€' : '$'}0` : '$0'}</span>
          </div>
          <div className="pay-trial-row">
            <span className="pay-trial-lbl">El {billDateLabel} se cobrará</span>
            <span className="pay-trial-val">{amount ? displayPrice : '—'}</span>
          </div>
          <ul className="pay-trial-notes">
            <li>Te enviaremos recordatorio 24h antes del cobro</li>
            <li>Cancela en 1 click desde tu perfil</li>
          </ul>
        </div>

        <div className="pay-body">
          <div className="pay-secure">🔒 {t('checkout.secureNote')}</div>

          {error && (
            <div style={{ color: '#cc3333', fontSize: '.8rem', margin: '4px 0 10px', textAlign: 'center' }}>
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div className="spinner" />
              <div style={{ fontSize: '.8rem', color: 'var(--txt2)' }}>{t('checkout.opening')}</div>
            </div>
          ) : (
            <button className="btn-pay" onClick={handleStartCheckout}>
              🔒 Empezar trial gratis · {displayPrice}/después
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
