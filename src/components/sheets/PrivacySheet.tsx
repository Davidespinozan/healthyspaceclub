import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { PRIVACY_SECTIONS, PRIVACY_LAST_UPDATED, PRIVACY_INTRO, PRIVACY_DISCLAIMER } from '../../content/legal/privacy';
import { useT } from '../../i18n';
import './sheet-base.css';

interface Props {
  onClose: () => void;
}

export default function PrivacySheet({ onClose }: Props) {
  const { t, locale } = useT();

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
