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
// Antojo: cuántas veces ya salió cada platillo antojado en ESTA semana (tope 2).
// Se reinicia al inicio de cada buildWeeklyPlan (no es reentrante).
const CRAVED_MAX = 2;
const cravedCount = new Map<string, number>();
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
  // Magaly: "mariscos" abarca TODO lo del mar (incluye pescado). El toggle "pescado"
  // es el subconjunto para quien solo quiere fuera el pescado pero sí come camarón.
  mariscos: ['camaron', 'camarones', 'marisco', 'mariscos', 'pescado', 'salmon', 'atun', 'tilapia', 'bacalao'],
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

const W = [1.5, 1.8, 1.0]; // pesos P, F, C. La grasa subió de 0.8 a 1.2: con 0.8 el
// solver la dejaba absorber todo el error y se desbordaba +10%.
const IDX = [1, 2, 3];     // posición de P,F,C en el vector [kcal,P,F,C]

// Tope REALISTA de piezas para alimentos contables — nadie se come 6 tortillas.
// El solver jamás pasa de esto aunque el max_g del banco sea mayor (obvio, no un
// límite arbitrario: es lo que una persona de verdad come de ese alimento).
const PIECE_MAX: Record<string, number> = {
  // OJO: la pieza NO es una medida estable. Una tortilla de Sinaloa recién hecha pesa
  // casi el doble que una de CDMX o USA. El motor trabaja en GRAMOS (esa es la verdad)
  // y la pieza es solo la traducción legible, anclada al peso de `pu`. Por eso el tope
  // es generoso: quien tenga tortillas chicas comerá más piezas para los mismos gramos.
  'tortilla': 6, 'rebanada de pan': 4, 'tostada': 6, 'huevo': 6,
  'pan pita': 3, 'pan thin': 4, 'bagel': 2, 'tortilla de harina': 5,
};
// Guarnición de almidón: es POR AQUÍ por donde deben subir las calorías cuando falten
// (Magaly). Crecen holgado porque una porción grande de arroz o papa es perfectamente
// normal en una meta alta.
const ALMIDON_RE = /arroz|papa|camote|pasta|espagueti|fideo|macarr|quinoa|avena|cusc[uú]s|bulgur|frijol|lenteja|garbanzo|elote|pur[eé]|tub[eé]rculo|yuca|pl[aá]tano macho/i;
// TECHO ABSOLUTO en gramos por alimento. Un multiplicador solo se dispara cuando la
// receta base ya era grande (4× de 175 g = 700 g de papa). Esto es lo que de verdad
// cabe en un plato: al llegar aquí el alimento DEJA de crecer y el solver busca las
// calorías en otro lado.
const GRAM_MAX: [RegExp, number][] = [
  [/avena/i, 100],                                  // en seco: 100 g ya es un tazón grande
  [/arroz|quinoa|cusc[uú]s|bulgur/i, 300],          // ~2 tazas cocido
  [/pasta|espagueti|fideo|macarr/i, 280],
  [/papa|camote|yuca|pl[aá]tano macho/i, 320],
  [/frijol|lenteja|garbanzo/i, 250],
  [/elote/i, 200],
];
// Crujientes: suman calorías rápido pero nadie come porciones grandes. Se dejan casi
// en su porción de receta.
const CRUJIENTE_RE = /tostada|totopo|tostadita|galleta|crut[oó]n|chip|pan(?! integral en cubos)|bagel|baguette|pita/i;

// Piso y techo de UN ingrediente. Vive aparte porque lo usan DOS cosas que deben
// coincidir: el solver (prep) y el filtro de capacidad que decide qué platillos puede
// elegir la IA. Si se desincronizan, la IA vuelve a recibir platillos imposibles.
function ingBounds(ing: BancoIng): { lo: number; hi: number } {
  const a = ing.a!;
  // Techo por tipo de alimento. Regla de Magaly: cuando faltan calorías, que suba la
  // GUARNICIÓN DE ALMIDÓN (arroz, papa, camote, pasta, avena, leguminosas) — no las
  // tostadas. Una porción grande de arroz es normal; 8 tostadas no. La GRASA se aprieta
  // porque es la que se desborda (el solver la pondera al final, W=0.8).
  const fatDom = a[2] * 9 > a[1] * 4 && a[2] * 9 > a[3] * 4;
  const mult = fatDom ? 2.0
    : CRUJIENTE_RE.test(ing.nv) ? 1.5      // tostada/totopo/galleta: casi no crece
    : ALMIDON_RE.test(ing.nv) ? 3.0        // arroz/papa/camote/pasta: aquí sube
    : 3.0;
  let hi = Math.max(ing.max && ing.max > 0 ? ing.max : 0, Math.round(ing.g0 * mult));
  // Contables: nunca más de N piezas realistas (tortilla ≤6, huevo ≤6, tostada ≤6…).
  const pieceMax = ing.pu && ing.un ? PIECE_MAX[ing.un] : undefined;
  if (pieceMax && ing.pu) hi = Math.min(hi, Math.round(pieceMax * ing.pu));
  // Techo absoluto por alimento: aquí se detiene el crecimiento, para que no salgan
  // 525 g de papa (Magaly: que suba el arroz/papa, pero sin porciones desproporcionadas).
  for (const [rx, gmax] of GRAM_MAX) if (rx.test(ing.nv)) { hi = Math.min(hi, gmax); break; }
  // Guardia: había ingredientes con `max` MENOR que su porción base (p.ej. tostadas
  // horneadas 60 g base / 52 g max) — el motor no podía ni servir la receta original.
  hi = Math.max(hi, ing.g0);
  // PISO (Magaly): el motor tenía techo pero NO piso, y exprimía la carne a 80 g para
  // luego meter proteína suelta en el snack. Una FUENTE DE PROTEÍNA nunca baja de ~110 g
  // ni del 70% de la receta. Los demás principales conservan holgura para cuadrar G y C.
  const protDom = a[1] * 4 >= a[2] * 9 && a[1] * 4 >= a[3] * 4;
  const lo = Math.min(protDom ? Math.max(ing.g0 * 0.7, Math.min(ing.g0, 110)) : ing.g0 * 0.4, hi);
  return { lo, hi };
}

/** Macros MÍNIMOS de un platillo (todo servido a su piso). Es el "hasta dónde baja":
 *  si esto ya se pasa del presupuesto del tiempo, ese platillo NO cabe por más que el
 *  solver lo encoja. Se usa cuando queda poco margen — p.ej. tras meter un bowl. */
export function dishMinMacros(d: BancoDish): number[] {
  const t = [d.fixed[0], d.fixed[1], d.fixed[2], d.fixed[3]];
  for (const ing of d.ings) {
    if (ing.rol === 'principal' && ing.a) {
      const { lo } = ingBounds(ing);
      for (let k = 0; k < 4; k++) t[k] += ing.a[k] * lo;
    }
  }
  return t;
}

/** Macros MÁXIMOS que un platillo puede alcanzar con todo servido a su techo.
 *  Es el "hasta dónde da" real: si esto no llega a la meta del tiempo de comida,
 *  ese platillo NO puede cuadrar por más que el solver lo escale. */
export function dishMaxMacros(d: BancoDish): number[] {
  const t = [d.fixed[0], d.fixed[1], d.fixed[2], d.fixed[3]];
  for (const ing of d.ings) {
    if (ing.rol === 'principal' && ing.a) {
      const { hi } = ingBounds(ing);
      for (let k = 0; k < 4; k++) t[k] += ing.a[k] * hi;
    }
  }
  return t;
}

function prep(dishes: BancoDish[]): { fixed: number[]; vars: Var[] } {
  const fixed = [0, 0, 0, 0, 0]; // kcal, P, F, C, fibra
  const vars: Var[] = [];
  dishes.forEach((d, si) => {
    const bloque = d.tipo === 'bloque';
    for (let i = 0; i < 5; i++) fixed[i] += d.fixed[i];
    for (const ing of d.ings) {
      if (ing.rol === 'principal' && ing.a) {
        const { lo, hi } = ingBounds(ing);
        vars.push({ a: ing.a, g: ing.g0, g0: ing.g0, lo, hi, blk: bloque ? si : null, ing });
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
// El resto son contables (tortilla, pan, tostada) → entero o medio.
const DIVISIBLE = new Set(['aguacate', 'plátano', 'mango', 'papaya', 'melón', 'toronja']);
// Nunca se parten: se cuentan enteros SIEMPRE (no existe medio huevo).
const WHOLE_ONLY = new Set(['huevo']);
// Granos, leguminosas y pasta se miden en TAZAS (cocidos), no en gramos. gramos por
// taza (cocido, referencia USDA). Se muestran "1½ tazas de arroz" con fracciones ¼⅓½⅔¾.
const CUP_G: Array<[RegExp, number]> = [
  [/espagueti|espageti|pasta|fideo|macarr|coditos/i, 140],
  [/lenteja/i, 198],
  [/garbanzo/i, 164],
  [/alubia|frijol/i, 172],
  [/quinoa/i, 185],
  [/arroz/i, 158], // arroz cocido (excluye galletas/inflado más abajo)
  [/leche/i, 240],  // líquidos también se miden en tazas (1 taza ≈ 240 ml)
  [/yogur|yoghur/i, 245],
  [/avena cocida/i, 234], // avena cocida (la seca en hojuelas se queda en gramos)
  // Fruta y verdura CORTADA (no cuentan por pieza) → tazas. (Magaly: fruta en tazas o piezas)
  [/fresa|frambuesa|zarzamora|mora|ar[aá]ndano/i, 150],
  [/mango|pi[nñ]a|papaya|sand[ií]a|mel[oó]n/i, 160],
  [/uva|cereza/i, 150],
  [/j[ií]cama|apio|pepino|zanahoria en bastones|jitomate cherry/i, 130],
  [/jugo de tomate|caldo de/i, 240], // líquidos
];
// nv que llevan "arroz"/"pasta"/"leche" pero NO son el grano/líquido base (no van en tazas).
const CUP_EXCLUDE = /galleta|inflad|harina|tortita|crema de|leche de|congelad/i;
// Salsas / aderezos / sub-recetas → cucharadas o tazas, nunca gramos (Magaly).
// 1 cda = 15 g · 1 taza = 240 g. Cantidades chicas en cdas; grandes en tazas.
const SAUCE_RE = /salsa|aderezo|guacamole|pico de gallo|chimichurri|vinagreta|tzatziki|glaseado|hummus|mayonesa|crema|mostaza|miel|pur[eé] de jitomate/i;
function sauceStr(nv: string, grams: number): string {
  if (grams <= 0) return nv;
  if (grams < 60) { // chico → cucharadas (1 cda = 15 g)
    const n = Math.max(0.5, Math.round((grams / 15) * 2) / 2);
    return `${fmtCount(n)} ${n <= 1 ? 'cda' : 'cdas'} de ${nv.toLowerCase()}`;
  }
  const n = Math.max(0.25, snapCount(grams / 240)); // grande → tazas
  return `${fmtCount(n)} ${pluralNoun('taza', n)} de ${nv.toLowerCase()}`;
}
function cupGrams(nv: string): number | null {
  if (CUP_EXCLUDE.test(nv)) return null;
  for (const [re, g] of CUP_G) if (re.test(nv)) return g;
  return null;
}
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
// Pluraliza una FRASE (sustantivo + adjetivos): "huevo revuelto" → "huevos revueltos".
// Se detiene en preposición o paréntesis: "tortilla de maíz" → "tortillas de maíz".
const STOP_PLURAL = new Set(['de', 'del', 'con', 'a', 'al', 'en', 'para', 'y', 'sin', 'tipo', 'pita', 'thin', 'light']);
function pluralWord(w: string): string {
  if (/s$/i.test(w)) return w;
  return /[aeiouáéíóú]$/i.test(w)
    ? w + 's'
    : w.replace(/ó(?=n$)/, 'o').replace(/á(?=n$)/, 'a').replace(/é(?=n$)/, 'e') + 'es';
}
function pluralPhrase(txt: string, n: number): string {
  if (n <= 1) return txt;
  let stop = false;
  return txt.split(' ').map((w) => {
    if (stop || w.startsWith('(') || STOP_PLURAL.has(w.toLowerCase())) { stop = true; return w; }
    return pluralWord(w);
  }).join(' ');
}
// La gente cuenta huevos/tortillas, no los pesa. Si el alimento trae medida casera
// (pu = g por pieza) y la cantidad cae en un conteo limpio y creíble (0.5–8 piezas,
// error ≤20% para que el conteo no engañe sobre la porción), se muestra "2 huevos"
// en vez de "88 g". Si no, se queda en gramos.
function portionStr(ing: BancoIng, g: number | null): string {
  // Despliegue por rol. IMPORTANTE: esto es SOLO lo que se pinta — el motor sigue
  // usando los gramos reales para macros/fibra/kcal (van en meal.macros, no aquí).
  // guarnicion = verdura que nadie pesa → nombre + "al gusto" (sin gramos).
  if (ing.rol === 'guarnicion') return `${ing.nv} al gusto`;
  // condimento (sal, especias) → solo el nombre, sin cantidad.
  if (ing.rol === 'condimento') return ing.nv;
  const grams = Math.round(g ?? ing.g0);
  // Salsas, aderezos y sub-recetas → cucharadas (chicas) o tazas (grandes). Nadie pesa
  // el guacamole: "2 cdas de tzatziki", "⅓ taza de guacamole". (Magaly)
  if (ing.rol === 'sub-receta' || SAUCE_RE.test(ing.nv)) return sauceStr(ing.nv, grams);
  // Aceites → CUCHARADAS (1 cda = 10 g). Nadie pesa el aceite. (Magaly)
  if (/aceite/i.test(ing.nv)) {
    const n = Math.max(0.5, Math.round((grams / 10) * 2) / 2);
    return `${fmtCount(n)} ${n <= 1 ? 'cda' : 'cdas'} de ${ing.nv.toLowerCase()}`;
  }
  // Jamón / pavo → REBANADAS (1 rebanada = 30 g). (Magaly)
  if (/jam[oó]n|pavo/i.test(ing.nv) && grams > 0) {
    const n = Math.max(1, Math.round(grams / 30));
    return `${n} ${n === 1 ? 'rebanada' : 'rebanadas'} de ${ing.nv.toLowerCase()}`;
  }
  // Granos/leguminosas/pasta → tazas (si el ingrediente no trae ya otra medida casera).
  if (!ing.pu && grams > 0) {
    const cg = cupGrams(ing.nv);
    if (cg) {
      const n = Math.max(0.25, snapCount(grams / cg));
      if (n <= 6 && Math.abs(n * cg - grams) <= 0.20 * grams) {
        return `${fmtCount(n)} ${pluralNoun('taza', n)} de ${ing.nv.toLowerCase()}`;
      }
    }
  }
  if (ing.pu && ing.un && grams > 0) {
    const raw = grams / ing.pu;
    // Cortables (se parten en fracción real: ⅓ aguacate, ¾ plátano) → fracciones finas.
    // Huevo → SIEMPRE entero (nunca medio huevo). Resto contable (tortilla, pan, tostada) → entero/medio.
    const n = DIVISIBLE.has(ing.un)
      ? Math.max(0.25, snapCount(raw))
      : WHOLE_ONLY.has(ing.un)
        ? Math.max(1, Math.round(raw))
        : Math.max(0.5, Math.round(raw * 2) / 2);
    // Tope de piezas por porción según lo ligera que sea la pieza: una tostada pesa 10 g,
    // así que una porción normal son 8-12 tostadas (no gramos). Piezas pesadas (huevo,
    // tortilla) rara vez pasan de 8. Techo por peso: hasta ~150 g de piezas.
    const maxN = Math.max(8, Math.ceil(150 / ing.pu));
    // Los CORTABLES (aguacate, plátano, mango…) van SIEMPRE en fracción de pieza, nunca
    // en gramos: nadie pesa medio aguacate, lo parte a ojo. Para el resto se exige que
    // el conteo case con los gramos (±20%), si no engañaría sobre la porción real.
    const cortable = DIVISIBLE.has(ing.un);
    if (n <= maxN && (cortable || Math.abs(n * ing.pu - grams) <= 0.20 * grams)) {
      // Magaly: la pieza debe decir QUÉ es, no la unidad genérica. El dato ya trae el
      // nombre bueno ("Tostadas horneadas", "Tortilla de maíz") pero se pintaba la
      // unidad ("4 tostadas"), que se presta a confusión — una tostada frita y una
      // horneada no son lo mismo. Si el nombre ya contiene la unidad, se usa el nombre.
      // "rebanada de pan" es un CONTENEDOR, no el alimento → "3 rebanadas de pan integral".
      if (ing.un.startsWith('rebanada')) return `${fmtCount(n)} ${pluralPhrase('rebanada', n)} de ${ing.nv.toLowerCase()}`;
      // El resto de unidades SON el alimento → se usa su nombre real, no la unidad
      // genérica: "10 totopos horneados", no "10 tostadas".
      return `${fmtCount(n)} ${pluralPhrase(ing.nv, n).toLowerCase()}`;
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
      // Huevo: cuadra los gramos a piezas ENTERAS (nunca medio huevo) ANTES de sumar
      // macros, para que lo que se ve ("2 huevos") sea exactamente lo que aporta.
      if (ing.pu && ing.un && WHOLE_ONLY.has(ing.un)) g = Math.max(ing.pu, Math.round(g / ing.pu) * ing.pu);
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
  // Preserva TODAS las fotos, incluso al re-combinar un snack que ya venía combinado
  // (toma i.imgs si existe, si no su i.img) → el card muestra todas.
  const imgs = [...new Set(items.flatMap((i) => i.imgs ?? (i.img ? [i.img] : [])))];
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

// ── Corrector de macros: cierra el hueco a ≤2% agregando un SNACK REAL del banco
// (con su foto), denso en el macro que falta — no ingredientes sueltos. Lo que haría
// un coach: "te falta grasa → súmale un puñado de nueces o un yogurt griego". ──
function macroSum(meals: MealItem[]): number[] {
  const t = [0, 0, 0, 0, 0]; // kcal, P, F, C, fibra
  for (const m of meals) if (m.macros) { t[1] += m.macros.prot; t[2] += m.macros.fat; t[3] += m.macros.carb; t[4] += m.macros.fiber ?? 0; }
  t[0] = t[1] * 4 + t[3] * 4 + t[2] * 9;
  return t;
}

// Clasifica cada snack por su macro DOMINANTE (base del platillo) → así el corrector
// elige un snack que de verdad aporta lo que falta (nueces=grasa, fruta=carbo, yogurt=proteína).
function snackClass(d: BancoDish): 'F' | 'P' | 'C' {
  const m = [...d.fixed];
  for (const ing of d.ings) if (ing.rol === 'principal' && ing.a) for (let k = 0; k < 5; k++) m[k] += ing.a[k] * ing.g0;
  const f = m[2] * 9, p = m[1] * 4, c = m[3] * 4;
  return f >= p && f >= c ? 'F' : p >= c ? 'P' : 'C';
}
const SNACK_BY_MACRO: Record<'F' | 'P' | 'C', BancoDish[]> = { F: [], P: [], C: [] };
for (const d of BY_TIME.Snack) SNACK_BY_MACRO[snackClass(d)].push(d);

/** Mete un snack extra al slot de snack (AM o PM) con menos items, como "2 en 1" —
 *  mergeItems junta nombres, porciones, macros Y fotos (imgs) para el card. */
function mergeIntoSnack(meals: MealItem[], extra: MealItem): void {
  const amIdx = meals.findIndex((m) => m.time === 'Snack AM');
  const pmIdx = meals.findIndex((m) => m.time === 'Snack PM');
  const count = (i: number) => (i < 0 ? Infinity : (meals[i].ings?.length ?? 1));
  const idx = count(pmIdx) <= count(amIdx) ? pmIdx : amIdx;
  if (idx >= 0) meals[idx] = mergeItems([meals[idx], { ...extra, time: meals[idx].time }], meals[idx].time);
  else meals.push({ ...extra, time: 'Snack PM' });
}

// ── Batido de proteína (opción del usuario) ──────────────────────────────────
// El usuario elige tomar proteína en polvo en el snack AM, PM o ambos, su tipo y
// gramos. El batido REEMPLAZA el snack de ese slot; el corrector de macros agrega
// después la mezcla que haga falta (plátano si faltan carbos, crema de cacahuate si
// falta grasa, o sola si va justo) — por eso reduce la meta de los principales antes.
export interface ProteinShake { slots: ('am' | 'pm')[]; type: 'regular' | 'vegana' | 'massgainer'; protG: number }

/** Macros de UN batido según tipo y gramos de proteína. Cada tipo rinde distinto:
 *  regular (whey) casi pura proteína; vegana un poco más de carbo/grasa; mass gainer
 *  con muchos carbos. */
export function shakeMacros(s: ProteinShake): { kcal: number; prot: number; fat: number; carb: number } {
  const [cf, ff] = s.type === 'massgainer' ? [1.5, 0.15] : s.type === 'vegana' ? [0.18, 0.11] : [0.12, 0.06];
  const prot = s.protG, carb = Math.round(prot * cf), fat = Math.round(prot * ff);
  return { kcal: Math.round(prot * 4 + carb * 4 + fat * 9), prot, fat, carb };
}
function shakeItem(s: ProteinShake, label: string): MealItem {
  const m = shakeMacros(s);
  const tag = s.type === 'massgainer' ? ' (mass gainer)' : s.type === 'vegana' ? ' (vegana)' : '';
  return {
    time: label, name: 'Batido de Proteína', desc: `${s.protG} g proteína${tag}`,
    img: IMG_BASE + 'batido-de-proteina.webp', // si no existe la foto, el card la oculta solo
    portions: [`1 scoop de proteína${tag} — ${s.protG} g proteína`],
    macros: { ...m, fiber: 0 },
    ings: [{ nv: 'Proteína en polvo', g: 0, rol: 'principal' }],
  };
}

/** Coloca el batido en el/los snack(s) elegido(s), reemplazando el snack normal de
 *  ese slot (ya se redujo la meta de los principales para hacerle espacio). */
function applyShake(meals: MealItem[], shake: ProteinShake): void {
  for (const slot of shake.slots) {
    const label = slot === 'am' ? 'Snack AM' : 'Snack PM';
    const item = shakeItem(shake, label);
    const idx = meals.findIndex((m) => m.time === label);
    if (idx >= 0) meals[idx] = item; else meals.push(item);
  }
}

/** Corrector MÍNIMO: solo si un macro (grasa o carbo) quedó MUY corto (>5%) tras armar
 *  el día, agrega UN solo snack real de ese macro. La proteína NO se corrige aquí (la
 *  cargan los principales — subir gramos de una comida, no apilar snacks). Rota en la
 *  semana (weekUsed) para no repetir el mismo. RESPETA alergias. */
function topUpMeals(meals: MealItem[], target: PlanTarget, avoidCats: string[] = [], weekUsed?: Set<string>): void {
  const T = [target.kcal, target.protG, target.fatG, target.carbG];
  const cur = macroSum(meals);
  if (cur[0] >= target.kcal * 1.02) return;            // sin espacio calórico
  const rel = (i: number) => (T[i] - cur[i]) / T[i];
  const rf = rel(2), rc = rel(3);                      // solo grasa/carbo (proteína = principales)
  const worst = Math.max(rf, rc);
  if (worst <= 0.05) return;                            // hueco chico → se deja (nada de apilar)
  const avoid = makeAvoidFilter(avoidCats);
  const [cls, idx]: ['F' | 'C', number] = rf === worst ? ['F', 2] : ['C', 3];
  const pool = SNACK_BY_MACRO[cls].filter((d) => !avoid(d)); // nunca un alérgeno
  const dayNames = new Set(meals.map((m) => m.name));
  // Prefiere uno NO usado en la semana ni hoy; si no hay, el menos repetido.
  const dish = pool.find((d) => !weekUsed?.has(d.nombre) && ![...dayNames].some((n) => n.includes(d.nombre)))
    ?? pool.find((d) => ![...dayNames].some((n) => n.includes(d.nombre)));
  if (!dish) return;
  const slotT = [0, 0, 0, 0];
  slotT[idx] = T[idx] - cur[idx];
  const item = solveSlot([dish], 'Snack', slotT)[0];
  if (!item?.macros || item.macros.kcal < 20 || cur[0] + item.macros.kcal > target.kcal * 1.05) return;
  mergeIntoSnack(meals, item);
  weekUsed?.add(dish.nombre);
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
    // Antojo cuenta solo si el platillo aún no llegó al tope (2) → sale 1-2 veces, no más.
    const craves = craving.length ? dishes.filter((d) => dishMatchesAny(d, craving) && (cravedCount.get(d.nombre) ?? 0) < CRAVED_MAX).length : 0;
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
  // Snacks: banda MUY ancha (son ~5-10% del día → el error ahí casi no mueve el total,
  // y lo que importa es la VARIEDAD). Así caben fruta, nueces y yogurt por igual y el
  // score de variedad (used/ingFreq) los rota en vez de repetir el mismo a diario.
  const isSnack = label.startsWith('Snack');
  const cap = isSnack
    ? Math.max(50, minE + 35)
    : merge
    ? Math.max(30, minE + 12)
    : (pool.length < 30 ? Math.max(22, minE + 8) : Math.max(12, minE + 2));
  const acceptable = cands.filter((c) => c.e <= cap);
  // Un solo score de variedad: platillo repetido en la semana (50) > ingrediente repetido
  // hoy (30). El ANTOJO es un BONO (-55) que NO manda absoluto: el platillo antojado sale
  // 1-2 veces y luego la penalización semanal (used) deja que rote — no las 7 cenas iguales.
  const vscore = (c: typeof acceptable[number]) => c.used * 50 + c.dayIng * 30 + c.ingScore - c.craves * 55;
  acceptable.sort((a, b) =>
    (vscore(a) - vscore(b)) ||
    (b.fib - a.fib) ||
    (a.e - b.e),
  );
  const dishes = acceptable[0].dishes;
  for (const d of dishes) {
    used.add(d.nombre); usedToday.add(d.nombre);
    if (craving.length && dishMatchesAny(d, craving)) cravedCount.set(d.nombre, (cravedCount.get(d.nombre) ?? 0) + 1);
    for (const k of princKeys(d)) { ingFreq.set(k, (ingFreq.get(k) ?? 0) + 1); usedTodayIng.add(k); }
  }
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
/** Slots del día. */
export type Slot = 'Desayuno' | 'Comida' | 'Cena' | 'Snack AM' | 'Snack PM';

// REPARTO DE MAGALY (LOGICA-NUTRICIONAL-HSC.md §3.5): calorías 25/35/25/15 y proteína
// pareja en las principales. Vive aparte para poder REDISTRIBUIRLO cuando un tiempo
// queda ocupado por un alimento fijo (p.ej. un bowl comprado en el food truck).
const SHARE_KCAL: Record<Slot, number> = {
  'Desayuno': 0.25, 'Comida': 0.35, 'Cena': 0.25, 'Snack AM': 0.075, 'Snack PM': 0.075,
};
// La proteína casi toda en las principales: el banco de snacks es FRUTA y no puede
// darla. Magaly: "pareja en las principales; los snacks pueden llevar algo, menos".
const SHARE_PROT: Record<Slot, number> = {
  'Desayuno': 0.32, 'Comida': 0.32, 'Cena': 0.32, 'Snack AM': 0.02, 'Snack PM': 0.02,
};

/** Meta [_, P, F, C] de cada slot. `omit` = slots ya ocupados (su parte se reparte
 *  proporcionalmente entre los que quedan, para que el día siga cerrando en la meta). */
function slotTargets(T: number[], omit: Slot[] = []): Record<Slot, number[]> {
  const [kcal, P, F, C] = T;
  const live = (Object.keys(SHARE_KCAL) as Slot[]).filter((s) => !omit.includes(s));
  const sumK = live.reduce((a, s) => a + SHARE_KCAL[s], 0) || 1;
  const sumP = live.reduce((a, s) => a + SHARE_PROT[s], 0) || 1;
  const eF = 9 * F, eC = 4 * C;
  const rF = eF / (eF + eC || 1);
  const out = {} as Record<Slot, number[]>;
  for (const s of Object.keys(SHARE_KCAL) as Slot[]) {
    if (omit.includes(s)) { out[s] = [0, 0, 0, 0]; continue; }
    const prot = (SHARE_PROT[s] / sumP) * P;
    const resto = Math.max(0, (SHARE_KCAL[s] / sumK) * kcal - 4 * prot);
    out[s] = [0, prot, (resto * rF) / 9, (resto * (1 - rF)) / 4];
  }
  return out;
}

function mealTargets(T: number[]): { desayuno: number[]; comida: number[]; cena: number[]; snackSlot: number[] } {
  const t = slotTargets(T);
  return { desayuno: t['Desayuno'], comida: t['Comida'], cena: t['Cena'], snackSlot: t['Snack AM'] };
}

/**
 * Cierre del día. El motor cuadra comida por comida, así que cuando las
 * exclusiones (sin gluten, sin lácteos…) dejan al banco sin platillos altos en
 * carbo, cada comida sale un poco corta y el DÍA termina corto —hasta 450 kcal—
 * sin que nadie lo compense. Medido: en el 100% de esos días cortos hay un
 * almidón (arroz, papa, camote, pasta) que TODAVÍA puede subir dentro de su
 * tope. Este paso lo sube hasta cerrar el hueco. Es justo lo que pidió David:
 * ajustar cada platillo hasta que el día quede alineado con la meta.
 *
 * Solo sube almidones (nunca proteína ni grasa), solo hacia la meta (nunca la
 * pasa), y respeta el tope de cada alimento (nada de 500 g de arroz). Toca las 3
 * comidas fuertes, no los snacks: el hueco se cierra con más arroz en la comida,
 * no con más fruta en el snack.
 */
function topUpDay(meals: MealItem[], T: number[]): MealItem[] {
  // Cierre del día a nivel DÍA (no comida por comida). Junta los ingredientes de
  // las 3 comidas fuertes y los resuelve JUNTOS contra la meta del día menos lo
  // que aportan los snacks. Bidireccional: si el día se pasó, baja; si se quedó
  // corto, sube — moviendo los ingredientes que YA están en el plato, dentro de
  // sus límites (ingBounds). El orden de Magaly lo cuida el reintento de
  // buildWeeklyPlan, que prefiere las composiciones que lo respetan.
  const mains: { dish: BancoDish; idx: number }[] = [];
  const snack = [0, 0, 0, 0];
  meals.forEach((m, i) => {
    if (m.time.startsWith('Snack')) {
      snack[1] += m.macros?.prot ?? 0; snack[2] += m.macros?.fat ?? 0; snack[3] += m.macros?.carb ?? 0;
      return;
    }
    const dish = BANCO.find((d) => d.nombre === m.name);
    if (dish) mains.push({ dish, idx: i });
  });
  if (!mains.length) return meals;

  const target = [T[0], T[1] - snack[1], T[2] - snack[2], T[3] - snack[3]];
  const { fixed, vars } = prep(mains.map((x) => x.dish));
  // Sembrar con lo ya resuelto en la selección (arranca cerca, no de g0).
  for (const v of vars) {
    const di = mains.findIndex((x) => x.dish.ings.includes(v.ing));
    if (di < 0) continue;
    const g = meals[mains[di].idx].ings?.find((x) => x.nv === v.ing.nv)?.g;
    if (typeof g === 'number') v.g = Math.max(v.lo, Math.min(v.hi, g));
  }
  solve(fixed, vars, target, 400);

  const gPorPlato = mains.map(() => new Map<BancoIng, number>());
  for (const v of vars) {
    const di = mains.findIndex((x) => x.dish.ings.includes(v.ing));
    if (di >= 0) gPorPlato[di].set(v.ing, v.g);
  }
  mains.forEach((x, k) => { meals[x.idx] = mealItemFrom(x.dish, meals[x.idx].time, gPorPlato[k]); });
  return meals;
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
  return { day: dayNum, theme: '', meals: topUpDay(meals, T) };
}

// Versión del motor de nutrición. Súbela al cambiar la lógica (tiempos, variedad,
// pools…): los planes guardados con versión menor se auto-regeneran al abrir nutrición.
// v24 = las reglas de la v22 (las que están escritas aquí abajo). El salto 23→24
// NO es un cambio de reglas: la v23 fue un experimento mío que empeoró las macros
// y se revirtió, pero alcanzó a desplegarse y a generar planes. Como el planner
// solo regenera cuando la versión guardada es MENOR que ésta, un plan marcado 23
// se habría quedado congelado con las reglas malas para siempre. Subir a 24 los
// regenera con las reglas buenas. Regla que se deriva de esto: al revertir un
// cambio del motor NO basta con revertir el código — hay que subir la versión.
// v25: las fotos del banco pasaron de .jpg (que dejaba 42 platillos sin imagen,
// aunque la foto existía en .webp) a .webp, y se quitó el Apio. La URL de la foto
// se hornea dentro del plan guardado, así que sin subir la versión un plan ya
// generado seguiría pidiendo los .jpg viejos. Las REGLAS del motor no cambian:
// siguen siendo las de la v22.
// v26: paso de cierre (topUpDay) que sube los almidones con margen hasta cuadrar
// el día, y la auto-regeneración movida a nivel de app (antes solo corría dentro
// de Nutrición, así que la tarjeta de Inicio se quedaba con el plan viejo).
// v27: cuadre a nivel DÍA. El motor selecciona platillos por comida (variedad) y
// luego (a) elige entre varias composiciones la que SÍ contiene la meta en su
// rango alcanzable —reachabilidad— y (b) resuelve los ingredientes de las 3
// comidas fuertes JUNTOS contra la meta del día. Exactitud de macros <1%: de 5%
// de los días a 84%, medido con scorecard. Reglas de porción de la v22 intactas.
export const PLAN_ENGINE_VERSION = 27;

export interface BuildOpts { seed?: number; avoid?: string[]; cuisines?: string[]; craving?: string; shake?: ProteinShake }

/** Resta las macros del batido a la meta del día, para que los principales se
 *  construyan contra el remanente y el total (con batido) caiga en la meta.
 *
 *  Clave: el batido REEMPLAZA el snack de su slot, así que ese snack normal ya no se
 *  sirve. Descontar el batido completo dejaba el día corto por el snack perdido (los
 *  snacks son casi puro carbo, 0.06·C por slot) → desfase fuerte en carbos/grasa con
 *  metas altas + batido. Se descuenta el NETO (batido − snack reemplazado). */
function reduceForShake(T: number[], shake?: ProteinShake): number[] {
  if (!shake?.slots?.length) return T;
  const m = shakeMacros(shake), n = shake.slots.length;
  // 1ª pasada: meta reducida por el batido completo (≈ meta de los principales).
  const [k0, p0, f0, c0] = [T[0] - m.kcal * n, T[1] - m.prot * n, T[2] - m.fat * n, T[3] - m.carb * n];
  // Asignación del snack que se PIERDE al reemplazarlo. Se LEE de mealTargets en vez de
  // repetir los shares a mano: estaban hardcodeados (0.02/0.02/0.06) y al cambiar el
  // reparto quedaron desfasados, dejando el día corto en carbos y grasa.
  // Se calcula sobre la meta ORIGINAL, no la reducida: el snack que se pierde valía lo
  // que valía en el plan completo. Estimarlo sobre la meta ya recortada lo subvaluaba y
  // el día quedaba corto de grasa (-10%) cuando el batido ocupaba los dos slots.
  const ss = mealTargets(T).snackSlot;
  const back = { prot: ss[1] * n, fat: ss[2] * n, carb: ss[3] * n };
  const backKcal = back.prot * 4 + back.fat * 9 + back.carb * 4;
  return [
    Math.max(T[0] * 0.5, k0 + backKcal),
    Math.max(T[1] * 0.4, p0 + back.prot),
    Math.max(T[2] * 0.4, f0 + back.fat),
    Math.max(T[3] * 0.4, c0 + back.carb),
  ];
}

/** Genera 7 días ajustados a la meta del usuario, con el reparto por comida de Magaly. */
// ════════════════════════════════════════════════════════════════════════
// API para el HÍBRIDO IA: la IA SELECCIONA los platillos (variedad/antojo/tiempos)
// y el código AJUSTA las porciones a la meta + garantiza tiempos y alergias.
// ════════════════════════════════════════════════════════════════════════

/** Filtro de alergia/evitar (categoría → alimentos reales del banco). */
export function makeAvoidFilter(avoidCats: string[]): (d: BancoDish) => boolean {
  const terms = expandAvoid(avoidCats.map((s) => s.toLowerCase().trim()).filter(Boolean));
  return (d: BancoDish) => (terms.length ? dishMatchesAny(d, terms) : false);
}

/** Banco agrupado por tiempo, ya SIN alérgenos (nunca vacío: cae al pool completo). */
export function safeBankByTiempo(avoidCats: string[]): Record<'Desayuno' | 'Comida' | 'Cena' | 'Snack', BancoDish[]> {
  const avoid = makeAvoidFilter(avoidCats);
  const pick = (t: string) => { const f = (BY_TIME[t] ?? []).filter((d) => !avoid(d)); return f.length ? f : (BY_TIME[t] ?? []); };
  return { Desayuno: pick('Desayuno'), Comida: pick('Comida'), Cena: pick('Cena'), Snack: pick('Snack') };
}

/** Ajusta las porciones de UNOS platillos dados a `target` y devuelve sus MealItem. */
export function solveSlot(dishes: BancoDish[], label: string, target: number[], merge = false): MealItem[] {
  if (!dishes.length) return [];
  const { fixed, vars } = prep(dishes);
  solve(fixed, vars, target, 220);
  void fixed;
  const gOf = new Map<BancoIng, number>();
  for (const v of vars) gOf.set(v.ing, v.g);
  const items = dishes.map((d) => mealItemFrom(d, label, gOf));
  return merge && items.length > 1 ? [mergeItems(items, label)] : items;
}

/** Error relativo total (P/F/C) de un platillo ajustado al target de un slot. Menor = mejor
 *  encaje. Es el mismo criterio del motor de código: no basta la proteína, debe cuadrar
 *  también grasa y carbos (un platillo magro pega proteína pero se queda corto en grasa). */
function slotFit(d: BancoDish, slotTarget: number[]): number {
  const it = solveSlot([d], 'x', slotTarget);
  const p = it.reduce((s, x) => s + (x.macros?.prot ?? 0), 0);
  const f = it.reduce((s, x) => s + (x.macros?.fat ?? 0), 0);
  const c = it.reduce((s, x) => s + (x.macros?.carb ?? 0), 0);
  const [, tp, tf, tc] = slotTarget;
  const e = (v: number, t: number) => (t > 0 ? Math.abs(v - t) / t : 0);
  return e(p, tp) * 1.2 + e(f, tf) + e(c, tc); // proteína pesa un poco más (prioridad del plan)
}

/** Banco por tiempo filtrado a platillos que SÍ cuadran las macros del slot bajo el
 *  reparto de Magaly (P/F/C, no solo proteína). Así, elija lo que elija la IA (variedad/
 *  antojo), las macros pegan. Los principales de un antojo se fuerzan aunque encajen peor
 *  (1-2 días al máximo). Snacks pasan completos (rellenan el share chico). */
export function adequateBankByTiempo(
  avoidCats: string[], target: PlanTarget, cravingText = '',
): Record<'Desayuno' | 'Comida' | 'Cena' | 'Snack', BancoDish[]> {
  const safe = safeBankByTiempo(avoidCats);
  const T = [target.kcal, target.protG, target.fatG, target.carbG];
  const MT = mealTargets(T);
  const craveTerms = cravingTerms(cravingText);
  const filt = (pool: BancoDish[], slotTarget: number[]): BancoDish[] => {
    // CAPACIDAD antes que encaje. El filtro validaba solo la FORMA de los macros y le
    // ofrecía a la IA platillos que no llegan a la meta ni servidos al tope: a 3500 kcal
    // sin lácteos le daba "Huevo a la Mexicana" (tope 43 g de proteína, el huevo topa en
    // 6 piezas) cuando en el mismo banco había "Pollo Deshebrado" (85 g ✓). La IA elegía
    // de buena fe y el motor ya no podía cuadrarlo. Ahora el que no alcanza va al final.
    // Capacidad sobre TODA la comida, no solo proteína: filtrar por proteína sola elegía
    // platillos proteicos y secos, y los carbos se desplomaban (-16%). Se pide que el
    // platillo alcance el TAMAÑO del slot (kcal implícitas de P/F/C) y su proteína.
    const slotKcal = 4 * slotTarget[1] + 9 * slotTarget[2] + 4 * slotTarget[3];
    const alcanza = (d: BancoDish) => {
      const m = dishMaxMacros(d);
      return m[1] >= slotTarget[1] * 0.9 && 4 * m[1] + 9 * m[2] + 4 * m[3] >= slotKcal * 0.95;
    };
    const scored = pool.map((d) => ({ d, e: slotFit(d, slotTarget), cap: alcanza(d) }))
      .sort((a, b) => a.e - b.e);
    // Entre los que YA encajan bien, primero los que además alcanzan la meta. Así la IA
    // ve arriba los que pueden cuadrar, sin perder ninguna opción ni empeorar el encaje.
    const ok = scored.filter((s) => s.e <= 0.35)
      .sort((a, b) => (a.cap === b.cap ? a.e - b.e : a.cap ? -1 : 1))
      .map((s) => s.d);
    // Garantiza ≥10 opciones para variedad (7 días distintos + margen). Se completan
    // primero con los capaces aunque encajen peor, y solo al final con los incapaces
    // (mejor un platillo que no cuadra fino que un plan sin opciones).
    const base = ok.length >= 10 ? ok : scored.slice(0, Math.min(scored.length, 10)).map((s) => s.d);
    // Fuerza los platillos del antojo (aunque encajen peor) para que la IA pueda usarlos.
    const cravedInPool = craveTerms.length ? pool.filter((d) => dishMatchesAny(d, craveTerms)) : [];
    const set = new Map(base.map((d) => [d.nombre, d]));
    for (const d of cravedInPool) set.set(d.nombre, d);
    return [...set.values()];
  };
  return {
    Desayuno: filt(safe.Desayuno, MT.desayuno),
    Comida: filt(safe.Comida, MT.comida),
    Cena: filt(safe.Cena, MT.cena),
    Snack: safe.Snack,
  };
}

export interface DaySelection { desayuno: string; comida: string; cena: string; snacks: string[] }

/** Nº de snacks por slot: metas altas (>2200 kcal) usan 2 combinados para alcanzar
 *  el target del snack (uno solo se queda corto). Igual que el motor de código. */
export function snacksPerSlot(kcal: number): number { return kcal > 2200 ? 2 : 1; }

/** Arma los 7 días desde la SELECCIÓN de la IA. Los 3 principales van al reparto de
 *  Magaly; los SNACKS RELLENAN lo que falte para pegar la meta exacta (así el día no
 *  queda bajo aunque los platillos que eligió la IA no escalen tanto), con nSnack
 *  combinados por slot para tener capacidad. */
export function assembleFromSelection(target: PlanTarget, days: DaySelection[], avoidCats: string[] = [], shake?: ProteinShake): DayPlan[] {
  const T = [target.kcal, target.protG, target.fatG, target.carbG];
  const MT = mealTargets(reduceForShake(T, shake)); // principales contra la meta MENOS el batido
  const nSnack = snacksPerSlot(target.kcal);
  const byName = new Map(BANCO.map((d) => [d.nombre, d]));
  const corrUsed = new Set<string>(); // corrector no repite el mismo snack en la semana
  const out: DayPlan[] = [];
  days.forEach((sel, i) => {
    const des = byName.get(sel.desayuno), com = byName.get(sel.comida), cen = byName.get(sel.cena);
    if (!des || !com || !cen) return; // el orquestador ya validó; salta por seguridad
    const snacks = (sel.snacks ?? []).map((n) => byName.get(n)).filter((d): d is BancoDish => !!d);
    // Reparto de Magaly: cada tiempo a su share (proteína pareja en los 3 principales,
    // menos en snacks). Snacks: nSnack combinados por slot para tener capacidad a metas altas.
    const amSnacks = snacks.slice(0, nSnack), pmSnacks = snacks.slice(nSnack, 2 * nSnack);
    const meals: MealItem[] = [
      ...solveSlot([des], 'Desayuno', MT.desayuno),
      ...(amSnacks.length ? solveSlot(amSnacks, 'Snack AM', MT.snackSlot, true) : []),
      ...solveSlot([com], 'Comida', MT.comida),
      ...(pmSnacks.length ? solveSlot(pmSnacks, 'Snack PM', MT.snackSlot, true) : []),
      ...solveSlot([cen], 'Cena', MT.cena),
    ];
    if (shake) applyShake(meals, shake); // batido reemplaza el snack del slot elegido
    topUpMeals(meals, target, avoidCats, corrUsed); // cierra hueco grande (1 snack, rota en semana)
    out.push({ day: i + 1, theme: '', meals });
  });
  return out;
}

/** Un alimento de FUERA con macros conocidas que ocupa un tiempo del día: hoy un bowl
 *  del food truck; mañana cualquier cosa que el usuario registre. Es el mismo patrón
 *  del batido de proteína, generalizado a cualquier tiempo. */
export interface FixedMeal {
  slot: Slot;
  name: string;
  kcal: number; prot: number; fat: number; carb: number;
  img?: string;
  desc?: string;
}

/** Rearma UN día alrededor de un alimento fijo: el bowl ocupa su tiempo y los demás se
 *  recalculan contra lo que sobra, para que el día siga cerrando en la meta.
 *
 *  Clave: cuando lo que sobra es POCO (una mujer en déficit tras un bowl se queda con
 *  ~19 g de grasa para desayuno y cena), se eligen los platillos MÁS LIGEROS del banco.
 *  Con el filtro normal metería platillos medianos y se pasaría de grasa. */
export function buildDayWithFixed(
  target: PlanTarget, fixed: FixedMeal, opts: BuildOpts = {}, dayNum = 1,
): DayPlan {
  const T = [target.kcal, target.protG, target.fatG, target.carbG];
  // Lo que queda para el resto del día, una vez servido el alimento fijo.
  const rest = [
    Math.max(0, T[0] - fixed.kcal), Math.max(0, T[1] - fixed.prot),
    Math.max(0, T[2] - fixed.fat), Math.max(0, T[3] - fixed.carb),
  ];
  const MT = slotTargets(rest, [fixed.slot]);
  const avoid = makeAvoidFilter(opts.avoid ?? []);
  const rng = mulberry32(opts.seed ?? 12345);
  const used = new Set<string>(), usedToday = new Set<string>(), usedIng = new Set<string>();
  const craving = cravingTerms(opts.craving ?? '');
  const ingFreq = new Map<string, number>();

  const anyOk = BANCO.filter((d) => !avoid(d));
  const clean = (pool: BancoDish[]) => { const f = pool.filter((d) => !avoid(d)); return f.length ? f : anyOk; };
  // Solo los que CABEN por debajo del presupuesto del tiempo (con 15% de holgura, que
  // el solver puede cuadrar). Si ninguno cabe, se toman los más ligeros.
  const cabe = (pool: BancoDish[], slotT: number[]) => {
    const kMax = 4 * slotT[1] + 9 * slotT[2] + 4 * slotT[3];
    const ok = pool.filter((d) => { const m = dishMinMacros(d); return 4 * m[1] + 9 * m[2] + 4 * m[3] <= kMax * 1.15; });
    if (ok.length) return ok;
    return [...pool].sort((a, b) => {
      const ma = dishMinMacros(a), mb = dishMinMacros(b);
      return (4 * ma[1] + 9 * ma[2] + 4 * ma[3]) - (4 * mb[1] + 9 * mb[2] + 4 * mb[3]);
    }).slice(0, 10);
  };

  const nSnack = rest[0] > 2200 ? 2 : 1;
  const meals: MealItem[] = [];
  const add = (slot: Slot, pool: BancoDish[], n: number, tol: number) => {
    if (slot === fixed.slot) {
      meals.push({
        time: slot, name: fixed.name, desc: fixed.desc ?? '', img: fixed.img,
        portions: [fixed.name],
        macros: { kcal: fixed.kcal, prot: fixed.prot, fat: fixed.fat, carb: fixed.carb },
        ings: [],
      });
      return;
    }
    const t = MT[slot];
    // Nada se repite dentro del día. En snacks la regla es por INGREDIENTE: un snack casi
    // ES su ingrediente, así que dos del mismo se sienten repetidos aunque el platillo cambie.
    const esSnack = slot.startsWith('Snack');
    const libre = (p: BancoDish[]) => {
      const f = esSnack
        ? p.filter((d) => !usedToday.has(d.nombre) && !dishPrincKeys(d).some((k) => usedIng.has(k)))
        : p.filter((d) => !usedToday.has(d.nombre));
      return f.length ? f : p.filter((d) => !usedToday.has(d.nombre));
    };
    const pool2 = libre(cabe(clean(pool), t));
    meals.push(...fitSlot(pool2.length ? pool2 : cabe(clean(pool), t), slot, t, n, rng, tol, used, usedToday, usedIng, craving, ingFreq, esSnack));
  };
  add('Desayuno', BY_TIME.Desayuno, 1, 90);
  add('Snack AM', BY_TIME.Snack, nSnack, 70);
  add('Comida', COMIDA_VEG.length ? COMIDA_VEG : BY_TIME.Comida, 1, 90);
  add('Snack PM', BY_TIME.Snack, nSnack, 70);
  add('Cena', CENA_VEG.length ? CENA_VEG : BY_TIME.Cena, 1, 90);
  return { day: dayNum, theme: '', meals };
}

export function buildWeeklyPlan(target: PlanTarget, opts: BuildOpts = {}): DayPlan[] {
  cravedCount.clear(); // tope de antojo por semana
  const T = [target.kcal, target.protG, target.fatG, target.carbG];
  const buildT = reduceForShake(T, opts.shake); // los principales van contra la meta MENOS el batido
  const rng = mulberry32(opts.seed ?? 12345);
  // "Evitar": categoría (gluten/lácteos/…) → alimentos reales del banco; excluye esos platillos.
  const avoidTerms = expandAvoid((opts.avoid ?? []).map((s) => s.toLowerCase().trim()).filter(Boolean));
  const avoid = (d: BancoDish) => avoidTerms.length > 0 && dishMatchesAny(d, avoidTerms);
  const cuisines = (opts.cuisines ?? []).map((s) => s.toLowerCase().trim()).filter(Boolean);
  const craving = cravingTerms(opts.craving ?? ''); // "antojo": prefiere platillos que lo tengan
  const used = new Set<string>();          // platillos ya usados en la semana → variedad entre días
  const ingFreq = new Map<string, number>(); // ingredientes ya usados → rota fuentes (aguacate/pollo)
  const corrUsed = new Set<string>();      // corrector no repite el mismo snack en la semana
  const days: DayPlan[] = [];
  // Error del día = máx % en P/F/C (kcal es implícito por Atwater).
  const dayErr = (d: DayPlan): number => {
    const s = d.meals.reduce((a, m) => ({
      p: a.p + (m.macros?.prot ?? 0), f: a.f + (m.macros?.fat ?? 0), c: a.c + (m.macros?.carb ?? 0),
    }), { p: 0, f: 0, c: 0 });
    return Math.max(Math.abs(s.p - T[1]) / Math.max(T[1], 1),
                    Math.abs(s.f - T[2]) / Math.max(T[2], 1),
                    Math.abs(s.c - T[3]) / Math.max(T[3], 1));
  };
  const kcalDe = (d: DayPlan, t: string) => d.meals.filter((m) => m.time === t).reduce((a, m) => a + (m.macros?.kcal ?? 0), 0);

  for (let i = 1; i <= 7; i++) {
    // REACHABILIDAD. El solver ya converge; cuando el día queda lejos de la meta es
    // porque los 5 platillos elegidos no la CONTIENEN en su rango. Se arman varias
    // composiciones y se ACEPTA la primera que da en la meta y respeta el orden de
    // Magaly (comida la más grande). "Aceptar la primera buena" —no cazar la óptima—
    // conserva la variedad: los días rotan en vez de converger al mismo platillo.
    // Cada intento parte del estado de variedad LIMPIO del día (si no, el intento
    // descartado deja sus platillos marcados como usados y colapsa la variedad).
    const preU = new Set(used), preI = new Map(ingFreq), preC = new Map(cravedCount);
    let best: DayPlan | null = null, bestErr = Infinity;
    let bU = preU, bI = preI, bC = preC;
    for (let a = 0; a < 16; a++) {
      used.clear(); preU.forEach((x) => used.add(x));
      ingFreq.clear(); preI.forEach((v, k) => ingFreq.set(k, v));
      cravedCount.clear(); preC.forEach((v, k) => cravedCount.set(k, v));
      const day = buildDay(i, buildT, rng, avoid, cuisines, used, craving, ingFreq);
      if (opts.shake) applyShake(day.meals, opts.shake);
      const com = kcalDe(day, 'Comida');
      const desorden = (com < kcalDe(day, 'Desayuno') ? 1 : 0) + (com < kcalDe(day, 'Cena') ? 1 : 0);
      const score = dayErr(day) + desorden * 0.08;   // multa por romper el orden
      if (score < bestErr) {
        bestErr = score; best = day;
        bU = new Set(used); bI = new Map(ingFreq); bC = new Map(cravedCount);
      }
      if (bestErr <= 0.01) break;   // exacto y ordenado: parar (conserva variedad)
    }
    used.clear(); bU.forEach((x) => used.add(x));
    ingFreq.clear(); bI.forEach((v, k) => ingFreq.set(k, v));
    cravedCount.clear(); bC.forEach((v, k) => cravedCount.set(k, v));
    const day = best!;
    topUpMeals(day.meals, target, opts.avoid ?? [], corrUsed);
    days.push(day);
  }
  return days;
}
