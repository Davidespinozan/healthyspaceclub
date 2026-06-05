import type {
  Exercise,
  ExerciseVariant,
  MuscleGroup,
  Equipment,
  Goal,
  Modality,
  WorkoutDayType,
  WorkoutDayDecision
} from '../types';
import type { WorkoutEntry, CompletedSession } from '../types';
import type { TranslationKey } from '../i18n/es';

// ══════════════════════════════════════════════════════════════
// CICLADO BASE POR OBJETIVO
// ══════════════════════════════════════════════════════════════

// Ciclos semanales por objetivo. El 7mo día (y 6to en bienestar) era 'descanso'
// rígido — reemplazado por 'movilidad' en Lote Descanso→Movilidad. Filosofía
// HSC "adaptive not strict": siempre hay algo suave que mover, descanso forzado
// no es la única opción de recuperación.
const CYCLES: Record<string, WorkoutDayType[]> = {
  'ganar-musculo': ['upper', 'lower', 'upper', 'lower', 'full-body', 'movilidad', 'movilidad'],
  'perder-grasa': ['full-body', 'lower', 'upper', 'cardio', 'full-body', 'movilidad', 'movilidad'],
  'recomposicion': ['upper', 'lower', 'full-body', 'upper', 'lower', 'movilidad', 'movilidad'],
  'mantener': ['full-body', 'movilidad', 'upper', 'lower', 'cardio', 'movilidad', 'movilidad'],
  'bienestar': ['full-body', 'movilidad', 'cardio', 'full-body', 'movilidad', 'movilidad', 'movilidad'],
};

export const DAY_TYPE_CONFIG: Record<WorkoutDayType, {
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

// Cuando el sistema NO tiene historial propio (usuario nuevo), restDays se
// calcula falso (=7) porque no hay registros. Esta función traduce la respuesta
// del usuario ("¿cuándo entrenaste por última vez?") a restDays reales, para no
// asumir que lleva una semana sin entrenar.
export function restDaysFromLastTrained(answer: string): number {
  switch (answer) {
    case 'recent': return 1;  // hoy o ayer
    case 'few': return 3;     // hace 2-3 días
    case 'week': return 6;    // hace una semana
    case 'long': return 7;    // hace más de un mes / empezando (retomar suave)
    default: return 2;        // sin respuesta → punto neutral
  }
}

export function analyzeWorkoutHistory(
  workoutLog: WorkoutEntry[],
  exercises: Exercise[],
  completedSessions: CompletedSession[] = []
): WorkedMuscles {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];

  const exerciseMap = new Map(exercises.map(e => [e.id, e]));
  const exerciseByName = new Map(exercises.map(e => [e.name.toLowerCase(), e]));

  function findExercise(nameOrId: string): Exercise | undefined {
    return exerciseMap.get(nameOrId) || exerciseByName.get(nameOrId.toLowerCase());
  }

  /**
   * Computa los músculos trabajados en una fecha leyendo AMBAS fuentes:
   * - workoutLog (granular per-exercise, legacy)
   * - completedSessions (per-session, nuevo)
   *
   * Ambas usan `date` en UTC YYYY-MM-DD para back-compat.
   */
  function getMusclesForDate(date: string): MuscleGroup[] {
    const muscles = new Set<MuscleGroup>();

    // Fuente 1: workoutLog (legacy)
    workoutLog.filter(e => e.date === date).forEach(e => {
      const ex = findExercise(e.exercise);
      if (ex) {
        muscles.add(ex.muscleGroup);
        (ex.secondaryMuscles || []).forEach(m => muscles.add(m));
      }
    });

    // Fuente 2: completedSessions (nuevo)
    completedSessions.filter(s => s.date === date).forEach(s => {
      s.exerciseIds.forEach(id => {
        const ex = findExercise(id);
        if (ex) {
          muscles.add(ex.muscleGroup);
          (ex.secondaryMuscles || []).forEach(m => muscles.add(m));
        }
      });
    });

    return Array.from(muscles);
  }

  // Count consecutive rest days (from today backwards) — chequea AMBAS fuentes
  let restDays = 0;
  for (let i = 0; i < 7; i++) {
    const date = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
    const hasWorkout =
      workoutLog.some(e => e.date === date) ||
      completedSessions.some(s => s.date === date);
    if (!hasWorkout) restDays++;
    else break;
  }

  return {
    today: getMusclesForDate(today),
    yesterday: getMusclesForDate(yesterday),
    twoDaysAgo: getMusclesForDate(twoDaysAgo),
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
  completedSessions?: CompletedSession[];
}): WorkoutDayDecision {
  const { userObjective, workoutLog, exercises, dailyEnergy, dailySleep, completedSessions = [] } = params;

  // Normalize objective to cycle key
  const objectiveKey = normalizeObjective(userObjective);
  const cycle = CYCLES[objectiveKey] || CYCLES['recomposicion'];

  // Analyze history (incluye completedSessions si existen)
  const history = analyzeWorkoutHistory(workoutLog, exercises, completedSessions);

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

  if (hasConflict && suggested !== 'movilidad' && suggested !== 'cardio') {
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
  const closing = todayType === 'movilidad'
    ? 'hoy un flow suave para recuperar activo.'
    : `es el momento de enfocarnos en ${typeConfig.focus}.`;

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
// BLOQUE DE PERFIL PARA PROMPTS DE IA
// ══════════════════════════════════════════════════════════════

// buildUserProfileBlock fue mudado a src/ai/profile.ts en el Lote Coach-A.

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
    // Yoga sigue mirando exercise.equipment plano (no tiene variants).
    // Patrones: mirar si al menos UNA variante aplica al equipo del usuario.
    const hasEquipment = ex.isYoga
      ? ex.equipment.some(e => equipment.includes(e))
      : (ex.variants?.some(v => v.equipment.some(e => equipment.includes(e))) ?? false);
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
// SELECCIÓN DE VARIANTE POR EQUIPO
// ══════════════════════════════════════════════════════════════

/**
 * Selecciona la mejor variante de un ejercicio según el equipo del usuario.
 *
 * Prioridad:
 * 1. Si el ejercicio NO tiene variants (legacy / yoga), devuelve null (usa defaults del patrón)
 * 2. Variante con isDefault: true que aplique al equipo del usuario
 * 3. Primera variante que aplique al equipo del usuario
 * 4. null si ninguna variante aplica (no debería pasar si filterExercisesForWorkout filtró antes)
 */
export function selectVariantForEquipment(
  exercise: Exercise,
  userEquipment: Equipment[]
): ExerciseVariant | null {
  if (!exercise.variants || exercise.variants.length === 0) return null;

  // Variantes que aplican al equipo del usuario
  const applicable = exercise.variants.filter(v =>
    v.equipment.some(e => userEquipment.includes(e))
  );

  if (applicable.length === 0) return null;

  // Preferir la default si está entre las aplicables
  const defaultApplicable = applicable.find(v => v.isDefault === true);
  if (defaultApplicable) return defaultApplicable;

  // Si no hay default aplicable, devolver la primera
  return applicable[0];
}

// ══════════════════════════════════════════════════════════════
// FILTRADO CON RELAJACIÓN PROGRESIVA
// ══════════════════════════════════════════════════════════════

export interface FilterResult {
  exercises: Exercise[];
  relaxationLevel: 0 | 1 | 2 | 3;
  relaxedConstraints: string[]; // ej: ['músculos de ayer', 'goal exacto']
}

/**
 * Filtra ejercicios con relajación progresiva de constraints cuando no hay
 * suficientes candidatos para construir un workout completo.
 *
 * Niveles:
 * - 0: filtro estricto (todo aplica)
 * - 1: drop excludeMuscles (ignora "no repetir músculos de ayer")
 * - 2: drop goal exacto (acepta cualquier goal del ejercicio)
 * - 3: drop muscleGroups (solo equipment) — último recurso
 */
export function filterWithProgressiveRelaxation(params: {
  exercises: Exercise[];
  equipment: Equipment[];
  muscleGroups: MuscleGroup[];
  goal: Goal;
  excludeMuscles: MuscleGroup[];
  minCandidates?: number;
}): FilterResult {
  const minRequired = params.minCandidates ?? 3;

  // NIVEL 0 — filtro estricto
  let candidates = filterExercisesForWorkout({
    exercises: params.exercises,
    equipment: params.equipment,
    muscleGroups: params.muscleGroups,
    goal: params.goal,
    excludeMuscles: params.excludeMuscles,
  });
  if (candidates.length >= minRequired) {
    return { exercises: candidates, relaxationLevel: 0, relaxedConstraints: [] };
  }

  // NIVEL 1 — drop excludeMuscles
  candidates = filterExercisesForWorkout({
    exercises: params.exercises,
    equipment: params.equipment,
    muscleGroups: params.muscleGroups,
    goal: params.goal,
    excludeMuscles: [],
  });
  if (candidates.length >= minRequired) {
    return {
      exercises: candidates,
      relaxationLevel: 1,
      relaxedConstraints: ['músculos de ayer'],
    };
  }

  // NIVEL 2 — drop goal (acepta cualquier goal)
  candidates = params.exercises.filter(ex => {
    const matchesEquipment = ex.isYoga
      ? ex.equipment.some(e => params.equipment.includes(e))
      : (ex.variants?.some(v => v.equipment.some(e => params.equipment.includes(e))) ?? false);
    const matchesMuscle =
      params.muscleGroups.includes(ex.muscleGroup) ||
      (ex.secondaryMuscles?.some(m => params.muscleGroups.includes(m)) ?? false);
    return matchesEquipment && matchesMuscle;
  });
  if (candidates.length >= minRequired) {
    return {
      exercises: candidates,
      relaxationLevel: 2,
      relaxedConstraints: ['músculos de ayer', 'goal exacto'],
    };
  }

  // NIVEL 3 — solo equipment (último recurso)
  candidates = params.exercises.filter(ex =>
    ex.isYoga
      ? ex.equipment.some(e => params.equipment.includes(e))
      : (ex.variants?.some(v => v.equipment.some(e => params.equipment.includes(e))) ?? false)
  );
  return {
    exercises: candidates,
    relaxationLevel: 3,
    relaxedConstraints: ['músculos de ayer', 'goal exacto', 'split exacto'],
  };
}

// ══════════════════════════════════════════════════════════════
// CONFIG HASH (para cache)
// ══════════════════════════════════════════════════════════════

export function buildConfigHash(params: {
  duration: number;
  equipment: string;
  goal: string;
  dayType: string;
  schemaVersion?: number;
  modality?: string;
  energy?: string;
  objective?: string;
  priorExercise?: string;
  discomfort?: string;
  painArea?: string;
  restDays?: number;
  yesterdayMuscles?: string;
}): string {
  const str = [
    `v${params.schemaVersion || 0}`,
    params.duration,
    params.equipment,
    params.goal,
    params.dayType,
    params.modality || 'auto',
    params.energy || 'none',
    params.objective || 'none',
    params.priorExercise || 'none',
    params.discomfort || 'none',
    params.painArea || 'none',
    params.restDays ?? -1,
    params.yesterdayMuscles || 'none',
  ].join('-');
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

// ══════════════════════════════════════════════════════════════
// MODALITY HELPERS
// ══════════════════════════════════════════════════════════════

export function getExerciseModalities(ex: Exercise): string[] {
  const mods = new Set<string>();
  if (ex.goals.includes('fuerza') || ex.goals.includes('hipertrofia')) {
    mods.add('fuerza');
    mods.add('hipertrofia');
  }
  if (ex.goals.includes('condicion') || ex.type === 'cardio' || ex.type === 'funcional') {
    mods.add('cardio');
    mods.add('hiit');
  }
  if (ex.goals.includes('movilidad') || ex.type === 'movilidad' || ex.type === 'activacion') {
    mods.add('yoga');
    mods.add('movilidad');
    mods.add('recovery');
  }
  return Array.from(mods);
}

export function filterByModality(exercises: Exercise[], modality: Modality): Exercise[] {
  if (modality === 'auto') return exercises;

  if (modality === 'yoga') {
    return exercises.filter(ex => ex.isYoga === true);
  }

  const modalityMap: Record<string, string[]> = {
    'fuerza': ['fuerza', 'hipertrofia'],
    'cardio': ['cardio', 'hiit'],
  };
  const tags = modalityMap[modality] || [];
  return exercises.filter(ex => {
    const exMods = getExerciseModalities(ex);
    return tags.some(t => exMods.includes(t));
  });
}

export function countByModality(exercises: Exercise[]): Record<string, number> {
  const counts: Record<string, number> = { fuerza: 0, yoga: 0, cardio: 0 };
  exercises.forEach(ex => {
    const mods = getExerciseModalities(ex);
    if (mods.includes('fuerza')) counts.fuerza++;
    if (mods.includes('yoga')) counts.yoga++;
    if (mods.includes('cardio')) counts.cardio++;
  });
  return counts;
}

export function suggestModality(params: {
  workoutLog: WorkoutEntry[];
  exercises: Exercise[];
  dailyEnergy?: string;
  streakCount?: number;
  completedSessions?: CompletedSession[];
}): { modality: Modality; reasonKey: TranslationKey; reasonParams?: Record<string, string | number> } {
  const { workoutLog, exercises, dailyEnergy, completedSessions = [] } = params;
  const history = analyzeWorkoutHistory(workoutLog, exercises, completedSessions);

  // Tired → suggest yoga
  if (dailyEnergy === 'cansado') {
    return { modality: 'yoga', reasonKey: 'wizard.reasonTired' };
  }

  // 4+ consecutive strength days → suggest yoga
  const last4Dates = Array.from({ length: 4 }, (_, i) =>
    new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
  );
  const consecutiveStrength = last4Dates.every(date =>
    workoutLog.some(e => e.date === date)
  );
  if (consecutiveStrength) {
    return { modality: 'yoga', reasonKey: 'wizard.reasonRecovery' };
  }

  // 3+ rest days → suggest auto (full body)
  if (history.restDays >= 3) {
    return { modality: 'auto', reasonKey: 'wizard.reasonReactivate', reasonParams: { n: history.restDays } };
  }

  // Default
  return { modality: 'auto', reasonKey: 'wizard.reasonAuto' };
}
