// ─────────────────────────────────────────────────────────────────────────
// blockAnchors — Fase 2 · CONTINUIDAD DE MOVIMIENTOS ANCLA.
//
// Un ANCHOR es un movimiento de referencia del mesociclo: uno de los que estamos
// intentando mejorar en este bloque. NO es "ejercicio eterno" — es CONTINUIDAD PARA
// PODER PROGRESAR: si el mismo id vuelve cada sesión compatible, lastExercisePerformance
// + P2 lo progresan de verdad (no hay first-time reset cada semana).
//
// Este módulo es PURO y determinista (cero React/store). Decide, dado el bloque + día +
// candidatos válidos, qué anchors usar; los reutiliza si siguen siendo válidos, los
// reemplaza con motivo si no, y registra la referencia mínima persistente.
//
// NO incluye: motor de superseries, slots por patrón, movementPattern, SFR score. Usa la
// taxonomía real existente (categorize → main-compound / secondary-compound / isolation).
// ─────────────────────────────────────────────────────────────────────────
import type { Exercise, TrainingGoal } from '../types';
import { categorize } from './sessionPrescription';
import type { CompletedSession } from '../types';

/** Referencia mínima persistente de un anchor. Solo lo que NO se puede derivar con fiabilidad. */
export interface BlockAnchor {
  blockId: string;          // mesociclo/bloque (frontera = deload)
  dayType: string;          // scope: a qué tipo de día pertenece (upper/lower/full-body/push/...)
  exerciseId: string;       // el movimiento ancla
  trainingGoal: TrainingGoal;
  selectedAt: string;       // YYYY-MM-DD
  reason?: string;          // por qué se eligió/reemplazó (para el trace)
}

export type AnchorStatus = 'reused' | 'new' | 'replaced';
export interface AnchorTraceItem {
  exerciseId: string;
  status: AnchorStatus;
  from?: string;            // id anterior (en reemplazo)
  reason?: string;
  dayType: string;
}

/**
 * ID del BLOQUE actual: frontera = deload. Todas las sesiones tras el último deload
 * pertenecen al mismo bloque; cuando se completa un deload, empieza un bloque nuevo.
 * Derivable del historial → no se persiste aparte.
 */
export function currentBlockId(completedSessions: CompletedSession[]): string {
  const deloadDates = completedSessions.filter(s => s.isDeload).map(s => s.date).sort();
  return deloadDates.length ? `blk-${deloadDates[deloadDates.length - 1]}` : 'blk-0';
}

/** Cuántos anchors (pocas referencias estables) según la estructura del día. */
export function anchorCountForDayType(dayType: string): number {
  switch (dayType) {
    case 'full-body': return 3;
    case 'upper':
    case 'lower': return 2;
    case 'push':
    case 'pull':
    case 'legs': return 2;
    default: return 2;
  }
}

/** ¿Puede este ejercicio ser anchor? Nunca un aislamiento. Fuerza y también hipertrofia
 *  usan compuestos (main o secondary); la PREFERENCIA por main la aplica `selectAnchors`. */
export function isAnchorEligible(ex: Pick<Exercise, 'id' | 'name' | 'type'>, _trainingGoal: TrainingGoal): boolean {
  const cat = categorize(ex);
  return cat === 'main-compound' || cat === 'secondary-compound';
}

/**
 * Elige hasta `count` anchors de un pool YA ORDENADO por el motor (orderByChallenge, etc.).
 * Preferencia por main-compound (en fuerza es fuerte; en hipertrofia también, pero admite
 * secondary si no hay main). Respeta el ranking del motor dentro de cada categoría.
 */
export function selectAnchors(
  candidatesOrdered: Exercise[],
  trainingGoal: TrainingGoal,
  count: number,
  exclude: Set<string> = new Set(),
): string[] {
  const eligible = candidatesOrdered.filter(e => !exclude.has(e.id) && isAnchorEligible(e, trainingGoal));
  const mains = eligible.filter(e => categorize(e) === 'main-compound').map(e => e.id);
  const secs = eligible.filter(e => categorize(e) === 'secondary-compound').map(e => e.id);
  return [...mains, ...secs].slice(0, Math.max(0, count));
}

/** Anchors del bloque MÁS RECIENTE anterior (para continuidad ENTRE bloques). */
function latestPreviousBlockAnchors(stored: BlockAnchor[], blockId: string, dayType: string, trainingGoal: TrainingGoal): BlockAnchor[] {
  const others = stored.filter(a => a.blockId !== blockId && a.dayType === dayType && a.trainingGoal === trainingGoal);
  if (!others.length) return [];
  const sortedBlocks = others.map(a => a.blockId).sort();
  const latestBlock = sortedBlocks[sortedBlocks.length - 1];
  return others.filter(a => a.blockId === latestBlock);
}

/**
 * Resuelve los anchors de ESTA sesión. Contrato:
 *  - Reutiliza los anchors del bloque+día si siguen siendo USABLES (reproducibles con el gear
 *    actual y seguros para las restricciones de hoy — `isUsable`) y siguen en el banco.
 *  - Reemplaza con MOTIVO un anchor inusable por un sustituto válido del pool.
 *  - Primera exposición del bloque/día: hereda del bloque anterior si sigue válido (continuidad
 *    entre bloques); si no, elige nuevos del ranking del motor.
 *  - Nunca rompe: si no hay sustituto, deja menos anchors (jamás reintroduce equipo inexistente).
 */
export function resolveBlockAnchors(input: {
  stored: BlockAnchor[];
  blockId: string;
  dayType: string;
  trainingGoal: TrainingGoal;
  candidates: Exercise[];                 // pool VÁLIDO (ya filtrado por gear/pain/lowImpact/goal)
  isUsable: (exerciseId: string) => boolean; // reproducible con gear + seguro HOY
  today: string;
  // Fase 5D · elección de anchors NUEVOS. Por defecto = ranking del motor (selectAnchors). Full-body
  // pasa un selector que reparte las anclas entre regiones complementarias (no todas upper/lower).
  selectFresh?: (candidates: Exercise[], trainingGoal: TrainingGoal, count: number, exclude: Set<string>) => string[];
}): { anchorIds: string[]; anchors: BlockAnchor[]; trace: AnchorTraceItem[] } {
  const { stored, blockId, dayType, trainingGoal, candidates, isUsable, today } = input;
  const selectFresh = input.selectFresh ?? selectAnchors;
  const count = anchorCountForDayType(dayType);
  const inBank = new Set(candidates.map(e => e.id));
  const trace: AnchorTraceItem[] = [];
  const anchorIds: string[] = [];
  const used = new Set<string>();
  // Conserva anchors de OTROS bloques/días/goals sin tocar; reconstruye los de este scope.
  const kept = stored.filter(a => !(a.blockId === blockId && a.dayType === dayType && a.trainingGoal === trainingGoal));
  const nextAnchors: BlockAnchor[] = [...kept];

  const prior = stored.filter(a => a.blockId === blockId && a.dayType === dayType && a.trainingGoal === trainingGoal);
  // Semilla: los de este bloque si existen; si no, hereda del bloque anterior (continuidad entre bloques).
  const seed = prior.length ? prior : latestPreviousBlockAnchors(stored, blockId, dayType, trainingGoal);
  const isFreshBlock = prior.length === 0;

  for (const a of seed) {
    if (used.has(a.exerciseId)) continue;
    if (isUsable(a.exerciseId) && inBank.has(a.exerciseId)) {
      // REUTILIZAR (dentro del bloque o heredado del anterior → sigue siendo el mismo id que progresa).
      anchorIds.push(a.exerciseId); used.add(a.exerciseId);
      nextAnchors.push({ blockId, dayType, exerciseId: a.exerciseId, trainingGoal,
        selectedAt: isFreshBlock ? today : a.selectedAt,
        reason: isFreshBlock ? 'continuidad entre bloques' : a.reason });
      trace.push({ exerciseId: a.exerciseId, status: 'reused', dayType, reason: isFreshBlock ? 'continuidad entre bloques' : undefined });
    } else {
      // REEMPLAZAR con motivo: sustituto válido (ranking del motor, o región complementaria en full-body).
      const sub = selectFresh(candidates, trainingGoal, 1, used)[0];
      if (sub) {
        const reason = !isUsable(a.exerciseId)
          ? 'anchor no reproducible/seguro con el contexto actual (gear/dolor/lowImpact)'
          : 'anchor no disponible en el banco';
        anchorIds.push(sub); used.add(sub);
        nextAnchors.push({ blockId, dayType, exerciseId: sub, trainingGoal, selectedAt: today, reason });
        trace.push({ exerciseId: sub, status: 'replaced', from: a.exerciseId, reason, dayType });
      }
      // sin sustituto → se omite (fallback: menos anchors, nunca romper)
    }
  }

  // Completar hasta `count` con NUEVOS del ranking (primera vez, o si el reemplazo dejó huecos).
  if (anchorIds.length < count) {
    const fresh = selectFresh(candidates, trainingGoal, count - anchorIds.length, used);
    for (const id of fresh) {
      used.add(id);
      anchorIds.push(id);
      nextAnchors.push({ blockId, dayType, exerciseId: id, trainingGoal, selectedAt: today, reason: 'anchor inicial del bloque' });
      trace.push({ exerciseId: id, status: 'new', dayType });
    }
  }

  return { anchorIds, anchors: nextAnchors, trace };
}

/**
 * Garantiza (determinista) que los anchors requeridos ESTÁN en el workout. Si la IA los omitió,
 * los inyecta al FRENTE (el reorden por fases los deja temprano igual) y recorta accesorios del
 * final para respetar `targetCount`. Reutilizable sobre cualquier lista con {id}.
 */
export function enforceAnchors<T extends { id: string }>(
  exercises: T[],
  anchorIds: string[],
  makeItem: (id: string) => T | null,
  targetCount: number,
): { exercises: T[]; injected: string[] } {
  const present = new Set(exercises.map(e => e.id));
  const missing = anchorIds.filter(id => !present.has(id));
  if (!missing.length) return { exercises, injected: [] };

  const injectedItems = missing.map(makeItem).filter((x): x is T => x != null);
  if (!injectedItems.length) return { exercises, injected: [] };
  let out: T[] = [...injectedItems, ...exercises];

  // Recorta desde el FINAL los NO-anchor hasta respetar el presupuesto (nunca quita un anchor).
  const anchorSet = new Set(anchorIds);
  const cap = Math.max(targetCount, anchorIds.length);
  while (out.length > cap) {
    let removed = false;
    for (let i = out.length - 1; i >= 0; i--) {
      if (!anchorSet.has(out[i].id)) { out.splice(i, 1); removed = true; break; }
    }
    if (!removed) break; // solo quedan anchors → no recortar más
  }
  return { exercises: out, injected: missing.map(x => x) };
}
