import { describe, it, expect } from 'vitest';
import {
  currentBlockId, anchorCountForDayType, isAnchorEligible, selectAnchors,
  resolveBlockAnchors, enforceAnchors, type BlockAnchor,
} from '../blockAnchors';
import { repairWorkoutStructure } from '../exerciseOrder';
import { trainingGoalFromPlan, resolveTrainingGoal, buildConfigHash } from '../workoutPlanner';
import type { Exercise, CompletedSession, TrainingGoal } from '../../types';

// ─────────────────────────────────────────────────────────────────────────
// FASE 2 · BLOCK ANCHORS + activación de trainingGoal.
// Continuidad de movimientos principales durante el mesociclo, sin novelty.
// ─────────────────────────────────────────────────────────────────────────

const ex = (id: string, name: string, type: string): Exercise =>
  ({ id, name, type, muscleGroup: 'cuadriceps', defaultSets: 3, defaultReps: '8', defaultRest: 90 } as unknown as Exercise);

// Pool ordenado (como lo entrega el motor): mains primero, luego secondary/isolation.
const POOL = (): Exercise[] => [
  ex('sentadilla-barra', 'Sentadilla con Barra', 'compuesto'),   // main
  ex('press-banca', 'Press de Banca', 'compuesto'),              // main
  ex('peso-muerto', 'Peso Muerto', 'compuesto'),                 // main
  ex('prensa', 'Prensa', 'compuesto'),                           // secondary
  ex('extension-cuad', 'Extensión', 'aislamiento'),              // isolation
  ex('curl-biceps', 'Curl', 'aislamiento'),                      // isolation
];
const today = '2026-02-01';
const usableAll = (pool: Exercise[]) => { const s = new Set(pool.map(e => e.id)); return (id: string) => s.has(id); };

describe('anchors · helpers', () => {
  it('currentBlockId: frontera = deload', () => {
    expect(currentBlockId([])).toBe('blk-0');
    const sessions = [
      { date: '2026-01-10', isDeload: false }, { date: '2026-01-20', isDeload: true },
    ] as unknown as CompletedSession[];
    expect(currentBlockId(sessions)).toBe('blk-2026-01-20');
  });
  it('anchorCountForDayType: pocas referencias estables', () => {
    expect(anchorCountForDayType('full-body')).toBe(3);
    expect(anchorCountForDayType('upper')).toBe(2);
    expect(anchorCountForDayType('lower')).toBe(2);
    expect(anchorCountForDayType('push')).toBe(2);
  });
  it('isAnchorEligible: nunca un aislamiento', () => {
    expect(isAnchorEligible(ex('sentadilla-barra', 'Sentadilla con Barra', 'compuesto'), 'fuerza')).toBe(true);
    expect(isAnchorEligible(ex('prensa', 'Prensa', 'compuesto'), 'hipertrofia')).toBe(true);
    expect(isAnchorEligible(ex('curl-biceps', 'Curl', 'aislamiento'), 'fuerza')).toBe(false);
  });
  it('selectAnchors: main-compound primero, respeta el ranking del motor', () => {
    const ids = selectAnchors(POOL(), 'fuerza', 2);
    expect(ids).toEqual(['sentadilla-barra', 'press-banca']); // los 2 primeros mains del ranking
  });
});

// ── Ciclo de vida del anchor a lo largo del bloque ──────────────────────
describe('anchors · creación / reutilización / continuidad', () => {
  const resolve = (stored: BlockAnchor[], pool: Exercise[], tg: TrainingGoal = 'fuerza', blockId = 'blk-0') =>
    resolveBlockAnchors({ stored, blockId, dayType: 'upper', trainingGoal: tg, candidates: pool, isUsable: usableAll(pool), today });

  it('semana 1: se CREAN anchors (status new)', () => {
    const r = resolve([], POOL());
    expect(r.anchorIds).toEqual(['sentadilla-barra', 'press-banca']);
    expect(r.trace.every(t => t.status === 'new')).toBe(true);
    expect(r.anchors).toHaveLength(2);
  });

  it('semanas 2-3-4: se REUTILIZAN los mismos ids (continuidad, no novelty)', () => {
    let stored = resolve([], POOL()).anchors;
    for (let wk = 2; wk <= 4; wk++) {
      const r = resolve(stored, POOL());
      expect(r.anchorIds).toEqual(['sentadilla-barra', 'press-banca']);
      expect(r.trace.every(t => t.status === 'reused')).toBe(true);
      stored = r.anchors;
    }
  });

  it('mantiene P2: el id del anchor es ESTABLE → lastExercisePerformance progresa', () => {
    // (la estabilidad del id es lo que evita el first-time reset; aquí se blinda la estabilidad)
    let stored = resolve([], POOL()).anchors;
    const ids0 = resolve(stored, POOL()).anchorIds;
    stored = resolve(stored, POOL()).anchors;
    const ids1 = resolve(stored, POOL()).anchorIds;
    expect(ids1).toEqual(ids0);
  });

  it('fuerza (alta continuidad) e hipertrofia (continuidad) reutilizan', () => {
    for (const tg of ['fuerza', 'hipertrofia'] as TrainingGoal[]) {
      const stored = resolve([], POOL(), tg).anchors;
      const r = resolve(stored, POOL(), tg);
      expect(r.trace.every(t => t.status === 'reused')).toBe(true);
    }
  });

  it('nuevo mesociclo: MANTIENE el anchor si sigue válido (continuidad entre bloques)', () => {
    const b1 = resolve([], POOL(), 'fuerza', 'blk-0').anchors;
    // bloque nuevo (blk-1): no hay prior de este bloque → hereda del anterior
    const r = resolveBlockAnchors({ stored: b1, blockId: 'blk-1', dayType: 'upper', trainingGoal: 'fuerza', candidates: POOL(), isUsable: usableAll(POOL()), today });
    expect(r.anchorIds).toEqual(['sentadilla-barra', 'press-banca']);
    expect(r.trace.every(t => t.status === 'reused')).toBe(true);
    expect(r.trace[0].reason).toMatch(/continuidad entre bloques/);
  });
});

// ── Reemplazo con motivo (gear / pain / lowImpact / no disponible) ──────
describe('anchors · reemplazo SOLO con motivo válido', () => {
  it('gear cambió: el anchor ya no es reproducible → REEMPLAZO con sustituto válido', () => {
    const stored = resolveBlockAnchors({ stored: [], blockId: 'blk-0', dayType: 'upper', trainingGoal: 'fuerza', candidates: POOL(), isUsable: usableAll(POOL()), today }).anchors;
    // nuevo gear: sentadilla-barra ya no está en el pool (solo mancuernas)
    const dbPool = POOL().filter(e => e.id !== 'sentadilla-barra');
    const r = resolveBlockAnchors({ stored, blockId: 'blk-0', dayType: 'upper', trainingGoal: 'fuerza', candidates: dbPool, isUsable: usableAll(dbPool), today });
    const replaced = r.trace.find(t => t.status === 'replaced');
    expect(replaced?.from).toBe('sentadilla-barra');
    expect(r.anchorIds).not.toContain('sentadilla-barra');   // no revive equipo inexistente
    expect(r.anchorIds).toContain('press-banca');            // el válido sigue
  });

  it('pain/lowImpact filtró el anchor del pool → REEMPLAZO', () => {
    const stored = resolveBlockAnchors({ stored: [], blockId: 'blk-0', dayType: 'upper', trainingGoal: 'fuerza', candidates: POOL(), isUsable: usableAll(POOL()), today }).anchors;
    // dolor de rodilla → sentadilla y peso muerto fuera; press-banca queda
    const safePool = POOL().filter(e => !['sentadilla-barra', 'peso-muerto'].includes(e.id));
    const r = resolveBlockAnchors({ stored, blockId: 'blk-0', dayType: 'upper', trainingGoal: 'fuerza', candidates: safePool, isUsable: usableAll(safePool), today });
    expect(r.anchorIds).not.toContain('sentadilla-barra');
    expect(r.trace.some(t => t.status === 'replaced')).toBe(true);
  });

  it('sin sustituto válido → menos anchors, NUNCA rompe (fallback)', () => {
    const stored = resolveBlockAnchors({ stored: [], blockId: 'blk-0', dayType: 'upper', trainingGoal: 'fuerza', candidates: POOL(), isUsable: usableAll(POOL()), today }).anchors;
    const onlyIso = POOL().filter(e => e.type === 'aislamiento'); // no hay compuesto sustituto
    const r = resolveBlockAnchors({ stored, blockId: 'blk-0', dayType: 'upper', trainingGoal: 'fuerza', candidates: onlyIso, isUsable: usableAll(onlyIso), today });
    expect(r.anchorIds).toEqual([]); // ninguno elegible, pero no lanza
  });
});

// ── Garantía de aparición + orden + superserie ──────────────────────────
describe('anchors · garantía determinista de aparición y orden', () => {
  it('IA omite el anchor → enforceAnchors lo INYECTA', () => {
    const workout = [{ id: 'curl-biceps', sets: 3 }, { id: 'extension-cuad', sets: 3 }];
    const r = enforceAnchors(workout, ['sentadilla-barra'], (id) => ({ id, sets: 3 }), 3);
    expect(r.injected).toContain('sentadilla-barra');
    expect(r.exercises.some(e => e.id === 'sentadilla-barra')).toBe(true);
    expect(r.exercises).toHaveLength(3); // respeta el presupuesto (recorta un accesorio)
  });

  it('el anchor va TEMPRANO tras la reparación estructural (compuesto primero)', () => {
    const bank = POOL();
    const workout = [{ id: 'curl-biceps', sets: 3 }, { id: 'sentadilla-barra', sets: 4 }];
    const rep = repairWorkoutStructure(workout, bank, { trainingGoal: 'fuerza' });
    expect(rep.exercises[0].id).toBe('sentadilla-barra'); // el anchor main compound, primero
  });

  it('un anchor de FUERZA no queda dentro de una superserie', () => {
    const bank = POOL();
    const workout = [{ id: 'sentadilla-barra', group: 'A', sets: 4 }, { id: 'curl-biceps', group: 'A', sets: 3 }];
    const rep = repairWorkoutStructure(workout, bank, { hasWeights: true, trainingGoal: 'fuerza' });
    expect(rep.exercises.find(e => e.id === 'sentadilla-barra')!.group).toBeUndefined();
  });
});

// ── Reload / legacy ─────────────────────────────────────────────────────
describe('anchors · persistencia y legacy', () => {
  it('reload: dado el mismo stored, resuelve los MISMOS anchors (idempotente)', () => {
    const stored = resolveBlockAnchors({ stored: [], blockId: 'blk-0', dayType: 'upper', trainingGoal: 'fuerza', candidates: POOL(), isUsable: usableAll(POOL()), today }).anchors;
    const a = resolveBlockAnchors({ stored, blockId: 'blk-0', dayType: 'upper', trainingGoal: 'fuerza', candidates: POOL(), isUsable: usableAll(POOL()), today }).anchorIds;
    const b = resolveBlockAnchors({ stored, blockId: 'blk-0', dayType: 'upper', trainingGoal: 'fuerza', candidates: POOL(), isUsable: usableAll(POOL()), today }).anchorIds;
    expect(a).toEqual(b);
  });
  it('usuario legacy sin anchors → genera bien (crea nuevos, no rompe)', () => {
    const r = resolveBlockAnchors({ stored: [], blockId: 'blk-0', dayType: 'full-body', trainingGoal: 'hipertrofia', candidates: POOL(), isUsable: usableAll(POOL()), today });
    expect(r.anchorIds.length).toBeGreaterThan(0);
  });
});

// ── trainingGoal en producción (activación) ─────────────────────────────
describe('trainingGoal · activación en UI (restore/persist/cache)', () => {
  it('legacy sin trainingGoal → hipertrofia', () => {
    expect(resolveTrainingGoal({})).toBe('hipertrofia');
    expect(trainingGoalFromPlan(null)).toBeNull();
    expect(trainingGoalFromPlan({})).toBeNull();
  });
  it('seleccionar fuerza persiste y se restaura del plan sellado', () => {
    expect(trainingGoalFromPlan({ userTrainingGoal: 'fuerza' })).toBe('fuerza');
    expect(trainingGoalFromPlan({ userTrainingGoal: 'hipertrofia' })).toBe('hipertrofia');
    expect(trainingGoalFromPlan({ userTrainingGoal: 'basura' })).toBeNull(); // valor inválido → default
  });
  it('cambiar trainingGoal invalida la cache', () => {
    const base = { duration: 60, equipment: 'gym', goal: 'hipertrofia', dayType: 'upper', modality: 'fuerza', objective: 'x', schemaVersion: 1 };
    expect(buildConfigHash({ ...base, trainingGoal: 'hipertrofia' }))
      .not.toBe(buildConfigHash({ ...base, trainingGoal: 'fuerza' }));
  });
});

// ── SIMULACIÓN LONGITUDINAL ─────────────────────────────────────────────
describe('LONGITUDINAL · 12 semanas, first-time resets ≈ 0 salvo reemplazo legítimo', () => {
  function runBlock(opts: {
    weeks: number; dayType: string; trainingGoal: TrainingGoal;
    poolAt: (w: number) => Exercise[]; blockAt: (w: number) => string;
  }) {
    let stored: BlockAnchor[] = [];
    const log: Array<{ week: number; ids: string[]; replaced: number; newCount: number }> = [];
    for (let w = 0; w < opts.weeks; w++) {
      const pool = opts.poolAt(w);
      const r = resolveBlockAnchors({
        stored, blockId: opts.blockAt(w), dayType: opts.dayType, trainingGoal: opts.trainingGoal,
        candidates: pool, isUsable: usableAll(pool), today: `2026-03-${String(w + 1).padStart(2, '0')}`,
      });
      stored = r.anchors;
      log.push({ week: w, ids: r.anchorIds, replaced: r.trace.filter(t => t.status === 'replaced').length, newCount: r.trace.filter(t => t.status === 'new').length });
    }
    return log;
  }

  it('A · fuerza upper 12 sem estable: 1 selección inicial, 0 reemplazos, ids constantes', () => {
    const log = runBlock({ weeks: 12, dayType: 'upper', trainingGoal: 'fuerza', poolAt: () => POOL(), blockAt: () => 'blk-0' });
    expect(log[0].newCount).toBe(2);                       // semana 1 crea
    expect(log.slice(1).every(l => l.newCount === 0)).toBe(true);   // nunca re-crea (no first-time reset)
    expect(log.every(l => l.replaced === 0)).toBe(true);           // 0 reemplazos sin evento
    expect(log.every(l => JSON.stringify(l.ids) === JSON.stringify(log[0].ids))).toBe(true); // ids constantes
  });

  it('B · hipertrofia upper 12 sem: también estable', () => {
    const log = runBlock({ weeks: 12, dayType: 'upper', trainingGoal: 'hipertrofia', poolAt: () => POOL(), blockAt: () => 'blk-0' });
    expect(log.slice(1).every(l => l.newCount === 0 && l.replaced === 0)).toBe(true);
  });

  it('D · gear cambia en semana 5 → exactamente 1 reemplazo, luego estable de nuevo', () => {
    const log = runBlock({
      weeks: 12, dayType: 'lower', trainingGoal: 'fuerza', blockAt: () => 'blk-0',
      poolAt: (w) => w >= 4 ? POOL().filter(e => e.id !== 'sentadilla-barra') : POOL(),
    });
    const totalReplacements = log.reduce((a, l) => a + l.replaced, 0);
    expect(totalReplacements).toBe(1);                    // solo cuando el gear cambió
    expect(log[4].replaced).toBe(1);
    expect(log.slice(5).every(l => l.replaced === 0)).toBe(true); // el sustituto persiste
  });

  it('F · deload + nuevo bloque: el anchor se mantiene entre bloques si sigue válido', () => {
    const log = runBlock({
      weeks: 8, dayType: 'upper', trainingGoal: 'fuerza',
      poolAt: () => POOL(), blockAt: (w) => w < 4 ? 'blk-0' : 'blk-1', // nuevo bloque a partir de sem 5
    });
    // primer día del bloque nuevo (w=4) reutiliza por continuidad entre bloques → sin re-selección nueva
    expect(log[4].newCount).toBe(0);
    expect(JSON.stringify(log[4].ids)).toBe(JSON.stringify(log[0].ids));
  });
});
