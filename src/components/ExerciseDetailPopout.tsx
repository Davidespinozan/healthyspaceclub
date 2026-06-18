import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Maximize2, Play } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Exercise, ExerciseVideo, Equipment } from '../types';
import { selectVariantForEquipment } from '../utils/workoutPlanner';
import { getExerciseIcon } from '../utils/muscleGroupIcon';
import { useT } from '../i18n';
import { translateMuscle, translateDifficulty } from '../utils/exerciseMeta';
import './exercise-detail-popout.css';

interface Props {
  exercise: Exercise;
  planData: {
    sets: number;
    reps: string;
    rest: number;
    tip_personalizado?: string;
  };
  /** Equipo del usuario. Si se provee y el ejercicio tiene variantes, se muestra la variante específica. */
  userEquipment?: Equipment[];
  onClose: () => void;
}

export default function ExerciseDetailPopout({
  exercise,
  planData,
  userEquipment,
  onClose,
}: Props) {
  const { t } = useT();
  // Variante específica del equipo del usuario (si aplica)
  const variant = userEquipment ? selectVariantForEquipment(exercise, userEquipment) : null;
  const displayName = variant ? `${exercise.name} — ${variant.name}` : exercise.name;
  const [videos, setVideos] = useState<ExerciseVideo[]>(exercise.videos || []);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  // Aspecto real del video (ancho/alto). El hero se adapta para no recortar
  // videos horizontales ni verticales.
  const [videoAspect, setVideoAspect] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Load videos from Supabase if not in bank
  useEffect(() => {
    async function loadVideos() {
      if (exercise.videos && exercise.videos.length > 0) {
        setLoading(false);
        return;
      }
      try {
        // Prefiere el video de la variante específica; si no hay, el del patrón base.
        const ids = variant?.id ? [variant.id, exercise.id] : [exercise.id];
        const { data, error } = await supabase
          .from('exercise_videos')
          .select('exercise_id, video_url, label, display_order')
          .in('exercise_id', ids)
          .order('display_order', { ascending: true });

        if (!error && data && data.length > 0) {
          const varRows = variant?.id ? data.filter(v => v.exercise_id === variant.id) : [];
          const rows = varRows.length > 0 ? varRows : data.filter(v => v.exercise_id === exercise.id);
          setVideos(rows.map(v => ({ url: v.video_url, label: v.label || t('workout.execution') })));
        }
      } catch (e) {
        console.warn('[popout] video fetch failed:', e);
      } finally {
        setLoading(false);
      }
    }
    loadVideos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id, exercise.videos, variant?.id]);

  // Close on ESC + arrow keys
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && activeIdx > 0) setActiveIdx(i => i - 1);
      if (e.key === 'ArrowRight' && activeIdx < videos.length - 1) setActiveIdx(i => i + 1);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, activeIdx, videos.length]);

  // Prevent body scroll when open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Auto-play the active video
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    if (!isPaused) {
      v.play().catch(() => {});
    }
  }, [activeIdx, isPaused]);

  const hasVideos = videos.length > 0;

  // Swipe handlers
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.targetTouches[0].clientX;
    touchEndX.current = null;
  }
  function onTouchMove(e: React.TouchEvent) {
    touchEndX.current = e.targetTouches[0].clientX;
  }
  function onTouchEnd() {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;
    if (diff > threshold && activeIdx < videos.length - 1) {
      setActiveIdx(i => i + 1);
    } else if (diff < -threshold && activeIdx > 0) {
      setActiveIdx(i => i - 1);
    }
    touchStartX.current = null;
    touchEndX.current = null;
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setIsPaused(false);
    } else {
      v.pause();
      setIsPaused(true);
    }
  }

  function requestFullscreen() {
    const v = videoRef.current;
    if (!v) return;
    if (v.requestFullscreen) v.requestFullscreen();
    // @ts-ignore
    else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
  }

  return createPortal(
    <div className="edp-backdrop" onClick={onClose}>
      <div className="edp-modal" onClick={e => e.stopPropagation()}>
        <button className="edp-close" onClick={onClose} aria-label={t('exerciseDetail.close')}>
          <X size={18} />
        </button>

        {/* ── Hero: video carousel or fallback ── */}
        <div
          className="edp-hero"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={videoAspect ? { aspectRatio: String(Math.min(1.9, Math.max(0.5, videoAspect))), maxHeight: 'none' } : undefined}
        >
          {loading ? (
            <div className="edp-hero-placeholder">
              <div className="edp-hero-emoji">
                {(() => { const Ic = getExerciseIcon(exercise); return <Ic size={56} strokeWidth={1.5} />; })()}
              </div>
            </div>
          ) : hasVideos ? (
            <>
              {/* Track with all videos side by side */}
              <div
                ref={trackRef}
                className="edp-track"
                style={{ transform: `translateX(-${activeIdx * 100}%)` }}
              >
                {videos.map((v, i) => (
                  <div key={v.url} className="edp-slide">
                    <video
                      ref={i === activeIdx ? videoRef : null}
                      src={v.url}
                      autoPlay={i === activeIdx}
                      muted
                      loop
                      playsInline
                      className="edp-hero-video"
                      onClick={togglePlay}
                      onLoadedMetadata={e => {
                        const vid = e.currentTarget;
                        if (i === activeIdx && vid.videoWidth && vid.videoHeight) {
                          setVideoAspect(vid.videoWidth / vid.videoHeight);
                        }
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Label badge over video */}
              {videos[activeIdx]?.label && (
                <div className="edp-label-badge">
                  {videos[activeIdx].label}
                </div>
              )}

              {/* Solo expandir (los videos no llevan sonido → sin mute). */}
              <div className="edp-video-controls">
                <button
                  className="edp-vc-btn"
                  onClick={requestFullscreen}
                  aria-label={t('exerciseDetail.fullscreen')}
                >
                  <Maximize2 size={16} />
                </button>
              </div>

              {/* Play/pause indicator (only when paused) */}
              {isPaused && (
                <button
                  className="edp-play-indicator"
                  onClick={togglePlay}
                  aria-label={t('exerciseDetail.play')}
                >
                  <Play size={28} fill="currentColor" />
                </button>
              )}

              {/* Dots pagination */}
              {videos.length > 1 && (
                <div className="edp-dots">
                  {videos.map((_, i) => (
                    <button
                      key={i}
                      className={`edp-dot${i === activeIdx ? ' active' : ''}`}
                      onClick={() => setActiveIdx(i)}
                      aria-label={t('exerciseDetail.goToVideo', { n: i + 1 })}
                    />
                  ))}
                </div>
              )}

              {/* Prev/next arrows (desktop) */}
              {videos.length > 1 && (
                <>
                  {activeIdx > 0 && (
                    <button
                      className="edp-arrow edp-arrow-prev"
                      onClick={() => setActiveIdx(i => i - 1)}
                      aria-label={t('exerciseDetail.prev')}
                    >
                      ‹
                    </button>
                  )}
                  {activeIdx < videos.length - 1 && (
                    <button
                      className="edp-arrow edp-arrow-next"
                      onClick={() => setActiveIdx(i => i + 1)}
                      aria-label={t('exerciseDetail.next')}
                    >
                      ›
                    </button>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="edp-hero-placeholder">
              <div className="edp-hero-emoji">
                {(() => { const Ic = getExerciseIcon(exercise); return <Ic size={56} strokeWidth={1.5} />; })()}
              </div>
              <p className="edp-hero-no-video">{t('workout.videoSoon')}</p>
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div className="edp-body">
          <p className="edp-micro">
            {translateMuscle(exercise.muscleGroup, t)} · {translateDifficulty(exercise.difficulty, t)}
          </p>
          <h2 className="edp-name">{displayName}</h2>
          <p className="edp-desc">{exercise.desc}</p>
          {variant?.notes && (
            <p className="edp-variant-notes">{variant.notes}</p>
          )}

          {/* Stats row */}
          <div className="edp-stats">
            <div className="edp-stat">
              <div className="edp-stat-val">{planData.sets}</div>
              <div className="edp-stat-lbl">{t('workout.setsLower')}</div>
            </div>
            <div className="edp-stat">
              <div className="edp-stat-val">{planData.reps}</div>
              <div className="edp-stat-lbl">{t('workout.repsLower')}</div>
            </div>
            <div className="edp-stat">
              <div className="edp-stat-val">{planData.rest}s</div>
              <div className="edp-stat-lbl">{t('workout.statRest')}</div>
            </div>
          </div>

          {/* Personalized tip */}
          {planData.tip_personalizado && (
            <div className="edp-tip">
              <div className="edp-tip-label">{t('workout.coachSays')}</div>
              <p className="edp-tip-text">{planData.tip_personalizado}</p>
            </div>
          )}

          {/* Pedagogical steps */}
          {exercise.steps && exercise.steps.length > 0 && (
            <div className="edp-steps">
              <div className="edp-steps-label">{t('workout.howToDoIt')}</div>
              {exercise.steps.map((step, i) => (
                <div key={i} className="edp-step">
                  <div className="edp-step-num">{i + 1}</div>
                  <div className="edp-step-body">
                    <div className="edp-step-title">{step.title}</div>
                    <p className="edp-step-desc">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* General tip */}
          {exercise.tip && (
            <div className="edp-general-tip">
              <p className="edp-general-tip-text">💡 {exercise.tip}</p>
            </div>
          )}
        </div>

      </div>
    </div>,
    document.body
  );
}
