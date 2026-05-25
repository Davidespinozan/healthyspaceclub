import { describe, it, expect } from 'vitest';
import { computeDayConsumption } from '../foodConsumption';
import { calcMealKcal } from '../kcalCalc';

const TODAY = '2026-05-26';
const YESTERDAY = '2026-05-25';

// Meals con porciones que se parsean a kcal reales (calcMealKcal usa nutritionDB).
// Mantenemos cantidades simples para que los tests sean deterministas y los kcal
// derivados sean razonables. La función calcMealKcal es pura — los valores
// exactos los calculamos llamándola en cada test.
const meals = [
  { portions: ['2 huevos', '2 reb pan integral'] },             // i=0 Desayuno
  { portions: ['1 manzana'] },                                   // i=1 Snack AM
  { portions: ['200 g pechuga de pollo', '1 tz arroz cocido'] }, // i=2 Comida
  { portions: ['10 g almendras'] },                              // i=3 Snack PM
  { portions: ['150 g salmón', '1 tz brócoli'] },                // i=4 Cena
];
const totalSlots = meals.length; // 5

const k = (i: number) => `meal-${TODAY}-${i}`;

describe('computeDayConsumption', () => {
  it('día vacío (cero checks, cero resolved, cero foodLog) → ceros', () => {
    const r = computeDayConsumption({
      todayMeals: meals,
      mealChecks: {},
      mealResolvedByLog: {},
      foodLog: [],
      today: TODAY,
    });
    expect(r).toEqual({ consumedKcal: 0, completedSlots: 0, totalSlots });
  });

  it('solo plan: 3 ✓ de 5, sin foodLog → consumed = suma de esas 3, completed: 3', () => {
    const r = computeDayConsumption({
      todayMeals: meals,
      mealChecks: { [k(0)]: true, [k(2)]: true, [k(4)]: true },
      mealResolvedByLog: {},
      foodLog: [],
      today: TODAY,
    });
    const expected = Math.round(
      calcMealKcal(meals[0].portions) +
      calcMealKcal(meals[2].portions) +
      calcMealKcal(meals[4].portions),
    );
    expect(r.consumedKcal).toBe(expected);
    expect(r.completedSlots).toBe(3);
    expect(r.totalSlots).toBe(totalSlots);
  });

  it('solo foodLog: 2 entries (300+500), sin checks ni resolved → consumed: 800, completed: 0', () => {
    const r = computeDayConsumption({
      todayMeals: meals,
      mealChecks: {},
      mealResolvedByLog: {},
      foodLog: [
        { date: TODAY, kcal: 300 },
        { date: TODAY, kcal: 500 },
      ],
      today: TODAY,
    });
    expect(r).toEqual({ consumedKcal: 800, completedSlots: 0, totalSlots });
  });

  it('solo resueltos: 2 franjas resolved + 2 entries (300+500) → consumed: 800, completed: 2', () => {
    const r = computeDayConsumption({
      todayMeals: meals,
      mealChecks: {},
      mealResolvedByLog: { [k(1)]: true, [k(3)]: true },
      foodLog: [
        { date: TODAY, kcal: 300 },
        { date: TODAY, kcal: 500 },
      ],
      today: TODAY,
    });
    expect(r).toEqual({ consumedKcal: 800, completedSlots: 2, totalSlots });
  });

  it('mixto sin solapamiento: 2 ✓ (A,B) + 1 resolved (C) con foodLog 300 → suma 3 + completed 3', () => {
    const r = computeDayConsumption({
      todayMeals: meals,
      mealChecks: { [k(0)]: true, [k(1)]: true },     // franjas A, B
      mealResolvedByLog: { [k(2)]: true },             // franja C resuelta por log
      foodLog: [{ date: TODAY, kcal: 300 }],
      today: TODAY,
    });
    const expected = Math.round(
      calcMealKcal(meals[0].portions) +
      calcMealKcal(meals[1].portions) +
      300,
    );
    expect(r.consumedKcal).toBe(expected);
    expect(r.completedSlots).toBe(3);
  });

  it('solapamiento anti-duplicado: franja ✓ AND resolved + foodLog 300 → consumed = 300 (excluye plan)', () => {
    const r = computeDayConsumption({
      todayMeals: meals,
      mealChecks: { [k(0)]: true },         // marcada
      mealResolvedByLog: { [k(0)]: true },  // Y resuelta — gana foodLog
      foodLog: [{ date: TODAY, kcal: 300 }],
      today: TODAY,
    });
    expect(r.consumedKcal).toBe(300);
    expect(r.completedSlots).toBe(1);
  });

  it('foodLog huérfano (sin franja, ej. WNP no-hoy): 0 checks, 0 resolved, 1 entry 300 → consumed: 300, completed: 0', () => {
    const r = computeDayConsumption({
      todayMeals: meals,
      mealChecks: {},
      mealResolvedByLog: {},
      foodLog: [{ date: TODAY, kcal: 300 }],
      today: TODAY,
    });
    expect(r).toEqual({ consumedKcal: 300, completedSlots: 0, totalSlots });
  });

  it('foodLog de otra fecha (date=ayer) → NO se cuenta', () => {
    const r = computeDayConsumption({
      todayMeals: meals,
      mealChecks: {},
      mealResolvedByLog: {},
      foodLog: [
        { date: YESTERDAY, kcal: 300 },
        { date: YESTERDAY, kcal: 500 },
      ],
      today: TODAY,
    });
    expect(r).toEqual({ consumedKcal: 0, completedSlots: 0, totalSlots });
  });

  it('mezcla de fechas: solo cuenta foodLog de today', () => {
    const r = computeDayConsumption({
      todayMeals: meals,
      mealChecks: {},
      mealResolvedByLog: {},
      foodLog: [
        { date: YESTERDAY, kcal: 999 },
        { date: TODAY, kcal: 100 },
        { date: TODAY, kcal: 200 },
      ],
      today: TODAY,
    });
    expect(r.consumedKcal).toBe(300);
  });

  it('todayMeals vacío (sin plan) → ceros sin crash', () => {
    const r = computeDayConsumption({
      todayMeals: [],
      mealChecks: { [k(0)]: true },
      mealResolvedByLog: {},
      foodLog: [{ date: TODAY, kcal: 250 }],
      today: TODAY,
    });
    // sumPlan=0 (no hay meals), sumFood=250
    expect(r).toEqual({ consumedKcal: 250, completedSlots: 0, totalSlots: 0 });
  });

  it('mealChecks de OTRA fecha no afecta a hoy', () => {
    const r = computeDayConsumption({
      todayMeals: meals,
      mealChecks: { [`meal-${YESTERDAY}-0`]: true }, // check de ayer
      mealResolvedByLog: {},
      foodLog: [],
      today: TODAY,
    });
    expect(r).toEqual({ consumedKcal: 0, completedSlots: 0, totalSlots });
  });
});
