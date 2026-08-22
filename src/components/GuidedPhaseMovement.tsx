// ─────────────────────────────────────────────────────────────────────────────
// F2C-9C.2B.1 · GuidedPhaseMovement — ejecución GUIADA de un movimiento de fase (raise/mobilise/
// activate). NO es un strength set: sin kg, sin RIR, sin rest, sin editor, sin LoggedSet, sin
// ExecutionRole, sin training credit. time = countdown propio; reps = conteo guiado. Timer autocontenido
// (no acopla al hold timer de fuerza ni a cardioMain). Puro presentacional: recibe la prescripción
// sellada y notifica onDone/onSkip. El video ya viene resuelto por el padre (mismo resolver).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { SkipForward, Check, Pause, Play } from 'lucide-react';
import type { PhaseMovementPrescription } from '../utils/warmupSelection';
import type { TranslationKey } from '../i18n/es';

type TFunc = (key: TranslationKey, params?: Record<string, string | number>) => string;

interface Props {
  phaseLabel: string;
  name: string;
  note?: string;
  prescription: PhaseMovementPrescription;
  videoUrl: string | null;
  index: number;      // 0-based
  total: number;
  onDone: () => void;
  onSkip: () => void;
  t: TFunc;
}

export default function GuidedPhaseMovement({ phaseLabel, name, note, prescription, videoUrl, index, total, onDone, onSkip, t }: Props) {
  const isTime = prescription.kind === 'time';
  const [remaining, setRemaining] = useState(() => (isTime ? prescription.seconds : 0));
  const [paused, setPaused] = useState(false);
  const doneRef = useRef(false);

  // Countdown autocontenido (solo para 'time'). Al llegar a 0 → onDone una sola vez.
  useEffect(() => {
    if (!isTime || paused) return;
    if (remaining <= 0) { if (!doneRef.current) { doneRef.current = true; onDone(); } return; }
    const id = setTimeout(() => setRemaining(r => Math.max(0, r - 1)), 1000);
    return () => clearTimeout(id);
  }, [isTime, paused, remaining, onDone]);

  const repsLabel = prescription.kind === 'reps'
    ? (prescription.perSide ? t('workout.phase.repsPerSide', { n: prescription.reps }) : t('workout.phase.reps', { n: prescription.reps }))
    : '';

  return (
    <div className="wp-prep-card wp-phase-card">
      <div className="wp-prep-section-label">{phaseLabel} · {index + 1}/{total}</div>
      <div className="wp-phase-media">
        {videoUrl ? (
          <video className="wp-phase-video" src={videoUrl} autoPlay muted loop playsInline />
        ) : (
          <div className="wp-phase-placeholder">{t('workout.videoSoon')}</div>
        )}
      </div>
      <div className="wp-phase-name">{name}</div>
      {note && <div className="wp-phase-note">{note}</div>}
      {isTime ? (
        <div className="wp-phase-timer" role="timer">{remaining}s</div>
      ) : (
        <div className="wp-phase-reps">{repsLabel}</div>
      )}
      <div className="wp-phase-controls">
        <button className="wp-phase-skip" onClick={onSkip}><SkipForward size={16} /> {t('workout.phase.skip')}</button>
        {isTime && (
          <button className="wp-phase-pause" onClick={() => setPaused(p => !p)}>
            {paused ? <Play size={16} /> : <Pause size={16} />}
          </button>
        )}
        <button className="wp-phase-done wp-cta" onClick={onDone}><Check size={16} /> {t('workout.phase.done')}</button>
      </div>
    </div>
  );
}
