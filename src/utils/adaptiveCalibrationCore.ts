// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE NUTRITION · núcleo PURO de la calibración persistida
//
// Mapeo dominio ↔ fila de:
//   nutrition_calibrations       · periodo de calibración; la fila ACTIVE es el estado vigente
//   nutrition_adaptive_checkins  · check-ins procesados, append-only
// y reconstrucción del contexto previo que consume MB3.
//
// Puro: sin cliente Supabase, sin store, sin reloj. Forma parte del motor compartido
// (nutritionEngineEntry → bundle de Edge Functions): la Edge Function `nutrition-checkin`
// arma con él la fila que persiste, y el cliente lo usa para leer. Una sola definición.
// ─────────────────────────────────────────────────────────────────────────────
import { CANONICAL_GOALS, type CanonicalGoal } from './energyPrescription';
import {
  TRAJECTORY_ENGINE_VERSION,
  MUSCLE_GAIN_TARGET_KG_PER_MONTH,
  type TrajectoryClassification,
  type TrajectoryResult,
  type WeightDirection,
} from './nutritionTrajectory';
import {
  NUTRITION_CHECKIN_VERSION,
  ADHERENCE_ANSWERS,
  NUTRITION_HUNGER_VALUES,
  NUTRITION_ENERGY_VALUES,
  NUTRITION_PERFORMANCE_VALUES,
  STRENGTH_EXPERIENCE_VALUES,
  RECENT_STRENGTH_CONTINUITY_VALUES,
  type AdherenceAnswer,
  type AdherenceBand,
  type NutritionCheckin,
  type NutritionEnergy,
  type NutritionHunger,
  type NutritionPerformance,
  type RecentStrengthContinuity,
  type StrengthExperience,
} from './nutritionCheckin';
import {
  ADAPTIVE_DECISION_VERSION,
  ADAPTIVE_ACTIONS,
  CALIBRATION_STEP_MAX,
  CALIBRATION_STEP_MIN,
  classifyWaistChange,
  type AdaptiveAction,
  type AdaptiveDecision,
  type AdaptiveReason,
  type PreviousCheckinContext,
  type WaistChange,
} from './adaptiveNutritionDecision';

/**
 * Versión del modelo de calibración persistido (`calibration_version`).
 * v2 (Bloque 2): línea base con fecha propia, `cycle_start` alineado a domingo y
 * escritura solo server-side. Las filas v1 nunca llegaron a existir en producción.
 */
export const ENERGY_CALIBRATION_VERSION = 2;

// Lista exhaustiva derivada del TIPO: si MB3 añade un reason, esto no compila.
const REASON_SET: Record<AdaptiveReason, true> = {
  INSUFFICIENT_WINDOW: true, INSUFFICIENT_DATA: true, ADHERENCE_NOT_HIGH: true,
  VERY_SLOW: true, BORDERLINE_SLOW_FIRST: true, BORDERLINE_SLOW_CONFIRMED: true, ON_TARGET: true,
  DEFICIT_SYMPTOMS: true, FAST_FIRST: true, FAST_CONFIRMED: true, FAST_WITH_SYMPTOMS: true,
  BELOW_TARGET: true, ABOVE_TARGET: true,
  WITHIN_MAINTENANCE_BAND: true, BELOW_MAINTENANCE_BAND: true, ABOVE_MAINTENANCE_BAND: true, NEGATIVE_SIGNALS: true,
  CONTRADICTORY_SIGNALS: true, PERFORMANCE_IMPROVING: true, PERFORMANCE_WORSE: true, NO_TRAINING_SIGNAL: true,
  WAIST_IMPROVING: true, WAIST_WORSENING: true, NO_CLEAR_PROGRESS: true,
  DIRECTION_REVERSAL_BLOCKED: true, CALIBRATION_LIMIT_REACHED: true,
};
export const ADAPTIVE_REASONS = Object.keys(REASON_SET) as AdaptiveReason[];

/** Valores de clasificación por objetivo, tal como se guardan en `trajectory_classification`. */
export const TRAJECTORY_CLASSIFICATION_VALUES: Readonly<Record<CanonicalGoal, readonly string[]>> = {
  FAT_LOSS: ['VERY_SLOW', 'BORDERLINE_SLOW', 'ON_TARGET', 'FAST'],
  MUSCLE_GAIN: ['BELOW_TARGET', 'ON_TARGET', 'ABOVE_TARGET'],
  RECOMPOSITION: ['DOWN', 'RELATIVELY_STABLE', 'UP'],
  MAINTENANCE: ['BELOW_MAINTENANCE_BAND', 'WITHIN_MAINTENANCE_BAND', 'ABOVE_MAINTENANCE_BAND'],
};
export const TRAJECTORY_SUFFICIENCY_VALUES = ['SUFFICIENT_FOR_DECISION', 'INSUFFICIENT_WINDOW', 'INSUFFICIENT_DATA'] as const;
export const WEIGHT_DIRECTION_VALUES: readonly WeightDirection[] = ['DOWN', 'STABLE', 'UP'];
export const WAIST_CHANGE_VALUES: readonly WaistChange[] = ['LOWER', 'SAME', 'HIGHER'];

// ── Tipos ───────────────────────────────────────────────────────────────────
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
  /** Reservado (MB5). Sin autoridad sobre la energía. */
  baseEnergyKcal: number | null;
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
  adherence: { answer: AdherenceAnswer; band: AdherenceBand };
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
  blocked: { action: 'STEP_UP' | 'STEP_DOWN'; reason: AdaptiveReason } | null;
  versions: { trajectory: number; checkinDomain: number; adaptiveDecision: number };
  createdAt: string;
}

// ── Mapeo puro: dominio → payload de la RPC ─────────────────────────────────
export interface CheckinRecordInput {
  cycleIndex: number;
  checkin: NutritionCheckin;
  trajectory: TrajectoryResult;
  decision: AdaptiveDecision;
  /** Cintura con la que se comparó (check-in anterior o línea base), si la hubo. */
  previousWaistCm: number | null;
}

export type CheckinRecordError = 'TRAJECTORY_NOT_ASSESSED' | 'OBJECTIVE_MISMATCH' | 'CYCLE_MISMATCH' | 'WEIGHT_MISMATCH';

function classificationValue(c: TrajectoryClassification): string {
  switch (c.objective) {
    case 'FAT_LOSS': return c.rate;
    case 'MUSCLE_GAIN': return c.rate;
    case 'RECOMPOSITION': return c.weight;
    case 'MAINTENANCE': return c.band;
  }
}

/**
 * Arma el payload snake_case de `nutrition_record_checkin` a partir de lo que
 * MB1–MB3 ya produjeron. Puro. No incluye id, user_id ni calibration_id: esos
 * los pone el servidor.
 */
export function buildCheckinRecord(input: CheckinRecordInput):
  { ok: true; payload: Record<string, unknown> } | { ok: false; error: CheckinRecordError } {
  const { cycleIndex, checkin: c, trajectory: t, decision: d, previousWaistCm } = input;
  if (t.status !== 'ASSESSED') return { ok: false, error: 'TRAJECTORY_NOT_ASSESSED' };
  if (t.objective !== c.objective || d.objective !== c.objective) return { ok: false, error: 'OBJECTIVE_MISMATCH' };
  if (d.cycleIndex !== cycleIndex) return { ok: false, error: 'CYCLE_MISMATCH' };
  const m = t.metrics;
  if (m != null && m.currentWeightKg !== c.weightKg) return { ok: false, error: 'WEIGHT_MISMATCH' };

  const waistDirection = previousWaistCm != null && c.waistCm != null ? classifyWaistChange(previousWaistCm, c.waistCm) : null;
  return {
    ok: true,
    payload: {
      cycle_index: cycleIndex,
      checkin_date: c.checkinDate,
      objective: c.objective,
      weight_kg: c.weightKg,
      waist_cm: c.waistCm,
      adherence_answer: c.adherence.answer,
      adherence_band: c.adherence.band,
      hunger: c.hunger,
      energy: c.energy,
      performance: c.performance,
      trains_strength: c.trainsStrength,
      strength_experience: c.strengthExperience,
      recent_strength_continuity: c.recentStrengthContinuity,
      trajectory_sufficiency: t.sufficiency,
      previous_weight_kg: m?.previousWeightKg ?? null,
      elapsed_days: m?.elapsedDays ?? null,
      absolute_change_kg: m?.absoluteChangeKg ?? null,
      percent_change: m?.percentChangeFromBaseline ?? null,
      percent_change_per_week: m?.percentChangePerWeek ?? null,
      kg_per_month: m?.changeKgPerMonth ?? null,
      trajectory_direction: m?.direction ?? null,
      trajectory_classification: t.sufficiency === 'SUFFICIENT_FOR_DECISION' ? classificationValue(t.classification) : null,
      previous_waist_cm: waistDirection ? previousWaistCm : null,
      waist_direction: waistDirection,
      action: d.action,
      reason: d.reason,
      previous_step: d.currentStep,
      proposed_step: d.proposedStep,
      blocked_action: d.blocked?.action ?? null,
      blocked_reason: d.blocked?.reason ?? null,
      trajectory_version: TRAJECTORY_ENGINE_VERSION,
      checkin_domain_version: NUTRITION_CHECKIN_VERSION,
      adaptive_decision_version: ADAPTIVE_DECISION_VERSION,
    },
  };
}

// ── Mapeo puro: fila → dominio (rechaza lo que no reconoce) ─────────────────
function isOneOf<T extends string>(v: unknown, list: readonly T[]): v is T {
  return typeof v === 'string' && (list as readonly string[]).includes(v);
}
const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const isStep = (v: number | null): v is number => v != null && Number.isInteger(v) && v >= CALIBRATION_STEP_MIN && v <= CALIBRATION_STEP_MAX;

/** Fila de `nutrition_adaptive_checkins` → dominio. `null` si algún valor no es reconocible. */
export function checkinFromRow(row: Record<string, unknown>): StoredAdaptiveCheckin | null {
  const objective = row.objective;
  if (!isOneOf(objective, CANONICAL_GOALS)) return null;
  const id = str(row.id), calibrationId = str(row.calibration_id), checkinDate = str(row.checkin_date);
  const cycleIndex = num(row.cycle_index), weightKg = num(row.weight_kg);
  const previousStep = num(row.previous_step), proposedStep = num(row.proposed_step);
  if (!id || !calibrationId || !checkinDate || cycleIndex == null || weightKg == null || !isStep(previousStep) || !isStep(proposedStep)) return null;
  if (!isOneOf(row.adherence_answer, ADHERENCE_ANSWERS) || !isOneOf(row.adherence_band, ['HIGH', 'MEDIUM', 'LOW'] as const)) return null;
  if (!isOneOf(row.hunger, NUTRITION_HUNGER_VALUES) || !isOneOf(row.energy, NUTRITION_ENERGY_VALUES)
    || !isOneOf(row.performance, NUTRITION_PERFORMANCE_VALUES)) return null;
  if (!isOneOf(row.action, ADAPTIVE_ACTIONS) || !isOneOf(row.reason, ADAPTIVE_REASONS)) return null;
  if (!isOneOf(row.trajectory_sufficiency, TRAJECTORY_SUFFICIENCY_VALUES)) return null;

  const optional = <T extends string>(v: unknown, list: readonly T[]): T | null | undefined =>
    v === null || v === undefined ? null : isOneOf(v, list) ? v : undefined;
  const strengthExperience = optional(row.strength_experience, STRENGTH_EXPERIENCE_VALUES);
  const continuity = optional(row.recent_strength_continuity, RECENT_STRENGTH_CONTINUITY_VALUES);
  const direction = optional(row.trajectory_direction, WEIGHT_DIRECTION_VALUES);
  const waistDirection = optional(row.waist_direction, WAIST_CHANGE_VALUES);
  const classification = optional(row.trajectory_classification, TRAJECTORY_CLASSIFICATION_VALUES[objective]);
  const blockedAction = optional(row.blocked_action, ['STEP_UP', 'STEP_DOWN'] as const);
  const blockedReason = optional(row.blocked_reason, ADAPTIVE_REASONS);
  if ([strengthExperience, continuity, direction, waistDirection, classification, blockedAction, blockedReason].includes(undefined)) return null;
  if ((blockedAction == null) !== (blockedReason == null)) return null;

  return {
    id, calibrationId, cycleIndex, checkinDate, objective, weightKg,
    waistCm: num(row.waist_cm),
    adherence: { answer: row.adherence_answer, band: row.adherence_band },
    hunger: row.hunger, energy: row.energy, performance: row.performance,
    trainsStrength: typeof row.trains_strength === 'boolean' ? row.trains_strength : null,
    strengthExperience: strengthExperience!, recentStrengthContinuity: continuity!,
    trajectory: {
      sufficiency: row.trajectory_sufficiency,
      previousWeightKg: num(row.previous_weight_kg), elapsedDays: num(row.elapsed_days),
      absoluteChangeKg: num(row.absolute_change_kg), percentChange: num(row.percent_change),
      percentChangePerWeek: num(row.percent_change_per_week), kgPerMonth: num(row.kg_per_month),
      direction: direction!, classification: classification!,
    },
    previousWaistCm: num(row.previous_waist_cm),
    waistDirection: waistDirection!,
    action: row.action, reason: row.reason, previousStep, proposedStep,
    blocked: blockedAction ? { action: blockedAction, reason: blockedReason! } : null,
    versions: {
      trajectory: num(row.trajectory_version) ?? 0,
      checkinDomain: num(row.checkin_domain_version) ?? 0,
      adaptiveDecision: num(row.adaptive_decision_version) ?? 0,
    },
    createdAt: String(row.created_at ?? ''),
  };
}

/** Fila de `nutrition_calibrations` → dominio. `null` si no es reconocible. */
export function calibrationFromRow(row: Record<string, unknown>): NutritionCalibration | null {
  const objective = row.objective;
  const id = str(row.id), cycleStart = str(row.cycle_start), baselineDate = str(row.baseline_date);
  const baselineWeightKg = num(row.baseline_weight_kg), currentStep = num(row.current_step);
  if (!isOneOf(objective, CANONICAL_GOALS) || !id || !cycleStart || !baselineDate || baselineWeightKg == null || !isStep(currentStep)) return null;
  if (!isOneOf(row.status, ['ACTIVE', 'CLOSED'] as const)) return null;
  const lastApplied = row.last_applied_action;
  if (lastApplied != null && !isOneOf(lastApplied, ['STEP_UP', 'STEP_DOWN'] as const)) return null;
  return {
    id, objective, status: row.status, baselineDate, cycleStart, baselineWeightKg,
    baselineWaistCm: num(row.baseline_waist_cm), currentStep,
    baseEnergyKcal: num(row.base_energy_kcal),
    lastCheckinId: str(row.last_checkin_id),
    lastAppliedAction: (lastApplied as 'STEP_UP' | 'STEP_DOWN' | null) ?? null,
    lastAppliedAt: str(row.last_applied_at),
    calibrationVersion: num(row.calibration_version) ?? 0,
    createdAt: String(row.created_at ?? ''),
    closedAt: str(row.closed_at),
  };
}

/**
 * Reconstruye, desde un check-in guardado, el contexto previo que MB3 consume.
 * La clasificación se rehace con las métricas CONGELADAS de la fila; el rango de
 * MUSCLE_GAIN es el de la versión de trayectoria vigente.
 */
export function previousContextFromCheckin(s: StoredAdaptiveCheckin): PreviousCheckinContext {
  return {
    action: s.action,
    classification: storedClassification(s),
    hunger: s.hunger, energy: s.energy, performance: s.performance,
    waistCm: s.waistCm,
  };
}

function storedClassification(s: StoredAdaptiveCheckin): TrajectoryClassification | null {
  const t = s.trajectory;
  if (t.sufficiency !== 'SUFFICIENT_FOR_DECISION' || t.classification == null) return null;
  switch (s.objective) {
    case 'FAT_LOSS':
      return { objective: 'FAT_LOSS', lossPercentPerWeek: -(t.percentChangePerWeek ?? 0) || 0, rate: t.classification as never };
    case 'MUSCLE_GAIN': {
      if (s.strengthExperience == null) return null;
      return {
        objective: 'MUSCLE_GAIN', experienceLevel: s.strengthExperience, gainKgPerMonth: t.kgPerMonth ?? 0,
        targetKgPerMonth: { ...MUSCLE_GAIN_TARGET_KG_PER_MONTH[s.strengthExperience] }, rate: t.classification as never,
      };
    }
    case 'RECOMPOSITION':
      return { objective: 'RECOMPOSITION', changeKgPerMonth: t.kgPerMonth ?? 0, weight: t.classification as never };
    case 'MAINTENANCE':
      return { objective: 'MAINTENANCE', percentChangeFromBaseline: t.percentChange ?? 0, band: t.classification as never };
  }
}
