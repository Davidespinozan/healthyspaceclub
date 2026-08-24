import { describe, it, expect } from 'vitest';
import { hasGeneratedWeeklyPlan, weeklyPlanPhase } from '../weeklyPlanState';

// ─────────────────────────────────────────────────────────────────────────────
// NUTRITION-N5 · autoridad de estado del plan. Solo un plan GENERADO (con `.days`) es renderable; un
// weeklyPlan legacy/orphan sin `.days` se trata como "sin plan" → flujo "Arma tu plan" (nunca el preview
// legacy scalePlan). TabHoy/WNP gatean con este predicado.
// ─────────────────────────────────────────────────────────────────────────────
describe('hasGeneratedWeeklyPlan', () => {
  it('1 · null / undefined → false (sin plan → CTA)', () => {
    expect(hasGeneratedWeeklyPlan(null)).toBe(false);
    expect(hasGeneratedWeeklyPlan(undefined)).toBe(false);
  });
  it('2 · objeto legacy truthy SIN `.days` → false (orphan → CTA, no preview)', () => {
    expect(hasGeneratedWeeklyPlan({ selectedDays: [1, 2, 3], mealPlanKey: 'planA' } as unknown as { days?: unknown[] })).toBe(false);
    expect(hasGeneratedWeeklyPlan({ days: undefined } as { days?: unknown[] })).toBe(false);
  });
  it('2b · `.days` presente pero VACÍO → false (no hay plan renderable)', () => {
    expect(hasGeneratedWeeklyPlan({ days: [] })).toBe(false);
  });
  it('3 · weeklyPlan con `.days` no vacío → true (plan generado, se renderiza)', () => {
    expect(hasGeneratedWeeklyPlan({ days: [{ day: 1, meals: [] }] } as { days?: unknown[] })).toBe(true);
  });
  it('5 · sin crash con objetos raros (days no-array) → false', () => {
    expect(hasGeneratedWeeklyPlan({ days: 'x' } as unknown as { days?: unknown[] })).toBe(false);
    expect(hasGeneratedWeeklyPlan({} as { days?: unknown[] })).toBe(false);
  });
  it('type-guard: narrowing usable por el llamador', () => {
    const wp: { days?: { day: number }[]; selectedDays?: number[] } | null = { days: [{ day: 1 }], selectedDays: [1] };
    if (hasGeneratedWeeklyPlan(wp)) {
      // dentro del guard, wp es no-nulo con days → el acceso no rompe tsc
      expect(wp.days.length).toBe(1);
    } else {
      throw new Error('debió pasar el guard');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// NUTRITION-N5.1 · la fase inicial de WNP y su render usan la MISMA autoridad. Nunca 'plan' para un
// weeklyPlan no generado (evita pantalla en blanco: fase 'plan' + render null).
// ─────────────────────────────────────────────────────────────────────────────
describe('weeklyPlanPhase (init de WeeklyNutritionPlanner)', () => {
  const orphan = { selectedDays: [1, 2, 3], mealPlanKey: 'planA' } as unknown as { days?: unknown[] };
  const valid = { days: [{ day: 1, meals: [] }], selectedDays: [1] } as { days?: unknown[] };
  it('shoppingDay null → setup-day (independiente del plan)', () => {
    expect(weeklyPlanPhase(null, valid)).toBe('setup-day');
    expect(weeklyPlanPhase(null, null)).toBe('setup-day');
  });
  it('sin plan generado → questions (NUNCA plan): null/undefined/orphan/vacío/malformado', () => {
    expect(weeklyPlanPhase(0, null)).toBe('questions');
    expect(weeklyPlanPhase(0, undefined)).toBe('questions');
    expect(weeklyPlanPhase(0, orphan)).toBe('questions');            // orphan sin .days (antes: 'plan' → blank)
    expect(weeklyPlanPhase(0, { days: [] })).toBe('questions');       // vacío
    expect(weeklyPlanPhase(0, { days: null } as unknown as { days?: unknown[] })).toBe('questions'); // malformado
    expect(weeklyPlanPhase(0, { days: 'x' } as unknown as { days?: unknown[] })).toBe('questions');  // malformado
    expect(weeklyPlanPhase(0, {} as { days?: unknown[] })).toBe('questions');
  });
  it('plan generado (.days no vacío) → plan', () => {
    expect(weeklyPlanPhase(0, valid)).toBe('plan');
  });
  it('coherencia init↔render: si la fase es "plan", hasGeneratedWeeklyPlan es true (no hay estado blank)', () => {
    for (const wp of [null, undefined, orphan, { days: [] }, { days: null }, {}, valid] as any[]) {
      const ph = weeklyPlanPhase(0, wp);
      if (ph === 'plan') expect(hasGeneratedWeeklyPlan(wp)).toBe(true);
    }
  });
});
