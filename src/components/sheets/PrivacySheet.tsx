import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PRIVACY_SECTIONS, PRIVACY_LAST_UPDATED, PRIVACY_INTRO, PRIVACY_DISCLAIMER } from '../../content/legal/privacy';
import './sheet-base.css';

interface Props {
  onClose: () => void;
}

export default function PrivacySheet({ onClose }: Props) {
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
        <button
          className="sh-close"
          onClick={onClose}
          aria-label="Cerrar"
          type="button"
        >
          ✕
        </button>

        <h1 className="sh-title">Política de Privacidad</h1>
        <p className="sh-intro">{PRIVACY_INTRO}</p>

        <div className="sh-body">
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
          <p className="sh-updated">Última actualización: {PRIVACY_LAST_UPDATED}</p>
        </div>
      </div>
    </div>,
    document.body
  );
}
