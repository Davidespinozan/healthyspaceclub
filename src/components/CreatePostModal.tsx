import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { Camera, Image as ImageIcon, FileText, X, ArrowLeft } from 'lucide-react';
import { useAppStore } from '../store';
import { useT } from '../i18n';
import { useCurrentUserId } from '../hooks/useCurrentUserId';
import { supabase } from '../lib/supabase';
import { validateMediaFile } from '../utils/mediaValidation';
import { compressImage } from '../utils/imageCompress';
import type { AspectRatio } from '../utils/imageCompress';
import './create-post-modal.css';

/** Contexto opcional cuando se publica DESDE un entreno o una comida. */
export interface PostContext {
  kind?: 'workout' | 'meal' | 'free';
  mealSummary?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onPostCreated?: () => void;
  context?: PostContext;
}

type ModalView = 'choose' | 'cropping' | 'composing' | 'uploading';

const MAX_CAPTION = 150;
const ASPECTS: Record<AspectRatio, number> = { '1:1': 1, '3:4': 3 / 4, '4:3': 4 / 3 };

/**
 * Opciones de aspect ratio que se muestran al user en cropping con label
 * humano. El value es el AspectRatio técnico que se guarda en DB.
 */
interface AspectOption {
  value: AspectRatio;
  label: string;
}

/**
 * Decide qué opciones ofrecer según el aspect natural de la foto:
 *  - vertical (h > w)   → Cuadrado / Vertical
 *  - horizontal (w > h) → Cuadrado / Horizontal
 *  - cuadrada           → solo Cuadrado (no toggle)
 */
function getAvailableAspectOptions(width: number, height: number): AspectOption[] {
  if (width > height) {
    return [
      { value: '1:1',  label: 'Cuadrado' },
      { value: '4:3', label: 'Horizontal' },
    ];
  }
  if (height > width) {
    return [
      { value: '1:1', label: 'Cuadrado' },
      { value: '3:4', label: 'Vertical' },
    ];
  }
  return [{ value: '1:1', label: 'Cuadrado' }];
}

/** Default: respeta la orientación natural de la foto. */
function getDefaultAspect(width: number, height: number): AspectRatio {
  if (width > height) return '4:3';
  if (height > width) return '3:4';
  return '1:1';
}

/** Carga un File como imagen y resuelve sus dimensiones naturales (con EXIF aplicado). */
function loadImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 1080, height: 1080 });
    img.src = url;
  });
}

export default function CreatePostModal({ open, onClose, onPostCreated, context }: Props) {
  const { t } = useT();
  const { userName, streakCount, dailyWorkout } = useAppStore();
  const userId = useCurrentUserId();

  const [userAvatarUrl, setUserAvatarUrl] = useState('');
  const [collab, setCollab] = useState(true);
  const [view, setView] = useState<ModalView>('choose');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [caption, setCaption] = useState('');
  const [availableAspects, setAvailableAspects] = useState<AspectOption[]>([
    { value: '1:1', label: 'Cuadrado' },
    { value: '3:4', label: 'Vertical' },
  ]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const workoutToday = dailyWorkout?.date === today ? (dailyWorkout.plan as Record<string, unknown>) : null;
  const workoutSummary = workoutToday
    ? `${workoutToday.type || t('post.workoutFallback')} · ${workoutToday.duration || ''}`
    : '';

  // ¿El entreno de hoy fue en pareja? → ofrecemos colaborar (estilo Instagram).
  const partner = workoutToday && (workoutToday as { partnerMode?: boolean }).partnerMode
    ? {
        id: (workoutToday as { partnerId?: string | null }).partnerId ?? null,
        name: (workoutToday as { partnerName?: string }).partnerName ?? '',
        avatar: (workoutToday as { partnerAvatar?: string | null }).partnerAvatar ?? '',
      }
    : null;

  // Contexto del post: explícito (entrada desde comida/entreno) o inferido.
  const mealSummary = context?.mealSummary ?? '';
  const postContext: 'workout' | 'meal' | 'free' =
    context?.kind === 'meal' ? 'meal'
    : context?.kind === 'workout' ? 'workout'
    : workoutToday ? 'workout'
    : 'free';

  // El toggle de colab solo aplica a posts de entreno con pareja.
  const canCollab = postContext === 'workout' && !!partner?.id;
  // Tag que se muestra en composición según contexto.
  const contextSummary = postContext === 'meal' ? mealSummary : workoutSummary;

  // ── Fetch avatar para insert ──────────────────────────────
  useEffect(() => {
    if (!open || !userId) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('avatar_url')
          .eq('user_id', userId)
          .single();
        if (data?.avatar_url) setUserAvatarUrl(data.avatar_url);
      } catch (e) { console.warn('[CreatePostModal] avatar fetch failed:', e); }
    })();
  }, [open, userId]);

  // ── Reset state cuando se cierra ──────────────────────────
  useEffect(() => {
    if (open) return;
    setView('choose');
    setImageSrc(null);
    setAspectRatio('1:1');
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setCaption('');
    setUploadError(null);
    setCollab(true);
  }, [open]);

  // ── Body overflow lock + ESC handler ──────────────────────
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleEsc();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, view, caption]);

  function handleEsc() {
    if (view === 'uploading') return;
    if (view === 'composing' && caption.trim().length > 0) return;
    onClose();
  }

  function handleBackdropClick() {
    // Cierra solo si NO hay trabajo en progreso.
    if (view === 'choose') { onClose(); return; }
    if (view === 'composing' && !caption.trim() && !imageSrc) { onClose(); return; }
    // Otros casos: ignorar el tap
  }

  // ── Flujo: elegir fuente ──────────────────────────────────
  function handleTakePhoto() {
    cameraInputRef.current?.click();
  }

  function handleOpenGallery() {
    galleryInputRef.current?.click();
  }

  function handleTextOnly() {
    setImageSrc(null);
    setView('composing');
  }

  /**
   * Handler único para galería y cámara nativa. iOS aplica EXIF correctamente
   * al cargar la imagen con `new Image()`, por eso naturalWidth/naturalHeight
   * ya reflejan la orientación visual real (no la del sensor).
   */
  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset para permitir re-seleccionar la misma foto
    if (!file) return;
    const check = validateMediaFile(file, false);
    if (!check.valid) { alert(t(check.errorKey!, check.errorParams)); return; }
    const url = URL.createObjectURL(file);
    const { width, height } = await loadImageDimensions(url);
    setImageSrc(url);
    setAvailableAspects(getAvailableAspectOptions(width, height));
    setAspectRatio(getDefaultAspect(width, height));
    setCroppedAreaPixels(null);
    setView('cropping');
  }

  // ── Crop callbacks ────────────────────────────────────────
  const onCropComplete = useCallback((_area: Area, areaPx: Area) => {
    setCroppedAreaPixels(areaPx);
  }, []);

  function handleCropConfirm() {
    setView('composing');
  }

  function handleCropBack() {
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    setImageSrc(null);
    setCroppedAreaPixels(null);
    setView('choose');
  }

  function handleComposingBack() {
    setUploadError(null);
    if (imageSrc) {
      setView('cropping');
      return;
    }
    setView('choose');
  }

  // ── Submit ────────────────────────────────────────────────
  async function handleSubmit() {
    if (view === 'uploading') return;
    setUploadError(null);
    setView('uploading');

    let photoUrl = '';
    let imageError: string | null = null;

    if (imageSrc && croppedAreaPixels) {
      try {
        const res = await fetch(imageSrc);
        const blobIn = await res.blob();
        const file = new File([blobIn], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const compressed = await compressImage(file, {
          aspectRatio,
          cropPixels: croppedAreaPixels,
        });
        const path = `${userId}_${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage.from('club').upload(path, compressed, {
          contentType: 'image/jpeg',
        });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from('club').getPublicUrl(path);
        photoUrl = data.publicUrl;
      } catch (e) {
        imageError = extractErrorMessage(e, t('post.unknownError'));
        console.error('[CreatePostModal] upload failed:', e);
      }
    }

    // Si es colab, resolvemos el @username actual del coautor (display name no sirve).
    const isCollabPost = canCollab && collab;
    let coUsername = '';
    if (isCollabPost && partner?.id) {
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('username')
          .eq('user_id', partner.id)
          .single();
        coUsername = data?.username || partner.name || '';
      } catch { coUsername = partner.name || ''; }
    }

    try {
      const { error: insertErr } = await supabase.from('club_posts').insert({
        user_id: userId,
        username: userName || t('common.anonymous'),
        avatar_url: userAvatarUrl,
        streak: streakCount,
        workout_summary: postContext === 'workout' ? workoutSummary : '',
        meal_summary: postContext === 'meal' ? mealSummary : '',
        post_context: postContext,
        coauthor_id: isCollabPost ? partner!.id : null,
        coauthor_username: isCollabPost ? coUsername : '',
        coauthor_avatar_url: isCollabPost ? (partner!.avatar || '') : '',
        photo_url: photoUrl,
        text: caption.trim().slice(0, MAX_CAPTION),
        fire_count: 0,
        aspect_ratio: aspectRatio,
      });
      if (insertErr) throw insertErr;
      if (imageError) alert(t('post.imageUploadFailed', { error: imageError }));
      onPostCreated?.();
      onClose();
    } catch (e) {
      setUploadError(extractErrorMessage(e, t('post.unknownError')));
      setView('composing');
    }
  }

  if (!open) return null;

  // ── Render ────────────────────────────────────────────────
  return createPortal(
    <div
      className={`cpm-backdrop cpm-view-${view}`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div className="cpm-sheet" onClick={e => e.stopPropagation()}>
        {/* Inputs hidden — uno para cámara nativa, otro para galería */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={handleImageFile}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleImageFile}
        />

        {view === 'choose' && (
          <ChooseView
            onTakePhoto={handleTakePhoto}
            onGallery={handleOpenGallery}
            onTextOnly={handleTextOnly}
            onClose={onClose}
          />
        )}

        {view === 'cropping' && imageSrc && (
          <CroppingView
            imageSrc={imageSrc}
            aspectRatio={aspectRatio}
            availableAspects={availableAspects}
            onAspectChange={setAspectRatio}
            crop={crop}
            zoom={zoom}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            onConfirm={handleCropConfirm}
            onBack={handleCropBack}
          />
        )}

        {view === 'composing' && (
          <ComposingView
            imageSrc={imageSrc}
            aspectRatio={aspectRatio}
            caption={caption}
            onCaptionChange={setCaption}
            workoutSummary={contextSummary}
            canCollab={canCollab}
            collab={collab}
            onCollabChange={setCollab}
            partnerName={partner?.name ?? ''}
            onSubmit={handleSubmit}
            onBack={handleComposingBack}
            uploadError={uploadError}
          />
        )}

        {view === 'uploading' && (
          <UploadingView />
        )}
      </div>
    </div>,
    document.body,
  );
}

// ══════════════════════════════════════════════════════════════
// VIEW: choose
// ══════════════════════════════════════════════════════════════
function ChooseView({
  onTakePhoto, onGallery, onTextOnly, onClose,
}: {
  onTakePhoto: () => void;
  onGallery: () => void;
  onTextOnly: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  return (
    <div className="cpm-choose">
      <header className="cpm-choose-head">
        <button type="button" className="cpm-close" onClick={onClose} aria-label={t('common.close')}>
          <X size={20} />
        </button>
        <h1 className="cpm-choose-title">{t('post.newPost')}</h1>
        <span className="cpm-choose-spacer" />
      </header>
      <div className="cpm-choose-options">
        <button type="button" className="cpm-choose-option cpm-choose-option--primary" onClick={onTakePhoto}>
          <Camera size={22} strokeWidth={1.6} />
          <span>{t('post.takePhoto')}</span>
        </button>
        <button type="button" className="cpm-choose-option" onClick={onGallery}>
          <ImageIcon size={22} strokeWidth={1.6} />
          <span>{t('post.fromGallery')}</span>
        </button>
        <button type="button" className="cpm-choose-option" onClick={onTextOnly}>
          <FileText size={22} strokeWidth={1.6} />
          <span>{t('post.textOnly')}</span>
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// VIEW: cropping
// ══════════════════════════════════════════════════════════════
function CroppingView({
  imageSrc, aspectRatio, availableAspects, onAspectChange, crop, zoom, onCropChange, onZoomChange, onCropComplete, onConfirm, onBack,
}: {
  imageSrc: string;
  aspectRatio: AspectRatio;
  availableAspects: AspectOption[];
  onAspectChange: (a: AspectRatio) => void;
  crop: { x: number; y: number };
  zoom: number;
  onCropChange: (c: { x: number; y: number }) => void;
  onZoomChange: (z: number) => void;
  onCropComplete: (area: Area, pixels: Area) => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const { t } = useT();
  const aspectKey = (v: AspectRatio) =>
    v === '1:1' ? 'post.aspectSquare' as const
    : v === '4:3' ? 'post.aspectHorizontal' as const
    : 'post.aspectVertical' as const;
  return (
    <div className="cpm-cropping">
      <header className="cpm-cropping-head">
        <button type="button" className="cpm-icon-btn" onClick={onBack} aria-label={t('common.back')}>
          <ArrowLeft size={20} />
        </button>
        <h2 className="cpm-cropping-title">{t('post.crop')}</h2>
        <button type="button" className="cpm-done-btn" onClick={onConfirm}>
          {t('common.done')}
        </button>
      </header>

      <div className="cpm-cropper">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={ASPECTS[aspectRatio]}
          onCropChange={onCropChange}
          onZoomChange={onZoomChange}
          onCropComplete={onCropComplete}
          showGrid
          objectFit="contain"
        />
        {availableAspects.length > 1 && (
          <div className="cpm-aspect-pill" role="tablist" aria-label={t('post.aspectAria')}>
            {availableAspects.map(opt => (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={aspectRatio === opt.value}
                className={`cpm-aspect-tab${aspectRatio === opt.value ? ' is-active' : ''}`}
                onClick={() => onAspectChange(opt.value)}
              >
                {t(aspectKey(opt.value))}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// VIEW: composing
// ══════════════════════════════════════════════════════════════
function ComposingView({
  imageSrc, aspectRatio, caption, onCaptionChange, workoutSummary,
  canCollab, collab, onCollabChange, partnerName,
  onSubmit, onBack, uploadError,
}: {
  imageSrc: string | null;
  aspectRatio: AspectRatio;
  caption: string;
  onCaptionChange: (s: string) => void;
  workoutSummary: string;
  canCollab: boolean;
  collab: boolean;
  onCollabChange: (v: boolean) => void;
  partnerName: string;
  onSubmit: () => void;
  onBack: () => void;
  uploadError: string | null;
}) {
  const { t } = useT();
  const remaining = MAX_CAPTION - caption.length;
  const isNearLimit = remaining <= 20;
  return (
    <div className="cpm-composing">
      <header className="cpm-composing-head">
        <button type="button" className="cpm-icon-btn" onClick={onBack} aria-label={t('common.back')}>
          <ArrowLeft size={20} />
        </button>
        <h2 className="cpm-composing-title">{t('post.compose')}</h2>
        <span className="cpm-choose-spacer" />
      </header>

      <div className="cpm-composing-body">
        {imageSrc && (
          <div className="cpm-composing-preview" data-aspect={aspectRatio}>
            <img src={imageSrc} alt="" />
          </div>
        )}

        <textarea
          className="cpm-composing-input"
          placeholder={t('post.captionPlaceholder')}
          maxLength={MAX_CAPTION}
          value={caption}
          onChange={e => onCaptionChange(e.target.value)}
          autoFocus={!imageSrc}
        />

        <div className="cpm-composing-meta">
          <span className={`cpm-composing-count${isNearLimit ? ' is-near' : ''}`}>
            {caption.length}/{MAX_CAPTION}
          </span>
          {workoutSummary && <span className="cpm-composing-chip">{workoutSummary}</span>}
        </div>

        {canCollab && (
          <button
            type="button"
            className={`cpm-collab${collab ? ' is-on' : ''}`}
            onClick={() => onCollabChange(!collab)}
            aria-pressed={collab}
          >
            <span className="cpm-collab-main">
              <span className="cpm-collab-label">{t('post.collabToggle', { name: partnerName })}</span>
              <span className="cpm-collab-hint">{t('post.collabHint')}</span>
            </span>
            <span className={`cpm-collab-switch${collab ? ' is-on' : ''}`}><span className="cpm-collab-knob" /></span>
          </button>
        )}

        {uploadError && <p className="cpm-composing-error">{t('post.publishError', { error: uploadError })}</p>}
      </div>

      <footer className="cpm-composing-foot">
        <button
          type="button"
          className="cpm-btn-primary"
          onClick={onSubmit}
          disabled={!caption.trim() && !imageSrc}
        >
          {t('post.publish')}
        </button>
      </footer>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// VIEW: uploading
// ══════════════════════════════════════════════════════════════
function UploadingView() {
  const { t } = useT();
  return (
    <div className="cpm-uploading">
      <div className="cpm-spinner" />
      <p className="cpm-uploading-text">{t('post.publishing')}</p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Helper
// ══════════════════════════════════════════════════════════════
function extractErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object') {
    const obj = e as Record<string, unknown>;
    if (typeof obj.message === 'string' && obj.message.length > 0) {
      const parts: string[] = [obj.message];
      if (typeof obj.code === 'string' && obj.code.length > 0) parts.push(`(code: ${obj.code})`);
      if (typeof obj.hint === 'string' && obj.hint.length > 0) parts.push(`hint: ${obj.hint}`);
      return parts.join(' ');
    }
  }
  return fallback;
}
