// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE NUTRITION · MICROBLOQUE 4 · persistencia de check-ins y calibración
//
// Mapeo puro dominio ↔ fila + operaciones Supabase mínimas sobre:
//   nutrition_calibrations       · periodo de calibración; la fila ACTIVE es el estado vigente
//   nutrition_adaptive_checkins  · check-ins procesados, append-only
// (migración 20261014120000_nutrition_adaptive_calibration.sql).
//
// Las ESCRITURAS van solo por las RPC `nutrition_start_calibration` y
// `nutrition_record_checkin`: el servidor deriva el socio de auth.uid() y
// escribe check-in + estado en una transacción. Este módulo nunca envía user_id.
//
// NO está conectado: no lo usa el store, ni la UI, ni la cadena energética. No
// cambia planGoal, energía, macros ni el plan. Tampoco lee food_log, weight_log
// ni Training: la evidencia del check-in es solo lo que el socio declaró.
//
// ⚠️ PENDIENTE DE SEGURIDAD (trust boundary): el servidor valida forma, coherencia
// y rango del paso, pero NO recalcula MB1–MB3: la decisión la calcula el cliente.
// Antes de que `current_step` o `base_energy_kcal` tengan autoridad sobre kcal, hace
// falta una decisión explícita sobre dónde se recalcula (p. ej. server-side).
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase';
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

/** Versión del modelo de calibración persistido (`calibration_version`). */
export const ENERGY_CALIBRATION_VERSION = 1;

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
  const id = str(row.id), cycleStart = str(row.cycle_start);
  const baselineWeightKg = num(row.baseline_weight_kg), currentStep = num(row.current_step);
  if (!isOneOf(objective, CANONICAL_GOALS) || !id || !cycleStart || baselineWeightKg == null || !isStep(currentStep)) return null;
  if (!isOneOf(row.status, ['ACTIVE', 'CLOSED'] as const)) return null;
  const lastApplied = row.last_applied_action;
  if (lastApplied != null && !isOneOf(lastApplied, ['STEP_UP', 'STEP_DOWN'] as const)) return null;
  return {
    id, objective, status: row.status, cycleStart, baselineWeightKg,
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

// ── Resultados de las RPC ───────────────────────────────────────────────────
export type StartCalibrationResult =
  | { status: 'STARTED'; calibrationId: string; closedCalibrationId: string | null }
  | { status: 'ALREADY_ACTIVE'; calibrationId: string }
  | { status: 'NOT_AUTHENTICATED' | 'INVALID_PAYLOAD' | 'CONFLICT' | 'TRANSPORT_ERROR' };

export type RecordCheckinResult =
  | { status: 'RECORDED'; checkinId: string; currentStep: number }
  | { status: 'DUPLICATE_CYCLE'; checkinId: string | null }
  | { status: 'NOT_AUTHENTICATED' | 'NOT_FOUND' | 'CALIBRATION_CLOSED' | 'STALE_STATE' | 'OBJECTIVE_MISMATCH'
      | 'STEP_MISMATCH' | 'OUT_OF_ORDER' | 'INVALID_PAYLOAD' | 'TRANSPORT_ERROR' };

/** Interpreta el jsonb de `nutrition_start_calibration`. Puro. */
export function parseStartCalibrationResult(data: unknown): StartCalibrationResult {
  const r = (data ?? {}) as Record<string, unknown>;
  switch (r.status) {
    case 'STARTED':
      return str(r.calibration_id) ? { status: 'STARTED', calibrationId: str(r.calibration_id)!, closedCalibrationId: str(r.closed_calibration_id) } : { status: 'TRANSPORT_ERROR' };
    case 'ALREADY_ACTIVE':
      return str(r.calibration_id) ? { status: 'ALREADY_ACTIVE', calibrationId: str(r.calibration_id)! } : { status: 'TRANSPORT_ERROR' };
    case 'NOT_AUTHENTICATED': case 'INVALID_PAYLOAD': case 'CONFLICT':
      return { status: r.status };
    default:
      return { status: 'TRANSPORT_ERROR' };
  }
}

/** Interpreta el jsonb de `nutrition_record_checkin`. Puro. */
export function parseRecordCheckinResult(data: unknown): RecordCheckinResult {
  const r = (data ?? {}) as Record<string, unknown>;
  switch (r.status) {
    case 'RECORDED': {
      const step = num(r.current_step);
      return str(r.checkin_id) && isStep(step) ? { status: 'RECORDED', checkinId: str(r.checkin_id)!, currentStep: step } : { status: 'TRANSPORT_ERROR' };
    }
    case 'DUPLICATE_CYCLE':
      return { status: 'DUPLICATE_CYCLE', checkinId: str(r.checkin_id) };
    case 'NOT_AUTHENTICATED': case 'NOT_FOUND': case 'CALIBRATION_CLOSED': case 'STALE_STATE':
    case 'OBJECTIVE_MISMATCH': case 'STEP_MISMATCH': case 'OUT_OF_ORDER': case 'INVALID_PAYLOAD':
      return { status: r.status };
    default:
      return { status: 'TRANSPORT_ERROR' };
  }
}

// ── Operaciones Supabase (RLS own-only; escrituras solo por RPC) ────────────
export interface StartCalibrationParams {
  objective: CanonicalGoal;
  /** Fecha local YYYY-MM-DD del inicio (línea base). */
  cycleStart: string;
  baselineWeightKg: number;
  baselineWaistCm: number | null;
}

/** Abre una calibración (inicio o cambio de objetivo): cierra la activa y empieza en step 0. */
export async function startCalibration(p: StartCalibrationParams): Promise<StartCalibrationResult> {
  const { data, error } = await supabase.rpc('nutrition_start_calibration', {
    p_objective: p.objective,
    p_cycle_start: p.cycleStart,
    p_baseline_weight_kg: p.baselineWeightKg,
    p_baseline_waist_cm: p.baselineWaistCm,
    p_calibration_version: ENERGY_CALIBRATION_VERSION,
  });
  if (error) { console.warn('[calibration] start failed:', error.code ?? error.message); return { status: 'TRANSPORT_ERROR' }; }
  return parseStartCalibrationResult(data);
}

/**
 * Registra un check-in procesado y avanza el estado en una sola transacción.
 * `expectedLastCheckinId` es el `lastCheckinId` leído antes de decidir.
 */
export async function recordCheckin(
  calibrationId: string, expectedLastCheckinId: string | null, payload: Record<string, unknown>,
): Promise<RecordCheckinResult> {
  const { data, error } = await supabase.rpc('nutrition_record_checkin', {
    p_calibration_id: calibrationId,
    p_expected_last_checkin_id: expectedLastCheckinId,
    p_checkin: payload,
  });
  if (error) { console.warn('[calibration] record failed:', error.code ?? error.message); return { status: 'TRANSPORT_ERROR' }; }
  return parseRecordCheckinResult(data);
}

/** Estado vigente: la calibración ACTIVE del socio, o `null`. */
export async function getActiveCalibration(): Promise<NutritionCalibration | null> {
  const { data, error } = await supabase.from('nutrition_calibrations').select('*').eq('status', 'ACTIVE').maybeSingle();
  if (error) { console.warn('[calibration] read active failed:', error.code ?? error.message); return null; }
  return data ? calibrationFromRow(data as Record<string, unknown>) : null;
}

/** Los últimos `limit` check-ins de una calibración, del más reciente al más antiguo. */
export async function listRecentCheckins(calibrationId: string, limit = 2): Promise<StoredAdaptiveCheckin[]> {
  const { data, error } = await supabase.from('nutrition_adaptive_checkins').select('*')
    .eq('calibration_id', calibrationId).order('cycle_index', { ascending: false }).limit(limit);
  if (error) { console.warn('[calibration] list failed:', error.code ?? error.message); return []; }
  return ((data ?? []) as Record<string, unknown>[]).map(checkinFromRow).filter((x): x is StoredAdaptiveCheckin => x != null);
}

/** El check-in de un ciclo concreto (p. ej. dos ciclos atrás para la ventana de ~4 semanas), o `null`. */
export async function getCheckinAtCycle(calibrationId: string, cycleIndex: number): Promise<StoredAdaptiveCheckin | null> {
  const { data, error } = await supabase.from('nutrition_adaptive_checkins').select('*')
    .eq('calibration_id', calibrationId).eq('cycle_index', cycleIndex).maybeSingle();
  if (error) { console.warn('[calibration] read cycle failed:', error.code ?? error.message); return null; }
  return data ? checkinFromRow(data as Record<string, unknown>) : null;
}
