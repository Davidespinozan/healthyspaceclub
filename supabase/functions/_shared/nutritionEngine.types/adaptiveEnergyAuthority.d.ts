// ════════════════════════════════════════════════════════════════════
// AUTO-GENERADO por scripts/build-nutrition-engine.mjs — NO EDITAR A MANO.
// Fuente única: src/utils/nutritionEngineEntry.ts (y su grafo de imports en src/utils).
// Regenerar: npm run build:nutrition-engine. Un test bloquea cualquier drift.
// ════════════════════════════════════════════════════════════════════
import { type CanonicalGoal } from './energyPrescription.d.ts';
import { type NutritionEnergyState, type EnergySnapshotVersions } from './nutritionEnergyState.d.ts';
import { type NutritionCalibration, type StoredAdaptiveCheckin } from './adaptiveCalibrationCore.d.ts';
export declare const NUTRITION_SNAPSHOT_VERSION = 2;
/** Primer domingo IGUAL O POSTERIOR (misma regla que `calibrationEffectiveFrom` del planificador). */
export declare function effectiveFromForCheckin(checkinDate: string): string | null;
export type StrengthRequirement = 'NOT_REQUIRED' | 'SATISFIED' | 'STRENGTH_REQUIRED';
/** Objetivos cuya calibración adaptativa EXIGE entrenamiento de fuerza declarado. */
export declare const STRENGTH_REQUIRED_OBJECTIVES: readonly CanonicalGoal[];
/**
 * ¿El objetivo exige fuerza y el perfil la DECLARA? Solo cuenta la modalidad explícita `strength`;
 * la clase MIXED (varias modalidades sin fuerza), «no entreno», un valor ilegible o la ausencia de
 * declaración NO bastan. Puro.
 */
export declare function strengthRequirement(objective: CanonicalGoal | null | undefined, obData: unknown): StrengthRequirement;
export type EffectiveStepResult = {
    ok: true;
    decidedStep: number;
    effectiveStep: number;
    /** Domingo desde el que rige `effectiveStep` (null = paso 0 de la apertura). */
    effectiveFrom: string | null;
    /** Paso ya decidido que aún NO rige (entra en vigor en `effectiveFrom`). */
    pending: {
        step: number;
        effectiveFrom: string;
        checkinId: string;
    } | null;
} | {
    ok: false;
    reason: 'INVALID_TODAY' | 'CHAIN_BROKEN' | 'CURRENT_STEP_MISMATCH' | 'FOREIGN_CHECKIN' | 'INVALID_CHECKIN_DATE';
};
/**
 * Paso que RIGE `today`. Recorre los check-ins de la calibración en orden de ciclo verificando la
 * cadena (cada uno parte del decidido anterior); un paso solo rige desde su domingo efectivo.
 */
export declare function deriveEffectiveStep(calibration: NutritionCalibration, checkins: readonly StoredAdaptiveCheckin[], today: string): EffectiveStepResult;
export type AdaptiveEnergyStatus = 'NO_CALIBRATION' | 'ADOPTED' | 'NOT_ADOPTED' | 'STRENGTH_REQUIRED' | 'UNAVAILABLE' | 'NO_ENERGY';
export type NotAdoptedReason = 'CALIBRATION_CLOSED' | 'UNSUPPORTED_CALIBRATION_VERSION' | 'BASE_NOT_FROZEN' | 'OBJECTIVE_CHANGED' | 'INVALID_STEP' | 'SAFETY_FLOOR_REACHED' | 'INVALID_BASE' | 'INVALID_TODAY' | 'CHAIN_BROKEN' | 'CURRENT_STEP_MISMATCH' | 'FOREIGN_CHECKIN' | 'INVALID_CHECKIN_DATE';
export interface NutritionSnapshotV2 {
    version: typeof NUTRITION_SNAPSHOT_VERSION;
    /** Fecha local evaluada ('YYYY-MM-DD'). */
    today: string;
    source: 'BASE' | 'CALIBRATED';
    status: AdaptiveEnergyStatus;
    notAdoptedReason: NotAdoptedReason | null;
    objective: CanonicalGoal | null;
    nutritionWeightKg: number | null;
    /** CAPA 1 del perfil ACTUAL (crudo y prescrito). */
    base: {
        rawEnergy: number | null;
        prescribedEnergy: number | null;
    };
    /** La energía que MANDA (kcal enteras) y su crudo. `null` sin prescripción. */
    effective: {
        rawEnergy: number | null;
        energy: number | null;
    };
    calibration: null | {
        id: string;
        version: number;
        objective: CanonicalGoal;
        /** Base congelada CRUDA de la calibración (no la de CAPA 1 actual). */
        frozenBaseRawEnergy: number | null;
        decidedStep: number | null;
        effectiveStep: number | null;
        effectiveFrom: string | null;
        pending: {
            step: number;
            effectiveFrom: string;
        } | null;
    };
    strength: StrengthRequirement;
    versions: {
        snapshot: number;
        energy: EnergySnapshotVersions;
        macros: number;
        calibration: number;
        calibrationEnergy: number;
        adaptiveDecision: number;
    };
}
export interface AdaptiveEnergyInput {
    /** Estado de CAPA 1 resuelto con el `obData` actual. */
    state: NutritionEnergyState | null;
    obData: unknown;
    /** Calibración ACTIVA leída de la base (o null). `undefined` = no se pudo leer. */
    calibration: NutritionCalibration | null | undefined;
    checkins: readonly StoredAdaptiveCheckin[];
    today: string;
}
/** Decide la energía que manda y arma el Snapshot V2. Puro; nunca lanza. */
export declare function resolveEffectiveNutritionEnergy(input: AdaptiveEnergyInput): NutritionSnapshotV2;
