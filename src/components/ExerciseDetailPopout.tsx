import { useEffect, useRef, useState } from 'react';
import { X, Check, RotateCcw, Maximize2, Volume2, VolumeX, Play } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Exercise, ExerciseVideo } from '../types';
import './exercise-detail-popout.css';

interface Props {
  exercise: Exercise;
  planData: {
    sets: number;
    reps: string;
    rest: number;
    tip_personalizado?: string;
  };
  isDone: boolean;
  onToggleDone: () => void;
  onClose: () => void;
}

export default function ExerciseDetailPopout({
  exercise,
  planData,
  isDone,
  onToggleDone,
  onClose,
}: Props) {
  const [videos, setVideos] = useState<ExerciseVideo[]>(exercise.videos || []);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [muted, setMuted] = useState(true);
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
        const { data, error } = await supabase
          .from('exercise_videos')
          .select('video_url, label, display_order')
          .eq('exercise_id', exercise.id)
          .order('display_order', { ascending: true });

        if (!error && data && data.length > 0) {
          setVideos(data.map(v => ({ url: v.video_url, label: v.label || 'Ejecución' })));
        }
      } catch (e) {
        console.warn('[popout] video fetch failed:', e);
      } finally {
        setLoading(false);
      }
    }
    loadVideos();
  }, [exercise.id, exercise.videos]);

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

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  function requestFullscreen() {
    const v = videoRef.current;
    if (!v) return;
    if (v.requestFullscreen) v.requestFullscreen();
    // @ts-ignore
    else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
  }

  return (
    <div className="edp-backdrop" onClick={onClose}>
      <div className="edp-modal" onClick={e => e.stopPropagation()}>
        <button className="edp-close" onClick={onClose} aria-label="Cerrar">
          <X size={18} />
        </button>

        {/* ── Hero: video carousel or fallback ── */}
        <div
          className="edp-hero"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {loading ? (
            <div className="edp-hero-placeholder">
              <div className="edp-hero-emoji">{exercise.emoji}</div>
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
                      muted={muted}
                      loop
                      playsInline
                      className="edp-hero-video"
                      onClick={togglePlay}
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

              {/* Video controls (right side) */}
              <div className="edp-video-controls">
                <button
                  className="edp-vc-btn"
                  onClick={toggleMute}
                  aria-label={muted ? 'Activar sonido' : 'Silenciar'}
                >
                  {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                <button
                  className="edp-vc-btn"
                  onClick={requestFullscreen}
                  aria-label="Pantalla completa"
                >
                  <Maximize2 size={14} />
                </button>
              </div>

              {/* Play/pause indicator (only when paused) */}
              {isPaused && (
                <button
                  className="edp-play-indicator"
                  onClick={togglePlay}
                  aria-label="Reproducir"
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
                      aria-label={`Ir al video ${i + 1}`}
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
                      aria-label="Anterior"
                    >
                      ‹
                    </button>
                  )}
                  {activeIdx < videos.length - 1 && (
                    <button
                      className="edp-arrow edp-arrow-next"
                      onClick={() => setActiveIdx(i => i + 1)}
                      aria-label="Siguiente"
                    >
                      ›
                    </button>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="edp-hero-placeholder">
              <div className="edp-hero-emoji">{exercise.emoji}</div>
              <p className="edp-hero-no-video">Video próximamente</p>
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div className="edp-body">
          <p className="edp-micro">
            {exercise.muscleGroup} · {exercise.difficulty}
          </p>
          <h2 className="edp-name">{exercise.name}</h2>
          <p className="edp-desc">{exercise.desc}</p>

          {/* Stats row */}
          <div className="edp-stats">
            <div className="edp-stat">
              <div className="edp-stat-val">{planData.sets}</div>
              <div className="edp-stat-lbl">series</div>
            </div>
            <div className="edp-stat">
              <div className="edp-stat-val">{planData.reps}</div>
              <div className="edp-stat-lbl">reps</div>
            </div>
            <div className="edp-stat">
              <div className="edp-stat-val">{planData.rest}s</div>
              <div className="edp-stat-lbl">descanso</div>
            </div>
          </div>

          {/* Personalized tip */}
          {planData.tip_personalizado && (
            <div className="edp-tip">
              <div className="edp-tip-label">Tu coach dice</div>
              <p className="edp-tip-text">{planData.tip_personalizado}</p>
            </div>
          )}

          {/* Pedagogical steps */}
          {exercise.steps && exercise.steps.length > 0 && (
            <div className="edp-steps">
              <div className="edp-steps-label">Cómo hacerlo bien</div>
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

        {/* Bottom CTA */}
        <div className="edp-footer">
          <button
            className={`edp-cta${isDone ? ' done' : ''}`}
            onClick={onToggleDone}
          >
            {isDone ? (
              <>
                <RotateCcw size={14} /> Desmarcar
              </>
            ) : (
              <>
                <Check size={14} /> Marcar como hecho
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
