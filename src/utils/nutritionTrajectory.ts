// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE NUTRITION · MICROBLOQUE 1 · TRAJECTORY ENGINE
//
// Convierte dos check-ins de peso YA RESUELTOS (anterior y actual) y el tiempo
// transcurrido entre ellos en métricas de trayectoria, y las clasifica según el
// objetivo canónico.
//
//   objetivo + peso anterior + peso actual + tiempo (+ nivel si MUSCLE_GAIN)
//        ↓
//   ├── entrada inválida ───────────▶ INVALID_INPUT (motivo tipado)
//   ├── falta un dato requerido ────▶ INSUFFICIENT_DATA
//   ├── ventana corta ──────────────▶ INSUFFICIENT_WINDOW (métricas, sin clasificar)
//   └── evaluable ──────────────────▶ SUFFICIENT_FOR_DECISION (métricas + clasificación)
//
// Puro / determinista / sin estado. No conoce React, ni el store, ni Supabase.
//
// ── LO QUE ESTE MÓDULO NO ES ────────────────────────────────────────────────
// NO decide kcal, ni recalcula energía, ni regenera el plan: eso es el motor de
// decisión (Microbloque 3). Una clasificación aquí NO es una orden: p. ej.
// `BORDERLINE_SLOW` no implica recorte, y el motor futuro exigirá dos check-ins
// consecutivos.
// NO promedia pesajes ni lee `weightLog`: recibe UN peso por check-in. El ruido
// de un pesaje aislado lo absorbe el motor de decisión, no esta capa.
// NO es `weightTrend` (N10.1): aquello es una mediana rodante sobre logs para el
// baseline de energía; esto compara dos check-ins.
// NO conoce el calendario: el caller resuelve qué domingo toca. Aquí solo entran
// fechas o días transcurridos reales, y semanas = días / 7.
// NO obtiene el nivel de experiencia de Training: lo recibe ya resuelto, y sin
// él no clasifica MUSCLE_GAIN (no hay fallback).
//
// ── CONVENCIÓN DE SIGNOS ────────────────────────────────────────────────────
// Todas las métricas genéricas son FIRMADAS respecto al peso anterior:
// positivo = subió, negativo = bajó. La única excepción es
// `lossPercentPerWeek` (solo FAT_LOSS), que expresa la PÉRDIDA como magnitud:
// positivo = bajó; cero o negativo = no bajó (negativo = subió).
//
// Las métricas se redondean a 6 decimales y se clasifica SOBRE el valor
// redondeado, para que las fronteras (0.25 %, 1 %, …) no dependan del ruido de
// coma flotante. Las fronteras son inclusivas hacia la banda central.
// ─────────────────────────────────────────────────────────────────────────────
import { CANONICAL_GOALS, type CanonicalGoal } from './energyPrescription';

export const TRAJECTORY_ENGINE_VERSION = 1;

// ── Ventanas ────────────────────────────────────────────────────────────────
/** FAT_LOSS se puede evaluar desde ~2 semanas. Un día de tolerancia por un check-in adelantado. */
export const FAT_LOSS_MIN_WINDOW_DAYS = 13;
/** MUSCLE_GAIN / RECOMPOSITION / MAINTENANCE: evaluación corporal a ~4 semanas, mismo día de tolerancia. */
export const BODY_MIN_WINDOW_DAYS = 27;
/** Mes medio gregoriano (365.25 / 12). Normaliza los rangos «por mes». */
export const DAYS_PER_MONTH = 30.4375;

// ── Rangos cerrados ─────────────────────────────────────────────────────────
/** FAT_LOSS · % de peso perdido por semana. */
export const FAT_LOSS_VERY_SLOW_BELOW_PCT_WEEK = 0.25;
export const FAT_LOSS_ON_TARGET_FROM_PCT_WEEK = 0.5;
export const FAT_LOSS_FAST_ABOVE_PCT_WEEK = 1.0;

export type MuscleGainExperienceLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export const MUSCLE_GAIN_EXPERIENCE_LEVELS: readonly MuscleGainExperienceLevel[] =
  ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

/** MUSCLE_GAIN · kg ganados por mes, por nivel. */
export const MUSCLE_GAIN_TARGET_KG_PER_MONTH: Readonly<Record<MuscleGainExperienceLevel, { min: number; max: number }>> = {
  BEGINNER: { min: 0.5, max: 0.8 },
  INTERMEDIATE: { min: 0.3, max: 0.6 },
  ADVANCED: { min: 0.15, max: 0.4 },
};

/** RECOMPOSITION · ±kg/mes compatibles con «peso relativamente estable». No es éxito ni fracaso. */
export const RECOMP_STABLE_KG_PER_MONTH = 0.5;
/** MAINTENANCE · ±% del peso anterior. */
export const MAINTENANCE_BAND_PCT = 1.0;

// ── Tipos ───────────────────────────────────────────────────────────────────
/** Tiempo entre check-ins: fechas locales YYYY-MM-DD o días ya calculados. */
export type TrajectoryElapsed =
  | { previousDate: string; currentDate: string }
  | { elapsedDays: number };

export interface TrajectoryInput {
  objective: CanonicalGoal;
  previousWeightKg: number | null | undefined;
  currentWeightKg: number | null | undefined;
  elapsed: TrajectoryElapsed;
  /** Requerido solo para MUSCLE_GAIN; se ignora en los demás objetivos. */
  experienceLevel?: MuscleGainExperienceLevel | null;
}

export type TrajectoryInvalidReason =
  | 'UNKNOWN_OBJECTIVE'
  | 'INVALID_WEIGHT'           // ≤ 0, NaN o infinito
  | 'INVALID_DATE'             // fecha mal formada o inexistente, o elapsedDays no finito
  | 'NON_CHRONOLOGICAL_DATES'  // actual ≤ anterior (o elapsedDays ≤ 0)
  | 'UNKNOWN_EXPERIENCE_LEVEL';

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
  /** Signo crudo del cambio a resolución de gramo. Las tolerancias son por objetivo, no aquí. */
  direction: WeightDirection;
}

export type FatLossRate = 'VERY_SLOW' | 'BORDERLINE_SLOW' | 'ON_TARGET' | 'FAST';
export type MuscleGainRate = 'BELOW_TARGET' | 'ON_TARGET' | 'ABOVE_TARGET';
export type RecompWeightTrend = 'DOWN' | 'RELATIVELY_STABLE' | 'UP';
export type MaintenanceBand = 'BELOW_MAINTENANCE_BAND' | 'WITHIN_MAINTENANCE_BAND' | 'ABOVE_MAINTENANCE_BAND';

export type TrajectoryClassification =
  | { objective: 'FAT_LOSS'; lossPercentPerWeek: number; rate: FatLossRate }
  | {
      objective: 'MUSCLE_GAIN';
      experienceLevel: MuscleGainExperienceLevel;
      gainKgPerMonth: number;
      targetKgPerMonth: { min: number; max: number };
      rate: MuscleGainRate;
    }
  | { objective: 'RECOMPOSITION'; changeKgPerMonth: number; weight: RecompWeightTrend }
  | { objective: 'MAINTENANCE'; percentChangeFromBaseline: number; band: MaintenanceBand };

export type TrajectoryAssessment =
  | { sufficiency: 'INSUFFICIENT_DATA'; objective: CanonicalGoal; missing: TrajectoryMissingInput; metrics: TrajectoryMetrics | null }
  | { sufficiency: 'INSUFFICIENT_WINDOW'; objective: CanonicalGoal; requiredWindowDays: number; metrics: TrajectoryMetrics }
  | {
      sufficiency: 'SUFFICIENT_FOR_DECISION';
      objective: CanonicalGoal;
      requiredWindowDays: number;
      metrics: TrajectoryMetrics;
      classification: TrajectoryClassification;
    };

export type TrajectoryResult =
  | { status: 'INVALID_INPUT'; reason: TrajectoryInvalidReason }
  | ({ status: 'ASSESSED' } & TrajectoryAssessment);

// ── Helpers internos ────────────────────────────────────────────────────────
/** 6 decimales; `-0` se normaliza a `0` para no exponer un signo ambiguo. */
const r6 = (x: number) => Math.round(x * 1e6) / 1e6 || 0;
const DAY_MS = 86_400_000;

/** Días UTC de una clave YYYY-MM-DD; null si está mal formada o no existe (p. ej. 2026-02-30). */
function ymdToUtcDay(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return t / DAY_MS;
}

function elapsedDaysOf(e: TrajectoryElapsed): number | TrajectoryInvalidReason {
  if ('elapsedDays' in e) {
    if (typeof e.elapsedDays !== 'number' || !Number.isFinite(e.elapsedDays)) return 'INVALID_DATE';
    return e.elapsedDays > 0 ? e.elapsedDays : 'NON_CHRONOLOGICAL_DATES';
  }
  const a = typeof e.previousDate === 'string' ? ymdToUtcDay(e.previousDate) : null;
  const b = typeof e.currentDate === 'string' ? ymdToUtcDay(e.currentDate) : null;
  if (a == null || b == null) return 'INVALID_DATE';
  return b > a ? b - a : 'NON_CHRONOLOGICAL_DATES';
}

const isMissing = (w: unknown) => w === null || w === undefined;
const isValidWeight = (w: unknown): w is number => typeof w === 'number' && Number.isFinite(w) && w > 0;

function metricsOf(prev: number, curr: number, days: number): TrajectoryMetrics {
  const weeks = days / 7;
  const changeKg = curr - prev;
  const pct = (changeKg / prev) * 100;
  const grams = Math.round(changeKg * 1000);
  return {
    previousWeightKg: prev,
    currentWeightKg: curr,
    elapsedDays: days,
    evaluationWindowWeeks: r6(weeks),
    absoluteChangeKg: r6(changeKg),
    percentChangeFromBaseline: r6(pct),
    percentChangePerWeek: r6(pct / weeks),
    changeKgPerMonth: r6((changeKg / days) * DAYS_PER_MONTH),
    direction: grams < 0 ? 'DOWN' : grams > 0 ? 'UP' : 'STABLE',
  };
}

function classify(
  objective: CanonicalGoal, m: TrajectoryMetrics, level: MuscleGainExperienceLevel | null,
): TrajectoryClassification {
  switch (objective) {
    case 'FAT_LOSS': {
      const loss = r6(-m.percentChangePerWeek);
      const rate: FatLossRate =
        loss < FAT_LOSS_VERY_SLOW_BELOW_PCT_WEEK ? 'VERY_SLOW'
        : loss < FAT_LOSS_ON_TARGET_FROM_PCT_WEEK ? 'BORDERLINE_SLOW'
        : loss <= FAT_LOSS_FAST_ABOVE_PCT_WEEK ? 'ON_TARGET'
        : 'FAST';
      return { objective, lossPercentPerWeek: loss, rate };
    }
    case 'MUSCLE_GAIN': {
      // `level` llega validado: sin él la evaluación es INSUFFICIENT_DATA antes de clasificar.
      const target = MUSCLE_GAIN_TARGET_KG_PER_MONTH[level!];
      const gain = m.changeKgPerMonth;
      const rate: MuscleGainRate = gain < target.min ? 'BELOW_TARGET' : gain > target.max ? 'ABOVE_TARGET' : 'ON_TARGET';
      return { objective, experienceLevel: level!, gainKgPerMonth: gain, targetKgPerMonth: { ...target }, rate };
    }
    case 'RECOMPOSITION': {
      const c = m.changeKgPerMonth;
      const weight: RecompWeightTrend =
        c < -RECOMP_STABLE_KG_PER_MONTH ? 'DOWN' : c > RECOMP_STABLE_KG_PER_MONTH ? 'UP' : 'RELATIVELY_STABLE';
      return { objective, changeKgPerMonth: c, weight };
    }
    case 'MAINTENANCE': {
      const p = m.percentChangeFromBaseline;
      const band: MaintenanceBand =
        p < -MAINTENANCE_BAND_PCT ? 'BELOW_MAINTENANCE_BAND'
        : p > MAINTENANCE_BAND_PCT ? 'ABOVE_MAINTENANCE_BAND'
        : 'WITHIN_MAINTENANCE_BAND';
      return { objective, percentChangeFromBaseline: p, band };
    }
  }
}

// ── API pública ─────────────────────────────────────────────────────────────
/** Ventana mínima (días) para evaluar la trayectoria de un objetivo. */
export function requiredWindowDays(objective: CanonicalGoal): number {
  return objective === 'FAT_LOSS' ? FAT_LOSS_MIN_WINDOW_DAYS : BODY_MIN_WINDOW_DAYS;
}

/** Evalúa la trayectoria entre dos check-ins. Puro; nunca lanza ni rellena datos ausentes. */
export function assessTrajectory(input: TrajectoryInput): TrajectoryResult {
  const { objective, previousWeightKg: prev, currentWeightKg: curr, elapsed } = input;
  if (!CANONICAL_GOALS.includes(objective)) return { status: 'INVALID_INPUT', reason: 'UNKNOWN_OBJECTIVE' };

  if (!isMissing(prev) && !isValidWeight(prev)) return { status: 'INVALID_INPUT', reason: 'INVALID_WEIGHT' };
  if (!isMissing(curr) && !isValidWeight(curr)) return { status: 'INVALID_INPUT', reason: 'INVALID_WEIGHT' };

  const days = elapsedDaysOf(elapsed);
  if (typeof days !== 'number') return { status: 'INVALID_INPUT', reason: days };

  const level = input.experienceLevel;
  const needsLevel = objective === 'MUSCLE_GAIN';
  if (needsLevel && !isMissing(level) && !MUSCLE_GAIN_EXPERIENCE_LEVELS.includes(level!)) {
    return { status: 'INVALID_INPUT', reason: 'UNKNOWN_EXPERIENCE_LEVEL' };
  }

  if (!isValidWeight(prev)) return { status: 'ASSESSED', sufficiency: 'INSUFFICIENT_DATA', objective, missing: 'PREVIOUS_WEIGHT', metrics: null };
  if (!isValidWeight(curr)) return { status: 'ASSESSED', sufficiency: 'INSUFFICIENT_DATA', objective, missing: 'CURRENT_WEIGHT', metrics: null };

  const metrics = metricsOf(prev, curr, days);
  if (needsLevel && isMissing(level)) {
    return { status: 'ASSESSED', sufficiency: 'INSUFFICIENT_DATA', objective, missing: 'EXPERIENCE_LEVEL', metrics };
  }

  const required = requiredWindowDays(objective);
  if (days < required) {
    return { status: 'ASSESSED', sufficiency: 'INSUFFICIENT_WINDOW', objective, requiredWindowDays: required, metrics };
  }

  return {
    status: 'ASSESSED', sufficiency: 'SUFFICIENT_FOR_DECISION', objective, requiredWindowDays: required, metrics,
    classification: classify(objective, metrics, needsLevel ? level! : null),
  };
}
