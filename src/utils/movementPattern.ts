// ─────────────────────────────────────────────────────────────────────────
// movementPattern — Fase 3 · PATRÓN DE MOVIMIENTO como metadata explícita.
//
// Autoridad NO-regex-de-nombre para "qué función mecánica cumple un ejercicio". Reemplaza al
// frágil `movementFamily` (poblado en 9/76) y da la base para SLOTS y ANTI-REDUNDANCIA: dos
// ejercicios del MISMO patrón son intercambiables/redundantes; de patrones distintos, cubren
// funciones distintas.
//
// Taxonomía DERIVADA del banco real (76 ejercicios de resistencia), no inventada: pequeña,
// expresiva y mantenible (~28 patrones, media 2.7 ej/patrón). Yoga/cardio quedan fuera (null).
//
// Resolución: `movementPatternOf(ex)` prefiere el campo explícito `ex.movementPattern` si existe
// (override futuro), si no clasifica por ID canónico (limpio en este banco) y cae a muscleGroup.
// Cobertura validada = 100% del banco de resistencia (test bankTaxonomy). Sin UNKNOWN silencioso.
// ─────────────────────────────────────────────────────────────────────────
import type { Exercise, MuscleGroup } from '../types';

export type MovementPattern =
  // Empuje / tracción del tren superior
  | 'horizontal-push' | 'vertical-push' | 'horizontal-pull' | 'vertical-pull'
  // Aislamientos de tren superior
  | 'chest-fly' | 'rear-delt' | 'shoulder-abduction' | 'shoulder-flexion'
  | 'elbow-flexion' | 'elbow-extension' | 'wrist-flexion' | 'shrug'
  // Tren inferior
  | 'squat' | 'lunge' | 'hinge' | 'hip-extension' | 'hip-abduction' | 'hip-adduction'
  | 'knee-extension' | 'knee-flexion' | 'calf-raise'
  // Core / estabilidad
  | 'core-anti-extension' | 'core-anti-rotation' | 'core-lateral' | 'core-flexion' | 'core-rotation' | 'balance'
  // Cuerpo completo
  | 'full-body';

export const ALL_MOVEMENT_PATTERNS: readonly MovementPattern[] = [
  'horizontal-push', 'vertical-push', 'horizontal-pull', 'vertical-pull',
  'chest-fly', 'rear-delt', 'shoulder-abduction', 'shoulder-flexion',
  'elbow-flexion', 'elbow-extension', 'wrist-flexion', 'shrug',
  'squat', 'lunge', 'hinge', 'hip-extension', 'hip-abduction', 'hip-adduction',
  'knee-extension', 'knee-flexion', 'calf-raise',
  'core-anti-extension', 'core-anti-rotation', 'core-lateral', 'core-flexion', 'core-rotation', 'balance',
  'full-body',
];
const PATTERN_SET = new Set<string>(ALL_MOVEMENT_PATTERNS);

// Reglas por ID canónico. ORDEN IMPORTA: las más específicas primero (curl-muneca antes que curl).
// Cada regla es [regex sobre el id, patrón]. El id del banco codifica el movimiento con fiabilidad.
const ID_RULES: Array<[RegExp, MovementPattern]> = [
  // ── Core (antes que nada: sus ids contienen "flexion/rotacion/piernas" que chocarían) ──
  [/rollout|anti-extension|anti-flexion/, 'core-anti-extension'],
  [/anti-rotacion/, 'core-anti-rotation'],
  [/anti-lateral/, 'core-lateral'],
  [/rotacion-con-peso/, 'core-rotation'],
  [/flexion-espinal|levantamiento-piernas|core-dinamico|core-suelo/, 'core-flexion'],
  [/equilibrio/, 'balance'],
  // ── Tren inferior ──
  [/peso-muerto|good-morning/, 'hinge'],
  [/hip-thrust|patada-gluteo|hiperextension/, 'hip-extension'],      // incluye hiperextensiones (espalda baja)
  [/abduccion-cadera|caminata-lateral/, 'hip-abduction'],
  [/aduccion-cadera/, 'hip-adduction'],
  [/curl-femoral/, 'knee-flexion'],
  [/extension-cuadriceps|sissy/, 'knee-extension'],
  [/elevacion-talones/, 'calf-raise'],
  [/sentadilla-unilateral|zancada|step-up/, 'lunge'],                // unilateral / single-leg
  [/sentadilla|prensa|sentarse-pararse/, 'squat'],                   // bilateral knee-dominant
  // ── Tren superior · tracción ──
  [/traccion-vertical|pullover/, 'vertical-pull'],                   // pullover → dominante de dorsal
  [/remo|face-pull/, 'horizontal-pull'],                             // face-pull cuenta como tracción horizontal/rear
  [/shrug/, 'shrug'],
  // ── Tren superior · empuje ──
  [/press-vertical|upright-row/, 'vertical-push'],                   // upright-row: patrón vertical de hombro
  [/press-horizontal|press-inclinado|press-declinado|flexion|fondos-triceps|press-cerrado|press-triceps-maquina/, 'horizontal-push'],
  [/apertura/, 'chest-fly'],
  // ── Aislamientos de hombro ──
  [/elevacion-lateral/, 'shoulder-abduction'],
  [/elevacion-frontal/, 'shoulder-flexion'],
  [/vuelo-posterior/, 'rear-delt'],
  // ── Brazos ──
  [/curl-muneca/, 'wrist-flexion'],
  [/curl/, 'elbow-flexion'],                                         // resto de curls (incluye inverso/martillo)
  [/press-frances|extensiones-sobre-cabeza|triceps-push-down|patada-triceps/, 'elbow-extension'],
  // ── Cuerpo completo ──
  [/cluster/, 'full-body'],
];

// Fallback por músculo (si un id nuevo no matchea): patrón "principal" del grupo.
const MUSCLE_FALLBACK: Partial<Record<MuscleGroup, MovementPattern>> = {
  pecho: 'horizontal-push', espalda: 'horizontal-pull', hombros: 'vertical-push',
  biceps: 'elbow-flexion', antebrazo: 'elbow-flexion', triceps: 'elbow-extension',
  cuadriceps: 'squat', gluteo: 'hip-extension', isquios: 'hinge', pantorrillas: 'calf-raise',
  core: 'core-anti-extension', 'cuerpo-completo': 'full-body',
};

/** Patrón de un ejercicio de RESISTENCIA. null para yoga/cardio (no participan en slots). */
export function movementPatternOf(ex: Pick<Exercise, 'id' | 'muscleGroup' | 'isYoga'> & { movementPattern?: string }): MovementPattern | null {
  if (ex.isYoga || ex.muscleGroup === 'cardio') return null;
  // 1) Metadata explícita gana (override futuro, sin depender del nombre).
  if (ex.movementPattern && PATTERN_SET.has(ex.movementPattern)) return ex.movementPattern as MovementPattern;
  // 2) Clasificación por ID canónico.
  const id = ex.id.toLowerCase();
  for (const [re, pat] of ID_RULES) if (re.test(id)) return pat;
  // 3) Fallback por grupo muscular (nunca UNKNOWN silencioso: siempre un patrón del grupo).
  return MUSCLE_FALLBACK[ex.muscleGroup] ?? null;
}

/** Región del patrón (para slots y orden). */
export function regionOfPattern(p: MovementPattern): 'push' | 'pull' | 'lower' | 'core' | 'other' {
  if (/push|chest-fly|shoulder-abduction|shoulder-flexion|elbow-extension/.test(p)) return 'push';
  if (/pull|rear-delt|elbow-flexion|wrist-flexion|shrug/.test(p)) return 'pull';
  if (/squat|lunge|hinge|hip-|knee-|calf/.test(p)) return 'lower';
  if (/core|balance/.test(p)) return 'core';
  return 'other';
}
