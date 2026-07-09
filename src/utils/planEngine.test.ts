import { describe, it, expect } from 'vitest';
import { buildWeeklyPlan, type PlanTarget } from './planEngine';

function dayTotals(meals: { macros?: { kcal: number; prot: number; fat: number; carb: number } }[]) {
  return meals.reduce(
    (a, m) => ({
      kcal: a.kcal + (m.macros?.kcal ?? 0),
      prot: a.prot + (m.macros?.prot ?? 0),
      fat: a.fat + (m.macros?.fat ?? 0),
      carb: a.carb + (m.macros?.carb ?? 0),
    }),
    { kcal: 0, prot: 0, fat: 0, carb: 0 },
  );
}

const CASES: PlanTarget[] = [
  { kcal: 1450, protG: 110, fatG: 50, carbG: 140 }, // mujer déficit
  { kcal: 1800, protG: 120, fatG: 55, carbG: 190 }, // mujer mantenimiento
  { kcal: 2300, protG: 160, fatG: 70, carbG: 250 }, // hombre mantenimiento
  { kcal: 2700, protG: 180, fatG: 80, carbG: 310 }, // hombre volumen (atleta)
];

describe('planEngine — ajuste a la meta', () => {
  for (const T of CASES) {
    it(`pega la meta ${T.kcal} kcal (P${T.protG}/F${T.fatG}/C${T.carbG})`, () => {
      const days = buildWeeklyPlan(T, { seed: 42 });
      expect(days).toHaveLength(7);
      for (const d of days) {
        const tot = dayTotals(d.meals);
        // Precisión: error máx por macro ≤ 12% (el prototipo da 0-3%; margen holgado).
        expect(Math.abs(tot.kcal - T.kcal) / T.kcal).toBeLessThan(0.12);
        expect(Math.abs(tot.prot - T.protG) / T.protG).toBeLessThan(0.12);
        expect(Math.abs(tot.fat - T.fatG) / T.fatG).toBeLessThan(0.15);
        expect(Math.abs(tot.carb - T.carbG) / T.carbG).toBeLessThan(0.15);
      }
    });
  }

  it('estructura de 5 tiempos (Snack AM + PM), combina snacks en meta alta', () => {
    const low = buildWeeklyPlan(CASES[0], { seed: 1 })[0];
    const high = buildWeeklyPlan(CASES[3], { seed: 1 })[0];
    const times = (d: typeof low) => d.meals.map((m) => m.time);
    expect(times(low)).toContain('Snack AM');
    expect(times(low)).toContain('Snack PM');
    // meta alta: 2 snacks por slot → más comidas que la meta baja
    expect(high.meals.length).toBeGreaterThan(low.meals.length);
  });
});
