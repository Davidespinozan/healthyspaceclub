// ─────────────────────────────────────────────────────────────────────────
// regionalCoverage — Fase 5D · FULL-BODY = ENTRENAR TODO EL CUERPO (de forma inteligente).
//
// Una sesión etiquetada FULL-BODY debe entrenar SIGNIFICATIVAMENTE tren superior + tren inferior.
// El presupuesto de fatiga (5B) evita sesiones brutales, pero NO garantiza cobertura: un pool
// cargado de upper podía dejar una sesión sin piernas (o sin hinge). Este módulo aporta una
// COBERTURA REGIONAL MÍNIMA DINÁMICA — no una plantilla rígida press/row/squat/hinge cada vez.
//
// Regiones DERIVADAS de movementPattern existente (no una taxonomía nueva): cuatro funciones
// MAYORES (upper-push, upper-pull, lower-knee, lower-hinge) + accesorios (delts/arms/calves/core).
// La cobertura decide QUÉ función no podemos olvidar; P3/P4 deciden CUÁNTO; 5B/5C deciden con QUÉ
// ejercicio (fatiga/calidad). El énfasis (qué upper / qué lower) rota por DÉFICIT semanal, no random.
//
// NO incluye: advanced engine, resistanceProfile, station metadata, indirect volume, cardio freq.
// ─────────────────────────────────────────────────────────────────────────
import type { Exercise, MuscleGroup, TrainingGoal, Modality } from '../types';
import { movementPatternOf, type MovementPattern } from './movementPattern';
import { isStrengthDomainSession } from './trainingDomain';   // F2C-9B.2 · strength credit por SESIÓN
import { isWorkingSet, type ExecutionRole } from './executionRole';   // F2C-9C.1 · exposición solo desde sets de trabajo
import { categorize } from './sessionPrescription';
import { isAnchorEligible } from './blockAnchors';

// Funciones MAYORES (significativas) + accesorios. Full-body real necesita ≥1 upper mayor y
// ≥1 lower mayor; los accesorios son opcionales (dosis/tiempo).
export type Region =
  | 'upper-push' | 'upper-pull' | 'lower-knee' | 'lower-hinge'   // MAYORES
  | 'delts' | 'arms' | 'calves' | 'core';                        // accesorios

export const MAJOR_REGIONS: readonly Region[] = ['lower-knee', 'lower-hinge', 'upper-push', 'upper-pull'];
export const UPPER_MAJOR: readonly Region[] = ['upper-push', 'upper-pull'];
export const LOWER_MAJOR: readonly Region[] = ['lower-knee', 'lower-hinge'];

/** Región(es) funcional(es) de un patrón. full-body (cluster) cuenta como upper+lower a la vez.
 *  Los aislamientos de brazos/hombro/gemelo/core son ACCESORIOS: no cuentan como upper/lower mayor. */
export function regionsOfPattern(p: MovementPattern | null): Region[] {
  switch (p) {
    case 'horizontal-push': case 'vertical-push': return ['upper-push'];
    case 'chest-fly':                              return ['upper-push'];   // pecho, pero accesorio en peso
    case 'horizontal-pull': case 'vertical-pull':  return ['upper-pull'];
    case 'shrug':                                  return ['upper-pull'];
    case 'squat': case 'lunge': case 'knee-extension': return ['lower-knee'];
    case 'hinge': case 'hip-extension': case 'hip-adduction': case 'hip-abduction': case 'knee-flexion':
      return ['lower-hinge'];
    case 'rear-delt': case 'shoulder-abduction': case 'shoulder-flexion': return ['delts'];
    case 'elbow-flexion': case 'elbow-extension': case 'wrist-flexion':   return ['arms'];
    case 'calf-raise': return ['calves'];
    case 'full-body':  return ['upper-push', 'lower-knee'];   // cluster: cubre upper y lower
    case null: return [];
    default: return ['core'];   // core-* / balance
  }
}

/** Región(es) de un ejercicio (vía su patrón). */
export function regionsOfExercise(ex: Pick<Exercise, 'id' | 'muscleGroup' | 'isYoga'>): Region[] {
  return regionsOfPattern(movementPatternOf(ex));
}

/** ¿Es una función MAYOR (significativa) de upper/lower? */
export const isMajor = (r: Region): boolean => (MAJOR_REGIONS as readonly Region[]).includes(r);
const isUpper = (r: Region): boolean => (UPPER_MAJOR as readonly Region[]).includes(r);
const isLower = (r: Region): boolean => (LOWER_MAJOR as readonly Region[]).includes(r);

/**
 * Muscle+patrones candidatos para CUBRIR una función mayor (para inyectar un slot). Ordenados por
 * preferencia; se filtran contra los músculos del día y los patrones ya cubiertos. Solo compuestos
 * significativos (el aislamiento no "cuenta" como cobertura mayor).
 */
export const REGION_SLOT: Record<Region, Array<{ muscle: MuscleGroup; patterns: MovementPattern[] }>> = {
  'upper-push': [{ muscle: 'pecho', patterns: ['horizontal-push'] }, { muscle: 'hombros', patterns: ['vertical-push'] }, { muscle: 'triceps', patterns: ['horizontal-push'] }],
  'upper-pull': [{ muscle: 'espalda', patterns: ['horizontal-pull', 'vertical-pull'] }],
  'lower-knee': [{ muscle: 'cuadriceps', patterns: ['squat', 'lunge'] }],
  'lower-hinge': [{ muscle: 'gluteo', patterns: ['hip-extension', 'hinge'] }, { muscle: 'isquios', patterns: ['hinge', 'knee-flexion'] }],
  delts: [], arms: [], calves: [], core: [],
};

/**
 * ¿Qué funciones MAYORES debe cubrir esta sesión full-body? Mínimo SIEMPRE: 1 upper + 1 lower.
 * El énfasis (push vs pull, knee vs hinge) lo decide el DÉFICIT semanal (menos expuesto → primero),
 * no una plantilla ni Math.random. Con tiempo (≥50 min) se piden las cuatro; compacto (30 min) pide
 * un tercer patrón guiado por déficit (p.ej. lower main + push + pull, o knee + hinge + upper).
 */
export function requiredRegions(input: {
  timeMinutes: number;
  trainingGoal: TrainingGoal;
  exposure?: Partial<Record<Region, number>>;   // sets/exposiciones recientes por región
}): Region[] {
  const exp = input.exposure ?? {};
  const deficit = (r: Region) => -(exp[r] ?? 0);                    // menos expuesto → mayor déficit
  const byDeficit = (a: Region, b: Region) => deficit(b) - deficit(a);
  const pick = (opts: readonly Region[]) => [...opts].sort(byDeficit)[0];

  const upper = pick(UPPER_MAJOR);
  const lower = pick(LOWER_MAJOR);
  const req: Region[] = [lower, upper];                            // lower primero (gran patrón inferior)

  // Para el 3.er patrón compacto: a igualdad de déficit prefiere COMPLETAR upper (push+pull) antes que
  // un 2.º compuesto inferior — dos lower pesados es lo más fatigante y 30 min es compacto (§3). El
  // déficit real (una región hambrienta) sigue mandando por encima de esta preferencia.
  const upperFirst = (a: Region, b: Region) => ((UPPER_MAJOR as readonly Region[]).includes(b) ? 1 : 0) - ((UPPER_MAJOR as readonly Region[]).includes(a) ? 1 : 0);
  const remaining = MAJOR_REGIONS.filter(r => !req.includes(r)).sort((a, b) => byDeficit(a, b) || upperFirst(a, b));
  const wantFull = input.timeMinutes >= 50;                        // 45-60+: cobertura más completa
  const extra = wantFull ? remaining.length : 1;                  // 30 min: un tercer patrón (déficit/upper)
  return [...req, ...remaining.slice(0, extra)];
}

/** Exposición reciente por región (sets contados por ejercicio ejecutado) desde `sinceDate`. */
export function regionExposure(
  sessions: Array<{ date: string; exerciseIds?: string[]; modality?: Modality; exercises?: Array<{ id: string; sets: { role?: ExecutionRole }[] }> }>,
  bankById: Map<string, Pick<Exercise, 'id' | 'muscleGroup' | 'isYoga'>>,
  sinceDate: string,
): Record<Region, number> {
  const out: Record<Region, number> = { 'upper-push': 0, 'upper-pull': 0, 'lower-knee': 0, 'lower-hinge': 0, delts: 0, arms: 0, calves: 0, core: 0 };
  for (const s of sessions) {
    if (s.date < sinceDate) continue;
    // F2C-9B.2 · la cobertura regional de FUERZA solo cuenta sesiones de dominio fuerza — una sesión
    // cardio con un press-horizontal NO debe marcar "ya cubriste upper-push" y suprimir un ancla.
    if (!isStrengthDomainSession(s)) continue;
    // F2C-9C.1 · un id con DETALLE por-set y SIN ningún set de trabajo (entrada pure-warmup/cooldown) NO
    // aporta exposición. Legacy sin `exercises[]` (o sets sin role → working) cuenta idéntico a hoy;
    // los skipped (en exerciseIds pero no en exercises[]) siguen contando como antes.
    const detail = s.exercises ?? [];
    const hasDetail = new Set(detail.map(e => e.id));
    const worked = new Set(detail.filter(e => e.sets.some(isWorkingSet)).map(e => e.id));
    for (const id of s.exerciseIds ?? []) {
      if (hasDetail.has(id) && !worked.has(id)) continue;   // entrada solo warmup/cooldown → sin exposición
      const ex = bankById.get(id);
      if (!ex) continue;
      for (const r of regionsOfExercise(ex)) out[r]++;
    }
  }
  return out;
}

/**
 * Selección de anchors para FULL-BODY: reparte las (varias) anclas entre regiones COMPLEMENTARIAS
 * en vez de dejarlas sesgadas por el orden del pool (bench+OHP+dips → 3 upper). Una ancla por región
 * requerida (en orden de prioridad/déficit), prefiriendo main-compound; luego rellena con las mejores
 * restantes priorizando regiones aún no cubiertas. Determinista, respeta el ranking del motor.
 */
export function selectFullBodyAnchors(
  candidatesOrdered: Exercise[],
  trainingGoal: TrainingGoal,
  count: number,
  regions: readonly Region[],
  exclude: Set<string> = new Set(),
): string[] {
  const eligible = candidatesOrdered.filter(e => !exclude.has(e.id) && isAnchorEligible(e, trainingGoal));
  const regOf = (e: Exercise) => regionsOfExercise(e);
  const isMain = (e: Exercise) => categorize(e) === 'main-compound';
  const used = new Set<string>();
  const out: string[] = [];

  // 1) Una ancla por región requerida (orden = prioridad por déficit), prefiriendo main-compound.
  for (const region of regions) {
    if (out.length >= count) break;
    const inRegion = eligible.filter(e => !used.has(e.id) && regOf(e).includes(region));
    const pick = inRegion.find(isMain) ?? inRegion[0];
    if (pick) { out.push(pick.id); used.add(pick.id); }
  }
  // 2) Rellena con las mejores restantes, prefiriendo regiones aún NO cubiertas (complementariedad).
  if (out.length < count) {
    const covered = new Set(out.flatMap(id => { const e = eligible.find(x => x.id === id); return e ? regOf(e) : []; }));
    const rest = eligible.filter(e => !used.has(e.id));
    const fresh = rest.filter(e => regOf(e).some(r => !covered.has(r)));
    for (const e of [...fresh, ...rest]) {
      if (out.length >= count) break;
      if (used.has(e.id)) continue;
      out.push(e.id); used.add(e.id);
    }
  }
  return out.slice(0, Math.max(0, count));
}

/** Resumen de cobertura de un conjunto de ejercicios (para métricas/invariantes). */
export function coverageReport(
  exerciseIds: string[],
  bankById: Map<string, Pick<Exercise, 'id' | 'muscleGroup' | 'isYoga'>>,
): { regions: Set<Region>; upper: boolean; lower: boolean; majorsCovered: Region[] } {
  const regions = new Set<Region>();
  for (const id of exerciseIds) {
    const ex = bankById.get(id);
    if (!ex) continue;
    for (const r of regionsOfExercise(ex)) regions.add(r);
  }
  const majorsCovered = MAJOR_REGIONS.filter(r => regions.has(r));
  return {
    regions,
    upper: [...regions].some(isUpper),
    lower: [...regions].some(isLower),
    majorsCovered,
  };
}
