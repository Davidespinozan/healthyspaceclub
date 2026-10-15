// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE NUTRITION · BLOQUE 2 · planificador SERVER-AUTHORITATIVE
//
// Lo que la Edge Function `nutrition-checkin` ejecuta entre «leí el estado» y «llamo
// a la RPC transaccional». Puro y determinista: recibe el estado ya cargado (perfil,
// calibración activa, historial, estado energético resuelto, fecha UTC del servidor)
// y la petición CRUDA del cliente, y devuelve qué persistir o por qué rechazar.
//
// El cliente solo aporta lo que la persona DECLARA (lista blanca). Todo lo demás —
// objetivo, ciclo, referencia, paso, trayectoria, banda de adherencia, fuerza,
// decisión— se deriva aquí con el motor compartido (MB1–MB3), sin copiar reglas.
//
// Decisiones de producto aplicadas (Bloque 2):
//   · calendario: cycle_start = primer domingo en/después de la línea base; el
//     check-in n vence en cycle_start + 14·n y se acepta de 1 día antes a 6 después.
//     Fuera de ventana → NOT_DUE (ese ciclo queda saltado).
//   · fecha local declarada válida si está a ±1 día de la fecha UTC del servidor.
//   · referencia: FAT_LOSS compara con el check-in anterior (o la línea base);
//     el resto usa un ANCLA sin solapes: el último check-in con trayectoria
//     evaluada (o la línea base). Días reales; MB1 decide si la ventana basta.
//   · MB3 «consecutivo» = ciclo inmediatamente anterior: un hueco reinicia.
//   · solo se calibra con energía PRESCRIBED.
// ─────────────────────────────────────────────────────────────────────────────
import { canonicalGoalFrom, type CanonicalGoal } from './energyPrescription';
import { assessTrajectory, type TrajectoryResult } from './nutritionTrajectory';
import { validateNutritionCheckin, type NutritionCheckin } from './nutritionCheckin';
import { decideAdaptiveNutrition, type AdaptiveDecision, type PreviousCheckinContext } from './adaptiveNutritionDecision';
import { readTrainingModalities } from './trainingModality';
import {
  buildCheckinRecord,
  previousContextFromCheckin,
  ENERGY_CALIBRATION_VERSION,
  type NutritionCalibration,
  type StoredAdaptiveCheckin,
} from './adaptiveCalibrationCore';

export const CYCLE_LENGTH_DAYS = 14;
/** Un check-in se acepta desde 1 día antes de su domingo (tolerancia de MB1)… */
export const CHECKIN_EARLY_DAYS = 1;
/** …hasta el sábado siguiente. */
export const CHECKIN_LATE_DAYS = 6;
/** Fecha local declarada vs fecha UTC del servidor (cubre todas las zonas horarias). */
export const DECLARED_DATE_TOLERANCE_DAYS = 1;

/** Campos que el cliente PUEDE enviar. Cualquier otro se rechaza: el servidor no acepta autoridad. */
export const START_REQUEST_FIELDS = ['requestId', 'localDate', 'weightKg', 'waistCm'] as const;
export const CHECKIN_REQUEST_FIELDS = [
  'requestId', 'localDate', 'weightKg', 'waistCm', 'adherenceAnswer', 'hunger', 'energy', 'performance',
  'strengthExperience', 'recentStrengthContinuity',
] as const;

export type PlannerRejectReason =
  | 'INVALID_REQUEST' | 'UNEXPECTED_FIELDS' | 'INVALID_REQUEST_ID'
  | 'INVALID_DATE' | 'FUTURE_DATE' | 'DATE_OUT_OF_TOLERANCE'
  | 'NOT_ELIGIBLE' | 'OBJECTIVE_UNRESOLVED'
  | 'INVALID_WEIGHT' | 'INVALID_WAIST' | 'WAIST_REQUIRED'
  | 'NO_ACTIVE_CALIBRATION' | 'OBJECTIVE_CHANGED' | 'NOT_DUE' | 'DUPLICATE_CYCLE' | 'OUT_OF_ORDER'
  | 'CHECKIN_INVALID' | 'CHECKIN_INCOMPLETE' | 'ENGINE_INVALID';

export interface PlannerRejection { kind: 'REJECT'; reason: PlannerRejectReason; fields?: string[] }

// ── Calendario ──────────────────────────────────────────────────────────────
const DAY_MS = 86_400_000;

/** Día UTC de una clave YYYY-MM-DD que existe en el calendario; null si no. */
function ymdToDay(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return t / DAY_MS;
}
const dayToYmd = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);

/** Primer domingo en o después de la fecha de línea base. */
export function cycleStartFor(baselineDate: string): string | null {
  const d = ymdToDay(baselineDate);
  if (d == null) return null;
  const dow = new Date(d * DAY_MS).getUTCDay(); // 0 = domingo
  return dayToYmd(d + ((7 - dow) % 7));
}

/** Domingo en que vence el check-in n (n ≥ 1). */
export function cycleDueDate(cycleStart: string, n: number): string | null {
  const s = ymdToDay(cycleStart);
  return s == null || !Number.isInteger(n) || n < 1 ? null : dayToYmd(s + CYCLE_LENGTH_DAYS * n);
}

/** Ciclo al que corresponde una fecha, o null si cae fuera de toda ventana [vence − 1, vence + 6]. */
export function cycleIndexForDate(cycleStart: string, date: string): number | null {
  const s = ymdToDay(cycleStart), d = ymdToDay(date);
  if (s == null || d == null) return null;
  const offset = d - s;
  const n = Math.floor((offset + CHECKIN_EARLY_DAYS) / CYCLE_LENGTH_DAYS);
  if (n < 1) return null;
  return offset <= CYCLE_LENGTH_DAYS * n + CHECKIN_LATE_DAYS ? n : null;
}

/** Fecha local declarada aceptable respecto a la fecha UTC del servidor. */
export function acceptDeclaredDate(declared: unknown, serverUtcDate: string):
  { ok: true; date: string } | { ok: false; reason: 'INVALID_DATE' | 'FUTURE_DATE' | 'DATE_OUT_OF_TOLERANCE' } {
  const d = ymdToDay(declared), s = ymdToDay(serverUtcDate);
  if (d == null || s == null) return { ok: false, reason: 'INVALID_DATE' };
  if (d > s + DECLARED_DATE_TOLERANCE_DAYS) return { ok: false, reason: 'FUTURE_DATE' };
  if (d < s - DECLARED_DATE_TOLERANCE_DAYS) return { ok: false, reason: 'DATE_OUT_OF_TOLERANCE' };
  return { ok: true, date: declared as string };
}

// ── Petición ────────────────────────────────────────────────────────────────
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isRequestId = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

function readRequest(raw: unknown, allowed: readonly string[], serverUtcDate: string):
  { ok: true; body: Record<string, unknown>; requestId: string; date: string } | { ok: false; rejection: PlannerRejection } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, rejection: { kind: 'REJECT', reason: 'INVALID_REQUEST' } };
  const body = raw as Record<string, unknown>;
  const unexpected = Object.keys(body).filter((k) => !allowed.includes(k)).sort();
  if (unexpected.length > 0) return { ok: false, rejection: { kind: 'REJECT', reason: 'UNEXPECTED_FIELDS', fields: unexpected } };
  if (!isRequestId(body.requestId)) return { ok: false, rejection: { kind: 'REJECT', reason: 'INVALID_REQUEST_ID' } };
  const date = acceptDeclaredDate(body.localDate, serverUtcDate);
  if (!date.ok) return { ok: false, rejection: { kind: 'REJECT', reason: date.reason } };
  return { ok: true, body, requestId: body.requestId, date: date.date };
}

function objectiveOf(obData: unknown): CanonicalGoal | null {
  try { return canonicalGoalFrom((obData as Record<string, unknown> | null | undefined)?.goal); } catch { return null; }
}
const isPositiveFinite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const reject = (reason: PlannerRejectReason, fields?: string[]): PlannerRejection => (fields ? { kind: 'REJECT', reason, fields } : { kind: 'REJECT', reason });

// ── Abrir calibración ───────────────────────────────────────────────────────
export interface StartPlanInput {
  request: unknown;
  obData: unknown;
  /** `resolveNutritionEnergyState(obData).status`, resuelto por el caller. */
  energyStatus: string | null;
  active: NutritionCalibration | null;
  serverUtcDate: string;
}

export type StartPlan =
  | PlannerRejection
  | { kind: 'ALREADY_ACTIVE'; calibrationId: string }
  | {
      kind: 'START';
      requestId: string;
      objective: CanonicalGoal;
      baselineDate: string;
      cycleStart: string;
      baselineWeightKg: number;
      baselineWaistCm: number | null;
      calibrationVersion: number;
      /** La activa que se cierra por cambio de objetivo, si la hay. */
      closesCalibrationId: string | null;
    };

/** Una calibración activa con el mismo objetivo NO se reinicia: solo un cambio de objetivo abre otra. */
export function planStartCalibration(input: StartPlanInput): StartPlan {
  const req = readRequest(input.request, START_REQUEST_FIELDS, input.serverUtcDate);
  if (!req.ok) return req.rejection;
  if (input.energyStatus !== 'PRESCRIBED') return reject('NOT_ELIGIBLE');
  const objective = objectiveOf(input.obData);
  if (objective == null) return reject('OBJECTIVE_UNRESOLVED');

  const { weightKg, waistCm } = req.body;
  if (!isPositiveFinite(weightKg)) return reject('INVALID_WEIGHT');
  if (waistCm !== undefined && waistCm !== null && !isPositiveFinite(waistCm)) return reject('INVALID_WAIST');
  const baselineWaistCm = isPositiveFinite(waistCm) ? waistCm : null;
  // MB2: recomposición exige cintura para evaluar; sin cintura base no habría primera comparación.
  if (objective === 'RECOMPOSITION' && baselineWaistCm == null) return reject('WAIST_REQUIRED');

  const active = input.active?.status === 'ACTIVE' ? input.active : null;
  if (active != null && active.objective === objective) return { kind: 'ALREADY_ACTIVE', calibrationId: active.id };

  return {
    kind: 'START',
    requestId: req.requestId,
    objective,
    baselineDate: req.date,
    cycleStart: cycleStartFor(req.date)!,
    baselineWeightKg: weightKg,
    baselineWaistCm,
    calibrationVersion: ENERGY_CALIBRATION_VERSION,
    closesCalibrationId: active?.id ?? null,
  };
}

// ── Registrar check-in ──────────────────────────────────────────────────────
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
export interface ReferencePoint { kind: 'BASELINE' | 'CHECKIN'; date: string; weightKg: number; waistCm: number | null; checkinId: string | null }

export type CheckinPlan =
  | PlannerRejection
  | {
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
export function referenceOnlyContext(waistCm: number): PreviousCheckinContext {
  return { action: 'NO_ADJUSTMENT', classification: null, hunger: 'NORMAL', energy: 'NORMAL', performance: 'SAME', waistCm };
}

/** Referencia de la trayectoria según el objetivo (ver cabecera). */
export function referencePointFor(objective: CanonicalGoal, calibration: NutritionCalibration, ordered: readonly StoredAdaptiveCheckin[]): ReferencePoint {
  const pick = objective === 'FAT_LOSS'
    ? ordered[ordered.length - 1]
    : [...ordered].reverse().find((c) => c.trajectory.sufficiency === 'SUFFICIENT_FOR_DECISION');
  return pick
    ? { kind: 'CHECKIN', date: pick.checkinDate, weightKg: pick.weightKg, waistCm: pick.waistCm, checkinId: pick.id }
    : { kind: 'BASELINE', date: calibration.baselineDate, weightKg: calibration.baselineWeightKg, waistCm: calibration.baselineWaistCm, checkinId: null };
}

export function planCheckin(input: CheckinPlanInput): CheckinPlan {
  const req = readRequest(input.request, CHECKIN_REQUEST_FIELDS, input.serverUtcDate);
  if (!req.ok) return req.rejection;
  const cal = input.calibration;
  if (cal == null || cal.status !== 'ACTIVE') return reject('NO_ACTIVE_CALIBRATION');
  if (input.energyStatus !== 'PRESCRIBED') return reject('NOT_ELIGIBLE');
  const objective = objectiveOf(input.obData);
  if (objective == null) return reject('OBJECTIVE_UNRESOLVED');
  if (objective !== cal.objective) return reject('OBJECTIVE_CHANGED');

  const cycleIndex = cycleIndexForDate(cal.cycleStart, req.date);
  if (cycleIndex == null) return reject('NOT_DUE');
  const ordered = input.history.filter((c) => c.calibrationId === cal.id).sort((a, b) => a.cycleIndex - b.cycleIndex);
  if (ordered.some((c) => c.cycleIndex === cycleIndex)) return reject('DUPLICATE_CYCLE');
  const last = ordered.length > 0 ? ordered[ordered.length - 1] : null;
  if (last != null && (cycleIndex < last.cycleIndex || req.date <= last.checkinDate)) return reject('OUT_OF_ORDER');

  // Fuerza: cuenta solo `strength` declarado (MIXED solo no basta). Sin declaración → false; ilegible → desconocido.
  const modalities = readTrainingModalities((input.obData as Record<string, unknown> | null | undefined)?.trainingModalities);
  const trainsStrength = modalities.kind === 'DECLARED' ? modalities.modalities.includes('strength')
    : modalities.kind === 'MISSING' ? false : null;

  const b = req.body;
  const validated = validateNutritionCheckin({
    objective, weightKg: b.weightKg, waistCm: b.waistCm, adherenceAnswer: b.adherenceAnswer, hunger: b.hunger,
    energy: b.energy, performance: b.performance, trainsStrength, strengthExperience: b.strengthExperience,
    recentStrengthContinuity: b.recentStrengthContinuity, checkinDate: req.date, cycleNumber: cycleIndex,
  });
  if (validated.status === 'INVALID') return reject('CHECKIN_INVALID', validated.invalid);
  if (validated.status === 'INCOMPLETE') return reject('CHECKIN_INCOMPLETE', validated.missing);
  const checkin = validated.checkin;

  const reference = referencePointFor(objective, cal, ordered);
  const trajectory = assessTrajectory({
    objective, previousWeightKg: reference.weightKg, currentWeightKg: checkin.weightKg,
    elapsed: { previousDate: reference.date, currentDate: req.date }, experienceLevel: checkin.strengthExperience,
  });

  // Consecutivo = el ciclo inmediatamente anterior. La cintura siempre es la de la referencia (misma ventana que el peso).
  const consecutive = last != null && last.cycleIndex === cycleIndex - 1 ? last : null;
  const previous: PreviousCheckinContext | null = consecutive
    ? { ...previousContextFromCheckin(consecutive), waistCm: reference.waistCm }
    : reference.waistCm != null ? referenceOnlyContext(reference.waistCm) : null;

  const decided = decideAdaptiveNutrition({
    objective, trajectory, checkin: validated, currentStep: cal.currentStep, cycleIndex, previous,
  });
  if (decided.status !== 'DECIDED') return reject('ENGINE_INVALID');

  const record = buildCheckinRecord({ cycleIndex, checkin, trajectory, decision: decided.decision, previousWaistCm: reference.waistCm });
  if (!record.ok) return reject('ENGINE_INVALID');

  return {
    kind: 'RECORD',
    requestId: req.requestId,
    calibrationId: cal.id,
    expectedLastCheckinId: cal.lastCheckinId,
    cycleIndex,
    reference,
    checkin,
    trajectory,
    decision: decided.decision,
    payload: record.payload,
  };
}
