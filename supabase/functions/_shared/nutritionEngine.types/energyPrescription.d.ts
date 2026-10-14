// ════════════════════════════════════════════════════════════════════
// AUTO-GENERADO por scripts/build-nutrition-engine.mjs — NO EDITAR A MANO.
// Fuente única: src/utils/nutritionEngineEntry.ts (y su grafo de imports en src/utils).
// Regenerar: npm run build:nutrition-engine. Un test bloquea cualquier drift.
// ════════════════════════════════════════════════════════════════════
import type { MaintenanceEstimate } from './maintenanceEstimate.d.ts';
/** Los cuatro objetivos canónicos. No existe un goal «bienestar» energético. */
export type CanonicalGoal = 'FAT_LOSS' | 'RECOMPOSITION' | 'MUSCLE_GAIN' | 'MAINTENANCE';
export declare const CANONICAL_GOALS: readonly CanonicalGoal[];
/**
 * Los tres estados que pueden existir una vez que YA hay una
 * `MaintenanceEstimate`. `OUTSIDE_HSC_NUTRITION_SCOPE` no está aquí a
 * propósito: pertenece al Scope Guard, que corta antes de estimar.
 */
export type PrescriptionStatus = 'PRESCRIBED' | 'FAT_LOSS_BLOCKED' | 'OUTSIDE_HSC_FAT_LOSS_SCOPE';
/** Qué acotó el déficit de FAT_LOSS. `null` cuando el objetivo no aplica déficit. */
export type DeficitBound = 'relative' | 'absolute_cap' | null;
/** Versión propia. Ni `PLAN_ENGINE_VERSION`, ni la del clasificador, ni la del estimador. */
export declare const ENERGY_PRESCRIPTION_VERSION = 1;
/** Déficit relativo candidato de FAT_LOSS. No es un porcentaje óptimo universal. */
export declare const FAT_LOSS_RELATIVE_DEFICIT = 0.15;
/** Techo absoluto del déficit inicial. Guardarraíl de producto, no límite médico. */
export declare const FAT_LOSS_ABSOLUTE_DEFICIT_CAP = 500;
/** Superávit de MUSCLE_GAIN. Política conservadora V1, no un óptimo. */
export declare const MUSCLE_GAIN_RELATIVE_SURPLUS = 0.05;
/** IMC actual por debajo del cual no se prescribe pérdida de grasa. Frontera de alcance. */
export declare const FAT_LOSS_BLOCKED_BELOW_BMI = 18.5;
/** Frontera de ALCANCE DEL PRODUCTO para FAT_LOSS. NO es un mínimo fisiológico. */
export declare const HSC_FAT_LOSS_SCOPE_MIN_ENERGY = 1200;
/**
 * Petición de prescripción, como unión discriminada por el objetivo.
 *
 * La talla y el peso aparecen SOLO en la rama FAT_LOSS, que es la única que los
 * necesita (para el IMC del guard de bloqueo). Así «solo cuando FAT_LOSS los
 * necesita» es un hecho del TIPO: no se puede pedir FAT_LOSS sin ellos, ni
 * colarlos en los otros tres objetivos.
 */
export type PrescriptionRequest = {
    goal: 'FAT_LOSS';
    maintenance: MaintenanceEstimate;
    /** CENTÍMETROS. Solo se usa para derivar el IMC. */
    heightCm: number;
    /** KILOGRAMOS. Solo se usa para derivar el IMC. */
    weightKg: number;
} | {
    goal: 'RECOMPOSITION' | 'MUSCLE_GAIN' | 'MAINTENANCE';
    maintenance: MaintenanceEstimate;
};
interface PrescriptionBase {
    goal: CanonicalGoal;
    /** Pass-through del input: la estimación que produjo esta cifra. */
    maintenance: MaintenanceEstimate;
    engineVersion: number;
}
export type EnergyPrescription = (PrescriptionBase & {
    status: 'PRESCRIBED';
    /** La cifra. Redondeada UNA vez, aquí. */
    prescribedEnergy: number;
    /** Sin redondear: lo que el gate evaluó y de donde salió `prescribedEnergy`. */
    rawPrescribedEnergy: number;
    /** kcal/d restadas al mantenimiento. 0 salvo en FAT_LOSS. */
    appliedDeficit: number;
    /** kcal/d sumadas al mantenimiento. 0 salvo en MUSCLE_GAIN. */
    appliedSurplus: number;
    deficitBound: DeficitBound;
    /** Presente SOLO cuando el objetivo lo exigió, es decir en FAT_LOSS. */
    bmi?: number;
}) | (PrescriptionBase & {
    status: 'FAT_LOSS_BLOCKED';
    goal: 'FAT_LOSS';
    bmi: number;
    prescribedEnergy?: undefined;
    rawPrescribedEnergy?: undefined;
    appliedDeficit?: undefined;
    appliedSurplus?: undefined;
    deficitBound?: undefined;
}) | (PrescriptionBase & {
    status: 'OUTSIDE_HSC_FAT_LOSS_SCOPE';
    goal: 'FAT_LOSS';
    bmi: number;
    /** Se conserva: sin él no se puede explicar por qué quedó fuera. */
    rawPrescribedEnergy: number;
    appliedDeficit: number;
    appliedSurplus: number;
    deficitBound: DeficitBound;
    /** Ausente a propósito: fuera de alcance no se entrega cifra. */
    prescribedEnergy?: undefined;
});
/**
 * Input estructuralmente inválido de ESTE módulo. Fail-closed, misma convención
 * que `InvalidActivityProfileError` e `InvalidMaintenanceInputError`: se lanza
 * en vez de rellenar con defaults, porque un default aquí produciría una cifra
 * de kcal a partir de un dato que nadie declaró.
 */
export declare class InvalidPrescriptionInputError extends Error {
    readonly field: string;
    readonly received: unknown;
    constructor(field: string, received: unknown, reason: string);
}
/**
 * Mapeo EXPLÍCITO de los objetivos que el repo almacena hoy a los cuatro
 * canónicos. Vive aquí porque este módulo es el dueño de la taxonomía de
 * objetivos, igual que `biologicalSexFrom` vive en `maintenanceEstimate`. El
 * input de `prescribeEnergy` es un `CanonicalGoal` ya mapeado: esta función es
 * la que el boundary de perfil usará para obtenerlo.
 *
 *   'Bajar grasa'          → FAT_LOSS
 *   'Recomposición'        → RECOMPOSITION
 *   'Ganar músculo'        → MUSCLE_GAIN
 *   'Subir masa muscular'  → MUSCLE_GAIN   ← alias legacy, ver abajo
 *   'Bienestar integral'   → MAINTENANCE
 *
 * «Bienestar integral» → MAINTENANCE: el legacy le aplicaba `goalFactor = 1.0`,
 * así que la energía resultante es la misma, pero deja de existir como concepto
 * energético propio.
 *
 * ALIAS LEGACY 'Subir masa muscular'. El producto escribe DOS representaciones
 * distintas del mismo objetivo: el onboarding guarda 'Ganar músculo' y la hoja
 * de Ajustes guarda 'Subir masa muscular'. Las dos son datos legítimos que el
 * propio producto generó, y el `goalFactor` legacy reconocía ambas porque su
 * regex incluía `subir` y `masa`. El alias existe para no rechazar a quien
 * cambió su objetivo desde Ajustes.
 *
 * NO es un quinto objetivo: la taxonomía canónica sigue siendo de cuatro. Y la
 * autoridad de este mapeo es ÚNICAMENTE esta función — no debe aparecer una
 * segunda tabla de equivalencias en Profile Validation ni en ningún boundary.
 *
 * Sin regex y sin fallback. El legacy usaba `/bajar|perder|d[eé]ficit/` sobre
 * texto libre y devolvía 1.0 para cualquier cosa no reconocida, es decir, un
 * objetivo mal escrito se convertía en mantenimiento sin avisar.
 */
export declare function canonicalGoalFrom(value: unknown): CanonicalGoal;
/**
 * ENERGY PRESCRIPTION V1 · única API pública de prescripción.
 *
 * Determinista. O devuelve una `EnergyPrescription` con uno de los tres
 * estados, o lanza `InvalidPrescriptionInputError`. Nunca devuelve una cifra
 * «aproximada» ni hace clamp.
 *
 * Orden, y el orden importa:
 *   1 · validación de SUS inputs
 *   2 · FAT_LOSS + IMC < 18.5  → FAT_LOSS_BLOCKED
 *   3 · aritmética de objetivo → rawPrescribedEnergy
 *   4 · gate de 1200 SOBRE EL CRUDO, antes de redondear
 *   5 · redondeo, único punto del sistema
 */
export declare function prescribeEnergy(request: PrescriptionRequest): EnergyPrescription;
export {};
