import type {
  Exercise,
  MuscleGroup,
  Equipment,
  Goal,
  WorkoutDayType,
  WorkoutDayDecision
} from '../types';
import type { WorkoutEntry } from '../types';

// ══════════════════════════════════════════════════════════════
// CICLADO BASE POR OBJETIVO
// ══════════════════════════════════════════════════════════════

const CYCLES: Record<string, WorkoutDayType[]> = {
  'ganar-musculo': ['upper', 'lower', 'upper', 'lower', 'full-body', 'movilidad', 'descanso'],
  'perder-grasa': ['full-body', 'lower', 'upper', 'cardio', 'full-body', 'movilidad', 'descanso'],
  'recomposicion': ['upper', 'lower', 'full-body', 'upper', 'lower', 'movilidad', 'descanso'],
  'mantener': ['full-body', 'movilidad', 'upper', 'lower', 'cardio', 'movilidad', 'descanso'],
  'bienestar': ['full-body', 'movilidad', 'cardio', 'full-body', 'movilidad', 'descanso', 'descanso'],
};

const DAY_TYPE_CONFIG: Record<WorkoutDayType, {
  label: string;
  focus: string;
  muscleGroups: MuscleGroup[];
  defaultGoal: Goal;
}> = {
  'upper': {
    label: 'Upper body',
    focus: 'pecho, espalda, hombros y brazos',
    muscleGroups: ['pecho', 'espalda', 'hombros', 'biceps', 'triceps'],
    defaultGoal: 'hipertrofia',
  },
  'lower': {
    label: 'Lower body',
    focus: 'piernas y glúteo',
    muscleGroups: ['cuadriceps', 'isquios', 'gluteo', 'pantorrillas'],
    defaultGoal: 'hipertrofia',
  },
  'full-body': {
    label: 'Full body',
    focus: 'cuerpo completo',
    muscleGroups: ['pecho', 'espalda', 'cuadriceps', 'gluteo', 'core'],
    defaultGoal: 'hipertrofia',
  },
  'push': {
    label: 'Empuje (push)',
    focus: 'pecho, hombros y tríceps',
    muscleGroups: ['pecho', 'hombros', 'triceps'],
    defaultGoal: 'hipertrofia',
  },
  'pull': {
    label: 'Tracción (pull)',
    focus: 'espalda y bíceps',
    muscleGroups: ['espalda', 'biceps'],
    defaultGoal: 'hipertrofia',
  },
  'legs': {
    label: 'Piernas',
    focus: 'cuádriceps, isquios y glúteo',
    muscleGroups: ['cuadriceps', 'isquios', 'gluteo'],
    defaultGoal: 'hipertrofia',
  },
  'cardio': {
    label: 'Cardio',
    focus: 'resistencia y quema calórica',
    muscleGroups: ['cardio', 'cuerpo-completo'],
    defaultGoal: 'condicion',
  },
  'movilidad': {
    label: 'Movilidad',
    focus: 'movilidad y recuperación activa',
    muscleGroups: ['cuerpo-completo'],
    defaultGoal: 'movilidad',
  },
  'descanso': {
    label: 'Descanso',
    focus: 'recuperación total',
    muscleGroups: [],
    defaultGoal: 'movilidad',
  },
};

// ══════════════════════════════════════════════════════════════
// ANÁLISIS DE HISTORIAL
// ══════════════════════════════════════════════════════════════

interface WorkedMuscles {
  today: MuscleGroup[];
  yesterday: MuscleGroup[];
  twoDaysAgo: MuscleGroup[];
  restDays: number; // consecutive rest days
}

export function analyzeWorkoutHistory(
  workoutLog: WorkoutEntry[],
  exercises: Exercise[]
): WorkedMuscles {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];

  const exerciseMap = new Map(exercises.map(e => [e.id, e]));
  const exerciseByName = new Map(exercises.map(e => [e.name.toLowerCase(), e]));

  function findExercise(nameOrId: string): Exercise | undefined {
    return exerciseMap.get(nameOrId) || exerciseByName.get(nameOrId.toLowerCase());
  }

  function getMusclesFromEntries(entries: WorkoutEntry[]): MuscleGroup[] {
    const muscles = new Set<MuscleGroup>();
    entries.forEach(e => {
      const ex = findExercise(e.exercise);
      if (ex) {
        muscles.add(ex.muscleGroup);
        (ex.secondaryMuscles || []).forEach(m => muscles.add(m));
      }
    });
    return Array.from(muscles);
  }

  // Count consecutive rest days (from today backwards)
  let restDays = 0;
  for (let i = 0; i < 7; i++) {
    const date = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
    const hasWorkout = workoutLog.some(e => e.date === date);
    if (!hasWorkout) restDays++;
    else break;
  }

  return {
    today: getMusclesFromEntries(workoutLog.filter(e => e.date === today)),
    yesterday: getMusclesFromEntries(workoutLog.filter(e => e.date === yesterday)),
    twoDaysAgo: getMusclesFromEntries(workoutLog.filter(e => e.date === twoDaysAgo)),
    restDays,
  };
}

// ══════════════════════════════════════════════════════════════
// DECISIÓN DE QUÉ TOCA HOY
// ══════════════════════════════════════════════════════════════

export function decideTodayWorkout(params: {
  userObjective: string;
  workoutLog: WorkoutEntry[];
  exercises: Exercise[];
  dailyEnergy?: 'bien' | 'regular' | 'cansado';
  dailySleep?: 'muy bien' | 'normal' | 'mal';
}): WorkoutDayDecision {
  const { userObjective, workoutLog, exercises, dailyEnergy, dailySleep } = params;

  // Normalize objective to cycle key
  const objectiveKey = normalizeObjective(userObjective);
  const cycle = CYCLES[objectiveKey] || CYCLES['recomposicion'];

  // Analyze history
  const history = analyzeWorkoutHistory(workoutLog, exercises);

  // If user already trained today, rest
  if (history.today.length > 0) {
    return buildDecision('descanso', 'Ya entrenaste hoy — tu cuerpo necesita recuperarse.', 'baja');
  }

  // Pick next in cycle, avoiding yesterday's muscles
  const todayType = pickNextInCycle(cycle, history);

  // Determine intensity from check-in
  const intensity = determineIntensity(dailyEnergy, dailySleep, history.restDays);

  // Build reason
  const reason = buildReason(todayType, history, objectiveKey);

  return buildDecision(todayType, reason, intensity);
}

function normalizeObjective(obj: string): string {
  const lower = (obj || '').toLowerCase();
  if (lower.includes('músculo') || lower.includes('musculo') || lower.includes('ganar')) return 'ganar-musculo';
  if (lower.includes('grasa') || lower.includes('bajar') || lower.includes('perder')) return 'perder-grasa';
  if (lower.includes('recomposicion') || lower.includes('recomposición')) return 'recomposicion';
  if (lower.includes('manten') || lower.includes('balance')) return 'mantener';
  if (lower.includes('bienestar') || lower.includes('integral')) return 'bienestar';
  return 'recomposicion';
}

function pickNextInCycle(
  cycle: WorkoutDayType[],
  history: WorkedMuscles
): WorkoutDayType {
  // Get day index in cycle based on current week day
  const dayOfWeek = (new Date().getDay() + 6) % 7; // Mon=0, Sun=6
  let suggested = cycle[dayOfWeek];

  // If suggested conflicts with yesterday's muscles, skip to next available
  const yesterdayMuscles = new Set(history.yesterday);
  const suggestedConfig = DAY_TYPE_CONFIG[suggested];
  const hasConflict = suggestedConfig.muscleGroups.some(m => yesterdayMuscles.has(m));

  if (hasConflict && suggested !== 'movilidad' && suggested !== 'descanso' && suggested !== 'cardio') {
    // Find alternative that doesn't conflict
    const alternatives: WorkoutDayType[] = ['upper', 'lower', 'cardio', 'movilidad', 'full-body'];
    for (const alt of alternatives) {
      const altMuscles = DAY_TYPE_CONFIG[alt].muscleGroups;
      if (!altMuscles.some(m => yesterdayMuscles.has(m))) {
        suggested = alt;
        break;
      }
    }
  }

  // If user has been resting 3+ days, prefer light work
  if (history.restDays >= 4 && suggested !== 'descanso') {
    if (suggested === 'upper' || suggested === 'lower') {
      // Keep the plan but intensity will be lower
    }
  }

  return suggested;
}

function determineIntensity(
  energy?: 'bien' | 'regular' | 'cansado',
  sleep?: 'muy bien' | 'normal' | 'mal',
  restDays: number = 0
): 'baja' | 'media' | 'alta' {
  // Bad sleep or tired = low intensity
  if (energy === 'cansado' || sleep === 'mal') return 'baja';

  // Coming back from rest = medium
  if (restDays >= 3) return 'media';

  // Good state = high
  if (energy === 'bien' && (sleep === 'muy bien' || sleep === 'normal')) return 'alta';

  return 'media';
}

function buildReason(
  todayType: WorkoutDayType,
  history: WorkedMuscles,
  objectiveKey: string
): string {
  const parts: string[] = [];

  // What did yesterday
  if (history.yesterday.length > 0) {
    const yesterdayLabel = summarizeMuscles(history.yesterday);
    parts.push(`Ayer trabajaste ${yesterdayLabel}`);
  }

  // Rest days
  if (history.restDays >= 3) {
    parts.push(`llevas ${history.restDays} días sin entrenar`);
  }

  // Objective context
  const objectiveLabel: Record<string, string> = {
    'ganar-musculo': 'ganar músculo',
    'perder-grasa': 'perder grasa',
    'recomposicion': 'recomposición',
    'mantener': 'mantener tu forma',
    'bienestar': 'bienestar integral',
  };
  parts.push(`tu objetivo es ${objectiveLabel[objectiveKey] || 'progreso'}`);

  // Today's recommendation
  const typeConfig = DAY_TYPE_CONFIG[todayType];
  let closing = '';
  if (todayType === 'descanso') {
    closing = 'hoy toca descansar para recuperar.';
  } else if (todayType === 'movilidad') {
    closing = 'hoy toca movilidad para recuperar activo.';
  } else {
    closing = `es el momento de enfocarnos en ${typeConfig.focus}.`;
  }

  return parts.join(', ') + '. ' + closing.charAt(0).toUpperCase() + closing.slice(1);
}

function summarizeMuscles(muscles: MuscleGroup[]): string {
  const upperMuscles = ['pecho', 'espalda', 'hombros', 'biceps', 'triceps'];
  const lowerMuscles = ['cuadriceps', 'isquios', 'gluteo', 'pantorrillas'];

  const hasUpper = muscles.some(m => upperMuscles.includes(m));
  const hasLower = muscles.some(m => lowerMuscles.includes(m));

  if (hasUpper && hasLower) return 'cuerpo completo';
  if (hasUpper) return 'Upper (tren superior)';
  if (hasLower) return 'Lower (tren inferior)';
  if (muscles.includes('core')) return 'core';
  if (muscles.includes('cardio')) return 'cardio';
  if (muscles.includes('cuerpo-completo')) return 'movilidad';
  return 'otros grupos';
}

function buildDecision(
  type: WorkoutDayType,
  reason: string,
  intensity: 'baja' | 'media' | 'alta'
): WorkoutDayDecision {
  const config = DAY_TYPE_CONFIG[type];
  return {
    type,
    label: config.label,
    focus: config.focus,
    muscleGroups: config.muscleGroups,
    intensity,
    reason,
  };
}

// ══════════════════════════════════════════════════════════════
// FILTRADO DE EJERCICIOS (pre-IA)
// ══════════════════════════════════════════════════════════════

export function filterExercisesForWorkout(params: {
  exercises: Exercise[];
  equipment: Equipment[];
  muscleGroups: MuscleGroup[];
  goal: Goal;
  excludeMuscles?: MuscleGroup[]; // muscles to avoid (yesterday's work)
  difficulty?: 'principiante' | 'intermedio' | 'avanzado';
}): Exercise[] {
  const { exercises, equipment, muscleGroups, goal, excludeMuscles = [] } = params;

  return exercises.filter(ex => {
    // Filter 1: equipment
    const hasEquipment = ex.equipment.some(e => equipment.includes(e));
    if (!hasEquipment) return false;

    // Filter 2: muscle group match (primary or secondary)
    const primaryMatch = muscleGroups.includes(ex.muscleGroup);
    const secondaryMatch = (ex.secondaryMuscles || []).some(m => muscleGroups.includes(m));
    if (!primaryMatch && !secondaryMatch) return false;

    // Filter 3: goal
    if (!ex.goals.includes(goal)) return false;

    // Filter 4: exclude overworked muscles (primary only)
    if (excludeMuscles.includes(ex.muscleGroup)) return false;

    return true;
  });
}

// ══════════════════════════════════════════════════════════════
// CONFIG HASH (para cache)
// ══════════════════════════════════════════════════════════════

export function buildConfigHash(params: {
  duration: number;
  equipment: string;
  goal: string;
  dayType: string;
}): string {
  const str = `${params.duration}-${params.equipment}-${params.goal}-${params.dayType}`;
  // Simple hash function (djb2)
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return Math.abs(hash).toString(36);
}

// ══════════════════════════════════════════════════════════════
// CANTIDAD DE EJERCICIOS POR DURACIÓN
// ══════════════════════════════════════════════════════════════

export function exerciseCountForDuration(minutes: number): number {
  if (minutes <= 25) return 5;
  if (minutes <= 45) return 7;
  return 9;
}
