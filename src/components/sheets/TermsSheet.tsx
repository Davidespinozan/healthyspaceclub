import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TERMS_SECTIONS, TERMS_LAST_UPDATED, TERMS_INTRO, TERMS_DISCLAIMER } from '../../content/legal/terms';
import './sheet-base.css';

interface Props {
  onClose: () => void;
}

export default function TermsSheet({ onClose }: Props) {
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

        <h1 className="sh-title">Términos de Servicio</h1>
        <p className="sh-intro">{TERMS_INTRO}</p>

        <div className="sh-body">
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
          <p className="sh-updated">Última actualización: {TERMS_LAST_UPDATED}</p>
        </div>
      </div>
    </div>,
    document.body
  );
}
