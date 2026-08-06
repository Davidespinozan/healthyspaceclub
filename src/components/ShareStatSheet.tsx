import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { X, Camera, Share2, Loader2 } from 'lucide-react';
import { useT } from '../i18n';
import { composeStatPhoto, shareImage } from '../utils/photoOverlay';
import { profileLink } from '../utils/referral';
import { useAppStore } from '../store';
import { track } from '../utils/analytics';
import './share-stat-sheet.css';

// Dominio limpio para el CTA de los píxeles (sin www ni puerto de dev).
const SHARE_HOST = typeof window !== 'undefined' ? window.location.host.replace(/^www\./, '') : 'healthyspaceclub.com';

// Estilo Strava: elige tu foto → le montamos stats + logo → compártela afuera.
interface Props {
  headline: string;                            // "ENTRENÉ HOY"
  stats: { big: string; label: string }[];
  onClose: () => void;
}

export default function ShareStatSheet({ headline, stats, onClose }: Props) {
  const { t } = useT();
  const username = useAppStore(s => s.username);
  const inputRef = useRef<HTMLInputElement>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  // Abre el selector de foto al entrar (una sola vez).
  useEffect(() => { inputRef.current?.click(); }, []);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const out = await composeStatPhoto(file, { brand: 'Healthy Space Club', headline, stats, cta: SHARE_HOST });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setBlob(out);
      setPreviewUrl(URL.createObjectURL(out));
    } catch (err) {
      console.error('[share] compose failed:', err);
    } finally {
      setBusy(false);
    }
  }

  async function doShare() {
    if (!blob) return;
    track('shared', { headline });
    // Comparte con el deep-link a tu perfil (+?ref=) → el que recibe aterriza en tu
    // perfil (contenido real) y queda atribuido. Sin username aún, cae al origin.
    const url = username ? profileLink(username) : window.location.origin;
    const res = await shareImage(blob, t('post.shareText'), url);
    // En escritorio sin Web Share API se descarga la imagen + se copia el link:
    // avisamos para que el usuario no crea que no pasó nada.
    if (res === 'downloaded') setNote(t('post.shareDownloaded'));
  }

  return (
    <div className="sss-overlay" onClick={onClose}>
      <div className="sss" onClick={e => e.stopPropagation()}>
        <button className="sss-close" onClick={onClose} aria-label={t('common.close')}><X size={20} /></button>
        <input ref={inputRef} type="file" accept="image/*" className="sss-input" onChange={onPick} />

        {busy ? (
          <div className="sss-state"><Loader2 className="sss-spin" size={28} strokeWidth={2} /></div>
        ) : previewUrl ? (
          <>
            <img className="sss-preview" src={previewUrl} alt="" />
            <div className="sss-actions">
              <button className="sss-btn-ghost" onClick={() => inputRef.current?.click()}>
                <Camera size={16} strokeWidth={2} /> {t('post.shareChangePhoto')}
              </button>
              <button className="sss-btn-primary" onClick={doShare}>
                <Share2 size={16} strokeWidth={2} /> {t('post.shareCardCta')}
              </button>
            </div>
            {note && <div className="sss-note">{note}</div>}
          </>
        ) : (
          <div className="sss-state sss-empty">
            <p>{t('post.sharePickPrompt')}</p>
            <button className="sss-btn-primary" onClick={() => inputRef.current?.click()}>
              <Camera size={16} strokeWidth={2} /> {t('post.sharePickPhoto')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
