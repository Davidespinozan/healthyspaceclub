import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { Camera, Image as ImageIcon, FileText, X, RotateCw, ArrowLeft } from 'lucide-react';
import { useAppStore } from '../store';
import { useCurrentUserId } from '../hooks/useCurrentUserId';
import { supabase } from '../lib/supabase';
import { validateMediaFile } from '../utils/mediaValidation';
import { compressImage } from '../utils/imageCompress';
import type { AspectRatio } from '../utils/imageCompress';
import './create-post-modal.css';

interface Props {
  open: boolean;
  onClose: () => void;
  onPostCreated?: () => void;
}

type ModalView = 'choose' | 'capturing' | 'cropping' | 'composing' | 'uploading';
type CameraError = 'denied' | 'no_camera' | 'busy' | 'unknown' | null;
type PhotoSource = 'camera' | 'gallery' | null;

const MAX_CAPTION = 150;
const ASPECTS: Record<AspectRatio, number> = { '1:1': 1, '4:5': 4 / 5 };

export default function CreatePostModal({ open, onClose, onPostCreated }: Props) {
  const { userName, streakCount, dailyWorkout } = useAppStore();
  const userId = useCurrentUserId();

  const [userAvatarUrl, setUserAvatarUrl] = useState('');
  const [view, setView] = useState<ModalView>('choose');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [photoSource, setPhotoSource] = useState<PhotoSource>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [caption, setCaption] = useState('');
  const [cameraError, setCameraError] = useState<CameraError>(null);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('environment');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const captureInputRef = useRef<HTMLInputElement | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const workoutToday = dailyWorkout?.date === today ? (dailyWorkout.plan as Record<string, unknown>) : null;
  const workoutSummary = workoutToday
    ? `${workoutToday.type || 'Entrenamiento'} · ${workoutToday.duration || ''}`
    : '';

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
    setPhotoSource(null);
    setAspectRatio('1:1');
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setCaption('');
    setCameraError(null);
    setUploadError(null);
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

  // ── Stream lifecycle: arrancar/parar cámara según view ───
  useEffect(() => {
    if (view !== 'capturing') {
      stopStream();
      return;
    }
    startCamera(cameraFacing);
    return () => { stopStream(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, cameraFacing]);

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  async function startCamera(facing: 'user' | 'environment') {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      // Sin support: silenciosamente fallback al input file con capture
      captureInputRef.current?.click();
      setView('choose');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1920 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => { /* autoplay puede ser bloqueado, ignorar */ });
      }
    } catch (e) {
      const err = e as DOMException;
      if (err.name === 'NotAllowedError' || err.name === 'SecurityError') setCameraError('denied');
      else if (err.name === 'NotFoundError') setCameraError('no_camera');
      else if (err.name === 'NotReadableError') setCameraError('busy');
      else setCameraError('unknown');
    }
  }

  function handleEsc() {
    if (view === 'uploading') return;
    if (view === 'composing' && caption.trim().length > 0) return;
    handleClose();
  }

  function handleClose() {
    stopStream();
    onClose();
  }

  function handleBackdropClick() {
    // Cierra solo si NO hay trabajo en progreso.
    if (view === 'choose') { handleClose(); return; }
    if (view === 'composing' && !caption.trim() && !imageSrc) { handleClose(); return; }
    // Otros casos: ignorar el tap
  }

  // ── Flujo: elegir fuente ──────────────────────────────────
  function handleTakePhoto() {
    if (!navigator.mediaDevices?.getUserMedia) {
      captureInputRef.current?.click();
      return;
    }
    setView('capturing');
  }

  function handleOpenGallery() {
    fileInputRef.current?.click();
  }

  function handleTextOnly() {
    setImageSrc(null);
    setView('composing');
  }

  function handleGalleryFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const check = validateMediaFile(file, false);
    if (!check.valid) { alert(check.error); return; }
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    setPhotoSource('gallery');
    setView('cropping');
  }

  function handleCaptureFile(e: React.ChangeEvent<HTMLInputElement>) {
    // Fallback nativo (sin getUserMedia): se trata como galería — necesita revisión en cropping.
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const check = validateMediaFile(file, false);
    if (!check.valid) { alert(check.error); return; }
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    setPhotoSource('gallery');
    setView('cropping');
  }

  // ── Capture frame del video con center-crop al aspect elegido → composing ──
  async function handleCaptureFrame() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
    if (!blob) return;
    const url = URL.createObjectURL(blob);

    // Center-crop al aspect elegido en 'capturing'
    const targetAspect = ASPECTS[aspectRatio]; // 1 o 4/5
    const srcAspect = canvas.width / canvas.height;
    let cropW = canvas.width;
    let cropH = canvas.height;
    if (srcAspect > targetAspect) {
      cropW = canvas.height * targetAspect;
    } else {
      cropH = canvas.width / targetAspect;
    }
    const cropX = (canvas.width - cropW) / 2;
    const cropY = (canvas.height - cropH) / 2;

    setImageSrc(url);
    setCroppedAreaPixels({ x: cropX, y: cropY, width: cropW, height: cropH });
    setPhotoSource('camera');
    setView('composing'); // SKIP cropping — el user ya encuadró en capturing
  }

  function handleSwapCamera() {
    setCameraFacing(prev => (prev === 'environment' ? 'user' : 'environment'));
  }

  // ── Crop callbacks ────────────────────────────────────────
  const onCropComplete = useCallback((_area: Area, areaPx: Area) => {
    setCroppedAreaPixels(areaPx);
  }, []);

  function handleCropConfirm() {
    setView('composing');
  }

  function handleCropBack() {
    // Cropping solo se alcanza desde galería: volver siempre al choose.
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    setImageSrc(null);
    setCroppedAreaPixels(null);
    setPhotoSource(null);
    setView('choose');
  }

  function handleComposingBack() {
    setUploadError(null);
    if (photoSource === 'camera') {
      // Cámara in-app: descartar foto y volver a re-disparar
      if (imageSrc) URL.revokeObjectURL(imageSrc);
      setImageSrc(null);
      setCroppedAreaPixels(null);
      setView('capturing');
      return;
    }
    if (photoSource === 'gallery' && imageSrc) {
      // Galería: volver a ajustar el crop (mantiene imageSrc y crop pixels)
      setView('cropping');
      return;
    }
    // Solo-texto o sin foto: volver al choose
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
        // Reconstruir File desde imageSrc (puede ser blob: o data:)
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
        imageError = extractErrorMessage(e);
        console.error('[CreatePostModal] upload failed:', e);
      }
    }

    try {
      const { error: insertErr } = await supabase.from('club_posts').insert({
        user_id: userId,
        username: userName || 'Anónimo',
        avatar_url: userAvatarUrl,
        streak: streakCount,
        workout_summary: workoutSummary,
        photo_url: photoUrl,
        text: caption.trim().slice(0, MAX_CAPTION),
        fire_count: 0,
      });
      if (insertErr) throw insertErr;
      if (imageError) alert(`Publicado, pero la imagen no se pudo subir: ${imageError}`);
      onPostCreated?.();
      handleClose();
    } catch (e) {
      setUploadError(extractErrorMessage(e));
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
        {/* Hidden inputs siempre presentes */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleGalleryFile}
        />
        <input
          ref={captureInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={handleCaptureFile}
        />

        {view === 'choose' && (
          <ChooseView
            onTakePhoto={handleTakePhoto}
            onGallery={handleOpenGallery}
            onTextOnly={handleTextOnly}
            onClose={handleClose}
          />
        )}

        {view === 'capturing' && (
          <CapturingView
            videoRef={videoRef}
            aspectRatio={aspectRatio}
            onAspectChange={setAspectRatio}
            onCapture={handleCaptureFrame}
            onSwapCamera={handleSwapCamera}
            onClose={handleClose}
            cameraError={cameraError}
            onOpenGallery={handleOpenGallery}
            onBack={() => setView('choose')}
          />
        )}

        {view === 'cropping' && imageSrc && (
          <CroppingView
            imageSrc={imageSrc}
            aspectRatio={aspectRatio}
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
            workoutSummary={workoutSummary}
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
  return (
    <div className="cpm-choose">
      <header className="cpm-choose-head">
        <button type="button" className="cpm-close" onClick={onClose} aria-label="Cerrar">
          <X size={20} />
        </button>
        <h1 className="cpm-choose-title">Nueva publicación</h1>
        <span className="cpm-choose-spacer" />
      </header>
      <div className="cpm-choose-options">
        <button type="button" className="cpm-choose-option cpm-choose-option--primary" onClick={onTakePhoto}>
          <Camera size={22} strokeWidth={1.6} />
          <span>Tomar foto</span>
        </button>
        <button type="button" className="cpm-choose-option" onClick={onGallery}>
          <ImageIcon size={22} strokeWidth={1.6} />
          <span>Subir de galería</span>
        </button>
        <button type="button" className="cpm-choose-option" onClick={onTextOnly}>
          <FileText size={22} strokeWidth={1.6} />
          <span>Solo texto</span>
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// VIEW: capturing
// ══════════════════════════════════════════════════════════════
function CapturingView({
  videoRef, aspectRatio, onAspectChange, onCapture, onSwapCamera, onClose, cameraError, onOpenGallery, onBack,
}: {
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  aspectRatio: AspectRatio;
  onAspectChange: (a: AspectRatio) => void;
  onCapture: () => void;
  onSwapCamera: () => void;
  onClose: () => void;
  cameraError: CameraError;
  onOpenGallery: () => void;
  onBack: () => void;
}) {
  return (
    <div className="cpm-capturing">
      <header className="cpm-capturing-head">
        <button type="button" className="cpm-icon-btn" onClick={onBack} aria-label="Volver">
          <ArrowLeft size={20} />
        </button>
        <div className="cpm-aspect-toggle" role="tablist" aria-label="Aspect ratio">
          {(['1:1', '4:5'] as AspectRatio[]).map(a => (
            <button
              key={a}
              type="button"
              role="tab"
              aria-selected={aspectRatio === a}
              className={`cpm-aspect-tab${aspectRatio === a ? ' is-active' : ''}`}
              onClick={() => onAspectChange(a)}
            >
              {a}
            </button>
          ))}
        </div>
        <button type="button" className="cpm-icon-btn" onClick={onClose} aria-label="Cerrar">
          <X size={20} />
        </button>
      </header>

      <div className="cpm-capturing-stage">
        {cameraError ? (
          <div className="cpm-camera-error">
            <Camera size={36} strokeWidth={1.5} className="cpm-camera-error-icon" />
            <p className="cpm-camera-error-title">Sin acceso a la cámara</p>
            <p className="cpm-camera-error-sub">
              Activalo desde los ajustes del navegador,<br />o elegí una foto de tu galería.
            </p>
            <div className="cpm-camera-error-actions">
              <button type="button" className="cpm-btn-primary" onClick={onOpenGallery}>
                Abrir galería
              </button>
              <button type="button" className="cpm-btn-ghost" onClick={onBack}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="cpm-video"
              playsInline
              muted
              autoPlay
              data-aspect={aspectRatio}
            />
            <div className={`cpm-aspect-overlay cpm-aspect-overlay--${aspectRatio === '1:1' ? 'sq' : 'tall'}`} />
          </>
        )}
      </div>

      {!cameraError && (
        <footer className="cpm-capturing-foot">
          <button type="button" className="cpm-icon-btn" onClick={onSwapCamera} aria-label="Cambiar cámara">
            <RotateCw size={20} />
          </button>
          <button
            type="button"
            className="cpm-capture-btn"
            onClick={onCapture}
            aria-label="Capturar foto"
          />
          <span className="cpm-icon-btn cpm-icon-btn--placeholder" aria-hidden="true" />
        </footer>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// VIEW: cropping
// ══════════════════════════════════════════════════════════════
function CroppingView({
  imageSrc, aspectRatio, onAspectChange, crop, zoom, onCropChange, onZoomChange, onCropComplete, onConfirm, onBack,
}: {
  imageSrc: string;
  aspectRatio: AspectRatio;
  onAspectChange: (a: AspectRatio) => void;
  crop: { x: number; y: number };
  zoom: number;
  onCropChange: (c: { x: number; y: number }) => void;
  onZoomChange: (z: number) => void;
  onCropComplete: (area: Area, pixels: Area) => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <div className="cpm-cropping">
      <header className="cpm-cropping-head">
        <button type="button" className="cpm-icon-btn" onClick={onBack} aria-label="Volver">
          <ArrowLeft size={20} />
        </button>
        <h2 className="cpm-cropping-title">Recortar</h2>
        <button type="button" className="cpm-done-btn" onClick={onConfirm}>
          Listo
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
        <div className="cpm-aspect-pill" role="tablist" aria-label="Aspect ratio">
          {(['1:1', '4:5'] as AspectRatio[]).map(a => (
            <button
              key={a}
              type="button"
              role="tab"
              aria-selected={aspectRatio === a}
              className={`cpm-aspect-tab${aspectRatio === a ? ' is-active' : ''}`}
              onClick={() => onAspectChange(a)}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// VIEW: composing
// ══════════════════════════════════════════════════════════════
function ComposingView({
  imageSrc, aspectRatio, caption, onCaptionChange, workoutSummary, onSubmit, onBack, uploadError,
}: {
  imageSrc: string | null;
  aspectRatio: AspectRatio;
  caption: string;
  onCaptionChange: (s: string) => void;
  workoutSummary: string;
  onSubmit: () => void;
  onBack: () => void;
  uploadError: string | null;
}) {
  const remaining = MAX_CAPTION - caption.length;
  const isNearLimit = remaining <= 20;
  return (
    <div className="cpm-composing">
      <header className="cpm-composing-head">
        <button type="button" className="cpm-icon-btn" onClick={onBack} aria-label="Volver">
          <ArrowLeft size={20} />
        </button>
        <h2 className="cpm-composing-title">Componer</h2>
        <span className="cpm-choose-spacer" />
      </header>

      <div className="cpm-composing-body">
        {imageSrc && (
          <div className={`cpm-composing-preview cpm-composing-preview--${aspectRatio === '1:1' ? 'sq' : 'tall'}`}>
            <img src={imageSrc} alt="" />
          </div>
        )}

        <textarea
          className="cpm-composing-input"
          placeholder="¿Cómo te fue hoy?"
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

        {uploadError && <p className="cpm-composing-error">No se pudo publicar: {uploadError}</p>}
      </div>

      <footer className="cpm-composing-foot">
        <button
          type="button"
          className="cpm-btn-primary"
          onClick={onSubmit}
          disabled={!caption.trim() && !imageSrc}
        >
          Publicar
        </button>
      </footer>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// VIEW: uploading
// ══════════════════════════════════════════════════════════════
function UploadingView() {
  return (
    <div className="cpm-uploading">
      <div className="cpm-spinner" />
      <p className="cpm-uploading-text">Publicando…</p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Helper
// ══════════════════════════════════════════════════════════════
function extractErrorMessage(e: unknown): string {
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
  return 'Error desconocido';
}
