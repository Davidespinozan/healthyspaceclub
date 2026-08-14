import { describe, it, expect } from 'vitest';
import { exercises } from '../../data/exercises';
import { setLoadForIndex, hasTopBackoffScheme } from '../workoutSession';
import { supportedSplitsForEquipment, degradeToSupportedSplit } from '../workoutPlanner';
import { applyFatigueBudget, exerciseFatigue } from '../fatigueBudget';
import { movementPatternOf } from '../movementPattern';
import { regionsOfPattern } from '../regionalCoverage';
import type { Equipment } from '../../types';

// ══════════════════ A · TOP/BACKOFF (contrato player) ══════════════════
describe('FASE7-A · top/backoff por serie (§Fix1)', () => {
  const tb = { topKg: 100, backoffKg: 90, sets: 3 };
  it('serie 1 = TOP (topKg); series 2..N = BACKOFF (backoffKg)', () => {
    expect(setLoadForIndex(tb, null, 0)).toEqual({ kg: 100, scheme: 'top' });
    expect(setLoadForIndex(tb, null, 1)).toEqual({ kg: 90, scheme: 'backoff' });
    expect(setLoadForIndex(tb, null, 2)).toEqual({ kg: 90, scheme: 'backoff' });
    expect(hasTopBackoffScheme(tb)).toBe(true);
  });
  it('ejercicio normal (sin top/backoff) = carga prescrita única, sin distinción', () => {
    const ex = { topKg: 80 }; // topKg pero sin backoffKg → recto
    expect(hasTopBackoffScheme(ex)).toBe(false);
    expect(setLoadForIndex(ex, 80, 0)).toEqual({ kg: 80, scheme: 'straight' });
    expect(setLoadForIndex(ex, 80, 1)).toEqual({ kg: 80, scheme: 'straight' });
  });
  it('bodyweight/bandas: sin kg ficticio (prescribedKg null → kg null)', () => {
    const bw = {}; // sin topKg/backoffKg/deloadKg
    expect(hasTopBackoffScheme(bw)).toBe(false);
    expect(setLoadForIndex(bw, null, 0)).toEqual({ kg: null, scheme: 'straight' });
  });
  it('deload: deloadKg en TODAS las series, sin top/backoff', () => {
    const dl = { topKg: 100, backoffKg: 90, deloadKg: 87.5 };
    expect(hasTopBackoffScheme(dl)).toBe(false); // deload manda
    expect(setLoadForIndex(dl, 87.5, 0)).toEqual({ kg: 87.5, scheme: 'deload' });
    expect(setLoadForIndex(dl, 87.5, 2)).toEqual({ kg: 87.5, scheme: 'deload' });
  });
  it('topKg === backoffKg por redondeo → recto (sin distinción falsa)', () => {
    const eq = { topKg: 60, backoffKg: 60 };
    expect(hasTopBackoffScheme(eq)).toBe(false);
    expect(setLoadForIndex(eq, 60, 1).scheme).toBe('straight');
  });
});

// ══════════════════ B · SPLIT GUARD por capacidad ══════════════════
describe('FASE7-B · supportedSplitsForEquipment (§Fix2)', () => {
  const call = (equipment: Equipment[]) => supportedSplitsForEquipment({
    exercises, equipment, goal: 'hipertrofia', difficulty: 'intermedio',
  });
  it('GYM: sostiene todos los splits', () => {
    const s = call(['gym']);
    for (const t of ['full-body', 'upper', 'lower', 'push', 'pull', 'legs']) expect(s).toContain(t);
  });
  it('BODYWEIGHT: NO sostiene pull aislado; SÍ full-body', () => {
    const s = call(['cuerpo']);
    expect(s).not.toContain('pull');   // solo remo-invertido → banco no lo sostiene
    expect(s).toContain('full-body');  // fallback seguro, con upper+lower
  });
  it('BODYWEIGHT: pull es el ÚNICO split degenerado; el resto (con match de secundarios) sí se sostiene', () => {
    const s = call(['cuerpo']);
    // filterExercisesForWorkout cuenta también músculos SECUNDARIOS → legs/lower/upper/push alcanzan
    // el mínimo (zancadas/hip-thrust golpean varios músculos); solo pull (espalda 1 + biceps 0) cae.
    expect(s).not.toContain('pull');
    expect(s).toContain('full-body');
    expect(s.length).toBeGreaterThanOrEqual(3);
  });
  it('BANDS: conserva los splits que el banco SÍ sostiene (pull incluido)', () => {
    const s = call(['ligas']);
    expect(s).toContain('full-body');
    expect(s).toContain('pull');       // bandas: espalda+biceps con video suficiente
  });
  it('degrade: split no soportado → full-body; soportado se conserva', () => {
    const s = call(['cuerpo']);
    expect(degradeToSupportedSplit('pull', s)).toBe('full-body');
    expect(degradeToSupportedSplit('full-body', s)).toBe('full-body');
    expect(degradeToSupportedSplit('push', call(['gym']))).toBe('push');
  });
  it('el guard NO se salta el filtro de video (usa filterExercisesForWorkout)', () => {
    // un equipo inexistente en el banco → 0 soportados (nada se cuela sin video/gear)
    const s = supportedSplitsForEquipment({ exercises, equipment: [] as unknown as Equipment[], goal: 'hipertrofia' });
    expect(s.length).toBe(0);
  });
});

// ══════════════════ C · FATIGUE EDGE (anchors inamovibles) ══════════════════
describe('FASE7-C · alivio de anclas beginner/short (§Fix3)', () => {
  const bankById = new Map(exercises.map(e => [e.id, e]));
  const lowerPool = exercises.filter(e => ['cuadriceps', 'isquios', 'gluteo', 'pantorrillas'].includes(e.muscleGroup));
  const mk = (id: string) => ({ id });
  const run = (goal: 'hipertrofia' | 'fuerza', level: string) => applyFatigueBudget({
    exercises: [mk('sentadilla-bilateral'), mk('peso-muerto-convencional')],   // squat f4 + DL f4 = 8
    anchorIds: ['sentadilla-bilateral', 'peso-muerto-convencional'],
    requiredPatterns: [movementPatternOf(bankById.get('sentadilla-bilateral')!)!, movementPatternOf(bankById.get('peso-muerto-convencional')!)!].filter(Boolean),
    candidates: lowerPool, bankById,
    ctx: { trainingGoal: goal, level, timeMinutes: 30, phase: 'acumulacion' },
    makeItem: mk,
  });

  it('hipertrofia principiante 30: alivia el 2.º ancla (main squat protegido) → cabe en budget', () => {
    const r = run('hipertrofia', 'principiante');
    const ids = r.exercises.map(e => e.id);
    expect(ids).toContain('sentadilla-bilateral');       // main principal SIEMPRE protegido
    expect(ids).not.toContain('peso-muerto-convencional'); // 2.º ancla aliviado
    expect(r.total).toBeLessThanOrEqual(r.budget);         // ya no excede el presupuesto
    // la función (posterior chain / lower-hinge) se mantiene
    const regions = new Set(ids.flatMap(id => { const p = movementPatternOf(bankById.get(id)!); return p ? regionsOfPattern(p) : []; }));
    expect(regions.has('lower-hinge') || regions.has('lower-knee')).toBe(true);
  });
  it('no mete basura (sissy/jump) para aliviar', () => {
    const ids = run('hipertrofia', 'principiante').exercises.map(e => e.id);
    expect(ids).not.toContain('sentadilla-pliometrica');
    expect(ids).not.toContain('sissy-squat');
  });
  it('la alternativa es de MENOR fatiga que el ancla que reemplaza', () => {
    const r = run('hipertrofia', 'principiante');
    const swapped = r.exercises.find(e => e.id !== 'sentadilla-bilateral')!;
    expect(exerciseFatigue(bankById.get(swapped.id)!)).toBeLessThan(4); // < DL(4)
  });
  it('fuerza: conserva especificidad — no degrada a puro aislamiento (compuesto o excepción explicable)', () => {
    const r = run('fuerza', 'principiante');
    const ids = r.exercises.map(e => e.id);
    expect(ids).toContain('sentadilla-bilateral');   // main protegido
    const other = r.exercises.find(e => e.id !== 'sentadilla-bilateral');
    if (other) {
      // si hubo alivio, el sustituto NO es un aislamiento (fuerza mantiene compuesto)
      const roleOk = bankById.get(other.id)!.type === 'compuesto';
      const explicable = r.fixes.some(f => f.includes('excepción'));
      expect(roleOk || explicable).toBe(true);
    }
  });
  it('sesión normal (intermedio, budget holgado): NO dispara alivio', () => {
    const r = applyFatigueBudget({
      exercises: [mk('sentadilla-bilateral'), mk('curl-femoral')],  // f4 + f0 = 4
      anchorIds: ['sentadilla-bilateral'],
      requiredPatterns: [movementPatternOf(bankById.get('sentadilla-bilateral')!)!],
      candidates: lowerPool, bankById,
      ctx: { trainingGoal: 'hipertrofia', level: 'intermedio', timeMinutes: 60, phase: 'acumulacion' },
      makeItem: mk,
    });
    expect(r.exercises.map(e => e.id)).toEqual(['sentadilla-bilateral', 'curl-femoral']); // intacto
    expect(r.replaced).toBe(0);
  });
});
