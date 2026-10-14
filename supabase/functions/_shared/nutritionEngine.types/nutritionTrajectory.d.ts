// ════════════════════════════════════════════════════════════════════
// AUTO-GENERADO por scripts/build-nutrition-engine.mjs — NO EDITAR A MANO.
// Fuente única: src/utils/nutritionEngineEntry.ts (y su grafo de imports en src/utils).
// Regenerar: npm run build:nutrition-engine. Un test bloquea cualquier drift.
// ════════════════════════════════════════════════════════════════════
import { type CanonicalGoal } from './energyPrescription.d.ts';
export declare const TRAJECTORY_ENGINE_VERSION = 1;
/** FAT_LOSS se puede evaluar desde ~2 semanas. Un día de tolerancia por un check-in adelantado. */
export declare const FAT_LOSS_MIN_WINDOW_DAYS = 13;
/** MUSCLE_GAIN / RECOMPOSITION / MAINTENANCE: evaluación corporal a ~4 semanas, mismo día de tolerancia. */
export declare const BODY_MIN_WINDOW_DAYS = 27;
/** Mes medio gregoriano (365.25 / 12). Normaliza los rangos «por mes». */
export declare const DAYS_PER_MONTH = 30.4375;
/** FAT_LOSS · % de peso perdido por semana. */
export declare const FAT_LOSS_VERY_SLOW_BELOW_PCT_WEEK = 0.25;
export declare const FAT_LOSS_ON_TARGET_FROM_PCT_WEEK = 0.5;
export declare const FAT_LOSS_FAST_ABOVE_PCT_WEEK = 1;
export type MuscleGainExperienceLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export declare const MUSCLE_GAIN_EXPERIENCE_LEVELS: readonly MuscleGainExperienceLevel[];
/** MUSCLE_GAIN · kg ganados por mes, por nivel. */
export declare const MUSCLE_GAIN_TARGET_KG_PER_MONTH: Readonly<Record<MuscleGainExperienceLevel, {
    min: number;
    max: number;
}>>;
/** RECOMPOSITION · ±kg/mes compatibles con «peso relativamente estable». No es éxito ni fracaso. */
export declare const RECOMP_STABLE_KG_PER_MONTH = 0.5;
/** MAINTENANCE · ±% del peso anterior. */
export declare const MAINTENANCE_BAND_PCT = 1;
/** `direction` general · ±% del peso anterior que se lee como STABLE. No es un umbral de objetivo. */
export declare const DIRECTION_STABLE_BAND_PCT = 0.25;
/** Tiempo entre check-ins: fechas locales YYYY-MM-DD o días ya calculados. */
export type TrajectoryElapsed = {
    previousDate: string;
    currentDate: string;
} | {
    elapsedDays: number;
};
export interface TrajectoryInput {
    objective: CanonicalGoal;
    previousWeightKg: number | null | undefined;
    currentWeightKg: number | null | undefined;
    elapsed: TrajectoryElapsed;
    /** Requerido solo para MUSCLE_GAIN; se ignora en los demás objetivos. */
    experienceLevel?: MuscleGainExperienceLevel | null;
}
export type TrajectoryInvalidReason = 'UNKNOWN_OBJECTIVE' | 'INVALID_WEIGHT' | 'INVALID_DATE' | 'NON_CHRONOLOGICAL_DATES' | 'UNKNOWN_EXPERIENCE_LEVEL';
export type TrajectoryMissingInput = 'PREVIOUS_WEIGHT' | 'CURRENT_WEIGHT' | 'EXPERIENCE_LEVEL';
export type WeightDirection = 'DOWN' | 'STABLE' | 'UP';
export interface TrajectoryMetrics {
    previousWeightKg: number;
    currentWeightKg: number;
    elapsedDays: number;
    /** Semanas reales: días / 7. */
    evaluationWindowWeeks: number;
    /** Firmado: actual − anterior. */
    absoluteChangeKg: number;
    /** Firmado, respecto al peso anterior. */
    percentChangeFromBaseline: number;
    /** Firmado. */
    percentChangePerWeek: number;
    /** Firmado. */
    changeKgPerMonth: number;
    /**
     * Lectura general: STABLE si |cambio| ≤ 0.25 % del peso anterior (frontera inclusiva).
     * NO decide la trayectoria: esa autoridad es la clasificación de cada objetivo.
     */
    direction: WeightDirection;
}
export type FatLossRate = 'VERY_SLOW' | 'BORDERLINE_SLOW' | 'ON_TARGET' | 'FAST';
export type MuscleGainRate = 'BELOW_TARGET' | 'ON_TARGET' | 'ABOVE_TARGET';
export type RecompWeightTrend = 'DOWN' | 'RELATIVELY_STABLE' | 'UP';
export type MaintenanceBand = 'BELOW_MAINTENANCE_BAND' | 'WITHIN_MAINTENANCE_BAND' | 'ABOVE_MAINTENANCE_BAND';
export type TrajectoryClassification = {
    objective: 'FAT_LOSS';
    lossPercentPerWeek: number;
    rate: FatLossRate;
} | {
    objective: 'MUSCLE_GAIN';
    experienceLevel: MuscleGainExperienceLevel;
    gainKgPerMonth: number;
    targetKgPerMonth: {
        min: number;
        max: number;
    };
    rate: MuscleGainRate;
} | {
    objective: 'RECOMPOSITION';
    changeKgPerMonth: number;
    weight: RecompWeightTrend;
} | {
    objective: 'MAINTENANCE';
    percentChangeFromBaseline: number;
    band: MaintenanceBand;
};
export type TrajectoryAssessment = {
    sufficiency: 'INSUFFICIENT_DATA';
    objective: CanonicalGoal;
    missing: TrajectoryMissingInput;
    metrics: TrajectoryMetrics | null;
} | {
    sufficiency: 'INSUFFICIENT_WINDOW';
    objective: CanonicalGoal;
    requiredWindowDays: number;
    metrics: TrajectoryMetrics;
} | {
    sufficiency: 'SUFFICIENT_FOR_DECISION';
    objective: CanonicalGoal;
    requiredWindowDays: number;
    metrics: TrajectoryMetrics;
    classification: TrajectoryClassification;
};
export type TrajectoryResult = {
    status: 'INVALID_INPUT';
    reason: TrajectoryInvalidReason;
} | ({
    status: 'ASSESSED';
} & TrajectoryAssessment);
/** Ventana mínima (días) para evaluar la trayectoria de un objetivo. */
export declare function requiredWindowDays(objective: CanonicalGoal): number;
/** Evalúa la trayectoria entre dos check-ins. Puro; nunca lanza ni rellena datos ausentes. */
export declare function assessTrajectory(input: TrajectoryInput): TrajectoryResult;
