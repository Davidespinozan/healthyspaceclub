import { RefreshCw } from 'lucide-react';
import { useAppStore } from '../store';
import { useT } from '../i18n';
import './update-prompt.css';

/**
 * Banner global "Nueva versión disponible — Recargar". Aparece cuando el service
 * worker detecta un bundle nuevo (registerType:'prompt' en vite.config + el
 * registro en main.tsx). Persistente y SIN dismiss a propósito: forzar la
 * resolución con un tap evita que los usuarios queden corriendo código viejo
 * (el bug de cache que tuvimos). El tap llama triggerUpdate → skipWaiting + reload.
 *
 * Solo relevante en web/PWA instalada. En el build iOS nativo (Capacitor) no hay
 * service worker, así que updateReady nunca se prende y el banner no aparece.
 */
export default function UpdatePrompt() {
  const updateReady = useAppStore((s) => s.updateReady);
  const triggerUpdate = useAppStore((s) => s.triggerUpdate);
  const { t } = useT();

  if (!updateReady) return null;

  // Toda la barra es el botón → target enorme, imposible de fallar el tap.
  // (Antes solo la pastilla chica era clickeable: ~30px, difícil de acertar.)
  return (
    <button
      type="button"
      className="update-prompt"
      onClick={() => triggerUpdate?.()}
      aria-label={`${t('update.title')} — ${t('update.cta')}`}
    >
      <RefreshCw size={16} strokeWidth={2} className="update-prompt-icon" />
      <span className="update-prompt-text">{t('update.title')}</span>
      <span className="update-prompt-cta">{t('update.cta')}</span>
    </button>
  );
}
