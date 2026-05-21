import { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { useAppStore } from '../store';
import { exercises as exerciseBank } from '../data/exercises';
import {
  decideTodayWorkout,
  analyzeWorkoutHistory,
  filterWithProgressiveRelaxation,
  selectVariantForEquipment,
  buildUserProfileBlock,
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
import { stretchToTargetDuration } from '../utils/yogaPostProcess';
import { finishWorkoutSession, groupLoggedSetsByExercise, type ExerciseLogItem } from '../utils/workoutLogger';
import { callAI } from '../utils/aiProxy';
import type {
  Exercise,
  Equipment,
  Goal,
  MuscleGroup,
  Modality,
  UserProfile,
  WorkoutDayDecision,
  YogaPlan,
} from '../types';
import { RefreshCw, Clock, Zap, ChevronRight, Lock, Bot, Dumbbell, Flower2, Activity, type LucideIcon } from 'lucide-react';
import { getExerciseIcon } from '../utils/muscleGroupIcon';
import ExerciseDetailPopout from './ExerciseDetailPopout';
import PlayerLoadingFallback from './PlayerLoadingFallback';
import './daily-trainer-v2.css';

// Lazy: los Players (WorkoutPlayer 23kB + YogaFlowPlayer 18.7kB) salen del
// bundle inicial de DashboardScreen — solo se cargan al abrir un player.
const YogaFlowPlayer = lazy(() => import('./YogaFlowPlayer'));
const WorkoutPlayer = lazy(() => import('./WorkoutPlayer'));

const DAY_NAMES = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

const MODALITY_OPTIONS: Array<{
  value: Modality;
  icon: LucideIcon;
  label: string;
  sub: string;
  minExercises: number;
}> = [
  { value: 'auto', icon: Bot, label: 'Lo que mi coach decida', sub: '', minExercises: 0 },
  { value: 'fuerza', icon: Dumbbell, label: 'Fuerza', sub: 'Push, Pull, Legs, Full body', minExercises: 5 },
  { value: 'yoga', icon: Flower2, label: 'Yoga / recovery', sub: 'Recovery activo + movilidad', minExercises: 5 },
  { value: 'cardio', icon: Activity, label: 'Cardio', sub: 'HIIT, intervalos, walking', minExercises: 5 },
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
  equipment: Equipment[];
  targetCount: number;
  goal: Goal;
  intensity: 'baja' | 'media' | 'alta';
  userName: string;
  dayLabel: string;
  context: string;
  userProfile?: UserProfile;
}): Promise<CachedWorkout & { razon?: string }> {
  const { candidates, equipment, targetCount, goal, intensity, userName, dayLabel, context, userProfile } = params;
  const profileBlock = buildUserProfileBlock(userProfile);

  // Para cada candidato, seleccionar la variante específica que aplica al equipo
  // del usuario. Si tiene overrides (sets/reps/rest), usar esos en vez de los del patrón.
  const candidatesCompact = candidates.map(c => {
    const variant = selectVariantForEquipment(c, equipment);
    const effectiveName = variant ? `${c.name} — ${variant.name}` : c.name;
    const effectiveSets = variant?.defaultSets ?? c.defaultSets;
    const effectiveReps = variant?.defaultReps ?? c.defaultReps;
    const effectiveRest = variant?.defaultRest ?? c.defaultRest;
    return `${c.id} | ${effectiveName} | ${c.muscleGroup} | ${c.type} | sets:${effectiveSets} reps:${effectiveReps} rest:${effectiveRest}s`;
  }).join('\n');

  const intensityInstruction = intensity === 'baja'
    ? 'Intensidad BAJA: reduce sets 30%, reps más bajas, descansos más largos'
    : intensity === 'alta'
    ? 'Intensidad ALTA: sets altos, peso/reps desafiantes, descansos ajustados al goal'
    : 'Intensidad MEDIA: sets y reps estándar según defaults de cada ejercicio';

  const prompt = `Orquesta una sesión de ${dayLabel} para ${userName || 'el usuario'}.
${profileBlock}
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  try {
    const data = await callAI(
      { max_tokens: 1200, messages: [{ role: 'user', content: prompt }] },
      controller.signal,
    );
    const raw = data.content?.[0]?.text ?? '{}';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error('La generación tardó demasiado. Intenta de nuevo.');
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
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
  userProfile?: UserProfile;
}): Promise<YogaPlan> {
  const profileBlock = buildUserProfileBlock(params.userProfile);

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
${profileBlock}
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  let yogaPlan: YogaPlan;
  try {
    const data = await callAI(
      { max_tokens: 3000, messages: [{ role: 'user', content: prompt }] },
      controller.signal,
    );
    const raw = data.content?.[0]?.text ?? '{}';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    yogaPlan = JSON.parse(cleaned) as YogaPlan;
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error('La generación tardó demasiado. Intenta de nuevo.');
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

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
  const completedSessions = useAppStore(s => s.completedSessions);
  const addCompletedSession = useAppStore(s => s.addCompletedSession);

  // Tracking de cuándo se abrió el player — para calcular duración real al onComplete
  const playerStartedAtRef = useRef<number>(0);

  const today = new Date().toISOString().split('T')[0];
  const firstName = userName?.split(' ')[0] || '';
  const todayDayName = DAY_NAMES[new Date().getDay()];
  const todayDateShort = `${new Date().getDate()} ${new Date().toLocaleDateString('es-ES', { month: 'short' })}`;

  // Admin bypass
  const ADMIN_USERS = ['David', 'Magaly']; // TODO: replace with isAdmin flag when auth exists
  const isAdmin = ADMIN_USERS.some(a => firstName.toLowerCase().startsWith(a.toLowerCase()));

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
    completedSessions,
  }), [workoutLog, dailyCheckin, streakCount, completedSessions]);

  // Auto decision
  const todayDecision: WorkoutDayDecision = useMemo(() => decideTodayWorkout({
    userObjective: String(obData?.goal || ''),
    workoutLog: workoutLog || [],
    exercises: exerciseBank,
    dailyEnergy: dailyCheckIn?.date === today ? dailyCheckIn.feeling as any : undefined,
    dailySleep: dailyCheckIn?.date === today ? dailyCheckIn.sleep as any : undefined,
    completedSessions,
  }), [obData, workoutLog, dailyCheckIn, today, completedSessions]);

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

  // Per-modality regen count
  const regenCounts = regenCount?.date === today ? (regenCount.countByModality || {}) : {};
  const regensForModality = regenCounts[selectedModality] || 0;
  const regenBlocked = !isAdmin && regensForModality >= 3;
  const regensLeft = Math.max(0, 3 - regensForModality);

  // Loading context bullets
  const [contextBullets, setContextBullets] = useState<string[]>([]);

  // Popout
  const [playerOpen, setPlayerOpen] = useState(false);
  const [workoutPlayerOpen, setWorkoutPlayerOpen] = useState(false);

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
    const history = analyzeWorkoutHistory(workoutLog || [], exerciseBank, completedSessions);
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

    // Construir UserProfile del onboarding con casting seguro.
    // Empty string o NaN → undefined (no llega como "0" o "NaN" al prompt).
    const toNum = (v: string | number | undefined): number | undefined => {
      if (v === undefined || v === null || v === '') return undefined;
      const n = Number(v);
      return isNaN(n) ? undefined : n;
    };
    const toStr = (v: string | number | undefined): string | undefined => {
      if (v === undefined || v === null || v === '') return undefined;
      return String(v);
    };
    const userProfile: UserProfile = {
      sex: toStr(obData?.sex),
      edad: toNum(obData?.edad),
      peso: toNum(obData?.peso),
      estatura: toNum(obData?.estatura),
      activity: toStr(obData?.activity),
    };

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

      // Hash con TODAS las variables del contexto
      const dayTypeKey = selectedModality === 'auto' ? todayDecision.type : selectedModality;
      const schemaType = selectedModality === 'yoga' ? 'yoga' : 'workout' as const;
      const configHash = buildConfigHash({
        duration: selectedTime,
        equipment: selectedEquipment,
        goal,
        dayType: dayTypeKey,
        schemaVersion: SCHEMA_VERSIONS[schemaType],
        modality: selectedModality,
        energy: dailyCheckin || undefined,
        objective: String(obData?.goal || ''),
        priorExercise,
        discomfort,
        painArea: discomfort === 'pain' ? painArea : undefined,
        restDays: history.restDays,
        yesterdayMuscles: history.yesterday.sort().join(',') || undefined,
      });

      // Intentar cache (para TODAS las modalidades)
      const validIds = new Set(exerciseBank.map(e => e.id));
      const cached = await getCachedWorkout(configHash, schemaType);

      // Yoga: NO usar cache — siempre generar fresh (stretch needs fresh plan)
      if (selectedModality === 'yoga') {
        // Skip cache for yoga — fall through to generation
      } else if (cached && validateWorkout(cached, validIds)) {
        // Fuerza/cardio/auto: cache válido
        setPlan(cached);
        saveDailyWorkout(cached as any);
        setPhase('plan');
        return;
      }

      // ── Rama YOGA: generar Power Vinyasa fresh
      if (selectedModality === 'yoga') {
        const yogaCandidates = filterByModality(exerciseBank, 'yoga');

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
          userProfile,
        };

        let yogaPlan = await orchestratePowerVinyasa(orchParams);

        const yogaIds = new Set(exerciseBank.filter(e => e.isYoga).map(e => e.id));
        let validation = validatePowerVinyasaPlan(yogaPlan, targetDurationSeconds, yogaIds);

        if (!validation.valid) {
          console.warn('[yoga] validación fallida, reintentando:', validation.errors);
          yogaPlan = await orchestratePowerVinyasa(orchParams);
          validation = validatePowerVinyasaPlan(yogaPlan, targetDurationSeconds, yogaIds);
          if (!validation.valid) {
            console.error('[yoga] segundo intento falló:', validation.errors);
            // NO incrementar contador — generación falló
            throw new Error('No pudimos generar una nueva rutina. Intenta en un momento.');
          }
        }

        // Stretch duration to match target
        const adjustedPlan = stretchToTargetDuration(yogaPlan, targetDurationSeconds);

        // Save to cache
        saveWorkoutToCache({
          configHash,
          duration: selectedTime,
          equipment: selectedEquipment,
          goal,
          dayType: dayTypeKey,
          workout: adjustedPlan as any,
          schemaType: 'yoga',
        }).catch(() => {});

        // Save plan FIRST, then increment counter
        setPlan(adjustedPlan as any);
        saveDailyWorkout(adjustedPlan as any);
        setPhase('plan');

        // Increment ONLY after successful save
        incrementRegen(selectedModality);
        console.info(`[regen] ${selectedModality}: ${(regenCounts[selectedModality] || 0) + 1}/3 today | admin: ${isAdmin}`);
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
        const filterResult = filterWithProgressiveRelaxation({
          exercises: modalityFiltered.length > 0 ? modalityFiltered : exerciseBank,
          equipment: equipmentList,
          muscleGroups,
          goal,
          excludeMuscles: selectedModality === 'auto' ? [...history.yesterday] : [],
          minCandidates: 3,
        });
        candidates = filterResult.exercises;

        // Si el coach relajó constraints, informarle a la IA en el contexto
        // para que pueda explicar al usuario por qué la rutina no es "perfecta".
        if (filterResult.relaxationLevel > 0) {
          bullets.push(
            `Coach relajó constraints (nivel ${filterResult.relaxationLevel}): ${filterResult.relaxedConstraints.join(', ')}`
          );
        }
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

      // Guardia defensiva: filterWithProgressiveRelaxation nivel 3 SIEMPRE devuelve
      // candidatos si el equipo coincide con algún ejercicio. Si llegamos a 0 acá,
      // es caso extremo (equipo inexistente, banco vacío, o painArea filter recortó todo).
      if (candidates.length === 0) {
        const msg = selectedModality === 'auto'
          ? 'Tu coach no encontró ejercicios para esta combinación. Verifica el equipo seleccionado.'
          : `No hay ejercicios de ${modalityLabel.toLowerCase()} para tu equipo. Cambia la modalidad o el equipo.`;
        throw new Error(msg);
      }

      const targetCount = Math.min(exerciseCountForDuration(selectedTime), candidates.length);

      const contextStr = bullets.join('\n- ');
      const workout = await orchestrateWorkout({
        candidates: candidates.slice(0, 15),
        equipment: equipmentList,
        targetCount,
        goal,
        intensity,
        userName,
        dayLabel,
        context: `- ${contextStr}`,
        userProfile,
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

      // Increment regen AFTER successful generation
      incrementRegen(selectedModality);
      console.info(`[regen] ${selectedModality}: ${(regenCounts[selectedModality] || 0) + 1}/3 today | admin: ${isAdmin}`);

      setPlan(workout);
      saveDailyWorkout(workout as any);
      setPhase('plan');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al generar la rutina';
      setError(msg);
      // If we had a previous plan, go back to it instead of modality
      if (plan) {
        setPhase('plan');
        // Show error briefly as alert since we're going back to plan
        alert(msg);
      } else {
        setPhase('error');
      }
    }
  }

  function handleRegenerate() {
    if (regenBlocked) return;
    // Don't increment here — increment AFTER successful generation
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
      <div className="wz-root">
        <div className="wz-generating">
          <div className="wz-spinner" />
          <h3 className="wz-generating-title">Armando <em>tu rutina</em>...</h3>
          <p className="wz-generating-sub">Tu coach está considerando:</p>
          <div className="wz-generating-bullets">
            {contextBullets.map((b, i) => (
              <div key={i} className="wz-generating-bullet">· {b}</div>
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
      <div className="wz-root">
        <div className="wz-error">
          <p className="wz-error-text">⚠️ {error}</p>
          <button className="wz-error-btn" onClick={() => setPhase('modality')}>Volver</button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER: STEP 1 — MODALITY
  // ══════════════════════════════════════════════════════════════

  if (phase === 'modality') {
    return (
      <div className="wz-root">
        <div className="wz-hero">
          <div className="wz-stepper">
            <div className="wz-stepper-bar active" />
            <div className="wz-stepper-bar" />
            {!skipPhysical && <div className="wz-stepper-bar" />}
          </div>
          <p className="wz-eyebrow">paso 1 · {todayDayName} {todayDateShort}</p>
          <h1 className="wz-title">
            {firstName ? `${firstName}, ` : ''}<em>¿qué quieres hacer hoy?</em>
          </h1>
        </div>

        <div className="wz-options">
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
                className={`wz-option${isSelected ? ' selected' : ''}${locked ? ' locked' : ''}`}
                onClick={() => !locked && setSelectedModality(opt.value)}
                disabled={locked}
              >
                <div className="wz-option-thumb">
                  {locked
                    ? <Lock size={22} strokeWidth={1.5} />
                    : <opt.icon size={22} strokeWidth={1.5} />}
                </div>
                <div className="wz-option-body">
                  <div className="wz-option-label">
                    {opt.label}
                    {isSuggested && !locked && <span className="wz-option-badge">sugerido</span>}
                  </div>
                  <div className="wz-option-sub">{locked ? 'Próximamente' : subLabel}</div>
                </div>
                {isSelected && !locked && <div className="wz-option-check">✓</div>}
              </button>
            );
          })}
        </div>

        <button className="wz-cta" onClick={handleModalityNext}>
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
      <div className="wz-root">
        <div className="wz-hero">
          <div className="wz-stepper">
            <div className="wz-stepper-bar done" />
            <div className="wz-stepper-bar active" />
            <div className="wz-stepper-bar" />
          </div>
          <p className="wz-eyebrow">paso 2 · contexto físico</p>
          <h1 className="wz-title">
            <em>¿Cómo vienes hoy?</em>
          </h1>
        </div>

        <div className="wz-q">
          <p className="wz-q-label">¿Ya hiciste ejercicio hoy?</p>
          <div className="wz-chips wz-chips-col">
            {PRIOR_EXERCISE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`wz-chip wz-chip-block${priorExercise === opt.value ? ' on' : ''}`}
                onClick={() => setPriorExercise(opt.value)}
              >
                <span className="wz-chip-icon">{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="wz-q">
          <p className="wz-q-label">¿Alguna molestia hoy?</p>
          <div className="wz-chips wz-chips-col">
            {DISCOMFORT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`wz-chip wz-chip-block${discomfort === opt.value ? ' on' : ''}`}
                onClick={() => setDiscomfort(opt.value)}
              >
                <span className="wz-chip-icon">{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {discomfort === 'pain' && (
          <div className="wz-q">
            <p className="wz-q-label">¿Dónde?</p>
            <div className="wz-chips">
              {PAIN_AREAS.map(area => (
                <button
                  key={area}
                  className={`wz-chip${painArea === area ? ' on' : ''}`}
                  onClick={() => setPainArea(area)}
                >
                  {area}
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="wz-cta" onClick={handlePhysicalNext}>
          Siguiente →
        </button>

        <div className="wz-back">
          <button className="wz-back-link" onClick={() => setPhase('modality')}>← Anterior</button>
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
      <div className="wz-root">
        <div className="wz-hero">
          <div className="wz-stepper">
            <div className="wz-stepper-bar done" />
            {!skipPhysical && <div className="wz-stepper-bar done" />}
            <div className="wz-stepper-bar active" />
          </div>
          <p className="wz-eyebrow">paso {stepNum} · logística</p>
          <h1 className="wz-title">
            <em>Últimos detalles</em>
          </h1>
        </div>

        <div className="wz-q">
          <p className="wz-q-label">¿Cuánto tiempo tienes?</p>
          <div className="wz-chips wz-chips-3">
            {TIME_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`wz-chip${selectedTime === opt.value ? ' on' : ''}`}
                onClick={() => setSelectedTime(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {selectedModality !== 'yoga' && (
          <div className="wz-q">
            <p className="wz-q-label">¿Dónde estás hoy?</p>
            <div className="wz-chips wz-chips-col">
              {EQUIPMENT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`wz-chip wz-chip-block${selectedEquipment === opt.value ? ' on' : ''}`}
                  onClick={() => setSelectedEquipment(opt.value)}
                >
                  <span className="wz-chip-icon">{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="wz-cta" onClick={handleGenerate}>
          Arma mi <em>rutina</em> →
        </button>

        <div className="wz-back">
          <button className="wz-back-link" onClick={() => setPhase(skipPhysical ? 'modality' : 'physical')}>← Anterior</button>
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
        <div className="wz-root">
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
              aria-label="Regenerar rutina"
              title="Regenerar rutina"
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
            ▶ comenzar flow
          </button>

          {yogaPlan.razon && (
            <div className="dt2-card-why">
              <div className="dt2-card-why-label">Por qué hoy</div>
              <p className="dt2-card-why-text">{yogaPlan.razon}</p>
            </div>
          )}

          {yogaPlan.opening && (
            <div className="dt2-section">
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
            <div className="dt2-section">
              <div className="dt2-section-label">Closing</div>
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
                }, addCompletedSession).catch(() => {});

                setPlayerOpen(false);
              }}
            />
            </Suspense>
          )}
        </div>
      );
    }
    const checked = storedChecked || [];

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
            ▶ comenzar entrenamiento
          </button>
        )}

        {/* Razón del coach */}
        {(plan as any).razon && (
          <div className="dt2-card-why">
            <div className="dt2-card-why-label">Por qué hoy</div>
            <p className="dt2-card-why-text">{(plan as any).razon}</p>
          </div>
        )}

        {plan.warmup && (
          <div className="dt2-section">
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
          <div className="dt2-section">
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
            userEquipment={[selectedEquipment]}
            isDone={checked.includes(selectedExercise.index)}
            onToggleDone={() => toggleCheck(selectedExercise.index)}
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

              const exercisesLog: ExerciseLogItem[] = plan.exercises.map((ex, i) => {
                const setsForExercise = performedByExercise[i] || [];
                const hasAnyData = setsForExercise.length > 0;
                const allSkipped = hasAnyData && setsForExercise.every(s => s === null);
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
                coachReason: (plan as any).razon,
                generationMethod: 'ai_generated',
                loggedSets: data.loggedSets,
              }, addCompletedSession).catch(() => {});

              setWorkoutPlayerOpen(false);
            }}
          />
          </Suspense>
        )}
      </div>
    );
  }

  return null;
}
