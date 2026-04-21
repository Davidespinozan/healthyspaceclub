import { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../store';
import { exercises as exerciseBank } from '../data/exercises';
import {
  decideTodayWorkout,
  analyzeWorkoutHistory,
  filterExercisesForWorkout,
  buildConfigHash,
  exerciseCountForDuration,
  filterByModality,
  countByModality,
  suggestModality,
} from '../utils/workoutPlanner';
import {
  getCachedWorkout,
  saveWorkoutToCache,
  validateWorkout,
  SCHEMA_VERSIONS,
  type CachedWorkout,
} from '../utils/workoutCache';
import {
  validatePowerVinyasaPlan,
  validateWorkoutPlanStrict,
} from '../utils/workoutValidation';
import type {
  Exercise,
  Equipment,
  Goal,
  MuscleGroup,
  Modality,
  WorkoutDayDecision,
  YogaPlan,
} from '../types';
import { RefreshCw, Clock, Zap, ChevronRight, Lock } from 'lucide-react';
import ExerciseDetailPopout from './ExerciseDetailPopout';
import YogaFlowPlayer from './YogaFlowPlayer';
import './daily-trainer-v2.css';

const API_KEY = import.meta.env.VITE_CLAUDE_API_KEY;

const DAY_NAMES = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

const MODALITY_OPTIONS: Array<{
  value: Modality;
  emoji: string;
  label: string;
  sub: string;
  minExercises: number;
}> = [
  { value: 'auto', emoji: '🤖', label: 'Lo que mi coach decida', sub: '', minExercises: 0 },
  { value: 'fuerza', emoji: '🏋️', label: 'Fuerza', sub: 'Push, Pull, Legs, Full body', minExercises: 5 },
  { value: 'yoga', emoji: '🧘', label: 'Yoga / recovery', sub: 'Recovery activo + movilidad', minExercises: 5 },
  { value: 'cardio', emoji: '🏃', label: 'Cardio', sub: 'HIIT, intervalos, walking', minExercises: 5 },
];

const TIME_OPTIONS = [
  { value: 25, label: '25 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60+ min' },
];

const EQUIPMENT_OPTIONS: Array<{ value: Equipment; label: string; icon: string }> = [
  { value: 'gym', label: 'En el gym', icon: '🏋️' },
  { value: 'cuerpo', label: 'En casa', icon: '🤸' },
  { value: 'ligas', label: 'Con bandas', icon: '🎗️' },
];

const PRIOR_EXERCISE_OPTIONS = [
  { value: 'none', label: 'No, este es el primero', icon: '✅' },
  { value: 'light', label: 'Sí, algo ligero', icon: '🚶' },
  { value: 'heavy', label: 'Sí, fuerte', icon: '💪' },
];

const DISCOMFORT_OPTIONS = [
  { value: 'none', label: 'Todo bien', icon: '✅' },
  { value: 'mild', label: 'Algo leve, puedo entrenar', icon: '⚠️' },
  { value: 'pain', label: 'Dolor específico', icon: '🩹' },
];

const PAIN_AREAS = ['hombro', 'rodilla', 'espalda', 'cuello', 'otro'];

// ══════════════════════════════════════════════════════════════
// IA ORCHESTRATOR
// ══════════════════════════════════════════════════════════════

async function orchestrateWorkout(params: {
  candidates: Exercise[];
  targetCount: number;
  goal: Goal;
  intensity: 'baja' | 'media' | 'alta';
  userName: string;
  dayLabel: string;
  context: string;
}): Promise<CachedWorkout & { razon?: string }> {
  if (!API_KEY) throw new Error('API no disponible. Intenta más tarde.');
  const { candidates, targetCount, goal, intensity, userName, dayLabel, context } = params;

  const candidatesCompact = candidates.map(c =>
    `${c.id} | ${c.muscleGroup} | ${c.type} | sets:${c.defaultSets} reps:${c.defaultReps} rest:${c.defaultRest}s`
  ).join('\n');

  const intensityInstruction = intensity === 'baja'
    ? 'Intensidad BAJA: reduce sets 30%, reps más bajas, descansos más largos'
    : intensity === 'alta'
    ? 'Intensidad ALTA: sets altos, peso/reps desafiantes, descansos ajustados al goal'
    : 'Intensidad MEDIA: sets y reps estándar según defaults de cada ejercicio';

  const prompt = `Orquesta una sesión de ${dayLabel} para ${userName || 'el usuario'}.

CONTEXTO DEL USUARIO:
${context}

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
6. Escribe razon: por qué elegiste esta rutina citando al menos 2 piezas del contexto

Responde SOLO este JSON, sin markdown:
{
  "type": "${dayLabel}",
  "intensity": "${intensity}",
  "exercises": [
    { "id": "exercise-id", "sets": 4, "reps": "8-10", "rest": 90, "tip_personalizado": "tip breve" }
  ],
  "warmup": "...",
  "cooldown": "...",
  "note": "...",
  "razon": "..."
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

  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const raw = data.content?.[0]?.text ?? '{}';
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(cleaned);
}

// ══════════════════════════════════════════════════════════════
// POWER VINYASA ORCHESTRATOR
// ══════════════════════════════════════════════════════════════

async function orchestratePowerVinyasa(params: {
  candidates: Exercise[];
  targetDurationSeconds: number;
  userName: string;
  context: string;
  painArea?: string;
}): Promise<YogaPlan> {
  if (!API_KEY) throw new Error('API no disponible. Intenta más tarde.');

  const candidatesInfo = params.candidates.map(p =>
    `${p.id} | base: ${p.defaultDuration}s | ${p.muscleGroup} | ${p.difficulty}`
  ).join('\n');

  const minutes = Math.round(params.targetDurationSeconds / 60);
  const minSec = Math.floor(params.targetDurationSeconds * 0.95);
  const maxSec = Math.ceil(params.targetDurationSeconds * 1.05);

  const painInstruction = params.painArea
    ? `\n\nEVITA poses que comprometan: ${params.painArea}.`
    : '';

  const prompt = `Genera un flow de POWER VINYASA auténtico (estilo Baron Baptiste, influencia Ashtanga) de EXACTAMENTE ${minutes} minutos para ${params.userName || 'el usuario'}.

CONTEXTO DEL USUARIO:
${params.context}

POSES DISPONIBLES (elige solo de esta lista — son las únicas válidas):
${candidatesInfo}

ESTRUCTURA RITUAL OBLIGATORIA DE POWER VINYASA:

1. OPENING (5-8% del tiempo) — centering
   - child-pose para grounding

2. WARM-UP (15-20%) — movilidad activa
   - cat-cow
   - downward-dog
   - sun-salutation-a (3-4 rounds con repetitions)
   - sun-salutation-b (3-4 rounds con repetitions)

3. STANDING SERIES (30-35%) — completar un lado, luego el otro
   Secuencia tipo por lado:
   - warrior-i → warrior-ii → reverse-warrior → triangle-pose
   - half-moon (si nivel intermedio/avanzado)
   - Insertar VINYASA entre poses: high-plank-yoga → chaturanga → upward-dog → downward-dog
   - crescent-lunge → revolved-chair (opcional) → warrior-iii

4. PEAK POSE (5-8%) — UNA pose desafiante según nivel
   - Principiante: boat-pose o side-plank-yoga
   - Intermedio: crow-pose o camel-pose
   - Avanzado: wheel-pose

5. COOL-DOWN (15-20%) — descenso al suelo
   - pigeon-pose (60s por lado = 120s total)
   - seated-forward-fold
   - seated-twist (60s)
   - supine-twist (60s)
   - happy-baby

6. SAVASANA (8-10%) — OBLIGATORIO AL FINAL
   - savasana mínimo 300 segundos, sin excepción

REGLAS ESTRICTAS:
- La suma de TODAS las duraciones debe estar entre ${minSec}s y ${maxSec}s
- NO incluyas descansos entre poses (el flow es continuo en Power Vinyasa)
- En vinyasas de standing series: high-plank-yoga (15s) → chaturanga (15s) → upward-dog (15s) → downward-dog (30s) = 75s total
- Para sun-salutation-a y sun-salutation-b, usa "repetitions" de 3-4 vueltas
- Para poses con "por lado" (warriors, triangle, pigeon, lizard, crescent, half-moon, side-plank, seated-twist, revolved-chair), usa "sides": "both" — la duration ya incluye ambos lados
- Cada pose tiene "tip_personalizado" breve (máx 12 palabras) enfocado en respiración, alineación o sensación
- Savasana al final es OBLIGATORIO, mínimo 300s${painInstruction}

Responde SOLO este JSON, sin markdown ni texto extra:
{
  "type": "Power Vinyasa ${minutes} min",
  "totalDuration": ${params.targetDurationSeconds},
  "intensity": "media",
  "opening": "Instrucción breve de apertura (1 frase)",
  "poses": [
    { "id": "child-pose", "duration": 45, "tip_personalizado": "Respira profundo, siente el peso del cuerpo" },
    { "id": "cat-cow", "duration": 60, "tip_personalizado": "..." },
    { "id": "sun-salutation-a", "duration": 180, "repetitions": 3, "tip_personalizado": "..." },
    { "id": "warrior-i", "duration": 30, "sides": "both", "tip_personalizado": "..." },
    { "id": "high-plank-yoga", "duration": 15, "tip_personalizado": "..." },
    { "id": "chaturanga", "duration": 15, "tip_personalizado": "..." },
    { "id": "upward-dog", "duration": 15, "tip_personalizado": "..." },
    { "id": "downward-dog", "duration": 30, "tip_personalizado": "..." },
    { "id": "savasana", "duration": 300, "tip_personalizado": "Suelta todo, recibe el flow" }
  ],
  "closing": "Instrucción breve de cierre (1 frase)",
  "note": "Mensaje motivador breve citando el contexto",
  "razon": "Por qué este flow hoy, citando al menos 2 piezas del contexto"
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
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const raw = data.content?.[0]?.text ?? '{}';
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const yogaPlan = JSON.parse(cleaned) as YogaPlan;

  // Validación de duración total
  const actualDuration = yogaPlan.poses.reduce((sum, p) => sum + p.duration, 0);
  const diff = Math.abs(actualDuration - params.targetDurationSeconds);
  const tolerance = params.targetDurationSeconds * 0.1;
  if (diff > tolerance) {
    console.warn(`[power-vinyasa] duración ${actualDuration}s vs target ${params.targetDurationSeconds}s (diff: ${diff}s)`);
  }

  // Validación: savasana al final es obligatorio
  const lastPose = yogaPlan.poses[yogaPlan.poses.length - 1];
  if (lastPose?.id !== 'savasana') {
    console.warn('[power-vinyasa] Savasana no está al final, forzando');
    yogaPlan.poses = yogaPlan.poses.filter(p => p.id !== 'savasana');
    yogaPlan.poses.push({ id: 'savasana', duration: 300, tip_personalizado: 'Suelta, recibe el flow' });
  }

  return yogaPlan;
}

// ══════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════

type Phase = 'modality' | 'physical' | 'logistics' | 'generating' | 'plan' | 'error';

export default function DailyTrainer() {
  const userName = useAppStore(s => s.userName);
  const obData = useAppStore(s => s.obData);
  const workoutLog = useAppStore(s => s.workoutLog);
  const dailyCheckIn = useAppStore(s => s.dailyCheckIn);
  const dailyCheckin = useAppStore(s => s.dailyCheckin);
  const dailyCheckinDate = useAppStore(s => s.dailyCheckinDate);
  const storedWorkout = useAppStore(s => s.dailyWorkout);
  const saveDailyWorkout = useAppStore(s => s.saveDailyWorkout);
  const storedChecked = useAppStore(s => s.dailyWorkoutChecked);
  const toggleDailyWorkoutCheck = useAppStore(s => s.toggleDailyWorkoutCheck);
  const regenCount = useAppStore(s => s.dailyWorkoutRegenCount);
  const incrementRegen = useAppStore(s => s.incrementDailyWorkoutRegen);
  const streakCount = useAppStore(s => s.streakCount);

  const today = new Date().toISOString().split('T')[0];
  const firstName = userName?.split(' ')[0] || '';
  const todayDayName = DAY_NAMES[new Date().getDay()];
  const todayDateShort = `${new Date().getDate()} ${new Date().toLocaleDateString('es-ES', { month: 'short' })}`;

  const regensToday = regenCount?.date === today ? regenCount.count : 0;
  const regenBlocked = regensToday >= 3;
  const regensLeft = Math.max(0, 3 - regensToday);

  // Check if we have today's checkin already
  const hasCheckinToday = dailyCheckinDate === today && dailyCheckin !== null;
  const hasWorkoutToday = workoutLog.some(e => e.date === today);
  const skipPhysical = hasCheckinToday || hasWorkoutToday;

  // Modality counts
  const modalityCounts = useMemo(() => countByModality(exerciseBank), []);

  // Suggested modality
  const suggestion = useMemo(() => suggestModality({
    workoutLog: workoutLog || [],
    exercises: exerciseBank,
    dailyEnergy: dailyCheckin || undefined,
    streakCount,
  }), [workoutLog, dailyCheckin, streakCount]);

  // Auto decision
  const todayDecision: WorkoutDayDecision = useMemo(() => decideTodayWorkout({
    userObjective: String(obData?.goal || ''),
    workoutLog: workoutLog || [],
    exercises: exerciseBank,
    dailyEnergy: dailyCheckIn?.date === today ? dailyCheckIn.feeling as any : undefined,
    dailySleep: dailyCheckIn?.date === today ? dailyCheckIn.sleep as any : undefined,
  }), [obData, workoutLog, dailyCheckIn, today]);

  // ── State
  const [phase, setPhase] = useState<Phase>(() => {
    if (storedWorkout?.date === today) return 'plan';
    return 'modality';
  });
  const [plan, setPlan] = useState<(CachedWorkout & { razon?: string }) | null>(
    storedWorkout?.date === today ? (storedWorkout.plan as any) : null
  );
  const [error, setError] = useState('');

  // Flow state
  const [selectedModality, setSelectedModality] = useState<Modality>(suggestion.modality);
  const [priorExercise, setPriorExercise] = useState('none');
  const [discomfort, setDiscomfort] = useState('none');
  const [painArea, setPainArea] = useState('');
  const [selectedTime, setSelectedTime] = useState(45);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment>('gym');

  // Loading context bullets
  const [contextBullets, setContextBullets] = useState<string[]>([]);

  // Popout
  const [playerOpen, setPlayerOpen] = useState(false);

  const [selectedExercise, setSelectedExercise] = useState<{
    exercise: Exercise;
    planData: { sets: number; reps: string; rest: number; tip_personalizado?: string };
    index: number;
  } | null>(null);

  useEffect(() => {
    if (storedWorkout && storedWorkout.date !== today) {
      setPlan(null);
      setPhase('modality');
    }
  }, [today, storedWorkout]);

  // ── Flow navigation
  function handleModalityNext() {
    if (skipPhysical) {
      setPhase('logistics');
    } else {
      setPhase('physical');
    }
  }

  function handlePhysicalNext() {
    setPhase('logistics');
  }

  // ── Generate
  async function handleGenerate() {
    // Build context
    const history = analyzeWorkoutHistory(workoutLog || [], exerciseBank);
    const bullets: string[] = [];

    if (history.restDays > 0) bullets.push(`${history.restDays} día${history.restDays > 1 ? 's' : ''} sin entrenar`);
    else bullets.push('Entrenó ayer');
    bullets.push(`Objetivo: ${obData?.goal || 'general'}`);
    if (hasCheckinToday) bullets.push(`Energía: ${dailyCheckin}`);
    const modalityLabel = MODALITY_OPTIONS.find(m => m.value === selectedModality)?.label || 'auto';
    bullets.push(`Modalidad: ${modalityLabel}`);
    bullets.push(`${selectedTime} min en ${selectedEquipment}`);
    if (priorExercise !== 'none') bullets.push(`Ya entrenó hoy: ${priorExercise === 'light' ? 'algo ligero' : 'fuerte'}`);
    if (discomfort === 'mild') bullets.push('Molestia leve');
    if (discomfort === 'pain' && painArea) bullets.push(`Dolor en: ${painArea}`);

    setContextBullets(bullets);
    setPhase('generating');
    setError('');

    try {
      // Determine day type and goal based on modality
      let dayLabel: string;
      let goal: Goal;
      let muscleGroups: MuscleGroup[];

      if (selectedModality === 'auto') {
        dayLabel = todayDecision.label;
        goal = todayDecision.type === 'movilidad' ? 'movilidad' : todayDecision.type === 'cardio' ? 'condicion' : 'hipertrofia';
        muscleGroups = todayDecision.muscleGroups;
      } else if (selectedModality === 'yoga') {
        dayLabel = 'Yoga / Recovery';
        goal = 'movilidad';
        muscleGroups = ['cuerpo-completo'];
      } else if (selectedModality === 'cardio') {
        dayLabel = 'Cardio';
        goal = 'condicion';
        muscleGroups = ['cardio', 'cuerpo-completo'];
      } else {
        // fuerza — use auto decision for muscle group split
        dayLabel = todayDecision.label;
        goal = 'hipertrofia';
        muscleGroups = todayDecision.muscleGroups;
      }

      // Rama especial para yoga: Power Vinyasa (sin cache, siempre regenerar)
      if (selectedModality === 'yoga') {
        const yogaCandidates = filterByModality(exerciseBank, 'yoga');

        console.warn('[yoga-debug] candidates count:', yogaCandidates.length);
        console.warn('[yoga-debug] candidates ids:', yogaCandidates.map(e => e.id));

        if (yogaCandidates.length < 15) {
          throw new Error(`Solo hay ${yogaCandidates.length} poses de yoga curadas. Necesitamos mínimo 15 para Power Vinyasa.`);
        }

        const targetDurationSeconds = selectedTime * 60;
        const contextStr = bullets.join('\n- ');

        const orchParams = {
          candidates: yogaCandidates,
          targetDurationSeconds,
          userName,
          context: `- ${contextStr}`,
          painArea: discomfort === 'pain' ? painArea : undefined,
        };

        let yogaPlan = await orchestratePowerVinyasa(orchParams);

        // Post-generation validation
        const yogaIds = new Set(exerciseBank.filter(e => e.isYoga).map(e => e.id));
        const validation = validatePowerVinyasaPlan(yogaPlan, targetDurationSeconds, yogaIds);

        if (!validation.valid) {
          console.warn('[yoga] validación fallida, reintentando:', validation.errors);
          yogaPlan = await orchestratePowerVinyasa(orchParams);
          const retryValidation = validatePowerVinyasaPlan(yogaPlan, targetDurationSeconds, yogaIds);
          if (!retryValidation.valid) {
            console.error('[yoga] segundo intento falló:', retryValidation.errors);
            // Usar el plan con errores leves en vez de fallar completamente
          }
        }

        console.warn('[yoga-debug] plan received:', {
          type: yogaPlan.type,
          posesCount: yogaPlan.poses?.length,
          totalDuration: yogaPlan.totalDuration,
        });

        setPlan(yogaPlan as any);
        saveDailyWorkout(yogaPlan as any);
        setPhase('plan');
        return;
      }

      // Rama FUERZA/CARDIO/AUTO: con cache
      const dayTypeKey = selectedModality === 'auto' ? todayDecision.type : selectedModality;
      const configHash = buildConfigHash({
        duration: selectedTime,
        equipment: selectedEquipment,
        goal,
        dayType: dayTypeKey,
        schemaVersion: SCHEMA_VERSIONS.workout,
      });

      const validIds = new Set(exerciseBank.map(e => e.id));
      const cached = await getCachedWorkout(configHash, 'workout');
      if (cached && validateWorkout(cached, validIds)) {
        setPlan(cached);
        saveDailyWorkout(cached as any);
        setPhase('plan');
        return;
      }

      // Filter by modality first, then by equipment/muscles
      const modalityFiltered = filterByModality(exerciseBank, selectedModality);
      const equipmentList: Equipment[] = [selectedEquipment];

      let candidates: Exercise[];
      if (selectedModality === 'cardio') {
        candidates = modalityFiltered.filter(ex =>
          ex.equipment.some(e => equipmentList.includes(e))
        );
      } else {
        candidates = filterExercisesForWorkout({
          exercises: modalityFiltered.length > 0 ? modalityFiltered : exerciseBank,
          equipment: equipmentList,
          muscleGroups,
          goal,
          excludeMuscles: selectedModality === 'auto' ? [...history.yesterday] : [],
        });
      }

      // Exclude pain area muscles
      if (discomfort === 'pain' && painArea) {
        const painMuscleMap: Record<string, MuscleGroup[]> = {
          'hombro': ['hombros', 'pecho'],
          'rodilla': ['cuadriceps', 'isquios'],
          'espalda': ['espalda', 'core'],
          'cuello': ['hombros'],
          'otro': [],
        };
        const exclude = painMuscleMap[painArea] || [];
        if (exclude.length > 0) {
          candidates = candidates.filter(ex => !exclude.includes(ex.muscleGroup));
        }
      }

      // Reduce intensity if prior heavy exercise or tired
      let intensity = todayDecision.intensity;
      if (priorExercise === 'heavy' || dailyCheckin === 'cansado') intensity = 'baja';
      else if (priorExercise === 'light' || discomfort === 'mild') intensity = 'media';

      if (candidates.length < 3) {
        throw new Error(`No hay suficientes ejercicios de ${modalityLabel} para esta combinación. Prueba cambiar equipo.`);
      }

      const targetCount = Math.min(exerciseCountForDuration(selectedTime), candidates.length);

      const contextStr = bullets.join('\n- ');
      const workout = await orchestrateWorkout({
        candidates: candidates.slice(0, 15),
        targetCount,
        goal,
        intensity,
        userName,
        dayLabel,
        context: `- ${contextStr}`,
      });

      if (!validateWorkout(workout, validIds)) {
        throw new Error('La rutina generada tiene ejercicios inválidos. Reintenta.');
      }

      const strictValidation = validateWorkoutPlanStrict(workout, validIds);
      if (!strictValidation.valid) {
        console.warn('[workout] validación estricta:', strictValidation.errors);
      }

      saveWorkoutToCache({
        configHash,
        duration: selectedTime,
        equipment: selectedEquipment,
        goal,
        dayType: dayTypeKey,
        workout,
        schemaType: 'workout',
      }).catch(() => {});

      setPlan(workout);
      saveDailyWorkout(workout as any);
      setPhase('plan');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar la rutina');
      setPhase('error');
    }
  }

  function handleRegenerate() {
    if (regenBlocked) return;
    incrementRegen();
    setPlan(null);
    saveDailyWorkout(null as any);
    setPhase('modality');
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
          <p className="dt2-gen-sub">Tu coach está considerando:</p>
          <div className="dt2-gen-bullets">
            {contextBullets.map((b, i) => (
              <div key={i} className="dt2-gen-bullet">· {b}</div>
            ))}
          </div>
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
          <button className="dt2-error-btn" onClick={() => setPhase('modality')}>Volver</button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER: STEP 1 — MODALITY
  // ══════════════════════════════════════════════════════════════

  if (phase === 'modality') {
    return (
      <div className="dt2-wrap">
        <div className="dt2-hero">
          <div className="dt2-step-indicator">
            <div className="dt2-step-dot active" />
            <div className="dt2-step-dot" />
            {!skipPhysical && <div className="dt2-step-dot" />}
          </div>
          <p className="dt2-hero-micro">paso 1 · {todayDayName} {todayDateShort}</p>
          <h1 className="dt2-hero-title">
            {firstName ? `${firstName}, ` : ''}<em>¿qué quieres hacer hoy?</em>
          </h1>
        </div>

        <div className="dt2-modality-list">
          {MODALITY_OPTIONS.map(opt => {
            const count = opt.value === 'auto' ? 999 : (modalityCounts[opt.value] || 0);
            const locked = opt.minExercises > 0 && count < opt.minExercises;
            const isSelected = selectedModality === opt.value;
            const isSuggested = suggestion.modality === opt.value;

            // Dynamic sub-label for auto
            let subLabel = opt.sub;
            if (opt.value === 'auto') {
              subLabel = suggestion.reason;
            }

            return (
              <button
                key={opt.value}
                className={`dt2-mod-card${isSelected ? ' selected' : ''}${locked ? ' locked' : ''}`}
                onClick={() => !locked && setSelectedModality(opt.value)}
                disabled={locked}
              >
                <div className="dt2-mod-emoji">{locked ? '🔒' : opt.emoji}</div>
                <div className="dt2-mod-body">
                  <div className="dt2-mod-label">
                    {opt.label}
                    {isSuggested && !locked && <span className="dt2-mod-badge">sugerido</span>}
                  </div>
                  <div className="dt2-mod-sub">{locked ? 'Próximamente' : subLabel}</div>
                </div>
                {isSelected && !locked && <div className="dt2-mod-check">✓</div>}
              </button>
            );
          })}
        </div>

        <button className="dt2-cta" onClick={handleModalityNext}>
          Siguiente →
        </button>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER: STEP 2 — PHYSICAL CONTEXT
  // ══════════════════════════════════════════════════════════════

  if (phase === 'physical') {
    return (
      <div className="dt2-wrap">
        <div className="dt2-hero">
          <div className="dt2-step-indicator">
            <div className="dt2-step-dot done" />
            <div className="dt2-step-dot active" />
            <div className="dt2-step-dot" />
          </div>
          <p className="dt2-hero-micro">paso 2 · contexto físico</p>
          <h1 className="dt2-hero-title">
            <em>¿Cómo vienes hoy?</em>
          </h1>
        </div>

        <div className="dt2-q">
          <p className="dt2-q-label">¿Ya hiciste ejercicio hoy?</p>
          <div className="dt2-chips dt2-chips-col">
            {PRIOR_EXERCISE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`dt2-chip dt2-chip-eq${priorExercise === opt.value ? ' on' : ''}`}
                onClick={() => setPriorExercise(opt.value)}
              >
                <span className="dt2-chip-icon">{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="dt2-q">
          <p className="dt2-q-label">¿Alguna molestia hoy?</p>
          <div className="dt2-chips dt2-chips-col">
            {DISCOMFORT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`dt2-chip dt2-chip-eq${discomfort === opt.value ? ' on' : ''}`}
                onClick={() => setDiscomfort(opt.value)}
              >
                <span className="dt2-chip-icon">{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {discomfort === 'pain' && (
          <div className="dt2-q">
            <p className="dt2-q-label">¿Dónde?</p>
            <div className="dt2-chips">
              {PAIN_AREAS.map(area => (
                <button
                  key={area}
                  className={`dt2-chip${painArea === area ? ' on' : ''}`}
                  onClick={() => setPainArea(area)}
                >
                  {area}
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="dt2-cta" onClick={handlePhysicalNext}>
          Siguiente →
        </button>

        <div className="dt2-manual-link">
          <button className="dt2-link" onClick={() => setPhase('modality')}>← Anterior</button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER: STEP 3 — LOGISTICS
  // ══════════════════════════════════════════════════════════════

  if (phase === 'logistics') {
    const stepNum = skipPhysical ? 2 : 3;

    return (
      <div className="dt2-wrap">
        <div className="dt2-hero">
          <div className="dt2-step-indicator">
            <div className="dt2-step-dot done" />
            {!skipPhysical && <div className="dt2-step-dot done" />}
            <div className="dt2-step-dot active" />
          </div>
          <p className="dt2-hero-micro">paso {stepNum} · logística</p>
          <h1 className="dt2-hero-title">
            <em>Últimos detalles</em>
          </h1>
        </div>

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

        {selectedModality !== 'yoga' && (
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
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="dt2-cta" onClick={handleGenerate}>
          Arma mi <em>rutina</em> →
        </button>

        <div className="dt2-manual-link">
          <button className="dt2-link" onClick={() => setPhase(skipPhysical ? 'modality' : 'physical')}>← Anterior</button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER: PLAN
  // ══════════════════════════════════════════════════════════════

  if (phase === 'plan' && plan) {
    const isYoga = 'poses' in plan && Array.isArray((plan as any).poses);
    const exerciseMap = new Map(exerciseBank.map(e => [e.id, e]));

    if (isYoga) {
      const yogaPlan = plan as unknown as YogaPlan;

      return (
        <div className="dt2-wrap">
          <div className="dt2-plan-header">
            <div>
              <p className="dt2-plan-micro">tu flow · {todayDayName} {todayDateShort}</p>
              <h2 className="dt2-plan-title"><em>{yogaPlan.type}</em></h2>
              <div className="dt2-plan-meta">
                <span className="dt2-meta-chip">
                  <Clock size={11} /> {Math.round(yogaPlan.totalDuration / 60)} min total
                </span>
                <span className="dt2-meta-chip">
                  🧘 {yogaPlan.poses.length} poses
                </span>
              </div>
            </div>
            <button
              className={`dt2-regen${regenBlocked ? ' locked' : ''}`}
              onClick={handleRegenerate}
              disabled={regenBlocked}
            >
              {regenBlocked ? <Lock size={14} /> : <RefreshCw size={14} />}
            </button>
          </div>

          {/* CTA para abrir player — ARRIBA, visible sin scroll */}
          <button
            className="dt2-yoga-start-cta"
            onClick={() => setPlayerOpen(true)}
          >
            ▶ comenzar flow
          </button>

          {yogaPlan.razon && (
            <div className="dt2-card-why">
              <div className="dt2-card-why-label">Por qué hoy</div>
              <p className="dt2-card-why-text">{yogaPlan.razon}</p>
            </div>
          )}

          {yogaPlan.opening && (
            <div className="dt2-section dt2-warmup">
              <div className="dt2-section-label">Opening</div>
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

              return (
                <div key={`${pose.id}-${i}`} className="dt2-yoga-item">
                  <div className="dt2-yoga-num">{i + 1}</div>
                  <div className="dt2-yoga-emoji">{bank?.emoji || '🧘'}</div>
                  <div className="dt2-yoga-body">
                    <div className="dt2-yoga-name">{bank?.name || pose.id}</div>
                    <div className="dt2-yoga-meta">
                      <span>{durationLabel}</span>
                      {pose.repetitions && (<><span className="dt2-ex-dot">·</span><span>{pose.repetitions}x</span></>)}
                      {pose.sides === 'both' && (<><span className="dt2-ex-dot">·</span><span>ambos lados</span></>)}
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
            <div className="dt2-section dt2-cooldown">
              <div className="dt2-section-label">Closing</div>
              <p className="dt2-section-text">{yogaPlan.closing}</p>
            </div>
          )}

          {yogaPlan.note && (
            <div className="dt2-note">
              <p className="dt2-note-text">{yogaPlan.note}</p>
            </div>
          )}

          {/* Player overlay */}
          {playerOpen && (
            <YogaFlowPlayer
              plan={yogaPlan}
              exerciseBank={exerciseBank}
              onClose={() => setPlayerOpen(false)}
              onComplete={() => {
                // TODO: registrar en workoutLog, sumar racha
                setPlayerOpen(false);
              }}
            />
          )}
        </div>
      );
    }
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

        {/* Razón del coach */}
        {(plan as any).razon && (
          <div className="dt2-card-why">
            <div className="dt2-card-why-label">Por qué hoy</div>
            <p className="dt2-card-why-text">{(plan as any).razon}</p>
          </div>
        )}

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
                <div
                  key={`${ex.id}-${i}`}
                  className={`dt2-ex${isDone ? ' done' : ''}`}
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
                  <button
                    className="dt2-ex-check"
                    onClick={(e) => { e.stopPropagation(); toggleCheck(i); }}
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

        {selectedExercise && (
          <ExerciseDetailPopout
            exercise={selectedExercise.exercise}
            planData={selectedExercise.planData}
            isDone={checked.includes(selectedExercise.index)}
            onToggleDone={() => toggleCheck(selectedExercise.index)}
            onClose={() => setSelectedExercise(null)}
          />
        )}
      </div>
    );
  }

  return null;
}
