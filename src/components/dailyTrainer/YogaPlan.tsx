// Vista del plan generado para sesiones de yoga (Power Vinyasa).
// Extraído de DailyTrainer.tsx en el Lote DT-C. CERO cambio de
// comportamiento — markup idéntico al inline previo.
//
// Estado local:
// - playerOpen: visibilidad del overlay del YogaFlowPlayer
// - playerStartedAtRef: timestamp para calcular durationSeconds en onComplete
//
// Lazy import del YogaFlowPlayer queda acá (encapsulación — el chunk solo
// se carga cuando se renderiza esta vista).

import { lazy, Suspense, useRef, useState } from 'react';
import { RefreshCw, Clock, Lock } from 'lucide-react';
import { useAppStore } from '../../store';
import { getExerciseIcon } from '../../utils/muscleGroupIcon';
import { useT } from '../../i18n';
import { finishWorkoutSession, type ExerciseLogItem } from '../../utils/workoutLogger';
import type { Exercise, Equipment, YogaPlan as YogaPlanType, CompletedSession } from '../../types';
import PlayerLoadingFallback from '../PlayerLoadingFallback';

const YogaFlowPlayer = lazy(() => import('../YogaFlowPlayer'));

interface Props {
  yogaPlan: YogaPlanType;
  regenBlocked: boolean;
  selectedEquipment: Equipment;
  exerciseBank: Exercise[];
  addCompletedSession: (session: CompletedSession) => void;
  markActiveDay: () => Promise<void>;
  onRegenerate: () => void;
  todayDayName: string;
  todayDateShort: string;
}

export default function YogaPlan({
  yogaPlan,
  regenBlocked,
  selectedEquipment,
  exerciseBank,
  addCompletedSession,
  markActiveDay,
  onRegenerate,
  todayDayName,
  todayDateShort,
}: Props) {
  const { t } = useT();
  const [playerOpen, setPlayerOpen] = useState(false);
  const playerStartedAtRef = useRef<number>(0);
  const exerciseMap = new Map(exerciseBank.map(e => [e.id, e]));

  return (
    <div className="wz-root">
      <div className="dt2-plan-header">
        <div>
          <p className="dt2-plan-micro">{t('yoga.planMicro')} · {todayDayName} {todayDateShort}</p>
          <h2 className="dt2-plan-title"><em>{yogaPlan.type}</em></h2>
          <div className="dt2-plan-meta">
            <span className="dt2-meta-chip">
              <Clock size={11} /> {t('yoga.minTotal', { n: Math.round(yogaPlan.totalDuration / 60) })}
            </span>
            <span className="dt2-meta-chip">
              🧘 {t('yoga.posesCount', { n: yogaPlan.poses.length })}
            </span>
          </div>
        </div>
        <button
          className={`dt2-regen${regenBlocked ? ' locked' : ''}`}
          onClick={onRegenerate}
          disabled={regenBlocked}
          aria-label={t('workout.regenAria')}
          title={t('workout.regenAria')}
        >
          {regenBlocked ? <Lock size={14} /> : <RefreshCw size={14} />}
        </button>
      </div>

      {/* CTA para abrir player — ARRIBA, visible sin scroll */}
      <button
        className="dt2-yoga-start-cta"
        onClick={() => {
          playerStartedAtRef.current = Date.now();
          setPlayerOpen(true);
        }}
      >
        {t('yoga.startFlow')}
      </button>

      {yogaPlan.razon && (
        <div className="dt2-card-why">
          <div className="dt2-card-why-label">{t('yoga.whyToday')}</div>
          <p className="dt2-card-why-text">{yogaPlan.razon}</p>
        </div>
      )}

      {yogaPlan.opening && (
        <div className="dt2-section">
          <div className="dt2-section-label">{t('yoga.opening')}</div>
          <p className="dt2-section-text">{yogaPlan.opening}</p>
        </div>
      )}

      <div className="dt2-yoga-list">
        {yogaPlan.poses.map((pose, i) => {
          const bank = exerciseMap.get(pose.id);
          const durationMin = Math.floor(pose.duration / 60);
          const durationSec = pose.duration % 60;
          const durationLabel = durationMin > 0
            ? `${durationMin}:${String(durationSec).padStart(2, '0')}`
            : `${pose.duration}s`;

          const PoseIcon = getExerciseIcon(bank);
          return (
            <div key={`${pose.id}-${i}`} className="dt2-yoga-item">
              <div className="dt2-yoga-num">{i + 1}</div>
              <div className="dt2-yoga-emoji"><PoseIcon size={22} strokeWidth={1.5} /></div>
              <div className="dt2-yoga-body">
                <div className="dt2-yoga-name">{bank?.name || pose.id}</div>
                <div className="dt2-yoga-meta">
                  <span>{durationLabel}</span>
                  {pose.repetitions && (<><span className="dt2-ex-dot">·</span><span>{pose.repetitions}x</span></>)}
                  {pose.sides === 'both' && (<><span className="dt2-ex-dot">·</span><span>{t('yoga.bothSides')}</span></>)}
                </div>
                {pose.tip_personalizado && (
                  <div className="dt2-ex-tip">{pose.tip_personalizado}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {yogaPlan.closing && (
        <div className="dt2-section">
          <div className="dt2-section-label">{t('yoga.closing')}</div>
          <p className="dt2-section-text">{yogaPlan.closing}</p>
        </div>
      )}

      {yogaPlan.note && (
        <div className="dt2-note">
          <p className="dt2-note-text">{yogaPlan.note}</p>
        </div>
      )}

      {/* Player overlay — lazy + Suspense */}
      {playerOpen && (
        <Suspense fallback={<PlayerLoadingFallback />}>
        <YogaFlowPlayer
          plan={yogaPlan}
          exerciseBank={exerciseBank}
          onClose={() => setPlayerOpen(false)}
          onComplete={() => {
            // Persistir sesión: Zustand (bloqueante) + Supabase (no-bloqueante)
            const startedAt = playerStartedAtRef.current;
            const durationSeconds = startedAt > 0
              ? Math.round((Date.now() - startedAt) / 1000)
              : yogaPlan.totalDuration;
            const userId = useAppStore.getState().user?.id ?? null;

            const exercisesLog: ExerciseLogItem[] = yogaPlan.poses.map((pose, i) => ({
              exercise_id: pose.id,
              order: i,
              planned: {
                duration: pose.duration,
                ...(pose.repetitions !== undefined && { repetitions: pose.repetitions }),
                ...(pose.sides !== undefined && { sides: pose.sides }),
              },
            }));

            finishWorkoutSession({
              userId,
              modality: 'yoga',
              exercises: exercisesLog,
              exercisesCompleted: yogaPlan.poses.length,
              exercisesTotal: yogaPlan.poses.length,
              durationSeconds,
              targetDurationSeconds: yogaPlan.totalDuration,
              equipment: selectedEquipment,
              dayType: 'power-vinyasa',
              coachReason: yogaPlan.razon,
              generationMethod: 'ai_generated',
            }, addCompletedSession, markActiveDay).catch(() => {});

            setPlayerOpen(false);
          }}
        />
        </Suspense>
      )}
    </div>
  );
}
