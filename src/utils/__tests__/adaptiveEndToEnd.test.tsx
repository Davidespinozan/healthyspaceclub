// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE BLOQUE 9 · INTEGRACIÓN DE PUNTA A PUNTA con el store y el hook REALES:
// perfil → CAPA 1 → base congelada → calibración → check-in (planificador real) → decisión MB3 →
// domingo efectivo → kcal calibradas → macros CAPA 2 → planGoal → vigencia del plan → regeneración.
// Solo se simulan Supabase, la lectura de la calibración y el generador de menús.
// 2026-10-22 jueves · 2026-10-25 domingo.
// ─────────────────────────────────────────────────────────────────────────────
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: null } }) },
    functions: { invoke: async () => ({ data: null, error: null }) },
    from: () => ({ upsert: async () => ({ error: null }) }),
  },
}));
const h = vi.hoisted(() => ({ load: vi.fn(), gen: vi.fn() }));
vi.mock('../nutritionCalibrationRepository', async (orig) => ({ ...(await orig<object>()), loadAdaptiveCalibrationData: () => h.load() }));
vi.mock('../planOrchestration', () => ({ generateWeeklyPlan: (...a: unknown[]) => h.gen(...a) }));

import { renderHook, act, waitFor } from '@testing-library/react';
import { useAppStore } from '../../store';
import { useAutoRegenPlan } from '../useAutoRegenPlan';
import { planCheckin } from '../adaptiveCheckinPlanner';
import { checkinFromRow, ENERGY_CALIBRATION_VERSION, type NutritionCalibration, type StoredAdaptiveCheckin } from '../adaptiveCalibrationCore';
import { calibratedEnergy } from '../adaptiveCalibrationEnergy';
import { resolveNutritionEnergyState } from '../nutritionEnergyState';
import { buildWeeklyPlan, PLAN_ENGINE_VERSION } from '../planEngine';

const OB = { sex: 'Hombre', goal: 'Bajar grasa', edad: 30, estatura: 180, peso: 70, embarazo: 0, requiresTherapeuticDiet: 0,
  dailyLife: 'DL2', trainsHabitually: 1, trainingDaysPerWeek: 4, trainingSessionMinutes: 60, trainingModalities: 'strength' };
const BASE = resolveNutritionEnergyState(OB as never).rawPrescribedEnergy!;
const kcal = (step: number) => { const r = calibratedEnergy(BASE, step); if (r.status !== 'CALIBRATED') throw new Error(); return r.calibratedEnergy; };
const S = () => useAppStore.getState();
const at = (ymd: string) => vi.setSystemTime(new Date(`${ymd}T12:00:00`));

function calibrationWithStepDecidedWednesday(): { calibration: NutritionCalibration; checkins: StoredAdaptiveCheckin[] } {
  const cal: NutritionCalibration = { id: 'cal-1', objective: 'FAT_LOSS', status: 'ACTIVE', baselineDate: '2026-10-04', cycleStart: '2026-10-04',
    baselineWeightKg: 70, baselineWaistCm: null, currentStep: 0, baseEnergyKcal: null, baseEnergyRaw: BASE, lastCheckinId: null,
    lastAppliedAction: null, lastAppliedAt: null, calibrationVersion: ENERGY_CALIBRATION_VERSION, createdAt: '', closedAt: null };
  const plan = planCheckin({ request: { requestId: '00000000-0000-4000-8000-000000000001', localDate: '2026-10-21', weightKg: 69.9,
    adherenceAnswer: 'PRACTICALLY_ALL', hunger: 'NORMAL', energy: 'NORMAL', performance: 'SAME' },
    obData: { ...OB, peso: 69.9 }, energyStatus: 'PRESCRIBED', calibration: cal, history: [], serverUtcDate: '2026-10-21' });
  if (plan.kind !== 'RECORD' || plan.decision.action !== 'STEP_DOWN') throw new Error('se esperaba STEP_DOWN');
  return { calibration: { ...cal, currentStep: -1, lastCheckinId: 'c-1' }, checkins: [checkinFromRow({ ...plan.payload, id: 'c-1', calibration_id: cal.id, created_at: '' })!] };
}
/** Plan ya generado con la meta VIGENTE del store (como lo haría el planificador). */
function seedCurrentPlan() {
  const m = S().macroTargets as { proteinG: number; fatG: number; carbG: number };
  const target = { kcal: S().planGoal!, protG: m.proteinG, fatG: m.fatG, carbG: m.carbG };
  useAppStore.setState({ weeklyPlan: { generatedAt: new Date().toISOString(), mealPlanKey: 'planA', selectedDays: [1, 2, 3, 4, 5, 6, 7], shoppingList: [],
    nota: '', preferences: '', days: buildWeeklyPlan(target, { seed: 1 }), engineVersion: PLAN_ENGINE_VERSION,
    gen: { ...target, avoid: [], craving: '' } } as never });
  return target;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  h.load.mockReset(); h.gen.mockReset();
  h.gen.mockImplementation(async (target: { kcal: number; protG: number; fatG: number; carbG: number }) => ({ days: buildWeeklyPlan(target, { seed: 2 }), source: 'codigo' }));
});
afterEach(() => { vi.useRealTimers(); });

describe('E2E · STEP_DOWN decidido el miércoles', () => {
  it('jueves–sábado: kcal y macros de antes, plan vigente, sin regenerar · domingo: kcal × 0.95, macros nuevas, el plan se regenera con ellas', async () => {
    at('2026-10-22');
    h.load.mockResolvedValue(calibrationWithStepDecidedWednesday());
    useAppStore.setState({ user: { id: 'u-1' } as never, obData: { ...OB } as never, weeklyPlan: null });
    await S().hydrateEnergyFromSnapshot(null);
    expect(S().planGoal).toBe(kcal(0));
    const before = seedCurrentPlan();
    const { rerender } = renderHook(() => useAutoRegenPlan());

    for (const day of ['2026-10-23', '2026-10-24']) {          // sin adopción a mitad de semana
      at(day);
      act(() => S().refreshAdaptiveEnergy('focus'));
      rerender();
      expect(S().planGoal, day).toBe(kcal(0));
    }
    expect(h.gen).not.toHaveBeenCalled();

    at('2026-10-25');                                          // domingo efectivo
    act(() => S().refreshAdaptiveEnergy('focus'));
    rerender();
    expect(S().planGoal).toBe(kcal(-1));
    const m = S().macroTargets as { energyKcal: number; proteinG: number; fatG: number; carbG: number };
    expect(m.energyKcal).toBe(kcal(-1));
    await waitFor(() => expect(h.gen).toHaveBeenCalledTimes(1));
    const [target, policy] = h.gen.mock.calls[0] as [{ kcal: number; protG: number; fatG: number; carbG: number }, unknown];
    expect(target).toEqual({ kcal: kcal(-1), protG: m.proteinG, fatG: m.fatG, carbG: m.carbG });
    expect(target.kcal).not.toBe(before.kcal);
    expect(policy).toEqual({ strict: [], soft: [] });
    await waitFor(() => expect(S().weeklyPlan?.gen?.kcal).toBe(kcal(-1)));   // el plan regenerado queda vigente
  });
});

describe('E2E · sin calibración (usuario no adaptativo)', () => {
  it('el domingo no cambia nada: CAPA 1, plan vigente, sin regenerar', async () => {
    at('2026-10-22');
    h.load.mockResolvedValue({ calibration: null, checkins: [] });
    useAppStore.setState({ user: { id: 'u-2' } as never, obData: { ...OB } as never, weeklyPlan: null });
    await S().hydrateEnergyFromSnapshot(null);
    const capa1 = resolveNutritionEnergyState(OB as never).prescribedEnergy;
    expect(S().planGoal).toBe(capa1);
    seedCurrentPlan();
    const { rerender } = renderHook(() => useAutoRegenPlan());
    at('2026-10-25');
    act(() => S().refreshAdaptiveEnergy('focus'));
    rerender();
    expect(S().planGoal).toBe(capa1);
    expect(h.gen).not.toHaveBeenCalled();
  });
});

describe('E2E · calibración ilegible', () => {
  it('UNAVAILABLE: CAPA 1 provisional y ninguna regeneración falsa aunque la cifra difiera del plan', async () => {
    at('2026-10-26');
    h.load.mockResolvedValue(calibrationWithStepDecidedWednesday());
    useAppStore.setState({ user: { id: 'u-3' } as never, obData: { ...OB } as never, weeklyPlan: null });
    await S().hydrateEnergyFromSnapshot(null);
    seedCurrentPlan();                                         // plan con la energía calibrada (−1)
    h.load.mockResolvedValue(undefined);                       // la siguiente lectura falla
    await act(async () => { await S().loadAdaptiveCalibration(true); });
    expect(S().nutritionSnapshot?.status).toBe('UNAVAILABLE');
    expect(S().planGoal).toBe(resolveNutritionEnergyState(OB as never).prescribedEnergy);   // ≠ al del plan
    renderHook(() => useAutoRegenPlan());
    await new Promise((r) => setTimeout(r, 20));
    expect(h.gen).not.toHaveBeenCalled();
  });
});
