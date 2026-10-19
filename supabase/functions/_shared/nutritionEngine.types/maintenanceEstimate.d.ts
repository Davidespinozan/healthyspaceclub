// ════════════════════════════════════════════════════════════════════
// AUTO-GENERADO por scripts/build-nutrition-engine.mjs — NO EDITAR A MANO.
// Fuente única: src/utils/nutritionEngineEntry.ts (y su grafo de imports en src/utils).
// Regenerar: npm run build:nutrition-engine. Un test bloquea cualquier drift.
// ════════════════════════════════════════════════════════════════════
import { type ActivityCategory, type ActivityClassification } from './activityClassifier.d.ts';
/**
 * Sexo biológico, que es lo que las ecuaciones del DRI separan. Dos rutas,
 * porque la Tabla 5-5 publica dos juegos de coeficientes y ninguno más.
 */
export type BiologicalSex = 'male' | 'female';
export declare const BIOLOGICAL_SEXES: readonly BiologicalSex[];
/** Edad a la que empieza la ruta adulta del DRI. No existe tope superior. */
export declare const ADULT_ROUTE_MIN_AGE_YEARS = 19;
/**
 * Versión de ESTE módulo. Propia, igual que la del clasificador y por la misma
 * razón: son autoridades con ciclos de vida distintos. No se usa
 * `PLAN_ENGINE_VERSION`, que versiona el motor de platillos.
 */
export declare const MAINTENANCE_ESTIMATE_VERSION = 1;
/** Coeficientes de una ecuación TEE. `height` en cm, `weight` en kg, `age` en años. */
export interface EerCoefficients {
    readonly intercept: number;
    readonly age: number;
    readonly heightCm: number;
    readonly weightKg: number;
}
/**
 * DRI-ESTABLISHED · NASEM 2023, cap. 5, Tabla 5-5.
 *
 *   Hombres ≥19 a
 *     inactive    TEE =   753.07 − (10.83 × age) + ( 6.50 × height) + (14.10 × weight)
 *     low active  TEE =   581.47 − (10.83 × age) + ( 8.30 × height) + (14.94 × weight)
 *     active      TEE = 1,004.82 − (10.83 × age) + ( 6.52 × height) + (15.91 × weight)
 *     very active TEE = − 517.88 − (10.83 × age) + (15.61 × height) + (19.11 × weight)
 *
 *   Mujeres ≥19 a
 *     inactive    TEE =   584.90 − ( 7.01 × age) + ( 5.72 × height) + (11.71 × weight)
 *     low active  TEE =   575.77 − ( 7.01 × age) + ( 6.60 × height) + (12.14 × weight)
 *     active      TEE =   710.25 − ( 7.01 × age) + ( 6.54 × height) + (12.34 × weight)
 *     very active TEE =   511.83 − ( 7.01 × age) + ( 9.07 × height) + (12.56 × weight)
 */
export declare const EER_COEFFICIENTS: Readonly<Record<BiologicalSex, Readonly<Record<ActivityCategory, EerCoefficients>>>>;
/** Antropometría mínima que exigen las ecuaciones. La unidad va en el nombre. */
export interface MaintenanceAnthropometry {
    sex: BiologicalSex;
    ageYears: number;
    /** CENTÍMETROS. La ecuación del DRI no acepta metros. */
    heightCm: number;
    /** KILOGRAMOS. La ecuación del DRI no acepta libras. */
    weightKg: number;
}
interface MaintenanceEstimateBase {
    /**
     * La ÚNICA cifra que el Goal Energy Engine consume. Sin redondear: el
     * redondeo a 1 kcal ocurre una sola vez, dentro de EnergyPrescription.
     */
    initialMaintenance: number;
    /** Para que nadie confunda esto con un `bmr × factor`. */
    source: 'DRI_2023_EER_ADULT';
    engineVersion: number;
    /**
     * Versión del clasificador que produjo la clasificación consumida. Es el
     * único dato del contrato de entrada que se copia, y se copia porque sin él
     * no se puede reconstruir qué política de actividad generó esta estimación.
     * El resto de la metadata del clasificador (`matrixCell`,
     * `weeklyTrainingMinutes`) NO se duplica: vive en la `ActivityClassification`,
     * que la orquestación persistirá al lado.
     */
    classifierEngineVersion: number;
}
/**
 * Resultado, como unión discriminada por el mismo motivo que en el
 * clasificador: la forma CLEAR/BORDERLINE es un invariante del contrato y se
 * expresa en el tipo en lugar de confiarse a una comprobación en ejecución.
 *
 * En BORDERLINE no hay campo «midpoint» aparte: `initialMaintenance` ES el
 * midpoint `(lowerEER + upperEER) / 2`. Duplicarlo sería guardar dos veces el
 * mismo número y abrir la puerta a que divergieran.
 */
export type MaintenanceEstimate = (MaintenanceEstimateBase & {
    classificationConfidence: 'CLEAR';
    category: ActivityCategory;
    /** EER de `category`. Igual a `initialMaintenance` en CLEAR. */
    eer: number;
    lowerCategory?: undefined;
    upperCategory?: undefined;
    lowerEER?: undefined;
    upperEER?: undefined;
}) | (MaintenanceEstimateBase & {
    classificationConfidence: 'BORDERLINE';
    category?: undefined;
    eer?: undefined;
    /** Categoría de PAL MENOR. Ordenada por categoría, no por kcal. */
    lowerCategory: ActivityCategory;
    /** Categoría de PAL MAYOR. Adyacente a `lowerCategory`. */
    upperCategory: ActivityCategory;
    /** EER de `lowerCategory`. Puede exceder `upperEER` (ver cabecera). */
    lowerEER: number;
    /** EER de `upperCategory`. */
    upperEER: number;
});
/**
 * Entrada estructuralmente inválida. FAIL-CLOSED, misma convención que
 * `InvalidActivityProfileError` (CAPA 1 · 01), `NoEligibleDishesError` (P0-03)
 * y `InvalidPlanError` (P0-04): se lanza en vez de rellenar con defaults,
 * porque un default aquí produciría una cifra de kcal a partir de un dato que
 * nadie declaró.
 */
export declare class InvalidMaintenanceInputError extends Error {
    readonly field: string;
    readonly received: unknown;
    constructor(field: string, received: unknown, reason: string);
}
/**
 * Mapeo EXPLÍCITO del contrato de sexo que el repo almacena hoy
 * (`obData.sex ∈ {'Hombre','Mujer'}`, escrito por el onboarding) al contrato de
 * este módulo. Acepta además los valores canónicos `'male'`/`'female'`.
 *
 * NO existe fallback. El código legacy resolvía `String(ob.sex || 'Hombre')`, es
 * decir, cualquier valor vacío o desconocido caía SILENCIOSAMENTE en la ecuación
 * masculina. Aquí eso se rechaza: un sexo que no mapea a una de las dos rutas
 * publicadas no tiene ecuación, y adivinarla produciría kcal inventadas.
 */
export declare function biologicalSexFrom(value: unknown): BiologicalSex;
/**
 * EER de una categoría concreta. Aplica la ecuación de la Tabla 5-5 tal cual,
 * sin redondear.
 */
export declare function eerForCategory(anthropometry: MaintenanceAnthropometry, category: ActivityCategory): number;
/**
 * MAINTENANCE ESTIMATE V1.
 *
 * Única entrada pública. Determinista y fail-closed.
 *
 *   CLEAR      → initialMaintenance = EER(category)
 *   BORDERLINE → initialMaintenance = (EER(lower) + EER(upper)) / 2
 *
 * El midpoint es HSC PRODUCT POLICY V1, no una afirmación de que el TDEE
 * fisiológico verdadero esté exactamente en el punto medio. No se interpola
 * PAL, no se fabrica un PAL decimal, no se calcula ningún score adicional y no
 * se elige silenciosamente `lower` ni `upper`.
 */
export declare function estimateMaintenance(anthropometry: MaintenanceAnthropometry, classification: ActivityClassification): MaintenanceEstimate;
export {};
