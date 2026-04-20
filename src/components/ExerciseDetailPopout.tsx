import { useEffect, useState } from 'react';
import { X, Check, RotateCcw } from 'lucide-react';
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
  const [activeVideoIdx, setActiveVideoIdx] = useState(0);
  const [loading, setLoading] = useState(true);

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

  // Close on ESC
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const hasVideos = videos.length > 0;
  const activeVideo = hasVideos ? videos[activeVideoIdx] : null;

  return (
    <div className="edp-backdrop" onClick={onClose}>
      <div className="edp-modal" onClick={e => e.stopPropagation()}>
        <button className="edp-close" onClick={onClose} aria-label="Cerrar">
          <X size={18} />
        </button>

        {/* Video or emoji hero */}
        <div className="edp-hero">
          {loading ? (
            <div className="edp-hero-placeholder">
              <div className="edp-hero-emoji">{exercise.emoji}</div>
            </div>
          ) : hasVideos ? (
            <video
              key={activeVideo?.url}
              src={activeVideo?.url}
              controls
              playsInline
              className="edp-hero-video"
            />
          ) : (
            <div className="edp-hero-placeholder">
              <div className="edp-hero-emoji">{exercise.emoji}</div>
              <p className="edp-hero-no-video">Video próximamente</p>
            </div>
          )}
        </div>

        {/* Video tabs */}
        {videos.length > 1 && (
          <div className="edp-tabs">
            {videos.map((v, i) => (
              <button
                key={i}
                className={`edp-tab${activeVideoIdx === i ? ' on' : ''}`}
                onClick={() => setActiveVideoIdx(i)}
              >
                {v.label || `Variación ${i + 1}`}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
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
