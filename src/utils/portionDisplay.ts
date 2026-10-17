// ─────────────────────────────────────────────────────────────────────────────
// MENÚ HSC V1 · BLOQUE 4 · PORCIÓN VISIBLE (DISPLAY_PORTION) a partir de los gramos internos (INTERNAL_GRAMS).
//
// IMPORTANTE: esto es SOLO lo que se pinta. Las macros/kcal del plan salen de los gramos internos exactos
// (meal.macros, meal.ings[].g); el texto visible nunca obliga al solver a moverse.
//
//   D1 · medida por familia de alimento (la que usaría una nutrióloga):
//        granos / pasta / avena / leguminosas / fruta picada / lácteos líquidos → taza (fracciones ¼ ⅓ ½ ⅔ ¾);
//        fruta entera, huevo, tortilla, tostada, pan, bagel, pita, dátil       → pieza / rebanada;
//        aceite, miel, cremas, untables, aderezos, semillas                     → cdita / cda (medios);
//        pollo, carne, pescado, mariscos, quesos, frutos secos                  → gramos;
//        condimento / guarnición                                                → «al gusto».
//      La medida sale de measureAuthority (cerrada > catálogo > SMAE de la app). Sin medida confiable → gramos.
//   D3 · gramos visibles en múltiplos de 5 (≥ 10 g), salvo que sea la porción base de la receta de Magaly o que
//        el redondeo cruce un límite del ingrediente (max_g / techo humano): ahí se conserva el valor exacto.
//   D4 · piezas: enteras (huevo, tortilla, tostada, dátil, fruta chica…), medias solo donde es natural (pan pita,
//        bagel, fruta grande que se parte), tercios solo para aguacate (SMAE: ⅓ pieza). Toda medida casera debe
//        ser honesta: ±20 % de los gramos reales; si no, gramos.
//   D7 · singular/plural, nombres sin medidas duplicadas.
// Puro, sin estado.
// ─────────────────────────────────────────────────────────────────────────────
import type { BancoIng } from '../data/banco';
import { measureOf, type MeasureUnit } from './measureAuthority';
import { portionBoundsFor } from './portionPlausibility';

const HONEST = 0.20;
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// ── Familias (D1). Se evalúan sobre el nombre visible normalizado (sin acentos). ───────────────────────
/** Siempre en gramos: proteína animal / vegetal densa, quesos, frutos secos, chocolate, ate. */
const GRAMS_RE = /pollo|pechuga|carne|\bres\b|sirloin|falda|bistec|molida|milanesa|pescado|salmon|atun|camaron|gamba|merluza|boqueron|sardina|tofu|\bmachaca\b|chambarete|tocino|serrano|\bqueso(?! crema)|requeson|ricotta|cottage|almendra|nuez|nueces|cacahuate|pistache|pasas|chocolate|\bate de\b|(?<!pure de )\bpapas?\b|calabacita|jitomate(?! cherry)|cebolla|champin/;
/** Cucharas: grasas, endulzantes, untables, aderezos, semillas, polvos. */
const SPOON_RE = /aceite|^miel\b|crema de (cacahuate|almendra)|mantequilla de|\bcrema\b|queso crema|mayonesa|aderezo|hummus|pesto|chia|ajonjoli|semilla|coco|cacao|nibs|cocoa|linaza|vinagreta/;
/** Salsas / sub-recetas sin medida de catálogo: regla previa de Magaly (1 cda = 15 g · 1 taza = 240 g). */
const SAUCE_RE = /salsa|aderezo|guacamole|pico de gallo|chimichurri|vinagreta|tzatziki|glaseado|hummus|mayonesa|crema|mostaza|miel|pure de jitomate/;
/** Taza: granos cocidos, pasta, cereales, leguminosas, lácteos líquidos, fruta y verdura picada. */
const CUP_RE = /arroz|pasta|espagueti|fideo|noodle|ramen|quinoa|avena|granola|cereal|corn flakes|palomitas|frijol|lenteja|garbanzo|alubia|edamame|elote|pure|camote|leche|yog|caldo|jugo|fresa|frambuesa|zarzamora|mora|arandano|frutos rojos|mango|pina|papaya|sandia|melon|uva|jicama|pepino|zanahoria|nopal|pimiento|espinaca|platano macho/;
const CUP_EXCLUDE_RE = /galleta|inflad|harina|tortita|crema de|leche de|congelad/;
/** Pieza / rebanada (D4). */
const PIECE_RE = /huevo|tortilla|tostad|totopo|\bpan\b|bagel|pita|baguette|datil|aceituna|cereza|guayaba|kiwi|higo|mandarina|ciruela|fresa|manzana|pera\b|naranja|durazno|platano(?! macho)|mango|toronja|granada|aguacate/;
/** Piezas que se cuentan ENTERAS (no hay «½ huevo», «½ guayaba» ni «0.7 tortillas»). */
const WHOLE_RE = /huevo|tortilla|tostad|totopo|datil|aceituna|cereza|guayaba|kiwi|higo|mandarina|ciruela|fresa/;
/** Medias naturales: pan que se parte y fruta grande que se come partida (SMAE: ½ plátano, ½ mango…). */
const HALF_RE = /\bpan\b|bagel|pita|baguette|manzana|pera\b|naranja|durazno|platano|mango|toronja|granada/;
/** Una «pieza» de más de esto no es una porción (un melón entero): se usa taza. */
const MAX_PIECE_G = 300;

// ── Números y fracciones ────────────────────────────────────────────────────
const CUP_FRACS: Array<[number, string]> = [[0, ''], [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾']];
function snapTo(x: number, fracs: number[]): number {
  const whole = Math.floor(x);
  let best = whole, bd = Infinity;
  for (const f of [...fracs, 1]) { const c = whole + f; const d = Math.abs(c - x); if (d < bd - 1e-9) { bd = d; best = c; } }
  return best;
}
export function fmtCount(n: number): string {
  const whole = Math.floor(n + 1e-9);
  const frac = n - whole;
  let sym = '', bestd = 0.06;
  for (const [v, s] of CUP_FRACS) { const d = Math.abs(v - frac); if (s && d < bestd) { bestd = d; sym = s; } }
  return sym ? (whole ? String(whole) : '') + sym : String(whole);
}
const honest = (n: number, per: number, grams: number) => Math.abs(n * per - grams) <= HONEST * grams;

// ── Plurales (D7) ───────────────────────────────────────────────────────────
const STOP_PLURAL = new Set(['de', 'del', 'con', 'a', 'al', 'en', 'para', 'y', 'sin', 'tipo', 'pita', 'thin', 'light']);
/** Plurales irregulares/préstamos de uso común en México. */
const PLURAL_EXC: Record<string, string> = { bagel: 'bagels', baguette: 'baguettes', pan: 'panes' };
export function pluralWord(w: string): string {
  const exc = PLURAL_EXC[w.toLowerCase()];
  if (exc) return w[0] === w[0].toUpperCase() ? exc[0].toUpperCase() + exc.slice(1) : exc;
  if (/s$/i.test(w)) return w;
  return /[aeiouáéíóú]$/i.test(w)
    ? w + 's'
    : w.replace(/ó(?=n$)/, 'o').replace(/á(?=n$)/, 'a').replace(/é(?=n$)/, 'e') + 'es';
}
function pluralNoun(un: string, n: number): string {
  if (n <= 1) return un;
  const [head, ...rest] = un.split(' ');
  return [pluralWord(head), ...rest].join(' ');
}
/** Singular de una frase cuyo nombre ya viene en plural en el banco («Tortillas de maíz» → «tortilla de maíz»). */
function singularPhrase(txt: string, un: string | undefined): string {
  let stop = false;
  return txt.split(' ').map((w, i) => {
    if (stop || w.startsWith('(') || STOP_PLURAL.has(w.toLowerCase())) { stop = true; return w; }
    if (!/s$/i.test(w) || w.length <= 3) return w;
    if (i === 0) {
      const head = (un ?? '').split(' ')[0];
      if (head && pluralWord(head).toLowerCase() === w.toLowerCase()) return w[0] === w[0].toUpperCase() ? head[0].toUpperCase() + head.slice(1) : head;
      if (/^(\w+)es$/i.test(w) && /[dlnrz]es$/i.test(w)) return w.slice(0, -2);   // dátiles → dátil, panes → pan
      return /[aeiouáéíóú]s$/i.test(w) ? w.slice(0, -1) : w;
    }
    return w.slice(0, -1);
  }).join(' ');
}
function pluralPhrase(txt: string, n: number): string {
  if (n <= 1) return txt;
  let stop = false;
  return txt.split(' ').map((w) => {
    if (stop || w.startsWith('(') || STOP_PLURAL.has(w.toLowerCase())) { stop = true; return w; }
    return pluralWord(w);
  }).join(' ');
}
/** Quita del nombre una medida que ya viene escrita («Pan tostado (2 rebanadas)») para no duplicarla. */
function cleanName(nv: string): string {
  return nv.replace(/\s*\(\s*(\d+|[½¼⅓¾⅔])\s*(rebanadas?|piezas?|pz|tazas?|cdas?|cditas?)\s*\)/i, '').trim();
}

// ── D3 · gramos visibles ────────────────────────────────────────────────────
/** Gramos que se MUESTRAN: múltiplo de 5 desde 10 g; exacto si es la base de la receta o si redondear cruzaría
 *  un límite del ingrediente (max_g o techo humano N1). Los gramos internos no cambian. Puro. */
export function displayGrams(ing: Pick<BancoIng, 'nv' | 'g0' | 'max'>, g: number): number {
  const exact = Math.round(g);
  if (exact < 10 || exact === Math.round(ing.g0)) return exact;
  const r = Math.round(exact / 5) * 5;
  const hard = portionBoundsFor(ing.nv)?.hardMaxG;
  if ((ing.max != null && r > ing.max) || (hard != null && r > hard) || r <= 0) return exact;
  return r;
}
const gramsStr = (ing: BancoIng, g: number) => `${displayGrams(ing, g)} g ${cleanName(ing.nv)}`;

// ── Unidades ────────────────────────────────────────────────────────────────
function cupStr(ing: BancoIng, grams: number): string | null {
  const m = measureOf(ing, 'taza');
  if (!m) return null;
  const n = Math.max(0.25, snapTo(grams / m.g, [0, 0.25, 1 / 3, 0.5, 2 / 3, 0.75]));
  if (n > 6 || !honest(n, m.g, grams)) return null;
  return `${fmtCount(n)} ${pluralNoun('taza', n)} de ${cleanName(ing.nv).toLowerCase()}`;
}
function spoonStr(ing: BancoIng, grams: number): string | null {
  const cda = measureOf(ing, 'cda'), cdita = measureOf(ing, 'cdita');
  const tryUnit = (per: number, unit: 'cda' | 'cdita', cap: number): string | null => {
    const n = Math.max(0.5, Math.round((grams / per) * 2) / 2);
    if (n > cap || !honest(n, per, grams)) return null;
    return `${fmtCount(n)} ${n <= 1 ? unit : unit + 's'} de ${cleanName(ing.nv).toLowerCase()}`;
  };
  // Cucharaditas por debajo de 1 cda; cucharadas desde ahí (hasta 6), y si no cabe, taza si la hay.
  if (cda && grams >= cda.g * 0.9) return tryUnit(cda.g, 'cda', 6) ?? cupStr(ing, grams);
  if (cdita) return tryUnit(cdita.g, 'cdita', 3) ?? (cda ? tryUnit(cda.g, 'cda', 6) : null);
  return null;
}
function legacySauceStr(nv: string, grams: number): string {
  if (grams < 60) {
    const n = Math.max(0.5, Math.round((grams / 15) * 2) / 2);
    return `${fmtCount(n)} ${n <= 1 ? 'cda' : 'cdas'} de ${nv.toLowerCase()}`;
  }
  const n = Math.max(0.25, snapTo(grams / 240, [0, 0.25, 1 / 3, 0.5, 2 / 3, 0.75]));
  return `${fmtCount(n)} ${pluralNoun('taza', n)} de ${nv.toLowerCase()}`;
}
/** Paso natural de una pieza (D4): 1 entero · ½ medias · ⅓ aguacate (SMAE). */
function pieceFracs(key: string): number[] {
  if (/aguacate/.test(key)) return [0, 1 / 3, 0.5, 2 / 3];
  if (WHOLE_RE.test(key)) return [0];
  if (HALF_RE.test(key)) return [0, 0.5];
  return [0];
}
function pieceStr(ing: BancoIng, grams: number, key: string): string | null {
  const slice = /\bpan\b/.test(key) ? measureOf(ing, 'rebanada') : null;
  if (slice) {
    const n = Math.max(1, Math.round(grams / slice.g));
    if (n > 6 || !honest(n, slice.g, grams)) return null;
    return `${n} ${n === 1 ? 'rebanada' : 'rebanadas'} de ${cleanName(ing.nv).toLowerCase()}`;
  }
  const m = measureOf(ing, 'pieza');
  if (!m || m.g > MAX_PIECE_G) return null;
  const fracs = pieceFracs(key);
  const n = Math.max(fracs.length > 1 ? Math.min(...fracs.filter((f) => f > 0)) : 1, snapTo(grams / m.g, fracs));
  const maxN = Math.max(8, Math.ceil(150 / m.g));
  if (n > maxN || !honest(n, m.g, grams)) return null;
  const name = cleanName(ing.nv);
  return `${fmtCount(n)} ${(n <= 1 ? singularPhrase(name, ing.un) : pluralPhrase(name, n)).toLowerCase()}`;
}

/** Porción visible de un ingrediente servido con `g` gramos internos. Puro. */
export function portionStr(ing: BancoIng, g: number | null): string {
  // guarnición = verdura que nadie pesa; condimento = sin cantidad → «al gusto» (D1).
  if (ing.rol === 'guarnicion') return `${ing.nv} al gusto`;
  if (ing.rol === 'condimento') return /al gusto|^pizca/i.test(ing.nv) ? ing.nv : `${ing.nv} al gusto`;
  const grams = Math.round(g ?? ing.g0);
  if (grams <= 0) return `${grams} g ${ing.nv}`;
  const key = norm(ing.nv);
  // Jamón / pavo en rebanadas (medida cerrada: 21.33 g/rebanada). Siempre rebanadas enteras.
  const slice = !/\bpan\b/.test(key) ? measureOf(ing, 'rebanada') : null;
  if (slice) {
    const n = Math.max(1, Math.round(grams / slice.g));
    return `${n} ${n === 1 ? 'rebanada' : 'rebanadas'} de ${cleanName(ing.nv).toLowerCase()}`;
  }
  // Cucharas (grasas, endulzantes, untables, aderezos, semillas).
  // Si el alimento TIENE medida de cuchara confiable y ninguna es honesta, gramos (no se inventa otra).
  if (SPOON_RE.test(key)) {
    const s = spoonStr(ing, grams);
    if (s) return s;
    if (measureOf(ing, 'cda') || measureOf(ing, 'cdita')) return gramsStr(ing, grams);
  }
  // Salsas y sub-recetas sin medida del catálogo: regla de Magaly (cdas chicas / tazas grandes).
  // (Una proteína «glaseada» o «en salsa» NO es una salsa: «taza de salmón glaseado» era un bug de D7.)
  if (ing.rol === 'sub-receta' || (SAUCE_RE.test(key) && !GRAMS_RE.test(key))) {
    const s = grams >= 60 ? cupStr(ing, grams) : spoonStr(ing, grams);
    return s ?? legacySauceStr(cleanName(ing.nv), grams);
  }
  // «Caldo de pollo» / «Jugo de…» / «Puré de…» son líquidos o purés (taza), aunque nombren una proteína.
  if (GRAMS_RE.test(key) && !/^(caldo|jugo|pure)\b/.test(key)) return gramsStr(ing, grams);
  // Pasta / fideo SECO (macros > 2.5 kcal/g): la taza del catálogo de un seco no describe la porción → gramos.
  const dryStarch = !!ing.a && ing.a[0] > 2.5 && /pasta|codito|fideo|noodle|ramen|tallar/.test(key);
  if (PIECE_RE.test(key)) {
    const s = pieceStr(ing, grams, key);
    if (s) return s;
  }
  if (CUP_RE.test(key) && !CUP_EXCLUDE_RE.test(key) && !dryStarch) {
    const s = cupStr(ing, grams);
    if (s) return s;
  }
  return gramsStr(ing, grams);
}

/** Unidad visible de un ingrediente contable para cuadrar sus gramos internos (solver, D4): gramos por paso o null. */
export function servedPieceStep(ing: BancoIng): number | null {
  const key = norm(ing.nv);
  if (!PIECE_RE.test(key) || GRAMS_RE.test(key)) return null;
  if (/\bpan\b/.test(key)) {
    const r = measureOf(ing, 'rebanada');
    if (r) return r.g;
  }
  const m = measureOf(ing, 'pieza');
  if (!m || m.g > MAX_PIECE_G) return null;
  if (WHOLE_RE.test(key)) return m.g;
  if (/\bpan\b|bagel|pita|baguette/.test(key)) return m.g / 2;
  return null;   // fruta: no se fuerza en el solver (solo en el display)
}

export type { MeasureUnit };
