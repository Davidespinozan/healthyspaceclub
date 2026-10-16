// ════════════════════════════════════════════════════════════════════
// AUTO-GENERADO por scripts/build-nutrition-engine.mjs — NO EDITAR A MANO.
// Fuente única: src/utils/nutritionEngineEntry.ts (y su grafo de imports en src/utils).
// Regenerar: npm run build:nutrition-engine. Un test bloquea cualquier drift.
// ════════════════════════════════════════════════════════════════════
import type { ProteinActivityClass } from './macroPrescription.d.ts';
/** Clave de `obData` donde vive la declaración. */
export declare const TRAINING_MODALITIES_KEY = "trainingModalities";
/**
 * Modalidades declarables. `mixed` y «no entreno» NO se guardan: «mixto» se
 * deriva de dos o más modalidades estructuradas y «no entreno» es
 * `trainsHabitually = false`.
 */
export type TrainingModality = 'strength' | 'endurance' | 'team_intermittent' | 'low_demand' | 'specialized_sport';
/** Orden canónico: es el de la UI y el del CSV persistido. */
export declare const TRAINING_MODALITIES: readonly TrainingModality[];
/** Deduplica y ordena en el orden canónico. */
export declare function canonicalTrainingModalities(ms: readonly TrainingModality[]): TrainingModality[];
/** CSV canónico para `setObData`. */
export declare function serializeTrainingModalities(ms: readonly TrainingModality[]): string;
/**
 * Lectura del valor persistido.
 *
 *   · ausente / vacío            → `MISSING`
 *   · algún valor desconocido    → `INVALID` (no se descarta en silencio: dejar
 *     solo los conocidos podría convertir una declaración en otra clase)
 *   · todo válido                → `DECLARED`, deduplicado y en orden canónico
 */
export type TrainingModalitiesRead = {
    kind: 'DECLARED';
    modalities: readonly TrainingModality[];
} | {
    kind: 'MISSING';
} | {
    kind: 'INVALID';
    received: unknown;
};
export declare function readTrainingModalities(raw: unknown): TrainingModalitiesRead;
/** Solo los valores válidos, para PRE-RELLENAR un formulario. Nunca para prescribir. */
export declare function declaredTrainingModalitiesForForm(raw: unknown): TrainingModality[];
/** Resultado de la derivación: una clase, o falta la declaración. */
export type ProteinActivityResolution = {
    kind: 'CLASS';
    activityClass: ProteinActivityClass;
} | {
    kind: 'TRAINING_MODALITY_REQUIRED';
};
/**
 * Clase de actividad proteica · ÚNICA derivación.
 *
 *   1 · no entrena habitualmente           → NO_STRUCTURED_TRAINING (ignora
 *       cualquier modalidad que haya quedado guardada)
 *   2 · entrena y no declaró modalidad     → TRAINING_MODALITY_REQUIRED
 *   3 · deporte especializado presente     → SPECIALIZED_SPORT (domina)
 *   4 · 1 modalidad estructurada           → STRENGTH / ENDURANCE_GENERAL / TEAM_INTERMITTENT
 *       2 o más estructuradas              → MIXED
 *   5 · solo baja demanda                  → LOW_DEMAND (con una estructurada,
 *       la baja demanda es secundaria y no la convierte en MIXED)
 */
export declare function deriveProteinActivityClass(trainsHabitually: boolean, modalities: readonly TrainingModality[] | null | undefined): ProteinActivityResolution;
