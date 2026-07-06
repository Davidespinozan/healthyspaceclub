import { useState, useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { useAppStore } from '../store';
import { useT } from '../i18n';
import { getPriceInfo, formatPrice, type BillingCycle } from '../utils/stripe';
import LanguageToggle from '../components/LanguageToggle';
import './paywall.css';

// Pantalla de paywall — destino del gate de suscripción (Stripe-3).
// Full-screen, NO dismissable (sin overlay/X que devuelva a la app).
// Reusa EXACTAMENTE la lógica de precio/ciclo de PaymentModal/LandingScreen (getPriceInfo).
// NOTA: en este paso (3a) nada rutea hacia acá; se conecta en 3b.
export default function PaywallScreen() {
  const { t } = useT();
  const openPay = useAppStore(s => s.openPay);
  const logout = useAppStore(s => s.logout);

  const [cycle, setCycle] = useState<BillingCycle>('yearly'); // Anual preseleccionado

  // Precios desde region.ts (vía getPriceInfo) — sin currency arg usa la región detectada.
  const priceInfo = useMemo(() => getPriceInfo(), []);
  const isYearly = cycle === 'yearly';
  const amountSel = isYearly ? priceInfo.yearly : priceInfo.monthly;
  const priceLabel = `${formatPrice(amountSel, priceInfo.currency)} ${priceInfo.currency}`;
  const planName = isYearly ? t('paywall.cycleYearly') : t('paywall.cycleMonthly');
  const periodLabel = isYearly
    ? t('paywall.yearlyPeriod', { monthly: formatPrice(priceInfo.yearlyMonthly, priceInfo.currency) })
    : t('paywall.monthlyPeriod');

  function handleStart() {
    // Mismos args que los CTAs del LandingScreen → abre PaymentModal (fase 2 si hay sesión).
    openPay(planName, priceLabel, periodLabel, amountSel, priceInfo.currency, cycle);
  }

  return (
    <div className="pw-pilot">
      <LanguageToggle className="lang-toggle--corner-left" />
      <div className="pw-card">
        <div className="pw-mark"><Sparkles size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden="true" /></div>
        <h1 className="pw-title">{t('paywall.title')}</h1>
        <p className="pw-body">{t('paywall.body')}</p>

        {/* Selector de ciclo */}
        <div className="pw-seg" role="group" aria-label={t('paywall.cycleYearly')}>
          <button
            type="button"
            className={`pw-seg-btn${isYearly ? ' on' : ''}`}
            onClick={() => setCycle('yearly')}
            aria-pressed={isYearly}
          >
            {t('paywall.cycleYearly')}
            {priceInfo.yearlyDiscount > 0 && (
              <span className="pw-seg-save">{t('paywall.save', { pct: priceInfo.yearlyDiscount })}</span>
            )}
          </button>
          <button
            type="button"
            className={`pw-seg-btn${!isYearly ? ' on' : ''}`}
            onClick={() => setCycle('monthly')}
            aria-pressed={!isYearly}
          >
            {t('paywall.cycleMonthly')}
          </button>
        </div>

        {/* Precio del ciclo seleccionado */}
        <div className="pw-price">
          <div className="pw-price-amount">{priceLabel}</div>
          <div className="pw-price-period">{periodLabel}</div>
        </div>

        <button className="pw-cta" onClick={handleStart}>
          {t('paywall.start')}
        </button>

        <p className="pw-trial">{t('paywall.trialNote')}</p>

        <button type="button" className="pw-logout" onClick={logout}>
          {t('paywall.logout')}
        </button>
      </div>
    </div>
  );
}
