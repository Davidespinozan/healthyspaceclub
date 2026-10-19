// ════════════════════════════════════════════════════════════════════
// AUTO-GENERADO por scripts/build-nutrition-engine.mjs — NO EDITAR A MANO.
// Fuente única: src/utils/nutritionEngineEntry.ts (y su grafo de imports en src/utils).
// Regenerar: npm run build:nutrition-engine. Un test bloquea cualquier drift.
// ════════════════════════════════════════════════════════════════════
import { type CanonicalGoal } from './energyPrescription.d.ts';
import { type MuscleGainExperienceLevel } from './nutritionTrajectory.d.ts';
export declare const NUTRITION_CHECKIN_VERSION = 1;
/** Respuesta verbal elegida. Códigos estables: el copy puede cambiar, estos no. */
export type AdherenceAnswer = 'PRACTICALLY_ALL' | 'ALMOST_ALWAYS' | 'MOST_DAYS' | 'SOMETIMES' | 'VERY_LITTLE';
export declare const ADHERENCE_ANSWERS: readonly AdherenceAnswer[];
/** HIGH ≥ 80 % · MEDIUM 60–79 % · LOW < 60 %. */
export type AdherenceBand = 'HIGH' | 'MEDIUM' | 'LOW';
/**
 * Rango que ANCLA cada opción en el copy (decisión de producto, Microbloque 2):
 * sin el rango, «la mayoría de los días» (> 50 %) cruzaría LOW/MEDIUM y «casi
 * siempre» MEDIUM/HIGH. Cada rango cae entero en UNA banda. Es documentación
 * del copy, no un dato: nunca se guarda un porcentaje puntual.
 */
export declare const ADHERENCE_ANSWER_COPY_RANGE_PCT: Readonly<Record<AdherenceAnswer, {
    min: number;
    max: number | null;
}>>;
export declare const ADHERENCE_ANSWER_BAND: Readonly<Record<AdherenceAnswer, AdherenceBand>>;
/** Banda de una respuesta verbal; `null` si el código no existe. Sin porcentaje inventado. */
export declare function adherenceBandOf(answer: unknown): AdherenceBand | null;
/** HIGH = hambre frecuente que dificulta seguir el plan, o quedarse corto la mayoría de los días. */
export type NutritionHunger = 'LOW' | 'NORMAL' | 'HIGH';
export declare const NUTRITION_HUNGER_VALUES: readonly NutritionHunger[];
/** LOW = fatiga clara durante el día, distinta a lo habitual. No es la `energy` de Training. */
export type NutritionEnergy = 'LOW' | 'NORMAL' | 'GOOD';
export declare const NUTRITION_ENERGY_VALUES: readonly NutritionEnergy[];
/**
 * WORSE = entrenamientos claramente peores de forma repetida, no un solo mal día.
 * NOT_APPLICABLE = no entrena, o el objetivo no requiere evaluar rendimiento.
 * Siempre es obligatoria como RESPUESTA; NOT_APPLICABLE vale para cualquier
 * objetivo. Qué objetivos la usan lo decide el motor (Microbloque 3).
 */
export type NutritionPerformance = 'WORSE' | 'SAME' | 'BETTER' | 'NOT_APPLICABLE';
export declare const NUTRITION_PERFORMANCE_VALUES: readonly NutritionPerformance[];
/**
 * Experiencia ACUMULADA en fuerza, propia de Nutrición (mismos códigos que
 * consume la trayectoria de MUSCLE_GAIN):
 *   BEGINNER < 1 año · INTERMEDIATE 1–3 años · ADVANCED > 3 años.
 */
export type StrengthExperience = MuscleGainExperienceLevel;
export declare const STRENGTH_EXPERIENCE_VALUES: readonly StrengthExperience[];
/**
 * «¿Has entrenado fuerza de forma constante en los últimos 3 meses?»
 * Solo contexto en esta versión: no altera kcal ni cambia la experiencia.
 */
export type RecentStrengthContinuity = 'YES' | 'NO';
export declare const RECENT_STRENGTH_CONTINUITY_VALUES: readonly RecentStrengthContinuity[];
/** Objetivos que requieren cintura para una evaluación completa. */
export declare const WAIST_REQUIRED_OBJECTIVES: readonly CanonicalGoal[];
/** Objetivos que requieren experiencia en fuerza. */
export declare const STRENGTH_EXPERIENCE_REQUIRED_OBJECTIVES: readonly CanonicalGoal[];
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
    adherence: {
        answer: AdherenceAnswer;
        band: AdherenceBand;
    };
    hunger: NutritionHunger;
    energy: NutritionEnergy;
    performance: NutritionPerformance;
    trainsStrength: boolean | null;
    strengthExperience: StrengthExperience | null;
    recentStrengthContinuity: RecentStrengthContinuity | null;
    checkinDate: string;
    cycleNumber: number | null;
}
export type NutritionCheckinValidation = {
    status: 'VALID';
    checkin: NutritionCheckin;
} | {
    status: 'INCOMPLETE';
    missing: NutritionCheckinField[];
} | {
    status: 'INVALID';
    invalid: NutritionCheckinField[];
};
/**
 * Valida y tipa un check-in. INVALID tiene prioridad sobre INCOMPLETE: si algún
 * valor presente está fuera de dominio, no se reporta lo que falta.
 * Nunca lanza ni rellena: lo ausente queda ausente y lo inválido se nombra.
 */
export declare function validateNutritionCheckin(input: NutritionCheckinInput): NutritionCheckinValidation;
