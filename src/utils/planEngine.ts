// Motor del plan de nutrición: arma días de 5 tiempos del banco de Magaly y ajusta
// las porciones (solo `principal`) a la meta del usuario. Reglas: fijo/guarnición/
// sub-receta/condimento quietos; `bloque` escala completo; `max_g` es tope duro.
// Portado de scripts/plan_engine.py (mismo solver de mínimos cuadrados acotados).
import { BANCO, type BancoDish, type BancoIng } from '../data/banco';
import type { DayPlan, MealItem } from '../types';

const IMG_BASE =
  'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PLATILLOS%20BANCO/';

export interface PlanTarget { kcal: number; protG: number; fatG: number; carbG: number }

const BY_TIME: Record<string, BancoDish[]> = { Desayuno: [], Comida: [], Cena: [], Snack: [] };
for (const d of BANCO) (BY_TIME[d.tiempo] ??= []).push(d);

// RNG determinista (mismo plan para misma semilla)
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Var { a: number[]; g: number; g0: number; lo: number; hi: number; blk: number | null; slot: number; ing: BancoIng }

const W = [1.5, 0.8, 1.0]; // pesos P, F, C (proteína prioridad)
const IDX = [1, 2, 3];     // posición de P,F,C en el vector [kcal,P,F,C]

function prepDay(slots: { dish: BancoDish }[]): { fixed: number[]; vars: Var[] } {
  const fixed = [0, 0, 0, 0];
  const vars: Var[] = [];
  slots.forEach((s, si) => {
    const bloque = s.dish.tipo === 'bloque';
    for (let i = 0; i < 4; i++) fixed[i] += s.dish.fixed[i];
    for (const ing of s.dish.ings) {
      if (ing.rol === 'principal' && ing.a) {
        const hi = ing.max && ing.max > 0 ? ing.max : Math.round(ing.g0 * 2.5);
        vars.push({ a: ing.a, g: ing.g0, g0: ing.g0, lo: ing.g0 * 0.4, hi, blk: bloque ? si : null, slot: si, ing });
      }
    }
  });
  return { fixed, vars };
}

function solve(fixed: number[], vars: Var[], T: number[], iters = 160): void {
  const blocks = new Map<number, Var[]>();
  for (const v of vars) if (v.blk !== null) (blocks.get(v.blk) ?? blocks.set(v.blk, []).get(v.blk)!).push(v);
  const totals = () => {
    const x = [fixed[0], fixed[1], fixed[2], fixed[3]];
    for (const v of vars) for (let k = 0; k < 4; k++) x[k] += v.a[k] * v.g;
    return x;
  };
  for (let it = 0; it < iters; it++) {
    for (const v of vars) {
      if (v.blk !== null) continue;
      const X = totals();
      const base = [0, 0, 0, 0];
      for (let k = 0; k < 4; k++) base[k] = X[k] - v.a[k] * v.g;
      let nu = 0, de = 0;
      for (let j = 0; j < 3; j++) {
        const kk = IDX[j];
        nu += W[j] * v.a[kk] * (base[kk] - T[kk]);
        de += W[j] * v.a[kk] * v.a[kk];
      }
      v.g = Math.max(v.lo, Math.min(v.hi, -nu / (de || 1e-9)));
    }
    for (const [, grp] of blocks) {
      const X = totals();
      const bk = [0, 0, 0, 0];
      for (const g of grp) for (let k = 0; k < 4; k++) bk[k] += g.a[k] * g.g0;
      const base = [0, 0, 0, 0];
      for (let k = 0; k < 4; k++) { let sub = 0; for (const g of grp) sub += g.a[k] * g.g; base[k] = X[k] - sub; }
      let nu = 0, de = 0;
      for (let j = 0; j < 3; j++) {
        const kk = IDX[j];
        nu += W[j] * bk[kk] * (base[kk] - T[kk]);
        de += W[j] * bk[kk] * bk[kk];
      }
      const s = Math.max(0.5, Math.min(1.5, -nu / (de || 1e-9)));
      for (const g of grp) g.g = g.g0 * s;
    }
  }
}

function errMax(fixed: number[], vars: Var[], T: number[]): number {
  const x = [fixed[0], fixed[1], fixed[2], fixed[3]];
  for (const v of vars) for (let k = 0; k < 4; k++) x[k] += v.a[k] * v.g;
  let e = 0;
  for (let k = 0; k < 4; k++) e = Math.max(e, Math.abs(x[k] - T[k]) / Math.max(T[k], 1));
  return e * 100;
}

function pick<T>(arr: T[], rng: () => number): T { return arr[Math.floor(rng() * arr.length)]; }

function assemble(T: number[], rng: () => number, avoid: (d: BancoDish) => boolean): { label: string; dish: BancoDish }[] {
  const n = T[0] > 2200 ? 2 : 1;
  const pickFrom = (pool: BancoDish[]) => {
    for (let tries = 0; tries < 20; tries++) { const d = pick(pool, rng); if (!avoid(d)) return d; }
    return pick(pool, rng);
  };
  const snacks = (k: number) => {
    const out: BancoDish[] = [];
    let guard = 0;
    while (out.length < k && guard++ < 40) { const s = pickFrom(BY_TIME.Snack); if (!out.includes(s)) out.push(s); }
    return out;
  };
  return [
    { label: 'Desayuno', dish: pickFrom(BY_TIME.Desayuno) },
    ...snacks(n).map((d) => ({ label: 'Snack AM', dish: d })),
    { label: 'Comida', dish: pickFrom(BY_TIME.Comida) },
    ...snacks(n).map((d) => ({ label: 'Snack PM', dish: d })),
    { label: 'Cena', dish: pickFrom(BY_TIME.Cena) },
  ];
}

function portionStr(ing: BancoIng, g: number | null): string {
  if (ing.rol === 'condimento') return `${ing.nv} al gusto`;
  if (ing.rol === 'sub-receta') return ing.nv;
  return `${Math.round(g ?? ing.g0)} g ${ing.nv}`;
}

function buildDay(dayNum: number, T: number[], rng: () => number, avoid: (d: BancoDish) => boolean, trials = 140): DayPlan {
  let best: { e: number; slots: { label: string; dish: BancoDish }[] } | null = null;
  const seen = new Set<string>();
  for (let t = 0; t < trials; t++) {
    const slots = assemble(T, rng, avoid);
    const key = slots.map((s) => s.dish.nombre).join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    const { fixed, vars } = prepDay(slots);
    solve(fixed, vars, T, 120);
    const e = errMax(fixed, vars, T);
    if (!best || e < best.e) best = { e, slots };
  }
  const slots = best!.slots;
  const { fixed, vars } = prepDay(slots);
  solve(fixed, vars, T, 220);
  const gOf = new Map<BancoIng, number>();
  for (const v of vars) gOf.set(v.ing, v.g);

  const meals: MealItem[] = slots.map((s) => {
    const m = [s.dish.fixed[0], s.dish.fixed[1], s.dish.fixed[2], s.dish.fixed[3]];
    for (const v of vars) if (v.slot === slots.indexOf(s)) for (let k = 0; k < 4; k++) m[k] += v.a[k] * v.g;
    const portions: string[] = [];
    const ings: { nv: string; g: number | null; rol: string }[] = [];
    for (const ing of s.dish.ings) {
      const g = ing.rol === 'principal' && gOf.has(ing) ? Math.round(gOf.get(ing)!) : ing.rol === 'condimento' ? null : ing.g0;
      portions.push(portionStr(ing, g));
      ings.push({ nv: ing.nv, g, rol: ing.rol });
    }
    return {
      time: s.label,
      name: s.dish.nombre,
      desc: s.dish.ings.filter((i) => i.rol === 'principal').slice(0, 3).map((i) => i.nv).join(' · '),
      img: IMG_BASE + s.dish.img,
      portions,
      macros: { kcal: Math.round(m[0]), prot: Math.round(m[1]), fat: Math.round(m[2]), carb: Math.round(m[3]) },
      ings,
    };
  });
  return { day: dayNum, theme: '', meals };
}

export interface BuildOpts { seed?: number; avoid?: string[] }

/** Genera 7 días ajustados a la meta del usuario. */
export function buildWeeklyPlan(target: PlanTarget, opts: BuildOpts = {}): DayPlan[] {
  const T = [target.kcal, target.protG, target.fatG, target.carbG];
  const rng = mulberry32(opts.seed ?? 12345);
  const avoidTerms = (opts.avoid ?? []).map((s) => s.toLowerCase().trim()).filter(Boolean);
  const avoid = (d: BancoDish) =>
    avoidTerms.length > 0 &&
    avoidTerms.some((t) => d.nombre.toLowerCase().includes(t) || d.ings.some((i) => i.nv.toLowerCase().includes(t)));
  const days: DayPlan[] = [];
  for (let i = 1; i <= 7; i++) days.push(buildDay(i, T, rng, avoid));
  return days;
}
