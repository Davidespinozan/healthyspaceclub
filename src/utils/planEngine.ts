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

// ── Texto de cada platillo (nombre + ingredientes), sin acentos, para "evitar"/"antojo" ──
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// Clave de ingrediente para rotación: 1ª palabra (agrupa "Aguacate"/"Aguacate machacado"
// y "Pollo deshebrado"/"Pollo en trozos") → penaliza repetir la misma base en la semana.
const ingKey = (nv: string) => norm(nv).split(/\s+/)[0] || nv;
const dishPrincKeys = (d: BancoDish) => d.ings.filter((i) => i.rol === 'principal').map((i) => ingKey(i.nv));
const DTEXT = new Map<BancoDish, { text: string; words: Set<string> }>();
for (const d of BANCO) {
  const text = norm(d.nombre + ' ' + d.ings.map((i) => i.nv).join(' '));
  DTEXT.set(d, { text, words: new Set(text.split(/[^a-z0-9]+/).filter(Boolean)) });
}
// term con espacio → substring; palabra suelta → límite de palabra (evita "pan" en "panela").
function dishMatches(d: BancoDish, term: string): boolean {
  const e = DTEXT.get(d)!;
  return term.includes(' ') ? e.text.includes(term) : e.words.has(term);
}
const dishMatchesAny = (d: BancoDish, terms: string[]) => terms.some((t) => dishMatches(d, t));

// Categorías de "evitar" / alergias → alimentos/palabras reales del banco.
const AVOID_MAP: Record<string, string[]> = {
  gluten: ['pan', 'pasta', 'espagueti', 'bagel', 'waffle', 'waffles', 'pita', 'tallarines', 'noodles', 'galleta', 'galletas', 'crutones', 'cereal', 'tortilla de harina', 'hot cake', 'hot cakes', 'corn flakes'],
  lacteos: ['leche', 'queso', 'yogur', 'yoghurt', 'yogurt', 'requeson', 'ricotta', 'cottage', 'panela', 'oaxaca', 'feta', 'mozzarella', 'parmesano', 'crema acida'],
  'carne-roja': ['res', 'sirloin', 'bistec', 'falda', 'molida', 'machaca', 'chambarete', 'arrachera'],
  mariscos: ['camaron', 'camarones', 'marisco', 'mariscos'],
  // Alergias:
  huevo: ['huevo', 'huevos'],
  'frutos-secos': ['nuez', 'nueces', 'almendra', 'almendras', 'pistache', 'pistaches', 'avellana', 'avellanas'],
  cacahuate: ['cacahuate', 'cacahuates'],
  soya: ['soya', 'edamame', 'edamames'],
  pescado: ['pescado', 'salmon', 'atun', 'tilapia', 'bacalao'],
  ajonjoli: ['ajonjoli', 'sesamo'],
};
function expandAvoid(raw: string[]): string[] {
  const skip = new Set(['nada', 'ninguno', 'ninguna', 'todas', 'todo', 'todos']);
  const out: string[] = [];
  for (const a of raw) { if (skip.has(a)) continue; out.push(...(AVOID_MAP[a] ?? [a])); }
  return out.map(norm);
}
const STOP = new Set(['algo', 'con', 'sin', 'del', 'los', 'las', 'una', 'uno', 'que', 'por', 'para', 'muy', 'mas', 'antoja', 'antojo', 'quiero', 'comer', 'tipo', 'como', 'mucho', 'poco']);
function cravingTerms(text: string): string[] {
  return norm(text).split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));
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
  const fixed = [0, 0, 0, 0, 0]; // kcal, P, F, C, fibra
  const vars: Var[] = [];
  dishes.forEach((d, si) => {
    const bloque = d.tipo === 'bloque';
    for (let i = 0; i < 5; i++) fixed[i] += d.fixed[i];
    for (const ing of d.ings) {
      if (ing.rol === 'principal' && ing.a) {
        // Tope: almidones (carbo-dominantes) más ajustados (2.0×) → evita porciones enormes.
        const carbDom = ing.a[3] > ing.a[1] && ing.a[3] > ing.a[2];
        const hi = ing.max && ing.max > 0 ? ing.max : Math.round(ing.g0 * (carbDom ? 2.0 : 2.5));
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
    const x = [fixed[0], fixed[1], fixed[2], fixed[3], fixed[4]];
    for (const v of vars) for (let k = 0; k < 5; k++) x[k] += v.a[k] * v.g;
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
  const x = [fixed[0], fixed[1], fixed[2], fixed[3], fixed[4]];
  for (const v of vars) for (let k = 0; k < 5; k++) x[k] += v.a[k] * v.g;
  let e = 0;
  for (let j = 0; j < 3; j++) { const kk = IDX[j]; e = Math.max(e, Math.abs(x[kk] - T[kk]) / Math.max(T[kk], 1)); }
  return e * 100;
}

function pick<T>(arr: T[], rng: () => number): T { return arr[Math.floor(rng() * arr.length)]; }

// Alimentos que se PARTEN en fracción real (se corta ⅓ de aguacate, ¾ de plátano).
// El resto son contables (huevo, tortilla, pan, tostada) → solo entero o medio.
const DIVISIBLE = new Set(['aguacate', 'plátano', 'mango', 'papaya', 'melón', 'toronja']);
// Fracciones naturales que la gente usa (⅓ aguacate, ¾ de plátano…), no solo medios.
const FRACS: Array<[number, string]> = [[0, ''], [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾']];
// Redondea a la fracción natural más cercana (o al entero de arriba si está muy cerca).
function snapCount(x: number): number {
  const whole = Math.floor(x);
  const frac = x - whole;
  let best = FRACS[0];
  for (const f of FRACS) if (Math.abs(f[0] - frac) < Math.abs(best[0] - frac)) best = f;
  return 1 - frac < Math.abs(best[0] - frac) ? whole + 1 : whole + best[0];
}
function fmtCount(n: number): string {
  const whole = Math.floor(n + 1e-9);
  const frac = n - whole;
  let sym = '', bestd = 0.06; // tolerancia para casar la fracción
  for (const [v, s] of FRACS) { const d = Math.abs(v - frac); if (s && d < bestd) { bestd = d; sym = s; } }
  return sym ? (whole ? String(whole) : '') + sym : String(whole);
}
function pluralNoun(un: string, n: number): string {
  if (n <= 1) return un; // "1 huevo", "½ manzana"
  const [head, ...rest] = un.split(' ');
  if (/s$/i.test(head)) return un; // ya plural (espárragos)
  // vocal → +s (huevo→huevos); consonante → +es quitando acento agudo final (melón→melones)
  const p = /[aeiouáéíóú]$/i.test(head)
    ? head + 's'
    : head.replace(/ó(?=n$)/, 'o').replace(/á(?=n$)/, 'a').replace(/é(?=n$)/, 'e') + 'es';
  return [p, ...rest].join(' ');
}
// La gente cuenta huevos/tortillas, no los pesa. Si el alimento trae medida casera
// (pu = g por pieza) y la cantidad cae en un conteo limpio y creíble (0.5–8 piezas,
// error ≤20% para que el conteo no engañe sobre la porción), se muestra "2 huevos"
// en vez de "88 g". Si no, se queda en gramos.
function portionStr(ing: BancoIng, g: number | null): string {
  if (ing.rol === 'condimento') return `${ing.nv} al gusto`;
  if (ing.rol === 'sub-receta') return ing.nv;
  const grams = Math.round(g ?? ing.g0);
  if (ing.pu && ing.un && grams > 0) {
    const raw = grams / ing.pu;
    // Cortables (se parten en fracción real: ⅓ aguacate, ¾ plátano) → fracciones finas.
    // Contables (huevo, tortilla, pan, tostada, fruta chica) → solo entero/medio.
    const n = DIVISIBLE.has(ing.un)
      ? Math.max(0.25, snapCount(raw))
      : Math.max(0.5, Math.round(raw * 2) / 2);
    if (n <= 8 && Math.abs(n * ing.pu - grams) <= 0.20 * grams) {
      return `${fmtCount(n)} ${pluralNoun(ing.un, n)}`;
    }
  }
  return `${grams} g ${ing.nv}`;
}

function mealItemFrom(dish: BancoDish, label: string, gOf: Map<BancoIng, number>): MealItem {
  const m = [dish.fixed[0], dish.fixed[1], dish.fixed[2], dish.fixed[3], dish.fixed[4]];
  const portions: string[] = [];
  const ings: { nv: string; g: number | null; rol: string }[] = [];
  for (const ing of dish.ings) {
    let g: number | null;
    if (ing.rol === 'principal' && gOf.has(ing)) {
      g = gOf.get(ing)!;
      if (ing.a) for (let k = 0; k < 5; k++) m[k] += ing.a[k] * g;
      g = Math.round(g);
    } else if (ing.rol === 'condimento') g = null;
    else g = ing.g0;
    portions.push(portionStr(ing, g));
    ings.push({ nv: ing.nv, g, rol: ing.rol });
  }
  // kcal derivado de las macros (Atwater 4/4/9), no el kcal crudo del alimento →
  // así el total cuadra con la meta (que también es Atwater) y el usuario lo verifica.
  const prot = Math.round(m[1]), fat = Math.round(m[2]), carb = Math.round(m[3]);
  return {
    time: label,
    name: dish.nombre,
    desc: dish.ings.filter((i) => i.rol === 'principal').slice(0, 3).map((i) => i.nv).join(' · '),
    img: IMG_BASE + dish.img,
    portions,
    macros: { kcal: Math.round(prot * 4 + carb * 4 + fat * 9), prot, fat, carb, fiber: Math.round(m[4]) },
    ings,
  };
}

// Fusiona varios platillos (snacks combinados) en UNA sola comida — un solo card,
// no el snack repetido. Suma macros, junta ingredientes, usa la 1ª foto disponible.
function mergeItems(items: MealItem[], label: string): MealItem {
  const macros = { kcal: 0, prot: 0, fat: 0, carb: 0, fiber: 0 };
  for (const it of items) {
    macros.prot += it.macros?.prot ?? 0;
    macros.fat += it.macros?.fat ?? 0; macros.carb += it.macros?.carb ?? 0;
    macros.fiber += it.macros?.fiber ?? 0;
  }
  macros.kcal = Math.round(macros.prot * 4 + macros.carb * 4 + macros.fat * 9); // Atwater, cuadra con macros
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
  rng: () => number, trials: number,
  used: Set<string>, usedToday: Set<string>, usedTodayIng: Set<string>, craving: string[],
  ingFreq: Map<string, number>, merge = false,
): MealItem[] {
  // El pool ya viene filtrado por alergia (buildDay) → aquí no se cuela ningún alérgeno.
  const princKeys = (d: BancoDish) => d.ings.filter((i) => i.rol === 'principal').map((i) => ingKey(i.nv));
  // pickN nunca junta en el MISMO slot dos platillos que compartan ingrediente principal
  // (ej. "zanahoria y pepino con hummus" + "bastones de zanahoria" → el snack se repetía).
  const shares = (a: BancoDish, b: BancoDish) => { const ka = new Set(princKeys(a)); return princKeys(b).some((k) => ka.has(k)); };
  const pickN = () => { const out: BancoDish[] = []; let g = 0; while (out.length < n && g++ < 60) { const d = pick(pool, rng); if (out.includes(d) || out.some((o) => shares(o, d))) continue; out.push(d); } return out; };
  const cands: { dishes: BancoDish[]; e: number; used: number; craves: number; ingScore: number; dayIng: number; fib: number }[] = [];
  for (let t = 0; t < trials; t++) {
    const dishes = pickN();
    const { fixed, vars } = prep(dishes);
    solve(fixed, vars, target, 100);
    const e = errMax(fixed, vars, target);
    const craves = craving.length ? dishes.filter((d) => dishMatchesAny(d, craving)).length : 0;
    // ingScore = repetición en la SEMANA; dayIng = ingrediente principal ya usado HOY
    // en otro tiempo (evita zanahoria en snack AM y otra vez en PM, pollo en comida y cena).
    let ingScore = 0, dayIng = 0;
    for (const d of dishes) for (const k of princKeys(d)) { ingScore += ingFreq.get(k) ?? 0; if (usedTodayIng.has(k)) dayIng++; }
    let fib = fixed[4]; for (const v of vars) fib += v.a[4] * v.g;
    cands.push({ dishes, e, used: dishes.filter((d) => used.has(d.nombre)).length, craves, ingScore, dayIng, fib });
  }
  // Aceptables = los que pegan razonable (error ≤ 12%; holgura porque cada tiempo es ~¼
  // del día). Entre ellos: 1) ANTOJO, 2) NO repetir ingrediente el mismo día, 3) variedad
  // semanal (platillo e ingrediente menos repetidos → rota aguacate/pollo), 4) fibra, 5) ajuste.
  const minE = Math.min(...cands.map((c) => c.e));
  // Snacks (merge): banda MÁS ancha (son ~5% del día). Pools CHICOS (cena: 26 platillos)
  // también: a metas bajas casi nada cae en la banda estrecha y se repite la misma cena
  // a diario. Banda más ancha → entran más opciones y la variedad (used/ingFreq) las rota.
  const cap = merge
    ? Math.max(30, minE + 12)
    : (pool.length < 30 ? Math.max(22, minE + 8) : Math.max(12, minE + 2));
  const acceptable = cands.filter((c) => c.e <= cap);
  acceptable.sort((a, b) =>
    (b.craves - a.craves) ||
    // variedad: platillo repetido en la semana (50) pesa más que ingrediente repetido
    // hoy (30) — así la cena (pool chico) no repite platillos entre días, pero cuando hay
    // opción fresca (score 0) se prefiere no repetir ingrediente el mismo día.
    ((a.used * 50 + a.dayIng * 30 + a.ingScore) - (b.used * 50 + b.dayIng * 30 + b.ingScore)) ||
    (b.fib - a.fib) ||
    (a.e - b.e),
  );
  const dishes = acceptable[0].dishes;
  for (const d of dishes) { used.add(d.nombre); usedToday.add(d.nombre); for (const k of princKeys(d)) { ingFreq.set(k, (ingFreq.get(k) ?? 0) + 1); usedTodayIng.add(k); } }
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

function buildDay(dayNum: number, T: number[], rng: () => number, avoid: (d: BancoDish) => boolean, cuisines: string[], used: Set<string>, craving: string[], ingFreq: Map<string, number>): DayPlan {
  const nSnack = T[0] > 2200 ? 2 : 1; // atleta: combina 2 snacks por slot
  const MT = mealTargets(T);
  // Filtra por alergia de RAÍZ (nunca sirve un platillo con el alérgeno). Si un tiempo se
  // queda sin opciones (varias alergias juntas), JAMÁS cae al alérgeno: usa cualquier
  // platillo compatible del banco (una comida sirve de desayuno). Solo si NADA en las 175
  // recetas cumple (imposible en la práctica) usa el pool para no romper.
  const anyCompliant = BANCO.filter((d) => !avoid(d));
  const clean = (pool: BancoDish[]) => {
    const f = pool.filter((d) => !avoid(d));
    return f.length ? f : (anyCompliant.length ? anyCompliant : pool);
  };
  // Cada tiempo usa SOLO los platillos que Magaly designó para ese tiempo —
  // desayuno=Desayuno, comida=Comida, cena=Cena. NO se revuelven entre sí.
  const des = clean(biasPool(BY_TIME.Desayuno, cuisines));
  const com = clean(biasPool(COMIDA_VEG.length ? COMIDA_VEG : BY_TIME.Comida, cuisines));
  const cen = clean(biasPool(CENA_VEG.length ? CENA_VEG : BY_TIME.Cena, cuisines));
  const snack = clean(BY_TIME.Snack);
  // Regla dura: NADA se repite dentro del mismo día (ni comida ni snack, ni una comida
  // como cena). avail() saca del pool lo ya usado hoy; fitSlot va llenando usedToday.
  const usedToday = new Set<string>();
  const usedTodayIng = new Set<string>(); // ingredientes principales ya usados hoy → no repetir en el día
  const avail = (pool: BancoDish[]) => { const f = pool.filter((d) => !usedToday.has(d.nombre)); return f.length ? f : pool; };
  // Snacks: regla DURA de ingrediente. Un snack casi ES su ingrediente (yogurt, zanahoria),
  // así que dos snacks del mismo ingrediente en el día se sienten repetidos aunque el
  // platillo sea distinto. Excluye del pool los que compartan principal con lo ya usado hoy.
  const availSnack = (pool: BancoDish[]) => {
    const fresh = pool.filter((d) => !usedToday.has(d.nombre) && !dishPrincKeys(d).some((k) => usedTodayIng.has(k)));
    return fresh.length ? fresh : pool.filter((d) => !usedToday.has(d.nombre));
  };
  const meals: MealItem[] = [
    ...fitSlot(avail(des), 'Desayuno', MT.desayuno, 1, rng, 90, used, usedToday, usedTodayIng, craving, ingFreq),
    ...fitSlot(availSnack(snack), 'Snack AM', MT.snackSlot, nSnack, rng, 70, used, usedToday, usedTodayIng, craving, ingFreq, true),
    ...fitSlot(avail(com), 'Comida', MT.comida, 1, rng, 90, used, usedToday, usedTodayIng, craving, ingFreq),
    ...fitSlot(availSnack(snack), 'Snack PM', MT.snackSlot, nSnack, rng, 70, used, usedToday, usedTodayIng, craving, ingFreq, true),
    ...fitSlot(avail(cen), 'Cena', MT.cena, 1, rng, 90, used, usedToday, usedTodayIng, craving, ingFreq),
  ];
  return { day: dayNum, theme: '', meals };
}

// Versión del motor de nutrición. Súbela al cambiar la lógica (tiempos, variedad,
// pools…): los planes guardados con versión menor se auto-regeneran al abrir nutrición.
export const PLAN_ENGINE_VERSION = 5;

export interface BuildOpts { seed?: number; avoid?: string[]; cuisines?: string[]; craving?: string }

/** Genera 7 días ajustados a la meta del usuario, con el reparto por comida de Magaly. */
export function buildWeeklyPlan(target: PlanTarget, opts: BuildOpts = {}): DayPlan[] {
  const T = [target.kcal, target.protG, target.fatG, target.carbG];
  const rng = mulberry32(opts.seed ?? 12345);
  // "Evitar": categoría (gluten/lácteos/…) → alimentos reales del banco; excluye esos platillos.
  const avoidTerms = expandAvoid((opts.avoid ?? []).map((s) => s.toLowerCase().trim()).filter(Boolean));
  const avoid = (d: BancoDish) => avoidTerms.length > 0 && dishMatchesAny(d, avoidTerms);
  const cuisines = (opts.cuisines ?? []).map((s) => s.toLowerCase().trim()).filter(Boolean);
  const craving = cravingTerms(opts.craving ?? ''); // "antojo": prefiere platillos que lo tengan
  const used = new Set<string>();          // platillos ya usados en la semana → variedad entre días
  const ingFreq = new Map<string, number>(); // ingredientes ya usados → rota fuentes (aguacate/pollo)
  const days: DayPlan[] = [];
  for (let i = 1; i <= 7; i++) days.push(buildDay(i, T, rng, avoid, cuisines, used, craving, ingFreq));
  return days;
}
