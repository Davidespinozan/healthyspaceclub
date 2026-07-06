import { describe, it, expect } from 'vitest';
import { computeCoach } from '../nutritionCoach';

const target = { kcal: 2000, prot: 145, carbs: 200, fat: 55 };

describe('computeCoach', () => {
  it('arranque del día: sin comidas → headline "start", tono good', () => {
    const c = computeCoach({
      consumed: { kcal: 0, prot: 0, carbs: 0, fat: 0 },
      target, mealsDone: 0, mealsTotal: 3,
    });
    expect(c.headline).toBe('start');
    expect(c.tone).toBe('good');
    expect(c.kcalLeft).toBe(2000);
    expect(c.mealsLeft).toBe(3);
    expect(c.perMealKcal).toBe(667);
  });

  it('a medio día con proteína al paso → good', () => {
    const c = computeCoach({
      consumed: { kcal: 1180, prot: 100, carbs: 108, fat: 41 },
      target, mealsDone: 2, mealsTotal: 3,
    });
    expect(c.headline).toBe('good');
    expect(c.focus).toBeNull();
    expect(c.kcalLeft).toBe(820);
    expect(c.mealsLeft).toBe(1);
    expect(c.perMealKcal).toBe(820);
  });

  it('proteína atrasada → headline "protein", focus prot, tono watch', () => {
    const c = computeCoach({
      consumed: { kcal: 1180, prot: 55, carbs: 150, fat: 45 },
      target, mealsDone: 2, mealsTotal: 3,
    });
    expect(c.headline).toBe('protein');
    expect(c.focus).toBe('prot');
    expect(c.tone).toBe('watch');
    expect(c.protLeft).toBe(90);
    expect(c.macros.find(m => m.key === 'prot')!.status).toBe('watch');
  });

  it('exceso de kcal → headline "over", tono over', () => {
    const c = computeCoach({
      consumed: { kcal: 2300, prot: 150, carbs: 260, fat: 70 },
      target, mealsDone: 2, mealsTotal: 3,
    });
    expect(c.headline).toBe('over');
    expect(c.tone).toBe('over');
    expect(c.over).toBe(true);
    expect(c.kcalLeft).toBeLessThan(0);
  });

  it('día cerrado en meta con buena proteína → doneGood', () => {
    const c = computeCoach({
      consumed: { kcal: 1980, prot: 140, carbs: 200, fat: 54 },
      target, mealsDone: 3, mealsTotal: 3,
    });
    expect(c.headline).toBe('doneGood');
    expect(c.tone).toBe('good');
    expect(c.mealsLeft).toBe(0);
    expect(c.perMealKcal).toBe(0);
  });

  it('día cerrado pero con proteína corta → doneShort', () => {
    const c = computeCoach({
      consumed: { kcal: 1950, prot: 90, carbs: 240, fat: 60 },
      target, mealsDone: 3, mealsTotal: 3,
    });
    expect(c.headline).toBe('doneShort');
    expect(c.tone).toBe('watch');
    expect(c.focus).toBe('prot');
  });

  it('no divide entre cero si no hay comidas configuradas', () => {
    const c = computeCoach({
      consumed: { kcal: 0, prot: 0, carbs: 0, fat: 0 },
      target, mealsDone: 0, mealsTotal: 0,
    });
    expect(c.perMealKcal).toBe(0);
    expect(c.mealsLeft).toBe(0);
    expect(Number.isFinite(c.kcalLeft)).toBe(true);
  });
});
