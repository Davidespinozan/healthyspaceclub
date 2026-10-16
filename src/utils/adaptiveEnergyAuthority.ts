// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE NUTRITION · BLOQUES 6–8 · AUTORIDAD DE ENERGÍA EFECTIVA (pura)
//
// Une CAPA 1 (energía base del perfil) con la calibración adaptativa persistida por el SERVIDOR
// (`nutrition_calibrations` + `nutrition_adaptive_checkins`, escritas solo por la Edge) y la fecha
// de hoy, y decide QUÉ energía manda en nutrición:
//
//   · BASE        · CAPA 1 tal cual (sin calibración, o calibración no verificable, o el objetivo
//                   cambió, o falta fuerza declarada en ganancia/recomposición). Exactamente como antes.
//   · CALIBRATED  · base congelada CRUDA × (1 + 0.05 × step EFECTIVO), redondeada una vez.
//
// STEP EFECTIVO (D-B5-SUNDAY) · el paso decidido en un check-in entra en vigor el primer domingo
// IGUAL O POSTERIOR a su `checkin_date`. `current_step` en la base es el paso DECIDIDO; el que manda
// hoy se deriva recorriendo la cadena de check-ins por fecha. Nunca se usa un paso futuro.
//
// VERIFICACIÓN · la cadena debe cuadrar: cada check-in parte del paso decidido anterior
// (`previous_step`), y el último decidido coincide con `current_step`. Cualquier incoherencia →
// UNVERIFIABLE → no se adopta (energía BASE).
//
// FUERZA (Bloque 7, decisión cerrada) · MUSCLE_GAIN y RECOMPOSITION exigen `strength` DECLARADO en
// las modalidades de entrenamiento. Una clase de actividad MIXED por sí sola no basta, ni se infiere
// del uso de la app. Sin ella el estado es STRENGTH_REQUIRED y no se adopta energía adaptativa.
//
// SNAPSHOT V2 · objeto DERIVADO (no persistido): todo lo que contiene se reconstruye de autoridades
// ya persistidas (perfil + calibración + check-ins) y de la fecha. No requiere schema.
//
// Puro / determinista / sin estado: recibe `today` ('YYYY-MM-DD', fecha local del socio). Forma parte
// del motor compartido (bundle de Edge Functions): servidor y cliente aplican las MISMAS reglas.
// ─────────────────────────────────────────────────────────────────────────────
import { CANONICAL_GOALS, type CanonicalGoal } from './energyPrescription';
import { currentEngineVersions, type NutritionEnergyState, type EnergySnapshotVersions } from './nutritionEnergyState';
import { readTrainingModalities } from './trainingModality';
import { MACRO_PRESCRIPTION_VERSION } from './macroPrescription';
import { ADAPTIVE_DECISION_VERSION } from './adaptiveNutritionDecision';
import { ENERGY_CALIBRATION_VERSION, type NutritionCalibration, type StoredAdaptiveCheckin } from './adaptiveCalibrationCore';
import { calibratedEnergy, CALIBRATION_ENERGY_VERSION } from './adaptiveCalibrationEnergy';

export const NUTRITION_SNAPSHOT_VERSION = 2;

// ── Fechas (solo 'YYYY-MM-DD', aritmética UTC sobre el día) ─────────────────
const DAY_MS = 86_400_000;
function ymdToDay(s: unknown): number | null {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return null;
  return t / DAY_MS;
}
const dayToYmd = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);
/** Primer domingo IGUAL O POSTERIOR (misma regla que `calibrationEffectiveFrom` del planificador). */
export function effectiveFromForCheckin(checkinDate: string): string | null {
  const d = ymdToDay(checkinDate);
  if (d == null) return null;
  return dayToYmd(d + ((7 - new Date(d * DAY_MS).getUTCDay()) % 7));
}

// ── Bloque 7 · fuerza declarada ─────────────────────────────────────────────
export type StrengthRequirement = 'NOT_REQUIRED' | 'SATISFIED' | 'STRENGTH_REQUIRED';
/** Objetivos cuya calibración adaptativa EXIGE entrenamiento de fuerza declarado. */
export const STRENGTH_REQUIRED_OBJECTIVES: readonly CanonicalGoal[] = ['MUSCLE_GAIN', 'RECOMPOSITION'];

/**
 * ¿El objetivo exige fuerza y el perfil la DECLARA? Solo cuenta la modalidad explícita `strength`;
 * la clase MIXED (varias modalidades sin fuerza), «no entreno», un valor ilegible o la ausencia de
 * declaración NO bastan. Puro.
 */
export function strengthRequirement(objective: CanonicalGoal | null | undefined, obData: unknown): StrengthRequirement {
  if (!objective || !STRENGTH_REQUIRED_OBJECTIVES.includes(objective)) return 'NOT_REQUIRED';
  const ob = (obData ?? {}) as Record<string, unknown>;
  const trains = ob.trainsHabitually === 1 || ob.trainsHabitually === true || ob.trainsHabitually === '1';
  const read = readTrainingModalities(ob.trainingModalities);
  return trains && read.kind === 'DECLARED' && read.modalities.includes('strength') ? 'SATISFIED' : 'STRENGTH_REQUIRED';
}

// ── Bloque 6 · paso efectivo ────────────────────────────────────────────────
export type EffectiveStepResult =
  | { ok: true; decidedStep: number; effectiveStep: number;
      /** Domingo desde el que rige `effectiveStep` (null = paso 0 de la apertura). */
      effectiveFrom: string | null;
      /** Paso ya decidido que aún NO rige (entra en vigor en `effectiveFrom`). */
      pending: { step: number; effectiveFrom: string; checkinId: string } | null }
  | { ok: false; reason: 'INVALID_TODAY' | 'CHAIN_BROKEN' | 'CURRENT_STEP_MISMATCH' | 'FOREIGN_CHECKIN' | 'INVALID_CHECKIN_DATE' };

/**
 * Paso que RIGE `today`. Recorre los check-ins de la calibración en orden de ciclo verificando la
 * cadena (cada uno parte del decidido anterior); un paso solo rige desde su domingo efectivo.
 */
export function deriveEffectiveStep(calibration: NutritionCalibration, checkins: readonly StoredAdaptiveCheckin[], today: string): EffectiveStepResult {
  const t = ymdToDay(today);
  if (t == null) return { ok: false, reason: 'INVALID_TODAY' };
  if (checkins.some((c) => c.calibrationId !== calibration.id)) return { ok: false, reason: 'FOREIGN_CHECKIN' };
  const ordered = [...checkins].sort((a, b) => a.cycleIndex - b.cycleIndex);
  let decided = 0;
  let effective = 0;
  let effectiveFrom: string | null = null;
  let pending: { step: number; effectiveFrom: string; checkinId: string } | null = null;
  for (const c of ordered) {
    if (c.previousStep !== decided) return { ok: false, reason: 'CHAIN_BROKEN' };
    const from = effectiveFromForCheckin(c.checkinDate);
    if (from == null) return { ok: false, reason: 'INVALID_CHECKIN_DATE' };
    decided = c.proposedStep;
    if (ymdToDay(from)! <= t) {
      effective = c.proposedStep;
      effectiveFrom = from;
      pending = null;
    } else {
      pending = c.proposedStep !== effective ? { step: c.proposedStep, effectiveFrom: from, checkinId: c.id } : null;
    }
  }
  if (decided !== calibration.currentStep) return { ok: false, reason: 'CURRENT_STEP_MISMATCH' };
  return { ok: true, decidedStep: decided, effectiveStep: effective, effectiveFrom, pending };
}

// ── Snapshot V2 ─────────────────────────────────────────────────────────────
export type AdaptiveEnergyStatus =
  | 'NO_CALIBRATION'      // sin calibración activa: CAPA 1
  | 'ADOPTED'             // calibración verificada: energía calibrada (step 0 incluido)
  | 'NOT_ADOPTED'         // calibración presente pero no verificable / no aplicable: CAPA 1
  | 'STRENGTH_REQUIRED'   // ganancia/recomposición sin fuerza declarada: CAPA 1, sin adaptación
  | 'UNAVAILABLE'         // no se pudo LEER la calibración (red): CAPA 1, sin regenerar el plan
  | 'NO_ENERGY';          // CAPA 1 no prescribe: no hay cifra

export type NotAdoptedReason =
  | 'CALIBRATION_CLOSED' | 'UNSUPPORTED_CALIBRATION_VERSION' | 'BASE_NOT_FROZEN' | 'OBJECTIVE_CHANGED'
  | 'INVALID_STEP' | 'SAFETY_FLOOR_REACHED' | 'INVALID_BASE'
  | 'INVALID_TODAY' | 'CHAIN_BROKEN' | 'CURRENT_STEP_MISMATCH' | 'FOREIGN_CHECKIN' | 'INVALID_CHECKIN_DATE';

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
  base: { rawEnergy: number | null; prescribedEnergy: number | null };
  /** La energía que MANDA (kcal enteras) y su crudo. `null` sin prescripción. */
  effective: { rawEnergy: number | null; energy: number | null };
  calibration: null | {
    id: string; version: number; objective: CanonicalGoal;
    /** Base congelada CRUDA de la calibración (no la de CAPA 1 actual). */
    frozenBaseRawEnergy: number | null;
    decidedStep: number | null; effectiveStep: number | null; effectiveFrom: string | null;
    pending: { step: number; effectiveFrom: string } | null;
  };
  strength: StrengthRequirement;
  versions: { snapshot: number; energy: EnergySnapshotVersions; macros: number; calibration: number; calibrationEnergy: number; adaptiveDecision: number };
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
export function resolveEffectiveNutritionEnergy(input: AdaptiveEnergyInput): NutritionSnapshotV2 {
  const { state, obData, calibration, checkins, today } = input;
  const prescribed = state?.status === 'PRESCRIBED';
  const objective = prescribed && isGoal(state.goal) ? state.goal : null;
  const weight = Number((obData as Record<string, unknown> | null | undefined)?.peso);
  const baseRaw = prescribed ? state.rawPrescribedEnergy ?? null : null;
  const basePrescribed = prescribed ? state.prescribedEnergy ?? null : null;
  const strength = strengthRequirement(objective, obData);
  const snap = (over: Partial<NutritionSnapshotV2>): NutritionSnapshotV2 => ({
    version: NUTRITION_SNAPSHOT_VERSION, today, source: 'BASE', status: 'NO_CALIBRATION', notAdoptedReason: null,
    objective, nutritionWeightKg: Number.isFinite(weight) && weight > 0 ? weight : null,
    base: { rawEnergy: baseRaw, prescribedEnergy: basePrescribed },
    effective: { rawEnergy: baseRaw, energy: basePrescribed },
    calibration: calibration ? calSummary(calibration) : null,
    strength,
    versions: { snapshot: NUTRITION_SNAPSHOT_VERSION, energy: currentEngineVersions(), macros: MACRO_PRESCRIPTION_VERSION,
      calibration: ENERGY_CALIBRATION_VERSION, calibrationEnergy: CALIBRATION_ENERGY_VERSION, adaptiveDecision: ADAPTIVE_DECISION_VERSION },
    ...over,
  });

  if (!prescribed || basePrescribed == null) return snap({ status: 'NO_ENERGY', effective: { rawEnergy: null, energy: null } });
  if (calibration === undefined) return snap({ status: 'UNAVAILABLE' });
  if (calibration === null) return snap({ status: 'NO_CALIBRATION' });

  const notAdopted = (reason: NotAdoptedReason) => snap({ status: 'NOT_ADOPTED', notAdoptedReason: reason });
  if (calibration.status !== 'ACTIVE') return notAdopted('CALIBRATION_CLOSED');
  if (calibration.calibrationVersion !== ENERGY_CALIBRATION_VERSION) return notAdopted('UNSUPPORTED_CALIBRATION_VERSION');
  if (calibration.baseEnergyRaw == null) return notAdopted('BASE_NOT_FROZEN');
  if (objective !== calibration.objective) return notAdopted('OBJECTIVE_CHANGED');
  if (strength === 'STRENGTH_REQUIRED') return snap({ status: 'STRENGTH_REQUIRED' });

  const step = deriveEffectiveStep(calibration, checkins, today);
  if (!step.ok) return notAdopted(step.reason);
  const e = calibratedEnergy(calibration.baseEnergyRaw, step.effectiveStep);
  if (e.status !== 'CALIBRATED') return notAdopted(e.reason === 'STEP_OUT_OF_RANGE' ? 'INVALID_STEP' : e.reason);

  return snap({
    source: 'CALIBRATED', status: 'ADOPTED',
    effective: { rawEnergy: e.rawCalibratedEnergy, energy: e.calibratedEnergy },
    calibration: { ...calSummary(calibration), decidedStep: step.decidedStep, effectiveStep: step.effectiveStep, effectiveFrom: step.effectiveFrom,
      pending: step.pending ? { step: step.pending.step, effectiveFrom: step.pending.effectiveFrom } : null },
  });
}

function calSummary(c: NutritionCalibration): NonNullable<NutritionSnapshotV2['calibration']> {
  return { id: c.id, version: c.calibrationVersion, objective: c.objective, frozenBaseRawEnergy: c.baseEnergyRaw,
    decidedStep: c.currentStep, effectiveStep: null, effectiveFrom: null, pending: null };
}
const isGoal = (g: unknown): g is CanonicalGoal => typeof g === 'string' && (CANONICAL_GOALS as readonly string[]).includes(g);
