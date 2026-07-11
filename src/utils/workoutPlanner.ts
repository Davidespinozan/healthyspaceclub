import { dayKey } from './localDate';
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
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 86400000));
  const twoDaysAgo = dayKey(new Date(Date.now() - 2 * 86400000));

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
    const date = dayKey(new Date(Date.now() - i * 86400000));
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
// VOLUMEN SEMANAL POR MÚSCULO (series/músculo en los últimos 7 días)
// Estándar de hipertrofia: 10-20 series efectivas por músculo por semana.
// ══════════════════════════════════════════════════════════════

export const WEEKLY_SET_TARGET = 14; // meta media (dentro de 10-20) que buscamos alcanzar

/** Series aproximadas por grupo muscular en los últimos `days` días.
 *  Primario = series completas del ejercicio; secundarios = media serie. */
export function computeWeeklyVolume(
  completedSessions: CompletedSession[],
  exercises: Exercise[],
  days = 7,
  workoutLog: WorkoutEntry[] = [],
): Record<string, number> {
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
  const byName = new Map(exercises.filter((e) => e.name).map((e) => [e.name.toLowerCase(), e]));
  const findEx = (nameOrId: string) => exerciseMap.get(nameOrId) || byName.get(nameOrId.toLowerCase());
  const since = dayKey(new Date(Date.now() - (days - 1) * 86400000));
  const vol: Record<string, number> = {};
  const add = (ex: Exercise, sets: number) => {
    vol[ex.muscleGroup] = (vol[ex.muscleGroup] ?? 0) + sets;
    for (const m of ex.secondaryMuscles ?? []) vol[m] = (vol[m] ?? 0) + sets * 0.5;
  };
  const covered = new Set<string>();
  for (const s of completedSessions) {
    if (s.date < since) continue;
    covered.add(s.date);
    for (const id of s.exerciseIds) {
      const ex = exerciseMap.get(id);
      if (!ex || ex.type === 'cardio') continue;
      add(ex, ex.defaultSets && ex.defaultSets > 0 ? ex.defaultSets : 3);
    }
  }
  // workoutLog es legacy: cuéntalo solo en fechas NO cubiertas por completedSessions
  // (evita doble conteo) para que usuarios con historial viejo no queden con volumen ciego.
  for (const e of workoutLog) {
    if (e.date < since || covered.has(e.date)) continue;
    const ex = findEx(e.exercise);
    if (!ex || ex.type === 'cardio') continue;
    add(ex, e.sets && e.sets.length > 0 ? e.sets.length : (ex.defaultSets && ex.defaultSets > 0 ? ex.defaultSets : 3));
  }
  return vol;
}

const STRENGTH_TYPES: WorkoutDayType[] = ['upper', 'lower', 'full-body', 'push', 'pull', 'legs'];

/** IDs de ejercicios usados en las últimas `nSessions` sesiones (para rotación/variedad). */
export function recentExerciseIds(completedSessions: CompletedSession[], nSessions = 2): Set<string> {
  const sorted = [...completedSessions].sort((a, b) =>
    (b.completedAtIso || b.date).localeCompare(a.completedAtIso || a.date));
  const ids = new Set<string>();
  for (const s of sorted.slice(0, nSessions)) for (const id of s.exerciseIds) ids.add(id);
  return ids;
}

/** Rota ACCESORIOS (aislamiento) para variedad: manda al final los de aislamiento ya
 *  usados hace poco. Los COMPUESTOS NO se tocan (deben repetirse para progresar carga). */
export function orderCandidatesForVariety(candidates: Exercise[], recentIds: Set<string>): Exercise[] {
  const stale = (e: Exercise) => (e.type === 'aislamiento' && recentIds.has(e.id) ? 1 : 0);
  return [...candidates].sort((a, b) => stale(a) - stale(b)); // sort estable (V8): resto preserva orden
}

/** Frecuencia real de entreno (días/semana) de las últimas 2 semanas. Sin historial
 *  suficiente → 3 (default seguro: full-body). */
export function trainingFrequency(
  completedSessions: CompletedSession[],
  workoutLog: WorkoutEntry[] = [],
  windowDays = 14,
): number {
  const since = dayKey(new Date(Date.now() - (windowDays - 1) * 86400000));
  const days = new Set<string>();
  for (const s of completedSessions) if (s.date >= since) days.add(s.date);
  for (const e of workoutLog) if (e.date >= since) days.add(e.date);
  if (days.size < 3) return 3; // cold start / muy poco historial → full-body
  return Math.max(2, Math.min(6, Math.round((days.size * 7) / windowDays)));
}

/** Estructura de split según la frecuencia (regla estándar de programación):
 *  ≤3 días → full-body; 4 → upper/lower; ≥5 → push/pull/legs (+ upper/lower). */
export function splitTypesForFrequency(freq: number): WorkoutDayType[] {
  if (freq <= 3) return ['full-body'];
  if (freq === 4) return ['upper', 'lower'];
  return ['push', 'pull', 'legs', 'upper', 'lower'];
}

/** ¿Toca semana de descarga (deload)? Detecta 4+ semanas COMPLETAS seguidas de entreno
 *  duro (≥3 sesiones/sem) sin una semana ligera de por medio → fatiga acumulada. */
export function deloadCheck(
  completedSessions: CompletedSession[],
  workoutLog: WorkoutEntry[] = [],
): { deload: boolean; weeksAccumulated: number } {
  const weekSessions = (w: number): number => {
    const newer = dayKey(new Date(Date.now() - (w * 7 - 6) * 86400000)); // límite reciente
    const older = dayKey(new Date(Date.now() - w * 7 * 86400000));       // límite viejo
    const set = new Set<string>();
    const inRange = (d: string) => d >= older && d <= newer;
    for (const x of completedSessions) if (inRange(x.date)) set.add(x.date);
    for (const x of workoutLog) if (inRange(x.date)) set.add(x.date);
    return set.size;
  };
  let weeks = 0;
  for (let w = 1; w <= 8; w++) { // semanas completas hacia atrás (excluye la en curso)
    if (weekSessions(w) >= 3) weeks++; else break;
  }
  return { deload: weeks >= 4, weeksAccumulated: weeks };
}

/** Entre varios tipos de día, elige el que más DÉFICIT de volumen tiene esta semana
 *  (músculos que van cortos vs la meta), evitando repetir los de ayer. */
export function pickByVolumeDeficit(
  types: WorkoutDayType[],
  vol: Record<string, number>,
  yesterdayMuscles: MuscleGroup[],
): WorkoutDayType {
  const yesterday = new Set(yesterdayMuscles);
  const scored = types.map((t) => {
    const mgs = DAY_TYPE_CONFIG[t].muscleGroups;
    const deficit = mgs.reduce((a, m) => a + Math.max(0, WEEKLY_SET_TARGET - (vol[m] ?? 0)), 0);
    const overlap = mgs.some((m) => yesterday.has(m));
    return { t, deficit, overlap };
  });
  scored.sort((a, b) => (Number(a.overlap) - Number(b.overlap)) || (b.deficit - a.deficit));
  return scored[0].t;
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
  let todayType = pickNextInCycle(cycle, history);

  // Fases 2+4 — en días de FUERZA: la FRECUENCIA define la estructura del split
  // (pocos días → full-body; muchos → push/pull/legs), y dentro de esa estructura se
  // prioriza el split cuyos músculos van más CORTOS esta semana (self-balancing),
  // evitando repetir los de ayer. Cardio/movilidad se respetan (recuperación).
  if (STRENGTH_TYPES.includes(todayType)) {
    const freq = trainingFrequency(completedSessions, workoutLog);
    const preferred = splitTypesForFrequency(freq);
    const vol = computeWeeklyVolume(completedSessions, exercises, 7, workoutLog);
    todayType = pickByVolumeDeficit(preferred, vol, history.yesterday);
  }

  // Fase 5 — deload: si llevas 4+ semanas duras seguidas, toca descarga.
  const { deload } = deloadCheck(completedSessions, workoutLog);

  // Determine intensity from check-in (deload fuerza intensidad baja).
  let intensity = determineIntensity(dailyEnergy, dailySleep, history.restDays);
  if (deload) intensity = 'baja';

  // Build reason
  let reason = buildReason(todayType, history, objectiveKey);
  if (deload) reason = `Semana de descarga: llevas varias semanas entrenando fuerte, así que bajamos el volumen y la intensidad para que recuperes y sigas progresando. ${reason}`;

  return buildDecision(todayType, reason, intensity, deload);
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
  intensity: 'baja' | 'media' | 'alta',
  deload = false,
): WorkoutDayDecision {
  const config = DAY_TYPE_CONFIG[type];
  return {
    type,
    label: config.label,
    focus: config.focus,
    muscleGroups: config.muscleGroups,
    intensity,
    reason,
    deload,
  };
}

// ══════════════════════════════════════════════════════════════
// BLOQUE DE PERFIL PARA PROMPTS DE IA
// ══════════════════════════════════════════════════════════════

// buildUserProfileBlock fue mudado a src/ai/profile.ts en el Lote Coach-A.

// ══════════════════════════════════════════════════════════════
// FILTRADO DE EJERCICIOS (pre-IA)
// ══════════════════════════════════════════════════════════════

export type TrainingLevel = 'principiante' | 'intermedio' | 'avanzado';

/** Nivel de entrenamiento derivado del factor de actividad del onboarding. */
export function levelFromActivity(activity?: string): TrainingLevel {
  const a = (activity ?? '').toLowerCase();
  if (a.includes('sedentar') || a.includes('liger')) return 'principiante';
  if (a.includes('atleta') || a.includes('alta')) return 'avanzado';
  return 'intermedio';
}

/** Nivel del usuario: explícito (obData.nivel) si existe, si no derivado de actividad. */
export function levelFromObData(ob?: Record<string, string | number>): TrainingLevel {
  const explicit = String(ob?.nivel ?? '').toLowerCase();
  if (explicit === 'principiante' || explicit === 'intermedio' || explicit === 'avanzado') return explicit;
  return levelFromActivity(String(ob?.activity ?? ''));
}

export function filterExercisesForWorkout(params: {
  exercises: Exercise[];
  equipment: Equipment[];
  muscleGroups: MuscleGroup[];
  goal: Goal;
  excludeMuscles?: MuscleGroup[]; // muscles to avoid (yesterday's work)
  difficulty?: 'principiante' | 'intermedio' | 'avanzado';
  // Cuando el usuario elige músculos ESPECÍFICOS, queremos ejercicios cuyo
  // músculo PRIMARIO esté en la selección — no traer espalda solo porque tiene
  // bíceps como secundario. Los splits/auto sí aceptan secundarios (compuestos).
  primaryOnly?: boolean;
}): Exercise[] {
  const { exercises, equipment, muscleGroups, goal, excludeMuscles = [], primaryOnly = false, difficulty } = params;
  const RANK: Record<string, number> = { principiante: 1, intermedio: 2, avanzado: 3 };
  const ceiling = difficulty ? (difficulty === 'principiante' ? 2 : 3) : 3; // principiante: sin avanzados

  return exercises.filter(ex => {
    // Filter 1: equipment
    // Yoga sigue mirando exercise.equipment plano (no tiene variants).
    // Patrones: mirar si al menos UNA variante aplica al equipo del usuario.
    const hasEquipment = ex.isYoga
      ? ex.equipment.some(e => equipment.includes(e))
      : (ex.variants?.some(v => v.equipment.some(e => equipment.includes(e))) ?? false);
    if (!hasEquipment) return false;

    // Filter 2: muscle group match (primary; secondary solo si no es primaryOnly)
    const primaryMatch = muscleGroups.includes(ex.muscleGroup);
    const secondaryMatch = (ex.secondaryMuscles || []).some(m => muscleGroups.includes(m));
    if (primaryOnly) {
      if (!primaryMatch) return false;
    } else if (!primaryMatch && !secondaryMatch) {
      return false;
    }

    // Filter 3: goal
    if (!ex.goals.includes(goal)) return false;

    // Filter 4: exclude overworked muscles (primary only)
    if (excludeMuscles.includes(ex.muscleGroup)) return false;

    // Filter 5: nivel del usuario (techo de dificultad). Un principiante NO recibe
    // ejercicios avanzados (seguridad + adecuación); intermedio/avanzado reciben todo.
    if ((RANK[ex.difficulty] ?? 2) > ceiling) return false;

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
  primaryOnly?: boolean;
  difficulty?: 'principiante' | 'intermedio' | 'avanzado';
}): FilterResult {
  const minRequired = params.minCandidates ?? 3;
  const primaryOnly = params.primaryOnly ?? false;
  const difficulty = params.difficulty;
  // Techo de nivel (mismo que filterExercisesForWorkout): un principiante NUNCA recibe
  // avanzados, ni siquiera en los niveles de relajación 2/3 (seguridad).
  const RANK: Record<string, number> = { principiante: 1, intermedio: 2, avanzado: 3 };
  const ceiling = difficulty === 'principiante' ? 2 : 3;
  const withinLevel = (ex: { difficulty: string }) => (RANK[ex.difficulty] ?? 2) <= ceiling;

  // NIVEL 0 — filtro estricto (incluye techo de nivel)
  let candidates = filterExercisesForWorkout({
    exercises: params.exercises,
    equipment: params.equipment,
    muscleGroups: params.muscleGroups,
    goal: params.goal,
    excludeMuscles: params.excludeMuscles,
    primaryOnly,
    difficulty,
  });
  if (candidates.length >= minRequired) {
    return { exercises: candidates, relaxationLevel: 0, relaxedConstraints: [] };
  }

  // NIVEL 1 — drop excludeMuscles (mantiene techo de nivel)
  candidates = filterExercisesForWorkout({
    exercises: params.exercises,
    equipment: params.equipment,
    muscleGroups: params.muscleGroups,
    goal: params.goal,
    excludeMuscles: [],
    primaryOnly,
    difficulty,
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
    const matchesMuscle = primaryOnly
      ? params.muscleGroups.includes(ex.muscleGroup)
      : (params.muscleGroups.includes(ex.muscleGroup) ||
         (ex.secondaryMuscles?.some(m => params.muscleGroups.includes(m)) ?? false));
    return matchesEquipment && matchesMuscle && withinLevel(ex);
  });
  if (candidates.length >= minRequired) {
    return {
      exercises: candidates,
      relaxationLevel: 2,
      relaxedConstraints: ['músculos de ayer', 'goal exacto'],
    };
  }

  // NIVEL 3 — solo equipment (último recurso), pero manteniendo el techo de nivel
  candidates = params.exercises.filter(ex =>
    withinLevel(ex) && (ex.isYoga
      ? ex.equipment.some(e => params.equipment.includes(e))
      : (ex.variants?.some(v => v.equipment.some(e => params.equipment.includes(e))) ?? false))
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
  // Modo pareja: una firma del compañero (nivel+equipo+objetivo) para que la
  // rutina de dos NO colisione con la cache individual ni entre parejas distintas.
  partner?: string;
  // Idioma: el contenido generado por IA (calentamiento, enfriamiento, nota,
  // tips) sale en este idioma. Sin esto, cambiar de idioma reusaba la rutina
  // cacheada en el idioma anterior → texto mezclado.
  locale?: string;
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
    params.partner || 'solo',
    params.locale || 'es',
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

  // 4+ días de FUERZA seguidos (ayer hacia atrás; hoy aún no está logueado al planear)
  // → sugiere yoga de recuperación. Mira ambas fuentes: workoutLog (legacy) y
  // completedSessions (actual, excluye yoga/cardio).
  const strengthDates = new Set<string>();
  for (const e of workoutLog) strengthDates.add(e.date);
  for (const s of completedSessions) if (s.modality !== 'yoga' && s.modality !== 'cardio') strengthDates.add(s.date);
  const last4Dates = Array.from({ length: 4 }, (_, i) =>
    dayKey(new Date(Date.now() - (i + 1) * 86400000))
  );
  const consecutiveStrength = last4Dates.every(date => strengthDates.has(date));
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
