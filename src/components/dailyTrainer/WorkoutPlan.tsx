// Vista del plan generado para sesiones de fuerza/cardio.
// Extraído de DailyTrainer.tsx en el Lote DT-C. CERO cambio de
// comportamiento — markup idéntico al inline previo.
//
// Estado local:
// - workoutPlayerOpen: visibilidad del overlay del WorkoutPlayer
// - selectedExercise: ejercicio cuyo popout (read-only desde L2) está abierto
// - playerStartedAtRef: timestamp para calcular durationSeconds en onComplete
//
// CONTRATO CRÍTICO PRESERVADO (44 tests en workoutSession.test.ts):
// - onComplete recibe el shape exacto del WorkoutPlayer
// - finishWorkoutSession se llama con los mismos params (dayType, modality,
//   loggedSets, targetDurationSeconds, etc.) que alimentan racha/historial
// - ExerciseDetailPopout sigue read-only (sunset L2 — sin isDone/onToggleDone)

import { lazy, Suspense, useRef, useState } from 'react';
import { RefreshCw, Clock, Zap, ChevronRight, ChevronDown, Lock } from 'lucide-react';
import { useAppStore } from '../../store';
import { useT } from '../../i18n';
import { getExerciseIcon } from '../../utils/muscleGroupIcon';
import {
  finishWorkoutSession,
  groupLoggedSetsByExercise,
  type ExerciseLogItem,
} from '../../utils/workoutLogger';
import type {
  Exercise,
  Equipment,
  Modality,
  WorkoutDayDecision,
  CompletedSession,
} from '../../types';
import type { CachedWorkout } from '../../utils/workoutCache';
import ExerciseDetailPopout from '../ExerciseDetailPopout';
import ActivityLogSheet from '../ActivityLogSheet';
import PlayerLoadingFallback from '../PlayerLoadingFallback';

const WorkoutPlayer = lazy(() => import('../WorkoutPlayer'));

interface Props {
  plan: CachedWorkout & { razon?: string };
  regenBlocked: boolean;
  regensLeft: number;
  selectedEquipment: Equipment;
  selectedModality: Modality;
  selectedTime: number;
  todayDecision: WorkoutDayDecision;
  exerciseBank: Exercise[];
  addCompletedSession: (session: CompletedSession) => void;
  markActiveDay: () => Promise<void>;
  onRegenerate: () => void;
  todayDayName: string;
  todayDateShort: string;
}

export default function WorkoutPlan({
  plan,
  regenBlocked,
  regensLeft,
  selectedEquipment,
  selectedModality,
  selectedTime,
  todayDecision,
  exerciseBank,
  addCompletedSession,
  markActiveDay,
  onRegenerate,
  todayDayName,
  todayDateShort,
}: Props) {
  const { t } = useT();
  const [workoutPlayerOpen, setWorkoutPlayerOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  // Plan-1: "POR QUÉ HOY" colapsable. Default cerrado — el plan arranca
  // limpio, el usuario lo abre si quiere leer el rationale del coach.
  const [whyOpen, setWhyOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<{
    exercise: Exercise;
    planData: { sets: number; reps: string; rest: number; tip_personalizado?: string };
    index: number;
  } | null>(null);
  const playerStartedAtRef = useRef<number>(0);
  const exerciseMap = new Map(exerciseBank.map(e => [e.id, e]));

  return (
    <div className="wz-root">
      <div className="dt2-plan-header">
        <div>
          <p className="dt2-plan-micro">tu rutina · {todayDayName} {todayDateShort}</p>
          <h2 className="dt2-plan-title">
            <em>{plan.type}</em>
          </h2>
          <div className="dt2-plan-meta">
            <span className="dt2-meta-chip">
              <Clock size={11} /> {plan.exercises.length} ejercicios
            </span>
            <span className="dt2-meta-chip">
              <Zap size={11} /> {plan.intensity}
            </span>
          </div>
        </div>
        <button
          className={`dt2-regen${regenBlocked ? ' locked' : ''}`}
          onClick={onRegenerate}
          disabled={regenBlocked}
          aria-label="Regenerar rutina"
          title={regenBlocked ? 'Ya regeneraste 3 veces hoy' : `Te quedan ${regensLeft} regeneraciones`}
        >
          {regenBlocked ? <Lock size={14} /> : <RefreshCw size={14} />}
        </button>
      </div>

      {/* CTA para abrir player — ARRIBA, visible sin scroll. Solo si hay ejercicios. */}
      {plan.exercises.length > 0 && (
        <button
          className="dt2-start-workout-cta"
          onClick={() => {
            playerStartedAtRef.current = Date.now();
            setWorkoutPlayerOpen(true);
          }}
        >
          <span className="dt2-cta-play" aria-hidden="true">▶</span>
          {t('workout.startWorkout')}
        </button>
      )}

      {/* Razón del coach — Plan-1: colapsable, default cerrado.
          El plan arranca limpio; el usuario lo abre si le interesa. */}
      {(plan as { razon?: string }).razon && (
        <div className={`dt2-card-why${whyOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="dt2-card-why-toggle"
            onClick={() => setWhyOpen(o => !o)}
            aria-expanded={whyOpen}
            aria-label={whyOpen ? t('hoy.ariaWhyCollapse') : t('hoy.ariaWhyExpand')}
          >
            <span className="dt2-card-why-label">{t('workout.whyToday')}</span>
            <ChevronDown size={14} className="dt2-card-why-chev" />
          </button>
          {whyOpen && (
            <p className="dt2-card-why-text">{(plan as { razon?: string }).razon}</p>
          )}
        </div>
      )}

      {plan.warmup && (
        <div className="dt2-section">
          <div className="dt2-section-label">{t('workout.warmup')}</div>
          <p className="dt2-section-text">{plan.warmup}</p>
        </div>
      )}

      {plan.exercises.length > 0 && (
        <div className="dt2-exercises">
          {plan.exercises.map((ex, i) => {
            const bank = exerciseMap.get(ex.id);
            return (
              <div
                key={`${ex.id}-${i}`}
                className="dt2-ex"
                onClick={() => {
                  const fallback: Exercise = {
                    id: ex.id || `ex-${i}`,
                    name: bank?.name || ex.id || 'Ejercicio',
                    emoji: '💪',
                    desc: '',
                    muscleGroup: 'cuerpo-completo',
                    equipment: ['gym'],
                    goals: ['hipertrofia'],
                    type: 'compuesto',
                    difficulty: 'intermedio',
                    defaultSets: 3,
                    defaultReps: '10',
                    defaultRest: 60,
                    steps: [],
                  };
                  setSelectedExercise({
                    exercise: bank || fallback,
                    planData: {
                      sets: typeof ex.sets === 'number' ? ex.sets : parseInt(ex.sets) || 3,
                      reps: String(ex.reps || '10'),
                      rest: typeof ex.rest === 'number' ? ex.rest : parseInt(ex.rest) || 60,
                      tip_personalizado: ex.tip_personalizado,
                    },
                    index: i,
                  });
                }}
              >
                <div className="dt2-ex-emoji">
                  {(() => { const Ic = getExerciseIcon(bank); return <Ic size={22} strokeWidth={1.5} />; })()}
                </div>
                <div className="dt2-ex-body">
                  <div className="dt2-ex-name">{bank?.name || ex.id}</div>
                  <div className="dt2-ex-stats">
                    <span>{ex.sets} × {ex.reps}</span>
                    <span className="dt2-ex-dot">·</span>
                    <span>{ex.rest}s descanso</span>
                  </div>
                  {/* Plan-1: tip italic escondido de la card (vivía en
                      .dt2-ex-tip). El tap de la card abre ExerciseDetailPopout
                      que ya muestra el tip completo — cero info perdida. */}
                </div>
                <ChevronRight size={14} className="dt2-ex-arrow" />
              </div>
            );
          })}
        </div>
      )}

      {plan.cooldown && (
        <div className="dt2-section">
          <div className="dt2-section-label">{t('workout.cooldown')}</div>
          <p className="dt2-section-text">{plan.cooldown}</p>
        </div>
      )}

      {plan.note && (
        <div className="dt2-note">
          <p className="dt2-note-text">{plan.note}</p>
        </div>
      )}

      {/* Actividad alterna — "hoy no hice esto, pero hice esto". El movimiento
          también cuenta: registra básquet/hiking/surf y el día queda activo. */}
      <button type="button" className="dt2-alt-activity" onClick={() => setActivityOpen(true)}>
        <span className="dt2-alt-activity-q">{t('activityLog.detailQuestion')}</span>
        <span className="dt2-alt-activity-cta">{t('activityLog.detailCta')}</span>
      </button>

      {activityOpen && <ActivityLogSheet onClose={() => setActivityOpen(false)} />}

      {selectedExercise && (
        <ExerciseDetailPopout
          exercise={selectedExercise.exercise}
          planData={selectedExercise.planData}
          userEquipment={[selectedEquipment]}
          onClose={() => setSelectedExercise(null)}
        />
      )}

      {/* WorkoutPlayer overlay full-screen — fuerza/cardio · lazy + Suspense */}
      {workoutPlayerOpen && plan.exercises.length > 0 && (
        <Suspense fallback={<PlayerLoadingFallback />}>
        <WorkoutPlayer
          workout={plan}
          exerciseBank={exerciseBank}
          userEquipment={[selectedEquipment]}
          onClose={() => setWorkoutPlayerOpen(false)}
          onComplete={(data) => {
            // Mapear modality: si 'auto', derivar del todayDecision.type
            const sessionModality: Modality =
              selectedModality === 'cardio' ? 'cardio' :
              selectedModality === 'auto' ? (todayDecision.type === 'cardio' ? 'cardio' : 'fuerza') :
              'fuerza';

            const userId = useAppStore.getState().user?.id ?? null;

            // Reagrupar loggedSets por ejercicio para construir `performed`
            const performedByExercise = groupLoggedSetsByExercise(
              data.loggedSets,
              plan.exercises,
            );
            const completedAtIso = new Date().toISOString();

            // Sync con la card de Hoy: marcar como hecho cada ejercicio realizado
            // (no skipeado). Comparte workoutChecks → los ✓ aparecen en la card.
            const checkDay = completedAtIso.split('T')[0];
            const setWorkoutCheck = useAppStore.getState().setWorkoutCheck;

            const exercisesLog: ExerciseLogItem[] = plan.exercises.map((ex, i) => {
              const setsForExercise = performedByExercise[i] || [];
              const hasAnyData = setsForExercise.length > 0;
              const allSkipped = hasAnyData && setsForExercise.every(s => s === null);
              if (hasAnyData && !allSkipped) setWorkoutCheck(`${checkDay}-${ex.id}`, true);
              return {
                exercise_id: ex.id,
                order: i,
                planned: {
                  sets: ex.sets,
                  reps: ex.reps,
                  rest: ex.rest,
                  ...(ex.tip_personalizado && { tip: ex.tip_personalizado }),
                },
                ...(hasAnyData && {
                  performed: {
                    sets: setsForExercise,
                    skipped: allSkipped,
                    completed_at: completedAtIso,
                  },
                }),
              };
            });

            finishWorkoutSession({
              userId,
              modality: sessionModality,
              exercises: exercisesLog,
              exercisesCompleted: data.exercisesCompleted,
              exercisesTotal: plan.exercises.length,
              durationSeconds: data.durationSeconds,
              targetDurationSeconds: selectedTime * 60,
              equipment: selectedEquipment,
              dayType: todayDecision.type,
              coachReason: (plan as { razon?: string }).razon,
              generationMethod: 'ai_generated',
              loggedSets: data.loggedSets,
            }, addCompletedSession, markActiveDay).catch(() => {});

            setWorkoutPlayerOpen(false);
          }}
        />
        </Suspense>
      )}
    </div>
  );
}
