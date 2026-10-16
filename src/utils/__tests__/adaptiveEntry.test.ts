import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE · ENTRADA DEL SOCIO REAL — modelo de vista puro + persistencia tras recargar/relogin
// con el store REAL. El calendario es el del planificador del servidor (mismas funciones).
// Calibración con cycle_start domingo 2026-10-04 → check-in 1 vence el domingo 18
// (ventana 17–24) · check-in 2 vence el 1 de noviembre (ventana 31 oct – 7 nov).
// ─────────────────────────────────────────────────────────────────────────────
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: null } }) },
    functions: { invoke: async () => ({ data: null, error: null }) },
    from: () => ({ upsert: async () => ({ error: null }) }),
  },
}));
const h = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('../nutritionCalibrationRepository', async (orig) => ({ ...(await orig<object>()), loadAdaptiveCalibrationData: () => h.load() }));

import { adaptiveEntryState, adaptiveResultFrom, nextCheckinWindowStart, type AdaptiveEntryInput } from '../adaptiveEntry';
import { planCheckin } from '../adaptiveCheckinPlanner';
import { checkinFromRow, ENERGY_CALIBRATION_VERSION, type NutritionCalibration, type StoredAdaptiveCheckin } from '../adaptiveCalibrationCore';
import { resolveNutritionEnergyState } from '../nutritionEnergyState';
import { useAppStore } from '../../store';

const OB = { sex: 'Hombre', goal: 'Bajar grasa', edad: 30, estatura: 180, peso: 70, embarazo: 0, requiresTherapeuticDiet: 0,
  dailyLife: 'DL2', trainsHabitually: 1, trainingDaysPerWeek: 4, trainingSessionMinutes: 60, trainingModalities: 'strength' };
const BASE = resolveNutritionEnergyState(OB as never).rawPrescribedEnergy!;
const CAL: NutritionCalibration = { id: 'cal-1', objective: 'FAT_LOSS', status: 'ACTIVE', baselineDate: '2026-10-04', cycleStart: '2026-10-04',
  baselineWeightKg: 70, baselineWaistCm: null, currentStep: 0, baseEnergyKcal: null, baseEnergyRaw: BASE, lastCheckinId: null,
  lastAppliedAction: null, lastAppliedAt: null, calibrationVersion: ENERGY_CALIBRATION_VERSION, createdAt: '', closedAt: null };

/** Check-in 1 registrado el miércoles 21 con el planificador REAL → STEP_DOWN que rige el domingo 25. */
function withCheckin1(): { calibration: NutritionCalibration; checkins: StoredAdaptiveCheckin[] } {
  const plan = planCheckin({ request: { requestId: '00000000-0000-4000-8000-000000000001', localDate: '2026-10-21', weightKg: 69.9,
    adherenceAnswer: 'PRACTICALLY_ALL', hunger: 'NORMAL', energy: 'NORMAL', performance: 'SAME' },
    obData: { ...OB, peso: 69.9 }, energyStatus: 'PRESCRIBED', calibration: CAL, history: [], serverUtcDate: '2026-10-21' });
  if (plan.kind !== 'RECORD' || plan.decision.action !== 'STEP_DOWN') throw new Error('se esperaba STEP_DOWN');
  return { calibration: { ...CAL, currentStep: -1, lastCheckinId: 'c-1' }, checkins: [checkinFromRow({ ...plan.payload, id: 'c-1', calibration_id: CAL.id, created_at: '' })!] };
}
const input = (over: Partial<AdaptiveEntryInput>): AdaptiveEntryInput => ({
  energyPrescribed: true, obData: OB, adaptive: { load: 'LOADED', calibration: CAL, checkins: [] }, snapshot: null, today: '2026-10-10', ...over,
});
const noCal = { load: 'LOADED' as const, calibration: null, checkins: [] };

describe('adaptiveEntryState · elegibilidad', () => {
  it('usuario elegible sin calibración → CAN_START (sin cintura en pérdida de grasa)', () => {
    expect(adaptiveEntryState(input({ adaptive: noCal }))).toEqual({ kind: 'CAN_START', needsWaist: false });
  });
  it('recomposición pide cintura al iniciar (contrato MB2)', () => {
    expect(adaptiveEntryState(input({ adaptive: noCal, obData: { ...OB, goal: 'Recomposición' } }))).toEqual({ kind: 'CAN_START', needsWaist: true });
  });
  it('calibración CERRADA o de otro objetivo → se puede iniciar de nuevo (el servidor decide el cierre)', () => {
    expect(adaptiveEntryState(input({ adaptive: { ...noCal, calibration: { ...CAL, status: 'CLOSED' } as never } })).kind).toBe('CAN_START');
    expect(adaptiveEntryState(input({ adaptive: { ...noCal, calibration: { ...CAL, objective: 'MAINTENANCE' } as never } })).kind).toBe('CAN_START');
  });
  it('oculto sin energía prescrita, con calibración ilegible o aún no leída', () => {
    expect(adaptiveEntryState(input({ energyPrescribed: false })).kind).toBe('HIDDEN');
    expect(adaptiveEntryState(input({ adaptive: { ...noCal, load: 'UNAVAILABLE' } })).kind).toBe('HIDDEN');
    expect(adaptiveEntryState(input({ adaptive: { ...noCal, load: 'IDLE' } })).kind).toBe('HIDDEN');
  });
});

describe('adaptiveEntryState · STRENGTH_REQUIRED (ganancia / recomposición)', () => {
  it('ganar músculo sin fuerza declarada → STRENGTH_REQUIRED, aunque no haya calibración', () => {
    expect(adaptiveEntryState(input({ adaptive: noCal, obData: { ...OB, goal: 'Ganar músculo', trainingModalities: 'endurance' } })).kind).toBe('STRENGTH_REQUIRED');
  });
  it('MIXTO (resistencia + intermitente) NO cuenta como fuerza', () => {
    expect(adaptiveEntryState(input({ adaptive: noCal, obData: { ...OB, goal: 'Recomposición', trainingModalities: 'endurance,team_intermittent' } })).kind).toBe('STRENGTH_REQUIRED');
  });
  it('sin entrenar habitualmente → STRENGTH_REQUIRED aunque la lista diga fuerza', () => {
    expect(adaptiveEntryState(input({ adaptive: noCal, obData: { ...OB, goal: 'Ganar músculo', trainsHabitually: 0 } })).kind).toBe('STRENGTH_REQUIRED');
  });
  it('con fuerza declarada → puede iniciar; pérdida de grasa no exige fuerza', () => {
    expect(adaptiveEntryState(input({ adaptive: noCal, obData: { ...OB, goal: 'Ganar músculo' } })).kind).toBe('CAN_START');
    expect(adaptiveEntryState(input({ adaptive: noCal, obData: { ...OB, trainingModalities: 'endurance' } })).kind).toBe('CAN_START');
  });
});

describe('adaptiveEntryState · TIMING (calendario del servidor)', () => {
  it('antes de la ventana → WAITING con la fecha de apertura (sábado 17)', () => {
    expect(adaptiveEntryState(input({ today: '2026-10-10' }))).toEqual({ kind: 'WAITING', nextCheckinFrom: '2026-10-17', pendingFrom: null });
    expect(adaptiveEntryState(input({ today: '2026-10-16' })).kind).toBe('WAITING');
  });
  it('dentro de la ventana (17–24) → CHECKIN_DUE', () => {
    for (const d of ['2026-10-17', '2026-10-18', '2026-10-24']) expect(adaptiveEntryState(input({ today: d })).kind, d).toBe('CHECKIN_DUE');
  });
  it('ganancia pide experiencia de fuerza; recomposición pide cintura (contrato MB2)', () => {
    expect(adaptiveEntryState(input({ today: '2026-10-18', obData: { ...OB, goal: 'Ganar músculo' }, adaptive: { ...noCal, calibration: { ...CAL, objective: 'MUSCLE_GAIN' } } })))
      .toMatchObject({ kind: 'CHECKIN_DUE', needsExperience: true, needsWaist: false });
    expect(adaptiveEntryState(input({ today: '2026-10-18', obData: { ...OB, goal: 'Recomposición' }, adaptive: { ...noCal, calibration: { ...CAL, objective: 'RECOMPOSITION' } } })))
      .toMatchObject({ kind: 'CHECKIN_DUE', needsExperience: false, needsWaist: true });
  });
  it('check-in del ciclo ya hecho → WAITING hasta la ventana siguiente (sábado 31) y muestra el ajuste pendiente', () => {
    const d = withCheckin1();
    const snapshot = { calibration: { pending: { step: -1, effectiveFrom: '2026-10-25' } } } as never;
    expect(adaptiveEntryState(input({ today: '2026-10-22', adaptive: { load: 'LOADED', ...d }, snapshot })))
      .toEqual({ kind: 'WAITING', nextCheckinFrom: '2026-10-31', pendingFrom: '2026-10-25' });
  });
  it('ventana perdida → la próxima que aún no cerró', () => {
    expect(nextCheckinWindowStart(CAL, new Set(), '2026-10-26')).toBe('2026-10-31');
  });
});

describe('adaptiveResultFrom · solo traduce la decisión del servidor', () => {
  it('START / ya activa → STARTED', () => {
    expect(adaptiveResultFrom({ status: 'STARTED' }, '2026-10-10')).toEqual({ kind: 'STARTED' });
    expect(adaptiveResultFrom({ status: 'ALREADY_ACTIVE' }, '2026-10-10')).toEqual({ kind: 'STARTED' });
  });
  it('MAINTAIN y NO_ADJUSTMENT → KEEP', () => {
    expect(adaptiveResultFrom({ status: 'RECORDED', action: 'MAINTAIN' }, '2026-10-21')).toEqual({ kind: 'KEEP' });
    expect(adaptiveResultFrom({ status: 'RECORDED', action: 'NO_ADJUSTMENT' }, '2026-10-21')).toEqual({ kind: 'KEEP' });
  });
  it('STEP_UP / STEP_DOWN → ADJUST con el domingo ≥ fecha del check-in (D-B5-SUNDAY)', () => {
    expect(adaptiveResultFrom({ status: 'RECORDED', action: 'STEP_DOWN' }, '2026-10-21')).toEqual({ kind: 'ADJUST', effectiveFrom: '2026-10-25' });
    expect(adaptiveResultFrom({ status: 'RECORDED', action: 'STEP_UP' }, '2026-10-18')).toEqual({ kind: 'ADJUST', effectiveFrom: '2026-10-18' });
  });
  it('REVIEW, STRENGTH_REQUIRED, NOT_DUE, no elegible, datos inválidos, error', () => {
    expect(adaptiveResultFrom({ status: 'RECORDED', action: 'REVIEW' }, '2026-10-21').kind).toBe('REVIEW');
    expect(adaptiveResultFrom({ status: 'STRENGTH_REQUIRED' }, '2026-10-21').kind).toBe('STRENGTH_REQUIRED');
    for (const s of ['NOT_DUE', 'DUPLICATE_CYCLE', 'OUT_OF_ORDER']) expect(adaptiveResultFrom({ status: s }, '2026-10-21').kind).toBe('NOT_DUE');
    for (const s of ['NOT_ELIGIBLE', 'OBJECTIVE_CHANGED', 'NO_ACTIVE_CALIBRATION']) expect(adaptiveResultFrom({ status: s }, '2026-10-21').kind).toBe('NOT_ELIGIBLE');
    for (const s of ['INVALID_WEIGHT', 'WAIST_REQUIRED', 'CHECKIN_INCOMPLETE']) expect(adaptiveResultFrom({ status: s }, '2026-10-21').kind).toBe('INVALID_INPUT');
    for (const b of [{ status: 'TRANSPORT_ERROR' }, { status: 'INTERNAL_ERROR' }, null, { status: 'RECORDED', action: '??' }]) {
      expect(adaptiveResultFrom(b as never, '2026-10-21').kind).toBe('ERROR');
    }
  });
});

describe('RECARGA / RELOGIN · el estado se reconstruye del servidor con el store REAL', () => {
  const S = () => useAppStore.getState();
  const at = (ymd: string) => vi.setSystemTime(new Date(`${ymd}T12:00:00`));
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); h.load.mockReset(); });
  afterEach(() => { vi.useRealTimers(); });
  const entry = (today: string) => adaptiveEntryState({ energyPrescribed: S().energyState?.status === 'PRESCRIBED', obData: S().obData,
    adaptive: S().adaptiveCalibration, snapshot: S().nutritionSnapshot, today });
  async function login() {
    useAppStore.setState({ user: { id: 'u-1' } as never, obData: { ...OB } as never, planGoal: null, macroTargets: null, energyState: null,
      nutritionSnapshot: null, adaptiveCalibration: { load: 'IDLE', calibration: null, checkins: [] } as never });
    await S().hydrateEnergyFromSnapshot(null);
  }
  it('sin calibración tras relogin → CAN_START', async () => {
    at('2026-10-10');
    h.load.mockResolvedValue({ calibration: null, checkins: [] });
    await login();
    expect(entry('2026-10-10')).toEqual({ kind: 'CAN_START', needsWaist: false });
  });
  it('tras iniciar → relogin: WAITING con la fecha del primer check-in', async () => {
    at('2026-10-10');
    h.load.mockResolvedValue({ calibration: CAL, checkins: [] });
    await login();
    expect(entry('2026-10-10')).toEqual({ kind: 'WAITING', nextCheckinFrom: '2026-10-17', pendingFrom: null });
  });
  it('tras un check-in con ajuste → relogin el jueves: ajuste pendiente al domingo 25 y próximo check-in el 31', async () => {
    at('2026-10-22');
    h.load.mockResolvedValue(withCheckin1());
    await login();
    expect(entry('2026-10-22')).toEqual({ kind: 'WAITING', nextCheckinFrom: '2026-10-31', pendingFrom: '2026-10-25' });
  });
  it('lectura de calibración fallida tras relogin → la tarjeta se oculta (no se ofrece iniciar a ciegas)', async () => {
    at('2026-10-22');
    h.load.mockResolvedValue(undefined);
    await login();
    expect(entry('2026-10-22').kind).toBe('HIDDEN');
  });
});
