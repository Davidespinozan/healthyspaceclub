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
// ── LAS CUATRO REGLAS, Y NADA MÁS ───────────────────────────────────────────
//   1. ageYears < 19            → OUTSIDE_HSC_NUTRITION_SCOPE · age_under_19
//   2. ageYears > 64            → OUTSIDE_HSC_NUTRITION_SCOPE · age_65_or_over
//   3. pregnantOrLactating      → OUTSIDE_HSC_NUTRITION_SCOPE · pregnancy_or_lactation
//   4. requiresTherapeuticDiet  → OUTSIDE_HSC_NUTRITION_SCOPE · therapeutic_diet_required
//
// El orden es FIJO (las dos de edad primero) para que `scopeReason` sea
// determinista cuando se cumplen varias a la vez. La regla 4 (A7) va al final:
// las tres anteriores ya sacan a la persona de alcance por su cuenta.
//
// HSC Nutrition V1 es para personas que NO necesitan una dieta terapéutica
// individualizada. No trata enfermedades, no prescribe dietas terapéuticas y no
// ajusta macros por diagnóstico: por eso no hay una lista de enfermedades, sino
// una sola pregunta funcional declarada por el socio.
//
// ── LA POBLACIÓN DE NUTRITION V1 ES 19–64 INCLUSIVE ─────────────────────────
// El tope superior es una decisión de PRODUCTO, no una limitación del motor: el
// DRI publica una sola ruta adulta «19 years and above» sin límite, y
// `MaintenanceEstimate` calcula perfectamente el EER de alguien de 75 años.
//
// Lo que HSC V1 todavía no hace es PRESCRIBIR nutrición personalizada a partir
// de los 65: pérdida de grasa en adulto mayor, fragilidad, sarcopenia y las
// necesidades clínicas de esa población son un diseño propio que esta versión no
// aborda, y entregar una cifra sin ese diseño sería peor que no entregarla. La
// expansión queda DIFERIDA a una versión futura.
//
// Esto NO afirma que una persona de 65+ no pueda recibir nutrición
// personalizada, y NO bloquea el resto de Healthy Space Club: solo delimita el
// alcance de ESTE módulo.
//
// SUPERSEDE la decisión anterior («age >= 19, ruta adulta sin tope superior»).
//
// ── QUÉ *NO* HACE ESTE ESTADO ───────────────────────────────────────────────
// Fuera de alcance significa fuera: no se redirige a mantenimiento, no se
// redirige a «bienestar», no se entrega ninguna kcal, y no se produce
// ActivityClassification, MaintenanceEstimate ni EnergyPrescription. Es una
// frontera de producto, no una dieta alternativa.
//
// ── LOS DOS UMBRALES SON ASIMÉTRICOS, Y A PROPÓSITO ─────────────────────────
// `ADULT_ROUTE_MIN_AGE_YEARS` viene de `maintenanceEstimate`, que es quien
// LANZA si recibe una edad por debajo. El trabajo de este guard es
// precisamente impedir que el motor vea esa edad, así que derivar el umbral del
// propio motor es el invariante — si se copiara el 19, podrían divergir y el
// guard dejaría pasar una edad que el motor rechaza.
//
// `NUTRITION_V1_MAX_AGE_YEARS` NO se puede derivar de ningún motor, porque
// ninguno lo impone: el EER de una persona de 75 años se calcula sin problema.
// Es una frontera de PRODUCTO y por eso vive AQUÍ, en el módulo que posee el
// alcance. Importarla de un motor sería mentir sobre de dónde viene.
//
// ── QUÉ NO ENTRA AQUÍ ───────────────────────────────────────────────────────
// `nutritionTargets`, `wellnessMode`, `obData`, `targetWeight`, `bodyFat`, el
// store, Supabase, Training observado. Tampoco kcal de ningún tipo.
// ─────────────────────────────────────────────────────────────────────────────
import { ADULT_ROUTE_MIN_AGE_YEARS } from './maintenanceEstimate';
import type { CanonicalGoal } from './energyPrescription';
import type { ValidatedNutritionProfile } from './profileValidation';

/** Por qué quedó fuera del alcance de HSC Nutrition. Todos comparten estado. */
export type NutritionScopeReason =
  | 'age_under_19'
  | 'age_65_or_over'
  | 'pregnancy_or_lactation'
  | 'therapeutic_diet_required';

export const NUTRITION_SCOPE_REASONS: readonly NutritionScopeReason[] =
  ['age_under_19', 'age_65_or_over', 'pregnancy_or_lactation', 'therapeutic_diet_required'];

/**
 * Edad máxima INCLUSIVE de la población que HSC Nutrition V1 prescribe.
 *
 * 64 significa que 64 está DENTRO y 65 fuera, igual que
 * `ADULT_ROUTE_MIN_AGE_YEARS = 19` significa que 19 está dentro y 18.999 fuera.
 * Las dos fronteras se leen como el rango que delimitan: 19–64 inclusive.
 *
 * Decisión de producto, no límite del motor. Ver la cabecera.
 */
export const NUTRITION_V1_MAX_AGE_YEARS = 64;

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
  return checkKnownScopeExclusions(profile) ?? checkTherapeuticDiet(profile);
}

/**
 * Reglas 1–3 (edad y embarazo/lactancia), que NO dependen de la pregunta de
 * dieta terapéutica.
 *
 * A7.1 · se exponen por separado para que un perfil legacy al que solo le falta
 * `requiresTherapeuticDiet` reciba su motivo YA CONOCIDO en vez de
 * `PROFILE_INCOMPLETE`: si la decisión ya está tomada, no se pide un dato que no
 * la cambia. El tipo de entrada excluye `requiresTherapeuticDiet`, así que estas
 * reglas no pueden leerlo.
 */
export function checkKnownScopeExclusions(
  profile: Pick<ValidatedNutritionProfile, 'ageYears' | 'pregnantOrLactating' | 'goal'>,
): OutsideHscNutritionScopeResult | null {
  // 1 · EDAD POR DEBAJO. Primero, para que el motivo sea determinista si también
  //     está embarazada o en lactancia.
  if (profile.ageYears < ADULT_ROUTE_MIN_AGE_YEARS) {
    return {
      status: 'OUTSIDE_HSC_NUTRITION_SCOPE',
      scopeReason: 'age_under_19',
      goal: profile.goal,
    };
  }

  // 2 · EDAD POR ENCIMA. Junto a la anterior y antes del embarazo: las dos
  //     fronteras de edad delimitan el rango 19–64 y deben leerse juntas.
  if (profile.ageYears > NUTRITION_V1_MAX_AGE_YEARS) {
    return {
      status: 'OUTSIDE_HSC_NUTRITION_SCOPE',
      scopeReason: 'age_65_or_over',
      goal: profile.goal,
    };
  }

  // 3 · EMBARAZO / LACTANCIA.
  if (profile.pregnantOrLactating) {
    return {
      status: 'OUTSIDE_HSC_NUTRITION_SCOPE',
      scopeReason: 'pregnancy_or_lactation',
      goal: profile.goal,
    };
  }

  return null;
}

/** Regla 4 · solo se evalúa si ninguna de las tres anteriores sacó de alcance. */
function checkTherapeuticDiet(
  profile: Pick<ValidatedNutritionProfile, 'requiresTherapeuticDiet' | 'goal'>,
): OutsideHscNutritionScopeResult | null {
  // 4 · DIETA TERAPÉUTICA INDICADA POR UN PROFESIONAL (A7). Antes de toda
  //     estimación: no se calcula ninguna prescripción clínica parcial.
  if (profile.requiresTherapeuticDiet) {
    return {
      status: 'OUTSIDE_HSC_NUTRITION_SCOPE',
      scopeReason: 'therapeutic_diet_required',
      goal: profile.goal,
    };
  }

  return null;
}
