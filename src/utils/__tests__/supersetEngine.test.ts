import { describe, it, expect } from 'vitest';
import { exercises } from '../../data/exercises';
import {
  metaOf, evaluateSupersetPair, evaluateTriset, buildGroups,
  type SupersetContext,
} from '../supersetEngine';
import { roleOf, RECLASSIFIED, ROLE_BY_ID } from '../exerciseRole';
import { movementPatternOf } from '../movementPattern';
import { HEAVY_COMPOUND } from '../exerciseOrder';
import type { TrainingGoal } from '../../types';

const bankById = new Map(exercises.map(e => [e.id, e]));
const M = (id: string) => metaOf(bankById.get(id)!);
const ctx = (over: Partial<SupersetContext> = {}): SupersetContext => ({
  trainingGoal: 'hipertrofia', timeMinutes: 45, phase: 'acumulacion', ...over,
});
const q = (aId: string, bId: string, over: Partial<SupersetContext> = {}) =>
  evaluateSupersetPair(M(aId), M(bId), ctx(over)).quality;

// ── §28 · ROLE METADATA EXPLÍCITA ───────────────────────────────────────
describe('ROLE · metadata explícita (no depende del nombre)', () => {
  const RES = exercises.filter(e => !e.isYoga && e.muscleGroup !== 'cardio');
  it('todo ejercicio de resistencia tiene rol y patrón (sin UNKNOWN)', () => {
    for (const e of RES) {
      expect(['main', 'secondary', 'isolation', 'conditioning']).toContain(roleOf(e, HEAVY_COMPOUND));
      expect(movementPatternOf(e)).toBeTruthy();
    }
  });
  it('renombrar el ejercicio NO cambia el rol (autoridad = id explícito, no el nombre)', () => {
    const bench = { ...bankById.get('press-horizontal')!, name: 'Cualquier Nombre Nuevo' };
    expect(roleOf(bench, HEAVY_COMPOUND)).toBe('main');
  });
  it('bench/OHP/jalón son MAIN (corrección del regex); búlgara/pliométrica NO son main', () => {
    expect(roleOf(bankById.get('press-horizontal')!, HEAVY_COMPOUND)).toBe('main');
    expect(roleOf(bankById.get('press-vertical')!, HEAVY_COMPOUND)).toBe('main');
    expect(roleOf(bankById.get('sentadilla-unilateral')!, HEAVY_COMPOUND)).toBe('secondary');
    expect(roleOf(bankById.get('sentadilla-pliometrica')!, HEAVY_COMPOUND)).toBe('conditioning');
  });
  it('exactamente 7 reclasificaciones documentadas', () => {
    expect(Object.keys(RECLASSIFIED)).toHaveLength(7);
  });
  it('el mapa explícito cubre todo el banco de resistencia', () => {
    const missing = RES.filter(e => !ROLE_BY_ID[e.id]);
    expect(missing.map(e => e.id)).toEqual([]);
  });
});

// ── §24 · PARES QUE DEBEN SALIR BIEN ────────────────────────────────────
describe('SUPERSET · pares buenos (§24)', () => {
  it('curl + pushdown → antagonista beneficial', () => {
    const r = evaluateSupersetPair(M('curl-pie'), M('triceps-push-down'), ctx());
    expect(r.type).toBe('antagonist');
    expect(r.quality).toBe('beneficial');
  });
  it('leg extension + leg curl → antagonista beneficial', () => {
    const r = evaluateSupersetPair(M('extension-cuadriceps'), M('curl-femoral'), ctx());
    expect(r.type).toBe('antagonist');
    expect(r.quality).toBe('beneficial');
  });
  it('lateral raise + rear delt → complementario beneficial/acceptable', () => {
    expect(['beneficial', 'acceptable']).toContain(q('elevacion-lateral', 'vuelo-posterior'));
  });
  it('cable fly + curl → acceptable (tiempo corto)', () => {
    expect(q('aperturas', 'curl-pie', { timeMinutes: 30 })).toBe('acceptable');
  });
  it('press secundario + fly (mismo músculo) → acceptable, NO bad', () => {
    expect(q('press-inclinado', 'aperturas', { timeMinutes: 30 })).toBe('acceptable');
  });
});

// ── §25 / §9 · PARES QUE DEBEN SER BAD ──────────────────────────────────
describe('SUPERSET · pares malos (§25) — incluye FONDOS + BÚLGARA (§9)', () => {
  it('§9 · fondos + sentadilla búlgara → BAD (dos compuestos, no antagonistas, alta fatiga)', () => {
    const r = evaluateSupersetPair(M('fondos-triceps'), M('sentadilla-unilateral'), ctx());
    expect(r.quality).toBe('bad');
    // y también en hipertrofia con poco tiempo
    expect(q('fondos-triceps', 'sentadilla-unilateral', { timeMinutes: 30 })).toBe('bad');
    // y en fuerza
    expect(q('fondos-triceps', 'sentadilla-unilateral', { trainingGoal: 'fuerza' })).toBe('bad');
  });
  it('squat + deadlift → BAD (dos mains)', () => {
    expect(q('sentadilla-bilateral', 'peso-muerto-convencional')).toBe('bad');
  });
  it('bench main + heavy row → BAD (main + main)', () => {
    expect(q('press-horizontal', 'remo-horizontal-pesado')).toBe('bad');
  });
  it('squat + leg press pesado → BAD', () => {
    expect(q('sentadilla-bilateral', 'prensa-piernas')).toBe('bad');
  });
  it('un main con CUALQUIER cosa → BAD (main va solo)', () => {
    expect(q('press-horizontal', 'curl-pie')).toBe('bad');
    expect(q('sentadilla-bilateral', 'elevacion-talones')).toBe('bad');
  });
  it('anchor con cualquier cosa → BAD', () => {
    const anchorIds = new Set(['press-inclinado']);
    expect(evaluateSupersetPair(M('press-inclinado'), M('aperturas'), ctx({ anchorIds })).quality).toBe('bad');
  });
});

// ── GOAL / TIME / PHASE / READINESS ─────────────────────────────────────
describe('SUPERSET · contexto (goal/time/phase/readiness)', () => {
  it('FUERZA: cualquier trabajo compuesto va solo; iso+iso antagonista sí permitido', () => {
    expect(q('press-inclinado', 'aperturas', { trainingGoal: 'fuerza' })).toBe('bad'); // compuesto
    expect(q('curl-pie', 'triceps-push-down', { trainingGoal: 'fuerza' })).toBe('beneficial'); // iso antagonista
  });
  it('DELOAD: sin superseries', () => {
    expect(q('curl-pie', 'triceps-push-down', { phase: 'deload' })).toBe('bad');
  });
  it('READINESS baja: baja la calidad (menos densidad)', () => {
    const normal = q('aperturas', 'curl-pie', { timeMinutes: 30 });                 // complementary acceptable
    const low = q('aperturas', 'curl-pie', { timeMinutes: 30, readinessLow: true }); // → downgrade → bad
    expect(normal).toBe('acceptable');
    expect(low).toBe('bad');
  });
  it('logística molesta (barra + polea) penaliza', () => {
    // curl-barra-z (barbell) + triceps-push-down (machine-cable) antagonista → beneficial baja a acceptable
    const r = evaluateSupersetPair(M('curl-barra-z'), M('triceps-push-down'), ctx());
    expect(r.quality).toBe('acceptable'); // beneficial (antagonista) − logística = acceptable
  });
});

// ── TRISERIES ───────────────────────────────────────────────────────────
describe('TRISET · más estrictas (§16)', () => {
  it('3 aislamientos compatibles → permitido', () => {
    const r = evaluateTriset([M('curl-pie'), M('triceps-push-down'), M('elevacion-lateral')], ctx());
    expect(r.quality).not.toBe('bad');
  });
  it('3 compuestos → BAD', () => {
    const r = evaluateTriset([M('press-inclinado'), M('remo-unilateral'), M('prensa-piernas')], ctx());
    expect(r.quality).toBe('bad');
  });
  it('fuerza → triserie BAD (prácticamente nunca)', () => {
    const r = evaluateTriset([M('curl-pie'), M('triceps-push-down'), M('elevacion-lateral')], ctx({ trainingGoal: 'fuerza' }));
    expect(r.quality).toBe('bad');
  });
});

// ── buildGroups (§17, §23, §30) ─────────────────────────────────────────
describe('buildGroups · el motor decide (adversariales §30)', () => {
  const noBad = (ids: string[], c: SupersetContext) => {
    const { groups } = buildGroups(ids, bankById, c);
    // ninguna pareja formada es BAD
    const byGroup: Record<string, string[]> = {};
    for (const [id, g] of Object.entries(groups)) (byGroup[g] ??= []).push(id);
    for (const members of Object.values(byGroup)) {
      expect(members.length).toBeLessThanOrEqual(3); // cap tamaño 3
      for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) {
        expect(evaluateSupersetPair(M(members[i]), M(members[j]), c).quality).not.toBe('bad');
      }
    }
    return { groups, byGroup };
  };

  it('§30.A · fondos+búlgara+curl+pushdown → curl+pushdown group; fondos/búlgara sueltos', () => {
    const { groups } = noBad(['fondos-triceps', 'sentadilla-unilateral', 'curl-pie', 'triceps-push-down'], ctx({ timeMinutes: 30 }));
    expect(groups['curl-pie']).toBeDefined();
    expect(groups['curl-pie']).toBe(groups['triceps-push-down']); // agrupados
    expect(groups['fondos-triceps']).toBeUndefined();             // suelto
    expect(groups['sentadilla-unilateral']).toBeUndefined();      // suelto
  });

  it('§30.B · bench anchor + row + curl + triceps (fuerza) → bench NUNCA grouped', () => {
    const anchorIds = new Set(['press-horizontal']);
    const { groups } = buildGroups(['press-horizontal', 'remo-horizontal-pesado', 'curl-pie', 'triceps-push-down'], bankById, ctx({ trainingGoal: 'fuerza', timeMinutes: 60, anchorIds }));
    expect(groups['press-horizontal']).toBeUndefined(); // main anchor jamás
    expect(groups['remo-horizontal-pesado']).toBeUndefined();
  });

  it('§30.D · squat+RDL+leg press+leg curl (fuerza) → 0 superseries de compuestos', () => {
    const { groups } = buildGroups(['sentadilla-bilateral', 'peso-muerto-rumano', 'prensa-piernas', 'curl-femoral'], bankById, ctx({ trainingGoal: 'fuerza', timeMinutes: 60 }));
    // ningún compuesto agrupado (curl-femoral es iso pero solo → sin pareja iso)
    expect(Object.keys(groups).length).toBe(0);
  });

  it('§30.E · leg ext + leg curl + calves (hipertrofia) → leg ext+curl agrupados', () => {
    const { groups } = noBad(['extension-cuadriceps', 'curl-femoral', 'elevacion-talones'], ctx({ timeMinutes: 30 }));
    expect(groups['extension-cuadriceps']).toBe(groups['curl-femoral']);
  });

  it('90 min → menos/ninguna agrupación; 30 min → más', () => {
    const ids = ['curl-pie', 'triceps-push-down', 'elevacion-lateral', 'vuelo-posterior'];
    const g30 = buildGroups(ids, bankById, ctx({ timeMinutes: 30 })).trace.length;
    const g90 = buildGroups(ids, bankById, ctx({ timeMinutes: 90 })).trace.length;
    expect(g90).toBeLessThanOrEqual(g30);
    expect(g90).toBe(0);
  });

  it('deload / readiness baja → 0 groups (no aumentar densidad)', () => {
    const ids = ['curl-pie', 'triceps-push-down', 'elevacion-lateral'];
    expect(buildGroups(ids, bankById, ctx({ timeMinutes: 30, phase: 'deload' })).trace.length).toBe(0);
    expect(buildGroups(ids, bankById, ctx({ timeMinutes: 30, readinessLow: true })).trace.length).toBe(0);
  });

  it('INVARIANTE · ningún group de tamaño >3, ningún BAD en el resultado', () => {
    const ids = ['curl-pie', 'triceps-push-down', 'elevacion-lateral', 'vuelo-posterior', 'elevacion-talones', 'aperturas'];
    for (const tg of ['fuerza', 'hipertrofia'] as TrainingGoal[]) for (const t of [30, 45, 60, 90]) {
      noBad(ids, ctx({ trainingGoal: tg, timeMinutes: t }));
    }
  });
});

// ── §31 · SIMULACIÓN AGREGADA (bad = 0 en todo workout final) ────────────
describe('SIMULACIÓN · bad = 0 en el resultado, sobre muchas combinaciones', () => {
  it('sobre goal×time×día, ningún group formado es BAD', () => {
    const days: Record<string, string[]> = {
      upper: ['press-horizontal', 'remo-horizontal-pesado', 'press-vertical', 'curl-pie', 'triceps-push-down', 'elevacion-lateral'],
      lower: ['sentadilla-bilateral', 'peso-muerto-rumano', 'extension-cuadriceps', 'curl-femoral', 'elevacion-talones'],
      push: ['press-horizontal', 'press-vertical', 'aperturas', 'triceps-push-down', 'elevacion-lateral'],
      pull: ['traccion-vertical-polea', 'remo-horizontal-pesado', 'curl-pie', 'vuelo-posterior', 'shrugs'],
    };
    let totalGroups = 0, totalBad = 0;
    for (const tg of ['fuerza', 'hipertrofia'] as TrainingGoal[]) for (const t of [30, 45, 60, 90]) for (const ids of Object.values(days)) {
      const anchorIds = new Set([ids[0]]);
      const { groups } = buildGroups(ids, bankById, ctx({ trainingGoal: tg, timeMinutes: t, anchorIds }));
      const byGroup: Record<string, string[]> = {};
      for (const [id, g] of Object.entries(groups)) (byGroup[g] ??= []).push(id);
      for (const members of Object.values(byGroup)) {
        totalGroups++;
        for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++)
          if (evaluateSupersetPair(M(members[i]), M(members[j]), ctx({ trainingGoal: tg, timeMinutes: t, anchorIds })).quality === 'bad') totalBad++;
        expect(members).not.toContain(ids[0]); // el anchor nunca agrupado
      }
    }
    expect(totalBad).toBe(0);
    expect(totalGroups).toBeGreaterThan(0); // sí se formaron algunos (donde tenía sentido)
  });
});
