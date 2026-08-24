// ─────────────────────────────────────────────────────────────────────────────
// NUTRITION-N5 · autoridad de estado del plan nutricional.
//
// Un plan es RENDERABLE solo cuando el motor generó sus días (`.days`). Un objeto weeklyPlan legacy/orphan
// (truthy pero SIN `.days`, de antes del motor) NO es un plan visible: se trata igual que "sin plan" →
// el flujo existente "Arma tu plan" / cuestionario. Así se retira el preview legacy `scalePlan` (porciones
// escaladas de forma uniforme, sin los topes humanos de N1). Puro, sin dependencias.
// ─────────────────────────────────────────────────────────────────────────────

/** ¿El weeklyPlan es un plan GENERADO por el motor (con días usables)? Falso para null/orphan sin `.days`.
 *  Type predicate: al pasar el guard, el llamador puede tratar `wp` como no-nulo con `.days`. */
export function hasGeneratedWeeklyPlan<T extends { days?: unknown[] }>(
  wp: T | null | undefined,
): wp is T & { days: NonNullable<T['days']> } {
  return Array.isArray(wp?.days) && wp.days.length > 0;
}

// NUTRITION-N5.1 · fase inicial de WeeklyNutritionPlanner. La MISMA autoridad decide la fase que el
// render: si no hay plan GENERADO (orphan/vacío/malformado), la fase es 'questions' (cuestionario), no
// 'plan'. Antes el init usaba truthiness cruda (`weeklyPlan ? 'plan'`) y el render gateaba con
// hasGeneratedWeeklyPlan → fase 'plan' + render null = pantalla en blanco. NO es una 2ª autoridad:
// delega en hasGeneratedWeeklyPlan. Puro / O(1).
export type WeeklyPlanPhase = 'setup-day' | 'questions' | 'plan';
export function weeklyPlanPhase<T extends { days?: unknown[] }>(
  shoppingDay: number | null,
  wp: T | null | undefined,
): WeeklyPlanPhase {
  if (shoppingDay === null) return 'setup-day';
  return hasGeneratedWeeklyPlan(wp) ? 'plan' : 'questions';
}
