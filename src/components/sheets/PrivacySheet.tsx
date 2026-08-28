import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { PRIVACY_SECTIONS, PRIVACY_LAST_UPDATED, PRIVACY_INTRO, PRIVACY_DISCLAIMER } from '../../content/legal/privacy';
import { useT } from '../../i18n';
import { setAnalyticsConsent, identify } from '../../utils/analytics';
import { readAnalyticsConsent } from '../../utils/analyticsConsent';
import { useAppStore } from '../../store';
import './sheet-base.css';

interface Props {
  onClose: () => void;
}

export default function PrivacySheet({ onClose }: Props) {
  const { t, locale } = useT();
  // ANALYTICS-1 · P1-A · control reversible del consentimiento de analytics.
  const [consent, setConsent] = useState(() => readAnalyticsConsent());
  const analyticsOn = consent === 'accepted';
  const toggleAnalytics = () => {
    const next = analyticsOn ? 'declined' : 'accepted';
    setAnalyticsConsent(next);
    // Al activar con sesión abierta: identifica al usuario ACTUAL (identify se auto-gatea
    // por consentimiento; recién ahora está permitido). Sin backfill de eventos previos.
    if (next === 'accepted') {
      try { const uid = useAppStore.getState().dataOwnerId; if (uid) identify(uid); } catch { /* noop */ }
    }
    setConsent(next);
  };

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

  return createPortal(
    <div className="sh-overlay" onClick={onClose}>
      <div className="sh-sheet" onClick={e => e.stopPropagation()}>
        <div className="sh-handle" />
        <div className="sh-header-row">
          <h1 className="sh-title">{t('legal.privacyTitle')}</h1>
          <button
            className="sh-close"
            onClick={onClose}
            aria-label={t('common.close')}
            type="button"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        {locale === 'en' && (
          <p className="sh-disclaimer" lang="en">{t('legal.onlySpanishNotice')}</p>
        )}
        <p className="sh-intro" lang="es">{PRIVACY_INTRO}</p>

        {/* ANALYTICS-1 · P1-A · control de analítica de producto (reversible) */}
        <div className="sh-analytics">
          <div className="sh-analytics-info">
            <div className="sh-analytics-title">{t('consent.settingsTitle')} · {analyticsOn ? t('consent.settingsOn') : t('consent.settingsOff')}</div>
            <p className="sh-analytics-note">{t('consent.settingsNote')}</p>
          </div>
          <button type="button" className="sh-analytics-btn" onClick={toggleAnalytics}>
            {analyticsOn ? t('consent.settingsDisable') : t('consent.settingsEnable')}
          </button>
        </div>

        <div className="sh-body" lang="es">
          {PRIVACY_SECTIONS.map(section => (
            <section key={section.heading} className="sh-section">
              <h2 className="sh-heading">{section.heading}</h2>
              {section.paragraphs?.map((p, i) => (
                <p key={i} className="sh-p">{p}</p>
              ))}
              {section.bullets && (
                <ul className="sh-list">
                  {section.bullets.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              )}
            </section>
          ))}

          <p className="sh-disclaimer">{PRIVACY_DISCLAIMER}</p>
          <p className="sh-updated">{t('legal.lastUpdated')} {PRIVACY_LAST_UPDATED}</p>
        </div>
      </div>
    </div>,
    document.body
  );
}
