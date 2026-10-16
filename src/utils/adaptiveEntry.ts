// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE NUTRITION · ENTRADA DEL SOCIO REAL (modelo de vista PURO)
//
// Traduce el estado que YA decidieron las autoridades existentes a lo que la tarjeta de Nutrición
// muestra. NO decide nada adaptativo:
//   · elegibilidad → estado de CAPA 1 del store + `planStartCalibration` (el planificador del
//     SERVIDOR, mismo bundle) como pre-chequeo del inicio automático;
//   · fuerza → `strengthRequirement` (la misma función que usa el servidor);
//   · calendario de check-ins → `cycleIndexForDate` / `cycleDueDate` / ventana del planificador;
//   · ajuste pendiente → Snapshot V2 (`nutritionSnapshot.calibration.pending`);
//   · resultado → la decisión que devolvió el servidor, solo traducida.
// El cliente nunca calcula ni envía base, paso, kcal ni decisión.
//
// FLUJO V1 (único): onboarding → su peso es la línea base → el seguimiento se INICIA SOLO →
// ≥ 14 días reales → check-in COMPLETO → siguientes check-ins, siempre con ≥ 14 días (D1).
//   · D2 · recomposición: la cintura de partida es dato del perfil (onboarding / Mis datos); sin ella
//     no se inicia y se pide completarla en Mis datos;
//   · D1 · el calendario lo decide `checkinCalendarVerdict` (servidor) — ≥ 14 días reales.
// DEFERRED FUTURE: compatibilidad / migración de usuarios con peso histórico (HSC V1 no tiene usuarios
// reales previos). No hay rama de «usuario existente» ni check-in inicial en V1.
// ─────────────────────────────────────────────────────────────────────────────
import { canonicalGoalFrom, type CanonicalGoal } from './energyPrescription';
import { strengthRequirement, type NutritionSnapshotV2 } from './adaptiveEnergyAuthority';
import {
  calibrationEffectiveFrom, checkinCalendarVerdict, nextCheckinOpenDate, planStartCalibration,
} from './adaptiveCheckinPlanner';
import type { NutritionCalibration, StoredAdaptiveCheckin } from './adaptiveCalibrationCore';

/** Objetivos que exigen experiencia de fuerza en el check-in (MB2). */
const EXPERIENCE_OBJECTIVES: readonly CanonicalGoal[] = ['MUSCLE_GAIN'];
/** Objetivos que exigen cintura en el check-in y en la línea base (MB2). */
const WAIST_OBJECTIVES: readonly CanonicalGoal[] = ['RECOMPOSITION'];
/** D2 · clave del perfil con la cintura (cm), capturada en onboarding / Mis datos para recomposición. */
export const WAIST_PROFILE_KEY = 'cintura';


/** Peso plausible: el MISMO rango que valida el perfil (`nutritionTargets.invalidField`). */
export const WEIGHT_KG_RANGE = { min: 30, max: 300 } as const;
/** Cintura plausible en cm. */
export const WAIST_CM_RANGE = { min: 40, max: 200 } as const;
export const isPlausibleWeightKg = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= WEIGHT_KG_RANGE.min && v <= WEIGHT_KG_RANGE.max;
export const isPlausibleWaistCm = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= WAIST_CM_RANGE.min && v <= WAIST_CM_RANGE.max;

/** Por qué el seguimiento no puede activarse (o seguir) — siempre algo que la persona puede entender. */
export type AdaptiveBlockReason =
  | 'STRENGTH_REQUIRED'      // ganar músculo / recomposición sin fuerza declarada
  | 'UNDERWEIGHT'            // CAPA 1: bajar grasa bloqueado por peso bajo para la estatura
  | 'FAT_LOSS_FLOOR'         // CAPA 1: la cifra de bajar grasa quedaría bajo el mínimo seguro
  | 'PROFILE_INCOMPLETE'     // faltan datos del perfil (incluido un peso válido)
  | 'WAIST_MISSING'          // D2 · recomposición sin cintura en el perfil
  | 'NOT_ELIGIBLE';          // el planificador del servidor rechaza el inicio por otra razón

export type AdaptiveEntryState =
  | { kind: 'HIDDEN' }                                       // calibración aún no leída o ilegible
  | { kind: 'BLOCKED'; reason: AdaptiveBlockReason }
  | { kind: 'STARTING'; weightKg: number; waistCm: number | null; objective: CanonicalGoal }   // se inicia solo con el perfil
  | { kind: 'CHECKIN_DUE'; needsWaist: boolean; needsExperience: boolean; pendingFrom: string | null }
  | { kind: 'WAITING'; nextCheckinFrom: string | null; pendingFrom: string | null };

export interface AdaptiveEntryInput {
  /** `energyState.status` del store (CAPA 1). */
  energyStatus: string | null;
  obData: unknown;
  adaptive: { load: 'IDLE' | 'LOADED' | 'UNAVAILABLE'; calibration: NutritionCalibration | null; checkins: readonly StoredAdaptiveCheckin[] };
  snapshot: NutritionSnapshotV2 | null;
  /** `start_date` del perfil; '' mientras no termina el onboarding (solo indica «onboarding terminado»). */
  startDate: string;
  /** Fecha local 'YYYY-MM-DD'. */
  today: string;
}

function objectiveOf(obData: unknown): CanonicalGoal | null {
  try { return canonicalGoalFrom((obData as Record<string, unknown> | null | undefined)?.goal); } catch { return null; }
}
const PRECHECK_REQUEST_ID = '00000000-0000-4000-8000-000000000000';

/** Estado de la tarjeta Adaptive. Puro. */
export function adaptiveEntryState(input: AdaptiveEntryInput): AdaptiveEntryState {
  const { energyStatus, obData, adaptive, snapshot, startDate, today } = input;
  if (adaptive.load !== 'LOADED') return { kind: 'HIDDEN' };
  // CAPA 1 primero: si la energía no está prescrita, el servidor rechaza tanto el inicio como el check-in.
  if (energyStatus === 'FAT_LOSS_BLOCKED') return { kind: 'BLOCKED', reason: 'UNDERWEIGHT' };
  if (energyStatus === 'OUTSIDE_HSC_FAT_LOSS_SCOPE') return { kind: 'BLOCKED', reason: 'FAT_LOSS_FLOOR' };
  if (energyStatus !== 'PRESCRIBED') return { kind: 'BLOCKED', reason: 'PROFILE_INCOMPLETE' };
  const objective = objectiveOf(obData);
  if (!objective) return { kind: 'BLOCKED', reason: 'PROFILE_INCOMPLETE' };
  if (strengthRequirement(objective, obData) === 'STRENGTH_REQUIRED') return { kind: 'BLOCKED', reason: 'STRENGTH_REQUIRED' };

  const cal = adaptive.calibration;
  const active = cal && cal.status === 'ACTIVE' && cal.objective === objective ? cal : null;
  if (!active) {
    if (!startDate) return { kind: 'HIDDEN' };                 // onboarding sin terminar
    const ob = obData as Record<string, unknown>;
    // D2 · recomposición: la cintura de partida sale del perfil; sin ella no se inicia.
    let waistCm: number | null = null;
    if (WAIST_OBJECTIVES.includes(objective)) {
      if (!isPlausibleWaistCm(ob[WAIST_PROFILE_KEY])) return { kind: 'BLOCKED', reason: 'WAIST_MISSING' };
      waistCm = ob[WAIST_PROFILE_KEY] as number;
    }
    const weightKg = ob.peso;
    if (!isPlausibleWeightKg(weightKg)) return { kind: 'BLOCKED', reason: 'PROFILE_INCOMPLETE' };
    // Pre-chequeo con el planificador del servidor: si él no aceptaría el inicio, no se ofrece y se explica.
    const plan = planStartCalibration({
      request: { requestId: PRECHECK_REQUEST_ID, localDate: today, weightKg, ...(waistCm != null ? { waistCm } : {}) },
      obData, energyStatus, active: cal && cal.status === 'ACTIVE' ? cal : null, serverUtcDate: today,
    });
    if (plan.kind === 'REJECT') {
      if (plan.reason === 'WAIST_REQUIRED' || plan.reason === 'INVALID_WAIST') return { kind: 'BLOCKED', reason: 'WAIST_MISSING' };
      if (plan.reason === 'STRENGTH_REQUIRED') return { kind: 'BLOCKED', reason: 'STRENGTH_REQUIRED' };
      return { kind: 'BLOCKED', reason: 'NOT_ELIGIBLE' };
    }
    return { kind: 'STARTING', weightKg, waistCm, objective };
  }

  const pendingFrom = snapshot?.calibration?.pending?.effectiveFrom ?? null;
  // D1 · la misma regla de calendario que aplica el servidor (ventana + ≥ 14 días reales).
  if (checkinCalendarVerdict(active, adaptive.checkins, today).ok) {
    return { kind: 'CHECKIN_DUE', needsWaist: WAIST_OBJECTIVES.includes(objective), needsExperience: EXPERIENCE_OBJECTIVES.includes(objective), pendingFrom };
  }
  return { kind: 'WAITING', nextCheckinFrom: nextCheckinOpenDate(active, adaptive.checkins, today), pendingFrom };
}

// ── Traducción de la respuesta del servidor ─────────────────────────────────
export type AdaptiveResult =
  | { kind: 'STARTED' }
  | { kind: 'KEEP' }                                         // MAINTAIN / NO_ADJUSTMENT
  | { kind: 'ADJUST'; effectiveFrom: string | null }       // STEP_UP / STEP_DOWN: rige el domingo ≥ fecha del check-in
  | { kind: 'REVIEW' }
  | { kind: 'UNDERWEIGHT' }                                  // check-in registrado, pero el peso declarado bloquea bajar grasa
  | { kind: 'STRENGTH_REQUIRED' }
  | { kind: 'NOT_DUE' }
  | { kind: 'NOT_ELIGIBLE' }
  | { kind: 'INVALID_INPUT' }
  | { kind: 'ERROR' };

/**
 * Traduce la respuesta de la Edge. La UI no decide: solo nombra lo que el servidor decidió.
 * `energyStatusAfter` (opcional) es el estado de CAPA 1 del STORE después de la respuesta (el cliente
 * ya aplicó el peso que fijó el servidor y el store recalculó): si quedó `FAT_LOSS_BLOCKED`, un
 * check-in aceptado NO se presenta como «se mantiene» sino con su causa. Puro.
 */
export function adaptiveResultFrom(
  body: Record<string, unknown> | null | undefined, checkinDate: string, energyStatusAfter?: string | null,
): AdaptiveResult {
  const underweight = energyStatusAfter === 'FAT_LOSS_BLOCKED';
  switch (body?.status) {
    case 'STARTED': case 'ALREADY_ACTIVE': return { kind: 'STARTED' };
    case 'RECORDED': {
      if (underweight) return { kind: 'UNDERWEIGHT' };
      switch (body.action) {
        case 'STEP_UP': case 'STEP_DOWN': return { kind: 'ADJUST', effectiveFrom: calibrationEffectiveFrom(checkinDate) };
        case 'MAINTAIN': case 'NO_ADJUSTMENT': return { kind: 'KEEP' };
        case 'REVIEW': return { kind: 'REVIEW' };
        default: return { kind: 'ERROR' };
      }
    }
    case 'STRENGTH_REQUIRED': return { kind: 'STRENGTH_REQUIRED' };
    case 'NOT_DUE': case 'DUPLICATE_CYCLE': case 'OUT_OF_ORDER': case 'TOO_SOON': return { kind: 'NOT_DUE' };
    case 'NOT_ELIGIBLE': case 'OBJECTIVE_UNRESOLVED': case 'OBJECTIVE_CHANGED': case 'NO_ACTIVE_CALIBRATION':
      return underweight ? { kind: 'UNDERWEIGHT' } : { kind: 'NOT_ELIGIBLE' };
    case 'INVALID_WEIGHT': case 'INVALID_WAIST': case 'WAIST_REQUIRED': case 'CHECKIN_INVALID': case 'CHECKIN_INCOMPLETE': return { kind: 'INVALID_INPUT' };
    default: return { kind: 'ERROR' };
  }
}
