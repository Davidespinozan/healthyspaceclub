// ─────────────────────────────────────────────────────────────────────────
// supersetEngine — Fase 4 · EL MOTOR decide las agrupaciones (no la IA).
//
// Principio: NO HACER SUPERSET ES UNA DECISIÓN VÁLIDA. Una biserie/triserie solo existe si
// MEJORA la sesión (ahorro de tiempo, antagonismo, complementariedad, densidad útil) sin
// destruir rendimiento/técnica/fatiga/logística/prioridad/anchors.
//
// La sesión se diseña PRIMERO (slots → ejercicios → anchors → anti-redundancia → orden →
// prescripción); las agrupaciones se evalúan AL FINAL. Si no hay buena pareja: NO GROUP.
//
// Puro y determinista. `evaluateSupersetPair` clasifica calidad (beneficial|acceptable|bad) y
// tipo; `buildGroups` arma los groups (tamaño ≤3) protegiendo anchors/mains. Sin Math.random.
// ─────────────────────────────────────────────────────────────────────────
import type { Exercise, MuscleGroup, TrainingGoal } from '../types';
import type { Phase } from './sessionPrescription';
import { roleOf, fatigueDemand, type ExerciseRole } from './exerciseRole';
import { movementPatternOf, type MovementPattern } from './movementPattern';
import { HEAVY_COMPOUND } from './exerciseOrder';

export type SupersetQuality = 'beneficial' | 'acceptable' | 'bad';
export type SupersetType = 'antagonist' | 'complementary' | 'same-muscle' | 'time-saver' | 'invalid';

export interface ExMeta {
  id: string;
  role: ExerciseRole;
  pattern: MovementPattern | null;
  muscle: MuscleGroup;
  demand: number;                // 1–4 (fatiga)
  setup: 'barbell' | 'machine-cable' | 'dumbbell' | 'bodyweight' | 'band' | 'other';
}

export interface SupersetContext {
  trainingGoal: TrainingGoal;
  timeMinutes: number;
  phase: Phase;
  readinessLow?: boolean;
  anchorIds?: Set<string>;
  level?: 'principiante' | 'intermedio' | 'avanzado' | string;
}

// Setup físico aproximado (logística CONSERVADORA: solo lo obviamente molesto). Por id.
function setupClass(id: string): ExMeta['setup'] {
  const s = id.toLowerCase();
  if (/banda|liga/.test(s)) return 'band';
  if (/polea|push-down|maquina|prensa|jal|cable/.test(s)) return 'machine-cable';
  if (/barra|peso-muerto|sentadilla-bilateral|cluster|barra-z|good-morning|hip-thrust|shrug/.test(s)) return 'barbell';
  if (/mancuern|martillo|concentrado|patada|vuelo|elevacion|apertura|curl-inclinado|curl-pie/.test(s)) return 'dumbbell';
  if (/flexion|dominada|fondos|remo-invertido|plancha|anti-|rollout|equilibrio|sissy|parar/.test(s)) return 'bodyweight';
  return 'other';
}

/** Metadata de agrupación de un ejercicio (rol/patrón/músculo/fatiga/setup). */
export function metaOf(ex: Pick<Exercise, 'id' | 'name' | 'type' | 'muscleGroup' | 'isYoga'>): ExMeta {
  const role = roleOf(ex, HEAVY_COMPOUND);
  const pattern = movementPatternOf(ex);
  return { id: ex.id, role, pattern, muscle: ex.muscleGroup, demand: fatigueDemand(role, pattern), setup: setupClass(ex.id) };
}

// Pares de patrones ANTAGONISTAS (uno descansa mientras el otro trabaja).
const ANTAGONIST: Array<[MovementPattern, MovementPattern]> = [
  ['elbow-flexion', 'elbow-extension'],
  ['horizontal-push', 'horizontal-pull'],
  ['vertical-push', 'vertical-pull'],
  ['knee-extension', 'knee-flexion'],
  ['chest-fly', 'rear-delt'],
];
function isAntagonist(a: MovementPattern | null, b: MovementPattern | null): boolean {
  if (!a || !b) return false;
  return ANTAGONIST.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}

const SMALL_MUSCLES = new Set<MuscleGroup>(['hombros', 'biceps', 'triceps', 'antebrazo', 'pantorrillas', 'core']);
const isCompound = (r: ExerciseRole) => r === 'main' || r === 'secondary';

// Logística: ¿la transición/setup es molesta? Conservador. Dos barras = una sola barra (malo);
// barra + máquina/polea = estaciones pesadas distintas (malo). Mismo setup / peso corporal = ok.
function logisticsCost(a: ExMeta, b: ExMeta): 'ok' | 'annoying' {
  if (a.setup === 'bodyweight' || b.setup === 'bodyweight') return 'ok';
  if (a.setup === b.setup) return a.setup === 'barbell' ? 'annoying' : 'ok'; // 2 barbell = 1 barra
  if ((a.setup === 'barbell' && b.setup === 'machine-cable') || (a.setup === 'machine-cable' && b.setup === 'barbell')) return 'annoying';
  return 'ok';
}
function downgrade(q: SupersetQuality): SupersetQuality {
  return q === 'beneficial' ? 'acceptable' : q === 'acceptable' ? 'bad' : 'bad';
}

/**
 * Evalúa una pareja para biserie. Determinista y explicable. Reglas discretas: anchors/mains van
 * solos; dos compuestos = BAD; compuesto+aislamiento solo como time-saver no interferente con poco
 * tiempo; aislamiento+aislamiento según antagonismo/complementariedad/mismo-músculo, ajustado por
 * logística/gear/fase/readiness. FUERZA es mucho más estricta (solo aislamientos).
 */
export function evaluateSupersetPair(a: ExMeta, b: ExMeta, ctx: SupersetContext): {
  quality: SupersetQuality; type: SupersetType; reasons: string[];
} {
  const reasons: string[] = [];
  const bad = (why: string, type: SupersetType = 'invalid') => ({ quality: 'bad' as const, type, reasons: [...reasons, why] });
  const anchors = ctx.anchorIds ?? new Set<string>();

  if (a.id === b.id) return bad('mismo ejercicio');
  if (anchors.has(a.id) || anchors.has(b.id)) return bad('un anchor no se agrupa (continuidad + rendimiento)');
  if (a.role === 'main' || b.role === 'main') return bad('un lift principal va SOLO (rendimiento, técnica, descanso)');
  if (ctx.phase === 'deload') return bad('deload: menos densidad, sin superseries');

  const bothCompound = isCompound(a.role) && isCompound(b.role);
  const oneCompound = isCompound(a.role) !== isCompound(b.role);

  // FUERZA: solo aislamiento + aislamiento (protege todo trabajo compuesto).
  if (ctx.trainingGoal === 'fuerza' && (bothCompound || oneCompound)) {
    return bad('fuerza: el trabajo compuesto va solo (protege el main lift)');
  }
  // Intensificación en fuerza: prácticamente nada salvo accesorios ligeros (ya cubierto arriba).

  // Dos compuestos → BAD (fondos+búlgara, squat+deadlift, bench+row, dos mains, etc.).
  if (bothCompound) {
    return bad(`dos compuestos juntos (demanda ${a.demand}+${b.demand}) comprometen rendimiento/fatiga`);
  }

  // Compuesto + aislamiento → solo con tiempo limitado; el compuesto NO puede ser demandante.
  if (oneCompound) {
    const iso = a.role === 'isolation' ? a : b;
    const comp = a.role === 'isolation' ? b : a;
    if (ctx.timeMinutes > 45) return bad('con tiempo suficiente el compuesto no se agrupa');
    if (comp.demand >= 3) return bad(`compuesto demandante (fatiga ${comp.demand}) va solo`);
    if (logisticsCost(a, b) === 'annoying') return bad('logística molesta (setups pesados distintos)');
    if (ctx.readinessLow) return bad('readiness baja: no agrupar compuestos');
    if (iso.muscle === comp.muscle) {
      reasons.push('mismo músculo: pre/post-agotamiento (intención de estímulo), tiempo corto');
      return { quality: 'acceptable', type: 'same-muscle', reasons };
    }
    reasons.push('time-saver: compuesto ligero + aislamiento no interferente, poco tiempo');
    return { quality: 'acceptable', type: 'time-saver', reasons };
  }

  // Aislamiento + aislamiento.
  let type: SupersetType;
  let quality: SupersetQuality;
  if (isAntagonist(a.pattern, b.pattern)) {
    type = 'antagonist'; quality = 'beneficial';
    reasons.push('antagonistas: uno descansa mientras el otro trabaja');
  } else if (a.muscle === b.muscle) {
    type = a.pattern === b.pattern ? 'same-muscle' : 'complementary';
    quality = type === 'same-muscle' ? 'acceptable' : 'beneficial';
    reasons.push(type === 'same-muscle' ? 'mismo músculo, mismo patrón (estímulo repetido)' : 'mismo músculo, patrones distintos (cabezas complementarias)');
  } else {
    type = 'complementary';
    // pequeños/accesorios distintos = complementarios de baja interferencia → beneficial;
    // si uno es de un músculo grande (pecho/espalda/pierna) = solo time-saver aceptable.
    const bothSmall = SMALL_MUSCLES.has(a.muscle) && SMALL_MUSCLES.has(b.muscle);
    quality = bothSmall ? 'beneficial' : 'acceptable';
    reasons.push(bothSmall ? 'aislamientos de músculos pequeños distintos (no interfieren)' : 'aislamientos distintos (ahorro de tiempo)');
  }

  // Logística molesta → baja un nivel.
  if (logisticsCost(a, b) === 'annoying') { quality = downgrade(quality); reasons.push('logística: setups distintos/pesados'); }
  // Readiness baja → conservador (no aumentar densidad en un mal día).
  if (ctx.readinessLow) { quality = downgrade(quality); reasons.push('readiness baja: menos densidad'); }
  // Intensificación → same-muscle se vuelve más conservador.
  if (ctx.phase === 'intensificacion' && type === 'same-muscle') { quality = downgrade(quality); reasons.push('intensificación: conservador'); }

  return { quality, type, reasons };
}

/** Evalúa una TRISERIE (más estricta): los 3 aislamientos, todas las parejas ≥ acceptable, no fuerza. */
export function evaluateTriset(items: ExMeta[], ctx: SupersetContext): { quality: SupersetQuality; reasons: string[] } {
  if (items.length !== 3) return { quality: 'bad', reasons: ['una triserie son exactamente 3'] };
  if (ctx.trainingGoal === 'fuerza') return { quality: 'bad', reasons: ['fuerza: triseries prácticamente nunca'] };
  if (items.some(i => isCompound(i.role))) return { quality: 'bad', reasons: ['triserie solo de aislamientos (nunca 3 compuestos)'] };
  const pairs: Array<[ExMeta, ExMeta]> = [[items[0], items[1]], [items[0], items[2]], [items[1], items[2]]];
  const quals = pairs.map(([x, y]) => evaluateSupersetPair(x, y, ctx).quality);
  if (quals.some(q => q === 'bad')) return { quality: 'bad', reasons: ['alguna pareja de la triserie es mala'] };
  const beneficialCount = quals.filter(q => q === 'beneficial').length;
  return { quality: beneficialCount >= 2 ? 'beneficial' : 'acceptable', reasons: ['3 aislamientos compatibles'] };
}

/** Presupuesto de agrupaciones según tiempo/objetivo/fase/readiness. Menos tiempo → más agrupación
 *  inteligente; 90 min → ninguna (no hace falta). Fuerza y deload → mínimas. */
function groupBudget(ctx: SupersetContext): number {
  if (ctx.phase === 'deload' || ctx.readinessLow) return 0;
  const t = ctx.timeMinutes;
  if (ctx.trainingGoal === 'fuerza') return t <= 30 ? 1 : 0;      // fuerza: casi nunca
  if (ctx.level === 'principiante') return t <= 45 ? 1 : 0;        // principiante: menos densidad
  return t <= 30 ? 2 : t <= 45 ? 2 : t <= 60 ? 1 : 0;             // hipertrofia
}

/**
 * Arma los GROUPS de la sesión (el motor decide, no la IA). Protege anchors/mains; empareja
 * accesorios por CALIDAD (beneficial > acceptable), disjuntos, hasta el presupuesto de tiempo;
 * extiende a triserie solo si claramente mejora; nunca forma BAD; tamaño ≤3. Devuelve el mapa
 * exerciseId→groupId y un trace explicable. Si no hay buena pareja: sin groups.
 */
export function buildGroups(
  orderedIds: string[],
  bankById: Map<string, Exercise>,
  ctx: SupersetContext,
): { groups: Record<string, string>; trace: Array<{ ids: string[]; type: SupersetType; quality: SupersetQuality; reasons: string[] }> } {
  const budget = groupBudget(ctx);
  const groups: Record<string, string> = {};
  const trace: Array<{ ids: string[]; type: SupersetType; quality: SupersetQuality; reasons: string[] }> = [];
  if (budget <= 0) return { groups, trace };

  const anchors = ctx.anchorIds ?? new Set<string>();
  // Agrupables: accesorios/aislamientos (y secundarios solo si el par lo permite), no anchors/mains.
  const metas = orderedIds
    .map(id => bankById.get(id))
    .filter((e): e is Exercise => !!e)
    .map(metaOf)
    .filter(m => !anchors.has(m.id) && m.role !== 'main');

  // Todas las parejas candidatas, ordenadas por calidad (beneficial primero).
  const rank = (q: SupersetQuality) => (q === 'beneficial' ? 0 : q === 'acceptable' ? 1 : 2);
  const pairs: Array<{ a: string; b: string; q: SupersetQuality; type: SupersetType; reasons: string[] }> = [];
  for (let i = 0; i < metas.length; i++) for (let j = i + 1; j < metas.length; j++) {
    const ev = evaluateSupersetPair(metas[i], metas[j], ctx);
    if (ev.quality !== 'bad') pairs.push({ a: metas[i].id, b: metas[j].id, q: ev.quality, type: ev.type, reasons: ev.reasons });
  }
  pairs.sort((x, y) => rank(x.q) - rank(y.q));

  const used = new Set<string>();
  let letter = 0;
  const metaById = new Map(metas.map(m => [m.id, m]));
  for (const p of pairs) {
    if (trace.length >= budget) break;
    if (used.has(p.a) || used.has(p.b)) continue;
    const gid = String.fromCharCode(65 + letter);
    const members = [p.a, p.b];
    // Intenta extender a TRISERIE (solo hipertrofia, si claramente mejora y son aislamientos).
    if (ctx.trainingGoal !== 'fuerza') {
      const third = metas.find(m => !used.has(m.id) && m.id !== p.a && m.id !== p.b
        && evaluateTriset([metaById.get(p.a)!, metaById.get(p.b)!, m], ctx).quality === 'beneficial');
      if (third) members.push(third.id);
    }
    for (const id of members) { groups[id] = gid; used.add(id); }
    const ev = members.length === 3
      ? evaluateTriset(members.map(id => metaById.get(id)!), ctx)
      : { quality: p.q, reasons: p.reasons };
    trace.push({ ids: members, type: members.length === 3 ? 'complementary' : p.type, quality: ev.quality as SupersetQuality, reasons: ev.reasons });
    letter++;
  }
  return { groups, trace };
}
