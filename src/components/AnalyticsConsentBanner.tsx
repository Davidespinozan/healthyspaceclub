import { useState } from 'react';
import { useAppStore } from '../store';
import { useT } from '../i18n';
import { setAnalyticsConsent, identify } from '../utils/analytics';
import { shouldPromptConsent } from '../utils/analyticsConsent';
import './analytics-consent.css';

// ANALYTICS-1 · P1-A · Banner mínimo de consentimiento de analytics. Aparece SOLO cuando
// el estado es 'unknown' (y sin GPC/DNT). No bloquea el uso de la app. Aceptar/Rechazar
// con el mismo peso visual (sin dark patterns). No escribe copy legal absoluto.
export default function AnalyticsConsentBanner() {
  const { t } = useT();
  // Se evalúa una vez al montar; tras elegir, se oculta con estado local.
  const [dismissed, setDismissed] = useState(false);
  const [prompt] = useState(() => shouldPromptConsent());

  if (dismissed || !prompt) return null;

  const accept = () => {
    setAnalyticsConsent('accepted');
    // Si ya hay sesión, identifica al usuario ACTUAL (autoridad = dataOwnerId del store).
    // identify() se auto-gatea por consentimiento; tras aceptar, ya está permitido.
    try {
      const uid = useAppStore.getState().dataOwnerId;
      if (uid) identify(uid);
    } catch { /* noop */ }
    setDismissed(true);
  };
  const decline = () => { setAnalyticsConsent('declined'); setDismissed(true); };

  return (
    <div className="acb" role="dialog" aria-live="polite" aria-label={t('consent.title')}>
      <div className="acb-body">
        <div className="acb-title">{t('consent.title')}</div>
        <p className="acb-text">{t('consent.body')}</p>
      </div>
      <div className="acb-actions">
        <button type="button" className="acb-btn acb-decline" onClick={decline}>{t('consent.decline')}</button>
        <button type="button" className="acb-btn acb-accept" onClick={accept}>{t('consent.accept')}</button>
      </div>
    </div>
  );
}
