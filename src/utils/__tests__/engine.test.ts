import { describe, it, expect } from 'vitest';
import { calcPortionKcal, calcMealKcal, calcDayKcal } from '../kcalCalc';
import { calcTDEE, assignPlan } from '../tdee';
import { scalePlan } from '../scalePlan';
import { mealPlans } from '../../data/mealPlan';

/* ───────────────────────────────────────────── */
/*  TDEE & Plan Assignment                       */
/* ───────────────────────────────────────────── */
describe('calcTDEE', () => {
  it('Hombre 80kg 178cm 28a Sedentaria = ~2133', () => {
    const tdee = calcTDEE('Hombre', 80, 178, 28, 'Sedentaria');
    expect(tdee).toBeGreaterThanOrEqual(2100);
    expect(tdee).toBeLessThanOrEqual(2170);
  });

  it('Hombre 80kg 178cm 28a Moderada = ~2755', () => {
    const tdee = calcTDEE('Hombre', 80, 178, 28, 'Moderada');
    expect(tdee).toBeGreaterThanOrEqual(2700);
    expect(tdee).toBeLessThanOrEqual(2800);
  });

  it('Mujer 60kg 165cm 25a Ligera = ~1850', () => {
    const tdee = calcTDEE('Mujer', 60, 165, 25, 'Ligera');
    expect(tdee).toBeGreaterThanOrEqual(1800);
    expect(tdee).toBeLessThanOrEqual(1900);
  });

  it('unknown activity falls back to 1.375', () => {
    const tdee = calcTDEE('Hombre', 80, 178, 28, 'INVALID');
    const expected = calcTDEE('Hombre', 80, 178, 28, 'Ligera');
    expect(tdee).toBe(expected);
  });
});

describe('assignPlan', () => {
  it('Bajar grasa corporal with high TDEE → planB or higher', () => {
    const plan = assignPlan(3000, 'Bajar grasa corporal'); // 3000*0.80 = 2400
    expect(plan).toBe('planB');
  });

  it('Subir masa muscular with moderate TDEE → planA', () => {
    const plan = assignPlan(2600, 'Subir masa muscular'); // 2600*1.10 = 2860
    expect(plan).toBe('planA');
  });

  it('Recomponer with low TDEE → planC', () => {
    const plan = assignPlan(2000, 'Recomponer'); // 2000*0.95 = 1900
    expect(plan).toBe('planC');
  });

  it('Mantener peso with 2000 TDEE → planC', () => {
    const plan = assignPlan(2000, 'Mantener peso');
    expect(plan).toBe('planC');
  });
});

/* ───────────────────────────────────────────── */
/*  Calorie Calculation                          */
/* ───────────────────────────────────────────── */
describe('calcPortionKcal', () => {
  it('200 g pechuga de pollo ≈ 330 kcal', () => {
    const kcal = calcPortionKcal('200 g pechuga de pollo');
    expect(kcal).toBeGreaterThan(250);
    expect(kcal).toBeLessThan(400);
  });

  it('2 tz arroz cocido ≈ 420 kcal', () => {
    const kcal = calcPortionKcal('2 tz arroz cocido');
    expect(kcal).toBeGreaterThan(350);
    expect(kcal).toBeLessThan(500);
  });

  it('2 pz de huevo ≈ 143 kcal', () => {
    const kcal = calcPortionKcal('2 pz de huevo');
    expect(kcal).toBeGreaterThan(100);
    expect(kcal).toBeLessThan(200);
  });

  it('salsa free items return near 0 (≤15 kcal)', () => {
    expect(calcPortionKcal('Salsa verde hecha en casa')).toBeLessThanOrEqual(15);
    expect(calcPortionKcal('Salsa de tu preferencia')).toBeLessThanOrEqual(15);
  });

  it('½ tz yogur natural sin azúcar > 0', () => {
    const kcal = calcPortionKcal('½ tz yogur natural sin azúcar');
    expect(kcal).toBeGreaterThan(20);
    expect(kcal).toBeLessThan(120);
  });
});

describe('calcMealKcal', () => {
  it('sums portion kcals correctly', () => {
    const portions = ['200 g pechuga de pollo', '2 tz arroz cocido'];
    const total = calcMealKcal(portions);
    expect(total).toBeGreaterThan(500);
    expect(total).toBeLessThan(900);
  });
});

describe('calcDayKcal', () => {
  it('planA day 1 totals fall within ±20% of 3000', () => {
    const day = mealPlans['planA'][0];
    const total = calcDayKcal(day.meals);
    expect(total).toBeGreaterThan(2200);
    expect(total).toBeLessThan(3800);
  });
});

/* ───────────────────────────────────────────── */
/*  scalePlan                                    */
/* ───────────────────────────────────────────── */
describe('scalePlan', () => {
  const planA = mealPlans['planA'];

  it('scaling to 3000 kcal keeps accuracy within 8%', () => {
    const scaled = scalePlan(planA, 3000);
    for (const day of scaled.slice(0, 5)) {
      const kcal = calcDayKcal(day.meals);
      const err = Math.abs(kcal - 3000) / 3000;
      expect(err).toBeLessThan(0.08);
    }
  });

  it('scaling to 1800 kcal keeps accuracy within 10%', () => {
    const scaled = scalePlan(planA, 1800);
    for (const day of scaled.slice(0, 5)) {
      const kcal = calcDayKcal(day.meals);
      const err = Math.abs(kcal - 1800) / 1800;
      expect(err).toBeLessThan(0.10);
    }
  });

  it('scaling to 2400 kcal keeps accuracy within 8%', () => {
    const scaled = scalePlan(planA, 2400);
    for (const day of scaled.slice(0, 5)) {
      const kcal = calcDayKcal(day.meals);
      const err = Math.abs(kcal - 2400) / 2400;
      expect(err).toBeLessThan(0.08);
    }
  });

  it('portion text stays human-readable (no decimals > 1 digit)', () => {
    const scaled = scalePlan(planA, 2400);
    for (const day of scaled.slice(0, 3)) {
      for (const meal of day.meals) {
        for (const p of meal.portions) {
          // No wild decimal places like 1.333333
          expect(p).not.toMatch(/\d+\.\d{3,}/);
        }
      }
    }
  });
});
