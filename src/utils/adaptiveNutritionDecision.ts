// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE NUTRITION · MICROBLOQUE 3 · ADAPTIVE DECISION ENGINE
//
// Decide qué hacer con la calibración energética en un check-in, a partir de:
//   · la evaluación de trayectoria (Microbloque 1, `assessTrajectory`)
//   · el check-in validado (Microbloque 2, `validateNutritionCheckin`)
//   · el paso de calibración vigente y el contexto del check-in anterior,
//     ya reconstruidos por el caller
//
//   1. entrada inválida o contradictoria ──▶ INVALID_INPUT
//   2. trayectoria insuficiente ───────────▶ NO_ADJUSTMENT
//   3. adherencia declarada ≠ HIGH ────────▶ NO_ADJUSTMENT
//   4. reglas del objetivo ────────────────▶ MAINTAIN / STEP_UP / STEP_DOWN / REVIEW / NO_ADJUSTMENT
//   5. anti-oscilación (solo sobre pasos) ─▶ REVIEW si el paso no se puede aplicar
//
// Devuelve una DECISIÓN DE DOMINIO en pasos enteros (−2…+2), NO kcal: el
// tamaño del paso (5 % de la energía base) lo aplicará una capa posterior.
//
// Puro / determinista / sin estado. No conoce React, ni el store, ni Supabase,
// ni Training, ni los logs de comida. Las señales son SOLO las que el socio
// declaró en el check-in (adherencia, hambre, energía, rendimiento, cintura).
// ─────────────────────────────────────────────────────────────────────────────
import { CANONICAL_GOALS, type CanonicalGoal } from './energyPrescription';
import type { TrajectoryClassification, TrajectoryResult } from './nutritionTrajectory';
import {
  NUTRITION_ENERGY_VALUES,
  NUTRITION_HUNGER_VALUES,
  NUTRITION_PERFORMANCE_VALUES,
  type NutritionCheckin,
  type NutritionCheckinValidation,
  type NutritionEnergy,
  type NutritionHunger,
  type NutritionPerformance,
} from './nutritionCheckin';

export const ADAPTIVE_DECISION_VERSION = 1;

/** Rango de calibración en pasos enteros. Cada paso equivaldrá a 5 % de la energía base. */
export const CALIBRATION_STEP_MIN = -2;
export const CALIBRATION_STEP_MAX = 2;

/** Cintura: |Δ| ≤ 0.5 cm es SAME (frontera incluida). Solo absorbe el ruido de la cinta. */
export const WAIST_SAME_TOLERANCE_CM = 0.5;

// ── Tipos ───────────────────────────────────────────────────────────────────
export type AdaptiveAction = 'MAINTAIN' | 'STEP_UP' | 'STEP_DOWN' | 'REVIEW' | 'NO_ADJUSTMENT';
export const ADAPTIVE_ACTIONS: readonly AdaptiveAction[] = ['MAINTAIN', 'STEP_UP', 'STEP_DOWN', 'REVIEW', 'NO_ADJUSTMENT'];

export type AdaptiveReason =
  // generales
  | 'INSUFFICIENT_WINDOW' | 'INSUFFICIENT_DATA' | 'ADHERENCE_NOT_HIGH'
  // pérdida de grasa
  | 'VERY_SLOW' | 'BORDERLINE_SLOW_FIRST' | 'BORDERLINE_SLOW_CONFIRMED' | 'ON_TARGET'
  | 'DEFICIT_SYMPTOMS' | 'FAST_FIRST' | 'FAST_CONFIRMED' | 'FAST_WITH_SYMPTOMS'
  // ganancia muscular
  | 'BELOW_TARGET' | 'ABOVE_TARGET'
  // mantenimiento
  | 'WITHIN_MAINTENANCE_BAND' | 'BELOW_MAINTENANCE_BAND' | 'ABOVE_MAINTENANCE_BAND' | 'NEGATIVE_SIGNALS'
  // señales compartidas
  | 'CONTRADICTORY_SIGNALS' | 'PERFORMANCE_IMPROVING' | 'PERFORMANCE_WORSE' | 'NO_TRAINING_SIGNAL'
  | 'WAIST_IMPROVING' | 'WAIST_WORSENING' | 'NO_CLEAR_PROGRESS'
  // anti-oscilación
  | 'DIRECTION_REVERSAL_BLOCKED' | 'CALIBRATION_LIMIT_REACHED';

export type AdaptiveInvalidReason =
  | 'UNKNOWN_OBJECTIVE'
  | 'INVALID_STEP'              // currentStep no entero o fuera de −2…+2
  | 'INVALID_CYCLE_INDEX'       // no entero ≥ 1
  | 'CHECKIN_NOT_VALID'         // el check-in no es VALID (INVALID o INCOMPLETE)
  | 'TRAJECTORY_INVALID'        // la trayectoria es INVALID_INPUT
  | 'OBJECTIVE_MISMATCH'        // objetivo distinto entre input / trayectoria / check-in
  | 'CYCLE_MISMATCH'            // el check-in trae otro número de ciclo
  | 'WEIGHT_MISMATCH'           // el peso actual de la trayectoria ≠ el del check-in
  | 'INVALID_PREVIOUS_CONTEXT'; // el contexto previo viene, pero mal formado

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
  blocked: { action: 'STEP_UP' | 'STEP_DOWN'; reason: AdaptiveReason } | null;
}

export type AdaptiveDecisionResult =
  | { status: 'INVALID_INPUT'; reason: AdaptiveInvalidReason }
  | { status: 'DECIDED'; decision: AdaptiveDecision };

// ── Helpers ─────────────────────────────────────────────────────────────────
const isAbsent = (v: unknown) => v === null || v === undefined;
const isPositiveFinite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
function isOneOf<T extends string>(v: unknown, list: readonly T[]): v is T {
  return typeof v === 'string' && (list as readonly string[]).includes(v);
}

/** Cambio de cintura con tolerancia ±0.5 cm (frontera en SAME). Redondea para no depender de coma flotante. */
export function classifyWaistChange(previousCm: number, currentCm: number): WaistChange {
  const delta = Math.round((currentCm - previousCm) * 1e6) / 1e6;
  return delta < -WAIST_SAME_TOLERANCE_CM ? 'LOWER' : delta > WAIST_SAME_TOLERANCE_CM ? 'HIGHER' : 'SAME';
}

type Signals = { hunger: NutritionHunger; energy: NutritionEnergy; performance: NutritionPerformance };
/** Hambre alta, energía baja o rendimiento peor. */
const hasNegativeSignals = (s: Signals) => s.hunger === 'HIGH' || s.energy === 'LOW' || s.performance === 'WORSE';

const isAppliedStep = (a: AdaptiveAction) => a === 'STEP_UP' || a === 'STEP_DOWN';

function isValidPrevious(p: unknown): p is PreviousCheckinContext {
  if (typeof p !== 'object' || p === null) return false;
  const c = p as Record<string, unknown>;
  const cls = c.classification as { objective?: unknown } | null | undefined;
  return isOneOf(c.action, ADAPTIVE_ACTIONS)
    && (cls === null || (typeof cls === 'object' && cls !== undefined && isOneOf(cls.objective, CANONICAL_GOALS)))
    && isOneOf(c.hunger, NUTRITION_HUNGER_VALUES)
    && isOneOf(c.energy, NUTRITION_ENERGY_VALUES)
    && isOneOf(c.performance, NUTRITION_PERFORMANCE_VALUES)
    && (c.waistCm === null || isPositiveFinite(c.waistCm));
}

/**
 * Lectura previa del MISMO tipo que todavía no consumió un paso: es lo que hace
 * «consecutiva» a la actual. Tras un paso APLICADO el conteo se reinicia y la
 * siguiente lectura vuelve a ser la primera.
 */
function previousFatLossRate(prev: PreviousCheckinContext | null) {
  if (prev == null || isAppliedStep(prev.action)) return null;
  return prev.classification?.objective === 'FAT_LOSS' ? prev.classification.rate : null;
}

type Rule = { action: AdaptiveAction; reason: AdaptiveReason };
const rule = (action: AdaptiveAction, reason: AdaptiveReason): Rule => ({ action, reason });

// ── Reglas por objetivo (adherencia HIGH y trayectoria suficiente) ──────────
function fatLoss(cls: Extract<TrajectoryClassification, { objective: 'FAT_LOSS' }>, c: NutritionCheckin, prev: PreviousCheckinContext | null): Rule {
  const symptoms = hasNegativeSignals(c);
  const prevRate = previousFatLossRate(prev);
  switch (cls.rate) {
    case 'VERY_SLOW':
      // las señales contradicen un recorte adicional
      return symptoms ? rule('REVIEW', 'CONTRADICTORY_SIGNALS') : rule('STEP_DOWN', 'VERY_SLOW');
    case 'BORDERLINE_SLOW':
      if (prevRate === 'BORDERLINE_SLOW') {
        return symptoms || hasNegativeSignals(prev!) ? rule('REVIEW', 'CONTRADICTORY_SIGNALS') : rule('STEP_DOWN', 'BORDERLINE_SLOW_CONFIRMED');
      }
      return symptoms ? rule('REVIEW', 'CONTRADICTORY_SIGNALS') : rule('MAINTAIN', 'BORDERLINE_SLOW_FIRST');
    case 'ON_TARGET':
      // suavizar el déficit si el ritmo es correcto pero hay síntomas
      return symptoms ? rule('STEP_UP', 'DEFICIT_SYMPTOMS') : rule('MAINTAIN', 'ON_TARGET');
    case 'FAST':
      if (symptoms) return rule('STEP_UP', 'FAST_WITH_SYMPTOMS');
      return prevRate === 'FAST' ? rule('STEP_UP', 'FAST_CONFIRMED') : rule('MAINTAIN', 'FAST_FIRST');
  }
}

function muscleGain(cls: Extract<TrajectoryClassification, { objective: 'MUSCLE_GAIN' }>, c: NutritionCheckin, prev: PreviousCheckinContext | null): Rule {
  const p = c.performance;
  switch (cls.rate) {
    case 'BELOW_TARGET':
      if (p === 'NOT_APPLICABLE') return rule('REVIEW', 'NO_TRAINING_SIGNAL');
      // con rendimiento mejorando puede haber progreso muscular aunque el peso vaya bajo
      return p === 'BETTER' ? rule('MAINTAIN', 'PERFORMANCE_IMPROVING') : rule('STEP_UP', 'BELOW_TARGET');
    case 'ON_TARGET': {
      if (p === 'NOT_APPLICABLE') return rule('REVIEW', 'NO_TRAINING_SIGNAL');
      if (p === 'WORSE') return rule('REVIEW', 'PERFORMANCE_WORSE');
      // la cintura solo cuenta si hay dos medidas que comparar; una subida es REVIEW, nunca un recorte
      const prevWaist = prev?.waistCm ?? null;
      if (prevWaist != null && c.waistCm != null && classifyWaistChange(prevWaist, c.waistCm) === 'HIGHER') {
        return rule('REVIEW', 'WAIST_WORSENING');
      }
      return rule('MAINTAIN', 'ON_TARGET');
    }
    case 'ABOVE_TARGET':
      // la velocidad de aumento por encima del rango basta, con o sin señal de rendimiento
      return rule('STEP_DOWN', 'ABOVE_TARGET');
  }
}

function recomposition(cls: Extract<TrajectoryClassification, { objective: 'RECOMPOSITION' }>, c: NutritionCheckin, prev: PreviousCheckinContext | null): Rule {
  const prevWaist = prev?.waistCm ?? null;
  // sin cintura previa no hay delta: falta historia, no es una revisión
  if (prevWaist == null || c.waistCm == null) return rule('NO_ADJUSTMENT', 'INSUFFICIENT_DATA');
  const p = c.performance;
  if (p === 'NOT_APPLICABLE') return rule('REVIEW', 'NO_TRAINING_SIGNAL');
  const waist = classifyWaistChange(prevWaist, c.waistCm);
  const holding = p === 'SAME' || p === 'BETTER';

  switch (cls.weight) {
    case 'RELATIVELY_STABLE':
      // la caída de rendimiento impide recortar aunque la cintura haya subido
      if (p === 'WORSE') return rule('REVIEW', 'PERFORMANCE_WORSE');
      if (waist === 'LOWER') return rule('MAINTAIN', 'WAIST_IMPROVING');
      if (waist === 'SAME') return p === 'BETTER' ? rule('MAINTAIN', 'PERFORMANCE_IMPROVING') : rule('REVIEW', 'NO_CLEAR_PROGRESS');
      return p === 'SAME' ? rule('STEP_DOWN', 'WAIST_WORSENING') : rule('REVIEW', 'CONTRADICTORY_SIGNALS');
    case 'DOWN':
      if (p === 'WORSE') return rule('STEP_UP', 'PERFORMANCE_WORSE');
      if (waist === 'LOWER' && holding) return rule('MAINTAIN', 'WAIST_IMPROVING');
      return rule('REVIEW', 'CONTRADICTORY_SIGNALS');
    case 'UP':
      if (waist === 'HIGHER') return p === 'WORSE' ? rule('REVIEW', 'PERFORMANCE_WORSE') : rule('STEP_DOWN', 'WAIST_WORSENING');
      if (p === 'BETTER') return rule('MAINTAIN', 'PERFORMANCE_IMPROVING');
      return rule('REVIEW', 'CONTRADICTORY_SIGNALS');
  }
}

function maintenance(cls: Extract<TrajectoryClassification, { objective: 'MAINTENANCE' }>, c: NutritionCheckin): Rule {
  switch (cls.band) {
    case 'WITHIN_MAINTENANCE_BAND':
      // en mantenimiento los síntomas solos no mueven kcal
      return hasNegativeSignals(c) ? rule('REVIEW', 'NEGATIVE_SIGNALS') : rule('MAINTAIN', 'WITHIN_MAINTENANCE_BAND');
    case 'BELOW_MAINTENANCE_BAND':
      return rule('STEP_UP', 'BELOW_MAINTENANCE_BAND');
    case 'ABOVE_MAINTENANCE_BAND':
      return rule('STEP_DOWN', 'ABOVE_MAINTENANCE_BAND');
  }
}

function objectiveRule(cls: TrajectoryClassification, c: NutritionCheckin, prev: PreviousCheckinContext | null): Rule {
  switch (cls.objective) {
    case 'FAT_LOSS': return fatLoss(cls, c, prev);
    case 'MUSCLE_GAIN': return muscleGain(cls, c, prev);
    case 'RECOMPOSITION': return recomposition(cls, c, prev);
    case 'MAINTENANCE': return maintenance(cls, c);
  }
}

// ── API pública ─────────────────────────────────────────────────────────────
/** Decide la acción adaptativa del ciclo. Puro; nunca lanza ni rellena datos ausentes. */
export function decideAdaptiveNutrition(input: AdaptiveDecisionInput): AdaptiveDecisionResult {
  const { objective, trajectory, checkin, currentStep, cycleIndex, previous } = input;
  const invalid = (reason: AdaptiveInvalidReason): AdaptiveDecisionResult => ({ status: 'INVALID_INPUT', reason });

  // 1 · entrada inválida o contradictoria
  if (!isOneOf(objective, CANONICAL_GOALS)) return invalid('UNKNOWN_OBJECTIVE');
  if (!Number.isInteger(currentStep) || currentStep < CALIBRATION_STEP_MIN || currentStep > CALIBRATION_STEP_MAX) return invalid('INVALID_STEP');
  if (!Number.isInteger(cycleIndex) || cycleIndex < 1) return invalid('INVALID_CYCLE_INDEX');
  if (checkin?.status !== 'VALID') return invalid('CHECKIN_NOT_VALID');
  if (trajectory?.status !== 'ASSESSED') return invalid('TRAJECTORY_INVALID');
  const c = checkin.checkin;
  if (trajectory.objective !== objective || c.objective !== objective) return invalid('OBJECTIVE_MISMATCH');
  if (c.cycleNumber != null && c.cycleNumber !== cycleIndex) return invalid('CYCLE_MISMATCH');
  if (trajectory.metrics != null && trajectory.metrics.currentWeightKg !== c.weightKg) return invalid('WEIGHT_MISMATCH');
  if (!isAbsent(previous) && !isValidPrevious(previous)) return invalid('INVALID_PREVIOUS_CONTEXT');
  const prev = previous ?? null;

  const decided = (r: Rule, blocked: AdaptiveDecision['blocked'] = null): AdaptiveDecisionResult => ({
    status: 'DECIDED',
    decision: {
      action: r.action, reason: r.reason, objective, cycleIndex, currentStep,
      proposedStep: currentStep + (r.action === 'STEP_UP' ? 1 : r.action === 'STEP_DOWN' ? -1 : 0),
      blocked,
    },
  });

  // 2 · trayectoria insuficiente
  if (trajectory.sufficiency !== 'SUFFICIENT_FOR_DECISION') {
    return decided(rule('NO_ADJUSTMENT', trajectory.sufficiency === 'INSUFFICIENT_WINDOW' ? 'INSUFFICIENT_WINDOW' : 'INSUFFICIENT_DATA'));
  }

  // 3 · adherencia declarada
  if (c.adherence.band !== 'HIGH') return decided(rule('NO_ADJUSTMENT', 'ADHERENCE_NOT_HIGH'));

  // 4 · reglas del objetivo
  const r = objectiveRule(trajectory.classification, c, prev);
  if (r.action !== 'STEP_UP' && r.action !== 'STEP_DOWN') return decided(r);

  // 5 · anti-oscilación: límite ±2 primero; luego no invertir tras un paso aplicado
  const next = currentStep + (r.action === 'STEP_UP' ? 1 : -1);
  if (next > CALIBRATION_STEP_MAX || next < CALIBRATION_STEP_MIN) {
    return decided(rule('REVIEW', 'CALIBRATION_LIMIT_REACHED'), { action: r.action, reason: r.reason });
  }
  const opposite = r.action === 'STEP_UP' ? 'STEP_DOWN' : 'STEP_UP';
  if (prev?.action === opposite) {
    return decided(rule('REVIEW', 'DIRECTION_REVERSAL_BLOCKED'), { action: r.action, reason: r.reason });
  }
  return decided(r);
}
