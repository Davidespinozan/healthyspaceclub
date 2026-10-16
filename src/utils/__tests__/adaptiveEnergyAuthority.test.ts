import { describe, it, expect } from 'vitest';
import {
  resolveEffectiveNutritionEnergy, deriveEffectiveStep, strengthRequirement, effectiveFromForCheckin, NUTRITION_SNAPSHOT_VERSION,
} from '../adaptiveEnergyAuthority';
import { planCheckin, planStartCalibration, calibrationEffectiveFrom, type CheckinPlan } from '../adaptiveCheckinPlanner';
import { checkinFromRow, ENERGY_CALIBRATION_VERSION, type NutritionCalibration, type StoredAdaptiveCheckin } from '../adaptiveCalibrationCore';
import { calibratedEnergy } from '../adaptiveCalibrationEnergy';
import { resolveNutritionEnergyState } from '../nutritionEnergyState';
import { resolveMacroPrescription, MACRO_PRESCRIPTION_VERSION } from '../macroPrescription';
import { weeklyPlanCurrentness } from '../weeklyPlanState';
import { PLAN_ENGINE_VERSION } from '../planEngine';
import { ENERGY_PRESCRIPTION_VERSION } from '../energyPrescription';

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE BLOQUES 6–8 · autoridad de energía efectiva. Las filas de check-in las produce el
// PLANIFICADOR REAL del servidor (planCheckin → payload → checkinFromRow), y la cadena se aplica como
// lo hace la RPC (current_step = proposed_step). Fechas: 2026-10-18 y 2026-10-25 son domingos.
// ─────────────────────────────────────────────────────────────────────────────

const OB = { sex: 'Hombre', goal: 'Bajar grasa', edad: 30, estatura: 180, peso: 70, embarazo: 0, requiresTherapeuticDiet: 0,
  dailyLife: 'DL2', trainsHabitually: 1, trainingDaysPerWeek: 4, trainingSessionMinutes: 60, trainingModalities: 'strength' };
const GOAL = { FAT_LOSS: 'Bajar grasa', MUSCLE_GAIN: 'Ganar músculo', RECOMPOSITION: 'Recomposición', MAINTENANCE: 'Bienestar integral' } as const;
const ob = (g: keyof typeof GOAL = 'FAT_LOSS', extra: Record<string, unknown> = {}) => ({ ...OB, goal: GOAL[g], ...extra });
const stateOf = (o: Record<string, unknown>) => resolveNutritionEnergyState(o as never);
const BASE = stateOf(ob()).rawPrescribedEnergy!;

function calibration(over: Partial<NutritionCalibration> = {}): NutritionCalibration {
  return { id: 'cal-1', objective: 'FAT_LOSS', status: 'ACTIVE', baselineDate: '2026-10-04', cycleStart: '2026-10-04', baselineWeightKg: 70,
    baselineWaistCm: null, currentStep: 0, baseEnergyKcal: null, baseEnergyRaw: BASE, lastCheckinId: null, lastAppliedAction: null,
    lastAppliedAt: null, calibrationVersion: ENERGY_CALIBRATION_VERSION, createdAt: '', closedAt: null, ...over };
}
let seq = 0;
/** Servidor simulado: planificador REAL + la transición de la RPC. */
function server(cal0: NutritionCalibration = calibration(), obData: Record<string, unknown> = ob()) {
  let cal = cal0;
  const rows: StoredAdaptiveCheckin[] = [];
  return {
    get cal() { return cal; },
    rows,
    checkin(date: string, weightKg: number, extra: Record<string, unknown> = {}): CheckinPlan {
      const plan = planCheckin({ request: { requestId: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`, localDate: date, weightKg,
        adherenceAnswer: 'PRACTICALLY_ALL', hunger: 'NORMAL', energy: 'NORMAL', performance: 'SAME', ...extra },
        obData: { ...obData, peso: weightKg }, energyStatus: 'PRESCRIBED', calibration: cal, history: rows, serverUtcDate: date });
      if (plan.kind === 'RECORD') {
        const id = `c-${rows.length + 1}`;
        rows.push(checkinFromRow({ ...plan.payload, id, calibration_id: cal.id, created_at: '' })!);
        cal = { ...cal, currentStep: plan.decision.proposedStep, lastCheckinId: id };
      }
      return plan;
    },
    energyOn(today: string, o: Record<string, unknown> = obData) {
      return resolveEffectiveNutritionEnergy({ state: stateOf(o), obData: o, calibration: cal, checkins: rows, today });
    },
  };
}
const decided = (p: CheckinPlan) => { if (p.kind !== 'RECORD') throw new Error(JSON.stringify(p)); return p.decision; };
const kcal = (step: number, base = BASE) => { const r = calibratedEnergy(base, step); if (r.status !== 'CALIBRATED') throw new Error('floor'); return r.calibratedEnergy; };

describe('BLOQUE 6 · autoridad de energía efectiva', () => {
  it('sin calibración → CAPA 1 exactamente (comportamiento anterior)', () => {
    const s = stateOf(ob());
    const snap = resolveEffectiveNutritionEnergy({ state: s, obData: ob(), calibration: null, checkins: [], today: '2026-10-21' });
    expect(snap).toMatchObject({ version: NUTRITION_SNAPSHOT_VERSION, source: 'BASE', status: 'NO_CALIBRATION',
      effective: { rawEnergy: s.rawPrescribedEnergy, energy: s.prescribedEnergy }, base: { prescribedEnergy: s.prescribedEnergy } });
  });
  it('calibración activa en paso 0 → energía de la base CONGELADA', () => {
    const snap = server().energyOn('2026-10-21');
    expect(snap).toMatchObject({ source: 'CALIBRATED', status: 'ADOPTED', effective: { energy: Math.round(BASE) },
      calibration: { decidedStep: 0, effectiveStep: 0, effectiveFrom: null, pending: null, frozenBaseRawEnergy: BASE } });
  });
  it('paso decidido a futuro → rige el anterior; el domingo efectivo → rige el nuevo', () => {
    const s = server();
    expect(decided(s.checkin('2026-10-21', 69.9))).toMatchObject({ action: 'STEP_DOWN', proposedStep: -1 });  // miércoles
    expect(effectiveFromForCheckin('2026-10-21')).toBe('2026-10-25');
    for (const d of ['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24']) {
      expect(s.energyOn(d), d).toMatchObject({ effective: { energy: kcal(0) }, calibration: { decidedStep: -1, effectiveStep: 0, pending: { step: -1, effectiveFrom: '2026-10-25' } } });
    }
    for (const d of ['2026-10-25', '2026-10-26', '2026-11-01']) {
      expect(s.energyOn(d), d).toMatchObject({ effective: { energy: kcal(-1) }, calibration: { decidedStep: -1, effectiveStep: -1, effectiveFrom: '2026-10-25', pending: null } });
    }
  });
  it('check-in EN domingo → rige ese mismo domingo', () => {
    const s = server();
    decided(s.checkin('2026-10-18', 69.9));
    expect(s.energyOn('2026-10-18').calibration).toMatchObject({ effectiveStep: -1, effectiveFrom: '2026-10-18' });
    expect(s.energyOn('2026-10-17').calibration).toMatchObject({ effectiveStep: 0 });
  });
  it('no verificable → no se adopta (CAPA 1)', () => {
    const s = server();
    decided(s.checkin('2026-10-21', 69.9));
    const st = stateOf(ob());
    const nope = (calibrationOver: Partial<NutritionCalibration>, rows = s.rows) =>
      resolveEffectiveNutritionEnergy({ state: st, obData: ob(), calibration: { ...s.cal, ...calibrationOver }, checkins: rows, today: '2026-10-26' });
    expect(nope({ currentStep: 0 })).toMatchObject({ source: 'BASE', status: 'NOT_ADOPTED', notAdoptedReason: 'CURRENT_STEP_MISMATCH', effective: { energy: st.prescribedEnergy } });
    expect(nope({}, [{ ...s.rows[0], previousStep: 1 }])).toMatchObject({ status: 'NOT_ADOPTED', notAdoptedReason: 'CHAIN_BROKEN' });
    expect(nope({}, [{ ...s.rows[0], calibrationId: 'otra' }])).toMatchObject({ status: 'NOT_ADOPTED', notAdoptedReason: 'FOREIGN_CHECKIN' });
    expect(nope({ baseEnergyRaw: null })).toMatchObject({ status: 'NOT_ADOPTED', notAdoptedReason: 'BASE_NOT_FROZEN' });
    expect(nope({ calibrationVersion: 1 })).toMatchObject({ status: 'NOT_ADOPTED', notAdoptedReason: 'UNSUPPORTED_CALIBRATION_VERSION' });
    expect(nope({ status: 'CLOSED' })).toMatchObject({ status: 'NOT_ADOPTED', notAdoptedReason: 'CALIBRATION_CLOSED' });
    expect(resolveEffectiveNutritionEnergy({ state: st, obData: ob(), calibration: s.cal, checkins: s.rows, today: 'mañana' }))
      .toMatchObject({ status: 'NOT_ADOPTED', notAdoptedReason: 'INVALID_TODAY' });
  });
  it('objetivo del perfil distinto del de la calibración → no se adopta', () => {
    const s = server();
    expect(s.energyOn('2026-10-26', ob('MAINTENANCE'))).toMatchObject({ source: 'BASE', status: 'NOT_ADOPTED', notAdoptedReason: 'OBJECTIVE_CHANGED' });
  });
  it('calibración ilegible (red) → UNAVAILABLE: CAPA 1 provisional y el plan NO se juzga', () => {
    const st = stateOf(ob());
    const snap = resolveEffectiveNutritionEnergy({ state: st, obData: ob(), calibration: undefined, checkins: [], today: '2026-10-26' });
    expect(snap).toMatchObject({ source: 'BASE', status: 'UNAVAILABLE', effective: { energy: st.prescribedEnergy } });
    const plan = { days: [{}], engineVersion: PLAN_ENGINE_VERSION, gen: { kcal: 1, protG: 1, fatG: 1, carbG: 1 } };
    expect(weeklyPlanCurrentness({ status: 'PRESCRIBED', planGoal: st.prescribedEnergy!, macros: { proteinG: 2, fatG: 2, carbG: 2 }, weeklyPlan: plan, currentVersion: PLAN_ENGINE_VERSION, adaptiveUnavailable: true })).toBe('NOT_CURRENT');
  });
  it('sin prescripción de CAPA 1 → NO_ENERGY (no hay cifra que calibrar)', () => {
    const out = resolveEffectiveNutritionEnergy({ state: stateOf({ ...ob(), peso: 50 }), obData: { ...ob(), peso: 50 }, calibration: calibration(), checkins: [], today: '2026-10-26' });
    expect(out).toMatchObject({ status: 'NO_ENERGY', effective: { energy: null } });
  });
  it('el snapshot lleva las macros que corresponden a la energía efectiva (mismas fórmulas y versión)', () => {
    const s = server();
    decided(s.checkin('2026-10-21', 69.9));
    const snap = s.energyOn('2026-10-25');
    const o = { ...ob(), peso: 69.9 };
    const r = resolveMacroPrescription(stateOf(o), o as never, snap.effective.energy);
    expect(r.kind === 'RESOLVED' && r.prescription.energyKcal).toBe(kcal(-1));
    expect(r.kind === 'RESOLVED' && r.prescription.version).toBe(MACRO_PRESCRIPTION_VERSION);
    expect(snap.versions).toMatchObject({ snapshot: 2, macros: MACRO_PRESCRIPTION_VERSION, calibration: ENERGY_CALIBRATION_VERSION });
    expect(snap.versions.energy.prescription).toBe(ENERGY_PRESCRIPTION_VERSION);
  });
  it('deriveEffectiveStep · misma regla de domingo que el planificador del servidor', () => {
    for (const d of ['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-22', '2026-10-24']) expect(effectiveFromForCheckin(d)).toBe(calibrationEffectiveFrom(d));
    expect(deriveEffectiveStep(calibration(), [], '2026-10-20')).toEqual({ ok: true, decidedStep: 0, effectiveStep: 0, effectiveFrom: null, pending: null });
  });
});

describe('BLOQUE 7 · STRENGTH_REQUIRED', () => {
  it('FAT_LOSS y MAINTENANCE no lo exigen', () => {
    expect(strengthRequirement('FAT_LOSS', { trainsHabitually: 0 })).toBe('NOT_REQUIRED');
    expect(strengthRequirement('MAINTENANCE', { trainsHabitually: 0 })).toBe('NOT_REQUIRED');
  });
  it.each(['MUSCLE_GAIN', 'RECOMPOSITION'] as const)('%s: sin fuerza → STRENGTH_REQUIRED; MIXED sin strength no basta; strength explícito sí', (g) => {
    expect(strengthRequirement(g, { trainsHabitually: 0, trainingModalities: '' })).toBe('STRENGTH_REQUIRED');
    expect(strengthRequirement(g, { trainsHabitually: 1 })).toBe('STRENGTH_REQUIRED');                                   // sin declarar
    expect(strengthRequirement(g, { trainsHabitually: 1, trainingModalities: 'endurance,team_intermittent' })).toBe('STRENGTH_REQUIRED');   // clase MIXED
    expect(strengthRequirement(g, { trainsHabitually: 1, trainingModalities: 'algo-raro' })).toBe('STRENGTH_REQUIRED');   // ilegible
    expect(strengthRequirement(g, { trainsHabitually: 1, trainingModalities: 'strength' })).toBe('SATISFIED');
    expect(strengthRequirement(g, { trainsHabitually: 1, trainingModalities: 'strength,endurance' })).toBe('SATISFIED');
  });
  it('sin fuerza en ganancia/recomposición: la energía es CAPA 1, sin adaptación (no se inventa)', () => {
    const o = ob('MUSCLE_GAIN', { trainingModalities: 'endurance,team_intermittent' });
    const st = stateOf(o);
    const out = resolveEffectiveNutritionEnergy({ state: st, obData: o, calibration: calibration({ objective: 'MUSCLE_GAIN', currentStep: 0 }), checkins: [], today: '2026-10-26' });
    expect(out).toMatchObject({ source: 'BASE', status: 'STRENGTH_REQUIRED', strength: 'STRENGTH_REQUIRED', effective: { energy: st.prescribedEnergy } });
  });
  it('paridad servidor ↔ cliente: el planificador rechaza START y check-in con STRENGTH_REQUIRED', () => {
    for (const g of ['MUSCLE_GAIN', 'RECOMPOSITION'] as const) {
      const o = ob(g, { trainingModalities: 'endurance' });
      expect(planStartCalibration({ request: { requestId: 'aaaaaaaa-0000-4000-8000-000000000001', localDate: '2026-10-01', weightKg: 70, waistCm: 90 },
        obData: o, energyStatus: 'PRESCRIBED', active: null, serverUtcDate: '2026-10-01' })).toEqual({ kind: 'REJECT', reason: 'STRENGTH_REQUIRED' });
      const s = server(calibration({ objective: g, baselineWaistCm: 90 }), o);
      expect(s.checkin('2026-10-18', 70, { waistCm: 89.5, strengthExperience: 'INTERMEDIATE' })).toEqual({ kind: 'REJECT', reason: 'STRENGTH_REQUIRED' });
      expect(strengthRequirement(g, o)).toBe('STRENGTH_REQUIRED');
    }
    const okStart = planStartCalibration({ request: { requestId: 'aaaaaaaa-0000-4000-8000-000000000002', localDate: '2026-10-01', weightKg: 70 },
      obData: ob('MUSCLE_GAIN'), energyStatus: 'PRESCRIBED', active: null, serverUtcDate: '2026-10-01' });
    expect(okStart.kind).toBe('START');
    expect(planStartCalibration({ request: { requestId: 'aaaaaaaa-0000-4000-8000-000000000003', localDate: '2026-10-01', weightKg: 70 },
      obData: ob('FAT_LOSS', { trainsHabitually: 0, trainingModalities: '' }), energyStatus: 'PRESCRIBED', active: null, serverUtcDate: '2026-10-01' }).kind).toBe('START');
  });
});

describe('BLOQUE 8 · flujo completo check-in → decisión → paso efectivo → energía', () => {
  it('STEP_DOWN: −1 desde el domingo siguiente', () => {
    const s = server();
    expect(decided(s.checkin('2026-10-21', 69.9))).toMatchObject({ action: 'STEP_DOWN' });
    expect(s.energyOn('2026-10-24').effective.energy).toBe(kcal(0));
    expect(s.energyOn('2026-10-25').effective.energy).toBe(kcal(-1));
  });
  it('STEP_UP: +1 desde el domingo siguiente', () => {
    let found = false;
    for (const w of [69.2, 69.1, 69.0, 68.9, 68.8, 68.7, 68.6]) {
      const s = server();
      const d = decided(s.checkin('2026-10-21', w, { hunger: 'HIGH' }));
      if (d.action !== 'STEP_UP') continue;
      found = true;
      expect(s.energyOn('2026-10-24').effective.energy).toBe(kcal(0));
      expect(s.energyOn('2026-10-25').effective.energy).toBe(kcal(1));
      break;
    }
    expect(found, 'una pérdida rápida con hambre alta produce STEP_UP').toBe(true);
  });
  it('MAINTAIN y REVIEW no cambian la energía', () => {
    const m = server();
    const dm = decided(m.checkin('2026-10-21', 69.2));
    expect(['MAINTAIN', 'STEP_UP', 'STEP_DOWN', 'REVIEW', 'NO_ADJUSTMENT']).toContain(dm.action);
    if (dm.action === 'MAINTAIN') expect(m.energyOn('2026-10-26').effective.energy).toBe(kcal(0));
    // límite ±2: se llega a −2 con dos bajadas REALES; la tercera es REVIEW y la energía se queda en −2
    const r = server();
    decided(r.checkin('2026-10-18', 69.9));
    decided(r.checkin('2026-11-01', 69.85));
    expect(r.cal.currentStep).toBe(-2);
    expect(decided(r.checkin('2026-11-15', 69.8))).toMatchObject({ action: 'REVIEW', reason: 'CALIBRATION_LIMIT_REACHED', proposedStep: -2 });
    expect(r.energyOn('2026-11-22').effective.energy).toBe(kcal(-2));
    // un paso −2 SIN la cadena que lo justifique no es verificable: no se adopta
    expect(server(calibration({ currentStep: -2 })).energyOn('2026-10-26')).toMatchObject({ status: 'NOT_ADOPTED', notAdoptedReason: 'CURRENT_STEP_MISMATCH' });
  });
  it('reversión bloqueada: tras un STEP_DOWN aplicado, un STEP_UP inmediato es REVIEW y no cambia la energía', () => {
    const s = server();
    decided(s.checkin('2026-10-18', 69.9));
    expect(decided(s.checkin('2026-11-01', 68.9, { hunger: 'HIGH' }))).toMatchObject({ action: 'REVIEW', reason: 'DIRECTION_REVERSAL_BLOCKED', proposedStep: -1 });
    expect(s.energyOn('2026-11-08').effective.energy).toBe(kcal(-1));
  });
  it('suelo de seguridad: con una base baja la bajada es REVIEW · SAFETY_FLOOR_REACHED y la energía no baja', () => {
    const s = server(calibration({ baseEnergyRaw: 1263 }));
    expect(decided(s.checkin('2026-10-21', 69.9))).toMatchObject({ action: 'REVIEW', reason: 'SAFETY_FLOOR_REACHED', proposedStep: 0 });
    expect(s.energyOn('2026-10-26')).toMatchObject({ effective: { energy: 1263 }, calibration: { effectiveStep: 0 } });
  });
  it('sin compounding: dos bajadas → base × 0.90', () => {
    const s = server();
    decided(s.checkin('2026-10-18', 69.9));
    decided(s.checkin('2026-11-01', 69.85));
    expect(s.cal.currentStep).toBe(-2);
    expect(s.energyOn('2026-11-01').effective.energy).toBe(Math.round((BASE * 90) / 100));
    expect(s.energyOn('2026-11-01').effective.rawEnergy).toBeCloseTo(BASE * 0.9, 9);
  });
  it('currentness: el plan solo se vuelve STALE cuando el paso RIGE (no antes)', () => {
    const s = server();
    decided(s.checkin('2026-10-21', 69.9));
    const o = { ...ob(), peso: 69.9 };
    const macrosOn = (day: string) => {
      const snap = s.energyOn(day, o);
      const r = resolveMacroPrescription(stateOf(o), o as never, snap.effective.energy);
      if (r.kind !== 'RESOLVED') throw new Error('sin macros');
      const p = r.prescription as { proteinG: number; fatG: number; carbG: number };
      return { planGoal: snap.effective.energy!, macros: { proteinG: p.proteinG, fatG: p.fatG, carbG: p.carbG } };
    };
    const thu = macrosOn('2026-10-22');
    const plan = { days: [{}], engineVersion: PLAN_ENGINE_VERSION, gen: { kcal: thu.planGoal, protG: thu.macros.proteinG, fatG: thu.macros.fatG, carbG: thu.macros.carbG } };
    const cur = (day: string) => { const m = macrosOn(day); return weeklyPlanCurrentness({ status: 'PRESCRIBED', planGoal: m.planGoal, macros: m.macros, weeklyPlan: plan, currentVersion: PLAN_ENGINE_VERSION }); };
    expect(['2026-10-22', '2026-10-23', '2026-10-24'].map(cur)).toEqual(['ACTIVE', 'ACTIVE', 'ACTIVE']);
    expect(cur('2026-10-25')).toBe('STALE');
  });
  it('el peso del check-in (Bloque 4) no recalcula la base: la energía calibrada es la misma con cualquier peso', () => {
    const s = server();
    decided(s.checkin('2026-10-21', 69.9));
    const a = s.energyOn('2026-10-26', { ...ob(), peso: 69.9 });
    const b = s.energyOn('2026-10-26', { ...ob(), peso: 66 });
    expect(stateOf({ ...ob(), peso: 66 }).prescribedEnergy).not.toBe(stateOf({ ...ob(), peso: 69.9 }).prescribedEnergy);   // CAPA 1 sí cambia
    expect(a.effective).toEqual(b.effective);
  });
  it('cambio de objetivo: la calibración vieja no se adopta; una nueva arranca con su propia base', () => {
    const s = server();
    decided(s.checkin('2026-10-21', 69.9));
    const mg = ob('MAINTENANCE');
    expect(s.energyOn('2026-10-26', mg)).toMatchObject({ source: 'BASE', notAdoptedReason: 'OBJECTIVE_CHANGED', effective: { energy: stateOf(mg).prescribedEnergy } });
    const start = planStartCalibration({ request: { requestId: 'aaaaaaaa-0000-4000-8000-000000000009', localDate: '2026-10-27', weightKg: 69.9 },
      obData: mg, energyStatus: 'PRESCRIBED', active: s.cal, serverUtcDate: '2026-10-27' });
    expect(start).toMatchObject({ kind: 'START', objective: 'MAINTENANCE', closesCalibrationId: 'cal-1', baseEnergyRaw: stateOf({ ...mg, peso: 69.9 }).rawPrescribedEnergy });
  });
});
