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

import { lazy, Suspense, useRef, useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { RefreshCw, Clock, Zap, ChevronRight, ChevronDown, Lock, Play, ArrowRight, Dumbbell, BarChart3, Target, Check } from 'lucide-react';
import { useAppStore } from '../../store';
import { plural } from '../../i18n/format';
import { humanizeExerciseId } from '../../utils/exerciseMeta';
import { logE2ETrace } from '../../utils/e2eTrace';
import { planPlannedMinutes, planEarlyEnd, isCardioPlan, cardioBlockTitleKey, cardioShowVideo, cardioMetaFor } from '../../utils/workoutDisplay';
import { useT } from '../../i18n';
import { getExerciseIcon } from '../../utils/muscleGroupIcon';
import {
  finishWorkoutSession,
  groupLoggedSetsByExercise,
  type ExerciseLogItem,
} from '../../utils/workoutLogger';
import { exerciseVideoCandidateIds, pickExerciseVideo, selectVariantForEquipment } from '../../utils/workoutPlanner';
import { isStrengthDomainSession } from '../../utils/trainingDomain';   // F2C-9B.2 · strength credit por SESIÓN
import type { Implement } from '../../utils/equipmentImplement';
import type {
  Exercise,
  Equipment,
  Modality,
  WorkoutDayDecision,
  CompletedSession,
  LoggedSet,
} from '../../types';
import type { CachedWorkout } from '../../utils/workoutCache';
import type { SessionEndReason } from '../../utils/sessionEndReason';
import ExerciseDetailPopout from '../ExerciseDetailPopout';
import ActivityLogSheet from '../ActivityLogSheet';
import PartnerLiveHeader from '../PartnerLiveHeader';
import PlayerLoadingFallback from '../PlayerLoadingFallback';
import type { TranslationKey } from '../../i18n/es';
import { translateDayLabel } from '../../utils/dayTypeLabel';
import { dayKey } from '../../utils/localDate';

const WorkoutPlayer = lazy(() => import('../WorkoutPlayer'));

// Músculo primario → label traducible. Tag visible en cada ejercicio para que
// el usuario vea de un vistazo qué trabaja (y verifique que respeta su foco).
const MUSCLE_LABEL_KEY: Record<string, TranslationKey> = {
  pecho: 'wizard.musclePecho', espalda: 'wizard.muscleEspalda', hombros: 'wizard.muscleHombros',
  biceps: 'wizard.muscleBiceps', triceps: 'wizard.muscleTriceps', cuadriceps: 'wizard.muscleCuadriceps',
  isquios: 'wizard.muscleIsquios', gluteo: 'wizard.muscleGluteo', pantorrillas: 'wizard.musclePantorrillas',
  core: 'wizard.muscleCore', cardio: 'wizard.muscleCardio', 'cuerpo-completo': 'wizard.muscleCuerpoCompleto',
};

// F2B-1 · CASE F sustituido: el banner del fin de sesión sale del sessionEndReason REAL (señales
// fisiológicas), no de la heurística `planned < 75%`. Copy honesto y corto (sin afirmaciones médicas).
const END_REASON_KEY: Record<SessionEndReason, TranslationKey> = {
  TIME_LIMITED: 'workout.endReason.timeLimited',
  RECOVERY_LIMITED: 'workout.endReason.recoveryLimited',
  DOSE_COMPLETE: 'workout.endReason.doseComplete',
  AVAILABLE_TIME_UNUSED: 'workout.endReason.availableTimeUnused',
  HYBRID_COMPLETE: 'workout.endReason.hybridComplete',
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
  // GEAR granular · autoridad fina de elegibilidad de variante. La vista y el player
  // resuelven la variante A MOSTRAR con esto → nunca enseñan una de máquina a quien
  // solo tiene mancuernas (reproducibilidad = respeta el gear).
  allowedImplements?: Set<Implement>;
  selectedModality: Modality;
  selectedTime: number;
  todayDecision: WorkoutDayDecision;
  exerciseBank: Exercise[];
  addCompletedSession: (session: CompletedSession) => void;
  markActiveDay: () => Promise<void>;
  onRegenerate: () => void;
  todayDayName: string;
  todayDateShort: string;
  /** El usuario eligió una variante (ej. remo→bici) en el detalle de un bloque. El dueño del plan
   *  la persiste en plan.exercises[index].variantId (setPlan + sealPlan + saveDailyWorkout) → llega
   *  a la ejecución. Sin este callback, el selector de variante no aparece (solo lectura). */
  onSelectVariant?: (index: number, variantId: string) => void;
  /** SOURCE OF TRUTH: el player mutó la sesión iniciada (swap de ejercicio o cambio de variante). El
   *  dueño persiste plan.exercises[index] = newEx → Hoy/resume/completion reflejan lo ejecutado. */
  onSessionMutate?: (index: number, newEx: CachedWorkout['exercises'][number]) => void;
  /** Sesión híbrida: abrir el flujo de cardio como sesión nueva tras completar fuerza. */
  onAddCardio?: () => void;
  /** D1 · "Generarme más": calcular trabajo supplemental FRESCO tras completar fuerza (el padre decide
   *  0/1/2/3 por déficit real y arma el plan supplemental o el aviso covered/gap). */
  onGenerateMore?: () => void;
  /** F2B-1 · construye la sesión cardio EJECUTABLE desde el spec sellado (minutes/style/ceiling). El
   *  padre (DailyTrainer) tiene el motor + pool; devuelve un CachedWorkout de cardio o null si no hay
   *  contenido. NO reemplaza el dailyWorkout de fuerza — se ejecuta como sesión SEPARADA. */
  buildComposedCardio?: (spec: NonNullable<CachedWorkout['composedCardio']>) => CachedWorkout | null;
  /** F2B-1 · el cardio compuesto se completó → el padre marca composedCardio.done=true y persiste el
   *  MISMO plan de fuerza (no lo reemplaza). */
  onComposedCardioDone?: () => void;
  /** F2C-1 MUST FIX 2 · reconciliación: true si la necesidad estructurada de cardio de la semana YA quedó
   *  cubierta por otro cardio HSC (remaining===0). Entonces el composedCardio pending NO se ofrece
   *  (satisfecho por reconciliación, ≠ done). El spec sellado NO se recomputa. */
  composedCardioSatisfied?: boolean;
}

export default function WorkoutPlan({
  plan,
  regenBlocked,
  regensLeft,
  selectedEquipment,
  allowedImplements,
  selectedModality,
  selectedTime,
  todayDecision,
  exerciseBank,
  addCompletedSession,
  markActiveDay,
  onRegenerate,
  todayDayName,
  todayDateShort,
  onSelectVariant,
  onSessionMutate,
  onAddCardio,
  onGenerateMore,
  buildComposedCardio,
  onComposedCardioDone,
  composedCardioSatisfied,
}: Props) {
  const { t, locale } = useT();
  const langMismatch = !!(plan as { lang?: string }).lang && (plan as { lang?: string }).lang !== locale;
  const [workoutPlayerOpen, setWorkoutPlayerOpen] = useState(false);
  // F2B-1 · sesión cardio compuesta EN CURSO (sesión SEPARADA; no reemplaza el plan de fuerza).
  const [composedCardioActive, setComposedCardioActive] = useState<CachedWorkout | null>(null);
  // F2B-1 UX (item 3) · transición Fuerza→Cardio: tras completar fuerza con cardio pendiente se ofrece
  // continuar sin volver a "buscar" el cardio. NO auto-inicia; NO marca done si se pospone.
  const [cardioHandoff, setCardioHandoff] = useState(false);
  const composedCardioSpec = plan.composedCardio;
  const composedCardioPending = !!composedCardioSpec && composedCardioSpec.done !== true;
  // Inicia el cardio SELLADO como sesión separada (usado por el bloque 03 y por la transición).
  const startComposedCardio = () => {
    if (!composedCardioSpec || !buildComposedCardio) return;
    const cardio = buildComposedCardio(composedCardioSpec);
    if (!cardio || !cardio.exercises.length) return;
    playerStartedAtRef.current = Date.now();
    setCardioHandoff(false);
    setComposedCardioActive(cardio);
  };
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

  // Mini-preview de video por ejercicio. El MOVIMIENTO manda: preferimos la
  // variante por equipo, luego el base, y si no hay, CUALQUIER variante del mismo
  // movimiento (así casi siempre se ve un demo, aunque no sea exacto al equipo).
  const [videoByEx, setVideoByEx] = useState<Record<string, string>>({});
  useEffect(() => {
    // FUENTE ÚNICA (fix imagen inconsistente): la MISMA lista de candidatos que usa "Hoy" — variante
    // del equipo → base → CUALQUIER variante. Así detalle resuelve el mismo video que Hoy (antes esta
    // vista filtraba por equipo y caía al placeholder si el clip vivía en otra variante).
    const pairs = plan.exercises
      .map(e => {
        const ex = exerciseMap.get(e.id);
        const base = ex ? exerciseVideoCandidateIds(ex, [selectedEquipment], allowedImplements) : [e.id];
        // Si el usuario eligió variante (variantId), su clip manda para el póster de la card.
        return { baseId: e.id, candidates: e.variantId ? [e.variantId, ...base] : base };
      })
      .filter(p => p.baseId);
    const ids = Array.from(new Set(pairs.flatMap(p => p.candidates)));
    if (ids.length === 0) return;
    let active = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('exercise_videos')
          .select('exercise_id, video_url, display_order')
          .in('exercise_id', ids)
          .order('display_order', { ascending: true });
        if (!active || !data) return;
        const byId: Record<string, string> = {};
        for (const row of data as { exercise_id: string; video_url: string }[]) {
          if (!byId[row.exercise_id]) byId[row.exercise_id] = row.video_url;
        }
        const map: Record<string, string> = {};
        for (const p of pairs) {
          const url = pickExerciseVideo(p.candidates, byId);
          if (url) map[p.baseId] = url;
        }
        setVideoByEx(map);
      } catch { /* noop */ }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.exercises.map(e => `${e.id}:${e.variantId ?? ''}`).join(','), selectedEquipment, allowedImplements]);

  // Header: progreso (ejercicios completados hoy) + tiempo estimado del plan.
  const workoutChecks = useAppStore(s => s.workoutChecks);
  const headerCheckDay = dayKey(new Date());
  const totalExercises = plan.exercises.length;
  const completedCount = plan.exercises.filter(ex => workoutChecks[`${headerCheckDay}-${ex.id}`]).length;
  const progressPct = totalExercises ? Math.round((completedCount / totalExercises) * 100) : 0;
  // DURACIÓN REAL (autoridad temporal correcta): cardio → warmup+cardioMain (no el estimador de
  // fuerza, que daba "25 min" a bloques time-based); resistencia → estimador honesto de la sesión.
  const estMinutes = planPlannedMinutes(plan);
  const planIsCardio = isCardioPlan(plan);
  // Early-end honesto: si la sesión real es materialmente más corta que el tiempo pedido, se comunica
  // (política: selectedTime = tiempo DISPONIBLE, nunca una promesa de duración).
  const legacyEarly = planEarlyEnd(plan, selectedTime);
  // F2B-1 · CASE F sustituido por el motivo REAL. Rutinas nuevas traen sessionEndReason (señales
  // fisiológicas); las legacy caen al early-end por duración. Se muestra cuando aporta información:
  // recuperación/híbrido/tiempo-limitado siempre, o cuando la sesión termina materialmente antes.
  const endReason = (plan as { sessionEndReason?: SessionEndReason }).sessionEndReason;
  const showReasonBanner = !!endReason &&
    (endReason === 'RECOVERY_LIMITED' || endReason === 'HYBRID_COMPLETE' || endReason === 'TIME_LIMITED' || legacyEarly != null);

  return (
    <div className="wz-root">
      <div className="dt2-plan-header">
        <div className="dt2-plan-head-main">
          <p className="dt2-plan-micro">
            <span className="dt2-plan-tag">{t('workout.planMicro')}</span> · {todayDayName} {todayDateShort}
          </p>
          <h2 className="dt2-plan-title">{translateDayLabel(plan.type, t)}</h2>
          <div className="dt2-plan-meta">
            <span className="dt2-meta-chip">
              <Dumbbell size={12} /> {planIsCardio
                ? plural(plan.exercises.length, {
                    one: t('workout.blocksCountOne', { n: plan.exercises.length }),
                    other: t('workout.blocksCount', { n: plan.exercises.length }),
                  })
                : plural(plan.exercises.length, {
                    one: t('workout.exercisesCountOne', { n: plan.exercises.length }),
                    other: t('workout.exercisesCount', { n: plan.exercises.length }),
                  })}
            </span>
            <span className="dt2-meta-chip"><Clock size={12} /> {t('workout.minApprox', { n: estMinutes })}</span>
            <span className="dt2-meta-chip">
              <BarChart3 size={12} /> {({
                baja: t('workout.intensityLow'),
                media: t('workout.intensityMid'),
                alta: t('workout.intensityHigh'),
              } as Record<string, string>)[plan.intensity] ?? plan.intensity}
            </span>
          </div>
          <div className="dt2-plan-progress">
            <div className="dt2-plan-progress-row">
              <span className="dt2-plan-progress-lbl"><strong>{completedCount}</strong> / {totalExercises} {t('workout.exercisesCompleted')}</span>
              <span className="dt2-plan-progress-pct">{progressPct}%</span>
            </div>
            <div className="dt2-plan-progress-track">
              <div className="dt2-plan-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
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

      {/* Fin de sesión HONESTO: motivo REAL (sessionEndReason) en rutinas nuevas; early-end por
          duración en legacy. No se esconde ni se vende como "120 min": se explica el porqué. */}
      {endReason
        ? (showReasonBanner && (
            <div className="dt2-early-end">
              <Clock size={14} />
              <span>{t(END_REASON_KEY[endReason])}</span>
            </div>
          ))
        : (legacyEarly && (
            <div className="dt2-early-end">
              <Clock size={14} />
              <span>{t(legacyEarly.reasonKey as Parameters<typeof t>[0], { n: legacyEarly.plannedMin })}</span>
            </div>
          ))}

      {/* CTA para abrir player — ARRIBA, visible sin scroll. Solo si hay ejercicios. */}
      {plan.exercises.length > 0 && (
        <div className="dt2-cta-wrap">
          <button
            className="dt2-start-workout-cta"
            onClick={() => {
              playerStartedAtRef.current = Date.now();
              setWorkoutPlayerOpen(true);
            }}
          >
            <span className="dt2-cta-play" aria-hidden="true"><Play size={15} strokeWidth={2} fill="currentColor" /></span>
            {t('workout.startWorkout')}
          </button>
          <p className="dt2-cta-sub"><Clock size={12} strokeWidth={2} /> {t('workout.ctaHint')}</p>
        </div>
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
        <button
          type="button"
          className={`dt2-goal${whyOpen ? ' is-open' : ''}`}
          onClick={() => setWhyOpen(o => !o)}
          aria-expanded={whyOpen}
          aria-label={whyOpen ? t('hoy.ariaWhyCollapse') : t('hoy.ariaWhyExpand')}
        >
          <span className="dt2-goal-icon"><Target size={18} strokeWidth={2} /></span>
          <span className="dt2-goal-main">
            <span className="dt2-goal-title">{t('workout.todayGoal')}</span>
            <span className="dt2-goal-text">{(plan as { razon?: string }).razon}</span>
          </span>
          <ChevronDown size={16} className="dt2-goal-chev" />
        </button>
      )}

      {/* Calentamiento y enfriamiento se MUESTRAN dentro del player (flujo guiado),
          ya no en la vista previa — saturaba con info que no se retiene parado. */}

      {plan.exercises.length > 0 && (() => {
        type PlanEx = typeof plan.exercises[number];
        const renderCard = (ex: PlanEx, i: number) => {
          const bank = exerciseMap.get(ex.id);
          // Identidad cardio ROBUSTA: sellada en el ejercicio (rutinas nuevas) o derivada del
          // cardioMainBlock persistido (rutinas legacy/cache). Nunca cae al stationId técnico.
          const cm = cardioMetaFor(plan, i);
          // Identidad SECUNDARIA del bloque cardio: la ESTACIÓN/máquina concreta (ej. "Remo (ergómetro)"),
          // resolviendo la variante ELEGIDA por el usuario si la hay. Da al usuario la actividad real.
          const activeVariant = cm && bank ? selectVariantForEquipment(bank, [selectedEquipment], allowedImplements, ex.variantId) : null;
          return (
            <div
              key={`${ex.id}-${i}`}
              className="dt2-ex"
              onClick={() => {
                const fallback: Exercise = {
                  id: ex.id || `ex-${i}`,
                  name: bank?.name || (ex.id ? humanizeExerciseId(ex.id) : t('video.exercise')),
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
                {/* CARDIO: un bloque steady/interval NO muestra el video del stationId técnico
                    (p.ej. high-knees durante 77 min) → card estilizada. Solo drills / intervals no-running. */}
                {videoByEx[ex.id] ? (
                  // Cardio steady/recovery → PÓSTER estático (primer frame, sin autoplay/loop): identidad
                  // de la actividad sin el clip engañoso de 77 min. Drills/intervals y fuerza → mini-demo
                  // (autoplay loop). Sin video usable → icono genérico (fallback actual).
                  <video
                    className="dt2-ex-video"
                    src={videoByEx[ex.id]}
                    muted
                    playsInline
                    preload="metadata"
                    {...((!cm || cardioShowVideo(cm)) ? { autoPlay: true, loop: true } : {})}
                  />
                ) : (
                  (() => { const Ic = getExerciseIcon(bank); return <Ic size={22} strokeWidth={1.5} />; })()
                )}
              </div>
              <div className="dt2-ex-body">
                {/* Mismo tratamiento que las tarjetas de comida: eyebrow dorado con
                    ícono (músculo) → nombre → prescripción (series·reps·descanso). */}
                {bank?.muscleGroup && MUSCLE_LABEL_KEY[bank.muscleGroup] && (
                  <div className="dt2-ex-eyebrow">
                    {(() => { const Ic = getExerciseIcon(bank); return <Ic size={12} strokeWidth={2.2} />; })()}
                    {t(MUSCLE_LABEL_KEY[bank.muscleGroup])}
                  </div>
                )}
                {/* CARDIO: título = ACTIVIDAD real del bloque (correr/circuito/…), nunca el stationId. */}
                <div className="dt2-ex-name">{cm ? t(cardioBlockTitleKey(cm) as Parameters<typeof t>[0]) : (bank?.name || humanizeExerciseId(ex.id))}</div>
                {/* Identidad secundaria ACCIONABLE (F2C-7):
                    · continuo (steady/recovery/cooldown) → la ACTIVIDAD (nombre de la estación,
                      ej. "Marcha en el lugar"). La variante describe posición/equipo ("De pie") → NO es
                      accionable como identidad principal de un bloque temporizado.
                    · intervals/power/drills → la variante ES el movimiento concreto que ejecuta → se conserva. */}
                {cm && (() => {
                  const isContinuous = cm.kind === 'steady' || cm.kind === 'recovery' || cm.kind === 'cooldown';
                  // Autoridad metadata-driven (NO parche de string): una estación "container" de varias
                  // MÁQUINAS/actividades distintas (variantes con cardioStyle propios: bici/elíptica/caminadora/remo)
                  // → la VARIANTE es la actividad accionable ("Bicicleta"). Una estación de UNA sola actividad
                  // cuyas variantes son solo POSICIÓN (marcha "De pie"/"Sentado") → el nombre de la ESTACIÓN
                  // es la actividad ("Marcha en el lugar"); la variante-posición no es accionable como identidad.
                  // machine-bank = alguna variante con cardioStyle PROPIO distinto al del ejercicio
                  // (cardio-maquina agrupa bici/elíptica[lowImpact]/caminadora[correr] ≠ su 'funcional').
                  const isMachineBank = (bank?.variants ?? []).some(v => {
                    const vs = (v as { cardioStyle?: string }).cardioStyle;
                    return !!vs && vs !== bank?.cardioStyle;
                  });
                  const secondary = (isContinuous && !isMachineBank) ? (bank?.name ?? '') : (activeVariant?.name ?? '');
                  return secondary ? <div className="dt2-ex-variant">{secondary}</div> : null;
                })()}
                <div className="dt2-ex-stats">
                  {cm ? (
                    <span className="dt2-ex-presc">
                      {(cm.kind === 'intervals' || cm.kind === 'power')
                        ? t('workout.cardioBlock.roundsSub', { rounds: cm.rounds ?? ex.sets, work: cm.workSec ?? 40, rest: cm.restSec ?? 20 })
                        : `${t('workout.cardioBlock.minSub', { min: cm.minutes })}${cm.zone ? ` · ${cm.zone}` : ''}`}
                    </span>
                  ) : ex.reps != null && (
                    <span className="dt2-ex-presc">
                      {ex.sets != null ? `${ex.sets} × ${ex.reps}` : ex.reps}
                      {ex.rest != null && (
                        <span className="dt2-ex-rest"> · {ex.rest}s {t('workout.statRest')}</span>
                      )}
                    </span>
                  )}
                  {plan.partnerMode && ex.format && PARTNER_FMT_KEY[ex.format] && (
                    <span className="dt2-ex-fmt">{t(PARTNER_FMT_KEY[ex.format])}</span>
                  )}
                </div>
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
          <>
          <div className="dt2-exercises-label">{t('workout.exercisesSection')}</div>
          <div className="dt2-exercises">
            {blocks.map((b, bi) => {
              if (b.group && b.items.length >= 2) {
                const label = b.items.length === 2 ? t('workout.biset')
                  : b.items.length === 3 ? t('workout.triset')
                  : t('workout.superset');
                const supersetOrdinal = blocks.slice(0, bi + 1).filter(x => x.group && x.items.length >= 2).length;
                const blockRest = b.items[b.items.length - 1].ex.rest;
                return (
                  <div key={`grp-${bi}`} className="dt2-superset">
                    <div className="dt2-superset-head">
                      <span className="dt2-superset-badge"><Zap size={11} strokeWidth={2.5} /> {label} {String(supersetOrdinal).padStart(2, '0')}</span>
                      <span className="dt2-superset-how">{t('workout.supersetHow')}</span>
                      {blockRest != null && (
                        <span className="dt2-superset-rest">{blockRest}s {t('workout.restAtEnd')}</span>
                      )}
                    </div>
                    <div className="dt2-superset-items">
                      {b.items.map(({ ex, i }, idx) => (
                        <div className="dt2-superset-row" key={i}>
                          <span className="dt2-superset-num">{String(idx + 1).padStart(2, '0')}</span>
                          {renderCard(ex, i)}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
              return b.items.map(({ ex, i }) => renderCard(ex, i));
            })}
          </div>
          </>
        );
      })()}

      {plan.note && (
        <div className="dt2-note">
          <p className="dt2-note-text">{plan.note}</p>
        </div>
      )}

      {/* 03 · CARDIO ESTRUCTURADO — PARTE DE LA RUTINA prescrita (no footer): va junto a la fuerza,
          ANTES de "otra actividad". Pending → CTA "Continuar con cardio"; done → indicador colapsado.
          Ejecuta el spec SELLADO como sesión SEPARADA (modality='cardio'), sin reemplazar la fuerza. */}
      {composedCardioSpec && buildComposedCardio && (
        composedCardioSpec.done === true ? (
          <div className="dt2-composed-cardio is-done">
            <span className="dt2-cc-num is-done"><Check size={13} strokeWidth={2.6} /></span>
            <span className="dt2-cc-title">{t('workout.composedCardio.done')}</span>
          </div>
        ) : !composedCardioSatisfied ? (
          // F2C-1 MUST FIX 2 · solo se ofrece si la necesidad estructurada sigue vigente (no satisfecha por otro cardio).
          <div className="dt2-composed-cardio">
            <div className="dt2-cc-head">
              <span className="dt2-cc-num">03</span>
              <span className="dt2-cc-title">{t('workout.composedCardio.title')}</span>
            </div>
            <p className="dt2-cc-meta">
              <Clock size={12} strokeWidth={2} /> {t('workout.minApprox', { n: composedCardioSpec.minutes })}
              {' · '}
              {t(composedCardioSpec.intensityCeiling === 'zona2' ? 'workout.composedCardio.zona2' : 'workout.composedCardio.moderate')}
              {' · '}{t('workout.composedCardio.partOfRoutine')}
            </p>
            <button type="button" className="dt2-cc-cta" onClick={startComposedCardio}>
              <Play size={14} strokeWidth={2} fill="currentColor" /> {t('workout.composedCardio.start')}
            </button>
          </div>
        ) : null
      )}

      {/* Actividad alterna — "hoy no hice esto, pero hice esto". Oculta en sesión
          de pareja (es obvio que están haciendo la rutina juntos). */}
      {!plan.partnerMode && (
        <button type="button" className="dt2-alt-activity" onClick={() => setActivityOpen(true)}>
          <span className="dt2-alt-activity-q">{t('activityLog.detailQuestion')}</span>
          <span className="dt2-alt-activity-cta">{t('activityLog.detailCta')}<ArrowRight size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden /></span>
        </button>
      )}

      {activityOpen && <ActivityLogSheet onClose={() => setActivityOpen(false)} />}

      {selectedExercise && (
        <ExerciseDetailPopout
          exercise={selectedExercise.exercise}
          planData={selectedExercise.planData}
          userEquipment={[selectedEquipment]}
          allowedImplements={allowedImplements}
          activeVariantId={plan.exercises[selectedExercise.index]?.variantId}
          onSelectVariant={onSelectVariant
            ? (variantId) => onSelectVariant(selectedExercise.index, variantId)
            : undefined}
          onClose={() => setSelectedExercise(null)}
        />
      )}

      {/* F2B-1 UX (item 3) · TRANSICIÓN Fuerza→Cardio: al completar la fuerza con cardio pendiente NO
          se vuelve al plan a "buscar" el cardio escondido — se ofrece continuar como sesión continua.
          NO auto-inicia (botón explícito) y "Ahora no" lo deja pending (sin marcar done). */}
      {cardioHandoff && composedCardioPending && !composedCardioSatisfied && composedCardioSpec && buildComposedCardio && (
        <div className="dt2-cardio-handoff">
          <div className="dt2-handoff-card">
            <span className="dt2-handoff-done"><Check size={18} strokeWidth={2.6} /> {t('workout.composedCardio.strengthDone')}</span>
            <p className="dt2-handoff-next">{t('workout.composedCardio.next')}</p>
            <p className="dt2-handoff-meta">
              <Clock size={13} strokeWidth={2} /> {t('workout.minApprox', { n: composedCardioSpec.minutes })}
              {' · '}{t(composedCardioSpec.intensityCeiling === 'zona2' ? 'workout.composedCardio.zona2' : 'workout.composedCardio.moderate')}
            </p>
            <button type="button" className="dt2-handoff-cta" onClick={startComposedCardio}>
              <Play size={15} strokeWidth={2} fill="currentColor" /> {t('workout.composedCardio.continue')}
            </button>
            <button type="button" className="dt2-handoff-later" onClick={() => setCardioHandoff(false)}>
              {t('workout.composedCardio.later')}
            </button>
          </div>
        </div>
      )}

      {/* WorkoutPlayer overlay full-screen — fuerza/cardio · lazy + Suspense */}
      {workoutPlayerOpen && plan.exercises.length > 0 && (
        <Suspense fallback={<PlayerLoadingFallback />}>
        <WorkoutPlayer
          workout={plan}
          exerciseBank={exerciseBank}
          userEquipment={[selectedEquipment]}
          allowedImplements={allowedImplements}
          onSessionMutate={onSessionMutate}
          // F2B-1 · si hay cardio COMPUESTO pendiente, ocultar el "Añadir cardio" manual genérico
          // (item 11) → no se generan dos sesiones distintas. Con cardio hecho o sin composed, vuelve.
          onAddCardio={!planIsCardio && !composedCardioPending ? onAddCardio : undefined}
          // D1 · "Generarme más" solo tras FUERZA (no cardio). El CTA del player cierra (onClose) y
          // delega al padre, que recalcula el déficit fresco (incluida esta sesión ya persistida).
          onGenerateMore={!planIsCardio ? onGenerateMore : undefined}
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
            // OJO: fecha LOCAL (dayKey), no UTC de toISOString — si no, de noche en
            // husos negativos el ✓ quedaba bajo la llave de "mañana" y no se veía.
            // P2-B · toda la sesión se atribuye al día SELLADO al generar (checks, perfRecords,
            // rir, historial) → coherente aunque el workout cruce medianoche. Fallback: hoy local.
            const checkDay = (plan as { sessionDate?: string }).sessionDate ?? dayKey(new Date());
            const setWorkoutCheck = useAppStore.getState().setWorkoutCheck;

            // FUENTE DE VERDAD del historial = lo REALMENTE ejecutado (swaps aplicados por el
            // player). Si el usuario cambió A→B, `data.exercises[i]` es B → history/progresión
            // bajo B, y A (del plan original) queda intacto. Fallback al plan por compat.
            const executed = data.exercises ?? plan.exercises;
            const exercisesLog: ExerciseLogItem[] = executed.map((ex, i) => {
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

            // P1 · DELOAD: la sesión de descarga es una intervención planeada con carga
            // reducida a propósito. NO debe contaminar las capas de aprendizaje:
            //  · no actualiza lastExercisePerformance (baseline/e1RM/"peso a batir") → el
            //    regreso post-deload retoma el peso real previo, no el ligero de la descarga;
            //  · no registra RIR para calibración (un set fácil a propósito no es evidencia).
            const isDeloadSession = (plan as { isDeload?: boolean }).isDeload === true;
            // F2C-9B.2 · este handler es COMPARTIDO por fuerza y cardio dedicado/manual (sessionModality).
            // Solo una sesión de DOMINIO fuerza puede escribir estado de aprendizaje de fuerza
            // (lastExercisePerformance / rirLog). Una sesión cardio jamás lo alimenta, aunque su
            // exercises[] traiga un movimiento de fuerza con kg/reps/RIR reales (caso 9B.3).
            const isStrengthSession = isStrengthDomainSession({ modality: sessionModality });

            // Guarda el desempeño por ejercicio (para "la vez pasada: NkgxR" en el
            // próximo entreno). Solo series con carga/reps reales (no saltadas).
            const perfRecords = exercisesLog
              .filter(e => e.performed && !e.performed.skipped)
              .map(e => ({
                exerciseId: e.exercise_id,
                date: checkDay,
                sets: (e.performed!.sets.filter((s): s is LoggedSet => s != null) as LoggedSet[])
                  .filter(s => s.reps > 0 || s.kg > 0),
              }))
              .filter(r => r.sets.length > 0);
            if (isStrengthSession && !isDeloadSession && perfRecords.length > 0) useAppStore.getState().recordExercisePerformance(perfRecords);

            // P6 · extrae observaciones de RIR real (solo series donde el usuario lo
            // reportó) → alimenta la calibración de carga (P2) y la tendencia crónica.
            // En deload NO se capturan (rirRelevant=false) y aquí se omite por seguridad.
            const rirObs = isDeloadSession ? [] : executed.flatMap((ex, i) =>
              (performedByExercise[i] || [])
                .filter((s): s is LoggedSet => s != null && s.rir != null)
                .map(s => ({
                  date: checkDay,
                  exerciseId: ex.id,
                  prescribedRir: s.prescribedRir ?? ex.rir ?? 0,
                  actualRir: s.rir!,
                  reps: s.reps,
                  kg: s.kg,
                })),
            );
            if (isStrengthSession && rirObs.length > 0) useAppStore.getState().addRirObservations(rirObs);

            // DEV-only: trace estructurado del contrato PRESCRITO ≠ EJECUTADO ≠ GUARDADO.
            logE2ETrace({
              config: { modality: sessionModality, dayType: todayDecision.type, equipment: selectedEquipment, durationMin: selectedTime, isDeload: isDeloadSession, partner: !!plan.partnerMode },
              player: {
                exercisesCompleted: data.exercisesCompleted, exercisesTotal: plan.exercises.length,
                durationSec: data.durationSeconds,
                loggedSets: (data.loggedSets ?? []).filter(Boolean).length,
                unconfirmedReps: (data.loggedSets ?? []).filter((s): s is NonNullable<typeof s> => !!s && s.repsUnconfirmed === true).length,
              },
              persistence: {
                exercises: exercisesLog.filter(e => e.performed && !e.performed.skipped).map(e => ({
                  id: e.exercise_id,
                  prescribed: `${e.planned?.sets ?? '?'}×${e.planned?.reps ?? '?'}`,
                  saved: (e.performed!.sets.filter(Boolean) as LoggedSet[]).map(s => `${s.reps}${s.repsUnconfirmed ? '?' : ''}@${s.kg}`),
                })),
                recordedForProgression: !isDeloadSession,
              },
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
              isDeload: (plan as { isDeload?: boolean }).isDeload === true, // P1 · marca la sesión de descarga
              // P2-B · día SELLADO al generar (no el reloj de fin) → la sesión que cruza medianoche
              // pertenece a su día de inicio (racha/historial coherentes).
              sessionDate: (plan as { sessionDate?: string }).sessionDate ?? checkDay,
              // D1 · propaga el origen (supplemental) → CompletedSession.source. Plan normal = undefined
              // (prescribed). NO cambia modality: un supplemental de fuerza sigue siendo 'fuerza'.
              source: (plan as { source?: 'prescribed' | 'supplemental' | 'manual' }).source,
              // Fase 3 · crédito compartido: liga la sesión al OTRO. En el device de B el "otro"
              // es el owner (A), no B mismo → si soy B, el partner es ownerId; si soy A, es partnerId.
              partnerUserId: plan.partnerMode
                ? ((userId && (plan as { ownerId?: string | null }).ownerId && userId !== (plan as { ownerId?: string | null }).ownerId)
                    ? ((plan as { ownerId?: string | null }).ownerId ?? null)          // soy B → el otro es A (owner)
                    : ((plan as { partnerId?: string | null }).partnerId ?? null))      // soy A → el otro es B (partner)
                : null,
              partnerName: plan.partnerMode ? (plan.partnerName ?? null) : null,
            }, addCompletedSession, markActiveDay, {
              enqueue: useAppStore.getState().enqueuePendingWorkout,
              dequeue: useAppStore.getState().dequeuePendingWorkout,
            }).catch(() => {});

            setWorkoutPlayerOpen(false);
            // F2B-1 UX (item 3) · si esta sesión de fuerza trae cardio compuesto pendiente, no volver al
            // plan a "buscar" el cardio: ofrecer la transición continua Fuerza→Cardio. NO auto-inicia.
            if (composedCardioPending && !composedCardioSatisfied) setCardioHandoff(true);
          }}
        />
        </Suspense>
      )}

      {/* F2B-1 · player de la sesión CARDIO COMPUESTA — sesión SEPARADA (modality='cardio'). Reutiliza
          WorkoutPlayer SIN modificarlo: solo se le pasa el workout de cardio construido del spec sellado.
          El plan de fuerza NO se reemplaza; al terminar se marca composedCardio.done y persiste igual. */}
      {composedCardioActive && composedCardioActive.exercises.length > 0 && (
        <Suspense fallback={<PlayerLoadingFallback />}>
        <WorkoutPlayer
          workout={composedCardioActive}
          exerciseBank={exerciseBank}
          userEquipment={[selectedEquipment]}
          allowedImplements={allowedImplements}
          onClose={() => setComposedCardioActive(null)}
          onComplete={(data) => {
            const userId = useAppStore.getState().user?.id ?? null;
            const cardioExs = composedCardioActive.exercises;
            const performedByExercise = groupLoggedSetsByExercise(data.loggedSets, cardioExs);
            const completedAtIso = new Date().toISOString();
            const checkDay = (plan as { sessionDate?: string }).sessionDate ?? dayKey(new Date());
            const executed = data.exercises ?? cardioExs;
            const exercisesLog: ExerciseLogItem[] = executed.map((ex, i) => {
              const setsForExercise = performedByExercise[i] || [];
              const hasAnyData = setsForExercise.length > 0;
              const allSkipped = hasAnyData && setsForExercise.every(s => s === null);
              return {
                exercise_id: ex.id, order: i,
                planned: { sets: ex.sets, reps: ex.reps, rest: ex.rest },
                ...(hasAnyData && { performed: { sets: setsForExercise, skipped: allSkipped, completed_at: completedAtIso } }),
              };
            });
            // CompletedSession #2 (cardio) — ledger de fuerza/progresión/e1RM intactos (modality='cardio').
            finishWorkoutSession({
              userId, modality: 'cardio', exercises: exercisesLog,
              exercisesCompleted: data.exercisesCompleted, exercisesTotal: cardioExs.length,
              durationSeconds: data.durationSeconds,
              targetDurationSeconds: (composedCardioSpec?.minutes ?? 0) * 60,
              equipment: selectedEquipment, dayType: 'cardio',
              generationMethod: 'ai_generated', loggedSets: data.loggedSets, isDeload: false,
              sessionDate: checkDay,
            }, addCompletedSession, markActiveDay, {
              enqueue: useAppStore.getState().enqueuePendingWorkout,
              dequeue: useAppStore.getState().dequeuePendingWorkout,
            }).catch(() => {});
            // Marca done=true en el MISMO plan de fuerza y persiste (no lo reemplaza) → no re-ofrecer.
            onComposedCardioDone?.();
            setComposedCardioActive(null);
          }}
        />
        </Suspense>
      )}
    </div>
  );
}
