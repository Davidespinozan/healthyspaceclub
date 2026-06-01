// Componente reusable: colecta una tarjeta con Stripe Elements (SetupIntent-first).
// Carga Elements + createSetupIntent + <PaymentElement> + elements.submit() +
// confirmSetup (redirect:'if_required', 3DS in-modal) + manejo de errores.
// NO sabe nada del alta (createSubscription/onboarding/2-fases): al confirmar la
// tarjeta llama onPaymentMethod(paymentMethodId) y el caller decide qué hacer.
import { useState, useEffect, useCallback, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { createSetupIntent } from '../utils/stripe';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string);

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
        setError(submitError.message ?? 'Revisá los datos de la tarjeta.');
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

      // El caller decide qué hacer con la PM (crear sub, cambiar tarjeta, etc).
      // Si lanza, mostramos el error y dejamos reintentar.
      await onPaymentMethod(paymentMethodId);
      setProcessing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo procesar la tarjeta. Reintentá.');
      setProcessing(false);
    }
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
          {ctaLabel}
        </button>
      )}
    </>
  );
}

export default function CardCollectForm({ ctaLabel, onPaymentMethod }: Props) {
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
      <CollectInner clientSecret={clientSecret} ctaLabel={ctaLabel} onPaymentMethod={onPaymentMethod} />
    </Elements>
  );
}
