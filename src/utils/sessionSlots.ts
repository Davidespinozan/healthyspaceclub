// ─────────────────────────────────────────────────────────────────────────
// sessionSlots — Fase 3 · DISEÑAR LA SESIÓN ANTES DE LLENARLA + ANTI-REDUNDANCIA.
//
// Un SLOT es una NECESIDAD/función de la sesión (p.ej. "empuje horizontal principal",
// "aislamiento de deltoides"), NO un implemento ni un ejercicio concreto. El motor decide
// QUÉ funciones cubrir (slots) según día/objetivo/tiempo/anchors/déficit/prioridad; P3/P4
// siguen decidiendo CUÁNTO (series/reps). El gear cambia la implementación del patrón, no el patrón.
//
// ANTI-REDUNDANCIA: dos ejercicios del MISMO movementPattern son (casi) intercambiables. Un cap
// contextual por patrón evita "bench + incline + DB bench + smith bench". No es prohibición
// absoluta: hipertrofia permite 2 del mismo patrón (bench + incline DB); fuerza solo 1 (el main
// lift manda). No hay Math.random — todo determinista y explicable.
//
// NO incluye: motor de superseries/triseries, resistanceProfile, station metadata (fases futuras).
// ─────────────────────────────────────────────────────────────────────────
import type { Exercise, MuscleGroup, TrainingGoal } from '../types';
import type { Category } from './sessionPrescription';
import { movementPatternOf, type MovementPattern } from './movementPattern';

export interface Slot {
  role: Category;                 // main-compound / secondary-compound / isolation
  muscle: MuscleGroup;            // músculo objetivo del slot
  patterns: MovementPattern[];    // patrones aceptables para cubrir esta función
  filledBy?: string;              // id del anchor que YA satisface el slot (Fase 2 · no duplicar)
  required: boolean;              // ¿la sesión DEBE cubrir esta función?
}

// Patrones "primarios" (compuestos) y de "aislamiento" por músculo. Derivado del banco real.
const MUSCLE_SLOT_PATTERNS: Partial<Record<MuscleGroup, { primary: MovementPattern[]; isolation: MovementPattern[] }>> = {
  pecho: { primary: ['horizontal-push'], isolation: ['chest-fly'] },
  espalda: { primary: ['vertical-pull', 'horizontal-pull'], isolation: ['rear-delt', 'shrug'] },
  hombros: { primary: ['vertical-push'], isolation: ['shoulder-abduction', 'rear-delt', 'shoulder-flexion'] },
  triceps: { primary: ['horizontal-push'], isolation: ['elbow-extension'] },
  biceps: { primary: [], isolation: ['elbow-flexion'] },
  antebrazo: { primary: [], isolation: ['wrist-flexion', 'elbow-flexion'] },
  cuadriceps: { primary: ['squat', 'lunge'], isolation: ['knee-extension'] },
  gluteo: { primary: ['hinge', 'hip-extension'], isolation: ['hip-abduction'] },
  isquios: { primary: ['hinge'], isolation: ['knee-flexion'] },
  pantorrillas: { primary: [], isolation: ['calf-raise'] },
  core: { primary: [], isolation: ['core-anti-extension', 'core-anti-rotation', 'core-flexion', 'core-lateral', 'core-rotation'] },
  'cuerpo-completo': { primary: ['full-body', 'squat', 'hinge', 'horizontal-push'], isolation: [] },
};

/** Cap de ejercicios por patrón. FUERZA es estricta (el main lift manda, 1 por patrón);
 *  HIPERTROFIA permite 2 (bench + incline DB), nunca 4. */
export function patternCap(trainingGoal: TrainingGoal): number {
  return trainingGoal === 'fuerza' ? 1 : 2;
}

/**
 * Construye los SLOTS de la sesión (funciones a cubrir), en orden (main primero). No es una
 * plantilla fija: depende de día, objetivo, tiempo (targetCount), anchors, déficit y prioridad.
 * Los anchors SATISFACEN su slot (filledBy) → nunca se crea un slot duplicado del patrón del anchor.
 */
export function buildSessionSlots(input: {
  dayMuscles: MuscleGroup[];
  trainingGoal: TrainingGoal;
  targetCount: number;
  anchors: Array<{ id: string; muscle: MuscleGroup; pattern: MovementPattern | null; role: Category }>;
  priorityMuscles?: Set<string>;
  deficitByMuscle?: Record<string, number>; // mayor = más corto de volumen (más slots)
}): Slot[] {
  const { dayMuscles, trainingGoal, targetCount, anchors, priorityMuscles, deficitByMuscle } = input;
  const slots: Slot[] = [];
  const coveredPatterns = new Set<MovementPattern>();

  // 1) ANCHORS primero: cada uno satisface un slot (no se duplica su patrón).
  for (const a of anchors) {
    if (a.pattern) coveredPatterns.add(a.pattern);
    slots.push({ role: a.role, muscle: a.muscle, patterns: a.pattern ? [a.pattern] : [], filledBy: a.id, required: true });
  }

  // 2) Músculos del día, ordenados por PRIORIDAD (P5) y luego DÉFICIT de volumen (P3).
  const muscles = dayMuscles.filter(m => m !== 'cardio' && MUSCLE_SLOT_PATTERNS[m]);
  const rank = (m: MuscleGroup) =>
    (priorityMuscles?.has(m) ? -1000 : 0) - (deficitByMuscle?.[m] ?? 0);
  const ordered = [...muscles].sort((a, b) => rank(a) - rank(b));

  // 3) Ronda de PRIMARIOS (compuestos): un slot de patrón principal por músculo, salvo que un
  //    anchor ya cubra ese patrón. En FUERZA se prioriza esta ronda y se limita la de aislamiento.
  const addPrimary = () => {
    for (const m of ordered) {
      if (slots.length >= targetCount) return;
      const conf = MUSCLE_SLOT_PATTERNS[m]!;
      const pats = conf.primary.filter(p => !coveredPatterns.has(p));
      if (!pats.length) continue;
      slots.push({ role: 'secondary-compound', muscle: m, patterns: pats, required: true });
      coveredPatterns.add(pats[0]);
    }
  };
  // 4) Ronda de AISLAMIENTOS: rellena el resto del presupuesto con funciones de aislamiento del día.
  //    FUERZA limita el aislamiento (menos accesorios, más foco en el/los main lift); HIPERTROFIA
  //    lo permite libremente hasta el presupuesto (más cobertura/variedad).
  let isoAdded = 0;
  const isoLimit = trainingGoal === 'fuerza' ? 1 : Number.POSITIVE_INFINITY;
  const addIsolation = () => {
    for (const m of ordered) {
      if (slots.length >= targetCount || isoAdded >= isoLimit) return;
      const conf = MUSCLE_SLOT_PATTERNS[m]!;
      const pats = conf.isolation.filter(p => !coveredPatterns.has(p));
      if (!pats.length) continue;
      slots.push({ role: 'isolation', muscle: m, patterns: pats, required: false });
      coveredPatterns.add(pats[0]);
      isoAdded++;
    }
  };

  addPrimary();
  addPrimary(); // segunda pasada de compuestos (p.ej. el 2º patrón de espalda) antes que aislamiento
  addIsolation();
  if (slots.length < targetCount) addIsolation();

  return slots.slice(0, Math.max(targetCount, anchors.length));
}

/** Patrones REQUERIDOS por la sesión (de los slots required). Para validar cobertura. */
export function requiredPatterns(slots: Slot[]): MovementPattern[] {
  const out = new Set<MovementPattern>();
  for (const s of slots) if (s.required) for (const p of s.patterns) { out.add(p); break; }
  return [...out];
}

/** Reporte de redundancia de un conjunto de ejercicios (para trace/tests). */
export function redundancyReport(exerciseIds: string[], bankById: Map<string, Exercise>): {
  byPattern: Record<string, string[]>;
  maxPerPattern: number;
} {
  const byPattern: Record<string, string[]> = {};
  for (const id of exerciseIds) {
    const ex = bankById.get(id);
    if (!ex) continue;
    const p = movementPatternOf(ex);
    if (!p) continue;
    (byPattern[p] ??= []).push(id);
  }
  const maxPerPattern = Object.values(byPattern).reduce((a, v) => Math.max(a, v.length), 0);
  return { byPattern, maxPerPattern };
}

/**
 * ESTRUCTURA DETERMINISTA de la sesión (post-IA): (1) ANTI-REDUNDANCIA — recorta a `cap` por
 * patrón (anchors siempre se conservan y cuentan); (2) COBERTURA — si falta un patrón REQUERIDO,
 * inyecta un candidato válido de ese patrón. Reparación estructural, no una nueva generación.
 */
export function applySessionStructure<T extends { id: string }>(input: {
  exercises: T[];
  anchorIds: string[];
  requiredPatterns: MovementPattern[];
  candidates: Exercise[];        // pool válido (gear/pain/nivel ya filtrados), ordenado
  bankById: Map<string, Exercise>;
  trainingGoal: TrainingGoal;
  targetCount: number;
  makeItem: (id: string) => T | null;
}): { exercises: T[]; fixes: string[] } {
  const { exercises, anchorIds, candidates, bankById, trainingGoal, targetCount, makeItem } = input;
  const cap = patternCap(trainingGoal);
  const keep = new Set(anchorIds);
  const patOf = (id: string): MovementPattern | null => {
    const ex = bankById.get(id);
    return ex ? movementPatternOf(ex) : null;
  };
  const fixes: string[] = [];

  // (1) ANTI-REDUNDANCIA: cap por patrón. Los anchors se conservan SIEMPRE (y cuentan).
  const counts: Record<string, number> = {};
  const kept: T[] = [];
  const dropped: string[] = [];
  for (const ex of exercises) {
    const p = patOf(ex.id);
    if (!p) { kept.push(ex); continue; }
    const c = counts[p] ?? 0;
    if (keep.has(ex.id) || c < cap) { kept.push(ex); counts[p] = c + 1; }
    else dropped.push(ex.id);
  }
  if (dropped.length) fixes.push(`anti-redundancia (${trainingGoal}, cap ${cap}/patrón): quitados ${dropped.join(', ')}`);

  // (2) COBERTURA: cada patrón requerido debe estar presente; si falta, inyecta un candidato.
  const present = new Set(kept.map(e => e.id));
  const covered = new Set<MovementPattern>();
  for (const e of kept) { const p = patOf(e.id); if (p) covered.add(p); }
  for (const rp of input.requiredPatterns) {
    if (covered.has(rp)) continue;
    const cand = candidates.find(c => !present.has(c.id) && movementPatternOf(c) === rp);
    if (cand) {
      const item = makeItem(cand.id);
      if (item) {
        kept.unshift(item); present.add(cand.id); covered.add(rp);
        counts[rp] = (counts[rp] ?? 0) + 1;
        fixes.push(`cobertura: patrón requerido "${rp}" añadido (${cand.id})`);
      }
    }
  }

  // (3) Respeta el presupuesto: recorta NO-anchors cuyo patrón esté sobre-representado, desde el final.
  const cc = Math.max(targetCount, anchorIds.length);
  let out = kept;
  while (out.length > cc) {
    let idx = -1;
    for (let i = out.length - 1; i >= 0; i--) {
      const p = patOf(out[i].id);
      if (!keep.has(out[i].id) && p && (counts[p] ?? 0) > 1) { idx = i; break; }
    }
    if (idx < 0) { // ninguno redundante: quita el último no-anchor
      for (let i = out.length - 1; i >= 0; i--) if (!keep.has(out[i].id)) { idx = i; break; }
    }
    if (idx < 0) break;
    const p = patOf(out[idx].id); if (p) counts[p] = (counts[p] ?? 1) - 1;
    out = out.filter((_, i) => i !== idx);
  }

  return { exercises: out, fixes };
}
