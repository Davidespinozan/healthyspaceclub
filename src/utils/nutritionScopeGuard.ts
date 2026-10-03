// ─────────────────────────────────────────────────────────────────────────────
// CAPA 1 · NUTRITION SCOPE GUARD
//
// Decide si una persona está dentro del alcance de HSC Nutrition, ANTES de que
// se clasifique su actividad y antes de que se estime su mantenimiento.
//
//   Profile Validation → [ESTE MÓDULO] → ActivityClassifier → MaintenanceEstimate → …
//
// Puro / determinista / sin estado.
//
// ── POR QUÉ ES UN MÓDULO SEPARADO ───────────────────────────────────────────
// Para que «antes del clasificador» sea un hecho ESTRUCTURAL y no una
// convención revisable. El orquestador no puede llamar a `classifyActivity`
// hasta tener un `null` de aquí: el orden deja de ser una línea que alguien
// puede mover y pasa a ser una dependencia de datos.
//
// ── LAS DOS REGLAS, Y NADA MÁS ──────────────────────────────────────────────
//   1. ageYears < 19          → OUTSIDE_HSC_NUTRITION_SCOPE · age_under_19
//   2. pregnantOrLactating    → OUTSIDE_HSC_NUTRITION_SCOPE · pregnancy_or_lactation
//
// El orden es FIJO (edad primero) para que `scopeReason` sea determinista
// cuando se cumplen las dos a la vez.
//
// ── NO HAY TOPE SUPERIOR DE EDAD ────────────────────────────────────────────
// 19, 65, 70, 75, 80, 100: todas dentro. No existe factor por edad, ni ruta
// geriátrica, ni ecuación alternativa. El propio DRI publica una sola ruta
// adulta «19 years and above» sin límite superior.
//
// ── QUÉ *NO* HACE ESTE ESTADO ───────────────────────────────────────────────
// Fuera de alcance significa fuera: no se redirige a mantenimiento, no se
// redirige a «bienestar», no se entrega ninguna kcal, y no se produce
// ActivityClassification, MaintenanceEstimate ni EnergyPrescription. Es una
// frontera de producto, no una dieta alternativa.
//
// ── POR QUÉ EL UMBRAL SE IMPORTA Y NO SE COPIA ──────────────────────────────
// `ADULT_ROUTE_MIN_AGE_YEARS` viene de `maintenanceEstimate`, que es quien
// LANZA si recibe una edad por debajo. El trabajo de este guard es
// precisamente impedir que el motor vea esa edad, así que derivar el umbral del
// propio motor es el invariante — si se copiara el 19, podrían divergir y el
// guard dejaría pasar una edad que el motor rechaza.
//
// ── QUÉ NO ENTRA AQUÍ ───────────────────────────────────────────────────────
// `nutritionTargets`, `wellnessMode`, `obData`, `targetWeight`, `bodyFat`, el
// store, Supabase, Training observado. Tampoco kcal de ningún tipo.
// ─────────────────────────────────────────────────────────────────────────────
import { ADULT_ROUTE_MIN_AGE_YEARS } from './maintenanceEstimate';
import type { CanonicalGoal } from './energyPrescription';
import type { ValidatedNutritionProfile } from './profileValidation';

/** Por qué quedó fuera del alcance de HSC Nutrition. Ambos motivos comparten estado. */
export type NutritionScopeReason = 'age_under_19' | 'pregnancy_or_lactation';

export const NUTRITION_SCOPE_REASONS: readonly NutritionScopeReason[] =
  ['age_under_19', 'pregnancy_or_lactation'];

/**
 * Resultado de quedar fuera de alcance.
 *
 * Deliberadamente mínimo: NO lleva `orchestratorVersion`. La versión del
 * ensamblaje la pone el orquestador, que es su dueño — ponerla aquí obligaría a
 * este módulo a conocer una constante que no le pertenece y crearía una
 * dependencia circular con el ensamblador.
 *
 * El `goal` declarado SÍ se conserva: sin él no se puede explicar después qué
 * pedía la persona cuando el producto le dijo que no.
 */
export interface OutsideHscNutritionScopeResult {
  status: 'OUTSIDE_HSC_NUTRITION_SCOPE';
  scopeReason: NutritionScopeReason;
  goal: CanonicalGoal;
}

/**
 * Comprueba el alcance de HSC Nutrition.
 *
 * Devuelve `null` cuando la persona está DENTRO. Un predicado que devuelve el
 * motivo —en vez de un booleano— evita que el consumidor tenga que volver a
 * deducir por qué quedó fuera.
 */
export function checkNutritionScope(
  profile: ValidatedNutritionProfile,
): OutsideHscNutritionScopeResult | null {
  // 1 · EDAD. Primero, para que el motivo sea determinista si también está
  //     embarazada o en lactancia.
  if (profile.ageYears < ADULT_ROUTE_MIN_AGE_YEARS) {
    return {
      status: 'OUTSIDE_HSC_NUTRITION_SCOPE',
      scopeReason: 'age_under_19',
      goal: profile.goal,
    };
  }

  // 2 · EMBARAZO / LACTANCIA.
  if (profile.pregnantOrLactating) {
    return {
      status: 'OUTSIDE_HSC_NUTRITION_SCOPE',
      scopeReason: 'pregnancy_or_lactation',
      goal: profile.goal,
    };
  }

  return null;
}
