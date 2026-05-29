// Pantalla de retorno del checkout de Stripe.
// Web: se llega por pathname (/checkout/success | /checkout/cancel) — App.tsx
//      detecta el path y setea currentScreen='checkout'.
// Native: el in-app browser no navega el webview; al cerrarse, PaymentModal nos
//      manda acá en modo "success-poll". Además re-chequeamos en App resume.
//
// El webhook de Stripe puede tardar en actualizar user_profiles, así que
// polleamos getSubscription hasta que el status sea 'trial'/'pro'.
import { useEffect, useRef, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAppStore } from '../store';
import { useT } from '../i18n';
import { fetchSubscriptionStatus } from '../utils/stripe';

type Phase = 'polling' | 'success' | 'slow' | 'cancel';

const MAX_ATTEMPTS = 10;
const INTERVAL_MS = 2000;

function isCancelReturn(): boolean {
  return typeof window !== 'undefined' && window.location.pathname.includes('/checkout/cancel');
}

export default function CheckoutReturnScreen() {
  const { t } = useT();
  const goTo = useAppStore(s => s.goTo);
  const startDate = useAppStore(s => s.startDate);
  const [phase, setPhase] = useState<Phase>(() => (isCancelReturn() ? 'cancel' : 'polling'));
  const runningRef = useRef(false);
  const mountedRef = useRef(true);

  const runPolling = useCallback(async () => {
    if (runningRef.current) return;          // evita pollers concurrentes (mount + resume)
    runningRef.current = true;
    setPhase('polling');
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      if (!mountedRef.current) { runningRef.current = false; return; }
      try {
        const s = await fetchSubscriptionStatus();
        if (s.subscription_status === 'trial' || s.subscription_status === 'pro') {
          useAppStore.setState({
            userPlan: s.subscription_status,
            trialEndsAt: s.subscription_status === 'trial'
              ? s.subscription_period_end
              : useAppStore.getState().trialEndsAt,
          });
          if (mountedRef.current) setPhase('success');
          runningRef.current = false;
          return;
        }
      } catch {
        // seguimos reintentando — el webhook puede no haber llegado aún
      }
      if (i < MAX_ATTEMPTS - 1) await new Promise(r => setTimeout(r, INTERVAL_MS));
    }
    if (mountedRef.current) setPhase('slow');  // no es error duro
    runningRef.current = false;
  }, []);

  // Arranca el polling al montar (salvo cancel).
  useEffect(() => {
    mountedRef.current = true;
    if (!isCancelReturn()) runPolling();
    return () => { mountedRef.current = false; };
  }, [runPolling]);

  // Native: re-chequear cuando la app vuelve a primer plano (resume).
  useEffect(() => {
    if (Capacitor.getPlatform() === 'web') return;
    let remove: (() => void) | undefined;
    (async () => {
      const { App } = await import('@capacitor/app');
      const sub = await App.addListener('appStateChange', ({ isActive }) => {
        // Si ya está en success, runPolling sale temprano (guard + status ya activo).
        if (isActive && !isCancelReturn()) runPolling();
      });
      remove = () => sub.remove();
    })();
    return () => { remove?.(); };
  }, [runPolling]);

  function goToApp() {
    if (typeof window !== 'undefined') window.history.replaceState(null, '', '/');
    goTo(startDate ? 'dashboard' : 'onboarding');
  }

  function goBack() {
    if (typeof window !== 'undefined') window.history.replaceState(null, '', '/');
    goTo(startDate ? 'dashboard' : 'landing');
  }

  return (
    <div className="screen active" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', padding: '24px' }}>
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        {phase === 'polling' && (
          <>
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <h1 style={{ fontSize: '1.3rem', marginBottom: 8 }}>{t('checkout.activating')}</h1>
            <p style={{ color: 'var(--txt2)' }}>{t('checkout.activatingSub')}</p>
          </>
        )}

        {phase === 'success' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>✅</div>
            <h1 style={{ fontSize: '1.4rem', marginBottom: 8 }}>{t('checkout.successTitle')}</h1>
            <p style={{ color: 'var(--txt2)', marginBottom: 24 }}>{t('checkout.successSub')}</p>
            <button className="btn-pay" onClick={goToApp}>{t('checkout.goToApp')}</button>
          </>
        )}

        {phase === 'slow' && (
          <>
            <div style={{ fontSize: '2.6rem', marginBottom: 12 }}>⏳</div>
            <h1 style={{ fontSize: '1.3rem', marginBottom: 8 }}>{t('checkout.slowTitle')}</h1>
            <p style={{ color: 'var(--txt2)', marginBottom: 24 }}>{t('checkout.slowSub')}</p>
            <button className="btn-pay" onClick={runPolling}>{t('checkout.retry')}</button>
            <div style={{ marginTop: 12 }}>
              <button className="signup-tos-link" onClick={goToApp}>{t('checkout.goToApp')}</button>
            </div>
          </>
        )}

        {phase === 'cancel' && (
          <>
            <div style={{ fontSize: '2.6rem', marginBottom: 12 }}>↩️</div>
            <h1 style={{ fontSize: '1.3rem', marginBottom: 8 }}>{t('checkout.cancelTitle')}</h1>
            <p style={{ color: 'var(--txt2)', marginBottom: 24 }}>{t('checkout.cancelSub')}</p>
            <button className="btn-pay" onClick={goBack}>{t('checkout.back')}</button>
          </>
        )}
      </div>
    </div>
  );
}
