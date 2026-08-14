// ─────────────────────────────────────────────────────────────────────────
// fatigueBudget — Fase 5B · PRESUPUESTO DE FATIGA SISTÉMICA DE LA SESIÓN.
//
// Una buena sesión no se evalúa ejercicio por ejercicio: también debe tener sentido COMO
// CONJUNTO. movementPattern DISTINTO ≠ fatiga compatible (squat + peso muerto + búlgara +
// prensa cubren patrones distintos pero apilan demasiada fatiga sistémica).
//
// Reutiliza la MISMA semántica de rol+patrón que el motor de superseries (roleOf/movementPatternOf,
// fatigueDemand). La "fatiga SISTÉMICA de sesión" es una VISTA agregada: los aislamientos son coste
// LOCAL (recuperable) → 0 sistémico; los compuestos pesados de tren inferior/hinge cuestan más que
// un press. NO es un modelo fisiológico exacto ni un SFR ranking — solo evita apilar compuestos duros.
// ─────────────────────────────────────────────────────────────────────────
import type { Exercise, TrainingGoal } from '../types';
import type { Phase } from './sessionPrescription';
import { roleOf, type ExerciseRole } from './exerciseRole';
import { movementPatternOf, type MovementPattern } from './movementPattern';
import { HEAVY_COMPOUND } from './exerciseOrder';
import { bestCandidate, qualityScore } from './exerciseQuality';
import { regionsOfPattern } from './regionalCoverage';

// Patrones SISTÉMICAMENTE caros (tren inferior compuesto / cuerpo entero): más coste global.
const HEAVY_SYSTEMIC = /squat|hinge|lunge|full-body/;

/** FATIGA SISTÉMICA de un ejercicio (coste global, no local). Aislamiento = 0 (local/recuperable);
 *  compuesto de tren inferior/hinge = alto; press/tracción de tren superior = medio. Discreta y
 *  explicable, derivada del MISMO rol+patrón que usa el motor de superseries. */
export function systemicFatigue(role: ExerciseRole, pattern: MovementPattern | null): number {
  if (role === 'isolation' || role === 'conditioning') return 0;   // coste LOCAL, no sistémico
  const heavy = !!pattern && HEAVY_SYSTEMIC.test(pattern);
  if (role === 'main') return heavy ? 4 : 2;                        // squat/DL 4 · bench/OHP/row 2
  return heavy ? 3 : 1;                                             // secondary: búlgara/prensa 3 · dips 1
}

/** Conveniencia: fatiga sistémica directa desde el ejercicio. */
export function exerciseFatigue(ex: Pick<Exercise, 'id' | 'name' | 'type' | 'muscleGroup' | 'isYoga'>): number {
  return systemicFatigue(roleOf(ex, HEAVY_COMPOUND), movementPatternOf(ex));
}

/** Fatiga sistémica TOTAL de una lista de ejercicios. */
export function sessionFatigue(exerciseIds: string[], bankById: Map<string, Exercise>): number {
  return exerciseIds.reduce((a, id) => { const ex = bankById.get(id); return a + (ex ? exerciseFatigue(ex) : 0); }, 0);
}

export interface FatigueContext {
  trainingGoal: TrainingGoal;
  level?: 'principiante' | 'intermedio' | 'avanzado' | string;
  timeMinutes: number;
  readinessLow?: boolean;
  phase: Phase;
}

// Presupuesto BASE (puntos de fatiga sistémica) por objetivo × nivel. FUERZA más estricta (cada
// main recibe más intensidad → menos compuestos apilados). AVANZADO tolera algo más, NO infinito.
const BASE_BUDGET: Record<TrainingGoal, Record<string, number>> = {
  hipertrofia: { principiante: 8, intermedio: 10, avanzado: 12 },
  fuerza:      { principiante: 7, intermedio: 8, avanzado: 10 },
};

/** Presupuesto de fatiga sistémica CONTEXTUAL. 90 min NO lo expande (el tiempo da descanso/calidad,
 *  no compuestos ilimitados). Deload/readiness/intensificación lo reducen; 30 min lo baja algo. */
export function fatigueBudget(ctx: FatigueContext): number {
  const lvl = ctx.level === 'principiante' || ctx.level === 'avanzado' ? ctx.level : 'intermedio';
  let b = BASE_BUDGET[ctx.trainingGoal][lvl];
  if (ctx.phase === 'intensificacion') b *= 0.85;   // protege el main, menos fatiga accesoria
  if (ctx.phase === 'deload') b *= 0.5;              // deload: mínimo
  if (ctx.readinessLow) b *= 0.75;                   // mal día → menos
  if (ctx.timeMinutes <= 35) b *= 0.8;              // 30 min: el tiempo ya limita
  return Math.max(4, Math.round(b));                 // piso: al menos 1 main + accesorios
}

/** ¿Cabe añadir `candidate` sin exceder el presupuesto? (API pura para tests/selección.) */
export function canAddExercise(currentIds: string[], candidate: Exercise, bankById: Map<string, Exercise>, ctx: FatigueContext): boolean {
  return sessionFatigue(currentIds, bankById) + exerciseFatigue(candidate) <= fatigueBudget(ctx);
}

/**
 * Aplica el PRESUPUESTO de fatiga a una sesión ya seleccionada (determinista, post-IA). Mientras la
 * fatiga total exceda el budget, toma el compuesto NO-anchor más demandante y:
 *  (1) lo REEMPLAZA por un candidato del MISMO músculo con MENOS fatiga (preserva volumen §24), o
 *  (2) si no hay alternativa, lo ELIMINA (slot opcional) — salvo que cubra un patrón REQUERIDO sin
 *      sustituto (ahí se conserva la cobertura). El ANCHOR NUNCA se elimina (§8/§28).
 */
export function applyFatigueBudget<T extends { id: string }>(input: {
  exercises: T[];
  anchorIds: string[];
  requiredPatterns: MovementPattern[];
  candidates: Exercise[];        // pool válido (gear/pain/nivel ya filtrados)
  bankById: Map<string, Exercise>;
  ctx: FatigueContext;
  makeItem: (id: string) => T | null;
}): { exercises: T[]; fixes: string[]; total: number; budget: number; replaced: number; dropped: number } {
  const { anchorIds, requiredPatterns, candidates, bankById, ctx, makeItem } = input;
  const budget = fatigueBudget(ctx);
  const anchors = new Set(anchorIds);
  const fatOf = (id: string) => { const ex = bankById.get(id); return ex ? exerciseFatigue(ex) : 0; };
  const patOf = (id: string) => { const ex = bankById.get(id); return ex ? movementPatternOf(ex) : null; };
  let cur = [...input.exercises];
  const fixes: string[] = [];
  let replaced = 0, dropped = 0;
  const total = () => cur.reduce((a, e) => a + fatOf(e.id), 0);

  let guard = 0;
  while (total() > budget && guard++ < 24) {
    // Compuesto NO-anchor con MÁS fatiga sistémica (>0).
    let idx = -1, worst = 0;
    for (let i = 0; i < cur.length; i++) {
      const f = fatOf(cur[i].id);
      if (!anchors.has(cur[i].id) && f > worst) { worst = f; idx = i; }
    }
    if (idx < 0) break; // solo quedan anchors + aislamientos → no se puede bajar más
    const exId = cur[idx].id;
    const muscle = bankById.get(exId)?.muscleGroup;
    const present = new Set(cur.map(e => e.id));
    // (1) reemplazo por la MEJOR alternativa (Fase 5C) del MISMO músculo con MENOS fatiga (misma
    // dosis, menos coste). Ranking de calidad → no un jump-squat/sissy, sino la opción más estable.
    const lowerFat = candidates.filter(c => !present.has(c.id) && c.muscleGroup === muscle && exerciseFatigue(c) < worst);
    const alt = bestCandidate(lowerFat, ctx);
    // Solo reemplaza si la alternativa NO es de calidad "fallback" (§9/§18): no metemos un jump-squat
    // o sissy como sustituto — si solo queda basura, se elimina el slot opcional (abajo).
    if (alt && qualityScore(alt, ctx) >= 0) {
      const item = makeItem(alt.id);
      if (item) { cur[idx] = item; replaced++; fixes.push(`fatiga: ${exId}(${worst}) → ${alt.id}(${exerciseFatigue(alt)}) — menos sistémico, ${muscle}`); continue; }
    }
    // (2) eliminar si es opcional (su patrón está cubierto por otro, o no es requerido).
    const pat = patOf(exId);
    const coveredElsewhere = cur.some((e, i) => i !== idx && patOf(e.id) === pat);
    if (pat && requiredPatterns.includes(pat) && !coveredElsewhere) break; // cobertura esencial → no tocar
    cur = cur.filter((_, i) => i !== idx);
    dropped++; fixes.push(`fatiga: ${exId} eliminado (presupuesto ${budget} excedido; slot opcional)`);
  }

  // ── FASE 7 · ALIVIO DE ANCLAS (beginner/short full-body/lower) ─────────────
  // Si el presupuesto SIGUE excedido y el exceso viene de anclas inamovibles (p.ej. squat+peso
  // muerto pesados con budget pequeño), se cubre el SEGUNDO patrón requerido con una alternativa de
  // MENOR coste que mantiene la MISMA FUNCIÓN (región), protegiendo SIEMPRE ≥1 main (el lift
  // principal). FUERZA conserva compuesto (especificidad manda, no puro aislamiento). Si no hay
  // alternativa razonable, se acepta una excepción MÍNIMA y EXPLICABLE (los anchors SON la cobertura
  // obligatoria). Solo se dispara en el caso raro que el bucle normal no pudo resolver → sin regresión.
  if (total() > budget) {
    const roleOfId = (id: string) => { const ex = bankById.get(id); return ex ? roleOf(ex, HEAVY_COMPOUND) : 'isolation'; };
    const mainAnchorsInOrder = anchorIds.filter(id => cur.some(e => e.id === id) && roleOfId(id) === 'main');
    const protectedMain = mainAnchorsInOrder[0];   // el lift principal se protege siempre
    const regionsOf = (id: string) => { const p = patOf(id); return p ? regionsOfPattern(p) : []; };
    let g2 = 0;
    while (total() > budget && g2++ < 6) {
      // ancla más sistémica que NO sea el main protegido.
      let idx = -1, worst = 0;
      for (let i = 0; i < cur.length; i++) {
        const id = cur[i].id;
        if (anchors.has(id) && id !== protectedMain) { const f = fatOf(id); if (f > worst) { worst = f; idx = i; } }
      }
      if (idx < 0) break;
      const exId = cur[idx].id;
      const muscle = bankById.get(exId)?.muscleGroup;
      const regions = regionsOf(exId);
      const present = new Set(cur.map(e => e.id));
      const wantCompound = ctx.trainingGoal === 'fuerza';   // fuerza: sin puro aislamiento (§Fix3)
      // Alternativa: MISMA función (mismo patrón, o misma región, o mismo músculo) con MENOS fatiga,
      // calidad ≥ acceptable, ranking 5C. Fuerza exige compuesto.
      const alts = candidates.filter(c => {
        if (present.has(c.id) || exerciseFatigue(c) >= worst) return false;
        if (wantCompound && roleOf(c, HEAVY_COMPOUND) === 'isolation') return false;
        const p = movementPatternOf(c);
        const sameFn = p === patOf(exId) || c.muscleGroup === muscle
          || (!!p && regionsOfPattern(p).some(r => regions.includes(r)));
        return sameFn;
      });
      const alt = bestCandidate(alts, ctx);
      if (alt && qualityScore(alt, ctx) >= 0) {
        const item = makeItem(alt.id);
        if (item) {
          cur[idx] = item; anchors.delete(exId); replaced++;
          fixes.push(`fatiga(alivio de ancla): ${exId}(${worst}) → ${alt.id}(${exerciseFatigue(alt)}) — misma función, menos sistémico (${muscle})`);
          continue;
        }
      }
      break;   // sin alternativa que mantenga la función → excepción explicable
    }
    if (total() > budget) {
      fixes.push(`fatiga: excepción de cobertura — las anclas obligatorias suman ${total()} > presupuesto ${budget}; sin alternativa de menor coste que mantenga la función, se prioriza la cobertura/objetivo (main protegido).`);
    }
  }

  return { exercises: cur, fixes, total: total(), budget, replaced, dropped };
}
