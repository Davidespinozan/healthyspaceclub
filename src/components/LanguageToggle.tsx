import { useAppStore } from '../store';
import { useT } from '../i18n';
import './language-toggle.css';

/**
 * Toggle de idioma ES | EN para las pantallas de entrada (landing, paywall,
 * onboarding, login). Permite al usuario cambiar el idioma ANTES de comprar,
 * por si el auto-detect (navigator.language) eligió mal — ej. un hispanohablante
 * con el teléfono en inglés. setLanguage marca languageSetByUser=true, así que
 * la elección persiste y el bootstrap ya no la pisa. Códigos ES/EN universales,
 * no requieren traducción. `className` permite ajustar posicionamiento por pantalla.
 */
export default function LanguageToggle({ className = '' }: { className?: string }) {
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const { t } = useT();

  return (
    <div className={`lang-toggle ${className}`.trim()} role="group" aria-label={t('settings.language')}>
      <button
        type="button"
        className={`lang-toggle-btn${language === 'es' ? ' is-active' : ''}`}
        onClick={() => setLanguage('es')}
        aria-pressed={language === 'es'}
      >
        ES
      </button>
      <button
        type="button"
        className={`lang-toggle-btn${language === 'en' ? ' is-active' : ''}`}
        onClick={() => setLanguage('en')}
        aria-pressed={language === 'en'}
      >
        EN
      </button>
    </div>
  );
}
