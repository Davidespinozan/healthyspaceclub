// ════════════════════════════════════════════════════════════════════
// AUTO-GENERADO por scripts/build-nutrition-engine.mjs — NO EDITAR A MANO.
// Fuente única: src/utils/nutritionEngineEntry.ts (y su grafo de imports en src/utils).
// Regenerar: npm run build:nutrition-engine. Un test bloquea cualquier drift.
// ════════════════════════════════════════════════════════════════════
import type { ProfileInput } from './profileValidation.d.ts';
import type { ActivityProfile } from './activityClassifier.d.ts';
export declare const NUTRITION_PROFILE_INPUT_VERSION = 1;
/**
 * Una clave que este módulo canonicaliza llegó con un valor que su representación
 * persistida no admite. Determinista y con la clave de `obData` identificada —no el
 * nombre de dominio—, porque lo que hay que arreglar es el dato guardado.
 */
export declare class InvalidPersistedProfileError extends Error {
    readonly key: string;
    readonly received: unknown;
    constructor(key: string, received: unknown);
}
/** Claves persistidas como `0`/`1` cuya conversión a booleano posee este módulo. */
export declare const PERSISTED_BOOLEAN_KEYS: readonly string[];
/** Datos persistidos del perfil, tal como los guarda `obData`. */
export type PersistedObData = Record<string, string | number | undefined>;
/**
 * Nombres de los campos que pueden faltar. Son los nombres de PRODUCTO (lo que la
 * UI tiene que pedir), no los de `obData` ni los del contrato del motor: quien
 * consume esto necesita saber qué pregunta hacer.
 */
export type MissingProfileField = 'sex' | 'goal' | 'ageYears' | 'heightCm' | 'weightKg' | 'pregnantOrLactating' | 'requiresTherapeuticDiet' | 'dailyLife' | 'trainsHabitually' | 'trainingDaysPerWeek' | 'trainingSessionMinutes';
export declare const MISSING_PROFILE_FIELDS: readonly MissingProfileField[];
/**
 * Resultado de la lectura.
 *
 * Solo `complete: true` acarrea un `ProfileInput`. Solo `complete: false` acarrea
 * `missing`, siempre no vacío y en el orden de `MISSING_PROFILE_FIELDS` — orden
 * estable para que la UI pueda pedir el primero que falte de forma determinista.
 */
export type NutritionProfileInputResult = {
    complete: true;
    profile: ProfileInput;
    missing?: undefined;
} | {
    complete: false;
    missing: readonly MissingProfileField[];
    profile?: undefined;
};
/**
 * NUTRITION PROFILE INPUT V1 · traduce el perfil persistido al boundary de la
 * cadena energética, o dice exactamente qué falta.
 *
 * Nunca inventa. Nunca deriva un campo de otro. Lanza
 * `InvalidPersistedProfileError` solo cuando una clave que ESTE módulo canonicaliza
 * trae un valor que su representación no admite.
 *
 * INVARIANTE: si devuelve `complete: true`, los campos cuya canonicalización le
 * pertenece tienen tipo runtime compatible con `ProfileInput` —
 * `typeof pregnantOrLactating === 'boolean'` y
 * `typeof activityProfile.habitualTraining.trainsHabitually === 'boolean'`—
 * SIEMPRE.
 */
export declare function nutritionProfileInputFrom(obData: PersistedObData | null | undefined): NutritionProfileInputResult;
/**
 * Perfil con datos de ALCANCE completos, pero con la respuesta de dieta
 * terapéutica y/o la actividad todavía pendientes (`null`).
 */
export type ProfileInputPendingScope = Omit<ProfileInput, 'requiresTherapeuticDiet' | 'activityProfile'> & {
    requiresTherapeuticDiet: boolean | null;
    activityProfile: ActivityProfile | null;
};
/**
 * A7.1 / A10.1 · el perfil cuando lo que falta es SOLO la respuesta de dieta
 * terapéutica y/o los datos de actividad.
 *
 * Existe para que una exclusión de alcance ya demostrable (edad, embarazo, o un
 * «Sí» a la dieta terapéutica) se pueda resolver sin pedir antes datos que no la
 * cambiarían. Lo pendiente viaja como `null`: nunca se rellena.
 *
 * `null` si falta cualquier dato de alcance (sexo, objetivo, edad, estatura,
 * peso, embarazo) o si el perfil ya está completo.
 */
export declare function pendingScopeProfileFrom(obData: PersistedObData | null | undefined): ProfileInputPendingScope | null;
