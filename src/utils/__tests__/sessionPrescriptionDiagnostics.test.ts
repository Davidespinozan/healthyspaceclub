import { describe, it, expect } from 'vitest';
import { prescribeSession, categorize, type TimeFitDiagnostics } from '../sessionPrescription';
import { exercises as BANK } from '../../data/exercises';

// ═══════════════════════════════════════════════════════════════════════════
// F2B-0 · diagnostics ADITIVOS del time-fit. timeFitTrimmed = Σsets(después) < Σsets(antes).
// CRÍTICO: pasar diagnostics NO cambia el output de prescripción (byte-identical).
// ═══════════════════════════════════════════════════════════════════════════
const bankById = new Map(BANK.map(e => [e.id, { id: e.id, name: e.name, type: e.type }]));
const catOf = (id: string) => categorize(bankById.get(id) ?? { id, name: id, type: 'compuesto' });
function pickByCat(want: 'main-compound' | 'isolation', n: number) {
  const seen = new Set<string>(); const out: { id: string; muscleGroup: string }[] = [];
  for (const e of BANK) {
    if (e.type === 'cardio' || e.isYoga || catOf(e.id) !== want || seen.has(e.muscleGroup)) continue;
    seen.add(e.muscleGroup); out.push({ id: e.id, muscleGroup: e.muscleGroup });
    if (out.length === n) break;
  }
  return out;
}
const mains = pickByCat('main-compound', 4);
const isos = pickByCat('isolation', 2);
const alloc = (v: number, exs = [...mains, ...isos]) => Object.fromEntries(exs.map(e => [e.muscleGroup, v]));
const base = (exs: { id: string; muscleGroup: string }[], allocation: Record<string, number>, mainMinutes: number, extra: Record<string, unknown> = {}) =>
  ({ exercises: exs, bankById, allocation, trainingGoal: 'hipertrofia' as const, phase: 'acumulacion' as const, level: 'avanzado', mainMinutes, lastPerf: {}, ...extra });
const emptyDiag = (): TimeFitDiagnostics => ({ timeFitTrimmed: false, trimmedSets: 0, removedExercises: 0 });

describe('byte-identical (diagnostics NO cambia output)', () => {
  const configs = [
    ['hiper sin recorte (budget amplio)', base(mains, alloc(12), 9999)],
    ['hiper con reducción de sets', base(mains, alloc(12), 8)],
    ['hiper con retiro de ejercicio', base([...mains, ...isos], alloc(12), 6)],
    ['Fix E activo + protectedIds', base(mains, alloc(12), 8, { compoundMinSets: 3, protectedIds: new Set(mains.map(e => e.id)) })],
    ['fuerza', base(mains, alloc(12), 8, { trainingGoal: 'fuerza' })],
    ['budget corto', base([...mains, ...isos], alloc(10), 5)],
  ] as const;
  for (const [name, input] of configs) {
    it(name, () => {
      const without = prescribeSession(input as never);
      const diag = emptyDiag();
      const withD = prescribeSession(input as never, diag);
      // output de prescripción idéntico (mismos ejercicios, sets, reps, rest, rir, esquema)
      expect(withD.map(i => [i.ex.id, i.category, i.prescription])).toEqual(without.map(i => [i.ex.id, i.category, i.prescription]));
    });
  }
});

describe('reality checks A–F', () => {
  it('A · dosis cabe → false / 0 / 0', () => {
    const d = emptyDiag(); prescribeSession(base(mains, alloc(6), 9999) as never, d);
    expect(d).toEqual({ timeFitTrimmed: false, trimmedSets: 0, removedExercises: 0 });
  });
  it('B · reduce sets → true, trimmedSets>0', () => {
    const d = emptyDiag(); prescribeSession(base(mains, alloc(12), 8) as never, d);
    expect(d.timeFitTrimmed).toBe(true); expect(d.trimmedSets).toBeGreaterThan(0);
  });
  it('C · retira ejercicio → true, removedExercises>0', () => {
    const d = emptyDiag(); prescribeSession(base([...mains, ...isos], alloc(12), 5) as never, d);
    expect(d.timeFitTrimmed).toBe(true); expect(d.removedExercises).toBeGreaterThan(0);
  });
  it('D · cerca del budget pero nunca recorta → false', () => {
    // dosis 2/ej (mínimo) con budget generoso → no entra ningún while → sin recorte
    const d = emptyDiag(); prescribeSession(base(mains, alloc(2), 9999) as never, d);
    expect(d.timeFitTrimmed).toBe(false); expect(d.trimmedSets).toBe(0);
  });
  it('E · Fix E protege el floor y el algoritmo CEDE sobre budget SIN eliminar nada → false', () => {
    // 1 main-compound protegido, dosis = compoundMinSets (initial=floor) → paso (a) no puede reducir,
    // paso (b) no puede retirar (único/protegido) → total>budget pero CEDE, sin recorte.
    const one = mains.slice(0, 1);
    const d = emptyDiag();
    prescribeSession(base(one, { [one[0].muscleGroup]: 3 }, 1, { compoundMinSets: 3, protectedIds: new Set([one[0].id]) }) as never, d);
    expect(d.timeFitTrimmed).toBe(false); expect(d.trimmedSets).toBe(0); expect(d.removedExercises).toBe(0);
  });
  it('F · prescribeSession no recorta (headroom es POSTERIOR y no invocado aquí) → false', () => {
    // prescribeSession NO llama headroom; una sesión que cabe → false, independientemente de lo que
    // headroom haría después. El flag describe SOLO prescribeSession.
    const d = emptyDiag(); prescribeSession(base(mains, alloc(4), 9999) as never, d);
    expect(d.timeFitTrimmed).toBe(false);
  });
});

describe('coherencia trimmedSets/removedExercises', () => {
  it('retirar ejercicio implica trimmedSets>0 (sus sets desaparecen)', () => {
    const d = emptyDiag(); prescribeSession(base([...mains, ...isos], alloc(12), 5) as never, d);
    if (d.removedExercises > 0) expect(d.trimmedSets).toBeGreaterThan(0);
  });
});
