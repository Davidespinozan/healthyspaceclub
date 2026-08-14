import { dayKey } from './localDate';
import { VIDEO_VARIANT_IDS } from '../data/videoAvailability';
import { variantAllowedByGear, gearFromLegacyEquipment, type Implement, type Gear } from './equipmentImplement';
import { computeVolumeTargets, targetsToMap, type Level } from './volumeLandmarks';
import type {
  Exercise,
  ExerciseVariant,
  MuscleGroup,
  Equipment,
  Goal,
  TrainingGoal,
  Modality,
  CardioStyle,
  WorkoutDayType,
  WorkoutDayDecision
} from '../types';
import type { WorkoutEntry, CompletedSession } from '../types';
import type { TranslationKey } from '../i18n/es';

// ══════════════════════════════════════════════════════════════
// CICLADO BASE POR OBJETIVO
// ══════════════════════════════════════════════════════════════

// Ciclo semanal NEUTRAL de resistencia (Fase 0 · separación semántica). ANTES había un
// ciclo por BODY GOAL, y 'perder-grasa'/'mantener' inyectaban un día 'cardio' que
// REEMPLAZABA un día de resistencia y sesgaban la semana a full-body → eso mezclaba
// "qué quiere la persona en su cuerpo" con "cómo se programa el entrenamiento".
//
// Ahora el split de resistencia NO depende del body goal: los días de FUERZA se re-derivan
// por FRECUENCIA real + déficit semanal (ver `splitTypesForFrequency`/`pickByVolumeDeficit`
// más abajo), y este ciclo solo fija el patrón esfuerzo/recuperación (5 fuerza + 2 movilidad).
// El cardio deja de ser un día impuesto por el body goal: es una dimensión COMPLEMENTARIA
// (el finisher acotado, o que el usuario elija modalidad cardio). El body goal sigue
// alimentando nutrición y la dosis de cardio — no la estructura de resistencia.
const RESISTANCE_CYCLE: WorkoutDayType[] =
  ['upper', 'lower', 'full-body', 'upper', 'lower', 'movilidad', 'movilidad'];

/** Normaliza cualquier entrada a un TRAINING GOAL tipado. Solo 'fuerza' es explícito;
 *  cualquier otra cosa (incluido un body goal como "perder grasa") → hipertrofia.
 *  Blindaje: es IMPOSIBLE que un string de composición corporal produzca reps de fuerza. */
export function normalizeTrainingGoal(x: string | null | undefined): TrainingGoal {
  return /fuerza|strength/i.test(String(x || '')) ? 'fuerza' : 'hipertrofia';
}

/** Resuelve el TRAINING GOAL de resistencia desde el perfil. Lee SOLO una preferencia
 *  explícita de entrenamiento (`obData.trainingGoal`), NUNCA el body goal. Sin preferencia
 *  → hipertrofia (default de la Fase 0; la fisiología de fuerza real llega en Fase 1). */
export function resolveTrainingGoal(obData?: Record<string, unknown> | null): TrainingGoal {
  return normalizeTrainingGoal(obData?.trainingGoal as string | undefined);
}

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

/**
 * P3 — Serie de volumen SEMANA a SEMANA por músculo (reciente → viejo), derivada de
 * diferenciar computeWeeklyVolume en ventanas acumuladas (7, 14, 21…). La usa
 * volumeLandmarks para el baseline (mediana robusta al deload). No persiste nada.
 */
export function weeklyVolumeSeries(
  completedSessions: CompletedSession[],
  exercises: Exercise[],
  workoutLog: WorkoutEntry[] = [],
  weeks = 4,
): Record<string, number>[] {
  const series: Record<string, number>[] = [];
  let prev: Record<string, number> = {};
  for (let w = 1; w <= weeks; w++) {
    const cum = computeWeeklyVolume(completedSessions, exercises, w * 7, workoutLog);
    const wk: Record<string, number> = {};
    const keys = new Set([...Object.keys(cum), ...Object.keys(prev)]);
    for (const m of keys) { const v = (cum[m] ?? 0) - (prev[m] ?? 0); if (v > 0.001) wk[m] = v; }
    series.push(wk);
    prev = cum;
  }
  return series;
}

const STRENGTH_TYPES: WorkoutDayType[] = ['upper', 'lower', 'full-body', 'push', 'pull', 'legs'];

/**
 * "Juntos de verdad" — foco fresco para AMBOS. Dado el día de fuerza que el motor
 * eligió para el host y los músculos recientes de los dos (los del compañero vía sus
 * day-types recientes), escoge el día de fuerza que MENOS solapa con lo que cualquiera
 * ya entrenó (ej. host hizo pierna, compa hombro → hoy un día de tirón/espalda).
 * ADITIVO Y SEGURO: si el día NO es de fuerza, o no hay músculos recientes, o el del
 * host ya es el de menor solape, lo devuelve IGUAL (nunca peor que hoy).
 */
export function reconcilePartnerDayType(
  hostType: WorkoutDayType,
  hostRecentMuscles: MuscleGroup[],
  partnerRecentDaytypes: string[],
): WorkoutDayType {
  if (!STRENGTH_TYPES.includes(hostType)) return hostType;
  const recent = new Set<MuscleGroup>(hostRecentMuscles);
  for (const dt of partnerRecentDaytypes) {
    const cfg = DAY_TYPE_CONFIG[dt as WorkoutDayType];
    if (cfg) for (const m of cfg.muscleGroups) recent.add(m);
  }
  if (recent.size === 0) return hostType;
  const overlap = (ty: WorkoutDayType) =>
    DAY_TYPE_CONFIG[ty].muscleGroups.reduce((n, m) => n + (recent.has(m) ? 1 : 0), 0);
  let best = hostType;
  let bestOv = overlap(hostType);
  for (const ty of STRENGTH_TYPES) {
    const ov = overlap(ty);
    if (ov < bestOv) { best = ty; bestOv = ov; }
  }
  return best;
}

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

/** Dificultad EFECTIVA para el equipo del usuario: la de la variante que se usará (si
 *  existe), si no la del patrón. Un hip-thrust "peso corporal" es principiante; una
 *  búlgara peso corporal es intermedia — por eso importa la VARIANTE, no solo el patrón. */
function effectiveDifficulty(ex: Exercise, equipment: Equipment[], allowed?: Set<Implement>): string {
  const v = selectVariantForEquipment(ex, equipment, allowed);
  return v?.difficulty ?? ex.difficulty;
}

/**
 * CHALLENGE-MATCH (B): sin carga externa (peso corporal / ligas), un ejercicio fácil
 * es casi inútil para alguien con experiencia — un hip thrust sin peso no reta a un
 * avanzado, un desplante sí. Ordena los candidatos para que el que ESTÁ A LA ALTURA de
 * su nivel salga primero (la IA prefiere los primeros). Con gym NO aplica: ahí la CARGA
 * da el estímulo, así que no hay que sesgar por dificultad técnica. Sort estable →
 * dentro del mismo fit se conserva el orden de variedad.
 */
export function orderByChallenge(candidates: Exercise[], level: TrainingLevel, equipment: Equipment[], allowed?: Set<Implement>): Exercise[] {
  if (equipment.includes('gym')) return candidates; // con carga externa, el peso manda
  const DR: Record<string, number> = { principiante: 1, intermedio: 2, avanzado: 3 };
  const fit = (ex: Exercise): number => {
    const d = DR[effectiveDifficulty(ex, equipment, allowed)] ?? 2;
    if (level === 'avanzado') return 3 - d;        // 0 avz (mejor) · 1 int · 2 princ
    if (level === 'intermedio') return d >= 2 ? 0 : 1; // int/avz primero, princ después
    return d <= 1 ? 0 : 1;                          // principiante: aprende el movimiento primero
  };
  return candidates
    .map((e, i) => ({ e, i }))
    .sort((a, b) => fit(a.e) - fit(b.e) || a.i - b.i)
    .map(x => x.e);
}

/**
 * Balance de patrones: los ejercicios separados por AGARRE comparten movementFamily
 * (ej. tracción vertical pronada/supina/neutra). Sin límite, la IA podría meter 3
 * jalones el mismo día y descuidar otros patrones. Deja como máximo `maxPerFamily`
 * candidatos de cada familia (preserva el orden → los primeros/frescos sobreviven).
 * Ejercicios sin familia no se tocan.
 */
export function capByMovementFamily(candidates: Exercise[], maxPerFamily = 2): Exercise[] {
  const seen = new Map<string, number>();
  const out: Exercise[] = [];
  for (const e of candidates) {
    if (!e.movementFamily) { out.push(e); continue; }
    const n = seen.get(e.movementFamily) ?? 0;
    if (n >= maxPerFamily) continue;
    seen.set(e.movementFamily, n + 1);
    out.push(e);
  }
  return out;
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
  // Info por semana (w hacia atrás): nº de días entrenados y si hubo una sesión de DESCARGA.
  const weekInfo = (w: number): { count: number; hasDeload: boolean } => {
    const newer = dayKey(new Date(Date.now() - (w * 7 - 6) * 86400000)); // límite reciente
    const older = dayKey(new Date(Date.now() - w * 7 * 86400000));       // límite viejo
    const set = new Set<string>();
    let hasDeload = false;
    const inRange = (d: string) => d >= older && d <= newer;
    for (const x of completedSessions) if (inRange(x.date)) { set.add(x.date); if (x.isDeload) hasDeload = true; }
    for (const x of workoutLog) if (inRange(x.date)) set.add(x.date);
    return { count: set.size, hasDeload };
  };
  // Semanas DURAS acumuladas del bloque EN CURSO: cuenta hacia atrás hasta un hueco (<3
  // sesiones) O hasta una semana de DESCARGA. La semana de deload es la FRONTERA del bloque
  // → no se cuenta ella ni lo anterior. Así un bloque real dura 4-6 semanas y RESETEA tras el
  // deload (arregla el deload perpetuo del entrenador consistente).
  let weeks = 0;
  for (let w = 1; w <= 8; w++) {
    const { count, hasDeload } = weekInfo(w);
    if (count < 3 || hasDeload) break;
    weeks++;
  }
  return { deload: weeks >= 4, weeksAccumulated: weeks };
}

/**
 * ¿Estamos DENTRO de la semana de descarga en curso? El deload dura ~1 semana desde su
 * INICIO (primera sesión de deload de la racha más reciente). Mientras no hayan pasado 7 días
 * desde ese inicio, el deload se mantiene (no se corta a mitad de semana); pasados 7 días, el
 * bloque nuevo arranca en semana 1. Anclado al INICIO de la racha (no al final) para que un
 * deload repartido en la semana no lo prolongue indefinidamente.
 */
export function inDeloadWeek(completedSessions: CompletedSession[]): boolean {
  const desc = [...completedSessions].sort((a, b) => (b.completedAtIso || b.date).localeCompare(a.completedAtIso || a.date));
  const firstDeloadIdx = desc.findIndex(s => s.isDeload);
  if (firstDeloadIdx < 0) return false;
  let streakStart = desc[firstDeloadIdx].date;
  for (let j = firstDeloadIdx; j < desc.length; j++) {
    if (desc[j].isDeload) streakStart = desc[j].date; // desc = más nuevo→viejo: extiende al más antiguo de la racha
    else break;
  }
  const days = Math.floor((Date.now() - Date.parse(streakStart + 'T00:00:00Z')) / 86400000);
  return days < 7;
}

/** Entre varios tipos de día, elige el que más DÉFICIT de volumen tiene esta semana
 *  (músculos que van cortos vs la meta), evitando repetir los de ayer. */
export function pickByVolumeDeficit(
  types: WorkoutDayType[],
  vol: Record<string, number>,
  yesterdayMuscles: MuscleGroup[],
  target?: Record<string, number>, // P3: target POR MÚSCULO. Sin él → 14 plano (compat).
): WorkoutDayType {
  const yesterday = new Set(yesterdayMuscles);
  const t_ = (m: string) => target?.[m] ?? WEEKLY_SET_TARGET;
  const scored = types.map((t) => {
    const mgs = DAY_TYPE_CONFIG[t].muscleGroups;
    const deficit = mgs.reduce((a, m) => a + Math.max(0, t_(m) - (vol[m] ?? 0)), 0);
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
  level?: Level; // P3: para el target de volumen personalizado (default intermedio → compat)
}): WorkoutDayDecision {
  const { userObjective, workoutLog, exercises, dailyEnergy, dailySleep, completedSessions = [] } = params;

  // BODY GOAL → solo para la NARRACIÓN ("por qué hoy"), ya NO para elegir el ciclo.
  const objectiveKey = normalizeObjective(userObjective);
  // El ciclo de resistencia es NEUTRAL al body goal (Fase 0): los días de fuerza se
  // re-derivan por frecuencia/déficit abajo; el body goal no impone cardio ni full-body.
  const cycle = RESISTANCE_CYCLE;

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
    // P3: la selección de día compara contra el target PERSONALIZADO por músculo
    // (baseline individual), no contra el 14 plano. Aquí va el baseline (sin meso/
    // señales) porque para ELEGIR el día importa la distribución entre músculos, que
    // es uniforme al multiplicador; la modulación del mesociclo afecta la magnitud.
    const series = weeklyVolumeSeries(completedSessions, exercises, workoutLog, 4);
    const weeksOfHistory = series.filter(wk => Object.keys(wk).length > 0).length;
    const targets = computeVolumeTargets({
      weeklyVolumes: series,
      level: params.level ?? 'intermedio',
      weeksOfHistory,
      longPause: history.restDays >= 14,
    });
    todayType = pickByVolumeDeficit(preferred, vol, history.yesterday, targetsToMap(targets));
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

export function determineIntensity(
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
  // Modo bajo impacto (adultos mayores / movilidad reducida): excluye ejercicios
  // de ALTO impacto o con riesgo de caída (saltos, pliometría, sprints) sin importar
  // su dificultad. La seguridad es un filtro DURO, nunca se delega a la IA.
  lowImpactMode?: boolean;
  // Equipo granular (Fase C): implementos que el usuario tiene (mancuerna/barra/…).
  // Sin esto = como antes (cualquier variante del equipo base). Con esto, una variante
  // solo cuenta si su implemento está desbloqueado.
  allowedImplements?: Set<Implement>;
}): Exercise[] {
  const { exercises, equipment, muscleGroups, goal, excludeMuscles = [], primaryOnly = false, difficulty, lowImpactMode = false, allowedImplements } = params;
  const RANK: Record<string, number> = { principiante: 1, intermedio: 2, avanzado: 3 };
  const ceiling = difficulty ? (difficulty === 'principiante' ? 2 : 3) : 3; // principiante: sin avanzados

  return exercises.filter(ex => {
    // Filter 0 (seguridad DURA): en modo bajo impacto, fuera saltos/pliometría/sprints.
    if (lowImpactMode && (ex.impact === 'high' || ex.fallRisk === true)) return false;

    // Filter 1: equipment + VIDEO.
    // David: SOLO se programan ejercicios que ya tienen video conectado. Un
    // ejercicio es elegible si tiene una variante que (a) aplica al equipo del
    // usuario y (b) tiene clip (VIDEO_VARIANT_IDS). Conforme se conectan más
    // videos (regenerando videoAvailability.ts desde las migraciones), esos
    // ejercicios entran solos. Yoga: el propio id de la pose debe tener video.
    if (!hasPlayableVariant(ex, equipment, allowedImplements)) return false;

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
/**
 * Recupera el equipo con el que se generó una rutina guardada. El plan (JSON del AI)
 * no lo trae, así que al guardar sellamos `userEquipment` en el objeto del plan; aquí
 * lo leemos y validamos. Devuelve null si no hay uno válido (rutina vieja sin sello) →
 * el llamador cae a su default. Sin esto, al recargar se re-elegía la variante con el
 * equipo default ('gym') y una rutina de ligas se repintaba como gym.
 */
export function equipmentFromPlan(plan: unknown): Equipment | null {
  const eq = (plan as { userEquipment?: unknown } | null)?.userEquipment;
  return eq === 'ligas' || eq === 'cuerpo' || eq === 'gym' ? eq : null;
}

const VALID_GEAR = new Set(['gym', 'mancuernas', 'barra', 'banco', 'dominadas', 'ligas', 'cuerpo']);
/** Restaura el GEAR canónico de un plan: prefiere `userGear`; si es un plan LEGACY (solo
 *  `userEquipment` plano), lo MIGRA. Un usuario existente nunca queda sin poder generar. */
export function gearFromPlan(plan: unknown): Gear[] | null {
  const g = (plan as { userGear?: unknown } | null)?.userGear;
  if (Array.isArray(g)) { const f = g.filter((x): x is Gear => typeof x === 'string' && VALID_GEAR.has(x)); return f.length ? f : []; }
  const legacy = equipmentFromPlan(plan);
  return legacy != null ? gearFromLegacyEquipment(legacy) : null;
}

/** Modalidad sellada en el plan al guardar (misma razón que equipmentFromPlan): sin
 *  esto, al recargar la modalidad volvía a una sugerencia y una sesión de cardio se
 *  registraba como fuerza al completarla. null si no hay sello válido. */
export function modalityFromPlan(plan: unknown): Modality | null {
  const m = (plan as { userModality?: unknown } | null)?.userModality;
  return m === 'auto' || m === 'fuerza' || m === 'yoga' || m === 'cardio' ? m : null;
}

/** Restaura el TRAINING GOAL sellado en el plan (Fase 2 · UI). Sin sello → null (el llamador
 *  cae a la preferencia del perfil vía resolveTrainingGoal → hipertrofia por default). */
export function trainingGoalFromPlan(plan: unknown): TrainingGoal | null {
  const g = (plan as { userTrainingGoal?: unknown } | null)?.userTrainingGoal;
  return g === 'fuerza' || g === 'hipertrofia' ? g : null;
}

/** Duración (min) sellada en el plan al guardar; sin esto el timer volvía a 45 min al
 *  recargar aunque la rutina se hubiera hecho para otra duración. null si no es válida. */
export function durationFromPlan(plan: unknown): number | null {
  const d = (plan as { userDuration?: unknown } | null)?.userDuration;
  return typeof d === 'number' && d > 0 && d <= 240 ? d : null;
}

/** Estilo de cardio sellado en el plan (Fase 4). 'auto' = seguir el objetivo. null si
 *  no hay sello válido → el llamador cae a 'auto'. */
export function cardioStyleFromPlan(plan: unknown): CardioStyle | 'auto' | null {
  const s = (plan as { userCardioStyle?: unknown } | null)?.userCardioStyle;
  return s === 'auto' || s === 'explosividad' || s === 'correr' || s === 'lowImpact' || s === 'funcional' ? s : null;
}

export function selectVariantForEquipment(
  exercise: Exercise,
  userEquipment: Equipment[],
  allowed?: Set<Implement>,
): ExerciseVariant | null {
  if (!exercise.variants || exercise.variants.length === 0) return null;

  // Variantes que aplican al equipo del usuario Y, si se pasó el equipo granular
  // (Fase C), al IMPLEMENTO que tiene (mancuerna/barra/…). Sin `allowed` = como antes.
  const applicable = exercise.variants.filter(v =>
    v.equipment.some(e => userEquipment.includes(e)) &&
    (!allowed || variantAllowedByGear(v, allowed, exercise.name))
  );

  if (applicable.length === 0) return null;

  // Preferimos variantes que YA tienen video (evita mostrar "video próximamente"
  // cuando hay una hermana aplicable con clip). VIDEO_VARIANT_IDS se regenera desde
  // las migraciones con scripts/build_videos_review_data.mjs. Si el set no cubre una
  // variante (recién grabada, aún sin regenerar), simplemente no la prioriza: cae al
  // comportamiento anterior. Nunca elige una variante que NO aplica al equipo.
  const withVideo = applicable.filter(v => VIDEO_VARIANT_IDS.has(v.id));
  const pool = withVideo.length > 0 ? withVideo : applicable;

  // Preferir la default si está entre las del pool
  const defaultInPool = pool.find(v => v.isDefault === true);
  if (defaultInPool) return defaultInPool;

  // Si no hay default en el pool, devolver la primera del pool
  return pool[0];
}

/**
 * ¿El ejercicio tiene una variante APLICABLE al equipo del usuario y CON video?
 * (Yoga: el propio id de la pose debe tener video.) Es la regla de "solo se
 * programa lo que ya se puede ver" — se usa tanto al filtrar candidatos como al
 * validar un workout cacheado.
 */
export function hasPlayableVariant(exercise: Exercise, equipment: Equipment[], allowed?: Set<Implement>): boolean {
  // Yoga: flujos curados en secuencia → NO se filtra por video (romper la secuencia
  // sería peor). El requisito de video aplica a fuerza/cardio, que es donde importa.
  if (exercise.isYoga) return exercise.equipment.some(e => equipment.includes(e));
  return exercise.variants?.some(v =>
    v.equipment.some(e => equipment.includes(e)) &&
    VIDEO_VARIANT_IDS.has(v.id) &&
    (!allowed || variantAllowedByGear(v, allowed, exercise.name)),
  ) ?? false;
}

/**
 * ¿Esta ESTACIÓN de warm-up/finisher es reproducible por el usuario? Más correcto que
 * exigir video a todo: una estación es reproducible si
 *   (A) tiene variante con VIDEO (demostración) para el equipo — obligatorio en movimientos
 *       técnicos; o
 *   (B) es una estación TEMPORAL autoexplicativa: cardio steady-state de BAJA demanda técnica
 *       (bici, caminadora, elíptica, remo, marcha) → instrucciones + duración bastan.
 * Un movimiento técnico sin video (burpee, box jump, KB swing) NO es reproducible como estación.
 */
export function isReproducibleStation(exercise: Exercise, equipment: Equipment[]): boolean {
  if (hasPlayableVariant(exercise, equipment)) return true; // (A) demostración en video
  // (B) estación temporal autoexplicativa: cardio de ritmo sostenido y bajo riesgo técnico.
  const steady = exercise.muscleGroup === 'cardio' &&
    (matchesCardioStyle(exercise, 'correr') || matchesCardioStyle(exercise, 'lowImpact'));
  const lowTechnicalDemand = exercise.impact !== 'high' && exercise.fallRisk !== true;
  return steady && lowTechnicalDemand;
}

// ══════════════════════════════════════════════════════════════
// CARDIO — estilo (bucket UX) y equipo efectivo (Fase 2)
// ══════════════════════════════════════════════════════════════

/**
 * Equipo efectivo para CARDIO. El peso corporal es UNIVERSAL: correr, saltar o marchar
 * no dependen de una banda ni del gym. Un usuario de ligas/casa hace cardio de 'cuerpo';
 * el de gym además tiene las máquinas. Arregla que "cardio + bandas" saliera vacío
 * (el cardio no tiene variantes 'ligas', así que el filtro normal lo dejaba en cero).
 */
export function cardioEquipmentFor(equipment: Equipment[]): Equipment[] {
  return equipment.includes('gym') ? ['gym', 'cuerpo'] : ['cuerpo'];
}

/**
 * Estilo de cardio por DEFECTO según el objetivo del usuario. Es la capa híbrida: el
 * motor infiere, y la UI (Fase 4) deja al usuario cambiarlo. `lowImpactMode` (edad /
 * articulaciones) MANDA — seguridad sobre preferencia.
 */
export function defaultCardioStyle(objective: string, lowImpactMode = false): CardioStyle {
  if (lowImpactMode) return 'lowImpact';
  const o = (objective || '').toLowerCase();
  if (/atlet|potencia|explos|rendimiento|deporte/.test(o)) return 'explosividad';
  if (/grasa|perder|adelgaz|quemar|definir/.test(o)) return 'funcional';
  if (/m[uú]sculo|ganar|hipertrof|fuerza/.test(o)) return 'lowImpact';
  if (/manten|salud|bienestar|general|resist|condic/.test(o)) return 'correr';
  return 'funcional';
}

/**
 * ¿Este ejercicio de cardio pertenece al estilo? Considera el override por variante
 * (cardio-maquina: caminadora='correr', bici/elíptica='lowImpact', remo='funcional').
 */
export function matchesCardioStyle(exercise: Exercise, style: CardioStyle): boolean {
  if (exercise.cardioStyle === style) return true;
  return exercise.variants?.some(v => v.cardioStyle === style) ?? false;
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
  lowImpactMode?: boolean;
  allowedImplements?: Set<Implement>;
}): FilterResult {
  const minRequired = params.minCandidates ?? 3;
  const primaryOnly = params.primaryOnly ?? false;
  const difficulty = params.difficulty;
  const lowImpactMode = params.lowImpactMode ?? false;
  const allowedImplements = params.allowedImplements;
  // Equipo base + implemento granular (Fase C). Usado en los niveles 2/3 (inline).
  const equipOk = (ex: Exercise): boolean => ex.isYoga
    ? ex.equipment.some(e => params.equipment.includes(e))
    : (ex.variants?.some(v => v.equipment.some(e => params.equipment.includes(e)) &&
        (!allowedImplements || variantAllowedByGear(v, allowedImplements, ex.name))) ?? false);
  // Techo de nivel (mismo que filterExercisesForWorkout): un principiante NUNCA recibe
  // avanzados, ni siquiera en los niveles de relajación 2/3 (seguridad).
  const RANK: Record<string, number> = { principiante: 1, intermedio: 2, avanzado: 3 };
  const ceiling = difficulty === 'principiante' ? 2 : 3;
  // Seguridad DURA de bajo impacto: se mantiene en TODOS los niveles de relajación,
  // incluso el último recurso — jamás se cuela un salto por relajar constraints.
  const safeImpact = (ex: { impact?: string; fallRisk?: boolean }) =>
    !lowImpactMode || !(ex.impact === 'high' || ex.fallRisk === true);
  const withinLevel = (ex: { difficulty: string; impact?: string; fallRisk?: boolean }) =>
    (RANK[ex.difficulty] ?? 2) <= ceiling && safeImpact(ex);

  // NIVEL 0 — filtro estricto (incluye techo de nivel)
  let candidates = filterExercisesForWorkout({
    exercises: params.exercises,
    equipment: params.equipment,
    muscleGroups: params.muscleGroups,
    goal: params.goal,
    excludeMuscles: params.excludeMuscles,
    primaryOnly,
    difficulty,
      lowImpactMode,
      allowedImplements,
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
      lowImpactMode,
      allowedImplements,
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
    const matchesMuscle = primaryOnly
      ? params.muscleGroups.includes(ex.muscleGroup)
      : (params.muscleGroups.includes(ex.muscleGroup) ||
         (ex.secondaryMuscles?.some(m => params.muscleGroups.includes(m)) ?? false));
    return equipOk(ex) && matchesMuscle && withinLevel(ex);
  });
  if (candidates.length >= minRequired) {
    return {
      exercises: candidates,
      relaxationLevel: 2,
      relaxedConstraints: ['músculos de ayer', 'goal exacto'],
    };
  }

  // NIVEL 3 — solo equipment (último recurso), pero manteniendo el techo de nivel
  candidates = params.exercises.filter(ex => withinLevel(ex) && equipOk(ex));
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
  /** Fase 0 · TRAINING GOAL de resistencia (hipertrofia|fuerza). Separado del session `goal`
   *  y del body goal (`objective`): cambiarlo invalida una rutina de resistencia incompatible. */
  trainingGoal?: string;
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
    params.trainingGoal || 'hipertrofia',
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
  if (minutes <= 65) return 9;
  if (minutes <= 95) return 11;
  return 13;
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
