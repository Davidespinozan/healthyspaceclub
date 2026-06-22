// Componente reusable: colecta una tarjeta con Stripe Elements (SetupIntent-first).
// Carga Elements + createSetupIntent + <PaymentElement> + elements.submit() +
// confirmSetup (redirect:'if_required', 3DS in-modal) + manejo de errores.
// NO sabe nada del alta (createSubscription/onboarding/2-fases): al confirmar la
// tarjeta llama onPaymentMethod(paymentMethodId) y el caller decide qué hacer.
import { useState, useEffect, useCallback, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { createSetupIntent } from '../utils/stripe';
import { useT } from '../i18n';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string);

const appearance = {
  theme: 'night' as const,
  variables: {
    colorPrimary: '#BFA065',
    colorBackground: '#11201d',
    colorText: '#F6F2EA',
    colorTextSecondary: 'rgba(234,223,198,.6)',
    colorTextPlaceholder: 'rgba(234,223,198,.32)',
    colorDanger: '#ff6b6b',
    fontFamily: 'inherit',
    borderRadius: '12px',
  },
  rules: {
    '.Input': { border: '1.5px solid rgba(255,255,255,.12)', backgroundColor: 'rgba(255,255,255,.04)' },
    '.Input:focus': { border: '1.5px solid #BFA065', boxShadow: 'none' },
    '.Tab': { border: '1px solid rgba(255,255,255,.12)', backgroundColor: 'rgba(255,255,255,.04)' },
    '.Tab--selected': { border: '1.5px solid #BFA065', backgroundColor: 'rgba(191,160,101,.12)' },
  },
};

// Card-only: sin wallets (el SetupIntent ya restringe a ['card']).
const paymentElementOptions = {
  layout: 'tabs' as const,
  wallets: { applePay: 'never' as const, googlePay: 'never' as const },
};

interface Props {
  ctaLabel: string;
  onPaymentMethod: (paymentMethodId: string) => void | Promise<void>;
}

function CollectInner({ clientSecret, ctaLabel, onPaymentMethod }: Props & { clientSecret: string }) {
  const { t } = useT();
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!stripe || !elements) return;
    setProcessing(true);
    setError(null);
    try {
      // Stripe exige elements.submit() ANTES de confirmSetup (primera op async).
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message ?? t('pay.errCard'));
        setProcessing(false);
        return;
      }

      // Confirmar el SetupIntent (card-only → 3DS in-modal, sin redirect).
      const { error: confirmErr, setupIntent } = await stripe.confirmSetup({
        elements,
        clientSecret,
        redirect: 'if_required',
        confirmParams: { return_url: window.location.origin },
      });
      if (confirmErr) {
        setError(confirmErr.message ?? t('pay.errDeclined'));
        setProcessing(false);
        return;
      }

      const pm = setupIntent?.payment_method;
      const paymentMethodId = typeof pm === 'string' ? pm : pm?.id;
      if (!paymentMethodId) {
        setError(t('pay.errConfirm'));
        setProcessing(false);
        return;
      }

      // El caller decide qué hacer con la PM (crear sub, cambiar tarjeta, etc).
      // Si lanza, mostramos el error y dejamos reintentar.
      await onPaymentMethod(paymentMethodId);
      setProcessing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('pay.errProcess'));
      setProcessing(false);
    }
  }

  return (
    <>
      <div className="pay-secure">{t('pay.secure')}</div>
      <PaymentElement options={paymentElementOptions} />
      {error && (
        <div style={{ color: '#cc3333', fontSize: '.8rem', margin: '10px 0', textAlign: 'center' }}>{error}</div>
      )}
      {processing ? (
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div className="spinner" />
          <div style={{ fontSize: '.8rem', color: 'rgba(234,223,198,.55)' }}>{t('pay.processing')}</div>
        </div>
      ) : (
        <button className="btn-pay" onClick={handleConfirm} style={{ marginTop: 14 }}>
          {ctaLabel}
        </button>
      )}
    </>
  );
}

export default function CardCollectForm({ ctaLabel, onPaymentMethod }: Props) {
  const { t } = useT();
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
      setLoadErr(t('pay.errPrepare'));
    }
  }, [t]);

  // SetupIntent una sola vez (StrictMode monta el effect 2 veces; sin guard se crean
  // 2 SetupIntents y el clientSecret cambia tras montar <Elements> → confirmSetup 400).
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchSI();
  }, [fetchSI]);

  if (loadErr) {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <p style={{ color: '#cc3333', marginBottom: 16 }}>{loadErr}</p>
        <button className="btn-pay" onClick={fetchSI}>{t('pay.retry')}</button>
      </div>
    );
  }
  if (!clientSecret) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div className="spinner" />
        <div style={{ fontSize: '.8rem', color: 'rgba(234,223,198,.55)' }}>{t('pay.preparing')}</div>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
      <CollectInner clientSecret={clientSecret} ctaLabel={ctaLabel} onPaymentMethod={onPaymentMethod} />
    </Elements>
  );
}
