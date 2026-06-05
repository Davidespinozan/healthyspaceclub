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
import PartnerLiveHeader from '../PartnerLiveHeader';
import PlayerLoadingFallback from '../PlayerLoadingFallback';
import type { TranslationKey } from '../../i18n/es';
import { translateDayLabel } from '../../utils/dayTypeLabel';

const WorkoutPlayer = lazy(() => import('../WorkoutPlayer'));

// Músculo primario → label traducible. Tag visible en cada ejercicio para que
// el usuario vea de un vistazo qué trabaja (y verifique que respeta su foco).
const MUSCLE_LABEL_KEY: Record<string, TranslationKey> = {
  pecho: 'wizard.musclePecho', espalda: 'wizard.muscleEspalda', hombros: 'wizard.muscleHombros',
  biceps: 'wizard.muscleBiceps', triceps: 'wizard.muscleTriceps', cuadriceps: 'wizard.muscleCuadriceps',
  isquios: 'wizard.muscleIsquios', gluteo: 'wizard.muscleGluteo', pantorrillas: 'wizard.musclePantorrillas',
  core: 'wizard.muscleCore', cardio: 'wizard.muscleCardio', 'cuerpo-completo': 'wizard.muscleCuerpoCompleto',
};

// Formato de coordinación (modo pareja) → label traducible.
const PARTNER_FMT_KEY: Record<string, TranslationKey> = {
  juntos: 'workout.partnerFmtJuntos',
  alternado: 'workout.partnerFmtAlternado',
  asistido: 'workout.partnerFmtAsistido',
};

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
  const { t, locale } = useT();
  const langMismatch = !!(plan as { lang?: string }).lang && (plan as { lang?: string }).lang !== locale;
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
          <p className="dt2-plan-micro">{t('workout.planMicro')} · {todayDayName} {todayDateShort}</p>
          <h2 className="dt2-plan-title">
            <em>{translateDayLabel(plan.type, t)}</em>
          </h2>
          <div className="dt2-plan-meta">
            <span className="dt2-meta-chip">
              <Clock size={11} /> {t('workout.exercisesCount', { n: plan.exercises.length })}
            </span>
            <span className="dt2-meta-chip">
              <Zap size={11} /> {plan.intensity}
            </span>
          </div>
        </div>
        {/* Sesión de pareja amarra el día: la rutina de pareja NO se regenera en
            solitario aquí (se regenera por Compañeros → Entrenar, para los dos). */}
        {!plan.partnerMode && (
          <button
            className={`dt2-regen${regenBlocked ? ' locked' : ''}`}
            onClick={onRegenerate}
            disabled={regenBlocked}
            aria-label={t('workout.regenAria')}
            title={regenBlocked ? t('workout.regenBlocked') : t('workout.regenLeft', { n: regensLeft })}
          >
            {regenBlocked ? <Lock size={14} /> : <RefreshCw size={14} />}
          </button>
        )}
      </div>

      {/* Aviso: la rutina se generó en otro idioma (la prosa IA quedaría mezclada).
          Ofrecemos regenerar en el idioma actual. Pareja no regenera en solitario. */}
      {langMismatch && !plan.partnerMode && (
        <div className="dt2-lang-mismatch">
          <span>{t('workout.langMismatch')}</span>
          <button type="button" onClick={onRegenerate} disabled={regenBlocked}>
            {t('workout.langMismatchCta')}
          </button>
        </div>
      )}

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

      {/* Cabecera de pareja — los dos avatares + "Entrenando con X" (igual que Hoy). */}
      {plan.partnerMode && (
        <PartnerLiveHeader
          variant="plain"
          partnerName={plan.partnerName || ''}
          partnerAvatar={(plan as { partnerAvatar?: string | null }).partnerAvatar ?? null}
        />
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

      {plan.exercises.length > 0 && (() => {
        type PlanEx = typeof plan.exercises[number];
        const renderCard = (ex: PlanEx, i: number) => {
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
                {plan.partnerMode ? (
                  <>
                    <div className="dt2-ex-stats">
                      {bank?.muscleGroup && MUSCLE_LABEL_KEY[bank.muscleGroup] && (
                        <span className="dt2-ex-muscle">{t(MUSCLE_LABEL_KEY[bank.muscleGroup])}</span>
                      )}
                      {ex.format && PARTNER_FMT_KEY[ex.format] && (
                        <span className="dt2-ex-fmt">{t(PARTNER_FMT_KEY[ex.format])}</span>
                      )}
                      <span className="dt2-ex-dot">·</span>
                      <span>{ex.rest}s {t('workout.statRest')}</span>
                    </div>
                    <div className="dt2-ex-prows">
                      <span className="dt2-ex-prow">
                        <b>{t('workout.partnerYou')}</b> {ex.sets} × {ex.reps}
                      </span>
                      <span className="dt2-ex-prow dt2-ex-prow--b">
                        <b>{plan.partnerName}</b> {ex.sets} × {ex.repsB || ex.reps}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="dt2-ex-stats">
                    {bank?.muscleGroup && MUSCLE_LABEL_KEY[bank.muscleGroup] && (
                      <span className="dt2-ex-muscle">{t(MUSCLE_LABEL_KEY[bank.muscleGroup])}</span>
                    )}
                    <span>{ex.sets} × {ex.reps}</span>
                    <span className="dt2-ex-dot">·</span>
                    <span>{ex.rest}s {t('workout.statRest')}</span>
                  </div>
                )}
              </div>
              <ChevronRight size={14} className="dt2-ex-arrow" />
            </div>
          );
        };

        // Agrupar ejercicios consecutivos con el mismo `group` (superseries).
        const blocks: { group?: string; items: { ex: PlanEx; i: number }[] }[] = [];
        plan.exercises.forEach((ex, i) => {
          const last = blocks[blocks.length - 1];
          if (ex.group && last && last.group === ex.group) last.items.push({ ex, i });
          else blocks.push({ group: ex.group, items: [{ ex, i }] });
        });

        return (
          <div className="dt2-exercises">
            {blocks.map((b, bi) => {
              if (b.group && b.items.length >= 2) {
                const label = b.items.length === 2 ? t('workout.biset')
                  : b.items.length === 3 ? t('workout.triset')
                  : t('workout.superset');
                return (
                  <div key={`grp-${bi}`} className="dt2-superset">
                    <div className="dt2-superset-badge"><Zap size={11} strokeWidth={2.5} /> {label}</div>
                    <div className="dt2-superset-items">
                      {b.items.map(({ ex, i }) => renderCard(ex, i))}
                    </div>
                  </div>
                );
              }
              return b.items.map(({ ex, i }) => renderCard(ex, i));
            })}
          </div>
        );
      })()}

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

      {/* Actividad alterna — "hoy no hice esto, pero hice esto". Oculta en sesión
          de pareja (es obvio que están haciendo la rutina juntos). */}
      {!plan.partnerMode && (
        <button type="button" className="dt2-alt-activity" onClick={() => setActivityOpen(true)}>
          <span className="dt2-alt-activity-q">{t('activityLog.detailQuestion')}</span>
          <span className="dt2-alt-activity-cta">{t('activityLog.detailCta')}</span>
        </button>
      )}

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
              // Fase 3 · crédito compartido: liga la sesión al compañero (del plan,
              // que lleva partnerId/partnerName — robusto venga de donde venga).
              partnerUserId: plan.partnerMode ? ((plan as { partnerId?: string | null }).partnerId ?? null) : null,
              partnerName: plan.partnerMode ? (plan.partnerName ?? null) : null,
            }, addCompletedSession, markActiveDay).catch(() => {});

            setWorkoutPlayerOpen(false);
          }}
        />
        </Suspense>
      )}
    </div>
  );
}
