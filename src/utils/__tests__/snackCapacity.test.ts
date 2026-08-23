import { describe, it, expect } from 'vitest';
import { buildWeeklyPlan, dishMaxMacros, dishPreferredMaxMacros, type PlanTarget } from '../planEngine';
import { portionBoundsFor } from '../portionPlausibility';
import { BANCO } from '../../data/banco';

// ─────────────────────────────────────────────────────────────────────────────
// NUTRITION-N2 · CAPACITY-AWARE SNACK SELECTION.
// El snack se elige por CAPACIDAD PLAUSIBLE (¿alcanza la meta del slot sin pasar una porción PREFERIDA?)
// antes que por variedad/antojo. Un compuesto que cabe le gana a un fruit-only que se estiraría al hardMax.
// N1 (hardMax) queda intacto como techo de seguridad; N2 solo cambia QUÉ platillo entra al solver.
// ─────────────────────────────────────────────────────────────────────────────

const SNACKS = BANCO.filter(d => d.tiempo === 'Snack');
const mk = (kcal: number): PlanTarget => ({ kcal, protG: Math.round(kcal*0.28/4), fatG: Math.round(kcal*0.27/9), carbG: Math.round(kcal*0.45/4) });
const FRUIT = new Set(['berries', 'grapes', 'cutFruit', 'wholeFruit']);

function snackIngs(T: PlanTarget, seed: number) {
  const out: { nv: string; g: number; pref: number | null; hard: number | null; fam: string | null }[] = [];
  for (const d of buildWeeklyPlan(T, { seed })) for (const m of d.meals) {
    if (!m.time.startsWith('Snack')) continue;
    for (const ing of (m.ings ?? [])) if (ing.g != null && ing.g > 0) {
      const b = portionBoundsFor(ing.nv);
      out.push({ nv: ing.nv, g: ing.g, pref: b?.preferredMaxG ?? null, hard: b?.hardMaxG ?? null, fam: b?.family ?? null });
    }
  }
  return out;
}

// ── Helper de capacidad (§9) ─────────────────────────────────────────────────
describe('N2 · dishPreferredMaxMacros (capacidad preferida)', () => {
  it('A/B · preferida ≤ dura para TODO snack (nunca supera el techo N1)', () => {
    for (const d of SNACKS) {
      const p = dishPreferredMaxMacros(d), h = dishMaxMacros(d);
      for (let k = 0; k < 4; k++) expect(p[k]).toBeLessThanOrEqual(h[k] + 0.01);
    }
  });
  it('C · preserva la receta base (capacidad ≥ base servida a g0)', () => {
    for (const d of SNACKS) {
      const base = [d.fixed[0], d.fixed[1], d.fixed[2], d.fixed[3]];
      for (const ing of d.ings) if (ing.rol === 'principal' && ing.a) for (let k = 0; k < 4; k++) base[k] += ing.a[k] * ing.g0;
      const p = dishPreferredMaxMacros(d);
      expect(p[0]).toBeGreaterThanOrEqual(base[0] - 0.01);   // kcal preferida ≥ kcal base
    }
  });
  it('D · un platillo SIN principal acotado por N1 → preferida == dura', () => {
    const plain = SNACKS.find(d => d.ings.every(i => i.rol !== 'principal' || !i.a || portionBoundsFor(i.nv) == null));
    if (plain) expect(dishPreferredMaxMacros(plain)).toEqual(dishMaxMacros(plain));
  });
  it('G/H · determinista y no muta el platillo', () => {
    const d = SNACKS[0];
    const snap = JSON.stringify(d);
    expect(dishPreferredMaxMacros(d)).toEqual(dishPreferredMaxMacros(d));
    expect(JSON.stringify(d)).toBe(snap);
  });
});

// ── Selección (§8/§10/§28) ───────────────────────────────────────────────────
describe('N2 · el fruit-only ya no gana slots que no puede satisfacer', () => {
  it('flagship 2000 & 2200 kcal: NINGÚN ingrediente de snack llega al hardMax (era ~14–20%)', () => {
    for (const kcal of [2000, 2200]) {
      const hits: string[] = [];
      for (const seed of [7, 42, 99, 123, 256]) for (const x of snackIngs(mk(kcal), seed)) {
        if (x.hard != null && x.g >= x.hard - 0.5) hits.push(`${kcal}/${x.nv}=${x.g}`);
      }
      expect(hits).toEqual([]);
    }
  });
  it('1450–2200: fracción de ingredientes LARGE (>preferido) ≤ 3% (era ~20%)', () => {
    let total = 0, large = 0;
    for (const kcal of [1450, 1600, 1800, 2000, 2200]) for (const seed of [7, 42, 99]) for (const x of snackIngs(mk(kcal), seed)) {
      total++; if (x.pref != null && x.g > x.pref) large++;
    }
    expect(large / total).toBeLessThanOrEqual(0.03);
  });
  it('la fruta nunca supera su hardMax (N1 intacto) en todo el rango', () => {
    for (const kcal of [1450, 2000, 2500, 3000, 3500]) for (const seed of [7, 42]) for (const x of snackIngs(mk(kcal), seed)) {
      if (FRUIT.has(x.fam ?? '')) expect(x.g).toBeLessThanOrEqual((x.hard ?? Infinity) + 0.5);
    }
  });
});

describe('N2 · degradación honesta y determinismo', () => {
  it('C · genera plan válido en todo el rango (nunca vacío, sin gramos inválidos)', () => {
    for (const kcal of [1450, 1800, 2200, 2800, 3500]) {
      const days = buildWeeklyPlan(mk(kcal), { seed: 42 });
      expect(days).toHaveLength(7);
      for (const x of snackIngs(mk(kcal), 42)) { expect(Number.isFinite(x.g)).toBe(true); expect(x.g).toBeGreaterThan(0); }
    }
  });
  it('H · misma semilla → mismo plan (la señal de capacidad es determinista)', () => {
    const T = mk(2200);
    expect(JSON.stringify(buildWeeklyPlan(T, { seed: 42 }))).toBe(JSON.stringify(buildWeeklyPlan(T, { seed: 42 })));
  });
  it('macro-fit del día se mantiene dentro de la banda existente (kcal ≤12%)', () => {
    for (const kcal of [1800, 2200, 3000]) {
      const T = mk(kcal);
      for (const d of buildWeeklyPlan(T, { seed: 42 })) {
        const tot = d.meals.reduce((a, m) => a + (m.macros?.kcal ?? 0), 0);
        expect(Math.abs(tot - kcal) / kcal).toBeLessThan(0.12);
      }
    }
  });
});
