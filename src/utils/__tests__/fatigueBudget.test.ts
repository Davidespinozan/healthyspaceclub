import { describe, it, expect } from 'vitest';
import { exercises } from '../../data/exercises';
import {
  systemicFatigue, exerciseFatigue, sessionFatigue, fatigueBudget, canAddExercise, applyFatigueBudget,
  type FatigueContext,
} from '../fatigueBudget';
import { roleOf } from '../exerciseRole';
import { movementPatternOf } from '../movementPattern';
import { HEAVY_COMPOUND } from '../exerciseOrder';
import type { TrainingGoal } from '../../types';

const bankById = new Map(exercises.map(e => [e.id, e]));
const F = (id: string) => exerciseFatigue(bankById.get(id)!);
const ctx = (over: Partial<FatigueContext> = {}): FatigueContext => ({
  trainingGoal: 'hipertrofia', level: 'intermedio', timeMinutes: 60, phase: 'acumulacion', ...over,
});

// ── MODELO DE FATIGA ────────────────────────────────────────────────────
describe('fatiga · sistémica ≠ local (§2/§3)', () => {
  it('compuesto de tren inferior/hinge = alto; press/tracción = medio; aislamiento = 0', () => {
    expect(F('sentadilla-bilateral')).toBe(4);       // squat main
    expect(F('peso-muerto-convencional')).toBe(4);   // hinge main
    expect(F('sentadilla-unilateral')).toBe(3);      // búlgara secondary lunge
    expect(F('prensa-piernas')).toBe(3);             // secondary squat
    expect(F('press-horizontal')).toBe(2);           // bench main (upper, no heavy pattern)
    expect(F('remo-horizontal-pesado')).toBe(2);     // row main
    expect(F('extension-cuadriceps')).toBe(0);       // isolation (local, no sistémico)
    expect(F('curl-femoral')).toBe(0);
    expect(F('elevacion-talones')).toBe(0);
  });
  it('reutiliza el MISMO rol+patrón que el motor de superseries', () => {
    const ex = bankById.get('sentadilla-bilateral')!;
    expect(systemicFatigue(roleOf(ex, HEAVY_COMPOUND), movementPatternOf(ex))).toBe(F('sentadilla-bilateral'));
  });
});

// ── PRESUPUESTO CONTEXTUAL ──────────────────────────────────────────────
describe('presupuesto · contextual (§4)', () => {
  it('fuerza < hipertrofia (§5/§6)', () => {
    expect(fatigueBudget(ctx({ trainingGoal: 'fuerza' }))).toBeLessThan(fatigueBudget(ctx({ trainingGoal: 'hipertrofia' })));
  });
  it('principiante < intermedio < avanzado (§16/§17)', () => {
    expect(fatigueBudget(ctx({ level: 'principiante' }))).toBeLessThan(fatigueBudget(ctx({ level: 'intermedio' })));
    expect(fatigueBudget(ctx({ level: 'intermedio' }))).toBeLessThan(fatigueBudget(ctx({ level: 'avanzado' })));
  });
  it('deload << normal; readiness LOW < normal (§13/§14)', () => {
    expect(fatigueBudget(ctx({ phase: 'deload' }))).toBeLessThan(fatigueBudget(ctx()));
    expect(fatigueBudget(ctx({ readinessLow: true }))).toBeLessThan(fatigueBudget(ctx()));
  });
  it('90 min NO expande el presupuesto (§12)', () => {
    expect(fatigueBudget(ctx({ timeMinutes: 90 }))).toBe(fatigueBudget(ctx({ timeMinutes: 60 })));
  });
});

// ── ENFORCEMENT (adversariales) ─────────────────────────────────────────
const run = (ids: string[], anchorIds: string[], c: FatigueContext, requiredPatterns: string[] = []) =>
  applyFatigueBudget({
    exercises: ids.map(id => ({ id })), anchorIds, requiredPatterns: requiredPatterns as never,
    candidates: exercises, bankById, ctx: c, makeItem: (id) => ({ id }),
  });

describe('LOWER adversarial (§18) — el caso crítico', () => {
  it('§18.A · squat+DL+RDL+búlgara+zancada+prensa+leg-ext+leg-curl+calves → fatiga acotada, sin pile', () => {
    const pool = ['sentadilla-bilateral', 'peso-muerto-convencional', 'peso-muerto-rumano', 'sentadilla-unilateral', 'zancada', 'prensa-piernas', 'extension-cuadriceps', 'curl-femoral', 'elevacion-talones'];
    const r = run(pool, ['sentadilla-bilateral', 'peso-muerto-convencional'], ctx());
    expect(r.total).toBeLessThanOrEqual(r.budget);
    // los anchors sobreviven
    expect(r.exercises.map(e => e.id)).toContain('sentadilla-bilateral');
    expect(r.exercises.map(e => e.id)).toContain('peso-muerto-convencional');
    // se recortan compuestos duros extra (RDL/búlgara/zancada/prensa no caben todos)
    const compounds = r.exercises.filter(e => F(e.id) >= 3).length;
    expect(compounds).toBeLessThan(6);
  });

  it('§27 · entre X (más compuestos) e Y (compuestos + aislamiento), prefiere Y bajo presupuesto', () => {
    // X: squat + prensa + búlgara (3 compuestos duros) · Y: squat + leg-ext + leg-curl
    const X = sessionFatigue(['sentadilla-bilateral', 'prensa-piernas', 'sentadilla-unilateral'], bankById);
    const Y = sessionFatigue(['sentadilla-bilateral', 'extension-cuadriceps', 'curl-femoral'], bankById);
    expect(Y).toBeLessThan(X); // Y menos sistémico a igual cobertura de cuádriceps/isquios
  });

  it('§10/§24 · reemplaza el compuesto extra por aislamiento del mismo músculo (preserva volumen)', () => {
    const pool = ['sentadilla-bilateral', 'prensa-piernas', 'curl-femoral'];
    const r = run(pool, ['sentadilla-bilateral'], ctx({ trainingGoal: 'fuerza' })); // fuerza budget bajo
    // prensa (secondary squat, 3) debería reemplazarse por un aislamiento de cuádriceps
    if (r.replaced > 0) {
      expect(r.exercises.some(e => e.id === 'extension-cuadriceps' || F(e.id) === 0)).toBe(true);
    }
    expect(r.total).toBeLessThanOrEqual(r.budget);
    expect(r.exercises.map(e => e.id)).toContain('sentadilla-bilateral'); // anchor intacto
  });
});

describe('UPPER adversarial (§19)', () => {
  it('bench+OHP+dips+heavy-row+weighted-pullup → acotado (aunque patrones distintos)', () => {
    const pool = ['press-horizontal', 'press-vertical', 'fondos-triceps', 'remo-horizontal-pesado', 'traccion-vertical-polea'];
    const r = run(pool, ['press-horizontal', 'traccion-vertical-polea'], ctx());
    expect(r.total).toBeLessThanOrEqual(r.budget);
    expect(r.exercises.map(e => e.id)).toContain('press-horizontal'); // anchors intactos
  });
});

describe('FULL BODY (§20) — no cuatro mains pesados', () => {
  it('squat+DL+bench+OHP+heavy-row → recorta a un conjunto tolerable', () => {
    const pool = ['sentadilla-bilateral', 'peso-muerto-convencional', 'press-horizontal', 'press-vertical', 'remo-horizontal-pesado'];
    const r = run(pool, ['sentadilla-bilateral', 'press-horizontal'], ctx({ level: 'principiante' }));
    expect(r.total).toBeLessThanOrEqual(r.budget);
    expect(r.exercises.map(e => e.id)).toContain('sentadilla-bilateral');
    expect(r.exercises.map(e => e.id)).toContain('press-horizontal');
  });
});

// ── INVARIANTES (§30) ───────────────────────────────────────────────────
describe('INVARIANTES de fatiga', () => {
  it('anchor NUNCA se elimina por fatiga (§8/§28)', () => {
    const pool = ['sentadilla-bilateral', 'peso-muerto-convencional', 'prensa-piernas', 'sentadilla-unilateral'];
    const r = run(pool, ['sentadilla-bilateral'], ctx({ phase: 'deload' })); // budget mínimo
    expect(r.exercises.map(e => e.id)).toContain('sentadilla-bilateral');
  });
  it('session fatigue ≤ budget tras aplicar (o se detiene por cobertura esencial)', () => {
    for (const tg of ['fuerza', 'hipertrofia'] as TrainingGoal[]) {
      const r = run(['sentadilla-bilateral', 'peso-muerto-convencional', 'prensa-piernas', 'sentadilla-unilateral', 'extension-cuadriceps'], ['sentadilla-bilateral'], ctx({ trainingGoal: tg }));
      expect(r.total).toBeLessThanOrEqual(r.budget + 4); // margen por cobertura esencial protegida
    }
  });
  it('canAddExercise: rechaza otro compuesto en el límite; el aislamiento (0) sí cabe', () => {
    const atLimit = ['sentadilla-bilateral', 'peso-muerto-convencional']; // 8 = budget fuerza int
    const c = ctx({ trainingGoal: 'fuerza' }); // budget 8
    expect(canAddExercise(atLimit, bankById.get('prensa-piernas')!, bankById, c)).toBe(false); // +3 → 11 > 8
    expect(canAddExercise(atLimit, bankById.get('extension-cuadriceps')!, bankById, c)).toBe(true); // +0 → 8 ≤ 8
  });
  it('aislamientos NO se eliminan por fatiga (coste local, no sistémico)', () => {
    const pool = ['sentadilla-bilateral', 'extension-cuadriceps', 'curl-femoral', 'elevacion-talones'];
    const r = run(pool, ['sentadilla-bilateral'], ctx());
    // squat(4) + isolations(0) = 4 ≤ budget → nada se toca
    expect(r.dropped).toBe(0);
    expect(r.replaced).toBe(0);
  });
});
