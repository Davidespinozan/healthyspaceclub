// ═════════════════════════════════════════════════════════════════════════════
// CAPA 2 · A2 · MODALIDAD DE ENTRENAMIENTO DECLARADA
// ═════════════════════════════════════════════════════════════════════════════
//
// Única fuente de la clase de actividad proteica: lo que el socio DECLARA que
// entrena. Se guarda en `obData.trainingModalities` como CSV canónico (mismo
// patrón que `conditions` y `avoid`): `"strength,endurance"`.
//
// ── DOS DIMENSIONES DISTINTAS ────────────────────────────────────────────────
//   · CARGA   → minutos semanales / bandas T0–T4 (ActivityClassifier, CAPA 1).
//   · MODALIDAD → qué tipo de entrenamiento hace (este módulo).
// Ninguna se deriva de la otra. 240 min de fuerza y 240 min de carrera son la
// misma banda (T2) y clases distintas.
//
// ── LO QUE *NO* ES FUENTE DE MODALIDAD ──────────────────────────────────────
// Minutos, banda T, `obData.activity`, `nivel`, objetivo corporal,
// `trainingGoal`, la modalidad del workout del día, `completedSessions`,
// `workout_log`, `activityLog`, `cardioStyle`, yoga focus, IA. El historial
// puede servir algún día para sugerir, pero NUNCA cambia la modalidad en silencio.
//
// Puro y determinista.
// ═════════════════════════════════════════════════════════════════════════════
import type { ProteinActivityClass } from './macroPrescription';

/** Clave de `obData` donde vive la declaración. */
export const TRAINING_MODALITIES_KEY = 'trainingModalities';

/**
 * Modalidades declarables. `mixed` y «no entreno» NO se guardan: «mixto» se
 * deriva de dos o más modalidades estructuradas y «no entreno» es
 * `trainsHabitually = false`.
 */
export type TrainingModality =
  | 'strength'
  | 'endurance'
  | 'team_intermittent'
  | 'low_demand'
  | 'specialized_sport';

/** Orden canónico: es el de la UI y el del CSV persistido. */
export const TRAINING_MODALITIES: readonly TrainingModality[] = [
  'strength', 'endurance', 'team_intermittent', 'low_demand', 'specialized_sport',
];

/** Las tres que cuentan para «mixto». `low_demand` es secundaria. */
const STRUCTURED: readonly TrainingModality[] = ['strength', 'endurance', 'team_intermittent'];

const isModality = (v: string): v is TrainingModality =>
  (TRAINING_MODALITIES as readonly string[]).includes(v);

/** Deduplica y ordena en el orden canónico. */
export function canonicalTrainingModalities(ms: readonly TrainingModality[]): TrainingModality[] {
  return TRAINING_MODALITIES.filter((m) => ms.includes(m));
}

/** CSV canónico para `setObData`. */
export function serializeTrainingModalities(ms: readonly TrainingModality[]): string {
  return canonicalTrainingModalities(ms).join(',');
}

/**
 * Lectura del valor persistido.
 *
 *   · ausente / vacío            → `MISSING`
 *   · algún valor desconocido    → `INVALID` (no se descarta en silencio: dejar
 *     solo los conocidos podría convertir una declaración en otra clase)
 *   · todo válido                → `DECLARED`, deduplicado y en orden canónico
 */
export type TrainingModalitiesRead =
  | { kind: 'DECLARED'; modalities: readonly TrainingModality[] }
  | { kind: 'MISSING' }
  | { kind: 'INVALID'; received: unknown };

export function readTrainingModalities(raw: unknown): TrainingModalitiesRead {
  if (raw === undefined || raw === null) return { kind: 'MISSING' };
  if (typeof raw !== 'string') return { kind: 'INVALID', received: raw };
  const tokens = raw.split(',').map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) return { kind: 'MISSING' };
  if (!tokens.every(isModality)) return { kind: 'INVALID', received: raw };
  return { kind: 'DECLARED', modalities: canonicalTrainingModalities(tokens as TrainingModality[]) };
}

/** Solo los valores válidos, para PRE-RELLENAR un formulario. Nunca para prescribir. */
export function declaredTrainingModalitiesForForm(raw: unknown): TrainingModality[] {
  if (typeof raw !== 'string') return [];
  return canonicalTrainingModalities(raw.split(',').map((t) => t.trim()).filter(isModality));
}

/** Resultado de la derivación: una clase, o falta la declaración. */
export type ProteinActivityResolution =
  | { kind: 'CLASS'; activityClass: ProteinActivityClass }
  | { kind: 'TRAINING_MODALITY_REQUIRED' };

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
export function deriveProteinActivityClass(
  trainsHabitually: boolean,
  modalities: readonly TrainingModality[] | null | undefined,
): ProteinActivityResolution {
  if (!trainsHabitually) return { kind: 'CLASS', activityClass: 'NO_STRUCTURED_TRAINING' };
  const ms = canonicalTrainingModalities(modalities ?? []);
  if (ms.length === 0) return { kind: 'TRAINING_MODALITY_REQUIRED' };
  if (ms.includes('specialized_sport')) return { kind: 'CLASS', activityClass: 'SPECIALIZED_SPORT' };

  const structured = ms.filter((m) => STRUCTURED.includes(m));
  if (structured.length >= 2) return { kind: 'CLASS', activityClass: 'MIXED' };
  if (structured.length === 1) {
    switch (structured[0]) {
      case 'strength':          return { kind: 'CLASS', activityClass: 'STRENGTH' };
      case 'endurance':         return { kind: 'CLASS', activityClass: 'ENDURANCE_GENERAL' };
      case 'team_intermittent': return { kind: 'CLASS', activityClass: 'TEAM_INTERMITTENT' };
    }
  }
  // Sin especializado ni estructuradas, lo único que puede quedar es baja demanda.
  return { kind: 'CLASS', activityClass: 'LOW_DEMAND' };
}
