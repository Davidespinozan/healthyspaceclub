// Motor del plan de nutrición: arma días de 5 tiempos del banco de Magaly y ajusta
// las porciones (solo `principal`) a la meta del usuario, RESPETANDO el reparto de
// Magaly por comida (LOGICA 3.5): calorías 25/35/25/15, proteína pareja en las 3
// principales (snacks menos), carbos/grasa siguen el reparto, verduras en comida+cena.
// Reglas: fijo/guarnición/sub-receta/condimento quietos; `bloque` escala completo; `max_g` tope.
import { BANCO, type BancoDish, type BancoIng } from '../data/banco';
import type { DayPlan, MealItem } from '../types';

const IMG_BASE =
  'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PLATILLOS%20BANCO/';

export interface PlanTarget { kcal: number; protG: number; fatG: number; carbG: number }

const BY_TIME: Record<string, BancoDish[]> = { Desayuno: [], Comida: [], Cena: [], Snack: [] };
for (const d of BANCO) (BY_TIME[d.tiempo] ??= []).push(d);
const hasVeg = (d: BancoDish) => d.ings.some((i) => i.rol === 'guarnicion');
// Verduras SIEMPRE en comida y cena (Magaly). Prefiere platillos con guarnición.
const COMIDA_VEG = BY_TIME.Comida.filter(hasVeg);
const CENA_VEG = BY_TIME.Cena.filter(hasVeg);

// Cocina por nombre del platillo (heurística). El resto = mexicana (base del banco).
function cuisineOf(d: BancoDish): string {
  const n = d.nombre.toLowerCase();
  if (/ramen|yakimeshi|gohan|poke|noodles|tallarin|edamame/.test(n)) return 'japonesa';
  if (/pasta|espagueti|bolo|pizza|lasa/.test(n)) return 'italiana';
  if (/burger|bagel|waffle|french toast|hot cake|pancake/.test(n)) return 'americana';
  return 'mexicana';
}
// Sesga el pool hacia las cocinas elegidas; si quedan <2 (ej. no hay desayuno
// japonés), cae al pool completo para no quedarse sin variedad.
function biasPool(pool: BancoDish[], cuisines: string[]): BancoDish[] {
  if (!cuisines.length) return pool;
  const f = pool.filter((d) => cuisines.includes(cuisineOf(d)));
  return f.length >= 2 ? f : pool;
}

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

interface Var { a: number[]; g: number; g0: number; lo: number; hi: number; blk: number | null; ing: BancoIng }

const W = [1.5, 0.8, 1.0]; // pesos P, F, C (proteína prioridad)
const IDX = [1, 2, 3];     // posición de P,F,C en el vector [kcal,P,F,C]

function prep(dishes: BancoDish[]): { fixed: number[]; vars: Var[] } {
  const fixed = [0, 0, 0, 0];
  const vars: Var[] = [];
  dishes.forEach((d, si) => {
    const bloque = d.tipo === 'bloque';
    for (let i = 0; i < 4; i++) fixed[i] += d.fixed[i];
    for (const ing of d.ings) {
      if (ing.rol === 'principal' && ing.a) {
        const hi = ing.max && ing.max > 0 ? ing.max : Math.round(ing.g0 * 2.5);
        vars.push({ a: ing.a, g: ing.g0, g0: ing.g0, lo: ing.g0 * 0.4, hi, blk: bloque ? si : null, ing });
      }
    }
  });
  return { fixed, vars };
}

// Ajusta las porciones (vars) para acercar el total a T=[kcal,P,F,C] (fitea P,F,C).
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
      let nu = 0, de = 0;
      for (let j = 0; j < 3; j++) {
        const kk = IDX[j];
        const base = X[kk] - v.a[kk] * v.g;
        nu += W[j] * v.a[kk] * (base - T[kk]);
        de += W[j] * v.a[kk] * v.a[kk];
      }
      v.g = Math.max(v.lo, Math.min(v.hi, -nu / (de || 1e-9)));
    }
    for (const [, grp] of blocks) {
      const X = totals();
      const bk = [0, 0, 0, 0];
      for (const g of grp) for (let k = 0; k < 4; k++) bk[k] += g.a[k] * g.g0;
      let nu = 0, de = 0;
      for (let j = 0; j < 3; j++) {
        const kk = IDX[j];
        let sub = 0; for (const g of grp) sub += g.a[kk] * g.g;
        const base = X[kk] - sub;
        nu += W[j] * bk[kk] * (base - T[kk]);
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
  for (let j = 0; j < 3; j++) { const kk = IDX[j]; e = Math.max(e, Math.abs(x[kk] - T[kk]) / Math.max(T[kk], 1)); }
  return e * 100;
}

function pick<T>(arr: T[], rng: () => number): T { return arr[Math.floor(rng() * arr.length)]; }

function portionStr(ing: BancoIng, g: number | null): string {
  if (ing.rol === 'condimento') return `${ing.nv} al gusto`;
  if (ing.rol === 'sub-receta') return ing.nv;
  return `${Math.round(g ?? ing.g0)} g ${ing.nv}`;
}

function mealItemFrom(dish: BancoDish, label: string, gOf: Map<BancoIng, number>): MealItem {
  const m = [dish.fixed[0], dish.fixed[1], dish.fixed[2], dish.fixed[3]];
  const portions: string[] = [];
  const ings: { nv: string; g: number | null; rol: string }[] = [];
  for (const ing of dish.ings) {
    let g: number | null;
    if (ing.rol === 'principal' && gOf.has(ing)) {
      g = gOf.get(ing)!;
      if (ing.a) for (let k = 0; k < 4; k++) m[k] += ing.a[k] * g;
      g = Math.round(g);
    } else if (ing.rol === 'condimento') g = null;
    else g = ing.g0;
    portions.push(portionStr(ing, g));
    ings.push({ nv: ing.nv, g, rol: ing.rol });
  }
  return {
    time: label,
    name: dish.nombre,
    desc: dish.ings.filter((i) => i.rol === 'principal').slice(0, 3).map((i) => i.nv).join(' · '),
    img: IMG_BASE + dish.img,
    portions,
    macros: { kcal: Math.round(m[0]), prot: Math.round(m[1]), fat: Math.round(m[2]), carb: Math.round(m[3]) },
    ings,
  };
}

// Fusiona varios platillos (snacks combinados) en UNA sola comida — un solo card,
// no el snack repetido. Suma macros, junta ingredientes, usa la 1ª foto disponible.
function mergeItems(items: MealItem[], label: string): MealItem {
  const macros = { kcal: 0, prot: 0, fat: 0, carb: 0 };
  for (const it of items) {
    macros.kcal += it.macros?.kcal ?? 0; macros.prot += it.macros?.prot ?? 0;
    macros.fat += it.macros?.fat ?? 0; macros.carb += it.macros?.carb ?? 0;
  }
  const imgs = items.map((i) => i.img).filter((s): s is string => !!s);
  return {
    time: label,
    name: items.map((i) => i.name).join(' + '),
    desc: items.map((i) => i.desc).filter(Boolean).join(' · '),
    img: imgs[0],
    imgs,
    portions: items.flatMap((i) => i.portions),
    macros,
    ings: items.flatMap((i) => i.ings ?? []),
  };
}

// Busca el mejor conjunto de `n` platillos de `pool` para pegar el target de ESTE
// tiempo, y devuelve sus MealItem (ya ajustados). needVeg exige guarnición (comida/cena).
// merge=true → devuelve UNA comida combinada (snacks: los dos dentro del mismo).
function fitSlot(
  pool: BancoDish[], label: string, target: number[], n: number,
  rng: () => number, avoid: (d: BancoDish) => boolean, trials: number, merge = false,
): MealItem[] {
  const pickDish = () => { for (let i = 0; i < 20; i++) { const d = pick(pool, rng); if (!avoid(d)) return d; } return pick(pool, rng); };
  const pickN = () => { const out: BancoDish[] = []; let g = 0; while (out.length < n && g++ < 40) { const d = pickDish(); if (!out.includes(d)) out.push(d); } return out; };
  let best: { dishes: BancoDish[]; e: number } | null = null;
  for (let t = 0; t < trials; t++) {
    const dishes = pickN();
    const { fixed, vars } = prep(dishes);
    solve(fixed, vars, target, 100);
    const e = errMax(fixed, vars, target);
    if (!best || e < best.e) best = { dishes, e };
  }
  const dishes = best!.dishes;
  const { fixed, vars } = prep(dishes);
  solve(fixed, vars, target, 220);
  void fixed;
  const gOf = new Map<BancoIng, number>();
  for (const v of vars) gOf.set(v.ing, v.g);
  const items = dishes.map((d) => mealItemFrom(d, label, gOf));
  return merge && items.length > 1 ? [mergeItems(items, label)] : items;
}

// Reparto de Magaly por comida (LOGICA 3.5). Proteína pareja en las 3 principales
// (0.30 c/u) y menos en snacks (0.10 total); carbos y grasa siguen el reparto calórico.
function mealTargets(T: number[]): { desayuno: number[]; comida: number[]; cena: number[]; snackSlot: number[] } {
  const [, P, F, C] = T;
  return {
    desayuno:  [0, 0.30 * P, 0.25 * F, 0.25 * C],
    comida:    [0, 0.30 * P, 0.35 * F, 0.35 * C],
    cena:      [0, 0.30 * P, 0.25 * F, 0.25 * C],
    snackSlot: [0, 0.05 * P, 0.075 * F, 0.075 * C], // por slot (AM y PM); 2 slots = 0.10P/0.15F/0.15C
  };
}

function buildDay(dayNum: number, T: number[], rng: () => number, avoid: (d: BancoDish) => boolean, cuisines: string[]): DayPlan {
  const nSnack = T[0] > 2200 ? 2 : 1; // atleta: combina 2 snacks por slot
  const MT = mealTargets(T);
  const des = biasPool(BY_TIME.Desayuno, cuisines);
  const com = biasPool(COMIDA_VEG.length ? COMIDA_VEG : BY_TIME.Comida, cuisines);
  const cen = biasPool(CENA_VEG.length ? CENA_VEG : BY_TIME.Cena, cuisines);
  const meals: MealItem[] = [
    ...fitSlot(des, 'Desayuno', MT.desayuno, 1, rng, avoid, 90),
    ...fitSlot(BY_TIME.Snack, 'Snack AM', MT.snackSlot, nSnack, rng, avoid, 70, true),
    ...fitSlot(com, 'Comida', MT.comida, 1, rng, avoid, 90),
    ...fitSlot(BY_TIME.Snack, 'Snack PM', MT.snackSlot, nSnack, rng, avoid, 70, true),
    ...fitSlot(cen, 'Cena', MT.cena, 1, rng, avoid, 90),
  ];
  return { day: dayNum, theme: '', meals };
}

export interface BuildOpts { seed?: number; avoid?: string[]; cuisines?: string[] }

/** Genera 7 días ajustados a la meta del usuario, con el reparto por comida de Magaly. */
export function buildWeeklyPlan(target: PlanTarget, opts: BuildOpts = {}): DayPlan[] {
  const T = [target.kcal, target.protG, target.fatG, target.carbG];
  const rng = mulberry32(opts.seed ?? 12345);
  const avoidTerms = (opts.avoid ?? []).map((s) => s.toLowerCase().trim()).filter(Boolean);
  const avoid = (d: BancoDish) =>
    avoidTerms.length > 0 &&
    avoidTerms.some((t) => d.nombre.toLowerCase().includes(t) || d.ings.some((i) => i.nv.toLowerCase().includes(t)));
  const cuisines = (opts.cuisines ?? []).map((s) => s.toLowerCase().trim()).filter(Boolean);
  const days: DayPlan[] = [];
  for (let i = 1; i <= 7; i++) days.push(buildDay(i, T, rng, avoid, cuisines));
  return days;
}
