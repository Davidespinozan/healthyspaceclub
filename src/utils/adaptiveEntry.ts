// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE NUTRITION · ENTRADA DEL SOCIO REAL (modelo de vista PURO)
//
// Traduce el estado que YA decidieron las autoridades existentes a lo que la tarjeta de Nutrición
// muestra. NO decide nada adaptativo:
//   · elegibilidad y fuerza → `strengthRequirement` (la misma función que usa el servidor);
//   · calendario de check-ins → `cycleIndexForDate` / `cycleDueDate` / ventana del planificador del
//     servidor (mismas funciones, mismo bundle);
//   · ajuste pendiente → Snapshot V2 (`nutritionSnapshot.calibration.pending`);
//   · resultado → la decisión que devolvió el servidor, solo traducida.
// El cliente nunca calcula ni envía base, paso, kcal ni decisión.
// ─────────────────────────────────────────────────────────────────────────────
import { canonicalGoalFrom, type CanonicalGoal } from './energyPrescription';
import { strengthRequirement, type NutritionSnapshotV2 } from './adaptiveEnergyAuthority';
import {
  cycleIndexForDate, cycleDueDate, calibrationEffectiveFrom, CHECKIN_EARLY_DAYS, CHECKIN_LATE_DAYS,
} from './adaptiveCheckinPlanner';
import type { NutritionCalibration, StoredAdaptiveCheckin } from './adaptiveCalibrationCore';

/** Objetivos que exigen cintura en el check-in y en la línea base (MB2). */
const WAIST_OBJECTIVES: readonly CanonicalGoal[] = ['RECOMPOSITION'];
/** Objetivos que exigen experiencia de fuerza en el check-in (MB2). */
const EXPERIENCE_OBJECTIVES: readonly CanonicalGoal[] = ['MUSCLE_GAIN'];

export type AdaptiveEntryState =
  | { kind: 'HIDDEN' }                                       // sin energía prescrita o calibración aún no leída
  | { kind: 'STRENGTH_REQUIRED' }                            // ganancia/recomposición sin fuerza declarada
  | { kind: 'CAN_START'; needsWaist: boolean }
  | { kind: 'CHECKIN_DUE'; needsWaist: boolean; needsExperience: boolean; pendingFrom: string | null }
  | { kind: 'WAITING'; nextCheckinFrom: string | null; pendingFrom: string | null };

export interface AdaptiveEntryInput {
  energyPrescribed: boolean;
  obData: unknown;
  adaptive: { load: 'IDLE' | 'LOADED' | 'UNAVAILABLE'; calibration: NutritionCalibration | null; checkins: readonly StoredAdaptiveCheckin[] };
  snapshot: NutritionSnapshotV2 | null;
  /** Fecha local 'YYYY-MM-DD'. */
  today: string;
}

const DAY_MS = 86_400_000;
const addDays = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
function objectiveOf(obData: unknown): CanonicalGoal | null {
  try { return canonicalGoalFrom((obData as Record<string, unknown> | null | undefined)?.goal); } catch { return null; }
}

/** Primer día en que se puede hacer el próximo check-in aún no registrado (o null si no se encuentra). */
export function nextCheckinWindowStart(cal: NutritionCalibration, done: ReadonlySet<number>, today: string): string | null {
  for (let n = 1; n <= 104; n++) {
    const due = cycleDueDate(cal.cycleStart, n);
    if (!due) return null;
    const close = addDays(due, CHECKIN_LATE_DAYS);
    if (close < today || done.has(n)) continue;
    return addDays(due, -CHECKIN_EARLY_DAYS);
  }
  return null;
}

/** Estado de la tarjeta Adaptive. Puro. */
export function adaptiveEntryState(input: AdaptiveEntryInput): AdaptiveEntryState {
  const { energyPrescribed, obData, adaptive, snapshot, today } = input;
  if (!energyPrescribed || adaptive.load !== 'LOADED') return { kind: 'HIDDEN' };
  const objective = objectiveOf(obData);
  if (!objective) return { kind: 'HIDDEN' };
  if (strengthRequirement(objective, obData) === 'STRENGTH_REQUIRED') return { kind: 'STRENGTH_REQUIRED' };
  const needsWaist = WAIST_OBJECTIVES.includes(objective);
  const cal = adaptive.calibration;
  // Sin calibración activa, o con una de otro objetivo (el servidor la cierra y abre otra al iniciar).
  if (!cal || cal.status !== 'ACTIVE' || cal.objective !== objective) return { kind: 'CAN_START', needsWaist };

  const pendingFrom = snapshot?.calibration?.pending?.effectiveFrom ?? null;
  const done = new Set(adaptive.checkins.filter((c) => c.calibrationId === cal.id).map((c) => c.cycleIndex));
  const cycle = cycleIndexForDate(cal.cycleStart, today);
  if (cycle != null && !done.has(cycle)) {
    return { kind: 'CHECKIN_DUE', needsWaist, needsExperience: EXPERIENCE_OBJECTIVES.includes(objective), pendingFrom };
  }
  return { kind: 'WAITING', nextCheckinFrom: nextCheckinWindowStart(cal, done, today), pendingFrom };
}

// ── Traducción de la respuesta del servidor ─────────────────────────────────
export type AdaptiveResult =
  | { kind: 'STARTED' }
  | { kind: 'KEEP' }                                         // MAINTAIN / NO_ADJUSTMENT
  | { kind: 'ADJUST'; effectiveFrom: string | null }       // STEP_UP / STEP_DOWN: rige el domingo ≥ fecha del check-in
  | { kind: 'REVIEW' }
  | { kind: 'STRENGTH_REQUIRED' }
  | { kind: 'NOT_DUE' }
  | { kind: 'NOT_ELIGIBLE' }
  | { kind: 'INVALID_INPUT' }
  | { kind: 'ERROR' };

/** Traduce la respuesta de la Edge. La UI no decide: solo nombra lo que el servidor decidió. Puro. */
export function adaptiveResultFrom(body: Record<string, unknown> | null | undefined, checkinDate: string): AdaptiveResult {
  switch (body?.status) {
    case 'STARTED': case 'ALREADY_ACTIVE': return { kind: 'STARTED' };
    case 'RECORDED':
      switch (body.action) {
        case 'STEP_UP': case 'STEP_DOWN': return { kind: 'ADJUST', effectiveFrom: calibrationEffectiveFrom(checkinDate) };
        case 'MAINTAIN': case 'NO_ADJUSTMENT': return { kind: 'KEEP' };
        case 'REVIEW': return { kind: 'REVIEW' };
        default: return { kind: 'ERROR' };
      }
    case 'STRENGTH_REQUIRED': return { kind: 'STRENGTH_REQUIRED' };
    case 'NOT_DUE': case 'DUPLICATE_CYCLE': case 'OUT_OF_ORDER': return { kind: 'NOT_DUE' };
    case 'NOT_ELIGIBLE': case 'OBJECTIVE_UNRESOLVED': case 'OBJECTIVE_CHANGED': case 'NO_ACTIVE_CALIBRATION': return { kind: 'NOT_ELIGIBLE' };
    case 'INVALID_WEIGHT': case 'INVALID_WAIST': case 'WAIST_REQUIRED': case 'CHECKIN_INVALID': case 'CHECKIN_INCOMPLETE': return { kind: 'INVALID_INPUT' };
    default: return { kind: 'ERROR' };
  }
}
