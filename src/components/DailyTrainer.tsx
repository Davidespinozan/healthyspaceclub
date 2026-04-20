import { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../store';
import { exercises as exerciseBank } from '../data/exercises';
import {
  decideTodayWorkout,
  analyzeWorkoutHistory,
  filterExercisesForWorkout,
  buildConfigHash,
  exerciseCountForDuration,
} from '../utils/workoutPlanner';
import {
  getCachedWorkout,
  saveWorkoutToCache,
  validateWorkout,
  type CachedWorkout,
} from '../utils/workoutCache';
import type {
  Exercise,
  Equipment,
  Goal,
  MuscleGroup,
  WorkoutDayDecision,
} from '../types';
import { RefreshCw, Clock, Zap, ChevronRight, Lock, Settings } from 'lucide-react';
import './daily-trainer-v2.css';

const API_KEY = import.meta.env.VITE_CLAUDE_API_KEY;

// ══════════════════════════════════════════════════════════════
// CONFIG DE UI
// ══════════════════════════════════════════════════════════════

const TIME_OPTIONS = [
  { value: 25, label: '25 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60+ min' },
];

const EQUIPMENT_OPTIONS: Array<{
  value: Equipment;
  label: string;
  sub: string;
  icon: string;
}> = [
  { value: 'gym', label: 'En el gym', sub: 'completo', icon: '🏋️' },
  { value: 'cuerpo', label: 'En casa sin equipo', sub: 'solo cuerpo', icon: '🤸' },
  { value: 'ligas', label: 'En casa con ligas', sub: 'bandas', icon: '🎗️' },
];

const GOAL_OPTIONS: Array<{
  value: Goal;
  label: string;
  icon: string;
}> = [
  { value: 'fuerza', label: 'Fuerza', icon: '💪' },
  { value: 'hipertrofia', label: 'Crecer músculo', icon: '📈' },
  { value: 'condicion', label: 'Sudar', icon: '💦' },
  { value: 'movilidad', label: 'Estirar', icon: '🧘' },
];

const MUSCLE_OPTIONS: Array<{ value: string; label: string; groups: MuscleGroup[] }> = [
  { value: 'full-body', label: 'Full body', groups: ['pecho','espalda','cuadriceps','gluteo','core'] },
  { value: 'upper', label: 'Upper', groups: ['pecho','espalda','hombros','biceps','triceps'] },
  { value: 'lower', label: 'Lower', groups: ['cuadriceps','isquios','gluteo','pantorrillas'] },
  { value: 'pecho', label: 'Pecho', groups: ['pecho'] },
  { value: 'espalda', label: 'Espalda', groups: ['espalda'] },
  { value: 'hombros', label: 'Hombros', groups: ['hombros'] },
  { value: 'brazos', label: 'Brazos', groups: ['biceps','triceps'] },
  { value: 'piernas', label: 'Piernas', groups: ['cuadriceps','isquios','pantorrillas'] },
  { value: 'gluteo', label: 'Glúteo', groups: ['gluteo'] },
  { value: 'core', label: 'Core', groups: ['core'] },
];

const DAY_NAMES = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

// ══════════════════════════════════════════════════════════════
// LLAMADA A IA — ORQUESTADOR
// ══════════════════════════════════════════════════════════════

async function orchestrateWorkout(params: {
  candidates: Exercise[];
  targetCount: number;
  goal: Goal;
  intensity: 'baja' | 'media' | 'alta';
  userName: string;
  dayLabel: string;
}): Promise<CachedWorkout> {
  const { candidates, targetCount, goal, intensity, userName, dayLabel } = params;

  const candidatesCompact = candidates.map(c =>
    `${c.id} | ${c.muscleGroup} | ${c.type} | sets:${c.defaultSets} reps:${c.defaultReps} rest:${c.defaultRest}s`
  ).join('\n');

  const intensityInstruction = intensity === 'baja'
    ? 'Intensidad BAJA: reduce sets 30%, reps más bajas, descansos más largos'
    : intensity === 'alta'
    ? 'Intensidad ALTA: sets altos, peso/reps desafiantes, descansos ajustados al goal'
    : 'Intensidad MEDIA: sets y reps estándar según defaults de cada ejercicio';

  const prompt = `Orquesta una sesión de ${dayLabel} para ${userName || 'el usuario'}.

EJERCICIOS DISPONIBLES (elige solo de esta lista):
${candidatesCompact}

PARÁMETROS:
- Cantidad objetivo: ${targetCount} ejercicios
- Goal del día: ${goal}
- ${intensityInstruction}

TAREA:
1. Selecciona exactamente ${targetCount} IDs de la lista (variedad y orden lógico: compuestos primero, aislamiento después, core al final)
2. Ajusta sets/reps/rest según el goal (fuerza: reps bajas 4-6, descansos 120s; hipertrofia: 8-12 reps, 60-90s; condicion: circuito 15+ reps, 30-45s; movilidad: tiempos largos)
3. Escribe tip_personalizado breve (máx 15 palabras) por ejercicio
4. Escribe warmup y cooldown breves (1 oración cada uno)
5. Escribe note motivadora breve (1-2 oraciones para ${userName || 'el usuario'})

Responde SOLO este JSON, sin markdown:
{
  "type": "${dayLabel}",
  "intensity": "${intensity}",
  "exercises": [
    { "id": "exercise-id", "sets": 4, "reps": "8-10", "rest": 90, "tip_personalizado": "tip breve" }
  ],
  "warmup": "...",
  "cooldown": "...",
  "note": "..."
}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const raw = data.content?.[0]?.text ?? '{}';
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(cleaned) as CachedWorkout;
}

// ══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════

type Phase = 'decision' | 'manual' | 'generating' | 'plan' | 'error';

export default function DailyTrainer() {
  const userName = useAppStore(s => s.userName);
  const obData = useAppStore(s => s.obData);
  const workoutLog = useAppStore(s => s.workoutLog);
  const dailyCheckIn = useAppStore(s => s.dailyCheckIn);
  const storedWorkout = useAppStore(s => s.dailyWorkout);
  const saveDailyWorkout = useAppStore(s => s.saveDailyWorkout);
  const storedChecked = useAppStore(s => s.dailyWorkoutChecked);
  const toggleDailyWorkoutCheck = useAppStore(s => s.toggleDailyWorkoutCheck);
  const regenCount = useAppStore(s => s.dailyWorkoutRegenCount);
  const incrementRegen = useAppStore(s => s.incrementDailyWorkoutRegen);

  const today = new Date().toISOString().split('T')[0];
  const firstName = userName?.split(' ')[0] || '';
  const todayDayName = DAY_NAMES[new Date().getDay()];
  const todayDateShort = `${new Date().getDate()} ${new Date().toLocaleDateString('es-ES', { month: 'short' })}`;

  // ── Regen limit
  const regensToday = regenCount?.date === today ? regenCount.count : 0;
  const regenBlocked = regensToday >= 3;
  const regensLeft = Math.max(0, 3 - regensToday);

  // ── Today's planned decision
  const todayDecision: WorkoutDayDecision = useMemo(() => decideTodayWorkout({
    userObjective: String(obData?.goal || ''),
    workoutLog: workoutLog || [],
    exercises: exerciseBank,
    dailyEnergy: dailyCheckIn?.date === today ? dailyCheckIn.feeling as any : undefined,
    dailySleep: dailyCheckIn?.date === today ? dailyCheckIn.sleep as any : undefined,
  }), [obData, workoutLog, dailyCheckIn, today]);

  // ── Local state
  const [phase, setPhase] = useState<Phase>(() => {
    if (storedWorkout?.date === today) return 'plan';
    return 'decision';
  });
  const [plan, setPlan] = useState<CachedWorkout | null>(
    storedWorkout?.date === today ? (storedWorkout.plan as any) : null
  );
  const [error, setError] = useState('');

  // Auto-mode config
  const [selectedTime, setSelectedTime] = useState<number>(45);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment>('gym');

  // Manual-mode config
  const [manualEquipment, setManualEquipment] = useState<Equipment[]>(['gym']);
  const [manualMuscles, setManualMuscles] = useState<string[]>(['full-body']);
  const [manualGoal, setManualGoal] = useState<Goal>('hipertrofia');
  const [manualTime, setManualTime] = useState<number>(45);

  // ── Reset if day changed
  useEffect(() => {
    if (storedWorkout && storedWorkout.date !== today) {
      setPlan(null);
      setPhase('decision');
    }
  }, [today, storedWorkout]);

  // ══════════════════════════════════════════════════════════════
  // GENERAR RUTINA (con cache)
  // ══════════════════════════════════════════════════════════════

  async function generateWorkout(params: {
    equipment: Equipment[];
    muscleGroups: MuscleGroup[];
    goal: Goal;
    duration: number;
    dayLabel: string;
    isManual: boolean;
  }) {
    setPhase('generating');
    setError('');

    try {
      const dayTypeKey = params.isManual ? 'manual' : todayDecision.type;
      const configHash = buildConfigHash({
        duration: params.duration,
        equipment: params.equipment.sort().join(','),
        goal: params.goal,
        dayType: dayTypeKey,
      });

      // Try cache first
      const validIds = new Set(exerciseBank.map(e => e.id));
      const cached = await getCachedWorkout(configHash);
      if (cached && validateWorkout(cached, validIds)) {
        setPlan(cached);
        saveDailyWorkout(cached as any);
        setPhase('plan');
        return;
      }

      // No cache — orchestrate with IA
      const history = analyzeWorkoutHistory(workoutLog || [], exerciseBank);
      const excludeMuscles = [...history.yesterday, ...history.twoDaysAgo];

      const candidates = filterExercisesForWorkout({
        exercises: exerciseBank,
        equipment: params.equipment,
        muscleGroups: params.muscleGroups,
        goal: params.goal,
        excludeMuscles: params.isManual ? [] : excludeMuscles,
      });

      if (candidates.length < 3) {
        throw new Error('No hay suficientes ejercicios para esta combinación. Prueba cambiar equipo o grupo muscular.');
      }

      const targetCount = Math.min(
        exerciseCountForDuration(params.duration),
        candidates.length
      );

      const workout = await orchestrateWorkout({
        candidates: candidates.slice(0, 15),
        targetCount,
        goal: params.goal,
        intensity: todayDecision.intensity,
        userName,
        dayLabel: params.dayLabel,
      });

      // Validate before saving
      if (!validateWorkout(workout, validIds)) {
        throw new Error('La rutina generada tiene ejercicios inválidos. Reintenta.');
      }

      // Save to cache (fire and forget)
      saveWorkoutToCache({
        configHash,
        duration: params.duration,
        equipment: params.equipment.sort().join(','),
        goal: params.goal,
        dayType: dayTypeKey,
        workout,
      }).catch(() => {});

      setPlan(workout);
      saveDailyWorkout(workout as any);
      setPhase('plan');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar la rutina');
      setPhase('error');
    }
  }

  // ══════════════════════════════════════════════════════════════
  // HANDLERS
  // ══════════════════════════════════════════════════════════════

  function handleAutoGenerate() {
    if (todayDecision.type === 'descanso') {
      setPlan({
        type: 'Descanso',
        intensity: 'baja',
        exercises: [],
        warmup: '',
        cooldown: '',
        note: 'Hoy toca descansar. Escucha a tu cuerpo.',
      });
      setPhase('plan');
      return;
    }

    const goal: Goal = todayDecision.type === 'movilidad'
      ? 'movilidad'
      : todayDecision.type === 'cardio'
      ? 'condicion'
      : 'hipertrofia';

    generateWorkout({
      equipment: [selectedEquipment],
      muscleGroups: todayDecision.muscleGroups,
      goal,
      duration: selectedTime,
      dayLabel: todayDecision.label,
      isManual: false,
    });
  }

  function handleManualGenerate() {
    const muscleGroups = Array.from(new Set(
      manualMuscles.flatMap(m => {
        const opt = MUSCLE_OPTIONS.find(o => o.value === m);
        return opt?.groups || [];
      })
    ));

    if (manualEquipment.length === 0 || muscleGroups.length === 0) {
      setError('Elige al menos un equipo y un grupo muscular.');
      setPhase('error');
      return;
    }

    generateWorkout({
      equipment: manualEquipment,
      muscleGroups: muscleGroups as MuscleGroup[],
      goal: manualGoal,
      duration: manualTime,
      dayLabel: 'Rutina personalizada',
      isManual: true,
    });
  }

  function handleRegenerate() {
    if (regenBlocked) return;
    incrementRegen();
    setPlan(null);
    saveDailyWorkout(null as any);
    setPhase('decision');
  }

  function toggleManualMuscle(value: string) {
    setManualMuscles(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  }

  function toggleManualEquipment(value: Equipment) {
    setManualEquipment(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  }

  function toggleCheck(i: number) {
    toggleDailyWorkoutCheck(i);
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER: GENERATING
  // ══════════════════════════════════════════════════════════════

  if (phase === 'generating') {
    return (
      <div className="dt2-wrap">
        <div className="dt2-generating">
          <div className="dt2-gen-spinner" />
          <h3 className="dt2-gen-title">Armando <em>tu rutina</em>...</h3>
          <p className="dt2-gen-sub">Tu coach está eligiendo los mejores ejercicios</p>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER: ERROR
  // ══════════════════════════════════════════════════════════════

  if (phase === 'error') {
    return (
      <div className="dt2-wrap">
        <div className="dt2-error">
          <p className="dt2-error-text">⚠️ {error}</p>
          <button className="dt2-error-btn" onClick={() => setPhase('decision')}>
            Volver
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER: DECISION SCREEN (auto mode)
  // ══════════════════════════════════════════════════════════════

  if (phase === 'decision') {
    return (
      <div className="dt2-wrap">
        <div className="dt2-hero">
          <p className="dt2-hero-micro">rutina · {todayDayName} {todayDateShort}</p>
          <h1 className="dt2-hero-title">
            {firstName ? `${firstName}, ` : ''}<em>listo para entrenar</em>.
          </h1>
          <p className="dt2-hero-sub">Dime 2 cosas y yo armo el resto.</p>
        </div>

        {/* Main decision card */}
        <div className="dt2-card">
          <div className="dt2-card-badge">
            <span className="dt2-card-badge-dot" />
            <span className="dt2-card-badge-text">decidido por tu coach</span>
          </div>
          <p className="dt2-card-label">Hoy toca</p>
          <h2 className="dt2-card-title">
            <em>{todayDecision.label}</em>
          </h2>
          <div className="dt2-card-why">
            <div className="dt2-card-why-label">Por qué hoy</div>
            <p className="dt2-card-why-text">{todayDecision.reason}</p>
          </div>
        </div>

        {/* Config questions */}
        {todayDecision.type !== 'descanso' && (
          <>
            <div className="dt2-q">
              <p className="dt2-q-label">¿Cuánto tiempo tienes?</p>
              <div className="dt2-chips dt2-chips-3">
                {TIME_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={`dt2-chip${selectedTime === opt.value ? ' on' : ''}`}
                    onClick={() => setSelectedTime(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="dt2-q">
              <p className="dt2-q-label">¿Dónde estás hoy?</p>
              <div className="dt2-chips dt2-chips-col">
                {EQUIPMENT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={`dt2-chip dt2-chip-eq${selectedEquipment === opt.value ? ' on' : ''}`}
                    onClick={() => setSelectedEquipment(opt.value)}
                  >
                    <span className="dt2-chip-icon">{opt.icon}</span>
                    <span>{opt.label}</span>
                    <span className="dt2-chip-desc">{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            <button className="dt2-cta" onClick={handleAutoGenerate}>
              Arma mi <em>rutina</em> →
            </button>
          </>
        )}

        {todayDecision.type === 'descanso' && (
          <button className="dt2-cta" onClick={handleAutoGenerate}>
            Aceptar día de descanso →
          </button>
        )}

        <div className="dt2-manual-link">
          <button className="dt2-link" onClick={() => setPhase('manual')}>
            Prefiero elegir yo todo <Settings size={12} />
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER: MANUAL MODE
  // ══════════════════════════════════════════════════════════════

  if (phase === 'manual') {
    return (
      <div className="dt2-wrap">
        <div className="dt2-hero">
          <p className="dt2-hero-micro">rutina personalizada</p>
          <h1 className="dt2-hero-title">
            <em>Tú decides</em> todo.
          </h1>
          <p className="dt2-hero-sub">Elige equipo, grupos, cómo se siente y cuánto tiempo.</p>
        </div>

        <div className="dt2-q">
          <p className="dt2-q-label">
            Con qué entrenas
            <span className="dt2-q-hint">puedes elegir varios</span>
          </p>
          <div className="dt2-chips">
            {EQUIPMENT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`dt2-chip${manualEquipment.includes(opt.value) ? ' on' : ''}`}
                onClick={() => toggleManualEquipment(opt.value)}
              >
                <span className="dt2-chip-icon">{opt.icon}</span>
                <span>{opt.label.replace('En el ', '').replace('En casa ', '')}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="dt2-q">
          <p className="dt2-q-label">
            Qué trabajas hoy
            <span className="dt2-q-hint">puedes elegir varios</span>
          </p>
          <div className="dt2-chips">
            {MUSCLE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`dt2-chip${manualMuscles.includes(opt.value) ? ' on' : ''}`}
                onClick={() => toggleManualMuscle(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="dt2-q">
          <p className="dt2-q-label">
            Cómo se siente
            <span className="dt2-q-hint">elige una</span>
          </p>
          <div className="dt2-chips">
            {GOAL_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`dt2-chip${manualGoal === opt.value ? ' on' : ''}`}
                onClick={() => setManualGoal(opt.value)}
              >
                <span className="dt2-chip-icon">{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="dt2-q">
          <p className="dt2-q-label">
            Cuánto tiempo
            <span className="dt2-q-hint">elige una</span>
          </p>
          <div className="dt2-chips dt2-chips-3">
            {TIME_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`dt2-chip${manualTime === opt.value ? ' on' : ''}`}
                onClick={() => setManualTime(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button className="dt2-cta" onClick={handleManualGenerate}>
          Generar mi <em>rutina personalizada</em> →
        </button>

        <div className="dt2-manual-link">
          <button className="dt2-link" onClick={() => setPhase('decision')}>
            ← Volver al modo automático
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER: PLAN (rutina generada)
  // ══════════════════════════════════════════════════════════════

  if (phase === 'plan' && plan) {
    const exerciseMap = new Map(exerciseBank.map(e => [e.id, e]));
    const checked = storedChecked || [];

    return (
      <div className="dt2-wrap">
        <div className="dt2-plan-header">
          <div>
            <p className="dt2-plan-micro">tu rutina · {todayDayName} {todayDateShort}</p>
            <h2 className="dt2-plan-title">
              <em>{plan.type}</em>
            </h2>
            <div className="dt2-plan-meta">
              <span className="dt2-meta-chip">
                <Clock size={11} /> {plan.exercises.length > 0 ? `${plan.exercises.length} ejercicios` : 'descanso'}
              </span>
              <span className="dt2-meta-chip">
                <Zap size={11} /> {plan.intensity}
              </span>
            </div>
          </div>
          <button
            className={`dt2-regen${regenBlocked ? ' locked' : ''}`}
            onClick={handleRegenerate}
            disabled={regenBlocked}
            title={regenBlocked ? 'Ya regeneraste 3 veces hoy' : `Te quedan ${regensLeft} regeneraciones`}
          >
            {regenBlocked ? <Lock size={14} /> : <RefreshCw size={14} />}
          </button>
        </div>

        {plan.warmup && (
          <div className="dt2-section dt2-warmup">
            <div className="dt2-section-label">Calentamiento</div>
            <p className="dt2-section-text">{plan.warmup}</p>
          </div>
        )}

        {plan.exercises.length > 0 && (
          <div className="dt2-exercises">
            {plan.exercises.map((ex, i) => {
              const bank = exerciseMap.get(ex.id);
              const isDone = checked.includes(i);
              return (
                <div key={`${ex.id}-${i}`} className={`dt2-ex${isDone ? ' done' : ''}`}>
                  <button
                    className="dt2-ex-check"
                    onClick={() => toggleCheck(i)}
                    aria-label={isDone ? 'Desmarcar' : 'Marcar como hecho'}
                  >
                    {isDone ? '✓' : ''}
                  </button>
                  <div className="dt2-ex-emoji">{bank?.emoji || '💪'}</div>
                  <div className="dt2-ex-body">
                    <div className="dt2-ex-name">{bank?.name || ex.id}</div>
                    <div className="dt2-ex-stats">
                      <span>{ex.sets} × {ex.reps}</span>
                      <span className="dt2-ex-dot">·</span>
                      <span>{ex.rest}s descanso</span>
                    </div>
                    {ex.tip_personalizado && (
                      <div className="dt2-ex-tip">{ex.tip_personalizado}</div>
                    )}
                  </div>
                  <ChevronRight size={14} className="dt2-ex-arrow" />
                </div>
              );
            })}
          </div>
        )}

        {plan.cooldown && (
          <div className="dt2-section dt2-cooldown">
            <div className="dt2-section-label">Enfriamiento</div>
            <p className="dt2-section-text">{plan.cooldown}</p>
          </div>
        )}

        {plan.note && (
          <div className="dt2-note">
            <p className="dt2-note-text">{plan.note}</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}
