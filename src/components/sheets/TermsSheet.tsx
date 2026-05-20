import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TERMS_SECTIONS, TERMS_LAST_UPDATED, TERMS_INTRO, TERMS_DISCLAIMER } from '../../content/legal/terms';
import { useT } from '../../i18n';
import './sheet-base.css';

interface Props {
  onClose: () => void;
}

export default function TermsSheet({ onClose }: Props) {
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
          <h1 className="sh-title">{t('legal.termsTitle')}</h1>
          <button
            className="sh-close"
            onClick={onClose}
            aria-label={t('common.close')}
            type="button"
          >
            ✕
          </button>
        </div>
        {locale === 'en' && (
          <p className="sh-disclaimer" lang="en">{t('legal.onlySpanishNotice')}</p>
        )}
        <p className="sh-intro" lang="es">{TERMS_INTRO}</p>

        <div className="sh-body" lang="es">
          {TERMS_SECTIONS.map(section => (
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

          <p className="sh-disclaimer">{TERMS_DISCLAIMER}</p>
          <p className="sh-updated">{t('legal.lastUpdated')} {TERMS_LAST_UPDATED}</p>
        </div>
      </div>
    </div>,
    document.body
  );
}
