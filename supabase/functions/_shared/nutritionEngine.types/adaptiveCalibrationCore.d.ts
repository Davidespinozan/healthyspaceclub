// ════════════════════════════════════════════════════════════════════
// AUTO-GENERADO por scripts/build-nutrition-engine.mjs — NO EDITAR A MANO.
// Fuente única: src/utils/nutritionEngineEntry.ts (y su grafo de imports en src/utils).
// Regenerar: npm run build:nutrition-engine. Un test bloquea cualquier drift.
// ════════════════════════════════════════════════════════════════════
import { type CanonicalGoal } from './energyPrescription.d.ts';
import { type TrajectoryResult, type WeightDirection } from './nutritionTrajectory.d.ts';
import { type AdherenceAnswer, type AdherenceBand, type NutritionCheckin, type NutritionEnergy, type NutritionHunger, type NutritionPerformance, type RecentStrengthContinuity, type StrengthExperience } from './nutritionCheckin.d.ts';
import { type AdaptiveAction, type AdaptiveDecision, type AdaptiveReason, type PreviousCheckinContext, type WaistChange } from './adaptiveNutritionDecision.d.ts';
/**
 * Versión del modelo de calibración persistido (`calibration_version`).
 * v2 (Bloque 2): línea base con fecha propia, `cycle_start` alineado a domingo y
 * escritura solo server-side. Las filas v1 nunca llegaron a existir en producción.
 */
export declare const ENERGY_CALIBRATION_VERSION = 2;
export declare const ADAPTIVE_REASONS: AdaptiveReason[];
/** Valores de clasificación por objetivo, tal como se guardan en `trajectory_classification`. */
export declare const TRAJECTORY_CLASSIFICATION_VALUES: Readonly<Record<CanonicalGoal, readonly string[]>>;
export declare const TRAJECTORY_SUFFICIENCY_VALUES: readonly ["SUFFICIENT_FOR_DECISION", "INSUFFICIENT_WINDOW", "INSUFFICIENT_DATA"];
export declare const WEIGHT_DIRECTION_VALUES: readonly WeightDirection[];
export declare const WAIST_CHANGE_VALUES: readonly WaistChange[];
export interface NutritionCalibration {
    id: string;
    objective: CanonicalGoal;
    status: 'ACTIVE' | 'CLOSED';
    /** Fecha local de la línea base (inicio real). */
    baselineDate: string;
    /** Primer domingo en o después de la línea base; el check-in n vence en cycleStart + 14·n. */
    cycleStart: string;
    baselineWeightKg: number;
    baselineWaistCm: number | null;
    currentStep: number;
    /** Sin autoridad (entero redondeado, no se escribe). La base de los pasos es `baseEnergyRaw`. */
    baseEnergyKcal: number | null;
    /**
     * Bloque 5 · base de energía CONGELADA y CRUDA (`rawPrescribedEnergy` de CAPA 1) que el servidor
     * registró al abrir la calibración (`base_energy_raw`). Única base de los pasos adaptativos.
     * `null` = la fila no la trae: esa calibración NO es adoptable ni puede registrar check-ins.
     */
    baseEnergyRaw: number | null;
    lastCheckinId: string | null;
    lastAppliedAction: 'STEP_UP' | 'STEP_DOWN' | null;
    lastAppliedAt: string | null;
    calibrationVersion: number;
    createdAt: string;
    closedAt: string | null;
}
export interface StoredTrajectory {
    sufficiency: (typeof TRAJECTORY_SUFFICIENCY_VALUES)[number];
    previousWeightKg: number | null;
    elapsedDays: number | null;
    absoluteChangeKg: number | null;
    percentChange: number | null;
    percentChangePerWeek: number | null;
    kgPerMonth: number | null;
    direction: WeightDirection | null;
    classification: string | null;
}
export interface StoredAdaptiveCheckin {
    id: string;
    calibrationId: string;
    cycleIndex: number;
    checkinDate: string;
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
    trajectory: StoredTrajectory;
    previousWaistCm: number | null;
    waistDirection: WaistChange | null;
    action: AdaptiveAction;
    reason: AdaptiveReason;
    previousStep: number;
    proposedStep: number;
    blocked: {
        action: 'STEP_UP' | 'STEP_DOWN';
        reason: AdaptiveReason;
    } | null;
    versions: {
        trajectory: number;
        checkinDomain: number;
        adaptiveDecision: number;
    };
    createdAt: string;
}
export interface CheckinRecordInput {
    cycleIndex: number;
    checkin: NutritionCheckin;
    trajectory: TrajectoryResult;
    decision: AdaptiveDecision;
    /** Cintura con la que se comparó (check-in anterior o línea base), si la hubo. */
    previousWaistCm: number | null;
}
export type CheckinRecordError = 'TRAJECTORY_NOT_ASSESSED' | 'OBJECTIVE_MISMATCH' | 'CYCLE_MISMATCH' | 'WEIGHT_MISMATCH';
/**
 * Arma el payload snake_case de `nutrition_record_checkin` a partir de lo que
 * MB1–MB3 ya produjeron. Puro. No incluye id, user_id ni calibration_id: esos
 * los pone el servidor.
 */
export declare function buildCheckinRecord(input: CheckinRecordInput): {
    ok: true;
    payload: Record<string, unknown>;
} | {
    ok: false;
    error: CheckinRecordError;
};
/** Fila de `nutrition_adaptive_checkins` → dominio. `null` si algún valor no es reconocible. */
export declare function checkinFromRow(row: Record<string, unknown>): StoredAdaptiveCheckin | null;
/** Fila de `nutrition_calibrations` → dominio. `null` si no es reconocible. */
export declare function calibrationFromRow(row: Record<string, unknown>): NutritionCalibration | null;
/**
 * Reconstruye, desde un check-in guardado, el contexto previo que MB3 consume.
 * La clasificación se rehace con las métricas CONGELADAS de la fila; el rango de
 * MUSCLE_GAIN es el de la versión de trayectoria vigente.
 */
export declare function previousContextFromCheckin(s: StoredAdaptiveCheckin): PreviousCheckinContext;
