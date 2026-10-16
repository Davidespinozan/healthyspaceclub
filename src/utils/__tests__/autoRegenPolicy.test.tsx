// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Supabase falso (sin usuario no se persiste nada) y generador espiado: se captura la política que recibe.
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: null } }) },
    functions: { invoke: async () => ({ data: null, error: null }) },
    from: () => ({ upsert: async () => ({ error: null }) }),
  },
}));
const h = vi.hoisted(() => ({ gen: vi.fn() }));
vi.mock('../planOrchestration', () => ({ generateWeeklyPlan: (...a: unknown[]) => h.gen(...a) }));

import { renderHook, waitFor } from '@testing-library/react';
import { useAutoRegenPlan } from '../useAutoRegenPlan';
import { useAppStore } from '../../store';
import { buildWeeklyPlan, PLAN_ENGINE_VERSION } from '../planEngine';

// ─────────────────────────────────────────────────────────────────────────────
// MB3 · H · la regeneración automática genera con la POLÍTICA del plan: permanentes del perfil
// ACTUAL en estricto + `avoidWeekly` (origen conocido) en suave. Un plan legacy sin `avoidWeekly`
// sale todo estricto (MB2): el origen no se inventa ni se degrada.
// ─────────────────────────────────────────────────────────────────────────────

const OB = { sex: 'Hombre', goal: 'Bajar grasa', edad: 35, estatura: 178, peso: 82, embarazo: 0, requiresTherapeuticDiet: 0,
  dailyLife: 'DL2', trainsHabitually: 1, trainingDaysPerWeek: 5, trainingSessionMinutes: 60, trainingModalities: 'strength', avoid: 'lacteos' };
const S = () => useAppStore.getState();

async function stalePlan(gen: Record<string, unknown>) {
  useAppStore.setState({ user: null, obData: { ...OB } as never, weeklyPlan: null });
  await S().recalcFromObData('test');
  const t = { kcal: S().planGoal!, protG: 1, fatG: 1, carbG: 1 };
  useAppStore.setState({ weeklyPlan: {
    generatedAt: new Date().toISOString(), mealPlanKey: 'planA', selectedDays: [1, 2, 3, 4, 5, 6, 7], shoppingList: [], nota: '', preferences: 'huevo',
    days: buildWeeklyPlan({ kcal: 2400, protG: 160, fatG: 70, carbG: 280 }, { seed: 1, avoid: ['lacteos', 'huevo'] }),
    engineVersion: PLAN_ENGINE_VERSION - 1,                   // motor anterior → STALE → regenera
    gen: { ...t, craving: '', ...gen },
  } as never });
}

beforeEach(() => {
  h.gen.mockReset();
  h.gen.mockImplementation(async (target: { kcal: number; protG: number; fatG: number; carbG: number }, avoid: unknown) =>
    ({ days: buildWeeklyPlan(target, { seed: 2, avoid: avoid as never }), source: 'codigo' }));
});

describe('H · auto-regeneración respeta el origen', () => {
  it('avoidWeekly conocido → strict = permanentes actuales, soft = semana; se conserva avoidWeekly + avoidSemantics', async () => {
    await stalePlan({ avoid: ['lacteos', 'huevo'], avoidPermanent: ['lacteos'], avoidWeekly: ['huevo'], avoidSemantics: 2 });
    renderHook(() => useAutoRegenPlan());
    await waitFor(() => expect(h.gen).toHaveBeenCalled());
    expect(h.gen.mock.calls[0][1]).toEqual({ strict: ['lacteos'], soft: ['huevo'] });
    await waitFor(() => expect(S().weeklyPlan?.engineVersion).toBe(PLAN_ENGINE_VERSION));
    const g = S().weeklyPlan!.gen!;
    expect([g.avoid, g.avoidPermanent, g.avoidWeekly, g.avoidSemantics]).toEqual([['lacteos', 'huevo'], ['lacteos'], ['huevo'], 2]);
  });
  it('legacy sin avoidWeekly → todo strict (no se degrada); no se inventa avoidWeekly al guardar', async () => {
    await stalePlan({ avoid: ['huevo'] });
    renderHook(() => useAutoRegenPlan());
    await waitFor(() => expect(h.gen).toHaveBeenCalled());
    expect(h.gen.mock.calls[0][1]).toEqual({ strict: ['lacteos', 'huevo'], soft: [] });
    await waitFor(() => expect(S().weeklyPlan?.engineVersion).toBe(PLAN_ENGINE_VERSION));
    const g = S().weeklyPlan!.gen!;
    expect(g.avoid).toEqual(['lacteos', 'huevo']);
    expect('avoidWeekly' in g).toBe(false);
    expect('avoidSemantics' in g).toBe(false);
  });
});
