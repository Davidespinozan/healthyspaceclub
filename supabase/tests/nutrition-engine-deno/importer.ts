// Importador de prueba del motor generado, tal como lo verá una Edge Function.
// `deno check` debe PASAR: si los tipos se perdieran (any, status: string, uniones
// sin estrechar), fallan las aserciones de compile-time y los @ts-expect-error.
// Se ejecuta con supabase/tests/nutrition-engine-deno/check.sh. No es parte del build.
import {
  assessTrajectory,
  validateNutritionCheckin,
  decideAdaptiveNutrition,
  resolveNutritionEnergyState,
  buildEnergySnapshot,
  resolveMacroPrescription,
  prescribeMacros,
  type AdaptiveAction,
  type AdaptiveDecisionInput,
  type AdaptiveDecisionResult,
  type AdaptiveReason,
  type FatLossRate,
  type MacroPrescription,
  type MacroResolution,
  type NutritionCheckinInput,
  type NutritionCheckinValidation,
  type NutritionEnergyState,
  type TrajectoryInput,
  type TrajectoryResult,
} from '../../functions/_shared/nutritionEngine.generated.js';

// ── utilidades de aserción en compile-time ──────────────────────────────────
type IsAny<T> = 0 extends 1 & T ? true : false;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;
type NotAny<T> = IsAny<T> extends true ? false : true;

// ── MB1 · trayectoria ───────────────────────────────────────────────────────
const t = assessTrajectory({ objective: 'FAT_LOSS', previousWeightKg: 70, currentWeightKg: 69.3, elapsed: { elapsedDays: 14 } });
type _T1 = Expect<Equal<typeof t, TrajectoryResult>>;
type _T2 = Expect<Equal<Parameters<typeof assessTrajectory>[0], TrajectoryInput>>;
type _T3 = Expect<Equal<TrajectoryResult['status'], 'INVALID_INPUT' | 'ASSESSED'>>;
type _T4 = Expect<NotAny<TrajectoryInput['objective']>>;
let rate: FatLossRate | null = null;
if (t.status === 'ASSESSED' && t.sufficiency === 'SUFFICIENT_FOR_DECISION' && t.classification.objective === 'FAT_LOSS') {
  rate = t.classification.rate; // solo existe tras estrechar la unión
}
// @ts-expect-error · status no es un string libre
const _badStatus: TrajectoryResult['status'] = 'WHATEVER';
// @ts-expect-error · `classification` no existe sin estrechar
t.classification;

// ── MB2 · check-in ──────────────────────────────────────────────────────────
const input: NutritionCheckinInput = {
  objective: 'FAT_LOSS', weightKg: 69.3, adherenceAnswer: 'PRACTICALLY_ALL', hunger: 'NORMAL', energy: 'NORMAL', performance: 'SAME', checkinDate: '2026-10-18',
};
const c = validateNutritionCheckin(input);
type _C1 = Expect<Equal<typeof c, NutritionCheckinValidation>>;
type _C2 = Expect<Equal<NutritionCheckinValidation['status'], 'VALID' | 'INCOMPLETE' | 'INVALID'>>;
let band: 'HIGH' | 'MEDIUM' | 'LOW' | null = null;
if (c.status === 'VALID') band = c.checkin.adherence.band;
// @ts-expect-error · `checkin` solo existe en VALID
c.checkin;

// ── MB3 · decisión adaptativa ───────────────────────────────────────────────
const decisionInput: AdaptiveDecisionInput = { objective: 'FAT_LOSS', trajectory: t, checkin: c, currentStep: 0, cycleIndex: 1, previous: null };
const d = decideAdaptiveNutrition(decisionInput);
type _D1 = Expect<Equal<typeof d, AdaptiveDecisionResult>>;
type _D2 = Expect<NotAny<typeof d>>;
let action: AdaptiveAction | null = null;
let reason: AdaptiveReason | null = null;
if (d.status === 'DECIDED') { action = d.decision.action; reason = d.decision.reason; }
type _D3 = Expect<Equal<AdaptiveAction, 'MAINTAIN' | 'STEP_UP' | 'STEP_DOWN' | 'REVIEW' | 'NO_ADJUSTMENT'>>;
// @ts-expect-error · una acción inventada no es AdaptiveAction
const _badAction: AdaptiveAction = 'BAJAR';

// ── CAPA 1 · energía · y CAPA 2 · macros ────────────────────────────────────
const ob = { sex: 'Hombre', goal: 'Bajar grasa', edad: 30, estatura: 180, peso: 80, embarazo: 0, requiresTherapeuticDiet: 0, dailyLife: 'DL2', trainsHabitually: 1, trainingDaysPerWeek: 4, trainingSessionMinutes: 60 };
const energy = resolveNutritionEnergyState(ob);
type _E1 = Expect<Equal<typeof energy, NutritionEnergyState>>;
type _E2 = Expect<NotAny<NutritionEnergyState['status']>>;
let kcal: number | null = null;
if (energy.status === 'PRESCRIBED') { const k: number = energy.prescribedEnergy; kcal = k; } // estrechado → number
// fuera de PRESCRIBED la fuente lo declara `prescribedEnergy?: undefined`
type _E4 = Expect<Equal<typeof energy.prescribedEnergy, number | undefined>>;
const { snapshot } = buildEnergySnapshot(ob, '2026-10-05T12:00:00.000Z');
type _E3 = Expect<NotAny<typeof snapshot>>;
const macros = resolveMacroPrescription(energy, ob);
type _M1 = Expect<Equal<typeof macros, MacroResolution>>;
const m = prescribeMacros({ energyKcal: 2100, goal: 'FAT_LOSS', weightKg: 80, heightCm: 180, activityClass: 'MIXED', trainingBand: 'T2' });
type _M2 = Expect<Equal<typeof m, MacroPrescription>>;
let proteinG: number | null = null;
if (m.status === 'VALID' || m.status === 'REVIEW') { const g: number = m.proteinG; proteinG = g; } // estrechado → number
// SPORTS_SCOPE lo declara `proteinG?: undefined`
type _M3 = Expect<Equal<typeof m.proteinG, number | undefined>>;
type _M4 = Expect<Equal<MacroPrescription['status'], 'VALID' | 'REVIEW' | 'INFEASIBLE' | 'SPORTS_SCOPE'>>;

// Llamadas con argumentos inválidos: solo para el checker, nunca se ejecutan.
export function _compileTimeOnly(): void {
  // @ts-expect-error · el objetivo está tipado
  assessTrajectory({ objective: 'BULK', previousWeightKg: 70, currentWeightKg: 69, elapsed: { elapsedDays: 14 } });
  // @ts-expect-error · la decisión exige currentStep
  decideAdaptiveNutrition({ objective: 'FAT_LOSS', trajectory: t, checkin: c, cycleIndex: 1, previous: null });
  // @ts-expect-error · la banda de entrenamiento está tipada
  prescribeMacros({ energyKcal: 2100, goal: 'FAT_LOSS', weightKg: 80, heightCm: 180, activityClass: 'MIXED', trainingBand: 'T9' });
}

// Uso en runtime (sin permisos): mismos valores que en src.
console.log(JSON.stringify({ rate, band, action, reason, kcal, proteinG, snapshotStatus: snapshot.status }));
