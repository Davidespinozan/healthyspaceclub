// ════════════════════════════════════════════════════════════════════
// AUTO-GENERADO por scripts/build-nutrition-engine.mjs — NO EDITAR A MANO.
// Fuente única: src/utils/nutritionEngineEntry.ts (y su grafo de imports en src/utils).
// Regenerar: npm run build:nutrition-engine. Un test bloquea cualquier drift.
// ════════════════════════════════════════════════════════════════════
import { type BiologicalSex } from './maintenanceEstimate.d.ts';
import { type CanonicalGoal } from './energyPrescription.d.ts';
import type { ActivityProfile } from './activityClassifier.d.ts';
/**
 * Perfil CRUDO, tal como lo almacena el producto. `sex` y `goal` llegan como
 * cadenas sin normalizar; el resto como los tipos que la captura produce.
 */
export interface ProfileInput {
    /** `'Hombre'`/`'Mujer'` del repo, o `'male'`/`'female'`. */
    sex: string;
    /** Uno de los objetivos que el producto escribe, o un `CanonicalGoal`. */
    goal: string;
    ageYears: number;
    /** CENTÍMETROS. */
    heightCm: number;
    /** KILOGRAMOS. */
    weightKg: number;
    /** Un solo booleano: el onboarding pregunta «¿embarazada o en lactancia?». */
    pregnantOrLactating: boolean;
    /**
     * A7 · «¿Un profesional te indicó modificar tu alimentación o seguir una dieta
     * específica por una condición médica?». Solo decide el ALCANCE.
     */
    requiresTherapeuticDiet: boolean;
    activityProfile: ActivityProfile;
}
declare const VALIDATED_PROFILE: unique symbol;
/**
 * Perfil validado y normalizado. Lleva una MARCA de tipo que solo este módulo
 * puede poner, así que no se puede fabricar uno con un cast simple: cualquier
 * consumidor que quiera saltarse la validación tiene que escribir un
 * `as unknown as`, que es visible en revisión.
 */
export interface ValidatedNutritionProfile {
    readonly [VALIDATED_PROFILE]: true;
    /** Ya mapeado por `biologicalSexFrom`. */
    sex: BiologicalSex;
    /** Ya mapeado por `canonicalGoalFrom`. */
    goal: CanonicalGoal;
    /** Finito. PUEDE ser < 19: eso lo decide el Scope Guard, no este módulo. */
    ageYears: number;
    heightCm: number;
    weightKg: number;
    pregnantOrLactating: boolean;
    requiresTherapeuticDiet: boolean;
    /** Sin tocar: `ActivityClassifier` conserva toda la autoridad sobre su forma. */
    activityProfile: ActivityProfile;
}
/**
 * Dato obligatorio ausente o no mapeable. FAIL-CLOSED, misma convención que
 * `InvalidActivityProfileError`, `InvalidMaintenanceInputError` e
 * `InvalidPrescriptionInputError`.
 */
export declare class InvalidProfileInputError extends Error {
    readonly field: string;
    readonly received: unknown;
    constructor(field: string, received: unknown, reason: string);
}
/**
 * Valida y normaliza un perfil crudo.
 *
 * Determinista y fail-closed: o devuelve un `ValidatedNutritionProfile`
 * completo, o lanza `InvalidProfileInputError`. Sin defaults silenciosos — a
 * diferencia del `parseObData` legacy, que rellenaba sexo, edad, talla, peso y
 * actividad con valores inventados cuando faltaban.
 */
export declare function validateNutritionProfile(input: ProfileInput): ValidatedNutritionProfile;
/** Perfil validado SIN la respuesta de dieta terapéutica (A7.1). Sin marca de tipo. */
export type ValidatedProfileCore = Omit<ValidatedNutritionProfile, typeof VALIDATED_PROFILE | 'requiresTherapeuticDiet'>;
/**
 * A7.1 · valida todo MENOS `requiresTherapeuticDiet`. Solo sirve para evaluar las
 * exclusiones de alcance ya conocidas (edad, embarazo) cuando esa respuesta aún
 * no existe. No produce un `ValidatedNutritionProfile`: no puede entrar en la
 * cadena energética.
 */
export declare function validateProfileCore(input: Omit<ProfileInput, 'requiresTherapeuticDiet'>): ValidatedProfileCore;
/** Los datos que el Scope Guard necesita para las reglas 1–3 (A10.1). */
export type ValidatedScopeFacts = Omit<ValidatedProfileCore, 'activityProfile'>;
/**
 * A10.1 · valida SOLO sexo, objetivo, edad, estatura, peso y embarazo. Sirve para
 * evaluar exclusiones de alcance ya demostrables cuando todavía faltan datos de
 * actividad o la respuesta de dieta terapéutica. No entra en la cadena energética.
 */
export declare function validateScopeFacts(input: Omit<ProfileInput, 'requiresTherapeuticDiet' | 'activityProfile'>): ValidatedScopeFacts;
export {};
