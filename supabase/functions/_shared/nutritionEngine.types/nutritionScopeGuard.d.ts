// ════════════════════════════════════════════════════════════════════
// AUTO-GENERADO por scripts/build-nutrition-engine.mjs — NO EDITAR A MANO.
// Fuente única: src/utils/nutritionEngineEntry.ts (y su grafo de imports en src/utils).
// Regenerar: npm run build:nutrition-engine. Un test bloquea cualquier drift.
// ════════════════════════════════════════════════════════════════════
import type { CanonicalGoal } from './energyPrescription.d.ts';
import type { ValidatedNutritionProfile } from './profileValidation.d.ts';
/** Por qué quedó fuera del alcance de HSC Nutrition. Todos comparten estado. */
export type NutritionScopeReason = 'age_under_19' | 'age_65_or_over' | 'pregnancy_or_lactation' | 'therapeutic_diet_required';
export declare const NUTRITION_SCOPE_REASONS: readonly NutritionScopeReason[];
/**
 * Edad máxima INCLUSIVE de la población que HSC Nutrition V1 prescribe.
 *
 * 64 significa que 64 está DENTRO y 65 fuera, igual que
 * `ADULT_ROUTE_MIN_AGE_YEARS = 19` significa que 19 está dentro y 18.999 fuera.
 * Las dos fronteras se leen como el rango que delimitan: 19–64 inclusive.
 *
 * Decisión de producto, no límite del motor. Ver la cabecera.
 */
export declare const NUTRITION_V1_MAX_AGE_YEARS = 64;
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
export declare function checkNutritionScope(profile: ValidatedNutritionProfile): OutsideHscNutritionScopeResult | null;
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
export declare function checkKnownScopeExclusions(profile: Pick<ValidatedNutritionProfile, 'ageYears' | 'pregnantOrLactating' | 'goal'>): OutsideHscNutritionScopeResult | null;
/**
 * A10.1 · exclusión DEMOSTRABLE con datos pendientes.
 *
 * Mismas reglas y mismo orden que `checkNutritionScope`, sin leer nada que falte:
 * las reglas 1–3 siempre (sus datos están), y la 4 solo si la respuesta de dieta
 * terapéutica ya es «Sí». Si devuelve `null`, los datos que faltan SÍ pueden
 * cambiar el resultado y hay que pedirlos. El Scope Guard no lee la actividad, así
 * que los datos de actividad pendientes nunca cambian una exclusión.
 */
export declare function checkScopeWithPendingInputs(profile: Pick<ValidatedNutritionProfile, 'ageYears' | 'pregnantOrLactating' | 'goal'> & {
    requiresTherapeuticDiet: boolean | null;
}): OutsideHscNutritionScopeResult | null;
