import { dayKey } from '../utils/localDate';
import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { X, Pause, Play, Check, Pencil, Minus, Plus, ChevronRight, Zap, Clock, Camera, Info, History, TrendingUp, RefreshCw } from 'lucide-react';
import ExerciseDetailPopout from './ExerciseDetailPopout';

const CreatePostModal = lazy(() => import('./CreatePostModal'));
const ShareStatSheet = lazy(() => import('./ShareStatSheet'));
import { translateMuscle, translateDifficulty } from '../utils/exerciseMeta';
import { track } from '../utils/analytics';
import { haptics } from '../utils/haptics';
import { useWakeLock } from '../hooks/useWakeLock';
import { usePartnerPresence } from '../hooks/usePartnerPresence';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import { useT } from '../i18n';
import { getExerciseIcon } from '../utils/muscleGroupIcon';
import { selectVariantForEquipment, hasPlayableVariant } from '../utils/workoutPlanner';
import type { WorkoutExercise } from '../utils/workoutSession';
import { parseRepsToNumber } from '../utils/workoutLogger';
import { computeProgression, incrementForMuscle } from '../utils/progression';
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
type PlayerPhase = 'warmup' | 'exercise' | 'paused' | 'finisher' | 'completed';

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

/** #3 — Alternativa para "Cambiar este ejercicio": mismo grupo muscular, con video
 *  para el equipo del usuario, que no esté ya en la rutina. null si no hay opción. */
function pickSwapAlternative(bank: Exercise[], currentId: string, equipment: Equipment[], usedIds: Set<string>): Exercise | null {
  const cur = bank.find(e => e.id === currentId);
  if (!cur) return null;
  const pool = bank.filter(ex =>
    ex.id !== currentId && !usedIds.has(ex.id) &&
    ex.muscleGroup === cur.muscleGroup && !ex.isYoga &&
    hasPlayableVariant(ex, equipment),
  );
  return pool[0] ?? null;
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
  const baseExercises = workout.exercises;
  const planHash = buildPlanHash(workout);
  // Fase 3 — bloques de la sesión (opcionales; rutinas viejas no los traen).
  const warmupBlock = (workout as CachedWorkout).warmupBlock;
  const finisherBlock = (workout as CachedWorkout).finisherBlock;

  // Secuencia de ejecución (intercala superseries por vuelta). El player camina
  // por `currentStep`; las series se guardan POR EJERCICIO (2D) y se aplanan al
  // finalizar → el contrato downstream (racha/Supabase) queda idéntico.
  const sequence = useMemo(() => buildExecutionSequence(baseExercises), [baseExercises]);
  const blockId = useMemo(
    () => (exIndex: number) => baseExercises[exIndex]?.group || `__solo_${exIndex}`,
    [baseExercises],
  );

  // Bloques de la sesión: cada estación es un run de ejercicios CONSECUTIVOS con
  // el mismo `group` (superserie), o un ejercicio suelto. Fuente única de verdad
  // de la estructura de bloques — mismo criterio que buildExecutionSequence.
  const blocks = useMemo(() => {
    const result: number[][] = [];
    let i = 0;
    while (i < baseExercises.length) {
      const g = baseExercises[i].group;
      if (g) {
        const run: number[] = [];
        let j = i;
        while (j < baseExercises.length && baseExercises[j].group === g) { run.push(j); j++; }
        result.push(run);
        i = j;
      } else {
        result.push([i]);
        i++;
      }
    }
    return result;
  }, [baseExercises]);
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
        return d as { currentStep: number; loggedByExercise: LoggedByExercise; startedAt?: number; swaps?: Record<number, WorkoutExercise> };
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
  // Cronómetro del finisher (fase guiada, saltable). Debe ir DESPUÉS de `phase`.
  const [finRunning, setFinRunning] = useState(false);
  const [finLeft, setFinLeft] = useState(0);
  useEffect(() => {
    if (phase === 'finisher' && finisherBlock) { setFinLeft(finisherBlock.minutes * 60); setFinRunning(true); }
  }, [phase, finisherBlock]);
  useEffect(() => {
    if (phase !== 'finisher' || !finRunning) return;
    const id = setInterval(() => setFinLeft(s => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, [phase, finRunning]);
  // Intervalos: alterna Fuerte/Suave cada 30 s del tiempo transcurrido.
  const finTotal = finisherBlock ? finisherBlock.minutes * 60 : 0;
  const finHard = Math.floor((finTotal - finLeft) / 30) % 2 === 0;
  const finClock = `${Math.floor(finLeft / 60)}:${String(finLeft % 60).padStart(2, '0')}`;
  const [shareOpen, setShareOpen] = useState(false);
  const [shareStatOpen, setShareStatOpen] = useState(false);
  const [showSpecs, setShowSpecs] = useState(false); // popout de técnica/specs encima del player
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [videoAspect, setVideoAspect] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState(() => savedProgress?.currentStep ?? 0);
  const [loggedByExercise, setLoggedByExercise] = useState<LoggedByExercise>(() => savedProgress?.loggedByExercise ?? initLoggedByExercise(baseExercises));
  // #3 — "Cambiar este ejercicio": override por índice. La estructura (secuencia/
  // bloques) sale de baseExercises; el render usa `exercises` con los overrides.
  const [swaps, setSwaps] = useState<Record<number, WorkoutExercise>>(() => savedProgress?.swaps ?? {});
  const exercises = useMemo(
    () => baseExercises.map((e, i) => swaps[i] ?? e),
    [baseExercises, swaps],
  );
  const [restState, setRestState] = useState<{ secondsLeft: number; total: number } | null>(null);
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
  // En gym el implemento (barra/mancuerna/máquina) NO importa y el agarre ya va en el
  // nombre del ejercicio → el título NO muestra la variante de gym. En cuerpo/ligas la
  // variante sí nombra el movimiento real (flexiones, con banda), así que se conserva.
  const varIsGymImpl = !!variant && variant.equipment.length === 1 && variant.equipment[0] === 'gym';
  const displayName = currentBank
    ? (variant && !varIsGymImpl ? `${currentBank.name} — ${variant.name}` : currentBank.name)
    : currentEx?.id || '';
  const DisplayIcon = getExerciseIcon(currentBank);
  const totalSetsForCurrent = currentEx?.sets || 1;
  const setsRegisteredForCurrent = setsDoneForExercise(loggedByExercise, currentExerciseIndex);

  // #3 — "Cambiar este ejercicio": alternativa del mismo grupo (con video, apto al
  // equipo, no repetida). Reemplaza SIN avanzar; resetea las series de ese ejercicio.
  const swapAlt = currentEx
    ? pickSwapAlternative(exerciseBank, currentEx.id, userEquipment, new Set(exercises.map(e => e.id)))
    : null;
  const canSwap = phase === 'exercise' && !!swapAlt;
  function swapCurrentExercise() {
    if (!swapAlt || !currentEx) return;
    const newEx: WorkoutExercise = { ...currentEx, id: swapAlt.id, tecnica: undefined, tip_personalizado: undefined };
    setSwaps(prev => ({ ...prev, [currentExerciseIndex]: newEx }));
    setLoggedByExercise(prev => { const c = [...prev]; c[currentExerciseIndex] = []; return c; });
    haptics.tap();
  }

  // "La vez pasada": mejor serie del último registro de este ejercicio.
  const lastExercisePerformance = useAppStore(s => s.lastExercisePerformance);
  const lastPerfLabel = (() => {
    const sets = currentEx ? lastExercisePerformance[currentEx.id]?.sets : undefined;
    if (!sets || sets.length === 0) return null;
    const top = sets.reduce((a, b) => (b.kg > a.kg || (b.kg === a.kg && b.reps > a.reps) ? b : a));
    return top.kg > 0 ? `${top.kg} kg × ${top.reps}` : `× ${top.reps}`;
  })();
  // Sobrecarga progresiva (doble progresión) a partir del historial + reps prescritas.
  const isBandExercise = variant ? variant.equipment.includes('ligas') : userEquipment.includes('ligas');
  const progression = (() => {
    const sets = currentEx ? lastExercisePerformance[currentEx.id]?.sets : undefined;
    if (!currentEx || !sets || sets.length === 0) return null;
    return computeProgression(sets, currentEx.reps, incrementForMuscle(currentBank?.muscleGroup), isBandExercise);
  })();
  const progLabel = progression
    ? (progression.kg != null && progression.kg > 0 ? `${progression.kg} kg × ${progression.reps}` : `× ${progression.reps}`)
    : null;

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
  // #2 — Un solo móvil: modo compañero SIN dispositivo conectado (invitado). No hay
  // sync en vivo ni turnos; se hace la rutina de LOS DOS en este teléfono, mostrando
  // ambas prescripciones (Tú / Compa) y avanzando juntos.
  const singleDevice = partnerMode && !partnerId;
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

  // ── Reanudar A LA PAR (fix): si te saliste de la app y reabres, no empieces
  // desde el inicio. Al montar, la PRIMERA señal en vivo del compañero nos pone a
  // su altura si va adelante (reabriste a media sesión). Una sola vez por sesión;
  // en un arranque fresco (ambos en 0) no salta. Usa el broadcast que ya existe,
  // sin depender de DB — si realtime no conecta, cae al resume local de siempre.
  const caughtUpRef = useRef(false);
  useEffect(() => {
    if (!partnerMode || caughtUpRef.current || !partnerLive || partnerLive.done) return;
    if (partnerLive.exIndex > currentExerciseIndex) {
      const target = sequence.findIndex(s => s.exIndex === partnerLive.exIndex);
      if (target >= 0) {
        caughtUpRef.current = true;
        setCurrentStep(target);
        setPhase(p => (p === 'warmup' ? 'exercise' : p)); // ya calentó; no lo mandes al warmup
      }
    } else {
      // Ya vamos a la par o adelante en la primera lectura → no re-saltar esta sesión.
      caughtUpRef.current = true;
    }
  }, [partnerMode, partnerLive, currentExerciseIndex, sequence]);
  const isSuperset = currentBlockMembers.length > 1;
  const blockBadge = currentBlockMembers.length >= 4
    ? t('workout.superset')
    : currentBlockMembers.length === 3
      ? t('workout.triset')
      : t('workout.biset');
  const blockPosition = isSuperset ? currentBlockMembers.indexOf(currentExerciseIndex) : -1;

  // ── Wake lock + body scroll lock + ESC handler

  useWakeLock(phase === 'exercise' || phase === 'finisher');

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
        swaps,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentStep, loggedByExercise, swaps]);

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
    // Peso: si ya registraste una serie de este ejercicio HOY, arrastra ese peso;
    // si es la primera, arranca en el OBJETIVO de progresión (peso a superar).
    const sessionKg = lastKgForExercise(loggedByExercise, currentExerciseIndex);
    const entry: LoggedSet = {
      reps: parseRepsToNumber(currentEx.reps),
      kg: sessionKg > 0 ? sessionKg : (progression?.kg != null && progression.kg > 0 ? progression.kg : sessionKg),
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
      setRestState(step.restAfter > 0 ? { secondsLeft: step.restAfter, total: step.restAfter } : null);
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
    track('workout_completed', {
      exercises: payload.exercisesCompleted,
      minutes: Math.round(payload.durationSeconds / 60),
    });
    localStorage.removeItem(PROGRESS_KEY);
    haptics.success();
    // El trabajo principal queda registrado ya (onComplete). Si hay finisher, lo
    // hacemos como fase guiada ANTES de la pantalla de cierre; si no, directo a completed.
    setPhase(finisherBlock ? 'finisher' : 'completed');
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
              : phase === 'finisher'
                ? <em>{t('workout.finisher')}</em>
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
            <div className="wp-prep-section-label">
              {t('workout.warmup')}{warmupBlock ? ` · ${warmupBlock.minutes} min` : ''}
            </div>
            {warmupBlock ? (
              <div className="wp-ramp">
                {warmupBlock.phases.map((ph, i) => (
                  <div className="wp-ramp-phase" key={i}>
                    <span className="wp-ramp-tag">{t(`workout.ramp.${ph.phase}` as Parameters<typeof t>[0])}</span>
                    <div className="wp-ramp-body">
                      {ph.name && <div className="wp-ramp-name">{ph.name}</div>}
                      <div className="wp-ramp-note">{ph.note}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="wp-prep-section-text">{(workout as CachedWorkout).warmup}</p>
            )}
            <button className="wp-cta" onClick={startExercises}>
              {t('workout.warmupCta')}
            </button>
          </div>
        </div>
      )}

      {/* ── PHASE: FINISHER (cardio guiado tras el bloque principal, saltable) ── */}
      {phase === 'finisher' && finisherBlock && (
        <div className="wp-prep">
          <div className="wp-prep-card wp-fin-card">
            <div className="wp-prep-section-label wp-fin-lbl">
              {t('workout.finisher')} · {t(`workout.finisherFmt.${finisherBlock.format}` as Parameters<typeof t>[0])}
            </div>
            {finisherBlock.format === 'circuit' ? (
              <>
                <div className="wp-fin-presc wp-fin-rounds">
                  {t('workout.circuitRounds', { n: finisherBlock.rounds ?? 3 })}
                </div>
                <div className="wp-fin-stations">
                  {finisherBlock.stations.map((s, i) => (
                    <div className="wp-fin-station" key={i}>
                      <span className="wp-fin-station-tag">
                        {s.label ? t(`workout.circuit.${s.label}` as Parameters<typeof t>[0]) : `${i + 1}`}
                      </span>
                      <span className="wp-fin-station-name">{s.name}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="wp-fin-name">{finisherBlock.stations[0]?.name}</div>
                <div className="wp-fin-presc">{finisherBlock.stations[0]?.prescription}</div>
              </>
            )}
            {finisherBlock.format === 'intervals' && finRunning && finLeft > 0 && (
              <div className={`wp-fin-interval ${finHard ? 'is-hard' : 'is-easy'}`}>
                {finHard ? t('workout.intervalHard') : t('workout.intervalEasy')}
              </div>
            )}
            <div className="wp-fin-timer">
              <span className="wp-fin-clock">{finClock}</span>
              <button
                className="wp-fin-play"
                onClick={() => setFinRunning(r => !r)}
                aria-label={finRunning ? t('workout.pause') : t('workout.resume')}
              >
                {finRunning ? <Pause size={20} /> : <Play size={20} />}
              </button>
            </div>
            <div className="wp-fin-actions">
              <button className="wp-cta" onClick={() => setPhase('completed')}>
                {t('workout.finisherDone')}
              </button>
              <button className="wp-fin-skip" onClick={() => setPhase('completed')}>
                {t('workout.finisherSkip')}
              </button>
            </div>
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
            <div className="wp-ex-microrow">
              <p className="wp-ex-micro">
                {currentBank?.muscleGroup ? translateMuscle(currentBank.muscleGroup, t) : ''}
                {currentBank?.muscleGroup && currentBank?.difficulty ? ' · ' : ''}
                {currentBank?.difficulty ? translateDifficulty(currentBank.difficulty, t) : ''}
              </p>
              {currentBank && (
                <button type="button" className="wp-ex-technique" onClick={() => setShowSpecs(true)}>
                  <Info size={14} strokeWidth={2} />
                  <span>{t('workout.seeTechnique')}</span>
                </button>
              )}
              {canSwap && (
                <button type="button" className="wp-ex-technique wp-ex-swap" onClick={swapCurrentExercise}>
                  <RefreshCw size={14} strokeWidth={2} />
                  <span>{t('workout.swapExercise')}</span>
                </button>
              )}
            </div>
            <h2 className="wp-ex-name">{displayName}</h2>
            {variant?.notes && (
              <p className="wp-ex-notes">{variant.notes}</p>
            )}
            {currentEx.tip_personalizado && (
              <p className="wp-ex-tip">{currentEx.tip_personalizado}</p>
            )}
            {/* #2 — Un solo móvil: prescripción de los DOS. Mismo ejercicio y series;
                las reps (y el cue) pueden diferir por persona. */}
            {singleDevice && currentEx.repsB && (
              <div className="wp-duo">
                <div className="wp-duo-row">
                  <span className="wp-duo-who wp-duo-you">{t('workout.duoYou')}</span>
                  <span className="wp-duo-reps">{totalSetsForCurrent} × {currentEx.reps}</span>
                </div>
                <div className="wp-duo-row">
                  <span className="wp-duo-who">{partnerName || t('workout.duoPartner')}</span>
                  <span className="wp-duo-reps">{totalSetsForCurrent} × {currentEx.repsB}</span>
                </div>
                {currentEx.tipB && (
                  <p className="wp-duo-tip">{partnerName ? `${partnerName}: ` : ''}{currentEx.tipB}</p>
                )}
              </div>
            )}
          </div>

          <div className="wp-sets">
            <div className="wp-sets-head">
              <span className="wp-sets-label">
                {isSuperset
                  ? t('workout.supersetRound', { n: currentSetNum, total: totalSetsForCurrent })
                  : <>{t('workout.setsLabel')} · {totalSetsForCurrent}{singleDevice && currentEx.repsB ? '' : ` × ${currentEx.reps}`}</>}
                {currentEx.tecnica && <span className="wp-sets-tecnica">{currentEx.tecnica}</span>}
              </span>
              <span className="wp-sets-counter">
                {Math.min(setsRegisteredForCurrent, totalSetsForCurrent)} {t('workout.of')} {totalSetsForCurrent}
              </span>
            </div>
            {lastPerfLabel && (
              <div className="wp-last-perf">
                <History size={12} strokeWidth={2} aria-hidden="true" />
                <span>{t('workout.lastTime')}: <b>{lastPerfLabel}</b></span>
              </div>
            )}
            {progLabel && (() => {
              const a = progression?.action;
              const up = a === 'add-weight' || a === 'add-tension' || a === 'add-difficulty';
              return (
                <div className={`wp-prog${up ? ' wp-prog--up' : ''}`}>
                  <TrendingUp size={12} strokeWidth={2.2} aria-hidden="true" />
                  <span>{t('workout.todayTarget')}: <b>{progLabel}</b>
                    {a === 'add-weight' ? ' ↑' : ''}
                    {a === 'add-tension' ? <> · {t('workout.harderBand')} ↑</> : ''}
                    {a === 'add-difficulty' ? <> · {t('workout.harder')} ↑</> : ''}
                  </span>
                </div>
              );
            })()}
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
            {/* Jerarquía de acción (brief): COMPLETAR SERIE es el CTA protagonista
                mientras hay serie activa; al terminar el bloque pasa a SIGUIENTE
                EJERCICIO. Durante el descanso, la rest-bar toma el mando. */}
            {blockComplete ? (
              <button
                className={`wp-cta${partnerTurn ? ' wp-cta-locked' : ''}`}
                onClick={goToNextExercise}
                disabled={partnerTurn}
              >
                {isLastBlock ? t('workout.finishSession') : t('workout.nextExercise')}
                <ChevronRight size={18} />
              </button>
            ) : !restState ? (
              <button
                className="wp-complete-cta"
                onClick={markCurrentSet}
                disabled={partnerTurn}
              >
                <span className="wp-complete-cta-main">{t('workout.completeSet')}</span>
                <span className="wp-complete-cta-sub">
                  {t('workout.set')} {currentSetNum} {t('workout.of')} {totalSetsForCurrent} · {currentEx.reps} {t('workout.repsLower')}
                </span>
              </button>
            ) : null}
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
            <button className="wp-share-cta" onClick={() => setShareStatOpen(true)}>
              <Camera size={18} strokeWidth={2} />
              {t('post.shareOutCta')}
            </button>
            <button className="wp-share-cta wp-share-cta--club" onClick={() => setShareOpen(true)}>
              {t('post.shareFromWorkout')}
            </button>
            <button className="wp-cta" onClick={onClose}>
              {t('workout.finish')}
            </button>
          </div>
        </div>
      )}

      {shareStatOpen && (
        <Suspense fallback={null}>
          <ShareStatSheet
            headline={t('post.shareHeadlineWorkout')}
            stats={[
              { big: String(completedStats.minutes), label: 'min' },
              { big: String(completedStats.totalSetsCompleted), label: t('workout.setsLower') },
              completedStats.totalKg > 0
                ? { big: String(completedStats.totalKg), label: t('workout.kgTotal') }
                : { big: String(completedStats.exercisesCompleted), label: t('workout.exercisesLower') },
            ]}
            onClose={() => setShareStatOpen(false)}
          />
        </Suspense>
      )}

      {shareOpen && (
        <Suspense fallback={null}>
          <CreatePostModal
            open={shareOpen}
            onClose={() => setShareOpen(false)}
            context={{ kind: 'workout' }}
          />
        </Suspense>
      )}

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

      {/* Rest bar flotante (no-bloqueante, sticky bottom) — contador circular. */}
      {phase === 'exercise' && restState && (
        <div className="wp-rest-bar" role="status" aria-live="polite">
          <div className="wp-rest-ring">
            <svg className="wp-rest-ring-svg" viewBox="0 0 44 44" aria-hidden="true">
              <circle className="wp-rest-ring-track" cx="22" cy="22" r="19" />
              <circle
                className="wp-rest-ring-fill" cx="22" cy="22" r="19"
                style={{ strokeDasharray: 119.4, strokeDashoffset: 119.4 * (1 - restState.secondsLeft / Math.max(1, restState.total)) }}
              />
            </svg>
            <span className="wp-rest-ring-num">{restState.secondsLeft}</span>
          </div>
          <div className="wp-rest-bar-info">
            <span className="wp-rest-bar-label">{t('workout.restLabel')}</span>
            {currentSetNum <= totalSetsForCurrent && (
              <span className="wp-rest-bar-sub">{t('workout.nextSetShort', { n: currentSetNum, total: totalSetsForCurrent })}</span>
            )}
          </div>
          <button className="wp-rest-bar-skip" onClick={skipRest} type="button">
            {t('workout.skipRest')}
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
