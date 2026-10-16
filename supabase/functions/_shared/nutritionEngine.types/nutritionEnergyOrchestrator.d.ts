// ════════════════════════════════════════════════════════════════════
// AUTO-GENERADO por scripts/build-nutrition-engine.mjs — NO EDITAR A MANO.
// Fuente única: src/utils/nutritionEngineEntry.ts (y su grafo de imports en src/utils).
// Regenerar: npm run build:nutrition-engine. Un test bloquea cualquier drift.
// ════════════════════════════════════════════════════════════════════
import { type ActivityClassification } from './activityClassifier.d.ts';
import { type EnergyPrescription } from './energyPrescription.d.ts';
import { type ProfileInput } from './profileValidation.d.ts';
import { type OutsideHscNutritionScopeResult } from './nutritionScopeGuard.d.ts';
/**
 * Versión del ENSAMBLAJE. Propia, y necesaria: el orquestador posee el ORDEN de
 * los guards y las reglas de alcance, que pueden cambiar sin que cambie ninguna
 * de las tres versiones de motor. Además es la única trazabilidad disponible en
 * `OUTSIDE_HSC_NUTRITION_SCOPE`, donde no se ejecutó ningún motor.
 */
export declare const ORCHESTRATOR_VERSION = 1;
/**
 * Resultado de la cadena: unión discriminada de EXACTAMENTE cuatro estados.
 *
 * `INVALID PROFILE INPUT` no está aquí: Profile Validation LANZA antes de
 * producir cualquier resultado nutricional.
 *
 * Los tres primeros son los objetos de `EnergyPrescription` TAL CUAL —sin
 * traducir, renombrar ni reconstruir— más la clasificación y la versión del
 * ensamblaje. Solo `PRESCRIBED` contiene `prescribedEnergy`.
 */
export type NutritionEnergyResult = (EnergyPrescription & {
    orchestratorVersion: number;
    /** La clasificación completa. `EnergyPrescription` no la acarrea. */
    classification: ActivityClassification;
    scopeReason?: undefined;
}) | (OutsideHscNutritionScopeResult & {
    orchestratorVersion: number;
    engineVersion?: undefined;
    classification?: undefined;
    maintenance?: undefined;
    bmi?: undefined;
    prescribedEnergy?: undefined;
    rawPrescribedEnergy?: undefined;
    appliedDeficit?: undefined;
    appliedSurplus?: undefined;
    deficitBound?: undefined;
});
/**
 * NUTRITION ENERGY ORCHESTRATOR V1 · única entrada pública de la cadena.
 *
 * Determinista. O devuelve un `NutritionEnergyResult` con uno de los cuatro
 * estados, o lanza: `InvalidProfileInputError` (boundary de perfil),
 * `InvalidActivityProfileError` (clasificador), `InvalidMaintenanceInputError`
 * (estimador) o `InvalidPrescriptionInputError` (prescripción). Los errores de
 * los motores NO se capturan ni se reinterpretan: cada uno identifica su propio
 * campo, y envolverlos solo perdería esa información.
 */
export declare function resolveNutritionEnergy(rawProfile: ProfileInput): NutritionEnergyResult;
/**
 * A7.1 / A10.1 · exclusión de alcance YA DEMOSTRABLE con datos pendientes.
 *
 * Para un perfil al que solo le faltan la respuesta de dieta terapéutica y/o los
 * datos de actividad: valida lo que hay y aplica el Scope Guard sin leer lo que
 * falta (reglas 1–3; la 4 solo con un «Sí» ya dado). Si saca de alcance, devuelve
 * EXACTAMENTE el mismo resultado que `resolveNutritionEnergy` daría con todos los
 * datos, porque el guard va antes de cualquier motor y no lee la actividad. Si no,
 * `null`: lo que falta sí importa. Nunca clasifica, estima ni prescribe.
 */
export declare function resolveKnownNutritionScope(rawProfile: Omit<ProfileInput, 'requiresTherapeuticDiet' | 'activityProfile'> & {
    requiresTherapeuticDiet: boolean | null;
}): NutritionEnergyResult | null;
