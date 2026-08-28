import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { X, Camera, Share2, Loader2 } from 'lucide-react';
import { useT } from '../i18n';
import { useAppStore } from '../store';
import { composeShareImage, shareImage, type ShareStyleName } from '../utils/photoOverlay';
import { buildShareMoments, pickRecommended, type ShareInput, type ShareMoment, type ShareMomentKind, type ShareStyle } from '../utils/shareMoments';
import { profileLink } from '../utils/referral';
import { track } from '../utils/analytics';
import './share-studio.css';

const STYLES: { id: ShareStyle; key: string }[] = [
  { id: 'dark', key: 'sstudio.styleDark' },
  { id: 'editorial', key: 'sstudio.styleEditorial' },
  { id: 'stat', key: 'sstudio.styleStat' },
];

interface Props {
  input: ShareInput;
  preferredKind?: ShareMomentKind;
  onClose: () => void;
}

// SHARE-2 · P0 · Share Studio: preview premium 9:16 INMEDIATO (sin foto), foto opcional,
// 3 estilos, momento seleccionable. WYSIWYG (el mismo canvas que se exporta se previsualiza).
export default function ShareStudio({ input, preferredKind, onClose }: Props) {
  const { t } = useT();
  const username = useAppStore(s => s.username);

  const tf = t as unknown as (k: string, p?: Record<string, string | number>) => string;
  const moments = useMemo(() => buildShareMoments(input, tf), [input, tf]);
  const [moment, setMoment] = useState<ShareMoment | null>(() => pickRecommended(moments, preferredKind));
  const [style, setStyle] = useState<ShareStyleName>((pickRecommended(moments, preferredKind)?.defaultStyle ?? 'dark') as ShareStyleName);
  const [photo, setPhoto] = useState<Blob | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const blobRef = useRef<Blob | null>(null);

  // Escape cierra + foco inicial (a11y).
  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  // Compone (canvas → blob → objectURL) cada vez que cambia momento/estilo/foto. WYSIWYG.
  useEffect(() => {
    if (!moment) return;
    let cancelled = false;
    setBusy(true); setError(null);
    const art = {
      title: moment.title,
      subtitle: moment.subtitle,
      stat: moment.stat,
      brand: 'Healthy Space',
      tagline: t('sstudio.tagline'),
    };
    composeShareImage({ art, style, photo })
      .then(blob => {
        if (cancelled) return;
        blobRef.current = blob;
        setPreviewUrl(old => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob); });
      })
      .catch(() => { if (!cancelled) setError(t('sstudio.exportError')); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [moment, style, photo, t]);

  // Limpia el objectURL al desmontar.
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function onPickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;                 // canceló el picker → se queda en el studio
    setPhoto(file);
  }

  async function doShare() {
    const blob = blobRef.current;
    if (!blob || !moment) return;
    track('shared', { headline: moment.kind });   // SHARE-1: evento existente, sin free-text sensible
    const url = username ? profileLink(username) : window.location.origin;
    const res = await shareImage(blob, t('post.shareText'), url);
    if (res === 'downloaded') setNote(t('post.shareDownloaded'));
  }

  const selectMoment = (m: ShareMoment) => { setMoment(m); setStyle(m.defaultStyle as ShareStyleName); };

  return (
    <div className="ssx-overlay" onClick={onClose}>
      <div
        className="ssx" ref={dialogRef} tabIndex={-1}
        role="dialog" aria-modal="true" aria-label={t('sstudio.title')}
        onClick={e => e.stopPropagation()}
      >
        <button className="ssx-close" onClick={onClose} aria-label={t('common.close')} type="button"><X size={20} /></button>
        <input ref={inputRef} type="file" accept="image/*" className="ssx-file" onChange={onPickPhoto} />

        {moments.length === 0 ? (
          // Sin momento autoritativo → estado vacío honesto (nunca se fabrica un logro).
          <div className="ssx-empty">{t('sstudio.nothing')}</div>
        ) : (
        <>


        {/* PREVIEW 9:16 — inmediato, sin foto requerida */}
        <div className="ssx-preview-wrap" aria-live="polite">
          {previewUrl ? (
            <img className="ssx-preview" src={previewUrl} alt={moment?.title ?? ''} />
          ) : (
            <div className="ssx-preview ssx-preview-empty">{busy ? <Loader2 className="ssx-spin" size={26} /> : null}</div>
          )}
          {busy && previewUrl && <div className="ssx-preview-busy"><Loader2 className="ssx-spin" size={22} /></div>}
        </div>

        {error && <div className="ssx-error">{error}</div>}

        {/* MOMENTO (si hay >1) */}
        {moments.length > 1 && (
          <div className="ssx-strip" role="tablist" aria-label={t('sstudio.moment')}>
            {moments.map(m => (
              <button key={m.id} type="button" role="tab" aria-selected={moment?.id === m.id}
                className={`ssx-chip${moment?.id === m.id ? ' is-active' : ''}`} onClick={() => selectMoment(m)}>
                {m.title}
              </button>
            ))}
          </div>
        )}

        {/* ESTILO */}
        <div className="ssx-strip" role="tablist" aria-label={t('sstudio.style')}>
          {STYLES.map(s => (
            <button key={s.id} type="button" role="tab" aria-selected={style === s.id}
              className={`ssx-chip${style === s.id ? ' is-active' : ''}`} onClick={() => setStyle(s.id)}>
              {tf(s.key)}
            </button>
          ))}
        </div>

        {/* ACCIONES */}
        <div className="ssx-actions">
          <button className="ssx-btn-ghost" type="button" onClick={() => inputRef.current?.click()}>
            <Camera size={16} strokeWidth={2} /> {photo ? t('sstudio.changePhoto') : t('sstudio.addPhoto')}
          </button>
          <button className="ssx-btn-primary" type="button" onClick={doShare} disabled={!previewUrl || busy}>
            <Share2 size={16} strokeWidth={2} /> {t('post.shareCardCta')}
          </button>
        </div>
        {note && <div className="ssx-note">{note}</div>}
        </>
        )}
      </div>
    </div>
  );
}
