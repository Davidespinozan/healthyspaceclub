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
const ASPECTS: Record<AspectRatio, number> = { '1:1': 1, '4:5': 4 / 5, '16:9': 16 / 9 };

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
      { value: '16:9', label: 'Horizontal' },
    ];
  }
  if (height > width) {
    return [
      { value: '1:1', label: 'Cuadrado' },
      { value: '4:5', label: 'Vertical' },
    ];
  }
  return [{ value: '1:1', label: 'Cuadrado' }];
}

/** Default: respeta la orientación natural de la foto. */
function getDefaultAspect(width: number, height: number): AspectRatio {
  if (width > height) return '16:9';
  if (height > width) return '4:5';
  return '1:1';
}

/** Carga un File como imagen y resuelve sus dimensiones naturales. */
function loadImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 1080, height: 1080 });
    img.src = url;
  });
}

/**
 * Orientación física del device en el momento del capture. matchMedia es más
 * confiable que screen.orientation en iOS Safari (especialmente en PWA standalone).
 */
function getDeviceOrientation(): 'portrait' | 'landscape' {
  if (typeof window === 'undefined') return 'portrait';
  return window.matchMedia('(orientation: landscape)').matches ? 'landscape' : 'portrait';
}

/**
 * Dibuja el video al canvas aplicando rotación (si device está landscape) y
 * mirror (si es cámara frontal). Las dimensiones del canvas resultante reflejan
 * la orientación VISUAL correcta — no la nativa del sensor.
 *
 * iOS Safari devuelve el stream en la orientación nativa del sensor (portrait
 * = 1080×1920). Si el user está sosteniendo el celu landscape, sin rotar el
 * canvas, el frame guardado quedaría vertical y getAvailableAspectOptions
 * lo detectaría mal como vertical.
 */
function drawVideoToCanvas(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  orientation: 'portrait' | 'landscape',
  mirror: boolean,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const vw = video.videoWidth;
  const vh = video.videoHeight;

  if (orientation === 'landscape') {
    // Swap dims para que el canvas refleje el aspect visual (landscape).
    canvas.width = vh;
    canvas.height = vw;
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(Math.PI / 2); // 90° clockwise
    if (mirror) ctx.scale(-1, 1);
    ctx.drawImage(video, -vw / 2, -vh / 2);
    ctx.restore();
  } else {
    canvas.width = vw;
    canvas.height = vh;
    if (mirror) {
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(video, 0, 0);
    }
  }
}

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
  const [availableAspects, setAvailableAspects] = useState<AspectOption[]>([
    { value: '1:1', label: 'Cuadrado' },
    { value: '4:5', label: 'Vertical' },
  ]);
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
      // Constraints mínimas: dejar que iOS/Android decidan la mejor orientación
      // y dimensiones del stream según el device. Sesgar con ideal width/height
      // forzaba portrait artificial que descuadraba el stage.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
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

  async function handleGalleryFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const check = validateMediaFile(file, false);
    if (!check.valid) { alert(check.error); return; }
    const url = URL.createObjectURL(file);
    const { width, height } = await loadImageDimensions(url);
    setImageSrc(url);
    setAvailableAspects(getAvailableAspectOptions(width, height));
    setAspectRatio(getDefaultAspect(width, height));
    setCroppedAreaPixels(null);
    setPhotoSource('gallery');
    setView('cropping');
  }

  async function handleCaptureFile(e: React.ChangeEvent<HTMLInputElement>) {
    // Fallback nativo (sin getUserMedia): se trata como galería con detection.
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const check = validateMediaFile(file, false);
    if (!check.valid) { alert(check.error); return; }
    const url = URL.createObjectURL(file);
    const { width, height } = await loadImageDimensions(url);
    setImageSrc(url);
    setAvailableAspects(getAvailableAspectOptions(width, height));
    setAspectRatio(getDefaultAspect(width, height));
    setCroppedAreaPixels(null);
    setPhotoSource('gallery');
    setView('cropping');
  }

  // ── Capture frame del video → detecta aspect → cropping (ajustable) ──
  async function handleCaptureFrame() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    const orientation = getDeviceOrientation();
    const mirror = cameraFacing === 'user';
    // El helper ajusta canvas.width/height y aplica rotación + mirror según
    // corresponda. iOS Safari devuelve el stream con orientación nativa del
    // sensor; en landscape hay que rotar 90° para que el canvas refleje
    // el aspect visual real.
    drawVideoToCanvas(video, canvas, orientation, mirror);

    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
    if (!blob) return;
    const url = URL.createObjectURL(blob);

    setImageSrc(url);
    setAvailableAspects(getAvailableAspectOptions(canvas.width, canvas.height));
    setAspectRatio(getDefaultAspect(canvas.width, canvas.height));
    setCroppedAreaPixels(null);
    setPhotoSource('camera');
    setView('cropping');
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
    // Descartar foto y volver al paso anterior según source.
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    setImageSrc(null);
    setCroppedAreaPixels(null);
    if (photoSource === 'camera') {
      // Re-disparar cámara, mantenemos photoSource='camera' para próxima captura
      setView('capturing');
    } else {
      setPhotoSource(null);
      setView('choose');
    }
  }

  function handleComposingBack() {
    setUploadError(null);
    if (imageSrc) {
      // Ambos paths (camera y gallery) pasan por cropping ahora
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
        aspect_ratio: aspectRatio,
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
            onCapture={handleCaptureFrame}
            onSwapCamera={handleSwapCamera}
            onClose={handleClose}
            cameraError={cameraError}
            cameraFacing={cameraFacing}
            onOpenGallery={handleOpenGallery}
            onBack={() => setView('choose')}
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
  videoRef, onCapture, onSwapCamera, onClose, cameraError, cameraFacing, onOpenGallery, onBack,
}: {
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  onCapture: () => void;
  onSwapCamera: () => void;
  onClose: () => void;
  cameraError: CameraError;
  cameraFacing: 'user' | 'environment';
  onOpenGallery: () => void;
  onBack: () => void;
}) {
  return (
    <div className="cpm-capturing">
      <header className="cpm-capturing-head">
        <button type="button" className="cpm-icon-btn" onClick={onBack} aria-label="Volver">
          <ArrowLeft size={20} />
        </button>
        <span className="cpm-icon-btn cpm-icon-btn--placeholder" aria-hidden="true" />
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
          <video
            ref={videoRef}
            className={`cpm-video${cameraFacing === 'user' ? ' cpm-video--mirror' : ''}`}
            playsInline
            muted
            autoPlay
          />
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
        {availableAspects.length > 1 && (
          <div className="cpm-aspect-pill" role="tablist" aria-label="Formato de la foto">
            {availableAspects.map(opt => (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={aspectRatio === opt.value}
                className={`cpm-aspect-tab${aspectRatio === opt.value ? ' is-active' : ''}`}
                onClick={() => onAspectChange(opt.value)}
              >
                {opt.label}
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
          <div className="cpm-composing-preview" data-aspect={aspectRatio}>
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
