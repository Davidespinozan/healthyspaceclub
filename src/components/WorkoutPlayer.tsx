import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Pause, Play, Check, Pencil, Minus, Plus, ChevronRight } from 'lucide-react';
import { useWakeLock } from '../hooks/useWakeLock';
import { getExerciseIcon } from '../utils/muscleGroupIcon';
import { selectVariantForEquipment } from '../utils/workoutPlanner';
import {
  startPosFor,
  markSet as markSetPure,
  editSetAt,
  padForNextExercise,
  computeExercisesCompleted,
  computeSessionStats,
  buildOnCompletePayload,
  parseResumeState,
} from '../utils/workoutSession';
import type { Exercise, Equipment, LoggedSet } from '../types';
import type { CachedWorkout } from '../utils/workoutCache';
import './workout-player.css';

// Flow-1: phase 'prep' eliminado — el WorkoutPlan (cream) ya es la antesala
// con toda la info (lista, tips, calentamiento, POR QUÉ HOY, enfriamiento).
// El player abre directo en 'exercise'. Si hay resume state, se detecta
// en el useEffect de mount (no en una pantalla intermedia).
type PlayerPhase = 'exercise' | 'paused' | 'completed';

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
  const exerciseMap = useMemo(
    () => new Map(exerciseBank.map(e => [e.id, e])),
    [exerciseBank],
  );
  const exercises = workout.exercises;
  const totalExercises = exercises.length;
  const planHash = buildPlanHash(workout);

  // ── State (3 phases + sub-estados). Flow-1: arrancamos directo en 'exercise'.
  const [phase, setPhase] = useState<PlayerPhase>('exercise');
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [loggedSets, setLoggedSets] = useState<Array<LoggedSet | null>>([]);
  const [restState, setRestState] = useState<{ secondsLeft: number; forSet: number } | null>(null);
  const [editingSet, setEditingSet] = useState<{ exerciseIndex: number; setIndex: number } | null>(null);
  const [editValues, setEditValues] = useState<LoggedSet>({ reps: 0, kg: 0 });
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [pausedFromPhase, setPausedFromPhase] = useState<PlayerPhase | null>(null);

  // ── Derived per-current-exercise
  const currentEx = exercises[currentExerciseIndex];
  const currentBank = currentEx ? exerciseMap.get(currentEx.id) : undefined;
  const variant = currentBank ? selectVariantForEquipment(currentBank, userEquipment) : null;
  const displayName = currentBank
    ? (variant ? `${currentBank.name} — ${variant.name}` : currentBank.name)
    : currentEx?.id || '';
  const DisplayIcon = getExerciseIcon(currentBank);
  const totalSetsForCurrent = currentEx?.sets || 1;

  // Posición en loggedSets donde comienzan los sets del ejercicio actual.
  // loggedSets es plano en orden de ejecución: [ex0-s0, ex0-s1, ..., ex1-s0, ...]
  const startPos = useMemo(
    () => startPosFor(currentExerciseIndex, exercises),
    [exercises, currentExerciseIndex],
  );
  const setsRegisteredForCurrent = Math.max(0, loggedSets.length - startPos);
  const allSetsRegistered = setsRegisteredForCurrent >= totalSetsForCurrent;

  // ── Wake lock + body scroll lock + ESC handler

  useWakeLock(phase === 'exercise');

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingSet) { saveEditSet(); return; }
        handleExit();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, editingSet]);

  // ── localStorage autosave (key + shape compatibles con la versión anterior).
  // Persistimos `currentSet` derivado para compat con el confirm() de resume.
  useEffect(() => {
    if (phase === 'exercise' || phase === 'paused') {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({
        workoutDate: new Date().toISOString().split('T')[0],
        planHash,
        currentExerciseIndex,
        currentSet: Math.min(setsRegisteredForCurrent + 1, totalSetsForCurrent),
        restSecondsLeft: restState?.secondsLeft ?? 0,
        exercisesCompleted: computeExercisesCompleted(loggedSets, exercises),
        totalSetsCompleted: loggedSets.filter(s => s !== null).length,
        startedAt,
        loggedSets,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentExerciseIndex, loggedSets, restState]);

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

  // Flow-1: detección de resume on mount (antes vivía en handleStart, que
  // se disparaba al tap "comenzar sesión" del prep). Ahora el player abre
  // directo en 'exercise' (initial state); este effect solo aplica resume
  // si existe sesión guardada del mismo plan/día.
  useEffect(() => {
    const raw = (() => {
      try { return localStorage.getItem(PROGRESS_KEY); }
      catch { return null; }
    })();
    const today = new Date().toISOString().split('T')[0];
    const resumeState = parseResumeState(raw, planHash, today, totalExercises);
    if (!resumeState) return; // fresh start con los defaults del useState

    const ok = confirm(
      `Tenías una sesión en progreso (ejercicio ${resumeState.currentExerciseIndex + 1} de ${totalExercises}). ¿Continuar?`,
    );
    if (ok) {
      setCurrentExerciseIndex(resumeState.currentExerciseIndex);
      setStartedAt(resumeState.startedAt || Date.now());
      setLoggedSets(resumeState.loggedSets);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function markCurrentSet() {
    if (allSetsRegistered || !currentEx) return;
    const { newLoggedSets, restSeconds } = markSetPure(loggedSets, currentExerciseIndex, exercises);
    setLoggedSets(newLoggedSets);
    if (restSeconds === null) {
      setRestState(null);
    } else {
      setRestState({ secondsLeft: restSeconds, forSet: setsRegisteredForCurrent + 1 });
    }
  }

  function openEditSet(exerciseIdx: number, setIdx: number) {
    const flatIdx = startPosFor(exerciseIdx, exercises) + setIdx;
    const entry = loggedSets[flatIdx];
    if (!entry) return; // null (skipped) o undefined → no editable
    setEditingSet({ exerciseIndex: exerciseIdx, setIndex: setIdx });
    setEditValues({ reps: entry.reps, kg: entry.kg });
  }

  function saveEditSet() {
    if (!editingSet) return;
    setLoggedSets(prev => editSetAt(prev, editingSet.exerciseIndex, editingSet.setIndex, exercises, editValues));
    setEditingSet(null);
  }

  function skipRest() {
    setRestState(null);
  }

  function goToNextExercise() {
    if (!currentEx) return;
    const padded = padForNextExercise(loggedSets, currentExerciseIndex, exercises);
    setLoggedSets(padded);
    setRestState(null);

    const nextIdx = currentExerciseIndex + 1;
    if (nextIdx >= totalExercises) {
      finishSession(padded);
    } else {
      setCurrentExerciseIndex(nextIdx);
    }
  }

  function finishSession(finalLogged: Array<LoggedSet | null>) {
    const payload = buildOnCompletePayload(finalLogged, startedAt, Date.now(), exercises);
    localStorage.removeItem(PROGRESS_KEY);
    setPhase('completed');
    onComplete(payload);
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
    if (confirm('¿Salir de la sesión? Tu progreso se guarda automáticamente.')) {
      onClose();
    }
  }

  // ── Stats para pantalla completed
  const completedStats = useMemo(
    () => computeSessionStats(loggedSets, startedAt, Date.now(), exercises),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase],
  );

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════

  const progressPct = totalExercises > 0
    ? Math.round((currentExerciseIndex / totalExercises) * 100)
    : 0;

  return createPortal(
    <div className="wp">
      {/* Header siempre visible */}
      <div className="wp-header">
        <button className="wp-header-btn" onClick={handleExit} aria-label="Cerrar">
          <X size={20} />
        </button>
        <div className="wp-header-title">
          {phase === 'completed'
            ? <em>completado</em>
            : <>ejercicio {currentExerciseIndex + 1} <span className="wp-header-of">de</span> {totalExercises}</>}
        </div>
        <div className="wp-header-counter">
          {phase === 'exercise' || phase === 'paused' ? (
            <button
              className="wp-header-btn"
              onClick={handlePause}
              aria-label={phase === 'paused' ? 'Continuar' : 'Pausar'}
            >
              {phase === 'paused' ? <Play size={18} /> : <Pause size={18} />}
            </button>
          ) : null}
        </div>
      </div>

      {/* Barra de progreso (solo en exercise) */}
      {phase === 'exercise' && (
        <div className="wp-progress-bar">
          <div className="wp-progress-bar-fill" style={{ width: `${progressPct}%` }} />
        </div>
      )}

      {/* ── PHASE: EXERCISE (1 pantalla por ejercicio con filas de series) ── */}
      {phase === 'exercise' && currentEx && (
        <div className={`wp-active${restState ? ' has-rest' : ''}`} key={`ex-${currentExerciseIndex}`}>
          <div className="wp-video-area">
            <div className="wp-video-fallback">
              <div className="wp-video-emoji"><DisplayIcon size={56} strokeWidth={1.5} /></div>
              <p className="wp-video-label">Video próximamente</p>
            </div>
          </div>

          <div className="wp-ex-info">
            <p className="wp-ex-micro">
              {currentBank?.muscleGroup} · {currentBank?.difficulty}
            </p>
            <h2 className="wp-ex-name">{displayName}</h2>
            {variant?.notes && (
              <p className="wp-ex-notes">{variant.notes}</p>
            )}
            {currentEx.tip_personalizado && (
              <p className="wp-ex-tip">{currentEx.tip_personalizado}</p>
            )}
          </div>

          <div className="wp-sets">
            <div className="wp-sets-head">
              <span className="wp-sets-label">SERIES · {totalSetsForCurrent} × {currentEx.reps}</span>
              <span className="wp-sets-counter">
                {Math.min(setsRegisteredForCurrent, totalSetsForCurrent)} de {totalSetsForCurrent}
              </span>
            </div>
            <div className="wp-set-rows">
              {Array.from({ length: totalSetsForCurrent }).map((_, setIdx) => {
                const flatIdx = startPos + setIdx;
                const entry = loggedSets[flatIdx];
                const isLogged = flatIdx < loggedSets.length;
                const isSkipped = isLogged && entry === null;
                const isDone = isLogged && entry !== null;
                const isActive = !isLogged && setIdx === setsRegisteredForCurrent;

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
                    disabled={!isActive && !isDone}
                  >
                    <span className="wp-set-row-circle">
                      {isDone && <Check size={14} strokeWidth={2} />}
                    </span>
                    <span className="wp-set-row-label">
                      Serie {setIdx + 1}
                      {isDone && entry && (
                        <span className="wp-set-row-vals"> · {entry.reps} reps · {entry.kg}kg</span>
                      )}
                      {isSkipped && (
                        <span className="wp-set-row-vals wp-set-row-vals--muted"> · saltada</span>
                      )}
                      {isActive && (
                        <span className="wp-set-row-hint"> · tocá para marcar</span>
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
            <button
              className={`wp-cta${!allSetsRegistered ? ' wp-cta-secondary' : ''}`}
              onClick={goToNextExercise}
            >
              {currentExerciseIndex + 1 >= totalExercises ? 'Terminar sesión' : 'Siguiente ejercicio'}
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── PHASE: PAUSED ── */}
      {phase === 'paused' && (
        <div className="wp-paused">
          <Pause size={48} className="wp-paused-icon" />
          <p className="wp-paused-label">En pausa</p>
          <p className="wp-paused-sub">
            Ejercicio {currentExerciseIndex + 1} de {totalExercises} · {setsRegisteredForCurrent} de {totalSetsForCurrent} series
          </p>
          <div className="wp-cta-wrap">
            <button className="wp-cta" onClick={handlePause}>
              <Play size={18} /> Continuar
            </button>
            <button className="wp-skip" onClick={handleExit}>
              salir de la sesión
            </button>
          </div>
        </div>
      )}

      {/* ── PHASE: COMPLETED ── */}
      {phase === 'completed' && (
        <div className="wp-completed">
          <div className="wp-completed-check"><Check size={32} strokeWidth={2.5} /></div>
          <h2 className="wp-completed-title">¡Sesión completada!</h2>
          <div className="wp-completed-stats">
            <div className="wp-completed-stat">
              <div className="wp-completed-stat-val">{completedStats.minutes}</div>
              <div className="wp-completed-stat-lbl">min</div>
            </div>
            <div className="wp-completed-stat">
              <div className="wp-completed-stat-val">{completedStats.totalSetsCompleted}</div>
              <div className="wp-completed-stat-lbl">series</div>
            </div>
            <div className="wp-completed-stat">
              <div className="wp-completed-stat-val">{completedStats.totalKg}</div>
              <div className="wp-completed-stat-lbl">kg total</div>
            </div>
          </div>
          {workout.cooldown && (
            <div className="wp-prep-section">
              <div className="wp-prep-section-label">Enfriamiento</div>
              <p className="wp-prep-section-text">{workout.cooldown}</p>
            </div>
          )}
          <div className="wp-cta-wrap">
            <button className="wp-cta" onClick={onClose}>
              Terminar
            </button>
          </div>
        </div>
      )}

      {/* Rest bar flotante (no-bloqueante, sticky bottom) */}
      {phase === 'exercise' && restState && (
        <div className="wp-rest-bar" role="status" aria-live="polite">
          <span className="wp-rest-bar-label">
            <span className="wp-rest-bar-dot" />
            descansando {formatTime(restState.secondsLeft)}
          </span>
          <button className="wp-rest-bar-skip" onClick={skipRest} type="button">
            saltar
          </button>
        </div>
      )}

      {/* Mini-popup de ajuste reps/kg */}
      {editingSet && (
        <div className="wp-edit-backdrop" onClick={saveEditSet}>
          <div className="wp-edit-popup" onClick={e => e.stopPropagation()}>
            <div className="wp-edit-handle" />
            <div className="wp-edit-title">Serie {editingSet.setIndex + 1}</div>
            <div className="wp-edit-fields">
              <div className="wp-edit-field">
                <label className="wp-edit-label">Reps</label>
                <div className="wp-edit-row">
                  <button
                    type="button"
                    className="wp-edit-btn"
                    onClick={() => setEditValues(v => ({ ...v, reps: Math.max(0, v.reps - 1) }))}
                    aria-label="Restar 1 rep"
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
                    aria-label="Sumar 1 rep"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>

              <div className="wp-edit-field">
                <label className="wp-edit-label">Peso (kg)</label>
                <div className="wp-edit-row">
                  <button
                    type="button"
                    className="wp-edit-btn"
                    onClick={() => setEditValues(v => ({ ...v, kg: Math.max(0, v.kg - 2.5) }))}
                    aria-label="Restar 2.5 kg"
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
                    aria-label="Sumar 2.5 kg"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
            </div>
            <button className="wp-edit-done" onClick={saveEditSet} type="button">
              Listo
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
