// ════════════════════════════════════════════════════════════════════
// AUTO-GENERADO por scripts/build-nutrition-engine.mjs — NO EDITAR A MANO.
// Fuente única: src/utils/nutritionEngineEntry.ts (y su grafo de imports en src/utils).
// Regenerar: npm run build:nutrition-engine. Un test bloquea cualquier drift.
// ════════════════════════════════════════════════════════════════════
/** Nivel de vida cotidiana declarado, SIN contar entrenamientos. HSC policy V1. */
export type DailyLifeLevel = 'DL1' | 'DL2' | 'DL3' | 'DL4';
/** Categorías adultas de actividad física. DRI-established (ver cabecera). */
export type ActivityCategory = 'INACTIVE' | 'LOW_ACTIVE' | 'ACTIVE' | 'VERY_ACTIVE';
/** Banda de volumen semanal de entrenamiento habitual. HSC policy V1. */
export type TrainingBand = 'T0' | 'T1' | 'T2' | 'T3' | 'T4';
export type ClassificationConfidence = 'CLEAR' | 'BORDERLINE';
export declare const DAILY_LIFE_LEVELS: readonly DailyLifeLevel[];
export declare const TRAINING_BANDS: readonly TrainingBand[];
/** Orden ASCENDENTE de las categorías. El índice ES la escala ordinal. */
export declare const ACTIVITY_CATEGORIES: readonly ActivityCategory[];
/**
 * Versión del clasificador. PROPIA, no `PLAN_ENGINE_VERSION`: son autoridades
 * distintas con ciclos de vida distintos — cambiar la matriz de actividad no
 * tiene por qué invalidar un plan de comidas, y subir el motor de platillos no
 * tiene por qué reclasificar a nadie. Acoplarlas haría que cada cambio en una
 * disparara trabajo en la otra sin motivo.
 */
export declare const ACTIVITY_CLASSIFIER_VERSION = 1;
export interface HabitualTraining {
    /** Si es `false`, los dos campos siguientes NO son inputs: no se leen ni se validan. */
    trainsHabitually: boolean;
    daysPerWeek: number;
    habitualSessionMinutes: number;
}
export interface ActivityProfile {
    dailyLife: DailyLifeLevel;
    habitualTraining: HabitualTraining;
}
/** Celda de la matriz que produjo el resultado. Trazabilidad: el «por qué». */
export interface MatrixCell {
    dailyLife: DailyLifeLevel;
    trainingBand: TrainingBand;
}
interface ClassificationBase {
    matrixCell: MatrixCell;
    weeklyTrainingMinutes: number;
    engineVersion: number;
}
/**
 * Resultado del clasificador, como UNIÓN DISCRIMINADA. La forma CLEAR/BORDERLINE
 * es un invariante del contrato, así que se expresa en el tipo en lugar de
 * confiar en una comprobación en tiempo de ejecución: un `CLEAR` no puede
 * acarrear `lowerCategory`, y un `BORDERLINE` no puede acarrear `category`,
 * porque el compilador no lo permite.
 */
export type ActivityClassification = (ClassificationBase & {
    classificationConfidence: 'CLEAR';
    category: ActivityCategory;
    lowerCategory?: undefined;
    upperCategory?: undefined;
}) | (ClassificationBase & {
    classificationConfidence: 'BORDERLINE';
    category?: undefined;
    /** Siempre ADYACENTE a `upperCategory` en `ACTIVITY_CATEGORIES`. */
    lowerCategory: ActivityCategory;
    upperCategory: ActivityCategory;
});
/**
 * Entrada estructuralmente inválida. FAIL-CLOSED: el clasificador lanza en vez
 * de rellenar con defaults, porque un default silencioso aquí fabricaría una
 * categoría de actividad —y más adelante una cifra de kcal— a partir de un dato
 * que nadie declaró. Misma convención que `NoEligibleDishesError` (P0-03) y
 * `InvalidPlanError` (P0-04).
 */
export declare class InvalidActivityProfileError extends Error {
    readonly field: string;
    readonly received: unknown;
    constructor(field: string, received: unknown, reason: string);
}
export declare function trainingBandOf(weeklyTrainingMinutes: number): TrainingBand;
export declare function activityOrdinalRank(c: ActivityClassification): number;
/**
 * Minutos semanales de entrenamiento HABITUAL DECLARADO.
 *
 * `trainsHabitually === false` ⇒ 0, sin mirar `daysPerWeek` ni
 * `habitualSessionMinutes`: quien declara que no entrena no entrena, y no se
 * fabrica entrenamiento implícito a partir de números que hayan quedado en el
 * formulario. Por eso esos dos campos tampoco se validan en ese caso: no son
 * inputs de esta función cuando el booleano es `false`.
 */
export declare function deriveWeeklyTrainingMinutes(t: HabitualTraining): number;
/**
 * HSC Activity Classifier V1.
 *
 * Única entrada pública. Determinista y fail-closed: o devuelve una
 * `ActivityClassification` completa y coherente, o lanza
 * `InvalidActivityProfileError`. Nunca devuelve un resultado «aproximado».
 */
export declare function classifyActivity(profile: ActivityProfile): ActivityClassification;
export {};
