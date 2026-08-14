import { describe, it, expect } from 'vitest';
import { rirFor } from '../sessionPrescription';
import { priorityMultiplier } from '../musclePriority';
import { assignTechniques, techniquesAllowed, type TechItem, type TechniqueContext } from '../techniques';
import { buildGroups } from '../supersetEngine';
import { exercises } from '../../data/exercises';

// ── §10 · RIR POR NIVEL (main protegido; intermedio = baseline) ─────────
describe('LEVEL · RIR por nivel (§10)', () => {
  it('intermedio / sin nivel = baseline validado (NO cambia)', () => {
    expect(rirFor('main-compound', 'hipertrofia', 'acumulacion')).toBe(3);
    expect(rirFor('isolation', 'hipertrofia', 'acumulacion')).toBe(2);
    expect(rirFor('isolation', 'hipertrofia', 'intensificacion')).toBe(1);
    expect(rirFor('main-compound', 'hipertrofia', 'acumulacion', 'intermedio')).toBe(3);
  });
  it('principiante: más conservador en COMPUESTOS; aislamiento igual', () => {
    expect(rirFor('main-compound', 'hipertrofia', 'acumulacion', 'principiante')).toBe(4); // +1 margen
    expect(rirFor('secondary-compound', 'hipertrofia', 'acumulacion', 'principiante')).toBe(3);
    expect(rirFor('isolation', 'hipertrofia', 'acumulacion', 'principiante')).toBe(2); // aislamiento sin cambio
  });
  it('avanzado: aislamiento/secundario ALGO más cerca del fallo; main PROTEGIDO', () => {
    expect(rirFor('isolation', 'hipertrofia', 'acumulacion', 'avanzado')).toBe(1); // 2→1
    expect(rirFor('isolation', 'hipertrofia', 'intensificacion', 'avanzado')).toBe(0); // 1→0 (al fallo)
    expect(rirFor('secondary-compound', 'hipertrofia', 'acumulacion', 'avanzado')).toBe(1);
    expect(rirFor('main-compound', 'hipertrofia', 'acumulacion', 'avanzado')).toBe(3); // main NO cambia
    expect(rirFor('main-compound', 'hipertrofia', 'intensificacion', 'avanzado')).toBe(2); // main protegido
  });
  it('deload y fuerza: el nivel NO empuja al fallo', () => {
    expect(rirFor('isolation', 'hipertrofia', 'deload', 'avanzado')).toBe(4);
    expect(rirFor('isolation', 'fuerza', 'acumulacion', 'avanzado')).toBe(1); // fuerza baseline (sin -1 extra)
    expect(rirFor('main-compound', 'fuerza', 'intensificacion', 'avanzado')).toBe(2);
  });
});

// ── §5 · PRIORIDAD AVANZADA MÁS FUERTE ──────────────────────────────────
describe('LEVEL · priorityMultiplier especialización avanzada (§5)', () => {
  it('avanzado sesga más que intermedio, sin monopolizar', () => {
    expect(priorityMultiplier('high', 'avanzado')).toBeGreaterThan(priorityMultiplier('high'));
    expect(priorityMultiplier('high', 'avanzado')).toBeLessThan(1.35); // acotado (no abandona el resto)
    expect(priorityMultiplier('none', 'avanzado')).toBe(1.0);
    expect(priorityMultiplier('high', 'intermedio')).toBe(1.18); // baseline intacto
  });
});

// ── §6/§7/§23/§24 · TÉCNICAS GATED ──────────────────────────────────────
const iso = (id: string): TechItem => ({ id, category: 'isolation', sets: 3 });
const ISOS = ['aperturas', 'curl-pie', 'press-frances', 'elevacion-lateral', 'vuelo-posterior'].map(iso);
const ctxAdv = (over: Partial<TechniqueContext> = {}): TechniqueContext =>
  ({ level: 'avanzado', trainingGoal: 'hipertrofia', phase: 'acumulacion', readiness: 'normal', timeMinutes: 60, ...over });

describe('LEVEL · técnicas de intensidad gated (§6/§7/§23/§24)', () => {
  it('avanzado hipertrofia acumulación: asigna 1–2 técnicas a aislamientos', () => {
    const r = assignTechniques({ items: ISOS, ctx: ctxAdv() });
    expect(r.size).toBeGreaterThanOrEqual(1);
    expect(r.size).toBeLessThanOrEqual(2);
    for (const [, t] of r) expect(['Rest-pause', 'Drop set', 'Myo-reps']).toContain(t.label);
  });
  it('principiante / intermedio: CERO técnicas', () => {
    expect(assignTechniques({ items: ISOS, ctx: ctxAdv({ level: 'principiante' }) }).size).toBe(0);
    expect(assignTechniques({ items: ISOS, ctx: ctxAdv({ level: 'intermedio' }) }).size).toBe(0);
  });
  it('fuerza / deload / readiness-low / sesión corta: CERO técnicas', () => {
    expect(assignTechniques({ items: ISOS, ctx: ctxAdv({ trainingGoal: 'fuerza' }) }).size).toBe(0);
    expect(assignTechniques({ items: ISOS, ctx: ctxAdv({ phase: 'deload' }) }).size).toBe(0);
    expect(assignTechniques({ items: ISOS, ctx: ctxAdv({ readiness: 'low' }) }).size).toBe(0);
    expect(assignTechniques({ items: ISOS, ctx: ctxAdv({ timeMinutes: 30 }) }).size).toBe(0);
    expect(assignTechniques({ items: ISOS, ctx: ctxAdv({ fatigueHeadroom: false }) }).size).toBe(0);
  });
  it('NUNCA en main-compound ni en anchors ni en agrupados (§7)', () => {
    const items: TechItem[] = [
      { id: 'sentadilla-bilateral', category: 'main-compound', sets: 4 },
      { id: 'press-horizontal', category: 'main-compound', sets: 4 },
      { id: 'aperturas', category: 'isolation', sets: 3 },        // anchor (excluido)
      { id: 'curl-pie', category: 'isolation', sets: 3, grouped: true }, // agrupado (excluido)
      { id: 'press-frances', category: 'isolation', sets: 3 },
      { id: 'elevacion-lateral', category: 'isolation', sets: 3 },
    ];
    const r = assignTechniques({ items, ctx: { ...ctxAdv(), anchorIds: new Set(['aperturas']) } });
    expect(r.has('sentadilla-bilateral')).toBe(false);
    expect(r.has('press-horizontal')).toBe(false);
    expect(r.has('aperturas')).toBe(false);   // anchor
    expect(r.has('curl-pie')).toBe(false);    // agrupado
  });
  it('frecuencia BAJA: con pocos aislamientos (≤1) → 0 técnicas (§8)', () => {
    expect(assignTechniques({ items: [iso('aperturas')], ctx: ctxAdv() }).size).toBe(0);
    expect(techniquesAllowed(ctxAdv())).toBe(true);
    expect(techniquesAllowed(ctxAdv({ level: 'principiante' }))).toBe(false);
  });
  it('determinista: misma entrada → misma salida (sin random)', () => {
    const a = [...assignTechniques({ items: ISOS, ctx: ctxAdv() }).entries()].map(([id, t]) => `${id}:${t.label}`);
    const b = [...assignTechniques({ items: ISOS, ctx: ctxAdv() }).entries()].map(([id, t]) => `${id}:${t.label}`);
    expect(a).toEqual(b);
  });
});

// ── §16 · SUPERSERIES: AVANZADO MÁS DENSIDAD (nunca bad, nunca main) ─────
describe('LEVEL · densidad de superseries por nivel (§16)', () => {
  const isoIds = exercises.filter(e => e.muscleGroup && ['biceps', 'triceps', 'hombros', 'pecho', 'espalda'].includes(e.muscleGroup))
    .filter(e => e.type !== 'compuesto').slice(0, 8).map(e => e.id);
  const bankById = new Map(exercises.map(e => [e.id, e]));
  const ctx = (level: string) => ({ trainingGoal: 'hipertrofia' as const, timeMinutes: 60, phase: 'acumulacion' as const, readinessLow: false, anchorIds: new Set<string>(), level });
  it('avanzado ≥ intermedio en nº de grupos a 60 min', () => {
    const adv = buildGroups(isoIds, bankById, ctx('avanzado'));
    const int = buildGroups(isoIds, bankById, ctx('intermedio'));
    expect(adv.trace.length).toBeGreaterThanOrEqual(int.trace.length);
    for (const g of adv.trace) expect(g.quality).not.toBe('bad'); // nunca bad pairs
  });
  it('principiante ≤ intermedio (menos densidad)', () => {
    const pri = buildGroups(isoIds, bankById, ctx('principiante'));
    const int = buildGroups(isoIds, bankById, ctx('intermedio'));
    expect(pri.trace.length).toBeLessThanOrEqual(int.trace.length);
  });
});
