// ACCOUNT-DELETE-1 · Gate B — modal de confirmación destructiva.
// Requiere escribir el token (ELIMINAR/DELETE) antes de habilitar el botón. Estados:
// idle → deleting → error. Éxito ⇒ el server ya borró (autoridad) ⇒ recarga limpia a
// landing (storage ya purgado por deleteMyAccount). Fallo ⇒ NO purga, sigue logueado.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle } from 'lucide-react';
import { deleteMyAccount, type DeleteAccountReason } from '../utils/deleteAccount';
import { useT } from '../i18n';
import './delete-account-modal.css';

export default function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const token = t('deleteAccount.confirmToken');
  const [typed, setTyped] = useState('');
  const [state, setState] = useState<'idle' | 'deleting' | 'error'>('idle');
  const [reason, setReason] = useState<DeleteAccountReason | null>(null);

  const matches = typed.trim().toUpperCase() === token.toUpperCase(); // case-insensitive
  const busy = state === 'deleting';

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && !busy) onClose(); }
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [onClose, busy]);

  async function handleDelete() {
    if (!matches || busy) return; // guard: token + anti doble-submit
    setState('deleting');
    setReason(null);
    const res = await deleteMyAccount();
    if (res.ok) {
      // Éxito server-authoritative: recarga limpia (storage ya purgado + signOut hecho).
      window.location.replace('/');
      return;
    }
    setReason(res.reason);
    setState('error');
  }

  const errorCopy = reason === 'support' ? t('deleteAccount.errorSupport') : t('deleteAccount.errorGeneric');

  return createPortal(
    <div className="dam-backdrop" onClick={() => { if (!busy) onClose(); }}>
      <div className="dam-modal" onClick={e => e.stopPropagation()}>
        <button className="dam-close" onClick={onClose} disabled={busy} aria-label={t('common.close')} type="button">
          <X size={18} />
        </button>
        <div className="dam-icon"><AlertTriangle size={26} strokeWidth={2} /></div>
        <h2 className="dam-title">{t('deleteAccount.title')}</h2>
        <p className="dam-body">{t('deleteAccount.body')}</p>

        <label className="dam-label">{t('deleteAccount.typePrompt')}</label>
        <input
          className="dam-input"
          value={typed}
          onChange={e => setTyped(e.target.value)}
          placeholder={token}
          autoCapitalize="characters"
          autoComplete="off"
          disabled={busy}
        />

        {state === 'error' && <p className="dam-error">{errorCopy}</p>}

        <div className="dam-actions">
          <button className="dam-cancel" onClick={onClose} disabled={busy} type="button">
            {t('common.cancel')}
          </button>
          <button className="dam-delete" onClick={handleDelete} disabled={!matches || busy} type="button">
            {busy ? t('deleteAccount.deleting') : t('deleteAccount.confirmButton')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
