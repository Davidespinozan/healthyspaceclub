import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Supabase simulado (las escrituras del store no importan aquí) y lectura de calibración controlada.
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: null } }) },
    functions: { invoke: async () => ({ data: null, error: null }) },
    from: () => ({ upsert: async () => ({ error: null }), delete: () => ({ eq: () => ({ then: (r: (v: { error: null }) => void) => r({ error: null }) }) }) }),
  },
}));
const h = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('../nutritionCalibrationRepository', async (orig) => ({ ...(await orig<object>()), loadAdaptiveCalibrationData: () => h.load() }));

import { useAppStore } from '../../store';
import { planCheckin } from '../adaptiveCheckinPlanner';
import { checkinFromRow, ENERGY_CALIBRATION_VERSION, type NutritionCalibration, type StoredAdaptiveCheckin } from '../adaptiveCalibrationCore';
import { calibratedEnergy } from '../adaptiveCalibrationEnergy';
import { resolveNutritionEnergyState } from '../nutritionEnergyState';
import { resolveMacroPrescription } from '../macroPrescription';

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE BLOQUES 6–8 · integración en el STORE: hidratación/login, proyección atómica de
// planGoal + macros, cruce al domingo con la app abierta, calibración ilegible y peso.
// 2026-10-22 jueves · 2026-10-25 domingo.
// ─────────────────────────────────────────────────────────────────────────────

const OB = { sex: 'Hombre', goal: 'Bajar grasa', edad: 30, estatura: 180, peso: 70, embarazo: 0, requiresTherapeuticDiet: 0,
  dailyLife: 'DL2', trainsHabitually: 1, trainingDaysPerWeek: 4, trainingSessionMinutes: 60, trainingModalities: 'strength' };
const BASE = resolveNutritionEnergyState(OB as never).rawPrescribedEnergy!;
const kcal = (step: number) => { const r = calibratedEnergy(BASE, step); if (r.status !== 'CALIBRATED') throw new Error(); return r.calibratedEnergy; };
const S = () => useAppStore.getState();

/** Calibración + un STEP_DOWN decidido el miércoles 21 (rige el domingo 25), con el planificador REAL. */
function calibratedWithPendingStepDown(): { calibration: NutritionCalibration; checkins: StoredAdaptiveCheckin[] } {
  const cal: NutritionCalibration = { id: 'cal-1', objective: 'FAT_LOSS', status: 'ACTIVE', baselineDate: '2026-10-04', cycleStart: '2026-10-04',
    baselineWeightKg: 70, baselineWaistCm: null, currentStep: 0, baseEnergyKcal: null, baseEnergyRaw: BASE, lastCheckinId: null,
    lastAppliedAction: null, lastAppliedAt: null, calibrationVersion: ENERGY_CALIBRATION_VERSION, createdAt: '', closedAt: null };
  const plan = planCheckin({ request: { requestId: '00000000-0000-4000-8000-000000000001', localDate: '2026-10-21', weightKg: 69.9,
    adherenceAnswer: 'PRACTICALLY_ALL', hunger: 'NORMAL', energy: 'NORMAL', performance: 'SAME' },
    obData: { ...OB, peso: 69.9 }, energyStatus: 'PRESCRIBED', calibration: cal, history: [], serverUtcDate: '2026-10-21' });
  if (plan.kind !== 'RECORD' || plan.decision.action !== 'STEP_DOWN') throw new Error('se esperaba STEP_DOWN');
  const row = checkinFromRow({ ...plan.payload, id: 'c-1', calibration_id: cal.id, created_at: '' })!;
  return { calibration: { ...cal, currentStep: -1, lastCheckinId: 'c-1' }, checkins: [row] };
}
const at = (ymd: string) => vi.setSystemTime(new Date(`${ymd}T12:00:00`));
/** Toda emisión del store mantiene planGoal y macros de la MISMA energía. */
function watchCoherence() {
  const bad: string[] = [];
  const seenGoals: Array<number | null> = [];
  const unsub = useAppStore.subscribe((st) => {
    seenGoals.push(st.planGoal);
    const m = st.macroTargets as { energyKcal?: number } | null;
    if (st.planGoal != null && m?.energyKcal != null && m.energyKcal !== st.planGoal) bad.push(`${st.planGoal} vs ${m.energyKcal}`);
  });
  return { bad, seenGoals, unsub };
}
async function login(obData: Record<string, unknown>) {
  useAppStore.setState({ user: { id: 'u-1' } as never, obData: { ...obData } as never, planGoal: null, macroTargets: null, energyState: null, nutritionSnapshot: null });
  await S().hydrateEnergyFromSnapshot(null);   // sin snapshot guardado → recalcula con la autoridad
}

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); h.load.mockReset(); });
afterEach(() => { vi.useRealTimers(); });

describe('HIDRATACIÓN / LOGIN', () => {
  it('sin calibración → planGoal y macros de CAPA 1, exactamente como antes', async () => {
    at('2026-10-22');
    h.load.mockResolvedValue({ calibration: null, checkins: [] });
    await login(OB);
    const st = resolveNutritionEnergyState(OB as never);
    expect(S().planGoal).toBe(st.prescribedEnergy);
    expect(S().macroTargets).toEqual(resolveMacroPrescription(st, OB as never).prescription);
    expect(S().nutritionSnapshot).toMatchObject({ source: 'BASE', status: 'NO_CALIBRATION' });
  });
  it('con calibración: el login proyecta YA la energía calibrada (sin un instante de CAPA 1) y planGoal = macros', async () => {
    at('2026-10-22');
    h.load.mockResolvedValue(calibratedWithPendingStepDown());
    const w = watchCoherence();
    await login(OB);
    w.unsub();
    expect(S().planGoal).toBe(kcal(0));
    expect(w.seenGoals.filter((g) => g != null)).toEqual(w.seenGoals.filter((g) => g != null).map(() => kcal(0)));   // nunca otra cifra
    expect(w.bad).toEqual([]);
    expect(S().nutritionSnapshot).toMatchObject({ source: 'CALIBRATED', calibration: { decidedStep: -1, effectiveStep: 0, pending: { step: -1, effectiveFrom: '2026-10-25' } } });
  });
  it('calibración ilegible → UNAVAILABLE: CAPA 1 provisional (y el plan no se juzga: ver currentness)', async () => {
    at('2026-10-22');
    h.load.mockResolvedValue(undefined);
    await login(OB);
    expect(S().adaptiveCalibration.load).toBe('UNAVAILABLE');
    expect(S().nutritionSnapshot).toMatchObject({ status: 'UNAVAILABLE', source: 'BASE' });
    expect(S().planGoal).toBe(resolveNutritionEnergyState(OB as never).prescribedEnergy);
  });
});

describe('ACTIVACIÓN DOMINICAL con la app abierta', () => {
  it('jueves → sábado: energía previa; domingo: el refresco adopta el paso nuevo, planGoal y macros juntos', async () => {
    at('2026-10-22');
    h.load.mockResolvedValue(calibratedWithPendingStepDown());
    await login(OB);
    expect(S().planGoal).toBe(kcal(0));
    at('2026-10-24');
    S().refreshAdaptiveEnergy('focus');
    expect(S().planGoal).toBe(kcal(0));                             // sin adopción a mitad de semana
    const w = watchCoherence();
    at('2026-10-25');
    S().refreshAdaptiveEnergy('focus');
    w.unsub();
    expect(S().planGoal).toBe(kcal(-1));
    expect((S().macroTargets as { energyKcal: number }).energyKcal).toBe(kcal(-1));
    expect(w.bad).toEqual([]);
    expect(S().nutritionSnapshot?.calibration).toMatchObject({ effectiveStep: -1, effectiveFrom: '2026-10-25', pending: null });
  });
  it('el refresco sin cambios no emite estado nuevo', async () => {
    at('2026-10-22');
    h.load.mockResolvedValue(calibratedWithPendingStepDown());
    await login(OB);
    let n = 0;
    const unsub = useAppStore.subscribe(() => { n++; });
    S().refreshAdaptiveEnergy('focus');
    unsub();
    expect(n).toBe(0);
  });
});

describe('PESO · la energía calibrada usa la base congelada', () => {
  it('un pesaje suelto (weight_log) no cambia planGoal', async () => {
    at('2026-10-26');
    h.load.mockResolvedValue(calibratedWithPendingStepDown());
    await login(OB);
    const before = S().planGoal;
    await S().addWeight(66);
    expect(S().planGoal).toBe(before);
    expect(before).toBe(kcal(-1));
  });
  it('el peso del check-in (servidor, Bloque 4) recalcula CAPA 1 pero la energía calibrada sigue siendo base congelada × paso', async () => {
    at('2026-10-26');
    h.load.mockResolvedValue(calibratedWithPendingStepDown());
    await login(OB);
    await S().applyServerNutritionWeight(69.9);
    expect(S().obData.peso).toBe(69.9);
    expect(S().planGoal).toBe(kcal(-1));
    expect(S().nutritionSnapshot?.base.prescribedEnergy).toBe(resolveNutritionEnergyState({ ...OB, peso: 69.9 } as never).prescribedEnergy);
  });
  it('cambiar el objetivo del perfil deja de adoptar la calibración (vuelve CAPA 1)', async () => {
    at('2026-10-26');
    h.load.mockResolvedValue(calibratedWithPendingStepDown());
    await login(OB);
    S().setObData('goal', 'Bienestar integral');
    await S().recalcFromObData('test');
    expect(S().nutritionSnapshot).toMatchObject({ source: 'BASE', notAdoptedReason: 'OBJECTIVE_CHANGED' });
    expect(S().planGoal).toBe(resolveNutritionEnergyState({ ...OB, goal: 'Bienestar integral' } as never).prescribedEnergy);
  });
});
