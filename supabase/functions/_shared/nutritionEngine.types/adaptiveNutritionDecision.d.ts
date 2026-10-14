// ════════════════════════════════════════════════════════════════════
// AUTO-GENERADO por scripts/build-nutrition-engine.mjs — NO EDITAR A MANO.
// Fuente única: src/utils/nutritionEngineEntry.ts (y su grafo de imports en src/utils).
// Regenerar: npm run build:nutrition-engine. Un test bloquea cualquier drift.
// ════════════════════════════════════════════════════════════════════
import { type CanonicalGoal } from './energyPrescription.d.ts';
import type { TrajectoryClassification, TrajectoryResult } from './nutritionTrajectory.d.ts';
import { type NutritionCheckinValidation, type NutritionEnergy, type NutritionHunger, type NutritionPerformance } from './nutritionCheckin.d.ts';
export declare const ADAPTIVE_DECISION_VERSION = 1;
/** Rango de calibración en pasos enteros. Cada paso equivaldrá a 5 % de la energía base. */
export declare const CALIBRATION_STEP_MIN = -2;
export declare const CALIBRATION_STEP_MAX = 2;
/** Cintura: |Δ| ≤ 0.5 cm es SAME (frontera incluida). Solo absorbe el ruido de la cinta. */
export declare const WAIST_SAME_TOLERANCE_CM = 0.5;
export type AdaptiveAction = 'MAINTAIN' | 'STEP_UP' | 'STEP_DOWN' | 'REVIEW' | 'NO_ADJUSTMENT';
export declare const ADAPTIVE_ACTIONS: readonly AdaptiveAction[];
export type AdaptiveReason = 'INSUFFICIENT_WINDOW' | 'INSUFFICIENT_DATA' | 'ADHERENCE_NOT_HIGH' | 'VERY_SLOW' | 'BORDERLINE_SLOW_FIRST' | 'BORDERLINE_SLOW_CONFIRMED' | 'ON_TARGET' | 'DEFICIT_SYMPTOMS' | 'FAST_FIRST' | 'FAST_CONFIRMED' | 'FAST_WITH_SYMPTOMS' | 'BELOW_TARGET' | 'ABOVE_TARGET' | 'WITHIN_MAINTENANCE_BAND' | 'BELOW_MAINTENANCE_BAND' | 'ABOVE_MAINTENANCE_BAND' | 'NEGATIVE_SIGNALS' | 'CONTRADICTORY_SIGNALS' | 'PERFORMANCE_IMPROVING' | 'PERFORMANCE_WORSE' | 'NO_TRAINING_SIGNAL' | 'WAIST_IMPROVING' | 'WAIST_WORSENING' | 'NO_CLEAR_PROGRESS' | 'DIRECTION_REVERSAL_BLOCKED' | 'CALIBRATION_LIMIT_REACHED';
export type AdaptiveInvalidReason = 'UNKNOWN_OBJECTIVE' | 'INVALID_STEP' | 'INVALID_CYCLE_INDEX' | 'CHECKIN_NOT_VALID' | 'TRAJECTORY_INVALID' | 'OBJECTIVE_MISMATCH' | 'CYCLE_MISMATCH' | 'WEIGHT_MISMATCH' | 'INVALID_PREVIOUS_CONTEXT';
export type WaistChange = 'LOWER' | 'SAME' | 'HIGHER';
/**
 * Lo que el caller reconstruye del check-in INMEDIATAMENTE anterior.
 * `null` en el input = no hay lectura previa (primera lectura), no es un error.
 */
export interface PreviousCheckinContext {
    /** Decisión del ciclo anterior. Solo STEP_UP/STEP_DOWN cuentan como paso APLICADO. */
    action: AdaptiveAction;
    /** Clasificación de su trayectoria; `null` si aquella evaluación no fue suficiente. */
    classification: TrajectoryClassification | null;
    hunger: NutritionHunger;
    energy: NutritionEnergy;
    performance: NutritionPerformance;
    waistCm: number | null;
}
export interface AdaptiveDecisionInput {
    objective: CanonicalGoal;
    trajectory: TrajectoryResult;
    checkin: NutritionCheckinValidation;
    /** Paso de calibración vigente, entero en −2…+2. */
    currentStep: number;
    /** Índice del ciclo quincenal evaluado, entero ≥ 1. */
    cycleIndex: number;
    previous: PreviousCheckinContext | null;
}
export interface AdaptiveDecision {
    action: AdaptiveAction;
    reason: AdaptiveReason;
    objective: CanonicalGoal;
    cycleIndex: number;
    currentStep: number;
    /** = currentStep salvo STEP_UP (+1) / STEP_DOWN (−1). */
    proposedStep: number;
    /** Paso que las reglas del objetivo pedían y la anti-oscilación convirtió en REVIEW. */
    blocked: {
        action: 'STEP_UP' | 'STEP_DOWN';
        reason: AdaptiveReason;
    } | null;
}
export type AdaptiveDecisionResult = {
    status: 'INVALID_INPUT';
    reason: AdaptiveInvalidReason;
} | {
    status: 'DECIDED';
    decision: AdaptiveDecision;
};
/** Cambio de cintura con tolerancia ±0.5 cm (frontera en SAME). Redondea para no depender de coma flotante. */
export declare function classifyWaistChange(previousCm: number, currentCm: number): WaistChange;
/** Decide la acción adaptativa del ciclo. Puro; nunca lanza ni rellena datos ausentes. */
export declare function decideAdaptiveNutrition(input: AdaptiveDecisionInput): AdaptiveDecisionResult;
