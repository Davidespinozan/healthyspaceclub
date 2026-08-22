// ─────────────────────────────────────────────────────────────────────────────
// F2C-9C.2B.2 · CooldownOverlay — vuelta a la calma EJECUTABLE POST-SELLO, a nivel WorkoutPlan
// (NO es un PlayerPhase: el WorkoutPlayer se desmonta al sellar). La sesión de trabajo YA está
// guardada (local + outbox) ANTES de montar este overlay → cero riesgo de pérdida. Cooldown es
// RECUPERACIÓN OPCIONAL: skippable, no ejecuta completion, no LoggedSet, no ExecutionRole, no
// training credit (nunca entra a exercises[]/CompletedSession). Reusa GuidedPhaseMovement (9C.2B.1).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import GuidedPhaseMovement from './GuidedPhaseMovement';
import type { Exercise, Equipment } from '../types';
import type { CachedWorkout } from '../utils/workoutCache';
import { exerciseVideoCandidateIds, pickExerciseVideo } from '../utils/workoutPlanner';
import { supabase } from '../lib/supabase';
import { useT } from '../i18n';

type CooldownBlock = NonNullable<CachedWorkout['cooldownBlock']>;
type Movement = CooldownBlock['movements'][number] & { prescription: NonNullable<CooldownBlock['movements'][number]['prescription']> };

interface Props {
  block: CooldownBlock;
  exerciseBank: Exercise[];
  equipment: Equipment[];
  onClose: () => void;
}

export default function CooldownOverlay({ block, exerciseBank, equipment, onClose }: Props) {
  const { t } = useT();
  // Solo movimientos EJECUTABLES (con prescription); si ninguno → el overlay ni se abre (guard del caller).
  const movements = useMemo(
    () => block.movements.filter((m): m is Movement => !!m.prescription),
    [block],
  );
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const exerciseMap = useMemo(() => new Map(exerciseBank.map(e => [e.id, e])), [exerciseBank]);

  const cur = started ? movements[index] : undefined;

  // Video del movimiento en curso (MISMO resolver que el player). Graceful en miss (placeholder).
  useEffect(() => {
    let active = true;
    setVideoUrl(null);
    if (!cur) return;
    const bank = exerciseMap.get(cur.exerciseId);
    const inline = (bank?.videos as { url: string }[] | undefined)?.[0]?.url;
    if (inline) { setVideoUrl(inline); return; }
    (async () => {
      try {
        const ids = bank ? exerciseVideoCandidateIds(bank, equipment) : [cur.exerciseId];
        const { data } = await supabase.from('exercise_videos').select('exercise_id, video_url, display_order').in('exercise_id', ids).order('display_order', { ascending: true });
        if (!active || !data || data.length === 0) return;
        const byId: Record<string, string> = {};
        for (const r of data as { exercise_id: string; video_url: string }[]) if (!byId[r.exercise_id]) byId[r.exercise_id] = r.video_url;
        const url = (cur.variantId && byId[cur.variantId]) || pickExerciseVideo(ids, byId);
        if (url) setVideoUrl(url);
      } catch { /* noop */ }
    })();
    return () => { active = false; };
  }, [cur?.exerciseId, cur?.variantId, exerciseMap, equipment]);

  if (movements.length === 0) return null;

  const advance = () => { if (index + 1 >= movements.length) onClose(); else setIndex(i => i + 1); };

  return (
    <div className="wp-prep dt2-cooldown">
      {!started ? (
        <div className="wp-prep-card">
          {/* El workout YA quedó guardado — el cooldown es opcional (no bloquea nada). */}
          <div className="wp-prep-section-label">{t('workout.cooldownSaved')}</div>
          <div className="wp-prep-section-text">{t('workout.cooldownPreview')} · {block.minutes} min</div>
          <button className="wp-cta" onClick={() => setStarted(true)}>{t('workout.cooldownStart')}</button>
          <button className="wp-phase-skipall" onClick={onClose}>{t('workout.cooldownSkip')}</button>
        </div>
      ) : cur ? (
        <>
          <GuidedPhaseMovement
            key={index}
            phaseLabel={t('workout.cooldownPreview')}
            name={cur.name}
            note={cur.note}
            prescription={cur.prescription}
            videoUrl={videoUrl}
            index={index}
            total={movements.length}
            onDone={advance}
            onSkip={advance}
            t={t}
          />
          <button className="wp-phase-skipall" onClick={onClose}><X size={16} /> {t('workout.cooldownSkip')}</button>
        </>
      ) : null}
    </div>
  );
}
