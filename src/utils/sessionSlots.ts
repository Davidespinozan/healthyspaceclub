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
import { regionsOfPattern, REGION_SLOT, type Region } from './regionalCoverage';

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

const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Cuántos ejercicios pide la DOSIS de un músculo (Fase 5A.1). HIPERTROFIA reparte (~3 series/ej,
 *  abre un 2º estímulo cuando la dosis lo justifica); FUERZA concentra (el main absorbe). */
function exercisesForDose(dose: number, trainingGoal: TrainingGoal): number {
  if (!(dose > 0)) return 0;
  return trainingGoal === 'fuerza'
    ? clampN(Math.round(dose / 5), 1, 2)   // concentra en el main lift
    : clampN(Math.round(dose / 3), 1, 3);  // distribuye el estímulo
}

/**
 * Construye los SLOTS de la sesión (funciones a cubrir), en orden (main primero). Fase 5A.1:
 * DOSE-DRIVEN — la DOSIS REAL por músculo (P4 allocation, ÚNICA fuente) decide cuántos slots pide
 * cada músculo. Un músculo con dosis alta abre un 2º slot ÚTIL (patrón complementario), en vez de
 * concentrar 5 series en un ejercicio. HIPERTROFIA distribuye; FUERZA conserva su relleno compacto
 * de Fase 1. Los anchors satisfacen su slot (filledBy) y CONSUMEN parte de la dosis del músculo.
 * El nº de ejercicios de la sesión = slots.length (no hay cálculo de count aparte).
 */
export function buildSessionSlots(input: {
  dayMuscles: MuscleGroup[];
  trainingGoal: TrainingGoal;
  allocation: Record<string, number>;   // dosis HOY por músculo (P4) — ÚNICA fuente de verdad
  anchors: Array<{ id: string; muscle: MuscleGroup; pattern: MovementPattern | null; role: Category }>;
  priorityMuscles?: Set<string>;
  timeCap: number;                       // tope de ejercicios por tiempo (capacidad, no objetivo)
  requiredRegions?: Region[];            // Fase 5D · funciones MAYORES que la sesión DEBE cubrir (full-body)
}): Slot[] {
  const { dayMuscles, trainingGoal, allocation, anchors, priorityMuscles, timeCap, requiredRegions } = input;
  // Tope total: FUERZA compacto (Fase 1, sin cambios); HIPERTROFIA usa la capacidad de tiempo.
  const maxSlots = trainingGoal === 'fuerza'
    ? clampN(Math.round(timeCap * 0.6), 2, 6)
    : Math.max(3, timeCap);

  const slots: Slot[] = [];
  const coveredPatterns = new Set<MovementPattern>();
  const perMuscle = new Map<MuscleGroup, number>();
  const bump = (m: MuscleGroup) => perMuscle.set(m, (perMuscle.get(m) ?? 0) + 1);

  // 1) ANCHORS primero: satisfacen su slot (no se duplica su patrón) y consumen 1 ejercicio del músculo.
  for (const a of anchors) {
    if (a.pattern) coveredPatterns.add(a.pattern);
    slots.push({ role: a.role, muscle: a.muscle, patterns: a.pattern ? [a.pattern] : [], filledBy: a.id, required: true });
    bump(a.muscle);
  }

  // 1.5) COBERTURA REGIONAL (Fase 5D · full-body): antes de cualquier slot dose-driven/cosmético,
  // reserva las funciones MAYORES requeridas que el/los anchor(s) aún no cubren (≥1 upper + ≥1 lower,
  // + push/pull o knee/hinge según tiempo/déficit). Garantiza que "full-body" entrene todo el cuerpo
  // sin depender del orden del pool; el gear/pain limita las opciones (si no hay muscle/patrón, se
  // omite y se reporta como content-gap aguas arriba). No apila un patrón ya cubierto (§21).
  if (requiredRegions?.length) {
    const anchorRegions = new Set<Region>(anchors.flatMap(a => regionsOfPattern(a.pattern)));
    const isCovered = (region: Region) =>
      anchorRegions.has(region) || [...coveredPatterns].some(p => regionsOfPattern(p).includes(region));
    for (const region of requiredRegions) {
      if (slots.length >= maxSlots) break;
      if (isCovered(region)) continue;
      for (const opt of REGION_SLOT[region]) {
        if (!dayMuscles.includes(opt.muscle) || !MUSCLE_SLOT_PATTERNS[opt.muscle]) continue;
        const pat = opt.patterns.find(p => !coveredPatterns.has(p));
        if (!pat) continue;
        slots.push({ role: 'secondary-compound', muscle: opt.muscle, patterns: [pat], required: true });
        coveredPatterns.add(pat); bump(opt.muscle);
        break;
      }
    }
  }

  // Músculos del día, ordenados por PRIORIDAD (P5) y luego DOSIS desc (más volumen → antes).
  const muscles = dayMuscles.filter(m => m !== 'cardio' && MUSCLE_SLOT_PATTERNS[m]);
  const doseOf = (m: MuscleGroup) => allocation[m] ?? 0;
  const ordered = [...muscles].sort((a, b) =>
    ((priorityMuscles?.has(a) ? -1000 : 0) - doseOf(a)) - ((priorityMuscles?.has(b) ? -1000 : 0) - doseOf(b)));

  // Siguiente PATRÓN para un músculo (diversidad §5): SIEMPRE prioriza un PRIMARIO no cubierto
  // (el 2º compuesto de espalda = remo horizontal, de cuádriceps = lunge — complementario y
  // esencial), y solo después un AISLAMIENTO no cubierto. Nunca apila el mismo patrón.
  const nextPattern = (m: MuscleGroup): { pat: MovementPattern; role: Category } | null => {
    const conf = MUSCLE_SLOT_PATTERNS[m]!;
    const primaryNew = conf.primary.find(p => !coveredPatterns.has(p));
    if (primaryNew) return { pat: primaryNew, role: 'secondary-compound' };
    const isoNew = conf.isolation.find(p => !coveredPatterns.has(p));
    if (isoNew) return { pat: isoNew, role: 'isolation' };
    return null;
  };

  // 2) Cobertura esencial: garantiza el PRIMARIO de cada músculo con dosis (patrones del día).
  for (const m of ordered) {
    if (slots.length >= maxSlots) break;
    if (doseOf(m) <= 0 || (perMuscle.get(m) ?? 0) >= 1) continue;
    const np = nextPattern(m);
    if (!np) continue;
    slots.push({ role: np.role, muscle: m, patterns: [np.pat], required: true });
    coveredPatterns.add(np.pat); bump(m);
  }

  // 3) Slots ADICIONALES según DOSIS: hipertrofia abre un 2º/3º estímulo cuando la dosis lo pide;
  //    fuerza casi no (concentra). Baja dosis → sin slots basura. Todo topado por tiempo.
  let progressed = true;
  while (progressed && slots.length < maxSlots) {
    progressed = false;
    for (const m of ordered) {
      if (slots.length >= maxSlots) break;
      const have = perMuscle.get(m) ?? 0;
      if (have >= exercisesForDose(doseOf(m), trainingGoal)) continue;
      const np = nextPattern(m);
      if (!np) continue;
      slots.push({ role: np.role, muscle: m, patterns: [np.pat], required: false });
      coveredPatterns.add(np.pat); bump(m);
      progressed = true;
    }
  }

  // FUERZA: si aún cabe (poca dosis distribuida), rellena con 1 aislamiento (paridad con Fase 1).
  if (trainingGoal === 'fuerza' && slots.length < maxSlots) {
    for (const m of ordered) {
      if (slots.length >= maxSlots) break;
      const conf = MUSCLE_SLOT_PATTERNS[m]!;
      const iso = conf.isolation.find(p => !coveredPatterns.has(p));
      if (iso) { slots.push({ role: 'isolation', muscle: m, patterns: [iso], required: false }); coveredPatterns.add(iso); break; }
    }
  }

  return slots;
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
