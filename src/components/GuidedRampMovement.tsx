// ─────────────────────────────────────────────────────────────────────────────
// F2C-9C.2C · GuidedRampMovement — ejecución GUIADA de las SERIES DE APROXIMACIÓN (fase potentiate del
// warm-up de fuerza). NO es un strength set: sin RIR, sin kg editable, sin "serie efectiva", sin la
// maquinaria de rest del working set, sin LoggedSet, sin ExecutionRole, sin training credit. Camina por
// los RampStep sellados (carga ligera derivada del topKg + reps conservadoras) con CTA + descanso corto
// autocontenido, y al terminar notifica onDone → el warm-up avanza a startExercises(). Puro presentacional:
// recibe la escalera ya construida y el video ya resuelto (mismo exerciseId/variantId del working lift).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { SkipForward, Check } from 'lucide-react';
import type { RampStep } from '../utils/rampPrescription';
import type { TranslationKey } from '../i18n/es';

type TFunc = (key: TranslationKey, params?: Record<string, string | number>) => string;

interface Props {
  phaseLabel: string;
  name: string;
  steps: RampStep[];
  videoUrl: string | null;
  onDone: () => void;   // escalera completa → siguiente fase / working
  onSkip: () => void;   // saltar la escalera entera
  t: TFunc;
}

export default function GuidedRampMovement({ phaseLabel, name, steps, videoUrl, onDone, onSkip, t }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [restLeft, setRestLeft] = useState<number | null>(null);
  const doneRef = useRef(false);
  const step = steps[stepIndex];

  // Descanso corto entre aproximaciones (countdown autocontenido). Al llegar a 0 → siguiente aproximación.
  useEffect(() => {
    if (restLeft == null) return;
    if (restLeft <= 0) { setRestLeft(null); setStepIndex(i => i + 1); return; }
    const id = setTimeout(() => setRestLeft(r => (r == null ? null : Math.max(0, r - 1))), 1000);
    return () => clearTimeout(id);
  }, [restLeft]);

  if (!step) return null; // escalera vacía (no debería ocurrir: el caller solo monta con steps.length > 0)

  const finish = () => { if (!doneRef.current) { doneRef.current = true; onDone(); } };
  const advance = () => {
    if (stepIndex >= steps.length - 1) { finish(); return; }   // última aproximación → a trabajar
    if (step.restSec && step.restSec > 0) setRestLeft(step.restSec);
    else setStepIndex(i => i + 1);
  };

  return (
    <div className="wp-prep-card wp-phase-card">
      <div className="wp-prep-section-label">{phaseLabel} · {stepIndex + 1}/{steps.length}</div>
      <div className="wp-phase-media">
        {videoUrl ? (
          <video className="wp-phase-video" src={videoUrl} autoPlay muted loop playsInline />
        ) : (
          <div className="wp-phase-placeholder">{t('workout.videoSoon')}</div>
        )}
      </div>
      <div className="wp-phase-name">{name}</div>
      {restLeft != null ? (
        <div className="wp-phase-timer" role="timer">{t('workout.phase.rampRest')} {restLeft}s</div>
      ) : (
        <div className="wp-phase-reps">{t('workout.phase.rampSet', { kg: step.kg, reps: step.reps })}</div>
      )}
      <div className="wp-phase-controls">
        <button className="wp-phase-skip" onClick={onSkip}><SkipForward size={16} /> {t('workout.phase.skip')}</button>
        {restLeft == null && (
          <button className="wp-phase-done wp-cta" onClick={advance}><Check size={16} /> {t('workout.phase.done')}</button>
        )}
      </div>
    </div>
  );
}
