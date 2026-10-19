// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE NUTRITION · MICROBLOQUE 2 · CHECK-IN DOMAIN TYPES
//
// Tipos y validador del check-in nutricional quincenal: las respuestas
// EXPLÍCITAS del socio. Su palabra es la autoridad de estos datos.
//
//   respuestas crudas del check-in
//        ↓ validateNutritionCheckin
//   ├── algún valor fuera de dominio ──▶ INVALID    (errores por campo)
//   ├── falta un dato requerido ───────▶ INCOMPLETE (campos faltantes)
//   └── todo presente y en dominio ────▶ VALID      (check-in tipado)
//
// Puro / determinista / sin estado. No conoce React, ni el store, ni Supabase.
//
// ── LO QUE ESTE MÓDULO NO ES ────────────────────────────────────────────────
// NO decide kcal, ni REVIEW, ni pasos, ni trayectoria, ni ventanas: eso es el
// motor de decisión (Microbloque 3). Aquí solo se valida que el input sea
// consistente y completo para su objetivo.
// NO infiere nada del comportamiento en la app: ni palomitas de comidas, ni uso
// de entrenamientos, ni engagement. La adherencia es la que el socio DECLARA.
// NO lee Training: `trainsStrength` llega ya resuelto (la autoridad futura son
// las modalidades declaradas: cuenta solo `strength`; MIXED por sí solo no basta),
// y hambre/energía/rendimiento son conceptos de Nutrición, distintos del
// `todayCheckin` (readiness) y de las señales del mesociclo de Training.
// NO lee `obData.nivel` ni la `activity` legacy para la experiencia.
// NO normaliza en silencio: no recorta espacios, no cambia mayúsculas, no
// traduce etiquetas. Un código que no es exactamente uno del dominio es INVALID.
// ─────────────────────────────────────────────────────────────────────────────
import { CANONICAL_GOALS, type CanonicalGoal } from './energyPrescription';
import { MUSCLE_GAIN_EXPERIENCE_LEVELS, type MuscleGainExperienceLevel } from './nutritionTrajectory';

export const NUTRITION_CHECKIN_VERSION = 1;

// ── Adherencia declarada ────────────────────────────────────────────────────
/** Respuesta verbal elegida. Códigos estables: el copy puede cambiar, estos no. */
export type AdherenceAnswer = 'PRACTICALLY_ALL' | 'ALMOST_ALWAYS' | 'MOST_DAYS' | 'SOMETIMES' | 'VERY_LITTLE';
export const ADHERENCE_ANSWERS: readonly AdherenceAnswer[] =
  ['PRACTICALLY_ALL', 'ALMOST_ALWAYS', 'MOST_DAYS', 'SOMETIMES', 'VERY_LITTLE'];

/** HIGH ≥ 80 % · MEDIUM 60–79 % · LOW < 60 %. */
export type AdherenceBand = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Rango que ANCLA cada opción en el copy (decisión de producto, Microbloque 2):
 * sin el rango, «la mayoría de los días» (> 50 %) cruzaría LOW/MEDIUM y «casi
 * siempre» MEDIUM/HIGH. Cada rango cae entero en UNA banda. Es documentación
 * del copy, no un dato: nunca se guarda un porcentaje puntual.
 */
export const ADHERENCE_ANSWER_COPY_RANGE_PCT: Readonly<Record<AdherenceAnswer, { min: number; max: number | null }>> = {
  PRACTICALLY_ALL: { min: 90, max: null },
  ALMOST_ALWAYS: { min: 80, max: 89 },
  MOST_DAYS: { min: 60, max: 79 },
  SOMETIMES: { min: 30, max: 59 },
  VERY_LITTLE: { min: 0, max: 29 },
};

export const ADHERENCE_ANSWER_BAND: Readonly<Record<AdherenceAnswer, AdherenceBand>> = {
  PRACTICALLY_ALL: 'HIGH',
  ALMOST_ALWAYS: 'HIGH',
  MOST_DAYS: 'MEDIUM',
  SOMETIMES: 'LOW',
  VERY_LITTLE: 'LOW',
};

/** Banda de una respuesta verbal; `null` si el código no existe. Sin porcentaje inventado. */
export function adherenceBandOf(answer: unknown): AdherenceBand | null {
  return isOneOf(answer, ADHERENCE_ANSWERS) ? ADHERENCE_ANSWER_BAND[answer] : null;
}

// ── Hambre / energía / rendimiento (conceptos de Nutrición) ─────────────────
/** HIGH = hambre frecuente que dificulta seguir el plan, o quedarse corto la mayoría de los días. */
export type NutritionHunger = 'LOW' | 'NORMAL' | 'HIGH';
export const NUTRITION_HUNGER_VALUES: readonly NutritionHunger[] = ['LOW', 'NORMAL', 'HIGH'];

/** LOW = fatiga clara durante el día, distinta a lo habitual. No es la `energy` de Training. */
export type NutritionEnergy = 'LOW' | 'NORMAL' | 'GOOD';
export const NUTRITION_ENERGY_VALUES: readonly NutritionEnergy[] = ['LOW', 'NORMAL', 'GOOD'];

/**
 * WORSE = entrenamientos claramente peores de forma repetida, no un solo mal día.
 * NOT_APPLICABLE = no entrena, o el objetivo no requiere evaluar rendimiento.
 * Siempre es obligatoria como RESPUESTA; NOT_APPLICABLE vale para cualquier
 * objetivo. Qué objetivos la usan lo decide el motor (Microbloque 3).
 */
export type NutritionPerformance = 'WORSE' | 'SAME' | 'BETTER' | 'NOT_APPLICABLE';
export const NUTRITION_PERFORMANCE_VALUES: readonly NutritionPerformance[] = ['WORSE', 'SAME', 'BETTER', 'NOT_APPLICABLE'];

// ── Fuerza: experiencia ≠ continuidad ───────────────────────────────────────
/**
 * Experiencia ACUMULADA en fuerza, propia de Nutrición (mismos códigos que
 * consume la trayectoria de MUSCLE_GAIN):
 *   BEGINNER < 1 año · INTERMEDIATE 1–3 años · ADVANCED > 3 años.
 */
export type StrengthExperience = MuscleGainExperienceLevel;
export const STRENGTH_EXPERIENCE_VALUES: readonly StrengthExperience[] = MUSCLE_GAIN_EXPERIENCE_LEVELS;

/**
 * «¿Has entrenado fuerza de forma constante en los últimos 3 meses?»
 * Solo contexto en esta versión: no altera kcal ni cambia la experiencia.
 */
export type RecentStrengthContinuity = 'YES' | 'NO';
export const RECENT_STRENGTH_CONTINUITY_VALUES: readonly RecentStrengthContinuity[] = ['YES', 'NO'];

/** Objetivos que requieren cintura para una evaluación completa. */
export const WAIST_REQUIRED_OBJECTIVES: readonly CanonicalGoal[] = ['RECOMPOSITION'];
/** Objetivos que requieren experiencia en fuerza. */
export const STRENGTH_EXPERIENCE_REQUIRED_OBJECTIVES: readonly CanonicalGoal[] = ['MUSCLE_GAIN'];

// ── Tipos de entrada / salida ───────────────────────────────────────────────
/** Respuestas crudas tal como llegan del check-in. Sin ids ni timestamps técnicos. */
export interface NutritionCheckinInput {
  objective: unknown;
  weightKg: unknown;
  waistCm?: unknown;
  adherenceAnswer: unknown;
  hunger: unknown;
  energy: unknown;
  performance: unknown;
  /** Ya resuelto por el caller. No se lee Training aquí. */
  trainsStrength?: unknown;
  strengthExperience?: unknown;
  recentStrengthContinuity?: unknown;
  /** Fecha local YYYY-MM-DD del check-in. */
  checkinDate: unknown;
  /** Número de ciclo quincenal (1, 2, …), si el caller lo conoce. */
  cycleNumber?: unknown;
}

export type NutritionCheckinField = keyof NutritionCheckinInput;

/** Check-in validado. Guarda la respuesta elegida Y su banda derivada; nunca un % puntual. */
export interface NutritionCheckin {
  objective: CanonicalGoal;
  weightKg: number;
  waistCm: number | null;
  adherence: { answer: AdherenceAnswer; band: AdherenceBand };
  hunger: NutritionHunger;
  energy: NutritionEnergy;
  performance: NutritionPerformance;
  trainsStrength: boolean | null;
  strengthExperience: StrengthExperience | null;
  recentStrengthContinuity: RecentStrengthContinuity | null;
  checkinDate: string;
  cycleNumber: number | null;
}

export type NutritionCheckinValidation =
  | { status: 'VALID'; checkin: NutritionCheckin }
  | { status: 'INCOMPLETE'; missing: NutritionCheckinField[] }
  | { status: 'INVALID'; invalid: NutritionCheckinField[] };

// ── Helpers internos ────────────────────────────────────────────────────────
function isOneOf<T extends string>(v: unknown, list: readonly T[]): v is T {
  return typeof v === 'string' && (list as readonly string[]).includes(v);
}
const isAbsent = (v: unknown) => v === null || v === undefined;
const isPositiveFinite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const isPositiveInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1;

/** Clave YYYY-MM-DD de una fecha que existe en el calendario (rechaza 2026-02-30). */
function isValidYmd(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

// ── API pública ─────────────────────────────────────────────────────────────
/**
 * Valida y tipa un check-in. INVALID tiene prioridad sobre INCOMPLETE: si algún
 * valor presente está fuera de dominio, no se reporta lo que falta.
 * Nunca lanza ni rellena: lo ausente queda ausente y lo inválido se nombra.
 */
export function validateNutritionCheckin(input: NutritionCheckinInput): NutritionCheckinValidation {
  const invalid: NutritionCheckinField[] = [];
  const missing: NutritionCheckinField[] = [];

  /** Campo requerido: ausente → missing; presente y fuera de dominio → invalid. */
  const required = (field: NutritionCheckinField, ok: (v: unknown) => boolean) => {
    const v = input[field];
    if (isAbsent(v)) missing.push(field);
    else if (!ok(v)) invalid.push(field);
  };
  /** Campo opcional (o requerido según objetivo): si viene, debe estar en dominio. */
  const optional = (field: NutritionCheckinField, ok: (v: unknown) => boolean, requiredNow: boolean) => {
    const v = input[field];
    if (isAbsent(v)) { if (requiredNow) missing.push(field); }
    else if (!ok(v)) invalid.push(field);
  };

  required('objective', (v) => isOneOf(v, CANONICAL_GOALS));
  const objective = isOneOf(input.objective, CANONICAL_GOALS) ? input.objective : null;

  required('weightKg', isPositiveFinite);
  // Si el objetivo no es válido no se puede saber qué exige: se valida el dominio, no la presencia.
  optional('waistCm', isPositiveFinite, objective != null && WAIST_REQUIRED_OBJECTIVES.includes(objective));
  required('adherenceAnswer', (v) => isOneOf(v, ADHERENCE_ANSWERS));
  required('hunger', (v) => isOneOf(v, NUTRITION_HUNGER_VALUES));
  required('energy', (v) => isOneOf(v, NUTRITION_ENERGY_VALUES));
  required('performance', (v) => isOneOf(v, NUTRITION_PERFORMANCE_VALUES));
  optional('trainsStrength', (v) => typeof v === 'boolean', false);
  optional('strengthExperience', (v) => isOneOf(v, STRENGTH_EXPERIENCE_VALUES),
    objective != null && STRENGTH_EXPERIENCE_REQUIRED_OBJECTIVES.includes(objective));
  optional('recentStrengthContinuity', (v) => isOneOf(v, RECENT_STRENGTH_CONTINUITY_VALUES), false);
  required('checkinDate', isValidYmd);
  optional('cycleNumber', isPositiveInt, false);

  if (invalid.length > 0) return { status: 'INVALID', invalid };
  if (missing.length > 0) return { status: 'INCOMPLETE', missing };

  const answer = input.adherenceAnswer as AdherenceAnswer;
  return {
    status: 'VALID',
    checkin: {
      objective: objective!,
      weightKg: input.weightKg as number,
      waistCm: isAbsent(input.waistCm) ? null : (input.waistCm as number),
      adherence: { answer, band: ADHERENCE_ANSWER_BAND[answer] },
      hunger: input.hunger as NutritionHunger,
      energy: input.energy as NutritionEnergy,
      performance: input.performance as NutritionPerformance,
      trainsStrength: isAbsent(input.trainsStrength) ? null : (input.trainsStrength as boolean),
      strengthExperience: isAbsent(input.strengthExperience) ? null : (input.strengthExperience as StrengthExperience),
      recentStrengthContinuity: isAbsent(input.recentStrengthContinuity) ? null : (input.recentStrengthContinuity as RecentStrengthContinuity),
      checkinDate: input.checkinDate as string,
      cycleNumber: isAbsent(input.cycleNumber) ? null : (input.cycleNumber as number),
    },
  };
}
