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

// COACH-CONTEXT-1 · MISMA selección de "día de HOY del plan" que usa WeeklyNutritionPlanner
// (mapeo weekday→día del plan vía shoppingDay + selectedDays). Se extrae aquí como pura y
// única fuente para que el Coach y la UI de nutrición no puedan divergir. Sin lógica de
// consumo/macros (esa la calculan computeDayConsumption/computeNutritionTargets). O(n) trivial.
export function resolveTodayPlanMeals<M>(
  wp: { days?: Array<{ day: number; meals: M[] }>; selectedDays?: number[] } | null | undefined,
  shoppingDay: number | null,
  weekday: number,
): M[] {
  const days = wp?.days;
  if (!Array.isArray(days) || days.length === 0) return [];
  const selectedDays = wp?.selectedDays ?? [];
  const todayOffset = shoppingDay !== null ? ((weekday - shoppingDay + 7) % 7) : -1;
  const todayNum = selectedDays[todayOffset >= 0 ? todayOffset : 0] ?? selectedDays[0];
  return days.find(d => d.day === todayNum)?.meals ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// CAPA 1E · FASE C4 · VIGENCIA DEL PLAN SEMANAL
//
// ¿El plan guardado corresponde a la prescripción vigente? Se DERIVA; no se
// persiste nada nuevo y no se muta el plan.
//
//   ACTIVE       · los platillos están dimensionados a la energía de hoy
//   STALE        · hay prescripción, pero el plan no le corresponde → regenerar
//   NOT_CURRENT  · no hay prescripción vigente, o no hay plan
//
// ── POR QUÉ `gen.kcal` Y NO UN HASH DE INPUTS ───────────────────────────────
// La pregunta es «¿los platillos están dimensionados a la energía vigente?». Si
// alguien cambia su movimiento diario y la prescripción NO cambia, el plan sigue
// siendo válido y no se regenera; un hash de inputs forzaría una regeneración
// inútil. Deliberadamente NO entran `avoid`, antojo, batido ni región: eso es
// vigencia del GENERADOR, no de la energía, y queda fuera de C4.
//
// Su hueco conocido: si la energía nueva coincide por casualidad con la de un
// plan legacy, `gen.kcal` lo daría por ACTIVE. Lo cubre el salto de
// PLAN_ENGINE_VERSION, que marca stale TODO plan anterior sin mirar la cifra.
// Los dos mecanismos son necesarios y no se solapan.
//
// ── NO SE CONFUNDE CON `energyInputIdentity` ────────────────────────────────
// Ésa responde «¿la cifra guardada se calculó con los inputs actuales?» y
// gobierna la HIDRATACIÓN. Dos preguntas distintas, dos mecanismos distintos.
// ─────────────────────────────────────────────────────────────────────────────
export type WeeklyPlanCurrentness = 'ACTIVE' | 'STALE' | 'NOT_CURRENT';

/**
 * Puro y sin dependencias del módulo energético: recibe el `status` y la cifra ya
 * resueltos, no el estado completo. Así este archivo no necesita conocer la
 * cadena de nutrición.
 */
export function weeklyPlanCurrentness(input: {
  /** `status` del estado energético vigente. */
  status: string | null | undefined;
  /** Proyección vigente. `null` = no hay prescripción utilizable. */
  planGoal: number | null;
  weeklyPlan: { days?: unknown[]; engineVersion?: number; gen?: { kcal?: number } } | null | undefined;
  /** `PLAN_ENGINE_VERSION` actual. Se recibe para no acoplar esto al motor de platillos. */
  currentVersion: number;
}): WeeklyPlanCurrentness {
  const { status, planGoal, weeklyPlan, currentVersion } = input;

  // Sin plan generado no hay nada que presentar como vigente.
  if (!hasGeneratedWeeklyPlan(weeklyPlan)) return 'NOT_CURRENT';

  // Sin prescripción el plan existe físicamente pero NO opera como plan activo.
  // Cubre los cinco estados sin cifra, incluido el perfil fuera de alcance.
  if (status !== 'PRESCRIBED' || planGoal == null) return 'NOT_CURRENT';

  // Plan sellado por un motor de platillos anterior.
  if ((weeklyPlan.engineVersion ?? 0) < currentVersion) return 'STALE';

  // Plan dimensionado a otra energía.
  if (weeklyPlan.gen?.kcal !== planGoal) return 'STALE';

  return 'ACTIVE';
}
