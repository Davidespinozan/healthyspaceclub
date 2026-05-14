import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Pause, Play, Check, SkipForward, Minus, Plus } from 'lucide-react';
import { useWakeLock } from '../hooks/useWakeLock';
import { selectVariantForEquipment } from '../utils/workoutPlanner';
import { parseRepsToNumber } from '../utils/workoutLogger';
import type { Exercise, Equipment, LoggedSet } from '../types';
import type { CachedWorkout } from '../utils/workoutCache';
import './workout-player.css';

type PlayerPhase = 'prep' | 'exercise' | 'log-set' | 'rest' | 'transition' | 'paused' | 'completed';

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

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const TRANSITION_MS = 3000;
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
  const exerciseMap = new Map(exerciseBank.map(e => [e.id, e]));
  const exercises = workout.exercises;
  const totalExercises = exercises.length;
  const planHash = buildPlanHash(workout);

  const todayDayName = DAY_NAMES[new Date().getDay()];
  const todayDate = new Date().getDate();
  const todayMonth = new Date().toLocaleDateString('es-ES', { month: 'short' });

  // ── State
  const [phase, setPhase] = useState<PlayerPhase>('prep');
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [restSecondsLeft, setRestSecondsLeft] = useState(0);
  const [exercisesCompleted, setExercisesCompleted] = useState(0);
  const [totalSetsCompleted, setTotalSetsCompleted] = useState(0);
  const [startedAt, setStartedAt] = useState<number>(0);
  const [pausedFromPhase, setPausedFromPhase] = useState<PlayerPhase | null>(null);
  const [transitionNext, setTransitionNext] = useState<{ prev: string; next: string } | null>(null);
  const [loggedSets, setLoggedSets] = useState<Array<LoggedSet | null>>([]);
  const [logSetInputs, setLogSetInputs] = useState<{ reps: number; kg: number }>({ reps: 0, kg: 0 });

  // ── Wake lock activo en sesión activa (incluye log-set)
  useWakeLock(phase === 'exercise' || phase === 'log-set' || phase === 'rest' || phase === 'transition');

  // ── Body scroll lock todo el tiempo que el player esté montado
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ── ESC handler
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleExit();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Persistencia de progreso (no en prep/completed)
  useEffect(() => {
    if (phase === 'exercise' || phase === 'log-set' || phase === 'rest' || phase === 'paused') {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({
        workoutDate: new Date().toISOString().split('T')[0],
        planHash,
        currentExerciseIndex,
        currentSet,
        restSecondsLeft,
        exercisesCompleted,
        totalSetsCompleted,
        startedAt,
        loggedSets,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentExerciseIndex, currentSet, restSecondsLeft, phase, loggedSets]);

  // ── Timer de descanso (solo en phase 'rest')
  useEffect(() => {
    if (phase !== 'rest') return;
    const interval = setInterval(() => {
      setRestSecondsLeft(prev => {
        if (prev <= 1) {
          handleRestComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Datos del ejercicio actual
  const currentEx = exercises[currentExerciseIndex];
  const currentBank = currentEx ? exerciseMap.get(currentEx.id) : undefined;
  const variant = currentBank ? selectVariantForEquipment(currentBank, userEquipment) : null;
  const displayName = currentBank
    ? (variant ? `${currentBank.name} — ${variant.name}` : currentBank.name)
    : currentEx?.id || '';
  const displayEmoji = currentBank?.emoji || '💪';
  const totalSetsForCurrent = currentEx?.sets || 1;

  // ── Handlers

  function handleStart() {
    // Check for saved progress
    try {
      const saved = localStorage.getItem(PROGRESS_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        const today = new Date().toISOString().split('T')[0];
        const sameDay = data.workoutDate === today;
        const samePlan = data.planHash === planHash;
        const midSession = data.currentExerciseIndex > 0 && data.currentExerciseIndex < totalExercises;

        if (sameDay && samePlan && midSession) {
          const resume = confirm(
            `Tenías una sesión en progreso (ejercicio ${data.currentExerciseIndex + 1} de ${totalExercises}). ¿Continuar?`
          );
          if (resume) {
            setCurrentExerciseIndex(data.currentExerciseIndex);
            setCurrentSet(data.currentSet || 1);
            setRestSecondsLeft(data.restSecondsLeft || 0);
            setExercisesCompleted(data.exercisesCompleted || 0);
            setTotalSetsCompleted(data.totalSetsCompleted || 0);
            setStartedAt(data.startedAt || Date.now());
            setLoggedSets(Array.isArray(data.loggedSets) ? data.loggedSets : []);
            setPhase('exercise');
            return;
          }
        }
      }
    } catch { /* ignore parse errors */ }

    // Empezar de cero
    setCurrentExerciseIndex(0);
    setCurrentSet(1);
    setExercisesCompleted(0);
    setTotalSetsCompleted(0);
    setStartedAt(Date.now());
    setLoggedSets([]);
    setPhase('exercise');
  }

  function handleCompleteSet() {
    // Pre-rellenar inputs del log-set y avanzar a la phase de captura
    const parsedReps = parseRepsToNumber(currentEx?.reps);
    // kg: último valor del MISMO ejercicio (en loggedSets pushed hasta ahora)
    const startPos = exercises
      .slice(0, currentExerciseIndex)
      .reduce((acc, ex) => acc + ex.sets, 0);
    const setsOfCurrent = loggedSets.slice(startPos);
    let lastKg = 0;
    for (let i = setsOfCurrent.length - 1; i >= 0; i--) {
      const entry = setsOfCurrent[i];
      if (entry) { lastKg = entry.kg; break; }
    }
    setLogSetInputs({ reps: parsedReps, kg: lastKg });
    setPhase('log-set');
  }

  /**
   * Avanza después del log-set. `skip` indica si el usuario saltó el set
   * (push null) o lo guardó (push {reps, kg}).
   */
  function handleLogSetSubmit(skip: boolean) {
    const entry: LoggedSet | null = skip ? null : {
      reps: Math.max(0, logSetInputs.reps),
      kg: Math.max(0, logSetInputs.kg),
    };
    setLoggedSets(prev => [...prev, entry]);

    // Solo incrementar totalSetsCompleted si el set NO fue saltado
    const newTotalSets = skip ? totalSetsCompleted : totalSetsCompleted + 1;
    setTotalSetsCompleted(newTotalSets);

    const isLastSet = currentSet >= totalSetsForCurrent;
    if (!isLastSet) {
      setRestSecondsLeft(currentEx?.rest || 60);
      setPhase('rest');
    } else {
      const newCompleted = exercisesCompleted + 1;
      setExercisesCompleted(newCompleted);
      const isLastExercise = currentExerciseIndex >= totalExercises - 1;
      if (isLastExercise) {
        finishSession(newCompleted, newTotalSets, [...loggedSets, entry]);
      } else {
        startTransitionToNext();
      }
    }
  }

  function startTransitionToNext() {
    const nextIdx = currentExerciseIndex + 1;
    const nextBank = exerciseMap.get(exercises[nextIdx].id);
    const nextVariant = nextBank ? selectVariantForEquipment(nextBank, userEquipment) : null;
    const nextName = nextBank
      ? (nextVariant ? `${nextBank.name} — ${nextVariant.name}` : nextBank.name)
      : exercises[nextIdx].id;

    setTransitionNext({ prev: displayName, next: nextName });
    setPhase('transition');

    setTimeout(() => {
      setCurrentExerciseIndex(nextIdx);
      setCurrentSet(1);
      setTransitionNext(null);
      setPhase('exercise');
    }, TRANSITION_MS);
  }

  function handleRestComplete() {
    setCurrentSet(s => s + 1);
    setPhase('exercise');
  }

  function handleSkipRest() {
    handleRestComplete();
  }

  function handleSkipExercise() {
    // Push nulls para TODAS las series restantes del ejercicio actual
    // (preserva integridad: loggedSets.length == series scheduled hasta este punto)
    const remainingSets = Math.max(0, totalSetsForCurrent - currentSet + 1);
    const nulls: Array<LoggedSet | null> = new Array(remainingSets).fill(null);
    const updatedLoggedSets = [...loggedSets, ...nulls];
    setLoggedSets(updatedLoggedSets);

    // Skip cuenta el ejercicio como NO completado, pero avanza
    const isLastExercise = currentExerciseIndex >= totalExercises - 1;
    if (isLastExercise) {
      finishSession(exercisesCompleted, totalSetsCompleted, updatedLoggedSets);
    } else {
      startTransitionToNext();
    }
  }

  function handlePause() {
    if (phase === 'paused') {
      setPhase(pausedFromPhase || 'exercise');
      setPausedFromPhase(null);
    } else if (phase === 'exercise' || phase === 'log-set' || phase === 'rest') {
      setPausedFromPhase(phase);
      setPhase('paused');
    }
  }

  function finishSession(completed: number, sets: number, finalLoggedSets?: Array<LoggedSet | null>) {
    localStorage.removeItem(PROGRESS_KEY);
    const durationSeconds = startedAt > 0 ? Math.round((Date.now() - startedAt) / 1000) : 0;
    setPhase('completed');
    onComplete({
      exercisesCompleted: completed,
      totalSetsCompleted: sets,
      durationSeconds,
      loggedSets: finalLoggedSets ?? loggedSets,
    });
  }

  function handleExit() {
    if (phase === 'prep' || phase === 'completed') {
      onClose();
      return;
    }
    if (confirm('¿Salir de la sesión? Tu progreso se guarda automáticamente.')) {
      onClose();
    }
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER (Portal a document.body para escapar containing-block
  // creado por el animation transform en .app-main > *)
  // ══════════════════════════════════════════════════════════════

  return createPortal(
    <div className="wp">
      {/* Header — siempre visible */}
      <div className="wp-header">
        <button className="wp-header-btn" onClick={handleExit} aria-label="Cerrar">
          <X size={20} />
        </button>
        <div className="wp-header-title">
          {phase === 'prep'
            ? <em>tu sesión</em>
            : phase === 'completed'
            ? <em>completado</em>
            : <>ejercicio {currentExerciseIndex + 1} <span className="wp-header-of">de</span> {totalExercises}</>}
        </div>
        <div className="wp-header-counter">
          {phase !== 'prep' && phase !== 'completed' && (
            <button
              className="wp-header-btn"
              onClick={handlePause}
              aria-label={phase === 'paused' ? 'Continuar' : 'Pausar'}
            >
              {phase === 'paused' ? <Play size={18} /> : <Pause size={18} />}
            </button>
          )}
        </div>
      </div>

      {/* ── Phase: PREP ── */}
      {phase === 'prep' && (
        <div className="wp-prep">
          <p className="wp-prep-micro">tu sesión · {todayDayName} {todayDate} {todayMonth}</p>
          <h1 className="wp-prep-title"><em>{workout.type || 'Entrenamiento'}</em></h1>
          <p className="wp-prep-sub">
            {totalExercises} ejercicios · intensidad {workout.intensity}
          </p>

          {workout.warmup && (
            <div className="wp-prep-section">
              <div className="wp-prep-section-label">Calentamiento</div>
              <p className="wp-prep-section-text">{workout.warmup}</p>
            </div>
          )}

          <div className="wp-prep-list">
            <div className="wp-prep-list-label">Lo que viene</div>
            {exercises.map((ex, i) => {
              const bank = exerciseMap.get(ex.id);
              const v = bank ? selectVariantForEquipment(bank, userEquipment) : null;
              const name = bank
                ? (v ? `${bank.name} — ${v.name}` : bank.name)
                : ex.id;
              return (
                <div key={`${ex.id}-${i}`} className="wp-prep-list-row">
                  <span className="wp-prep-list-num">{i + 1}</span>
                  <span className="wp-prep-list-emoji">{bank?.emoji || '💪'}</span>
                  <span className="wp-prep-list-name">{name}</span>
                  <span className="wp-prep-list-sets">{ex.sets} × {ex.reps}</span>
                </div>
              );
            })}
          </div>

          <div className="wp-cta-wrap">
            <button className="wp-cta" onClick={handleStart}>
              ▶ comenzar sesión
            </button>
          </div>
        </div>
      )}

      {/* ── Phase: EXERCISE (set activo) ── */}
      {phase === 'exercise' && currentEx && (
        <div className="wp-active">
          <div className="wp-video-area">
            <div className="wp-video-fallback">
              <div className="wp-video-emoji">{displayEmoji}</div>
              <p className="wp-video-label">Video próximamente</p>
            </div>
          </div>

          <div className="wp-progress">
            {exercises.map((_, i) => (
              <span
                key={i}
                className={`wp-prog-dot${i === currentExerciseIndex ? ' active' : ''}${i < currentExerciseIndex ? ' done' : ''}`}
              />
            ))}
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

          <div className="wp-set-card">
            <div className="wp-set-label">Serie</div>
            <div className="wp-set-counter">
              {currentSet} <span className="wp-set-of">de</span> {totalSetsForCurrent}
            </div>
            <div className="wp-set-reps">{currentEx.reps} reps</div>
            <div className="wp-set-rest">
              descanso siguiente: {currentEx.rest}s
            </div>
          </div>

          <div className="wp-cta-wrap">
            <button className="wp-cta" onClick={handleCompleteSet}>
              <Check size={18} /> Completar serie
            </button>
            <button className="wp-skip" onClick={handleSkipExercise}>
              <SkipForward size={14} /> saltar ejercicio
            </button>
          </div>
        </div>
      )}

      {/* ── Phase: LOG-SET (capturar reps/kg reales) ── */}
      {phase === 'log-set' && currentEx && (
        <div className="wp-log-set">
          <p className="wp-log-set-micro">
            {currentBank?.muscleGroup} · {displayName}
          </p>
          <div className="wp-log-set-counter">
            Serie {currentSet} <span className="wp-log-set-of">de</span> {totalSetsForCurrent}
          </div>
          <p className="wp-log-set-prompt">¿Cómo te fue?</p>

          <div className="wp-log-set-fields">
            <div className="wp-log-set-field">
              <label className="wp-log-set-label">Reps completadas</label>
              <div className="wp-log-set-input-row">
                <button
                  type="button"
                  className="wp-log-set-btn"
                  onClick={() => setLogSetInputs(s => ({ ...s, reps: Math.max(0, s.reps - 1) }))}
                  aria-label="Restar 1"
                >
                  <Minus size={20} />
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  className="wp-log-set-input"
                  value={logSetInputs.reps}
                  onChange={e =>
                    setLogSetInputs(s => ({ ...s, reps: Math.max(0, Number(e.target.value) || 0) }))
                  }
                />
                <button
                  type="button"
                  className="wp-log-set-btn"
                  onClick={() => setLogSetInputs(s => ({ ...s, reps: s.reps + 1 }))}
                  aria-label="Sumar 1"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>

            <div className="wp-log-set-field">
              <label className="wp-log-set-label">Peso adicional (opcional)</label>
              <div className="wp-log-set-input-row">
                <button
                  type="button"
                  className="wp-log-set-btn"
                  onClick={() => setLogSetInputs(s => ({ ...s, kg: Math.max(0, s.kg - 2.5) }))}
                  aria-label="Restar 2.5kg"
                >
                  <Minus size={20} />
                </button>
                <input
                  type="number"
                  inputMode="decimal"
                  step="2.5"
                  className="wp-log-set-input"
                  value={logSetInputs.kg}
                  onChange={e =>
                    setLogSetInputs(s => ({ ...s, kg: Math.max(0, Number(e.target.value) || 0) }))
                  }
                />
                <button
                  type="button"
                  className="wp-log-set-btn"
                  onClick={() => setLogSetInputs(s => ({ ...s, kg: s.kg + 2.5 }))}
                  aria-label="Sumar 2.5kg"
                >
                  <Plus size={20} />
                </button>
              </div>
              <span className="wp-log-set-unit">kg</span>
            </div>
          </div>

          <div className="wp-cta-wrap">
            <button className="wp-cta" onClick={() => handleLogSetSubmit(false)}>
              <Check size={18} /> Guardar y descansar
            </button>
            <button className="wp-skip" onClick={() => handleLogSetSubmit(true)}>
              <SkipForward size={14} /> saltar set
            </button>
          </div>
        </div>
      )}

      {/* ── Phase: REST (countdown entre series) ── */}
      {phase === 'rest' && currentEx && (
        <div className="wp-rest">
          <div className="wp-rest-label">Descanso</div>
          <div className="wp-rest-timer">{formatTime(restSecondsLeft)}</div>
          <p className="wp-rest-next">
            Siguiente: serie {currentSet + 1} de {totalSetsForCurrent} · {currentEx.reps} reps
          </p>
          <p className="wp-rest-exercise">{displayName}</p>

          <div className="wp-cta-wrap">
            <button className="wp-cta wp-cta-secondary" onClick={handleSkipRest}>
              <SkipForward size={16} /> saltar descanso
            </button>
          </div>
        </div>
      )}

      {/* ── Phase: TRANSITION (3s entre ejercicios) ── */}
      {phase === 'transition' && transitionNext && (
        <div className="wp-transition">
          <p className="wp-transition-prev">Terminaste: {transitionNext.prev}</p>
          <p className="wp-transition-label">Siguiente</p>
          <h2 className="wp-transition-next">{transitionNext.next}</h2>
          <div className="wp-transition-dots">
            <span className="wp-transition-dot" />
            <span className="wp-transition-dot" />
            <span className="wp-transition-dot" />
          </div>
        </div>
      )}

      {/* ── Phase: PAUSED ── */}
      {phase === 'paused' && (
        <div className="wp-paused">
          <Pause size={48} className="wp-paused-icon" />
          <p className="wp-paused-label">En pausa</p>
          <p className="wp-paused-sub">
            Ejercicio {currentExerciseIndex + 1} de {totalExercises} · serie {currentSet}
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

      {/* ── Phase: COMPLETED ── */}
      {phase === 'completed' && (
        <div className="wp-completed">
          <div className="wp-completed-check">✓</div>
          <h2 className="wp-completed-title">¡Sesión completada!</h2>
          <div className="wp-completed-stats">
            <div className="wp-completed-stat">
              <div className="wp-completed-stat-val">{exercisesCompleted}</div>
              <div className="wp-completed-stat-lbl">ejercicios</div>
            </div>
            <div className="wp-completed-stat">
              <div className="wp-completed-stat-val">{totalSetsCompleted}</div>
              <div className="wp-completed-stat-lbl">series</div>
            </div>
            <div className="wp-completed-stat">
              <div className="wp-completed-stat-val">
                {startedAt > 0 ? Math.round((Date.now() - startedAt) / 60000) : 0}
              </div>
              <div className="wp-completed-stat-lbl">minutos</div>
            </div>
          </div>
          {workout.cooldown && (
            <div className="wp-prep-section">
              <div className="wp-prep-section-label">Enfriamiento</div>
              <p className="wp-prep-section-text">{workout.cooldown}</p>
            </div>
          )}
          {workout.note && (
            <p className="wp-completed-note">{workout.note}</p>
          )}
          <div className="wp-cta-wrap">
            <button className="wp-cta" onClick={onClose}>
              Terminar
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
