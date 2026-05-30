import { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { getPriceInfo, formatPrice, type BillingCycle } from '../utils/stripe';

// Pantalla de paywall — destino del gate de suscripción (Stripe-3).
// Full-screen, NO dismissable (sin overlay/X que devuelva a la app).
// Reusa EXACTAMENTE la lógica de precio/ciclo de PaymentModal/LandingScreen (getPriceInfo).
// NOTA: en este paso (3a) nada rutea hacia acá; se conecta en 3b.
export default function PaywallScreen() {
  const openPay = useAppStore(s => s.openPay);
  const logout = useAppStore(s => s.logout);

  const [cycle, setCycle] = useState<BillingCycle>('yearly'); // Anual preseleccionado

  // Precios desde region.ts (vía getPriceInfo) — sin currency arg usa la región detectada.
  const priceInfo = useMemo(() => getPriceInfo(), []);
  const isYearly = cycle === 'yearly';
  const amountSel = isYearly ? priceInfo.yearly : priceInfo.monthly;
  const priceLabel = `${formatPrice(amountSel, priceInfo.currency)} ${priceInfo.currency}`;
  const planName = isYearly ? 'Anual' : 'Mensual';
  const periodLabel = isYearly
    ? `12 meses · ${formatPrice(priceInfo.yearlyMonthly, priceInfo.currency)}/mes`
    : 'Cancela cuando quieras';

  function handleStart() {
    // Mismos args que los CTAs del LandingScreen → abre PaymentModal (fase 2 si hay sesión).
    openPay(planName, priceLabel, periodLabel, amountSel, priceInfo.currency, cycle);
  }

  // Toggle de ciclo (mismo patrón visual que PaymentModal).
  const segBase: React.CSSProperties = {
    flex: 1, padding: '12px 8px', borderRadius: 12, cursor: 'pointer',
    border: '1.5px solid', fontSize: '.9rem', textAlign: 'center', lineHeight: 1.25,
    background: 'transparent', transition: 'all .15s',
  };
  const segOn: React.CSSProperties = { ...segBase, borderColor: 'var(--amber)', background: 'rgba(191,160,101,.14)', color: 'var(--forest)', fontWeight: 600 };
  const segOff: React.CSSProperties = { ...segBase, borderColor: 'rgba(21,51,48,.18)', color: 'var(--txt2)' };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 400, // < 500 (.ov del modal) → el PaymentModal abre por encima
        background: 'var(--sala-bg)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '32px 22px', overflowY: 'auto',
      }}
    >
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: 14 }}>✦</div>
        <h1 style={{ fontSize: '1.6rem', lineHeight: 1.2, color: 'var(--forest)', marginBottom: 10 }}>
          Suscribite para continuar
        </h1>
        <p style={{ color: 'var(--txt2)', fontSize: '.95rem', lineHeight: 1.5, marginBottom: 26 }}>
          Tu espacio en el Club te espera. Elegí tu plan y seguí con tu nutrición,
          tus entrenos y tu coach — sin cortes.
        </p>

        {/* Selector de ciclo */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          <button type="button" style={isYearly ? segOn : segOff} onClick={() => setCycle('yearly')}>
            Anual
            {priceInfo.yearlyDiscount > 0 && (
              <span style={{ display: 'block', fontSize: '.7rem', color: 'var(--amber)', fontWeight: 700 }}>
                Ahorrás {priceInfo.yearlyDiscount}%
              </span>
            )}
          </button>
          <button type="button" style={!isYearly ? segOn : segOff} onClick={() => setCycle('monthly')}>
            Mensual
          </button>
        </div>

        {/* Precio del ciclo seleccionado */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: '1.7rem', fontWeight: 700, color: 'var(--forest)' }}>{priceLabel}</div>
          <div style={{ fontSize: '.8rem', color: 'var(--txt2)' }}>{periodLabel}</div>
        </div>

        <button className="btn-pay" onClick={handleStart} style={{ width: '100%' }}>
          Empezar
        </button>

        <p style={{ fontSize: '.72rem', color: 'var(--txt2)', marginTop: 12 }}>
          Tu prueba de 3 días empieza al confirmar. Cancelás cuando quieras.
        </p>

        <button
          type="button"
          onClick={logout}
          style={{
            marginTop: 28, background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--txt2)', fontSize: '.82rem', textDecoration: 'underline',
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
