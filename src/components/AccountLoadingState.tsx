// MVP-RESILIENCE-1 · Gate B — pantalla neutral mientras se resuelve el perfil de un
// usuario que vuelve. NUNCA muestra onboarding/paywall/dashboard vacío debajo. Con
// error ofrece "Reintentar"; detecta offline. Reutiliza el lenguaje visual del login.

import { Loader2, RefreshCw } from 'lucide-react';
import { useT } from '../i18n';
import type { ProfileResolution } from '../utils/profileHydration';
import './account-loading-state.css';

export default function AccountLoadingState({
  resolution,
  onRetry,
}: {
  resolution: ProfileResolution;
  onRetry: () => void;
}) {
  const { t } = useT();
  const isError = resolution === 'error';
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;

  return (
    <div className="login-screen">
      <div className="ls-bg" />
      <div className="ls-card als-card">
        <div className="ls-logo">
          <img
            src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/logohscisotipo.webp"
            alt="Healthy Space Club"
          />
        </div>
        {!isError ? (
          <div className="als-body">
            <Loader2 className="als-spin" size={26} strokeWidth={2.2} />
            <p className="als-text">{t('resilience.accountLoading')}</p>
          </div>
        ) : (
          <div className="als-body">
            <p className="als-text">
              {offline ? t('resilience.offlineAccountLoad') : t('resilience.accountLoadError')}
            </p>
            <button className="als-retry" onClick={onRetry} type="button">
              <RefreshCw size={15} strokeWidth={2.2} /> {t('resilience.retry')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
