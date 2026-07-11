// ─────────────────────────────────────────────────────────────────────────
// mealNutrition — calcula kcal + macros de una comida desde las PORCIONES del
// plan, resolviendo cada ingrediente al catálogo de Magaly (planFoods) con el
// matcher robusto. Reemplaza al estimador de texto viejo (calcMealKcal) para el
// lado del plan: números reales de Magaly, base única con la Calculadora.
// ─────────────────────────────────────────────────────────────────────────
import { planFoods, type PlanFood } from '../data/planFoods';
import { matchFood, type FoodRef } from './foodMatcher';

export interface MealNutrition {
  kcal: number; prot: number; carbs: number; fat: number; fiber: number;
  misses: string[]; // ingredientes que no se pudieron resolver (transparencia)
}

const REFS: FoodRef[] = planFoods.map(f => ({ id: f.id, name: f.name, grupo: f.grupo }));
const BY_ID = new Map<string, PlanFood>(planFoods.map(f => [f.id, f]));

const FRAC: Record<string, number> = { '½': .5, '⅓': 1 / 3, '¼': .25, '¾': .75, '⅔': 2 / 3, '⅙': 1 / 6, '⅜': 3 / 8 };
function parseAmt(s: string): number {
  s = s.trim();
  const m = s.match(/^(\d+)\s*([½⅓¼¾⅔⅙⅜])$/); if (m) return +m[1] + (FRAC[m[2]] ?? 0);
  if (FRAC[s] != null) return FRAC[s];
  const sl = s.match(/^(\d+)\/(\d+)$/); if (sl) return +sl[1] / +sl[2];
  return parseFloat(s) || 0;
}
const UNITS = 'g|gr|tz|tazas?|pz|piezas?|cdas?|cditas?|cucharadas?|cucharaditas?|rebanadas?|reb|latas?|tacos?';
const RE_QUF = new RegExp(`^((?:\\d+\\s*)?[½⅓¼¾⅔⅙⅜]|\\d+(?:\\.\\d+)?(?:/\\d+)?)\\s+(${UNITS})\\s+(.+)$`, 'i');
const RE_QF = new RegExp(`^((?:\\d+\\s*)?[½⅓¼¾⅔⅙⅜]|\\d+(?:\\.\\d+)?(?:/\\d+)?)\\s+(.+)$`);
const UNIT_NORM: Record<string, string> = {
  taza: 'tz', tazas: 'tz', pieza: 'pz', piezas: 'pz', cucharada: 'cda', cucharadas: 'cda',
  cucharadita: 'cdita', cucharaditas: 'cdita', rebanada: 'reb', rebanadas: 'reb',
  lata: 'lata', latas: 'lata', gr: 'g', taco: 'pz',
};
// Gramos genéricos por unidad cuando el alimento no trae esa medida (garnitura).
const GENERIC: Record<string, number> = { g: 1, ml: 1, cda: 15, cdita: 5, tz: 120, reb: 20, lata: 120 };

function grams(amount: number, unit: string | null, fd: PlanFood): number {
  if (unit == null) return amount * fd.ug;              // "6 huevos" → 6 piezas; bare (amount=1) → 1 porción
  const u = UNIT_NORM[unit.toLowerCase()] ?? unit.toLowerCase();
  if (u === 'g') return amount;
  if (fd.unit === u) return amount * fd.ug;             // unidad canónica del alimento
  if (fd.m[u] != null) return amount * fd.m[u];         // medida extra (food_measures)
  if (u === 'pz') return amount * (fd.unit === 'pz' ? fd.ug : 60);
  return amount * (GENERIC[u] ?? fd.ug);                // fallback genérico (bajo impacto)
}

/** Calcula kcal + macros de una comida (array de porciones del plan). */
export function mealNutrition(portions: string[]): MealNutrition {
  const acc: MealNutrition = { kcal: 0, prot: 0, carbs: 0, fat: 0, fiber: 0, misses: [] };
  for (const raw of portions ?? []) {
    for (const sub of raw.replace(/^[^:]+:\s*/, '').split(/\s+\+\s+/)) {
      const s = sub.trim(); if (!s) continue;
      let amount = 1, unit: string | null = null, ing = s;
      const mu = s.match(RE_QUF), mf = s.match(RE_QF);
      if (mu) { amount = parseAmt(mu[1]); unit = mu[2]; ing = mu[3]; }
      else if (mf) { amount = parseAmt(mf[1]); ing = mf[2]; }
      const match = matchFood(ing, REFS);
      if (!match.foodId) { acc.misses.push(s); continue; }
      const fd = BY_ID.get(match.foodId)!;
      const g = grams(amount, unit, fd);
      acc.kcal += fd.k * g / 100; acc.prot += fd.p * g / 100;
      acc.carbs += fd.c * g / 100; acc.fat += fd.f * g / 100; acc.fiber += fd.fb * g / 100;
    }
  }
  return acc;
}

/** kcal de una comida (compat con la firma de calcMealKcal). */
export function mealKcal(portions: string[]): number {
  return Math.round(mealNutrition(portions).kcal);
}

/** Macros de una comida: usa los EXACTOS del motor (banco) si vienen; si no, los
 *  calcula desde las porciones. Punto único para plan viejo (strings) y nuevo (motor). */
export function mealMacros(meal: { portions?: string[]; macros?: { kcal: number; prot: number; fat: number; carb: number; fiber?: number } }): MealNutrition {
  if (meal.macros) {
    return { kcal: meal.macros.kcal, prot: meal.macros.prot, carbs: meal.macros.carb, fat: meal.macros.fat, fiber: meal.macros.fiber ?? 0, misses: [] };
  }
  return mealNutrition(meal.portions ?? []);
}

/** Macros de un día completo (varias comidas). */
export function dayNutrition(meals: { portions: string[]; macros?: { kcal: number; prot: number; fat: number; carb: number } }[]): MealNutrition {
  return meals.reduce<MealNutrition>((a, m) => {
    const n = mealMacros(m);
    return { kcal: a.kcal + n.kcal, prot: a.prot + n.prot, carbs: a.carbs + n.carbs, fat: a.fat + n.fat, fiber: a.fiber + n.fiber, misses: [...a.misses, ...n.misses] };
  }, { kcal: 0, prot: 0, carbs: 0, fat: 0, fiber: 0, misses: [] });
}
