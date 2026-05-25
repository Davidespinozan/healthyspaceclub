// Cálculo del consumo del día — Lote Food-5.
//
// Antes de Food-5 el cálculo era inconsistente:
// - Marcar ✓ una comida del plan NO sumaba kcal (solo contaba "x/5")
// - Registrar "otra cosa" SÍ sumaba kcal
// Si el user seguía 3 del plan y registraba 1 extra, la card solo contaba
// la registrada — mentía sobre lo que realmente comió.
//
// Solución (Opción B — suma directa con regla anti-duplicado):
// - sumPlan = suma kcal del plan SOLO para franjas marcadas ✓ AND no
//   resueltas-por-log
// - sumFood = suma kcal de TODO el foodLog del día
// - consumido = sumPlan + sumFood
//
// La regla anti-duplicado es: si una franja está marcada ✓ Y tiene una
// entry de foodLog (mealResolvedByLog===true), se EXCLUYE del sumPlan
// — sus kcal vienen del foodLog. mealResolvedByLog es la llave anti-
// duplicado introducida en Food-4 precisamente para este cálculo.
//
// Edge case aceptado: si el user marca ✓ una franja Y registra extra
// adicional en la misma franja, perdemos las kcal del plan original
// (el foodLog gana como ground truth). En la práctica este caso es
// muy raro: registrar = "no seguí el plan acá", marcar = "sí seguí".

import { calcMealKcal } from './kcalCalc';

export interface DayConsumptionInput {
  todayMeals: { portions: string[] }[];
  mealChecks: Record<string, boolean>;
  mealResolvedByLog: Record<string, true>;
  foodLog: { date: string; kcal: number }[];
  today: string; // YYYY-MM-DD
}

export interface DayConsumption {
  /** Total kcal consumido (plan ✓ no-resuelto + todo foodLog del día). */
  consumedKcal: number;
  /** Franjas con actividad (marcadas ✓ o resueltas por log). */
  completedSlots: number;
  /** Total de franjas del día (todayMeals.length). */
  totalSlots: number;
}

export function computeDayConsumption(input: DayConsumptionInput): DayConsumption {
  const { todayMeals, mealChecks, mealResolvedByLog, foodLog, today } = input;
  const totalSlots = todayMeals.length;

  let sumPlan = 0;
  let completedSlots = 0;

  for (let i = 0; i < totalSlots; i++) {
    const key = `meal-${today}-${i}`;
    const checked = !!mealChecks[key];
    const resolved = !!mealResolvedByLog[key];

    // Slot cuenta como "completado" si tiene cualquier actividad
    if (checked || resolved) completedSlots++;

    // Plan suma SOLO si checked AND no resolved (anti-duplicado)
    if (checked && !resolved) {
      sumPlan += calcMealKcal(todayMeals[i].portions);
    }
  }

  const sumFood = foodLog
    .filter(e => e.date === today)
    .reduce((acc, e) => acc + e.kcal, 0);

  return {
    consumedKcal: Math.round(sumPlan + sumFood),
    completedSlots,
    totalSlots,
  };
}
