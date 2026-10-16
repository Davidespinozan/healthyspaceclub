// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE NUTRITION · BLOQUE 5 · CAPA DE ENERGÍA CALIBRADA (pura)
//
//   ENERGÍA CALIBRADA = BASE CONGELADA × (1 + 0.05 × STEP),   STEP ∈ {−2, −1, 0, +1, +2}
//
// · BASE CONGELADA · el `rawPrescribedEnergy` de CAPA 1 (crudo, sin redondear) en el momento en que
//   se abrió la calibración. Todos los pasos se calculan SIEMPRE contra esa misma base y con el paso
//   ABSOLUTO vigente: nunca contra las kcal calibradas anteriores, el peso semanal ni el paso previo.
//   Así no hay compounding: base 2000 en +2 es 2000 × 1.10 = 2200, no 2100 × 1.05 = 2205.
// · STEP · lo decide MB3 (`decideAdaptiveNutrition`), que ya aplica el límite ±2
//   (CALIBRATION_LIMIT_REACHED) y el bloqueo de inversión tras un paso aplicado
//   (DIRECTION_REVERSAL_BLOCKED). Esta capa NO los duplica: solo respeta su resultado.
// · SAFETY FLOOR T1 · al bajar (step < 0), si la energía calibrada CRUDA es ≤ 1200 kcal no se adopta:
//   REVIEW · SAFETY_FLOOR_REACHED, y se conservan el paso y las kcal anteriores. Se evalúa sobre el
//   CRUDO, antes de redondear (misma regla y misma constante que el gate de CAPA 1).
// · REDONDEO · una sola vez, al final: `Math.round(raw calibrado)`. Con step 0 coincide exactamente
//   con `prescribedEnergy` de CAPA 1 (`Math.round(rawPrescribedEnergy)`). Nunca se encadenan
//   redondeos entre pasos: la base se guarda cruda.
// · ADOPCIÓN · una cifra calibrada solo es autoridad si el estado de calibración y su base congelada
//   CRUDA son verificables. No se infiere el paso desde diferencias de kcal ni se usa un kcal antiguo
//   (p. ej. el entero `base_energy_kcal`) como base.
//
// Puro / determinista / sin estado. Sin Supabase, store ni reloj. Todavía NO lo consume ningún camino
// productivo: conectarlo a la persistencia, a la Edge Function y a la energía autoritativa del store
// pertenece a bloques posteriores (y requiere schema: ver el reporte del Bloque 5).
// ─────────────────────────────────────────────────────────────────────────────
import { HSC_FAT_LOSS_SCOPE_MIN_ENERGY, CANONICAL_GOALS, type CanonicalGoal } from './energyPrescription';
import { CALIBRATION_STEP_MIN, CALIBRATION_STEP_MAX, type AdaptiveDecision, type AdaptiveReason } from './adaptiveNutritionDecision';
import { ENERGY_CALIBRATION_VERSION, type NutritionCalibration } from './adaptiveCalibrationCore';

/** Versión de la fórmula de energía calibrada. */
export const CALIBRATION_ENERGY_VERSION = 1;
/** Cada paso vale este porcentaje de la BASE congelada. */
export const CALIBRATION_STEP_PERCENT = 5;
/** Suelo de seguridad T1 al bajar: la misma cifra (y constante) que el gate de alcance de CAPA 1. */
export const CALIBRATION_SAFETY_FLOOR_KCAL = HSC_FAT_LOSS_SCOPE_MIN_ENERGY;

export type CalibrationEnergyReviewReason = 'INVALID_BASE' | 'STEP_OUT_OF_RANGE' | 'SAFETY_FLOOR_REACHED';

export type CalibratedEnergyResult =
  | { status: 'CALIBRATED'; baseRawEnergy: number; step: number; rawCalibratedEnergy: number; calibratedEnergy: number }
  | { status: 'REVIEW'; reason: CalibrationEnergyReviewReason; baseRawEnergy: number; step: number; rawCalibratedEnergy: number | null };

const isPositiveFinite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const isValidStep = (s: unknown): s is number =>
  typeof s === 'number' && Number.isInteger(s) && s >= CALIBRATION_STEP_MIN && s <= CALIBRATION_STEP_MAX;

/**
 * Energía calibrada CRUDA. Se calcula como `base × (100 + 5·step) / 100` (factores enteros) para que
 * una base entera dé un resultado exacto: 2000 → 1800 / 1900 / 2000 / 2100 / 2200, sin ruido de coma
 * flotante que pudiera mover el suelo de seguridad.
 */
export function rawCalibratedEnergy(baseRawEnergy: number, step: number): number {
  return (baseRawEnergy * (100 + CALIBRATION_STEP_PERCENT * step)) / 100;
}

/**
 * Energía calibrada para una base congelada y un paso ABSOLUTO. Puro; nunca lanza.
 *   · base no válida               → REVIEW · INVALID_BASE
 *   · paso fuera de −2…+2 / no entero → REVIEW · STEP_OUT_OF_RANGE (nada más allá de ±2 se adopta)
 *   · step < 0 y crudo ≤ 1200       → REVIEW · SAFETY_FLOOR_REACHED (sobre el CRUDO)
 *   · si no                         → CALIBRATED, `calibratedEnergy = Math.round(crudo)` (una vez)
 * Step 0 devuelve exactamente la base (y su redondeo = `prescribedEnergy` de CAPA 1); no se le aplica
 * el suelo T1: su seguridad es el gate de CAPA 1 que ya decidió que esa base se prescribe.
 */
export function calibratedEnergy(baseRawEnergy: number, step: number): CalibratedEnergyResult {
  if (!isPositiveFinite(baseRawEnergy)) return { status: 'REVIEW', reason: 'INVALID_BASE', baseRawEnergy, step, rawCalibratedEnergy: null };
  if (!isValidStep(step)) return { status: 'REVIEW', reason: 'STEP_OUT_OF_RANGE', baseRawEnergy, step, rawCalibratedEnergy: null };
  const raw = rawCalibratedEnergy(baseRawEnergy, step);
  if (step < 0 && raw <= CALIBRATION_SAFETY_FLOOR_KCAL) {
    return { status: 'REVIEW', reason: 'SAFETY_FLOOR_REACHED', baseRawEnergy, step, rawCalibratedEnergy: raw };
  }
  return { status: 'CALIBRATED', baseRawEnergy, step, rawCalibratedEnergy: raw, calibratedEnergy: Math.round(raw) };
}

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
export type CalibrationEnergyOutcome =
  | { kind: 'ADOPT'; action: 'STEP_UP' | 'STEP_DOWN'; reason: AdaptiveReason; previousStep: number; step: number;
      rawCalibratedEnergy: number; calibratedEnergy: number }
  | { kind: 'KEEP'; action: AdaptiveDecision['action']; reason: AdaptiveReason | 'SAFETY_FLOOR_REACHED'; step: number;
      calibratedEnergy: number; blocked: { action: 'STEP_DOWN'; reason: AdaptiveReason; rawCalibratedEnergy: number } | null }
  | { kind: 'UNVERIFIABLE'; reason: 'POSITION_INVALID' | 'STEP_MISMATCH' | 'DECISION_INCOHERENT' };

export function energyOutcomeForDecision(position: CalibrationEnergyPosition, decision: AdaptiveDecision): CalibrationEnergyOutcome {
  const current = calibratedEnergy(position.baseRawEnergy, position.step);
  if (current.status !== 'CALIBRATED') return { kind: 'UNVERIFIABLE', reason: 'POSITION_INVALID' };
  if (decision.currentStep !== position.step) return { kind: 'UNVERIFIABLE', reason: 'STEP_MISMATCH' };

  if (decision.action !== 'STEP_UP' && decision.action !== 'STEP_DOWN') {
    if (decision.proposedStep !== position.step) return { kind: 'UNVERIFIABLE', reason: 'DECISION_INCOHERENT' };
    return { kind: 'KEEP', action: decision.action, reason: decision.reason, step: position.step, calibratedEnergy: current.calibratedEnergy, blocked: null };
  }
  const expected = position.step + (decision.action === 'STEP_UP' ? 1 : -1);
  if (decision.proposedStep !== expected) return { kind: 'UNVERIFIABLE', reason: 'DECISION_INCOHERENT' };

  // Siempre desde la BASE y el paso ABSOLUTO propuesto: sin compounding.
  const next = calibratedEnergy(position.baseRawEnergy, decision.proposedStep);
  if (next.status === 'CALIBRATED') {
    return { kind: 'ADOPT', action: decision.action, reason: decision.reason, previousStep: position.step, step: next.step,
      rawCalibratedEnergy: next.rawCalibratedEnergy, calibratedEnergy: next.calibratedEnergy };
  }
  if (next.reason === 'SAFETY_FLOOR_REACHED') {
    return { kind: 'KEEP', action: 'REVIEW', reason: 'SAFETY_FLOOR_REACHED', step: position.step, calibratedEnergy: current.calibratedEnergy,
      blocked: { action: 'STEP_DOWN', reason: decision.reason, rawCalibratedEnergy: next.rawCalibratedEnergy! } };
  }
  // MB3 ya garantiza −2…+2; si aun así llega fuera de rango, no se adopta.
  return { kind: 'UNVERIFIABLE', reason: 'DECISION_INCOHERENT' };
}

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

export type CalibrationAdoption =
  | { adopted: true; objective: CanonicalGoal; baseRawEnergy: number; step: number; rawCalibratedEnergy: number; calibratedEnergy: number }
  | { adopted: false; reason: 'NO_ACTIVE_CALIBRATION' | 'UNSUPPORTED_CALIBRATION_VERSION' | 'BASE_NOT_FROZEN'
      | 'OBJECTIVE_CHANGED' | 'INVALID_STEP' | 'SAFETY_FLOOR_REACHED' | 'INVALID_BASE' };

/**
 * ¿Hay una energía calibrada adoptable? Solo si TODO se verifica; si algo falta, no se adopta y la
 * energía autoritativa sigue siendo la de CAPA 1, exactamente como antes del Bloque 5.
 */
export function resolveCalibratedEnergy(evidence: CalibrationEnergyEvidence): CalibrationAdoption {
  const cal = evidence.calibration;
  if (!cal || cal.status !== 'ACTIVE') return { adopted: false, reason: 'NO_ACTIVE_CALIBRATION' };
  if (cal.calibrationVersion !== ENERGY_CALIBRATION_VERSION) return { adopted: false, reason: 'UNSUPPORTED_CALIBRATION_VERSION' };
  if (evidence.frozenBaseRawEnergy == null) return { adopted: false, reason: 'BASE_NOT_FROZEN' };
  if (!evidence.currentObjective || !(CANONICAL_GOALS as readonly string[]).includes(evidence.currentObjective)
      || evidence.currentObjective !== cal.objective) return { adopted: false, reason: 'OBJECTIVE_CHANGED' };
  const r = calibratedEnergy(evidence.frozenBaseRawEnergy, cal.currentStep);
  if (r.status === 'REVIEW') {
    return { adopted: false, reason: r.reason === 'STEP_OUT_OF_RANGE' ? 'INVALID_STEP' : r.reason };
  }
  return { adopted: true, objective: cal.objective, baseRawEnergy: r.baseRawEnergy, step: r.step,
    rawCalibratedEnergy: r.rawCalibratedEnergy, calibratedEnergy: r.calibratedEnergy };
}
