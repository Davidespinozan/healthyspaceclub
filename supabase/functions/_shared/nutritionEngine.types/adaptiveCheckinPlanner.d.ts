// ════════════════════════════════════════════════════════════════════
// AUTO-GENERADO por scripts/build-nutrition-engine.mjs — NO EDITAR A MANO.
// Fuente única: src/utils/nutritionEngineEntry.ts (y su grafo de imports en src/utils).
// Regenerar: npm run build:nutrition-engine. Un test bloquea cualquier drift.
// ════════════════════════════════════════════════════════════════════
import { type CanonicalGoal } from './energyPrescription.d.ts';
import { type TrajectoryResult } from './nutritionTrajectory.d.ts';
import { type NutritionCheckin } from './nutritionCheckin.d.ts';
import { type AdaptiveDecision, type PreviousCheckinContext } from './adaptiveNutritionDecision.d.ts';
import { type NutritionCalibration, type StoredAdaptiveCheckin } from './adaptiveCalibrationCore.d.ts';
export declare const CYCLE_LENGTH_DAYS = 14;
/** Un check-in se acepta desde 1 día antes de su domingo (tolerancia de MB1)… */
export declare const CHECKIN_EARLY_DAYS = 1;
/** …hasta el sábado siguiente. */
export declare const CHECKIN_LATE_DAYS = 6;
/** Fecha local declarada vs fecha UTC del servidor (cubre todas las zonas horarias). */
export declare const DECLARED_DATE_TOLERANCE_DAYS = 1;
/** Campos que el cliente PUEDE enviar. Cualquier otro se rechaza: el servidor no acepta autoridad. */
export declare const START_REQUEST_FIELDS: readonly ["requestId", "localDate", "weightKg", "waistCm"];
export declare const CHECKIN_REQUEST_FIELDS: readonly ["requestId", "localDate", "weightKg", "waistCm", "adherenceAnswer", "hunger", "energy", "performance", "strengthExperience", "recentStrengthContinuity"];
export type PlannerRejectReason = 'INVALID_REQUEST' | 'UNEXPECTED_FIELDS' | 'INVALID_REQUEST_ID' | 'INVALID_DATE' | 'FUTURE_DATE' | 'DATE_OUT_OF_TOLERANCE' | 'NOT_ELIGIBLE' | 'OBJECTIVE_UNRESOLVED' | 'INVALID_WEIGHT' | 'INVALID_WAIST' | 'WAIST_REQUIRED' | 'NO_ACTIVE_CALIBRATION' | 'OBJECTIVE_CHANGED' | 'NOT_DUE' | 'DUPLICATE_CYCLE' | 'OUT_OF_ORDER' | 'CHECKIN_INVALID' | 'CHECKIN_INCOMPLETE' | 'ENGINE_INVALID';
export interface PlannerRejection {
    kind: 'REJECT';
    reason: PlannerRejectReason;
    fields?: string[];
}
/** Primer domingo IGUAL O POSTERIOR a una fecha 'YYYY-MM-DD' (un domingo se devuelve a sí mismo). */
export declare function firstSundayOnOrAfter(date: string): string | null;
/** Primer domingo en o después de la fecha de línea base. */
export declare function cycleStartFor(baselineDate: string): string | null;
/**
 * D-B5-SUNDAY · fecha en que ENTRA EN VIGOR el paso decidido en un check-in: el primer domingo IGUAL O
 * POSTERIOR a `checkin_date` (sábado → +1, domingo → ese mismo día, lunes → +6 … viernes → +2). El
 * domingo es la frontera de la semana nutricional: aplicarlo ese día no es un cambio a mitad de semana.
 * Se deriva de la fecha guardada del check-in; no requiere columna. Puro.
 */
export declare function calibrationEffectiveFrom(checkinDate: string): string | null;
/** Domingo en que vence el check-in n (n ≥ 1). */
export declare function cycleDueDate(cycleStart: string, n: number): string | null;
/** Ciclo al que corresponde una fecha, o null si cae fuera de toda ventana [vence − 1, vence + 6]. */
export declare function cycleIndexForDate(cycleStart: string, date: string): number | null;
/** Fecha local declarada aceptable respecto a la fecha UTC del servidor. */
export declare function acceptDeclaredDate(declared: unknown, serverUtcDate: string): {
    ok: true;
    date: string;
} | {
    ok: false;
    reason: 'INVALID_DATE' | 'FUTURE_DATE' | 'DATE_OUT_OF_TOLERANCE';
};
export declare const isRequestId: (v: unknown) => v is string;
export interface StartPlanInput {
    request: unknown;
    obData: unknown;
    /** `resolveNutritionEnergyState(obData).status`, resuelto por el caller. */
    energyStatus: string | null;
    active: NutritionCalibration | null;
    serverUtcDate: string;
}
export type StartPlan = PlannerRejection | {
    kind: 'ALREADY_ACTIVE';
    calibrationId: string;
} | {
    kind: 'START';
    requestId: string;
    objective: CanonicalGoal;
    baselineDate: string;
    cycleStart: string;
    baselineWeightKg: number;
    baselineWaistCm: number | null;
    calibrationVersion: number;
    /** Bloque 5 · base congelada CRUDA calculada en el servidor (CAPA 1 con el peso base). */
    baseEnergyRaw: number;
    /** La activa que se cierra por cambio de objetivo, si la hay. */
    closesCalibrationId: string | null;
};
/** Una calibración activa con el mismo objetivo NO se reinicia: solo un cambio de objetivo abre otra. */
export declare function planStartCalibration(input: StartPlanInput): StartPlan;
export interface CheckinPlanInput {
    request: unknown;
    obData: unknown;
    energyStatus: string | null;
    calibration: NutritionCalibration | null;
    /** Check-ins ya guardados de esa calibración (cualquier orden). */
    history: readonly StoredAdaptiveCheckin[];
    serverUtcDate: string;
}
/** Punto contra el que se mide la trayectoria: un check-in previo o la línea base. */
export interface ReferencePoint {
    kind: 'BASELINE' | 'CHECKIN';
    date: string;
    weightKg: number;
    waistCm: number | null;
    checkinId: string | null;
}
export type CheckinPlan = PlannerRejection | {
    kind: 'RECORD';
    requestId: string;
    calibrationId: string;
    expectedLastCheckinId: string | null;
    cycleIndex: number;
    reference: ReferencePoint;
    checkin: NutritionCheckin;
    trajectory: TrajectoryResult;
    decision: AdaptiveDecision;
    /** Fila a persistir (snake_case), exactamente la que produjo el servidor. */
    payload: Record<string, unknown>;
};
/** Sin lectura consecutiva: solo aporta la cintura de referencia. NO_ADJUSTMENT no bloquea reversión y sin clasificación nada se confirma. */
export declare function referenceOnlyContext(waistCm: number): PreviousCheckinContext;
/** Referencia de la trayectoria según el objetivo (ver cabecera). */
export declare function referencePointFor(objective: CanonicalGoal, calibration: NutritionCalibration, ordered: readonly StoredAdaptiveCheckin[]): ReferencePoint;
export declare function planCheckin(input: CheckinPlanInput): CheckinPlan;
