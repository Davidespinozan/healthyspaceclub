import { dayKey } from '../utils/localDate';
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Pause, Play, Check, Pencil, Minus, Plus, ChevronRight, Zap, Clock, Camera, Info } from 'lucide-react';
import CreatePostModal from './CreatePostModal';
import ExerciseDetailPopout from './ExerciseDetailPopout';
import { translateMuscle, translateDifficulty } from '../utils/exerciseMeta';
import { haptics } from '../utils/haptics';
import { useWakeLock } from '../hooks/useWakeLock';
import { usePartnerPresence } from '../hooks/usePartnerPresence';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import { useT } from '../i18n';
import { getExerciseIcon } from '../utils/muscleGroupIcon';
import { selectVariantForEquipment } from '../utils/workoutPlanner';
import { parseRepsToNumber } from '../utils/workoutLogger';
import {
  buildExecutionSequence,
  initLoggedByExercise,
  setLogAt,
  flattenByExercise,
  lastKgForExercise,
  setsDoneForExercise,
  computeSessionStats,
  buildOnCompletePayload,
  type LoggedByExercise,
} from '../utils/workoutSession';
import type { Exercise, Equipment, LoggedSet } from '../types';
import type { CachedWorkout } from '../utils/workoutCache';
import './workout-player.css';

// Flow-1: phase 'prep' eliminado — el WorkoutPlan (cream) ya es la antesala
// con toda la info (lista, tips, calentamiento, POR QUÉ HOY, enfriamiento).
// El player abre directo en 'exercise'. Si hay resume state, se detecta
// en el useEffect de mount (no en una pantalla intermedia).
type PlayerPhase = 'warmup' | 'exercise' | 'paused' | 'completed';

interface Props {
  workout: CachedWorkout;
  exerciseBank: Exercise[];
  userEquipment: Equipment[];
  onComplete: (data: {
    exercisesCompleted: number;
    totalSetsCompleted: number;
    durationSeconds: number;
    loggedSets: Array<LoggedSet | null>;
  }) => void;
  onClose: () => void;
}

const PROGRESS_KEY = 'workout-player-progress';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Hash simple del plan para validar que el progreso guardado es del MISMO plan. */
function buildPlanHash(workout: CachedWorkout): string {
  return workout.exercises.map(e => e.id).join(',');
}

export default function WorkoutPlayer({
  workout,
  exerciseBank,
  userEquipment,
  onComplete,
  onClose,
}: Props) {
  const { t } = useT();
  const exerciseMap = useMemo(
    () => new Map(exerciseBank.map(e => [e.id, e])),
    [exerciseBank],
  );
  const exercises = workout.exercises;
  const planHash = buildPlanHash(workout);

  // Secuencia de ejecución (intercala superseries por vuelta). El player camina
  // por `currentStep`; las series se guardan POR EJERCICIO (2D) y se aplanan al
  // finalizar → el contrato downstream (racha/Supabase) queda idéntico.
  const sequence = useMemo(() => buildExecutionSequence(exercises), [exercises]);
  const blockId = useMemo(
    () => (exIndex: number) => exercises[exIndex]?.group || `__solo_${exIndex}`,
    [exercises],
  );

  // Bloques de la sesión: cada estación es un run de ejercicios CONSECUTIVOS con
  // el mismo `group` (superserie), o un ejercicio suelto. Fuente única de verdad
  // de la estructura de bloques — mismo criterio que buildExecutionSequence.
  const blocks = useMemo(() => {
    const result: number[][] = [];
    let i = 0;
    while (i < exercises.length) {
      const g = exercises[i].group;
      if (g) {
        const run: number[] = [];
        let j = i;
        while (j < exercises.length && exercises[j].group === g) { run.push(j); j++; }
        result.push(run);
        i = j;
      } else {
        result.push([i]);
        i++;
      }
    }
    return result;
  }, [exercises]);
  const totalBlocks = blocks.length;

  // Auto-resume: lee el progreso guardado (mismo plan/día) UNA vez para
  // inicializar el estado en el primer render — sin diálogo confirm (que en PWA
  // se auto-cancelaba) y sin flash de "ejercicio 1".
  const savedProgress = useMemo(() => {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      const today = dayKey(new Date());
      if (d && d.version === 2 && d.workoutDate === today && d.planHash === planHash
          && typeof d.currentStep === 'number' && d.currentStep >= 0
          && d.currentStep < sequence.length && Array.isArray(d.loggedByExercise)) {
        return d as { currentStep: number; loggedByExercise: LoggedByExercise; startedAt?: number };
      }
    } catch { /* noop */ }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── State
  // Arranque GUIADO: si hay calentamiento y NO estamos retomando una sesión,
  // la primera pantalla es el calentamiento (antes vivía en la vista previa del
  // plan, que saturaba). Si se retoma, vamos directo a ejercicio.
  const [phase, setPhase] = useState<PlayerPhase>(
    () => (!savedProgress && (workout as CachedWorkout).warmup ? 'warmup' : 'exercise'),
  );
  const [shareOpen, setShareOpen] = useState(false);
  const [showSpecs, setShowSpecs] = useState(false); // popout de técnica/specs encima del player
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [videoAspect, setVideoAspect] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState(() => savedProgress?.currentStep ?? 0);
  const [loggedByExercise, setLoggedByExercise] = useState<LoggedByExercise>(() => savedProgress?.loggedByExercise ?? initLoggedByExercise(exercises));
  const [restState, setRestState] = useState<{ secondsLeft: number } | null>(null);
  const [editingSet, setEditingSet] = useState<{ exerciseIndex: number; setIndex: number } | null>(null);
  const [editValues, setEditValues] = useState<LoggedSet>({ reps: 0, kg: 0 });
  const [startedAt, setStartedAt] = useState<number>(() => savedProgress?.startedAt ?? Date.now());
  const [pausedFromPhase, setPausedFromPhase] = useState<PlayerPhase | null>(null);
  // Cronómetro de sesión (segundos desde el inicio). Tiempo de reloj — coincide
  // con la duración que se registra al terminar (computeSessionStats usa now-startedAt).
  const [elapsedSec, setElapsedSec] = useState(0);

  // ── Derived del step actual
  const step = sequence[currentStep];
  const currentExerciseIndex = step?.exIndex ?? Math.max(0, exercises.length - 1);
  const currentSetNum = step?.setNum ?? 1;
  const currentEx = exercises[currentExerciseIndex];
  const currentBank = currentEx ? exerciseMap.get(currentEx.id) : undefined;
  const variant = currentBank ? selectVariantForEquipment(currentBank, userEquipment) : null;
  const displayName = currentBank
    ? (variant ? `${currentBank.name} — ${variant.name}` : currentBank.name)
    : currentEx?.id || '';
  const DisplayIcon = getExerciseIcon(currentBank);
  const totalSetsForCurrent = currentEx?.sets || 1;
  const setsRegisteredForCurrent = setsDoneForExercise(loggedByExercise, currentExerciseIndex);

  // Límites de bloque (superserie = run del mismo `group`; o ejercicio suelto).
  const isBlockEnd = (stepIdx: number): boolean => {
    if (stepIdx >= sequence.length - 1) return true;
    return blockId(sequence[stepIdx + 1].exIndex) !== blockId(sequence[stepIdx].exIndex);
  };
  const nextBlockStartFrom = (stepIdx: number): number => {
    const cur = blockId(sequence[stepIdx]?.exIndex ?? 0);
    let k = stepIdx + 1;
    while (k < sequence.length && blockId(sequence[k].exIndex) === cur) k++;
    return k;
  };
  const currentSetMarked = !!loggedByExercise[currentExerciseIndex]?.[currentSetNum - 1];
  const atBlockEnd = step ? isBlockEnd(currentStep) : true;
  const blockComplete = atBlockEnd && currentSetMarked; // muestra CTA siguiente/terminar
  const isLastBlock = nextBlockStartFrom(currentStep) >= sequence.length;
  // Cue "sin descanso · ahora [B]" cuando el step encadena con el siguiente miembro.
  const chainedNextName = step?.chained && sequence[currentStep + 1]
    ? (exerciseMap.get(exercises[sequence[currentStep + 1].exIndex]?.id || '')?.name || '')
    : '';

  // Bloque actual (estación) y posición de la sesión, derivados de `blocks`.
  // `currentBlockNumber` es monótono (no rebota): una superserie cuenta como una
  // sola estación aunque el recorrido vuelva al ejercicio A en la siguiente vuelta.
  const currentBlockIndex = useMemo(
    () => blocks.findIndex(b => b.includes(currentExerciseIndex)),
    [blocks, currentExerciseIndex],
  );
  const currentBlockMembers = currentBlockIndex >= 0 ? blocks[currentBlockIndex] : [currentExerciseIndex];
  const currentBlockNumber = currentBlockIndex >= 0 ? currentBlockIndex + 1 : 1;

  // ── Co-presencia + turnos (Parte 2): comparto mis sets hechos y veo los del otro.
  const myId = useAppStore(s => s.user?.id) ?? null;
  const partnerMode = !!workout.partnerMode;
  const partnerId = (workout.partnerId as string | null) ?? null;
  const partnerName = workout.partnerName || '';
  const partnerAvatar = (workout.partnerAvatar as string | null) ?? null;
  const partnerLive = usePartnerPresence(partnerMode, myId, partnerId, {
    exIndex: currentExerciseIndex,
    setsDone: setsRegisteredForCurrent,
    done: phase === 'completed',
  });
  // Posición global comparable (ejercicio, sets hechos) → turnos estrictos.
  const myPos = currentExerciseIndex * 1000 + setsRegisteredForCurrent;
  const partnerPos = partnerLive ? partnerLive.exIndex * 1000 + partnerLive.setsDone : null;
  // Turnos ESTRICTOS: siempre arranca uno (determinista — el id menor). El que
  // va ATRÁS tiene el turno; en EMPATE le toca al "primero". El otro queda
  // bloqueado y ve de quién es el turno. Sin compañero en vivo (o ya terminó)
  // → sin bloqueo (fail-open, no te quedas trabado).
  const iGoFirst = !!myId && !!partnerId ? myId < partnerId : true;
  const hasLivePartner = partnerMode && !!partnerLive && !partnerLive.done && partnerPos !== null;
  const myTurn = !hasLivePartner
    ? true
    : myPos < (partnerPos as number)
      ? true
      : myPos > (partnerPos as number)
        ? false
        : iGoFirst;
  const partnerTurn = !!hasLivePartner && !myTurn;
  // Mostramos el indicador de turno a AMBOS mientras el compañero esté en vivo.
  const showTurnStrip = partnerMode && !!hasLivePartner && phase === 'exercise';
  const isSuperset = currentBlockMembers.length > 1;
  const blockBadge = currentBlockMembers.length >= 4
    ? t('workout.superset')
    : currentBlockMembers.length === 3
      ? t('workout.triset')
      : t('workout.biset');
  const blockPosition = isSuperset ? currentBlockMembers.indexOf(currentExerciseIndex) : -1;

  // ── Wake lock + body scroll lock + ESC handler

  useWakeLock(phase === 'exercise');

  // Video del ejercicio actual: del bank si lo trae, si no de exercise_videos
  // (la tabla). Antes el player SIEMPRE mostraba 'video próximamente'.
  useEffect(() => {
    let active = true;
    setVideoAspect(null);
    const bankVideo = (currentBank?.videos as { url: string }[] | undefined)?.[0]?.url;
    if (bankVideo) { setCurrentVideoUrl(bankVideo); return; }
    setCurrentVideoUrl(null);
    const exId = currentBank?.id;
    const varId = variant?.id;
    if (!exId) return;
    (async () => {
      try {
        // Video acorde al EQUIPO del usuario:
        // - En gym los implementos (barra/mancuerna/máquina) son intercambiables
        //   → cualquier variante de gym sirve (el movimiento manda).
        // - En casa/ligas NO: solo variantes que coincidan con su equipo (no le
        //   mostramos un video de máquina a quien entrena en casa).
        const matchEquip = (currentBank?.variants ?? [])
          .filter(v => v.equipment.some(e => userEquipment.includes(e)))
          .map(v => v.id);
        const ids = [exId, ...matchEquip];
        const { data } = await supabase
          .from('exercise_videos')
          .select('exercise_id, video_url, display_order')
          .in('exercise_id', ids)
          .order('display_order', { ascending: true });
        if (!active || !data || data.length === 0) return;
        const row = (varId && data.find(r => r.exercise_id === varId))
          || data.find(r => r.exercise_id === exId)
          || data[0];
        if (row?.video_url) setCurrentVideoUrl(row.video_url);
      } catch { /* noop */ }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBank?.id, variant?.id]);

  // Cronómetro de sesión: tick cada segundo mientras se entrena (o en pausa, para
  // que coincida con la duración de reloj que se guarda al terminar).
  useEffect(() => {
    if (phase !== 'exercise' && phase !== 'paused') return;
    const tick = () => setElapsedSec(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase, startedAt]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSpecs) return; // el popout de técnica maneja su propio ESC
        if (editingSet) { saveEditSet(); return; }
        handleExit();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, editingSet, showSpecs]);

  // ── localStorage autosave (shape v2 — currentStep + store 2D).
  useEffect(() => {
    if (phase === 'exercise' || phase === 'paused') {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({
        workoutDate: dayKey(new Date()),
        planHash,
        version: 2,
        currentStep,
        loggedByExercise,
        startedAt,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentStep, loggedByExercise]);

  // ── Rest countdown (non-blocking, solo informa)
  useEffect(() => {
    if (!restState || phase !== 'exercise') return;
    const interval = setInterval(() => {
      setRestState(prev => {
        if (!prev) return prev;
        if (prev.secondsLeft <= 1) return null;
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [restState, phase]);

  // ── Handlers (lógica delegada a src/utils/workoutSession.ts)

  // El resume ahora se aplica en los inicializadores de estado (savedProgress),
  // sin diálogo. Aquí solo limpiamos un guardado inválido (otro plan/día) para
  // no acumular basura en localStorage.
  useEffect(() => {
    if (savedProgress) return;
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      const today = dayKey(new Date());
      if (!d || d.workoutDate !== today || d.planHash !== planHash) {
        localStorage.removeItem(PROGRESS_KEY);
      }
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Marca el set actual del paso. Si es el último paso del bloque (atBlockEnd)
  // NO auto-avanza: aparece la CTA "siguiente bloque". En cualquier otro paso
  // avanza al siguiente step y arma el descanso (restAfter=0 → encadenado, sin
  // descanso, pasa directo al siguiente ejercicio del bloque).
  function markCurrentSet() {
    // Turnos: no puedes adelantarte a tu compañero (debe alcanzarte primero).
    if (partnerTurn) return;
    if (!step || currentSetMarked || !currentEx) return;
    haptics.tap();
    const entry: LoggedSet = {
      reps: parseRepsToNumber(currentEx.reps),
      kg: lastKgForExercise(loggedByExercise, currentExerciseIndex),
    };
    setLoggedByExercise(prev => setLogAt(prev, currentExerciseIndex, currentSetNum - 1, entry));
    // Marca el ejercicio como hecho en Hoy en cuanto se completa (en vivo, no
    // solo al terminar la sesión) — así la lista de Hoy refleja el avance.
    if (setsRegisteredForCurrent + 1 >= totalSetsForCurrent && currentEx.id) {
      const today = dayKey(new Date());
      try { useAppStore.getState().setWorkoutCheck(`${today}-${currentEx.id}`, true); } catch { /* noop */ }
    }
    if (atBlockEnd) {
      setRestState(null);
    } else {
      setCurrentStep(currentStep + 1);
      setRestState(step.restAfter > 0 ? { secondsLeft: step.restAfter } : null);
    }
  }

  function openEditSet(exerciseIdx: number, setIdx: number) {
    const entry = loggedByExercise[exerciseIdx]?.[setIdx];
    if (!entry) return; // null (skipped) o undefined → no editable
    setEditingSet({ exerciseIndex: exerciseIdx, setIndex: setIdx });
    setEditValues({ reps: entry.reps, kg: entry.kg });
  }

  function saveEditSet() {
    if (!editingSet) return;
    setLoggedByExercise(prev => setLogAt(prev, editingSet.exerciseIndex, editingSet.setIndex, {
      reps: Math.max(0, editValues.reps),
      kg: Math.max(0, editValues.kg),
    }));
    setEditingSet(null);
  }

  function skipRest() {
    setRestState(null);
  }

  // Avanza al inicio del siguiente bloque. Los sets no marcados del bloque
  // actual quedan null en el store 2D (saltados) — flattenByExercise los
  // preserva por-ejercicio para el payload de cierre.
  function goToNextExercise() {
    setRestState(null);
    const next = nextBlockStartFrom(currentStep);
    if (next >= sequence.length) {
      finishSession(loggedByExercise);
    } else {
      setCurrentStep(next);
    }
  }

  function finishSession(logged: LoggedByExercise) {
    const payload = buildOnCompletePayload(flattenByExercise(logged), startedAt, Date.now(), exercises);
    localStorage.removeItem(PROGRESS_KEY);
    haptics.success();
    setPhase('completed');
    onComplete(payload);
  }

  // Calentamiento → ejercicios. Reiniciamos el cronómetro aquí para no contar el
  // tiempo de lectura del calentamiento dentro de la duración del entrenamiento.
  function startExercises() {
    haptics.tap();
    setStartedAt(Date.now());
    setPhase('exercise');
  }

  function handlePause() {
    if (phase === 'paused') {
      setPhase(pausedFromPhase || 'exercise');
      setPausedFromPhase(null);
    } else if (phase === 'exercise') {
      setPausedFromPhase(phase);
      setPhase('paused');
    }
  }

  function handleExit() {
    if (phase === 'completed') {
      onClose();
      return;
    }
    if (confirm(t('workout.exitConfirm'))) {
      onClose();
    }
  }

  // ── Stats para pantalla completed
  const completedStats = useMemo(
    () => computeSessionStats(flattenByExercise(loggedByExercise), startedAt, Date.now(), exercises),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase],
  );

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════

  const progressPct = sequence.length > 0
    ? Math.round((currentStep / sequence.length) * 100)
    : 0;

  return createPortal(
    <div className="wp">
      {/* Header siempre visible */}
      <div className="wp-header">
        <button className="wp-header-btn" onClick={handleExit} aria-label={t('workout.close')}>
          <X size={20} />
        </button>
        <div className="wp-header-title">
          {phase === 'completed'
            ? <em>{t('workout.completed')}</em>
            : phase === 'warmup'
              ? <em>{t('workout.warmup')}</em>
              : <>{t('workout.exercise')} {currentBlockNumber} <span className="wp-header-of">{t('workout.of')}</span> {totalBlocks}</>}
        </div>
        <div className="wp-header-counter">
          {phase === 'exercise' || phase === 'paused' ? (
            <>
              <span className={`wp-timer${phase === 'paused' ? ' is-paused' : ''}`} aria-label={t('workout.elapsed')}>
                <Clock size={13} strokeWidth={2} />
                {formatTime(elapsedSec)}
              </span>
              <button
                className="wp-header-btn"
                onClick={handlePause}
                aria-label={phase === 'paused' ? t('workout.resume') : t('workout.pause')}
              >
                {phase === 'paused' ? <Play size={18} /> : <Pause size={18} />}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* Barra de progreso (solo en exercise) */}
      {phase === 'exercise' && (
        <div className="wp-progress-bar">
          <div className="wp-progress-bar-fill" style={{ width: `${progressPct}%` }} />
        </div>
      )}

      {/* ── PHASE: WARMUP (calentamiento guiado, antes de los ejercicios) ── */}
      {phase === 'warmup' && (
        <div className="wp-prep">
          <div className="wp-prep-card">
            <div className="wp-prep-section-label">{t('workout.warmup')}</div>
            <p className="wp-prep-section-text">{(workout as CachedWorkout).warmup}</p>
            <button className="wp-cta" onClick={startExercises}>
              {t('workout.warmupCta')}
            </button>
          </div>
        </div>
      )}

      {/* ── Indicador de turno: visible para AMBOS. "Tu turno" (verde, vas tú)
            o "Es turno de X" (dorado, esperas al compañero). ── */}
      {showTurnStrip && (
        myTurn ? (
          <div className="wp-turn wp-turn--mine">
            <span className="wp-turn-dot-live" />
            <span className="wp-turn-text">{t('workout.yourTurn')}</span>
          </div>
        ) : (
          <div className="wp-turn">
            {partnerAvatar
              ? <img className="wp-turn-av" src={partnerAvatar} alt="" />
              : <span className="wp-turn-av wp-turn-av--fb">{(partnerName.trim().charAt(0) || '?').toUpperCase()}</span>}
            <span className="wp-turn-text">{t('workout.partnerTurn', { name: partnerName })}</span>
            <span className="wp-turn-dots"><i /><i /><i /></span>
          </div>
        )
      )}

      {/* ── PHASE: EXERCISE (1 pantalla por ejercicio con filas de series) ── */}
      {phase === 'exercise' && currentEx && (
        <div className={`wp-active${restState ? ' has-rest' : ''}`} key={`ex-${currentExerciseIndex}`}>
          <div
            className="wp-video-area"
            style={videoAspect ? { aspectRatio: String(Math.min(1.9, Math.max(0.5, videoAspect))) } : undefined}
          >
            {currentVideoUrl ? (
              <video
                key={currentVideoUrl}
                src={currentVideoUrl}
                className="wp-video"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                onLoadedMetadata={e => {
                  const v = e.currentTarget;
                  if (v.videoWidth && v.videoHeight) setVideoAspect(v.videoWidth / v.videoHeight);
                }}
              />
            ) : (
              <div className="wp-video-fallback">
                <div className="wp-video-emoji"><DisplayIcon size={56} strokeWidth={1.5} /></div>
                <p className="wp-video-label">{t('workout.videoSoon')}</p>
              </div>
            )}
          </div>

          <div className="wp-ex-info">
            {isSuperset && (
              <div className="wp-superset-badge">
                <Zap size={13} strokeWidth={2} />
                <span>{blockBadge}</span>
                <span className="wp-superset-pos">
                  {String.fromCharCode(65 + blockPosition)}{currentBlockMembers.length > 0 ? `/${currentBlockMembers.length}` : ''}
                </span>
              </div>
            )}
            <p className="wp-ex-micro">
              {currentBank?.muscleGroup ? translateMuscle(currentBank.muscleGroup, t) : ''}
              {currentBank?.muscleGroup && currentBank?.difficulty ? ' · ' : ''}
              {currentBank?.difficulty ? translateDifficulty(currentBank.difficulty, t) : ''}
            </p>
            <h2 className="wp-ex-name">{displayName}</h2>
            {currentBank && (
              <button type="button" className="wp-ex-technique" onClick={() => setShowSpecs(true)}>
                <Info size={14} strokeWidth={2} />
                <span>{t('workout.seeTechnique')}</span>
              </button>
            )}
            {variant?.notes && (
              <p className="wp-ex-notes">{variant.notes}</p>
            )}
            {currentEx.tip_personalizado && (
              <p className="wp-ex-tip">{currentEx.tip_personalizado}</p>
            )}
          </div>

          <div className="wp-sets">
            <div className="wp-sets-head">
              <span className="wp-sets-label">
                {isSuperset
                  ? t('workout.supersetRound', { n: currentSetNum, total: totalSetsForCurrent })
                  : <>{t('workout.setsLabel')} · {totalSetsForCurrent} × {currentEx.reps}</>}
              </span>
              <span className="wp-sets-counter">
                {Math.min(setsRegisteredForCurrent, totalSetsForCurrent)} {t('workout.of')} {totalSetsForCurrent}
              </span>
            </div>
            <div className="wp-set-rows">
              {Array.from({ length: totalSetsForCurrent }).map((_, setIdx) => {
                const entry = (loggedByExercise[currentExerciseIndex] || [])[setIdx];
                const isDone = entry != null;
                const isActive = !isDone && setIdx === currentSetNum - 1;
                // null en una posición ya superada por la vuelta actual = saltada
                const isSkipped = entry == null && setIdx < currentSetNum - 1;

                const rowClass = `wp-set-row${
                  isDone ? ' done' : isSkipped ? ' skipped' : isActive ? ' active' : ' future'
                }`;

                return (
                  <button
                    key={setIdx}
                    type="button"
                    className={rowClass}
                    onClick={() => {
                      if (isDone) openEditSet(currentExerciseIndex, setIdx);
                      else if (isActive) markCurrentSet();
                    }}
                    disabled={(!isActive && !isDone) || (isActive && partnerTurn)}
                  >
                    <span className="wp-set-row-circle">
                      {isDone && <Check size={14} strokeWidth={2} />}
                    </span>
                    <span className="wp-set-row-label">
                      {t('workout.set')} {setIdx + 1}
                      {isDone && entry && (
                        <span className="wp-set-row-vals"> · {entry.reps} {t('workout.repsLower')} · {entry.kg}kg</span>
                      )}
                      {isSkipped && (
                        <span className="wp-set-row-vals wp-set-row-vals--muted"> · {t('workout.skipped')}</span>
                      )}
                      {isActive && !chainedNextName && (
                        <span className="wp-set-row-hint"> · {t('workout.tapToMark')}</span>
                      )}
                      {isActive && chainedNextName && (
                        <span className="wp-set-row-hint wp-set-row-hint--chain"> · {t('workout.supersetNext')} {chainedNextName}</span>
                      )}
                    </span>
                    <span className="wp-set-row-icon">
                      {isDone ? <Pencil size={14} strokeWidth={1.6} /> : isActive ? <ChevronRight size={16} /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="wp-cta-wrap">
            {/* No se avanza de ejercicio hasta terminar TODOS los sets (solo y
                pareja); en pareja, además hasta que el compañero alcance. */}
            <button
              className={`wp-cta${(!blockComplete || partnerTurn) ? ' wp-cta-locked' : ''}`}
              onClick={goToNextExercise}
              disabled={!blockComplete || partnerTurn}
            >
              {isLastBlock ? t('workout.finishSession') : t('workout.nextExercise')}
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── PHASE: PAUSED ── */}
      {phase === 'paused' && (
        <div className="wp-paused">
          <Pause size={48} className="wp-paused-icon" />
          <p className="wp-paused-label">{t('workout.pausedLabel')}</p>
          <p className="wp-paused-sub">
            {t('workout.pausedSub', { i: currentBlockNumber, total: totalBlocks, done: setsRegisteredForCurrent, sets: totalSetsForCurrent })}
          </p>
          <div className="wp-cta-wrap">
            <button className="wp-cta" onClick={handlePause}>
              <Play size={18} /> {t('workout.resume')}
            </button>
            <button className="wp-skip" onClick={handleExit}>
              {t('workout.exitSession')}
            </button>
          </div>
        </div>
      )}

      {/* ── PHASE: COMPLETED ── */}
      {phase === 'completed' && (
        <div className="wp-completed">
          <div className="wp-completed-check"><Check size={32} strokeWidth={2.5} /></div>
          <h2 className="wp-completed-title">{t('workout.completedTitle')}</h2>
          <div className="wp-completed-stats">
            <div className="wp-completed-stat">
              <div className="wp-completed-stat-val">{completedStats.minutes}</div>
              <div className="wp-completed-stat-lbl">min</div>
            </div>
            <div className="wp-completed-stat">
              <div className="wp-completed-stat-val">{completedStats.totalSetsCompleted}</div>
              <div className="wp-completed-stat-lbl">{t('workout.setsLower')}</div>
            </div>
            <div className="wp-completed-stat">
              <div className="wp-completed-stat-val">{completedStats.totalKg}</div>
              <div className="wp-completed-stat-lbl">{t('workout.kgTotal')}</div>
            </div>
          </div>
          {workout.cooldown && (
            <div className="wp-prep-section">
              <div className="wp-prep-section-label">{t('workout.cooldown')}</div>
              <p className="wp-prep-section-text">{workout.cooldown}</p>
            </div>
          )}
          <div className="wp-cta-wrap">
            <button className="wp-share-cta" onClick={() => setShareOpen(true)}>
              <Camera size={18} strokeWidth={2} />
              {t('post.shareFromWorkout')}
            </button>
            <button className="wp-cta" onClick={onClose}>
              {t('workout.finish')}
            </button>
          </div>
        </div>
      )}

      <CreatePostModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        context={{ kind: 'workout' }}
      />

      {/* Specs/técnica del ejercicio actual SIN salir del entrenamiento —
          mismo popout que en Hoy/plan, una sola fuente de verdad. */}
      {showSpecs && currentBank && currentEx && (
        <ExerciseDetailPopout
          exercise={currentBank}
          planData={{
            sets: totalSetsForCurrent,
            reps: currentEx.reps,
            rest: currentEx.rest,
            tip_personalizado: currentEx.tip_personalizado,
          }}
          userEquipment={userEquipment}
          compact
          onClose={() => setShowSpecs(false)}
        />
      )}

      {/* Rest bar flotante (no-bloqueante, sticky bottom) */}
      {phase === 'exercise' && restState && (
        <div className="wp-rest-bar" role="status" aria-live="polite">
          <span className="wp-rest-bar-label">
            <span className="wp-rest-bar-dot" />
            {t('workout.resting', { time: formatTime(restState.secondsLeft) })}
          </span>
          <button className="wp-rest-bar-skip" onClick={skipRest} type="button">
            {t('workout.skip')}
          </button>
        </div>
      )}

      {/* Mini-popup de ajuste reps/kg */}
      {editingSet && (
        <div className="wp-edit-backdrop" onClick={saveEditSet}>
          <div className="wp-edit-popup" onClick={e => e.stopPropagation()}>
            <div className="wp-edit-handle" />
            <div className="wp-edit-title">{t('workout.set')} {editingSet.setIndex + 1}</div>
            <div className="wp-edit-fields">
              <div className="wp-edit-field">
                <label className="wp-edit-label">{t('workout.reps')}</label>
                <div className="wp-edit-row">
                  <button
                    type="button"
                    className="wp-edit-btn"
                    onClick={() => setEditValues(v => ({ ...v, reps: Math.max(0, v.reps - 1) }))}
                    aria-label={t('workout.ariaMinusRep')}
                  >
                    <Minus size={20} />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    className="wp-edit-input"
                    value={editValues.reps}
                    onChange={e =>
                      setEditValues(v => ({ ...v, reps: Math.max(0, Number(e.target.value) || 0) }))
                    }
                  />
                  <button
                    type="button"
                    className="wp-edit-btn"
                    onClick={() => setEditValues(v => ({ ...v, reps: v.reps + 1 }))}
                    aria-label={t('workout.ariaPlusRep')}
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>

              <div className="wp-edit-field">
                <label className="wp-edit-label">{t('workout.weightKg')}</label>
                <div className="wp-edit-row">
                  <button
                    type="button"
                    className="wp-edit-btn"
                    onClick={() => setEditValues(v => ({ ...v, kg: Math.max(0, v.kg - 2.5) }))}
                    aria-label={t('workout.ariaMinusKg')}
                  >
                    <Minus size={20} />
                  </button>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="2.5"
                    className="wp-edit-input"
                    value={editValues.kg}
                    onChange={e =>
                      setEditValues(v => ({ ...v, kg: Math.max(0, Number(e.target.value) || 0) }))
                    }
                  />
                  <button
                    type="button"
                    className="wp-edit-btn"
                    onClick={() => setEditValues(v => ({ ...v, kg: v.kg + 2.5 }))}
                    aria-label={t('workout.ariaPlusKg')}
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
            </div>
            <button className="wp-edit-done" onClick={saveEditSet} type="button">
              {t('workout.done')}
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
