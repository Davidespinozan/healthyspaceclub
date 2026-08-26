// AUTH-PROVIDERS · Gate B — botones reutilizables "Continuar con Apple/Google".
// Usados en LoginScreen y en el paso de alta del Onboarding. OAuth es SOLO el
// mecanismo de autenticación: el ruteo posterior (onboarding/paywall/dashboard) lo
// decide App por startDate + subscriptionStatus. El email/contraseña sigue intacto
// como fallback — OAuth nunca es obligatorio.

import { useState } from 'react';
import { signInWithProvider, isProviderEnabled, ENABLED_PROVIDERS, type AuthProvider } from '../utils/authProviders';
import { track } from '../utils/analytics';
import { useT } from '../i18n';
import './auth-provider-buttons.css';

/** Logo oficial de Apple (monocromo, hereda color del botón). */
function AppleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.04c-.03-2.5 2.04-3.7 2.13-3.76-1.16-1.7-2.97-1.93-3.61-1.96-1.54-.16-3 .9-3.78.9-.77 0-1.98-.88-3.25-.86-1.67.02-3.21.97-4.07 2.47-1.73 3-.44 7.45 1.24 9.89.82 1.19 1.8 2.53 3.08 2.48 1.24-.05 1.71-.8 3.21-.8 1.49 0 1.92.8 3.23.77 1.33-.02 2.18-1.21 3-2.41.94-1.38 1.33-2.72 1.35-2.79-.03-.01-2.59-.99-2.62-3.94zM14.6 4.7c.68-.83 1.14-1.98 1.02-3.13-.98.04-2.17.65-2.88 1.48-.63.73-1.19 1.9-1.04 3.02 1.1.09 2.21-.56 2.9-1.37z"/>
    </svg>
  );
}

/** "G" oficial multicolor de Google (marca sin distorsión). */
function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.82-.07-1.6-.2-2.36H12v4.47h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.74z"/>
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.09A12 12 0 0 0 12 24z"/>
      <path fill="#FBBC05" d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.28a12 12 0 0 0 0 10.74l3.99-3.09z"/>
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.23 0 12 0A12 12 0 0 0 1.28 6.63l3.99 3.09C6.22 6.86 8.87 4.75 12 4.75z"/>
    </svg>
  );
}

type Busy = 'none' | AuthProvider;

interface Props {
  /** contexto para etiquetar analytics (login vs signup); no viaja PII. */
  context?: 'login' | 'signup';
}

export default function AuthProviderButtons({ context = 'login' }: Props) {
  const { t } = useT();
  const [busy, setBusy] = useState<Busy>('none');
  const [error, setError] = useState('');

  async function start(provider: AuthProvider) {
    if (busy !== 'none') return; // un click a la vez → deshabilita ambos
    setBusy(provider);
    setError('');
    track('auth_provider_started', { provider, context }); // metadata-only
    const res = await signInWithProvider(provider);
    if (!res.ok) {
      // Fallo inmediato (proveedor deshabilitado, red). En éxito el navegador ya
      // se fue al proveedor y no volvemos aquí.
      track('auth_provider_failed', { provider, reason: res.reason ?? 'unknown' });
      setError(t('auth.providerError', { provider: t(`auth.provider_${provider}`) }));
      setBusy('none');
    }
    // éxito → redirect en curso; dejamos el botón en loading hasta que la página navegue.
  }

  // Si ningún proveedor está habilitado en Supabase, no renderizamos nada (ni el
  // separador) → la pantalla queda solo con email/contraseña, sin UI muerta.
  if (ENABLED_PROVIDERS.length === 0) return null;

  return (
    <div className="apb-wrap">
      {/* Apple: DORMIDO mientras external.apple=false. El código sigue intacto;
          solo no se monta hasta que 'apple' entre en ENABLED_PROVIDERS. */}
      {isProviderEnabled('apple') && (
        <button
          type="button"
          className="apb-btn apb-btn--apple"
          onClick={() => start('apple')}
          disabled={busy !== 'none'}
          aria-busy={busy === 'apple'}
        >
          {busy === 'apple' ? <span className="apb-spinner" /> : <AppleMark />}
          <span>{t('auth.continueApple')}</span>
        </button>
      )}
      {isProviderEnabled('google') && (
        <button
          type="button"
          className="apb-btn apb-btn--google"
          onClick={() => start('google')}
          disabled={busy !== 'none'}
          aria-busy={busy === 'google'}
        >
          {busy === 'google' ? <span className="apb-spinner apb-spinner--dark" /> : <GoogleMark />}
          <span>{t('auth.continueGoogle')}</span>
        </button>
      )}

      {error && <div className="apb-error">{error}</div>}

      <div className="apb-divider"><span>{t('auth.orDivider')}</span></div>
    </div>
  );
}
