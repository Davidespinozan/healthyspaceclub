import { describe, it, expect } from 'vitest';
import { scalePlan } from '../scalePlan';
import { adjustDayToMeta } from '../adjustToMeta';
import { dayNutrition } from '../mealNutrition';
import { mealPlanData } from '../../data/mealPlan';

const T = { protG: 154, carbG: 422, fatG: 86 };

describe('adjustDayToMeta — pega a la meta con porciones sensatas', () => {
  const dayBase = scalePlan([mealPlanData.find(d => d.meals.some(m => m.name === 'Tinga de Pollo'))!], 3047)[0];
  const adj = adjustDayToMeta(dayBase, T);
  const m = dayNutrition(adj.meals);

  it('acerca los 3 macros a la meta (±12%)', () => {
    expect(Math.abs(m.prot - T.protG) / T.protG).toBeLessThan(0.12);
    expect(Math.abs(m.carbs - T.carbG) / T.carbG).toBeLessThan(0.12);
    expect(Math.abs(m.fat - T.fatG) / T.fatG).toBeLessThan(0.12);
  });

  it('mejora vs. el plan sin ajustar', () => {
    const b = dayNutrition(dayBase.meals);
    const errB = Math.abs(b.prot - T.protG) + Math.abs(b.carbs - T.carbG) + Math.abs(b.fat - T.fatG);
    const errA = Math.abs(m.prot - T.protG) + Math.abs(m.carbs - T.carbG) + Math.abs(m.fat - T.fatG);
    expect(errA).toBeLessThan(errB);
  });

  it('NO deforma: ningún carbo pasa de ~2 tazas', () => {
    for (const meal of adj.meals) for (const p of meal.portions) {
      const tz = p.match(/(\d+(?:\s*[½⅓¼¾⅔])?)\s+taza/);
      if (tz) expect(parseFloat(tz[1])).toBeLessThanOrEqual(3);
    }
  });
});
