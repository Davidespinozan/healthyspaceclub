// ════════════════════════════════════════════════════════════════════
// AUTO-GENERADO por scripts/build-nutrition-engine.mjs — NO EDITAR A MANO.
// Fuente única: src/utils/nutritionEngineEntry.ts (y su grafo de imports en src/utils).
// Regenerar: npm run build:nutrition-engine. Un test bloquea cualquier drift.
// ════════════════════════════════════════════════════════════════════
import type { CanonicalGoal } from './energyPrescription.d.ts';
import { type TrainingBand } from './activityClassifier.d.ts';
import type { NutritionEnergyState } from './nutritionEnergyState.d.ts';
import { type PersistedObData } from './nutritionProfileInput.d.ts';
/**
 * Versión de la autoridad.
 *   v1 · CAPA 2 (clase de actividad inferida de los minutos · retirada)
 *   v2 · A2 · clase de actividad desde la modalidad DECLARADA
 *   v3 · A4 · prioridad de carbohidrato desde la matriz cerrada (antes STANDARD
 *        para todos); resistencia/mixto/equipo en T4 → SPORTS_SCOPE
 *   v4 · A7 · retirado el tope renal heredado (1,0 g/kg + REVIEW): ningún
 *        diagnóstico cambia los gramos
 * Una prescripción persistida con otra versión no se adopta (`store.merge`).
 */
export declare const MACRO_PRESCRIPTION_VERSION = 4;
/**
 * Clase de actividad que determina el factor de proteína.
 *
 * Fuerza, resistencia general, mixto y equipo/intermitente comparten factor en
 * V1, pero se conservan como valores distintos porque son conceptos distintos y
 * la prioridad de carbohidrato (metadato) sí puede diferenciarlos.
 */
export type ProteinActivityClass = 'NO_STRUCTURED_TRAINING' | 'LOW_DEMAND' | 'STRENGTH' | 'ENDURANCE_GENERAL' | 'MIXED' | 'TEAM_INTERMITTENT' | 'SPECIALIZED_SPORT';
export declare const PROTEIN_ACTIVITY_CLASSES: readonly ProteinActivityClass[];
/**
 * Prioridad de carbohidrato · METADATO contextual (A4).
 *
 * `STANDARD` / `ELEVATED` / `HIGH` NO cambian la energía, la proteína, la grasa
 * ni los gramos de carbohidrato, no crean pisos y no disparan REVIEW: los
 * umbrales de REVIEW por baja disponibilidad de carbohidrato siguen ABIERTOS.
 *
 * `SPORTS_SCOPE` es la única que tiene efecto: el contexto queda fuera del
 * manejo deportivo automático de HSC V1, y la prescripción sale con el
 * `MacroStatus` que ya existe para eso (`SPORTS_SCOPE`), no con un número.
 */
export type CarbohydratePriority = 'STANDARD' | 'ELEVATED' | 'HIGH' | 'SPORTS_SCOPE';
/** Estado autoritativo de la prescripción de macros. Un solo enum, sin solapes. */
export type MacroStatus = 'VALID' | 'REVIEW' | 'INFEASIBLE' | 'SPORTS_SCOPE';
/** Fracción de la energía prescrita destinada a grasa (objetivo operativo). */
export declare const FAT_ENERGY_FRACTION = 0.25;
/** Umbral de IMC a partir del cual el PRW deja de ser el peso actual. */
export declare const PRW_BMI_THRESHOLD = 30;
/** Fracción del exceso sobre el peso a IMC 30 que se suma al PRW. */
export declare const PRW_EXCESS_FRACTION = 0.25;
export interface MacroInput {
    /** Energía prescrita por la Energy Authority. Ya redondeada; no se toca. */
    energyKcal: number;
    goal: CanonicalGoal;
    weightKg: number;
    heightCm: number;
    activityClass: ProteinActivityClass;
    /**
     * Banda de CARGA semanal (ActivityClassifier, CAPA 1). Solo alimenta la
     * prioridad de carbohidrato; nunca la clase de actividad ni los gramos.
     */
    trainingBand: TrainingBand;
}
interface MacroBase {
    version: number;
    energyKcal: number;
    goal: CanonicalGoal;
    activityClass: ProteinActivityClass;
    carbohydratePriority: CarbohydratePriority;
    /** Peso de referencia proteica (kg). Política operativa HSC; NO es masa magra. */
    prwKg: number;
}
export type MacroPrescription = (MacroBase & {
    status: 'VALID' | 'REVIEW';
    proteinFactor: number;
    proteinG: number;
    fatG: number;
    carbG: number;
    /** Referencia informativa (§3.4). No es objetivo del solver. */
    fiberG: number;
    /** Vacío en VALID. Motivos legibles en REVIEW. */
    reviewReasons: readonly string[];
    reason?: undefined;
}) | (MacroBase & {
    status: 'INFEASIBLE';
    reason: 'CARB_RESIDUAL_NON_POSITIVE';
    proteinFactor: number;
    proteinG: number;
    fatG: number;
    /** kcal que quedan para carbohidrato (≤ 0). Se reporta, no se fuerza. */
    carbKcal: number;
    carbG?: undefined;
    fiberG?: undefined;
    reviewReasons?: undefined;
}) | (MacroBase & {
    status: 'SPORTS_SCOPE';
    /**
     * `SPECIALIZED_SPORT` · la clase declarada es deporte especializado.
     * `CARB_PRIORITY_SPORTS_SCOPE` · la matriz de prioridad (A4) coloca el
     * contexto fuera de alcance (resistencia/mixto/equipo en T4).
     */
    reason: 'SPECIALIZED_SPORT' | 'CARB_PRIORITY_SPORTS_SCOPE';
    proteinFactor?: undefined;
    proteinG?: undefined;
    fatG?: undefined;
    carbG?: undefined;
    fiberG?: undefined;
    reviewReasons?: undefined;
});
/** Entrada sin sentido físico. FAIL-CLOSED, misma convención que los motores de CAPA 1. */
export declare class InvalidMacroInputError extends Error {
    readonly field: string;
    readonly received: unknown;
    constructor(field: string, received: unknown, reason: string);
}
/**
 * Peso de referencia proteica (PRW).
 *
 *   IMC < 30  → PRW = peso actual
 *   IMC ≥ 30  → PRW = peso a IMC 30 + 0,25 × (peso actual − peso a IMC 30)
 *
 * Política operativa HSC para no anclar la proteína al peso total en obesidad.
 * No se presenta ni se interpreta como masa libre de grasa.
 */
export declare function proteinReferenceWeightKg(weightKg: number, heightCm: number): number;
/**
 * Prioridad de carbohidrato · ÚNICA derivación (A4).
 *
 * Entradas autoritativas: la clase de actividad DECLARADA (A2) y la banda de
 * carga T0–T4. Sin defaults: una entrada desconocida lanza (fail-closed).
 */
export declare function deriveCarbohydratePriority(activityClass: ProteinActivityClass, trainingBand: TrainingBand): CarbohydratePriority;
/** Factor de proteína (g/kg PRW). `null` = deporte especializado (fuera del alcance automático). */
export declare function proteinFactor(goal: CanonicalGoal, activityClass: ProteinActivityClass): number | null;
/**
 * Prescripción de macros diarios.
 *
 * ── REDONDEO ────────────────────────────────────────────────────────────────
 * La energía llega redondeada y no se toca. El ESTADO se decide sobre valores
 * internos sin redondear. La salida se redondea UNA vez: proteína y grasa a
 * gramos enteros, y el carbohidrato se deriva del residuo de esos gramos ya
 * redondeados, de modo que `4P + 9G + 4C` reproduce la energía con un error
 * máximo de ±2 kcal (el redondeo de un solo valor).
 *
 * ── REVIEW ──────────────────────────────────────────────────────────────────
 * La arquitectura existe, pero hoy NO hay ningún disparador cerrado. Ningún
 * diagnóstico ajusta las macros (A7: quien necesita una dieta terapéutica queda
 * fuera de alcance en el Scope Guard, antes de llegar aquí), y la prioridad de
 * carbohidrato (`ELEVATED`/`HIGH`) tampoco dispara REVIEW: sus umbrales siguen
 * ABIERTOS.
 */
export declare function prescribeMacros(input: MacroInput): MacroPrescription;
/**
 * A9 · por qué una prescripción RESUELTA no tiene gramos, para elegir el texto.
 *
 *   SPORTS_SPECIALIZED   · `SPORTS_SCOPE` por deporte especializado declarado
 *   SPORTS_HIGH_DEMAND   · `SPORTS_SCOPE` por la matriz de prioridad (alta carga)
 *   DEFENSIVE_UNAVAILABLE · `INFEASIBLE`: invariante defensivo, inalcanzable en el
 *                          dominio válido actual (auditoría A8.2). Mensaje genérico,
 *                          sin exponer la aritmética.
 *   null                 · servible (VALID/REVIEW) o sin prescripción
 *
 * `SPORTS_SCOPE` no es un error ni un dato corrupto: es el límite del alcance
 * deportivo estándar de HSC.
 */
export type NonServableMacroNotice = 'SPORTS_SPECIALIZED' | 'SPORTS_HIGH_DEMAND' | 'DEFENSIVE_UNAVAILABLE';
export declare function nonServableMacroNotice(m: MacroPrescription | null | undefined): NonServableMacroNotice | null;
/** ¿Se puede generar un plan con esta prescripción? Solo VALID y REVIEW tienen gramos. */
export declare function isServableMacroPrescription(m: MacroPrescription | null | undefined): m is Extract<MacroPrescription, {
    status: 'VALID' | 'REVIEW';
}>;
/** Input que falta para poder prescribir macros. Completitud, no fisiología. */
export type MacroMissingInput = 'TRAINING_MODALITY_REQUIRED';
/**
 * Resolución de macros para un estado energético.
 *
 *   NO_ENERGY       · no hay energía prescrita: sin energía no existen macros
 *   INPUT_REQUIRED  · hay energía, pero falta una declaración del socio
 *   RESOLVED        · prescripción (cualquiera de los cuatro `MacroStatus`)
 */
export type MacroResolution = {
    kind: 'NO_ENERGY';
    missing?: undefined;
    prescription?: undefined;
} | {
    kind: 'INPUT_REQUIRED';
    missing: MacroMissingInput;
    prescription?: undefined;
} | {
    kind: 'RESOLVED';
    prescription: MacroPrescription;
    missing?: undefined;
};
export declare function resolveMacroPrescription(state: NutritionEnergyState | null | undefined, obData: PersistedObData | null | undefined, 
/**
 * ADAPTIVE BLOQUE 8 · energía EFECTIVA que manda (energía calibrada adoptada por la autoridad
 * adaptativa). Solo sustituye la ENTRADA energética: fórmulas, versión y estados de CAPA 2 no
 * cambian. Sin ella (o no válida) se usa `state.prescribedEnergy`, exactamente como antes.
 */
effectiveEnergyKcal?: number | null): MacroResolution;
export {};
