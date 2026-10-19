import { describe, it, expect } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// MENÚ HSC V1 · BLOQUE 6 · VARIEDAD + ELEGIBILIDAD.
//   · Variedad semanal por PENALIZACIÓN derivada del pool compatible (no exclusión), + día consecutivo, + grupo
//     principal de ayer. Misma política en CODE (`fitSlot`) y en IA (`assembleFromSelection`).
//   · El corrector de snacks rota al MENOS usado (antes: el primero del pool, 7/7 días).
//   · Bebidas licuadas (Batido / Smoothie): su `fijo` es masa y escala con el bloque.
//   · Diagnóstico de elegibilidad por tiempo (`explainMainSlot`): por qué una receta cerrada no entra.
// ─────────────────────────────────────────────────────────────────────────────
import { BANCO } from '../../data/banco';
import {
  buildWeeklyPlan, assembleFromSelection, adequateBankByTiempo, explainMainSlot, repetitionPenalty, makePolicyFilter,
  solveSlot, closedRecipeMacros, REPEAT_BASE, REPEAT_OVER_FAIR, REPEAT_CONSECUTIVE, type PlanTarget,
} from '../planEngine';
import type { DayPlan } from '../../types';

const mk = (kcal: number): PlanTarget => ({ kcal, protG: Math.round((kcal * 0.28) / 4), fatG: Math.round((kcal * 0.27) / 9), carbG: Math.round((kcal * 0.45) / 4) });
const mainsOf = (days: DayPlan[]) => days.map((d) => d.meals.filter((m) => !m.time.startsWith('Snack')).map((m) => m.name));
const snacksOf = (days: DayPlan[]) => days.map((d) => d.meals.filter((m) => m.time.startsWith('Snack')).flatMap((m) => m.name.split(' + ')));
const maxRep = (xs: string[]) => { const c = new Map<string, number>(); for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1); return Math.max(0, ...c.values()); };
const consecutive = (byDay: string[][]) => byDay.slice(1).reduce((a, d, i) => a + d.filter((n) => byDay[i].includes(n)).length, 0);

describe('política de repetición (derivada del pool)', () => {
  it('pool grande: la 2.ª vez ya cuesta fuerte; pool chico: repetir hasta su parte cuesta poco', () => {
    expect(repetitionPenalty(0, false, 60)).toBe(0);
    expect(repetitionPenalty(1, false, 60)).toBe(REPEAT_BASE + REPEAT_OVER_FAIR);           // fair = 1
    expect(repetitionPenalty(1, false, 2)).toBe(REPEAT_BASE);                               // fair = 4
    expect(repetitionPenalty(3, false, 2)).toBe(3 * REPEAT_BASE);
    expect(repetitionPenalty(4, false, 2)).toBe(4 * REPEAT_BASE + REPEAT_OVER_FAIR);
  });
  it('convexa (cada repetición extra cuesta más) y el día consecutivo suma', () => {
    const p = [0, 1, 2, 3].map((c) => repetitionPenalty(c, false, 20));
    for (let i = 2; i < p.length; i++) expect(p[i] - p[i - 1]).toBeGreaterThanOrEqual(p[i - 1] - p[i - 2]);
    expect(repetitionPenalty(1, true, 20) - repetitionPenalty(1, false, 20)).toBe(REPEAT_CONSECUTIVE);
  });
});

describe('CODE · variedad real sin perder exactitud', () => {
  it('sin restricciones: ninguna principal > 2 veces, ninguna en días consecutivos, día cerrado', () => {
    for (const k of [1500, 2200, 3000]) for (const seed of [7, 42]) {
      const T = mk(k);
      const days = buildWeeklyPlan(T, { seed });
      const m = mainsOf(days);
      expect(maxRep(m.flat()), `${k}/${seed}`).toBeLessThanOrEqual(2);
      expect(consecutive(m), `${k}/${seed}`).toBe(0);
      for (const d of days) expect(Math.abs(d.meals.reduce((a, x) => a + (x.macros?.kcal ?? 0), 0) - T.kcal) / T.kcal, `${k}/${seed}/d${d.day}`).toBeLessThan(0.02);
    }
  }, 240_000);
  it('pool chico por restricciones: el plan sale completo, la repetición se permite y la restricción nunca se relaja', () => {
    const avoid = { strict: ['lacteos', 'gluten', 'huevo'], soft: [] };
    const bad = makePolicyFilter(avoid);
    const byName = new Map(BANCO.map((d) => [d.nombre, d]));
    for (const k of [1500, 2500]) {
      const days = buildWeeklyPlan(mk(k), { seed: 7, avoid });
      expect(days).toHaveLength(7);
      for (const d of days) for (const m of d.meals) for (const n of m.name.split(' + ')) { const x = byName.get(n); if (x) expect(bad(x), n).toBe(false); }
    }
  }, 120_000);
});

describe('IA · la misma política: la IA no puede fijar la semana', () => {
  const T = mk(2200);
  const avoid = { strict: ['lacteos'], soft: [] };
  const bank = adequateBankByTiempo(avoid, T);
  const sn = bank.Snack.map((d) => d.nombre);
  it('una selección perezosa (lo mismo 7 días) sale variada', () => {
    const lazy = Array.from({ length: 7 }, () => ({ desayuno: bank.Desayuno[0].nombre, comida: bank.Comida[0].nombre, cena: bank.Cena[0].nombre, snacks: sn.slice(0, 3) }));
    const days = assembleFromSelection(T, lazy, avoid);
    expect(days).toHaveLength(7);
    const m = mainsOf(days);
    expect(new Set(m.flat()).size).toBeGreaterThanOrEqual(12);
    expect(consecutive(m)).toBe(0);
    expect(maxRep(snacksOf(days).flat())).toBeLessThanOrEqual(3);
  }, 120_000);
  it('una selección ya variada se respeta tal cual (la política solo actúa cuando se repite)', () => {
    const sel = Array.from({ length: 7 }, (_, i) => ({ desayuno: bank.Desayuno[i].nombre, comida: bank.Comida[i].nombre, cena: bank.Cena[i].nombre, snacks: sn.slice(0, 3) }));
    const days = assembleFromSelection(T, sel, avoid);
    expect(mainsOf(days)).toEqual(sel.map((s) => [s.desayuno, s.comida, s.cena]));
  }, 120_000);
});

describe('bebidas licuadas: la crema/miel/cacao/chía es parte de la masa', () => {
  const blended = BANCO.filter((d) => d.tipo === 'bloque' && /^(Batido|Smoothie)\b/.test(d.nombre));
  it('10 bebidas, sin `fijo`: todo escala junto', () => {
    expect(blended).toHaveLength(10);
    for (const d of blended) expect(d.ings.filter((i) => i.rol === 'fijo'), d.nombre).toEqual([]);
  });
  it('media bebida = media receta de CADA ingrediente', () => {
    const d = blended.find((x) => x.nombre.startsWith('Batido de Leche, Avena'))!;
    const base = closedRecipeMacros({ ...d, steps: [1] }, 'max');
    const m = solveSlot([d], 'Snack', [base[0] / 2, base[1] / 2, base[2] / 2, base[3] / 2])[0];
    const f = d.ings.filter((i) => i.rol === 'principal').map((i) => (m.ings!.find((x) => x.nv === i.nv)!.g as number) / i.g0);
    for (const x of f) expect(x).toBeCloseTo(f[0], 1);
  });
});

describe('elegibilidad · por qué la pasta cerrada no entraba (diagnóstico, no cambia el plan)', () => {
  // Bloque 7 · la banda por tiempo pasó a ×2 (24 %): el diagnóstico del Bloque 6 queda como evidencia de la causa
  // (la pasta solo fallaba por la proteína de SU tiempo, −22.6 %) y ahora entra; ver menuV1Bloque7.
  it('1500 kcal: la proteína del tiempo era lo único que la sacaba con la banda de 12 %', () => {
    const x = explainMainSlot(mk(1500), 'Comida');
    const p = x.rows.find((r) => r.nombre.startsWith('Pasta con Verduras'))!;
    expect(p.err.P).toBeLessThan(-12);
    expect(Math.abs(p.err.F)).toBeLessThanOrEqual(12);
    expect(Math.abs(p.err.C)).toBeLessThanOrEqual(12);
  });
  it('con lácteos o gluten queda fuera del pool (feta / pasta): restricción, no variedad', () => {
    for (const r of [['lacteos'], ['gluten']]) expect(explainMainSlot(mk(1500), 'Comida', { strict: r, soft: [] }).rows.some((y) => y.nombre.startsWith('Pasta con Verduras'))).toBe(false);
  });
});
