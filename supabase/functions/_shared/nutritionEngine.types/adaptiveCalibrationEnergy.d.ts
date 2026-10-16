// ════════════════════════════════════════════════════════════════════
// AUTO-GENERADO por scripts/build-nutrition-engine.mjs — NO EDITAR A MANO.
// Fuente única: src/utils/nutritionEngineEntry.ts (y su grafo de imports en src/utils).
// Regenerar: npm run build:nutrition-engine. Un test bloquea cualquier drift.
// ════════════════════════════════════════════════════════════════════
import { type CanonicalGoal } from './energyPrescription.d.ts';
import { type AdaptiveDecision, type AdaptiveReason } from './adaptiveNutritionDecision.d.ts';
import { type NutritionCalibration } from './adaptiveCalibrationCore.d.ts';
/** Versión de la fórmula de energía calibrada. */
export declare const CALIBRATION_ENERGY_VERSION = 1;
/** Cada paso vale este porcentaje de la BASE congelada. */
export declare const CALIBRATION_STEP_PERCENT = 5;
/** Suelo de seguridad T1 al bajar: la misma cifra (y constante) que el gate de alcance de CAPA 1. */
export declare const CALIBRATION_SAFETY_FLOOR_KCAL = 1200;
export type CalibrationEnergyReviewReason = 'INVALID_BASE' | 'STEP_OUT_OF_RANGE' | 'SAFETY_FLOOR_REACHED';
export type CalibratedEnergyResult = {
    status: 'CALIBRATED';
    baseRawEnergy: number;
    step: number;
    rawCalibratedEnergy: number;
    calibratedEnergy: number;
} | {
    status: 'REVIEW';
    reason: CalibrationEnergyReviewReason;
    baseRawEnergy: number;
    step: number;
    rawCalibratedEnergy: number | null;
};
/**
 * Energía calibrada CRUDA. Se calcula como `base × (100 + 5·step) / 100` (factores enteros) para que
 * una base entera dé un resultado exacto: 2000 → 1800 / 1900 / 2000 / 2100 / 2200, sin ruido de coma
 * flotante que pudiera mover el suelo de seguridad.
 */
export declare function rawCalibratedEnergy(baseRawEnergy: number, step: number): number;
/**
 * Energía calibrada para una base congelada y un paso ABSOLUTO. Puro; nunca lanza.
 *   · base no válida               → REVIEW · INVALID_BASE
 *   · paso fuera de −2…+2 / no entero → REVIEW · STEP_OUT_OF_RANGE (nada más allá de ±2 se adopta)
 *   · step < 0 y crudo ≤ 1200       → REVIEW · SAFETY_FLOOR_REACHED (sobre el CRUDO)
 *   · si no                         → CALIBRATED, `calibratedEnergy = Math.round(crudo)` (una vez)
 * Step 0 devuelve exactamente la base (y su redondeo = `prescribedEnergy` de CAPA 1); no se le aplica
 * el suelo T1: su seguridad es el gate de CAPA 1 que ya decidió que esa base se prescribe.
 */
export declare function calibratedEnergy(baseRawEnergy: number, step: number): CalibratedEnergyResult;
/** Estado energético vigente de una calibración: base congelada + paso aplicado. */
export interface CalibrationEnergyPosition {
    baseRawEnergy: number;
    step: number;
}
/**
 * Qué hace la capa de energía con una decisión de MB3. NUNCA cambia la acción de MB3 salvo para
 * bloquear una bajada que cruzaría el suelo de seguridad.
 *   · ADOPT · MB3 aplicó STEP_UP / STEP_DOWN y la energía del nuevo paso es válida.
 *   · KEEP  · cualquier otra acción (MAINTAIN, NO_ADJUSTMENT, REVIEW de MB3) o un paso bloqueado por el
 *             suelo: se conservan el paso y la energía ANTERIORES, sin aplicar nada parcialmente.
 *   · UNVERIFIABLE · la posición o la decisión no cuadran (p. ej. MB3 decidió sobre otro paso): no se
 *             adopta nada.
 */
export type CalibrationEnergyOutcome = {
    kind: 'ADOPT';
    action: 'STEP_UP' | 'STEP_DOWN';
    reason: AdaptiveReason;
    previousStep: number;
    step: number;
    rawCalibratedEnergy: number;
    calibratedEnergy: number;
} | {
    kind: 'KEEP';
    action: AdaptiveDecision['action'];
    reason: AdaptiveReason | 'SAFETY_FLOOR_REACHED';
    step: number;
    calibratedEnergy: number;
    blocked: {
        action: 'STEP_DOWN';
        reason: AdaptiveReason;
        rawCalibratedEnergy: number;
    } | null;
} | {
    kind: 'UNVERIFIABLE';
    reason: 'POSITION_INVALID' | 'STEP_MISMATCH' | 'DECISION_INCOHERENT';
};
export declare function energyOutcomeForDecision(position: CalibrationEnergyPosition, decision: AdaptiveDecision): CalibrationEnergyOutcome;
/**
 * EVIDENCIA para adoptar una energía calibrada como autoridad. La base congelada CRUDA debe venir de
 * una fuente que la registró al abrir la calibración; NO se reconstruye desde `baseEnergyKcal` (entero
 * redondeado), desde kcal antiguas ni desde diferencias de kcal.
 */
export interface CalibrationEnergyEvidence {
    calibration: NutritionCalibration | null;
    /** Base congelada CRUDA registrada al abrir ESTA calibración; `null` si no existe registro. */
    frozenBaseRawEnergy: number | null;
    /** Objetivo canónico VIGENTE del perfil (autoridad de CAPA 1). */
    currentObjective: CanonicalGoal | null;
}
export type CalibrationAdoption = {
    adopted: true;
    objective: CanonicalGoal;
    baseRawEnergy: number;
    step: number;
    rawCalibratedEnergy: number;
    calibratedEnergy: number;
} | {
    adopted: false;
    reason: 'NO_ACTIVE_CALIBRATION' | 'UNSUPPORTED_CALIBRATION_VERSION' | 'BASE_NOT_FROZEN' | 'OBJECTIVE_CHANGED' | 'INVALID_STEP' | 'SAFETY_FLOOR_REACHED' | 'INVALID_BASE';
};
/**
 * ¿Hay una energía calibrada adoptable? Solo si TODO se verifica; si algo falta, no se adopta y la
 * energía autoritativa sigue siendo la de CAPA 1, exactamente como antes del Bloque 5.
 */
export declare function resolveCalibratedEnergy(evidence: CalibrationEnergyEvidence): CalibrationAdoption;
