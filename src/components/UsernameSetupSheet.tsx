// Fase 1A · Identidad social — sheet para elegir @usuario.
//
// Contextual y pre-sugerido: aparece la primera vez que el usuario toca una
// función social sin tener handle. El @usuario viene pre-llenado desde su nombre
// (un tap para confirmar, o lo edita). Chequeo de disponibilidad en vivo + claim
// atómico vía RPC. Usa el shell visual compartido .th-popout-*.

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AtSign, Check, Loader2, X } from 'lucide-react';
import { useAppStore } from '../store';
import { useT } from '../i18n';
import {
  suggestUsername,
  isValidUsernameFormat,
  checkUsernameAvailable,
  claimUsername,
} from '../utils/username';
import './username-setup.css';

interface Props {
  /** Se dispara tras reclamar el handle con éxito. */
  onDone: () => void;
  onClose: () => void;
}

type Status = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export default function UsernameSetupSheet({ onDone, onClose }: Props) {
  const { t } = useT();
  const userName = useAppStore(s => s.userName);
  const setUsername = useAppStore(s => s.setUsername);

  const [handle, setHandle] = useState(() => suggestUsername(userName));
  const [status, setStatus] = useState<Status>('idle');
  const [submitting, setSubmitting] = useState(false);

  // Chequeo de disponibilidad debounced (400ms tras dejar de teclear).
  useEffect(() => {
    const h = handle.trim().toLowerCase();
    if (!isValidUsernameFormat(h)) {
      setStatus('invalid');
      return;
    }
    setStatus('checking');
    const id = setTimeout(async () => {
      const ok = await checkUsernameAvailable(h);
      setStatus(prev => (prev === 'checking' ? (ok ? 'available' : 'taken') : prev));
    }, 400);
    return () => clearTimeout(id);
  }, [handle]);

  async function handleConfirm() {
    if (status !== 'available' || submitting) return;
    setSubmitting(true);
    const res = await claimUsername(handle.trim().toLowerCase());
    setSubmitting(false);
    if (res === 'ok') {
      setUsername(handle.trim().toLowerCase());
      onDone();
    } else if (res === 'taken') {
      setStatus('taken');
    } else if (res === 'invalid') {
      setStatus('invalid');
    } else {
      alert(t('username.error'));
    }
  }

  return createPortal(
    <div className="th-popout-backdrop" onClick={onClose}>
      <div className="th-popout th-popout-sm" onClick={e => e.stopPropagation()}>
        <div className="th-popout-handle" />
        <div className="th-popout-content">
          <div className="th-popout-time">{t('username.eyebrow')}</div>
          <div className="th-popout-name">{t('username.title')}</div>
          <p className="usn-sub">{t('username.sub')}</p>

          <div className={`usn-field usn-field--${status}`}>
            <span className="usn-at"><AtSign size={18} strokeWidth={2} /></span>
            <input
              className="usn-input"
              value={handle}
              autoFocus
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={20}
              onChange={e => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            />
            <span className="usn-status">
              {status === 'checking' && <Loader2 size={16} className="usn-spin" />}
              {status === 'available' && <Check size={16} className="usn-ok" />}
              {(status === 'taken' || status === 'invalid') && <X size={16} className="usn-bad" />}
            </span>
          </div>

          <p className={`usn-msg usn-msg--${status}`}>
            {status === 'available' && t('username.available')}
            {status === 'taken' && t('username.taken')}
            {status === 'invalid' && t('username.invalid')}
            {status === 'checking' && t('username.checking')}
            {status === 'idle' && t('username.hint')}
          </p>

          <div className="th-popout-footer">
            <button
              type="button"
              className="usn-confirm"
              disabled={status !== 'available' || submitting}
              onClick={handleConfirm}
            >
              {submitting ? t('username.saving') : t('username.confirm')}
            </button>
            <button type="button" className="th-popout-close" onClick={onClose}>
              {t('common.back')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
