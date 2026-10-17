// Motor del plan de nutrición: arma días de 5 tiempos del banco de Magaly y ajusta
// las porciones (solo `principal`) a la meta del usuario, RESPETANDO el reparto de
// Magaly por comida (LOGICA 3.5): calorías 25/35/25/15, proteína pareja en las 3
// principales (snacks menos), carbos/grasa siguen el reparto, verduras en comida+cena.
// Reglas: fijo/guarnición/sub-receta/condimento quietos; `bloque` escala completo; `max_g` tope.
import { BANCO, type BancoDish, type BancoIng } from '../data/banco';
import type { DayPlan, MealItem, MenuCapacityIssue, RecipeCapacityLimit } from '../types';
import type { Region } from './region';
import { dishAllowedInRegion } from '../data/regionFood';
import { portionBoundsFor, preferredGramLimit } from './portionPlausibility';
import { compatibleComplements, complementDish } from './menuComplements';
import { dishStructure } from './recipeStructure';
import { portionStr, servedPieceStep } from './portionDisplay';   // NUTRITION-N1 techo humano · N2 capacidad preferida
import { effectiveDishAvoidText, dishAvoidUnits, canonicalizeAvoidTerm, catMarker, type AvoidMode } from './allergenSafety';   // NUTRITION-N3 · sub-recetas + composites ocultos

const IMG_BASE =
  'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PLATILLOS%20BANCO/';

export interface PlanTarget { kcal: number; protG: number; fatG: number; carbG: number }

/**
 * P0-03 · FAIL CLOSED. No existe ningún platillo elegible para un tiempo con las
 * restricciones efectivas del usuario.
 *
 * Las restricciones y el tiempo de comida son INVARIANTES NO RELAJABLES: un pool
 * vacío no autoriza servir un alérgeno ni un platillo de otro tiempo. Cuando de
 * verdad no hay opción, el motor lo DICE en vez de fabricar disponibilidad.
 *
 * Hasta dónde llega: lo lanzan `buildDay` (vía `buildWeeklyPlan`) y
 * `buildDayWithFixed`. Lo recogen `WeeklyNutritionPlanner.advance` (muestra el
 * error de generación ya existente), `useAutoRegenPlan` (deja el plan anterior en
 * pantalla y lo registra) y `TabHoy` (conserva el día sin el bowl).
 */
export class NoEligibleDishesError extends Error {
  readonly slot: string;
  readonly avoid: string[];
  constructor(slot: string, avoid: string[]) {
    const r = avoid.length ? avoid.join(', ') : 'ninguna';
    super(`Sin platillos elegibles para ${slot} con las restricciones activas (${r}). `
      + 'No se sirve un platillo de otro tiempo ni se relaja una restricción para rellenar.');
    // `name` explícito: el instanceof sobrevive al bundling, pero el nombre es lo que
    // queda en los logs y lo que la UI puede distinguir de un fallo genérico.
    this.name = 'NoEligibleDishesError';
    this.slot = slot;
    this.avoid = [...avoid];
  }
}

const BY_TIME: Record<string, BancoDish[]> = { Desayuno: [], Comida: [], Cena: [], Snack: [] };
for (const d of BANCO) if (mainEligible(d)) (BY_TIME[d.tiempo] ??= []).push(d);

/**
 * MENÚ V1 · HALLAZGO-04 · los 6 platillos DULCES clasificados como Cena en el CSV (`sabor = dulce` × `tiempo =
 * Cena`: Hot Cakes de Camote, Hot Cakes de Zanahoria, Crepas Dulces de Plátano y Cacahuate, Overnight Oats de Mango
 * y Coco, Overnight Oats de Zanahoria, Yogurt con Frutos Rojos y Almendras) dejan de ser elegibles como cena
 * principal. No se borran del banco ni se reclasifican (validación e histórico intactos). Puro.
 */
export function mainEligible(d: BancoDish): boolean {
  return !(d.tiempo === 'Cena' && d.sabor === 'dulce');
}
// DECISIÓN 06 · aquí vivía `hasVeg` = `d.ings.some(i => i.rol === 'guarnicion')`, y con él
// COMIDA_VEG/CENA_VEG: los pools de Comida y Cena quedaban reducidos a los platillos con
// ese tag. Se retiró como filtro de elegibilidad.
//
// `rol:'guarnicion'` no es autoridad nutricional. Las instrucciones a Magaly lo definen como
// una anotación OPCIONAL para registrar una verdura de guarnición («Puedes escribir
// "guarnición" en la columna `nota` si quieres»), y permiten explícitamente dejar las salsas
// caseras como compuesto. Un campo de registro voluntario decidía qué recetas existían: 10
// platillos de Comida/Cena quedaban fuera por no llevarlo, 4 de ellos CON verdura real
// (zanahoria de 40 g como ingrediente principal, pico de gallo, guacamole).
//
// La elegibilidad la decide el `tiempo` del platillo (+ las restricciones del socio). La
// calidad vegetal del plan sigue siendo un objetivo de producto, pendiente de definir, no un
// filtro sobre un tag. `guarnicion` conserva intacto su uso de DISPLAY (portionStr → «al
// gusto») y en la lista de compra.

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
// NUTRITION-N3 · el texto de detección de restricciones ahora es el EFECTIVO: nombre + ingredientes +
// ingredientes REALES de sus sub-recetas (SUBRECETAS) + marcadores de alérgeno oculto (mayonesa=huevo,
// hummus=ajonjolí…). Así el MISMO makeAvoidFilter ve lo que antes quedaba escondido. Solo alimenta la
// detección de "evitar"/"antojo"; NO cambia macros/porciones/selección nutricional.
/** Unidades de detección de "evitar" de un platillo en UN modo (estricto o suave). */
interface AvoidUnits {
  avoidWords: Set<string>; avoidText: string;              // EVITAR: solo ingredientes
  units: { text: string; words: Set<string> }[];           // EVITAR: por ingrediente (excepciones)
}
interface DishText extends AvoidUnits {
  text: string; words: Set<string>;                        // ANTOJO: nombre + ingredientes
  /** WEEKLY PREFERENCES · las mismas unidades en modo SUAVE (ingredientes propios + reglas IS). */
  soft: AvoidUnits;
}
const tokenize = (text: string) => ({ text, words: new Set(text.split(/[^a-z0-9]+/).filter(Boolean)) });
// Separador entre unidades: un término nunca lo contiene, así que una frase ("carne asada")
// NO puede formarse cruzando el final de un ingrediente con el principio del siguiente.
const UNIT_SEP = ' \u0000 ';
function avoidUnitsOf(d: BancoDish, mode: AvoidMode): AvoidUnits {
  const units = dishAvoidUnits(d, mode).map(tokenize);
  const avoidWords = new Set<string>();
  for (const u of units) for (const w of u.words) avoidWords.add(w);
  return { avoidWords, avoidText: units.map((u) => u.text).join(UNIT_SEP), units };
}
function buildDishText(d: BancoDish): DishText {
  // `text`/`words` = nombre + ingredientes (ANTOJO: ahí el nombre del platillo SÍ es la señal).
  // `units`        = un token-set por INGREDIENTE, sin el nombre (EVITAR: manda la composición).
  return { ...tokenize(effectiveDishAvoidText(d)), ...avoidUnitsOf(d, 'strict'), soft: avoidUnitsOf(d, 'soft') };
}
const DTEXT = new Map<BancoDish, DishText>();
for (const d of BANCO) DTEXT.set(d, buildDishText(d));
/** Cacheado para el BANCO; calculado al vuelo para cualquier otro platillo (nunca lanza). */
const dishText = (d: BancoDish): DishText => DTEXT.get(d) ?? buildDishText(d);
// term con espacio → substring; palabra suelta → límite de palabra (evita "pan" en "panela").
const unitMatches = (u: { text: string; words: Set<string> }, term: string) =>
  term.includes(' ') ? u.text.includes(term) : u.words.has(term);
// ANTOJO: el nombre del platillo cuenta ("se me antojan unos tacos").
function dishMatches(d: BancoDish, term: string): boolean {
  return unitMatches(dishText(d), term);
}
const dishMatchesAny = (d: BancoDish, terms: string[]) => terms.some((t) => dishMatches(d, t));

// ── P0-01 · DETECCIÓN DE RESTRICCIONES ───────────────────────────────────────
// Excepciones por TÉRMINO: nombres de ingrediente donde el término aparece pero NO
// representa el alimento prohibido. Mismo espíritu que el lookahead de "crema de
// cacahuate" en allergenSafety. Mínimo y auditado contra los ingredientes reales.
const TERM_EXCEPT: Record<string, RegExp> = {
  galleta: /galletas? de arroz/,     // galleta de ARROZ = sin gluten
  galletas: /galletas? de arroz/,
  // DECISIÓN 05 · PD-02: la granola SIEMPRE activa gluten salvo que el ingrediente declare
  // EXPLÍCITAMENTE que es la variante sin gluten. NO se infiere de "de avena" ni de nada más.
  granola: /\bsin gluten\b|\bgluten free\b/,
};
/** ¿Algún INGREDIENTE del platillo (o de sus sub-recetas) contiene alguno de los términos? */
function dishMatchesAvoidTerms(d: BancoDish, terms: string[]): boolean {
  return unitsMatchAvoidTerms(dishText(d), terms);
}
/** El matcher de "evitar" sobre unas unidades ya construidas (estrictas o suaves). Mismas excepciones. */
function unitsMatchAvoidTerms(e: AvoidUnits, terms: string[]): boolean {
  if (!terms.length) return false;
  for (const t of terms) {
    const ex = TERM_EXCEPT[t];
    if (!ex) {
      // Camino rápido: palabra suelta contra el set unión, frase contra el texto con separador
      // (que impide que la frase cruce dos ingredientes). Equivalente al recorrido por unidad.
      if (t.includes(' ') ? e.avoidText.includes(t) : e.avoidWords.has(t)) return true;
      continue;
    }
    // Con excepción: hay que saber EN QUÉ ingrediente cayó el término.
    for (const u of e.units) {
      if (unitMatches(u, t) && !ex.test(u.text)) return true;
    }
  }
  return false;
}

// Categorías de "evitar" / alergias → alimentos/palabras reales del banco.
const AVOID_MAP: Record<string, string[]> = {
  // P0-01 · los términos se buscan en el nombre de cada INGREDIENTE, no en el del platillo.
  // 'waffle'/'hot cake'/'cereal' son conceptos de PLATILLO, no ingredientes: se conservan por
  // defensa (si algún día un ingrediente se llama así) pero ya no pueden excluir por el nombre.
  // 'granola' → gluten por DECISIÓN 05 · PD-02: la granola genérica lleva malta de cebada o trigo.
  // Solo queda exenta si el ingrediente se modela EXPLÍCITAMENTE como variante sin gluten (ver TERM_EXCEPT).
  gluten: ['pan', 'pasta', 'espagueti', 'bagel', 'baguette', 'waffle', 'waffles', 'pita', 'tallarines', 'noodles', 'fideo', 'fideos', 'galleta', 'galletas', 'granola', 'crutones', 'cereal', 'tortilla de harina', 'harina de trigo', 'hot cake', 'hot cakes', 'corn flakes'],
  lacteos: ['leche', 'queso', 'yogur', 'yoghurt', 'yogurt', 'requeson', 'ricotta', 'cottage', 'panela', 'oaxaca', 'feta', 'mozzarella', 'parmesano', 'crema acida'],
  // 'molida' suelta excluía "Papa molida" y "Carne molida de pavo" (ni una ni otra es carne roja):
  // se sustituye por las frases que sí identifican el corte. 'carne asada' cierra el hueco genérico.
  'carne-roja': ['res', 'sirloin', 'bistec', 'falda', 'molida magra', 'molida de res', 'carne asada', 'machaca', 'chambarete', 'arrachera'],
  // Magaly: "mariscos" abarca TODO lo del mar (incluye pescado). El toggle "pescado"
  // es el subconjunto para quien solo quiere fuera el pescado pero sí come camarón.
  mariscos: ['camaron', 'camarones', 'gamba', 'gambas', 'marisco', 'mariscos', 'pescado', 'salmon', 'atun', 'tilapia', 'bacalao', 'merluza', 'sardina', 'sardinas', 'boqueron', 'boquerones'],
  // Alergias:
  huevo: ['huevo', 'huevos'],
  'frutos-secos': ['nuez', 'nueces', 'almendra', 'almendras', 'pistache', 'pistaches', 'avellana', 'avellanas'],
  cacahuate: ['cacahuate', 'cacahuates'],
  soya: ['soya', 'edamame', 'edamames'],
  pescado: ['pescado', 'salmon', 'atun', 'tilapia', 'bacalao', 'merluza', 'sardina', 'sardinas', 'boqueron', 'boquerones'],
  ajonjoli: ['ajonjoli', 'sesamo'],
  // Aves y cerdo (faltaban): sin esto un vegetariano no podía sacar el pollo/pavo/cerdo.
  pollo: ['pollo', 'pechuga'],
  pavo: ['pavo'],
  cerdo: ['cerdo', 'chorizo', 'tocino', 'lomo', 'jamon'],
  // Dietas: expanden a TODA la proteína animal. Vegano suma huevo y lácteos.
  // 'carne' (palabra suelta) cierra el hueco genérico: "Carne asada" no traía ningún corte
  // específico de la lista (res/bistec/arrachera…) y se colaba en planes veg. Sin falso
  // positivo: no existe "carne" vegetal en el banco; el matcher es por límite de palabra.
  vegetariano: [
    'carne', 'pollo', 'pechuga', 'pavo', 'cerdo', 'chorizo', 'tocino', 'lomo', 'jamon',
    'res', 'sirloin', 'bistec', 'falda', 'molida', 'machaca', 'arrachera', 'chambarete',
    'camaron', 'camarones', 'marisco', 'mariscos', 'pescado', 'salmon', 'atun', 'tilapia', 'bacalao',
  ],
  vegano: [
    'carne', 'pollo', 'pechuga', 'pavo', 'cerdo', 'chorizo', 'tocino', 'lomo', 'jamon',
    'res', 'sirloin', 'bistec', 'falda', 'molida', 'machaca', 'arrachera', 'chambarete',
    'camaron', 'camarones', 'marisco', 'mariscos', 'pescado', 'salmon', 'atun', 'tilapia', 'bacalao',
    'huevo', 'huevos', 'leche', 'queso', 'yogur', 'yoghurt', 'yogurt', 'requeson', 'ricotta',
    'cottage', 'panela', 'oaxaca', 'feta', 'mozzarella', 'parmesano', 'crema', 'miel',
  ],
};
function expandAvoid(raw: string[]): string[] {
  const skip = new Set(['nada', 'ninguno', 'ninguna', 'todas', 'todo', 'todos']);
  const out: string[] = [];
  for (const a of raw) {
    // NUTRITION-N3 · canoniza la entrada localizada del usuario (maní→cacahuate, sésamo→ajonjolí) y añade
    // el MARCADOR de categoría → matchea los alérgenos ocultos que el texto efectivo del plato ya emite
    // (mayonesa=huevo, sub-receta César=huevo+lácteos, salsa de soya=gluten…). Un solo enforcement.
    const c = canonicalizeAvoidTerm(a);
    if (skip.has(c)) continue;
    out.push(catMarker(c), ...(AVOID_MAP[c] ?? [c]));
  }
  return out.map(norm);
}

/** Expande categorías de "evitar" (gluten, cacahuate, vegetariano…) a términos de
 *  ingrediente. Reutilizable fuera del motor (ej. filtrar el plan estático). */
export function expandAvoidCats(cats: string[]): string[] {
  return expandAvoid(cats.map((s) => s.toLowerCase().trim()).filter(Boolean));
}

/** ¿El texto (nombre/porción) contiene alguno de los términos de "evitar"? Por palabra. */
export function textMatchesAvoid(text: string, terms: string[]): boolean {
  if (!terms.length) return false;
  const t = norm(text || '');
  return terms.some((term) => term && new RegExp(`\\b${term}\\b`).test(t));
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

interface Var { a: number[]; g: number; g0: number; lo: number; hi: number; blk: number | null; ing: BancoIng; steps?: number[] }

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
export function ingBounds(ing: BancoIng): { lo: number; hi: number } {
  const a = ing.a!;
  // Techo por tipo de alimento. Regla de Magaly: cuando faltan calorías, que suba la
  // GUARNICIÓN DE ALMIDÓN (arroz, papa, camote, pasta, avena, leguminosas) — no las
  // tostadas. Una porción grande de arroz es normal; 8 tostadas no. La GRASA se aprieta
  // porque es la que se desborda (el solver la pondera con W[1]).
  const fatDom = a[2] * 9 > a[1] * 4 && a[2] * 9 > a[3] * 4;
  const mult = fatDom ? 2.0
    : CRUJIENTE_RE.test(ing.nv) ? 1.5      // tostada/totopo/galleta: casi no crece
    : ALMIDON_RE.test(ing.nv) ? 3.0        // arroz/papa/camote/pasta: aquí sube
    : 3.0;
  let hi = Math.round(ing.g0 * mult);
  // MENÚ V1 · B1 · `max_g` del CSV es un TECHO (CORRECCIONES-APP-HSC §3: «El max_g es un TECHO, no una
  // meta»). Antes era `max(ing.max, g0·mult)` y SUBÍA el techo (p. ej. machaca 50→116 g con max 60).
  if (ing.max && ing.max > 0) hi = Math.min(hi, ing.max);
  // Contables: nunca más de N piezas realistas (tortilla ≤6, huevo ≤6, tostada ≤6…).
  const pieceMax = ing.pu && ing.un ? PIECE_MAX[ing.un] : undefined;
  if (pieceMax && ing.pu) hi = Math.min(hi, Math.round(pieceMax * ing.pu));
  // Techo absoluto por alimento: aquí se detiene el crecimiento, para que no salgan
  // 525 g de papa (Magaly: que suba el arroz/papa, pero sin porciones desproporcionadas).
  for (const [rx, gmax] of GRAM_MAX) if (rx.test(ing.nv)) { hi = Math.min(hi, gmax); break; }
  // NUTRITION-N1 · TECHO HUMANO por familia (fruta/aceite/nueces/lácteos/granola): el solver NO puede
  // cerrar calorías con "2–3 tazas de fresas". Otro `min` (nunca afloja PIECE_MAX/GRAM_MAX/ing.max);
  // se aplica ANTES del guard `max(hi, g0)`, así que jamás encoge por debajo de la receta base de Magaly.
  const human = portionBoundsFor(ing.nv);
  if (human) hi = Math.min(hi, human.hardMaxG);
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
  if (d.steps) return closedRecipeMacros(d, 'min');
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
  if (d.steps) return closedRecipeMacros(d, 'max');
  const t = [d.fixed[0], d.fixed[1], d.fixed[2], d.fixed[3]];
  for (const ing of d.ings) {
    if (ing.rol === 'principal' && ing.a) {
      const { hi } = ingBounds(ing);
      for (let k = 0; k < 4; k++) t[k] += ing.a[k] * hi;
    }
  }
  return t;
}

/** MENÚ V1 · Bloque 5 · macros de una receta CERRADA en su porción válida mínima o máxima (sus `steps`). */
export function closedRecipeMacros(d: BancoDish, which: 'min' | 'max'): number[] {
  // Mismo contexto que al servirla: un snack se mide a PORCIÓN NORMAL (CAPA 4 · techos + preferido N2).
  const { vars } = prep([d], d.tiempo === 'Snack');
  const st = validSteps(d.steps ?? [1], blockSMax(vars));
  const s = which === 'min' ? Math.min(...st) : Math.max(...st);
  const t = [d.fixed[0], d.fixed[1], d.fixed[2], d.fixed[3]];
  for (const v of vars) for (let k = 0; k < 4; k++) t[k] += v.a[k] * v.g0 * s;
  return t;
}
/** Factor servido de un bloque (gramos servidos / base de su primer principal). */
function servedFactor(d: BancoDish, gOf: (ing: BancoIng) => number | undefined): number | null {
  const ing = d.ings.find((i) => i.rol === 'principal' && i.a && i.g0 > 0);
  const g = ing ? gOf(ing) : undefined;
  return ing && typeof g === 'number' ? g / ing.g0 : null;
}
/** «4 bolitas» / «1 barrita»: la porción servida de una receta con unidad cerrada. */
export function servingLabel(d: BancoDish, factor: number): string | null {
  if (!d.srv) return null;
  const n = Math.round(d.srv.base * factor);
  return `${n} ${n === 1 ? d.srv.unit : d.srv.unit + 's'}`;
}

// ── NUTRITION-N2 · CAPACIDAD PREFERIDA (señal de SELECCIÓN, no del solver) ────────────────────────
// Techo PREFERIDO de un ingrediente = su techo N1 (ingBounds.hi, que ya incluye hardMax/PIECE/GRAM)
// ACOTADO al rango humano normal (preferredMaxG) cuando existe, sin bajar nunca de la receta base (g0).
// NO alimenta a solve(): solo estima "hasta dónde da este platillo SIN pasarse de una porción normal".
function ingPreferredHi(ing: BancoIng): number {
  const hardHi = ingBounds(ing).hi;               // techo de seguridad N1 (jamás se afloja)
  const pref = preferredGramLimit(ing.nv);
  const hi = pref != null ? Math.min(hardHi, pref) : hardHi;
  return Math.max(hi, ing.g0);                     // preserva la receta base (igual que ingBounds)
}
const _prefCapMemo = new Map<BancoDish, number[]>();
/** Macros que un platillo alcanza con sus principales a su PORCIÓN PREFERIDA (no al hardMax). Memoizado
 *  por platillo (BANCO es inmutable). Puro/determinista/no-mutante. Base de la señal de capacidad de N2. */
export function dishPreferredMaxMacros(d: BancoDish): number[] {
  const cached = _prefCapMemo.get(d);
  if (cached) return cached;
  // Bloque 5 · una receta cerrada no tiene capacidad «preferida» aparte: es su porción válida máxima.
  if (d.steps) { const t = closedRecipeMacros(d, 'max'); _prefCapMemo.set(d, t); return t; }
  const t = [d.fixed[0], d.fixed[1], d.fixed[2], d.fixed[3]];
  for (const ing of d.ings) {
    if (ing.rol === 'principal' && ing.a) {
      const hi = ingPreferredHi(ing);
      for (let k = 0; k < 4; k++) t[k] += ing.a[k] * hi;
    }
  }
  _prefCapMemo.set(d, t);
  return t;
}

// `normal` = MENÚ V1 · CAPA 4: el techo de cada principal es su PORCIÓN NORMAL — el techo duro acotado al rango
// humano preferido (`ingPreferredHi`) Y al escalado máximo del platillo que fijó Magaly (`mult_max` del banco,
// columna hasta hoy sin uso: g0 × multMax). Nunca bajo la receta base. Lo usan los snacks y la medición de
// cuánto dan las principales «sin hacerse demasiado grandes».
function prep(dishes: BancoDish[], normal = false): { fixed: number[]; vars: Var[] } {
  const fixed = [0, 0, 0, 0, 0]; // kcal, P, F, C, fibra
  const vars: Var[] = [];
  dishes.forEach((d, si) => {
    const bloque = d.tipo === 'bloque';
    for (let i = 0; i < 5; i++) fixed[i] += d.fixed[i];
    for (const ing of d.ings) {
      if (ing.rol === 'principal' && ing.a) {
        const b = ingBounds(ing);
        const hi = normal ? Math.max(ing.g0, Math.min(b.hi, ingPreferredHi(ing), ing.g0 * (d.multMax || 1.5))) : b.hi;
        const lo = Math.min(b.lo, hi);
        vars.push({ a: ing.a, g: ing.g0, g0: ing.g0, lo, hi, blk: bloque ? si : null, ing, ...(bloque && d.steps ? { steps: d.steps } : {}) });
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
      // MENÚ V1 · CAPA 4 · el bloque escala en proporción (0.5–1.5), pero NINGÚN ingrediente cruza su techo
      // (`max_g`, PIECE/GRAM_MAX, techo humano): el factor máximo es el del ingrediente más ajustado. Antes el factor
      // 1.5 ignoraba los techos (p. ej. crema de cacahuate 32 g × 1.5 = 48 g con techo humano de 40 g).
      const sMax = Math.max(0.5, Math.min(1.5, ...grp.map((g) => (g.g0 > 0 ? g.hi / g.g0 : 1.5))));
      const opt = -nu / (de || 1e-9);
      // MENÚ V1 · Bloque 5 · receta CERRADA: solo porciones válidas (bolitas 2/4/6, barrita 1/2/3, pasta y rollitos 1×).
      const s = grp[0].steps ? nearestStep(validSteps(grp[0].steps, sMax), opt) : Math.max(0.5, Math.min(sMax, opt));
      for (const g of grp) g.g = g.g0 * s;
    }
  }
}

/** Pasos válidos de una receta cerrada que caben bajo el factor máximo de sus ingredientes (nunca vacío). */
function validSteps(steps: number[], sMax: number): number[] {
  const ok = steps.filter((x) => x <= sMax + 1e-9);
  return ok.length ? ok : [Math.min(...steps)];
}
const nearestStep = (steps: number[], x: number) => steps.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
/** Factor máximo de un bloque: el ingrediente más ajustado (techo / base), entre 0.5 y 1.5. */
function blockSMax(vars: Var[]): number {
  return Math.max(0.5, Math.min(1.5, ...vars.map((v) => (v.g0 > 0 ? v.hi / v.g0 : 1.5))));
}

function errMax(fixed: number[], vars: Var[], T: number[]): number {
  const x = [fixed[0], fixed[1], fixed[2], fixed[3], fixed[4]];
  for (const v of vars) for (let k = 0; k < 5; k++) x[k] += v.a[k] * v.g;
  let e = 0;
  for (let j = 0; j < 3; j++) { const kk = IDX[j]; e = Math.max(e, Math.abs(x[kk] - T[kk]) / Math.max(T[kk], 1)); }
  return e * 100;
}

/** CAPA 4 · encaje de un SNACK: error ABSOLUTO en kcal (4·|ΔP| + 9·|ΔG| + 4·|ΔC|) relativo a su tamaño, en %. El
 *  relativo por macro (`errMax`) degenera cuando el hueco casi no lleva proteína (denominador ≈ 1 g): no distingue
 *  un snack con 3 g de proteína de uno con 20 g, y el de 20 g pasa la proteína del día. */
function errSnack(fixed: number[], vars: Var[], T: number[]): number {
  const x = [fixed[0], fixed[1], fixed[2], fixed[3]];
  for (const v of vars) for (let k = 1; k < 4; k++) x[k] += v.a[k] * v.g;
  const tk = 4 * T[1] + 9 * T[2] + 4 * T[3];
  return ((4 * Math.abs(x[1] - T[1]) + 9 * Math.abs(x[2] - T[2]) + 4 * Math.abs(x[3] - T[3])) / Math.max(tk, 1)) * 100;
}

function pick<T>(arr: T[], rng: () => number): T { return arr[Math.floor(rng() * arr.length)]; }

// MENÚ V1 · Bloque 4 · la porción VISIBLE vive en portionDisplay (medida por familia + autoridad de medidas).
// WHOLE_ONLY: piezas que la gente cuenta ENTERAS, nunca en medios. Huevo (no hay medio
// huevo), piezas pequeñas indivisibles (dátil, aceituna, cereza, sardina — "½ aceituna"
// no existe) y tortilla/tostada (un plan legible cuenta tortillas enteras). El resto
// (pan, pita, bagel, fruta grande cortable) sigue permitiendo medios. Solo cambia el
// DESPLIEGUE: los gramos del solver no se tocan y el candado ±20% sigue mandando — si el
// entero mentiría sobre los gramos reales, se cae a gramos (nunca un entero deshonesto).
const WHOLE_ONLY = new Set(['huevo', 'dátil', 'aceituna', 'cereza', 'sardinas', 'tortilla', 'tostada']);
// SNAP_WHOLE_GRAMS ⊂ WHOLE_ONLY: SOLO estas piezas cuadran sus GRAMOS a un entero de
// piezas antes de sumar macros (para que "2 huevos" aporte exactamente 2 huevos). El
// huevo lo hace desde siempre. Las demás WHOLE_ONLY se cuentan enteras SOLO en pantalla:
// sus gramos del solver NO se tocan (macros idénticas) y el candado ±20% cae a gramos si
// un entero mentiría. Mantener este set en {huevo} conserva el comportamiento embarcado.
const SNAP_WHOLE_GRAMS = new Set(['huevo']);
export { portionStr };

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
      if (ing.pu && ing.un && SNAP_WHOLE_GRAMS.has(ing.un)) g = Math.max(ing.pu, Math.round(g / ing.pu) * ing.pu);
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
  // MENÚ V1 · Bloque 5 · receta con unidad cerrada → la porción servida («4 bolitas») encabeza la descripción.
  const f = dish.srv ? servedFactor(dish, (i) => gOf.get(i)) : null;
  const serving = f != null ? servingLabel(dish, f) : null;
  const desc0 = dish.ings.filter((i) => i.rol === 'principal').slice(0, 3).map((i) => i.nv).join(' · ');
  return {
    time: label,
    name: dish.nombre,
    desc: serving ? `${serving} · ${desc0}` : desc0,
    ...(serving ? { serving } : {}),
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

// ── SNACKS DENSOS (400-800 kcal) ──────────────────────────────────────────────
// Marcados `dense` (nota=snack_denso en el CSV). Solo se ofrecen cuando el requerimiento
// diario es alto; con metas normales quedan fuera del pool para no inflar el plan.
// UMBRAL PROVISIONAL — pendiente de afinar con Magaly. Cambiar aquí (un solo lugar).
export const DENSE_SNACK_KCAL_THRESHOLD = 2800;
/** Filtra el pool de snacks según el requerimiento: los densos solo entran a partir del umbral. */
const gateDense = (pool: BancoDish[], kcal: number): BancoDish[] =>
  kcal >= DENSE_SNACK_KCAL_THRESHOLD ? pool : pool.filter((d) => !d.dense);

/** Mete un snack extra al slot de snack (AM o PM) con menos items, como "2 en 1" —
 *  mergeItems junta nombres, porciones, macros Y fotos (imgs) para el card. */
function mergeIntoSnack(meals: MealItem[], extra: MealItem, extraIsFruit = false): boolean {
  // CAPA 4 · con un slot de snack LIBRE, el corrector sirve un snack propio (máximo 5 tiempos) en vez de
  // fusionar «A + B». Si hay que fusionar, nunca fruta con fruta (D3: la fruta no es relleno de kcal).
  const free = (['Snack PM', 'Snack AM'] as const).find((sl) => !meals.some((m) => m.time === sl));
  if (free) { meals.push({ ...extra, time: free }); return true; }
  const fruitMeal = (m: MealItem) => { const d = BY_NAME.get(m.name.split(' + ')[0]); return !!d && isFruitSnack(d); };
  const amIdx = meals.findIndex((m) => m.time === 'Snack AM' && !(extraIsFruit && fruitMeal(m)));
  const pmIdx = meals.findIndex((m) => m.time === 'Snack PM' && !(extraIsFruit && fruitMeal(m)));
  const count = (i: number) => (i < 0 ? Infinity : (meals[i].ings?.length ?? 1));
  const idx = count(pmIdx) <= count(amIdx) ? pmIdx : amIdx;
  if (idx < 0) return false;
  meals[idx] = mergeItems([meals[idx], { ...extra, time: meals[idx].time }], meals[idx].time);
  return true;
}

// ── Batido de proteína (opción del usuario) ──────────────────────────────────
// El usuario elige tomar proteína en polvo en el snack AM, PM o ambos, su tipo y
// gramos. El batido REEMPLAZA el snack de ese slot; el corrector de macros agrega
// después la mezcla que haga falta (plátano si faltan carbos, crema de cacahuate si
// falta grasa, o sola si va justo) — por eso reduce la meta de los principales antes.
export interface ProteinShake { slots: ('am' | 'pm')[]; type: 'regular' | 'vegana' | 'massgainer'; protG: number }

/** Etiqueta de cada tipo en el texto del batido. ÚNICA fuente: la usan `shakeItem` para construirlo y
 *  `shakeTypeOfService` para leerlo de un plan guardado (sin dos tablas que puedan divergir). */
const SHAKE_TAG: Readonly<Record<ProteinShake['type'], string>> = { regular: '', vegana: ' (vegana)', massgainer: ' (mass gainer)' };
/** Tipos de batido hechos de WHEY (suero de leche): contienen LÁCTEO. */
const WHEY_SHAKES: ReadonlySet<ProteinShake['type']> = new Set(['regular', 'massgainer']);

/**
 * RESTRICCIONES · AUTORIDAD ÚNICA DEL BATIDO. ¿Es compatible este tipo de batido con las restricciones?
 * El whey (regular / mass gainer) es lácteo → incompatible con `lacteos`. La proteína 'vegana' no tiene
 * composición declarada en el catálogo, así que ninguna categoría la bloquea (no se inventa). Un tipo
 * desconocido (`null`) se trata como whey: falla cerrado. Las categorías se canonizan igual que en la
 * autoridad de restricciones; vegano/vegetariano no existen como categoría activa y no bloquean nada.
 * La usan las dos rutas del generador, la validación final y la invalidación por endurecimiento. Puro.
 */
export function shakeCompatibleWith(type: ProteinShake['type'] | null, avoidCats: readonly string[] = []): boolean {
  const avoidsDairy = avoidCats.some((a) => canonicalizeAvoidTerm(String(a)) === 'lacteos');
  if (!avoidsDairy) return true;
  return type !== null && !WHEY_SHAKES.has(type);
}

/** Tipos de batido que ofrece el producto, en el orden en que se muestran. */
export const SHAKE_TYPES: readonly ProteinShake['type'][] = ['regular', 'vegana', 'massgainer'];

/** Categoría que vuelve incompatible un tipo de batido (hoy solo existe la regla del whey). */
export type ShakeBlockReason = 'lacteos';
/** De dónde viene el bloqueo: restricción PERMANENTE o preferencia de ESTA semana. */
export type ShakeBlockOrigin = 'strict' | 'soft';

/**
 * WEEKLY PREFERENCES SPLIT · D-WP5 · veredicto de un tipo de batido para una política (o una lista, que es
 * todo estricto). El whey / mass gainer se bloquea con `lacteos` de CUALQUIER origen: elegir el tipo de
 * proteína es una elección directa y visible, no un ingrediente oculto. Por eso la compatibilidad se
 * decide sobre strict ∪ soft (`shakeCompatibleWith`), pero se CONSERVA el origen del bloqueo: permanente
 * ('strict') si la restricción por sí sola ya lo bloquea; si no, preferencia de la semana ('soft'). Puro.
 */
export function shakeTypeVerdict(type: ProteinShake['type'] | null, avoid: AvoidInput | readonly string[] = []):
  { compatible: boolean; blockedBy: ShakeBlockReason | null; origin: ShakeBlockOrigin | null } {
  const p = toAvoidPolicy(avoid as AvoidInput);
  if (shakeCompatibleWith(type, [...p.strict, ...p.soft])) return { compatible: true, blockedBy: null, origin: null };
  return { compatible: false, blockedBy: 'lacteos', origin: shakeCompatibleWith(type, p.strict) ? 'soft' : 'strict' };
}

/**
 * PROYECCIÓN PARA LA UI de la autoridad única: cada tipo con su compatibilidad para esta política.
 * No es una segunda matriz: cada `compatible` sale de `shakeTypeVerdict` → `shakeCompatibleWith`, la misma
 * autoridad que aplican el generador y la validación final. `origin` permite explicar el motivo. Puro.
 */
export function shakeTypeOptions(avoid: AvoidInput | readonly string[] = []): Array<{ type: ProteinShake['type']; compatible: boolean; blockedBy: ShakeBlockReason | null; origin: ShakeBlockOrigin | null }> {
  return SHAKE_TYPES.map((type) => ({ type, ...shakeTypeVerdict(type, avoid) }));
}

/** Batido elegible para el plan: sin batido → n/a (true); con batido → `shakeTypeVerdict` (D-WP5: lácteos
 *  permanente O semanal bloquea el whey). NO sustituye por otro tipo: si no es compatible, el plan va sin
 *  batido. Puro. */
export function shakeAllowedFor(shake: ProteinShake | undefined, avoid: AvoidInput | readonly string[] = []): boolean {
  return !shake || shakeTypeVerdict(shake.type, avoid).compatible;
}

/** Nombre con que `shakeItem` sirve el batido. Si el corrector le fusiona un snack (`mergeIntoSnack`), el
 *  servicio pasa a llamarse `Batido de Proteína + <snack>`: el batido SIEMPRE es la primera parte. */
export const SHAKE_NAME = 'Batido de Proteína';
/** ¿El nombre es el de un batido, solo o combinado? Solo por nombre: sirve para DETECTAR (falla hacia
 *  invalidar). Para ACEPTAR un servicio como batido se exige la estructura (`classifyService`). */
export const isShakeName = (name: unknown): boolean =>
  name === SHAKE_NAME || (typeof name === 'string' && name.startsWith(`${SHAKE_NAME} + `));

/** Tipo de un batido ya servido (plan guardado), leído de las MISMAS etiquetas con que `shakeItem` lo
 *  escribe. Sin etiqueta = regular (whey). Solo se lee el texto PROPIO del batido —el primer segmento de
 *  `desc` y la primera porción, que es lo que `mergeItems` conserva del batido al fusionarle un snack—:
 *  así un snack añadido no puede cambiarle el tipo. Puro. */
export function shakeTypeOfService(s: { desc?: unknown; portions?: unknown }): ProteinShake['type'] {
  const ownDesc = String(s.desc ?? '').split(' · ')[0];
  const ownPortion = Array.isArray(s.portions) ? String(s.portions[0] ?? '') : '';
  const text = `${ownDesc} ${ownPortion}`;
  if (text.includes(SHAKE_TAG.vegana.trim())) return 'vegana';
  if (text.includes(SHAKE_TAG.massgainer.trim())) return 'massgainer';
  return 'regular';
}

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
  const tag = SHAKE_TAG[s.type];
  return {
    time: label, name: SHAKE_NAME, desc: `${s.protG} g proteína${tag}`,
    img: IMG_BASE + 'batido-de-proteina.webp', // si no existe la foto, el card la oculta solo
    portions: [`1 scoop de proteína${tag} — ${s.protG} g proteína`],
    macros: { ...m, fiber: 0 },
    ings: [{ nv: 'Proteína en polvo', g: 0, rol: 'principal' }],
  };
}

/** Slots de snack que ocupa el batido (CAPA 4: cuentan dentro de los 5 tiempos). */
function shakeSlotsOf(shake: ProteinShake | undefined): Slot[] {
  return shake ? shake.slots.map((sl): Slot => (sl === 'am' ? 'Snack AM' : 'Snack PM')) : [];
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
function topUpMeals(meals: MealItem[], target: PlanTarget, avoidCats: AvoidInput = [], weekUsed?: Set<string>): void {
  const T = [target.kcal, target.protG, target.fatG, target.carbG];
  const cur = macroSum(meals);
  if (cur[0] >= target.kcal * 1.02) return;            // sin espacio calórico
  const rel = (i: number) => (T[i] - cur[i]) / T[i];
  const rf = rel(2), rc = rel(3);                      // solo grasa/carbo (proteína = principales)
  const worst = Math.max(rf, rc);
  if (worst <= 0.05) return;                            // hueco chico → se deja (nada de apilar)
  const avoid = makePolicyFilter(avoidCats);   // MB3 · strict + soft
  const [cls, idx]: ['F' | 'C', number] = rf === worst ? ['F', 2] : ['C', 3];
  // CAPA 4 · nunca un alérgeno; un denso solo si su porción MÍNIMA cabe en el hueco (antes: umbral de 2800 kcal).
  const gapKcal = (T[idx] - cur[idx]) * (idx === 2 ? 9 : 4);
  const pool = SNACK_BY_MACRO[cls].filter((d) => !avoid(d) && dishKcalRange(d)[0] <= gapKcal * (1 + SNACK_FIT_TOL));
  const dayNames = new Set(meals.map((m) => m.name));
  // Prefiere uno NO usado en la semana ni hoy; si no hay, el menos repetido.
  const dish = pool.find((d) => !weekUsed?.has(d.nombre) && ![...dayNames].some((n) => n.includes(d.nombre)))
    ?? pool.find((d) => ![...dayNames].some((n) => n.includes(d.nombre)));
  if (!dish) return;
  const slotT = [0, 0, 0, 0];
  slotT[idx] = T[idx] - cur[idx];
  const item = solveSlot([dish], 'Snack', slotT)[0];
  if (!item?.macros || item.macros.kcal < 20 || cur[0] + item.macros.kcal > target.kcal * 1.05) return;
  if (mergeIntoSnack(meals, item, isFruitSnack(dish))) weekUsed?.add(dish.nombre);
}

// Busca el mejor conjunto de `n` platillos de `pool` para pegar el target de ESTE
// tiempo, y devuelve sus MealItem (ya ajustados).
// (Este comentario describía un parámetro `needVeg` que exigía guarnición y que NUNCA
//  existió como código: la regla se implementó como filtro de pool. Retirada por la
//  Decisión 06, se limpia la referencia para que no engañe.)
// merge=true → devuelve UNA comida combinada (snacks: los dos dentro del mismo).
function fitSlot(
  pool: BancoDish[], label: string, target: number[], n: number,
  rng: () => number, trials: number,
  used: Set<string>, usedToday: Set<string>, usedTodayIng: Set<string>, craving: string[],
  ingFreq: Map<string, number>, merge = false,
): MealItem[] {
  // El pool ya viene filtrado por alergia Y por tiempo (buildDay / buildDayWithFixed) →
  // aquí no se cuela ningún alérgeno ni un platillo de otro tiempo.
  // P0-03 · un pool vacío significa que no hay nada elegible para este tiempo. Antes
  // `pick` sobre un array vacío devolvía undefined y reventaba con un TypeError opaco;
  // ahora se dice qué pasó. Quien llama ya debería haberlo detectado: esto es la red.
  if (!pool.length) throw new NoEligibleDishesError(label, []);
  const princKeys = (d: BancoDish) => d.ings.filter((i) => i.rol === 'principal').map((i) => ingKey(i.nv));
  // pickN nunca junta en el MISMO slot dos platillos que compartan ingrediente principal
  // (ej. "zanahoria y pepino con hummus" + "bastones de zanahoria" → el snack se repetía).
  const shares = (a: BancoDish, b: BancoDish) => { const ka = new Set(princKeys(a)); return princKeys(b).some((k) => ka.has(k)); };
  const pickN = () => { const out: BancoDish[] = []; let g = 0; while (out.length < n && g++ < 60) { const d = pick(pool, rng); if (out.includes(d) || out.some((o) => shares(o, d))) continue; out.push(d); } return out; };
  const isSnack = label.startsWith('Snack');
  // NUTRITION-N2 · meta calórica del slot (el target llega como [_,P,F,C]; kcal se deriva por Atwater).
  const tgtKcal = 4 * target[1] + 9 * target[2] + 4 * target[3];
  const cands: { dishes: BancoDish[]; e: number; used: number; craves: number; ingScore: number; dayIng: number; fib: number; bucket: number }[] = [];
  for (let t = 0; t < trials; t++) {
    const dishes = pickN();
    const { fixed, vars } = prep(dishes, isSnack);   // CAPA 4 · un snack nunca se estira más allá de una porción normal
    solve(fixed, vars, target, 100);
    const e = isSnack ? errSnack(fixed, vars, target) : errMax(fixed, vars, target);
    // Antojo cuenta solo si el platillo aún no llegó al tope (2) → sale 1-2 veces, no más.
    const craves = craving.length ? dishes.filter((d) => dishMatchesAny(d, craving) && (cravedCount.get(d.nombre) ?? 0) < CRAVED_MAX).length : 0;
    // ingScore = repetición en la SEMANA; dayIng = ingrediente principal ya usado HOY
    // en otro tiempo (evita zanahoria en snack AM y otra vez en PM, pollo en comida y cena).
    let ingScore = 0, dayIng = 0;
    for (const d of dishes) for (const k of princKeys(d)) { ingScore += ingFreq.get(k) ?? 0; if (usedTodayIng.has(k)) dayIng++; }
    let fib = fixed[4]; for (const v of vars) fib += v.a[4] * v.g;
    // NUTRITION-N2 · PRESIÓN DE PORCIÓN (solo snacks): ¿este snack alcanza la meta calórica del slot SIN
    // pasar de una porción PREFERIDA? Si su capacidad preferida queda corta, la única forma de cerrar sería
    // inflar un ingrediente (fruta) hacia el hardMax → snack humanamente incómodo. La señal manda la selección
    // (un compuesto que cabe le gana a un fruit-only que se estiraría). Cubetas para NO borrar la variedad.
    let bucket = 0;
    if (isSnack && tgtKcal > 0) {
      let prefKcal = 0, prefC = 0;
      for (const d of dishes) { const m = dishPreferredMaxMacros(d); prefKcal += m[0]; prefC += m[3]; }
      // Presión = déficit de capacidad preferida en el macro que MANDA: kcal Y carbohidrato (el snack es
      // carb-dominante por el reparto; un fruit-only "alcanza kcal" pero no el carbo sin inflarse). Tomamos
      // el peor de los dos → un compuesto con más capacidad de carbo (yogur+granola, plátano+crema) le gana
      // a fruta+nueces que dejaría la fruta en el hardMax para cerrar el carbo.
      const dKcal = (tgtKcal - prefKcal) / tgtKcal;
      const dCarb = target[3] > 4 ? (target[3] - prefC) / target[3] : 0;
      const pressure = Math.max(0, dKcal, dCarb);
      bucket = pressure <= 0.12 ? 0 : pressure <= 0.30 ? 1 : 2;   // cabe / estirado / severo
    }
    cands.push({ dishes, e, used: dishes.filter((d) => used.has(d.nombre)).length, craves, ingScore, dayIng, fib, bucket });
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
  // CAPA 4 · un snack ya tiene el tamaño de un hueco REAL (antes era un 5–7 % fijo del día): la banda se
  // estrecha para que su PERFIL de macros cuadre con lo que falta (un hueco de carbo/grasa no se llena con
  // un snack de proteína que luego se pasa del día). Sigue siendo más ancha que la de las principales.
  const cap = isSnack
    ? Math.max(25, minE + 12)
    : merge
    ? Math.max(30, minE + 12)
    : (pool.length < 30 ? Math.max(22, minE + 8) : Math.max(12, minE + 2));
  let acceptable = cands.filter((c) => c.e <= cap);
  // CAPA 4 · VARIEDAD sin perder exactitud: si TODO lo que entra en la banda ya se sirvió esta semana, la banda de
  // una principal se abre (≤ 20 %) para que entre otro platillo. Con metas altas y muy cargadas en carbo la banda
  // estrecha la cumplía UN solo platillo y se servía los 7 días; el cuadre del día (`topUpDay`) cierra la meta.
  if (!isSnack && !merge && acceptable.every((c) => c.used > 0)) {
    const wider = cands.filter((c) => c.e <= Math.max(20, minE + 6) && c.used === 0);
    if (wider.length) acceptable = wider;
  }
  // Un solo score de variedad: platillo repetido en la semana (50) > ingrediente repetido
  // hoy (30). El ANTOJO es un BONO (-55) que NO manda absoluto: el platillo antojado sale
  // 1-2 veces y luego la penalización semanal (used) deja que rote — no las 7 cenas iguales.
  const vscore = (c: typeof acceptable[number]) => c.used * 50 + c.dayIng * 30 + c.ingScore - c.craves * 55;
  // NUTRITION-N2 · en SNACKS la PLAUSIBILIDAD DE PORCIÓN manda sobre variedad/antojo: primero por cubeta de
  // presión (cabe humanamente < estirado < severo), y DENTRO de cada cubeta el orden histórico intacto
  // (variedad → fibra → ajuste). Fail-closed: si todo el pool es severo (restricciones), igual sale el mejor
  // acotado (nunca vacío, nunca > hardMax). Las comidas fuertes conservan su orden EXACTO (sin cubeta).
  acceptable.sort((a, b) =>
    (isSnack ? (a.bucket - b.bucket) : 0) ||
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
  const { fixed, vars } = prep(dishes, isSnack);
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

  // El huevo se sirve en piezas ENTERAS, pero el solve lo movió continuo. Al
  // redondearlo después queda un residual que descuadra el día. Se fija el huevo
  // a su pieza entera y se REABSORBE ese residual con los ingredientes continuos
  // (arroz, pollo…), que sí se mueven fino. Así lo mostrado = lo contado y el día
  // cierra exacto.
  let fijado = false;
  for (const v of vars) {
    if (v.ing.pu && v.ing.un && WHOLE_ONLY.has(v.ing.un)) {
      v.g = Math.max(v.ing.pu, Math.round(v.g / v.ing.pu) * v.ing.pu);
      v.lo = v.g; v.hi = v.g;   // congelado: ya no lo mueve el re-solve
      fijado = true;
      continue;
    }
    // MENÚ V1 · Bloque 4 · D4 · el PAN (rebanada entera; pita / bagel / thin / baguette en medias) se sirve en su
    // unidad natural: «½ bagel», no «29 g bagel». Solo si el paso cae dentro de los límites del ingrediente; si no,
    // se queda continuo (y el display cae a gramos redondeados).
    const step = servedPieceStep(v.ing);
    if (step && v.blk === null && /\bpan\b|bagel|pita|baguette/i.test(v.ing.nv)) {
      const cands = [Math.round(v.g / step), Math.floor(v.g / step), Math.ceil(v.g / step)].map((k) => k * step)
        .filter((x) => x > 0 && x >= v.lo - 1e-6 && x <= v.hi + 1e-6);
      if (cands.length) {
        v.g = cands.reduce((a, b) => (Math.abs(b - v.g) < Math.abs(a - v.g) ? b : a));
        v.lo = v.g; v.hi = v.g;
        fijado = true;
      }
    }
  }
  if (fijado) solve(fixed, vars, target, 300);   // lo continuo absorbe el redondeo

  const gPorPlato = mains.map(() => new Map<BancoIng, number>());
  for (const v of vars) {
    const di = mains.findIndex((x) => x.dish.ings.includes(v.ing));
    if (di >= 0) gPorPlato[di].set(v.ing, v.g);
  }
  mains.forEach((x, k) => { meals[x.idx] = mealItemFrom(x.dish, meals[x.idx].time, gPorPlato[k]); });
  return meals;
}

// ═════════════════════════════════════════════════════════════════════════════
// MENÚ HSC V1 · CAPA 4 V1 · 3 PRINCIPALES + 0–2 SNACKS (máximo 5 tiempos)
//
// Ya no hay «siempre 5 comidas» ni un porcentaje fijo por snack. El día se arma con las 3 principales y
// se mide cuánto DAN sin hacerse demasiado grandes: su capacidad con cada ingrediente dentro de su techo
// (`max_g` del banco, PIECE_MAX/GRAM_MAX) y de su PORCIÓN NORMAL (`preferredMaxG`). Lo que no cabe ahí es
// lo único que se lleva a snacks:
//   · si las principales cubren la meta → 0 snacks;
//   · si falta → 1 snack del tamaño de lo que falta; si un solo snack razonable no alcanza → 2;
//   · el batido ocupa su propio slot de snack (cuenta en los 5 tiempos).
// Un snack es UN platillo del banco servido a porción normal, y solo entra si de verdad tiene ese tamaño:
// la fruta sola solo cabe en snacks chicos (su porción normal es chica) y los densos (bolitas, barritas)
// entran por necesidad real, cuando su porción mínima cabe en el hueco — ya no por un umbral de 2800 kcal.
// Nada de esto afloja un techo: las kcal altas se resuelven con más tiempos, nunca rompiendo `max_g`.
// ═════════════════════════════════════════════════════════════════════════════
// ── MENÚ V1 · BLOQUE 3B · INSUFFICIENT_MENU_CAPACITY (diagnóstico interno, no cambia el plan) ──────────────
/** Umbral PROVISIONAL de energía (±5 % de kcal). Estar dentro NO hace válido al plan: macros, proteína,
 *  composición, porciones, calidad y variedad se revisan aparte. */
export const MENU_CAPACITY_KCAL_TOL = 0.05;
/** Tolerancia blanda superior de proteína (D2: meta +10 %). Por encima, es un problema de capacidad del banco. */
export const PROTEIN_SOFT_OVER = 0.10;
/** MENÚ V1 · Bloque 5 · RECIPE_CAPACITY_LIMIT: el día quedó fuera de ±5 % y una receta CERRADA servida ya está en su
 *  porción válida extrema en esa dirección (no puede crecer / encoger sin deformarse). Diagnóstico: no cambia el plan. */
export function recipeLimits(day: DayPlan, T: number[]): RecipeCapacityLimit[] {
  const kcal = day.meals.reduce((a, m) => a + (m.macros?.kcal ?? 0), 0);
  const gap = Math.round(T[0] - kcal);
  if (Math.abs(gap) <= MENU_CAPACITY_KCAL_TOL * T[0]) return [];
  const out: RecipeCapacityLimit[] = [];
  for (const m of day.meals) for (const part of m.name.split(' + ')) {
    const d = BANCO.find((x) => x.nombre === part);
    if (!d?.cr || !d.steps) continue;
    const f = servedFactor(d, (i) => { const g = m.ings?.find((x) => x.nv === i.nv)?.g; return typeof g === 'number' ? g : undefined; });
    if (f == null) continue;
    const { vars } = prep([d], d.tiempo === 'Snack');
    const st = validSteps(d.steps, blockSMax(vars));
    const edge = gap > 0 ? Math.max(...st) : Math.min(...st);
    if (Math.abs(f - edge) > 0.02) continue;     // aún tenía margen: el hueco no es de esta receta
    const edgeKcal = Math.round(closedRecipeMacros(d, gap > 0 ? 'max' : 'min')[0]);
    const served = Math.round(d.fixed[0] + vars.reduce((a, v) => a + v.a[0] * v.g0 * f, 0));
    out.push({ status: 'RECIPE_CAPACITY_LIMIT', recipe: d.nombre, slot: m.time, target: served + gap, served,
      maxValid: servingLabel(d, edge) ?? (st.length === 1 ? 'porción única de la receta' : `${edge}× receta`), maxValidKcal: edgeKcal, gap });
  }
  return out;
}

function capacityIssue(day: DayPlan, T: number[], avoidIn: AvoidInput | undefined, avoid: (d: BancoDish) => boolean, poolSize: Record<string, number>): MenuCapacityIssue | undefined {
  const r = [0, 0, 0, 0];
  for (const m of day.meals) { r[1] += m.macros?.prot ?? 0; r[2] += m.macros?.fat ?? 0; r[3] += m.macros?.carb ?? 0; }
  r[0] = 4 * r[1] + 9 * r[2] + 4 * r[3];
  const kErr = Math.abs(r[0] - T[0]) / Math.max(T[0], 1);
  const reasons: Array<'ENERGY' | 'PROTEIN_OVER'> = [];
  if (kErr > MENU_CAPACITY_KCAL_TOL) reasons.push('ENERGY');
  if (r[1] > T[1] * (1 + PROTEIN_SOFT_OVER)) reasons.push('PROTEIN_OVER');
  if (!reasons.length) return undefined;
  // Para ampliar el banco: principales del día sin acompañamiento flexible de carbo ni complemento compatible.
  const missing: string[] = [];
  for (const m of day.meals) {
    if (m.time.startsWith('Snack')) continue;
    const d = BANCO.find((x) => x.nombre === m.name);
    if (!d || d.tipo === 'bloque' || dishStructure(d).hasCarbSide) continue;
    if (!compatibleComplements(d, m.time).some((c) => !avoid(complementDish(c, m.time)))) missing.push(`${m.time} · ${m.name}: sin acompañamiento flexible ni complemento compatible`);
  }
  const p = toAvoidPolicy(avoidIn ?? []);
  return {
    status: 'INSUFFICIENT_MENU_CAPACITY', target: T.slice(0, 4).map(Math.round), reached: r.map(Math.round),
    gap: T.slice(0, 4).map((t, i) => Math.round(t - r[i])), maxError: Math.round(kErr * 1000) / 1000, reasons,
    restrictions: { strict: [...p.strict], soft: [...p.soft] }, missingComplements: missing, poolSize,
  };
}
const SNACK_SLOTS: readonly Slot[] = ['Snack AM', 'Snack PM'];
/** Candidatos de snack que la IA propone por día (1 mañana + 1 tarde). El ensamblado usa 0–2, por tamaño.
 *  Con 2 el texto del prompt existente sigue siendo cierto (sin la frase de «2 combinados por momento»). */
export const SNACK_CANDIDATES_PER_DAY = 2;
const SLOT_ORDER: readonly string[] = ['Desayuno', 'Snack AM', 'Comida', 'Snack PM', 'Cena'];
const BY_NAME = new Map(BANCO.map((d) => [d.nombre, d]));
/** Tiempos en orden del día (el batido se agrega al final por `applyShake`). Puro. */
function chronological(meals: MealItem[]): MealItem[] {
  return [...meals].sort((a, b) => SLOT_ORDER.indexOf(a.time) - SLOT_ORDER.indexOf(b.time));
}
/** Hueco (fracción de la meta del día) por debajo del cual no se agrega un snack: lo cierra el cuadre del día. */
const SNACK_NEED_MIN = 0.03;
/** Holgura de tamaño: un snack es candidato si su rango [mínimo, porción normal] contiene su meta ±15 %. */
const SNACK_FIT_TOL = 0.15;
/** Un snack es MÁS CHICO que una comida: como mucho ¾ de la principal más chica (su tamaño a porción normal). Deja sitio
 *  a los snacks densos del banco (Magaly los marca para 400–800 kcal) sin que un snack supere a una comida.
 *  Si el hueco no cabe en un snack así, se reparte en dos (máximo 5 tiempos). */
const SNACK_MAX_VS_MAIN = 0.75;
const FRUIT_FAMILIES = new Set(['berries', 'grapes', 'cutFruit', 'wholeFruit']);
const isFruitIng = (nv: string): boolean => FRUIT_FAMILIES.has(portionBoundsFor(nv)?.family ?? '') || /\bfruta\b/i.test(nv);

/** kcal [mínima, a porción normal] de un platillo (bloque: factor 0.5–1.5 sobre la receta). Puro, memoizado. */
const _rangeMemo = new Map<BancoDish, [number, number]>();
function dishKcalRange(d: BancoDish): [number, number] {
  const c = _rangeMemo.get(d);
  if (c) return c;
  const r = dishKcalRangeRaw(d);
  _rangeMemo.set(d, r);
  return r;
}
/** Cuantil del pool que define el tamaño USUAL de una principal (percentil 75: lo que una principal grande pero
 *  normal de ese tiempo da a porción normal). Medido: la mediana dejaba las principales cortas y el día lejos. */
const USUAL_MAIN_QUANTILE = 0.75;
/** kcal que da USUALMENTE una principal de este pool a porción normal (`USUAL_MAIN_QUANTILE`). Es el tope de su meta:
 *  una principal no se pide más grande de lo que el banco de Magaly da normalmente; lo demás va a snacks. */
function usualMainKcal(pool: BancoDish[]): number {
  const xs = pool.map((d) => dishKcalRange(d)[1]).sort((a, b) => a - b);
  return xs.length ? xs[Math.min(xs.length - 1, Math.floor(USUAL_MAIN_QUANTILE * xs.length))] : Infinity;
}
/** Meta [_,P,F,C] de una principal acotada a `kcalCap` (escala proporcional; nunca la agranda). */
function capTarget(t: number[], kcalCap: number): number[] {
  const k = 4 * t[1] + 9 * t[2] + 4 * t[3];
  if (k <= kcalCap || k <= 0) return t;
  const f = kcalCap / k;
  return [t[0], t[1] * f, t[2] * f, t[3] * f];
}
function dishKcalRangeRaw(d: BancoDish): [number, number] {
  if (d.tipo === 'bloque') {
    // Mismo factor que `solve`: 0.5–1.5, acotado por el ingrediente más ajustado del bloque (a porción normal).
    const { vars: bv } = prep([d], true);
    let base = 0;
    for (const v of bv) base += v.a[0] * v.g0;
    const sMax = blockSMax(bv);
    if (d.steps) { const st = validSteps(d.steps, sMax); return [d.fixed[0] + Math.min(...st) * base, d.fixed[0] + Math.max(...st) * base]; }
    return [d.fixed[0] + 0.5 * base, d.fixed[0] + sMax * base];
  }
  const { fixed, vars } = prep([d], true);
  let hi = fixed[0];
  for (const v of vars) hi += v.a[0] * v.hi;
  return [dishMinMacros(d)[0], hi];
}
/** ¿Es un snack de FRUTA (≥ 80 % de sus kcal base vienen de fruta)? Puro. */
export function isFruitSnack(d: BancoDish): boolean {
  let fruit = 0, total = d.fixed[0];
  for (const ing of d.ings) {
    if (ing.rol !== 'principal' || !ing.a) continue;
    const k = ing.a[0] * ing.g0;
    total += k;
    if (isFruitIng(ing.nv)) fruit += k;
  }
  return total > 0 && fruit / total >= 0.8;
}
/** ¿Este snack puede servirse con ~`kcal` sin estirarse más allá de una porción normal ni encogerse bajo su mínimo? */
export function snackFitsSize(d: BancoDish, kcal: number): boolean {
  const [lo, hi] = dishKcalRange(d);
  return lo <= kcal * (1 + SNACK_FIT_TOL) && hi >= kcal * (1 - SNACK_FIT_TOL);
}

/**
 * CAPA 4 · cuántos snacks hacen falta y de qué tamaño, dadas las 3 principales YA elegidas. Las principales
 * se resuelven contra la meta con su porción NORMAL; el hueco que queda es el único que va a snacks.
 * Devuelve las metas [_,P,F,C] por snack (0, 1 o 2), en los slots libres (el batido ocupa el suyo). Puro.
 */
export function snackPlan(mains: BancoDish[], T: number[], freeSlots: readonly Slot[], fits: (kcal: number) => boolean): Array<{ slot: Slot; target: number[] }> {
  if (!freeSlots.length) return [];
  const { fixed, vars } = prep(mains, true);
  solve(fixed, vars, T, 300);
  const got = [fixed[0], fixed[1], fixed[2], fixed[3]];
  for (const v of vars) for (let k = 1; k < 4; k++) got[k] += v.a[k] * v.g;
  // Tamaño REAL de cada principal a porción normal (fijos + sus principales resueltos): base del tope de un snack.
  const mainKcal = mains.map((d) => d.fixed[0] + vars.filter((v) => d.ings.includes(v.ing)).reduce((a, v) => a + v.a[0] * v.g, 0));
  const gap = [0, Math.max(0, T[1] - got[1]), Math.max(0, T[2] - got[2]), Math.max(0, T[3] - got[3])];
  const gapKcal = 4 * gap[1] + 9 * gap[2] + 4 * gap[3];
  if (gapKcal <= SNACK_NEED_MIN * T[0]) return [];
  // Un snack si el hueco cabe en UNO razonable (existe uno de ese tamaño y sigue siendo más chico que una
  // comida); si no, se reparte en dos — si hay un 2º slot libre (el batido puede ocupar uno).
  const smallestMain = Math.min(...mainKcal);
  const oneIsEnough = fits(gapKcal) && gapKcal <= SNACK_MAX_VS_MAIN * smallestMain;
  const n = freeSlots.length >= 2 && !oneIsEnough ? 2 : 1;
  // Con un solo slot libre y 1 snack: va en la tarde (entre comida y cena) salvo que la tarde la ocupe el batido.
  const slots: Slot[] = n === 2 ? [...freeSlots] : [freeSlots.includes('Snack PM') ? 'Snack PM' : freeSlots[0]];
  // Cada snack, como mucho, ¾ de la principal más chica: lo que no quepa lo cierran las principales en
  // el cuadre del día (`topUpDay`), siempre dentro de sus techos. Un snack nunca es más grande que una comida.
  const each = capTarget(gap.map((x) => x / n), SNACK_MAX_VS_MAIN * smallestMain);
  return slots.map((slot) => ({ slot, target: each }));
}

function buildDay(dayNum: number, T: number[], rng: () => number, avoid: (d: BancoDish) => boolean, cuisines: string[], used: Set<string>, craving: string[], ingFreq: Map<string, number>, relax = 0, avoidCats: string[] = [], shakeSlots: readonly Slot[] = []): DayPlan {
  // CAPA 4 V1 · las 3 principales se reparten TODA la meta de comida (T ya descuenta el batido); los
  // snacks se deciden DESPUÉS, por lo que las principales no alcanzan a porción normal (`snackPlan`).
  const MTm = slotTargets(T, [...SNACK_SLOTS]);
  // Filtra por alergia de RAÍZ (nunca sirve un platillo con el alérgeno).
  //
  // P0-03 · ANTES, si un tiempo se quedaba sin opciones, esto caía a «cualquier platillo
  // compatible del banco», es decir CRUZABA DE TIEMPO: medido, servía Edamames de
  // desayuno, Garbanzos Horneados de comida y Puñado de Cacahuates de cena, los 7 días.
  // Contradecía la regla de Magaly que la v29 ya había restaurado en la degradación: el
  // cross-time seguía vivo por esta puerta de atrás. Ahora el tiempo es invariante — si
  // un tiempo no tiene candidatos, el día es IMPOSIBLE y se dice (no se rellena).
  const clean = (pool: BancoDish[], slot: string) => {
    const f = pool.filter((d) => !avoid(d));
    if (!f.length) throw new NoEligibleDishesError(slot, avoidCats);
    return f;
  };
  // REGLA DURA de Magaly: cada tiempo usa SOLO sus platillos. El desayuno es
  // desayuno; una cena JAMÁS aparece en el desayuno, por ningún motivo. La
  // degradación para alcanzar la meta NUNCA mueve un platillo de su tiempo.
  //
  // El único ajuste (relax≥2, cuando lo estricto no alcanzó la meta densa en
  // carbo) es un SESGO dentro del pool DE CADA TIEMPO: prioriza los platillos con
  // más capacidad de carbo, porque el día carb-corto elegía los de carne y dejaba
  // fuera los bowls de arroz/quinoa que sí llegan. No saca nada de su tiempo.
  const sesgaCarbo = (pool: BancoDish[]): BancoDish[] => {
    if (relax < 2) return pool;
    const carbCap = (d: BancoDish) => d.fixed[3] + d.ings.reduce((a, ing) => a + (ing.rol === 'principal' && ing.a ? ing.a[3] * ingBounds(ing).hi : 0), 0);
    const densos = [...pool].sort((a, b) => carbCap(b) - carbCap(a)).slice(0, 8);
    return [...densos, ...pool];
  };
  const des = sesgaCarbo(clean(biasPool(BY_TIME.Desayuno, cuisines), 'Desayuno'));
  const com = sesgaCarbo(clean(biasPool(BY_TIME.Comida, cuisines), 'Comida'));
  const cen = sesgaCarbo(clean(biasPool(BY_TIME.Cena, cuisines), 'Cena'));
  // CAPA 4 · ya no hay umbral de 2800 kcal: los densos están en el pool y entran solo si su tamaño cabe en
  // el hueco real (`snackFitsSize`). Un pool vacío sigue siendo una imposibilidad (NoEligibleDishesError).
  const snack = clean(BY_TIME.Snack, 'Snack');
  // Regla dura: NADA se repite dentro del mismo día (ni comida ni snack, ni una comida
  // como cena). avail() saca del pool lo ya usado hoy; fitSlot va llenando usedToday.
  // relax≥1: la selección ignora el historial de la semana → puede repetir un
  // platillo en otro día (SIN sacarlo de su tiempo). Es el recurso cuando el banco
  // compatible es chico: pocos platillos de un tiempo para 7 días. Repetir un plato
  // es preferible a fallar la meta. usedToday NO se relaja: nunca el mismo platillo
  // dos veces el MISMO día.
  const usedSel = relax >= 1 ? new Set<string>() : used;
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
  // Cada principal se pide, como mucho, del tamaño que su tiempo da usualmente (percentil 75 del pool a porción
  // normal): a metas muy altas las principales no se vuelven monstruosas; el resto lo toman los snacks.
  const mains: MealItem[] = [
    ...fitSlot(avail(des), 'Desayuno', capTarget(MTm['Desayuno'], usualMainKcal(des)), 1, rng, 90, usedSel, usedToday, usedTodayIng, craving, ingFreq),
    ...fitSlot(avail(com), 'Comida', capTarget(MTm['Comida'], usualMainKcal(com)), 1, rng, 90, usedSel, usedToday, usedTodayIng, craving, ingFreq),
    ...fitSlot(avail(cen), 'Cena', capTarget(MTm['Cena'], usualMainKcal(cen)), 1, rng, 90, usedSel, usedToday, usedTodayIng, craving, ingFreq),
  ];
  // CAPA 4 · snacks: solo lo que las principales no dan a porción normal; UN platillo por snack, del tamaño
  // de su hueco (un snack que tendría que estirarse o encogerse fuera de su rango no es candidato).
  const mainDishes = mains.map((m) => BY_NAME.get(m.name)!).filter(Boolean);
  const freeSlots = SNACK_SLOTS.filter((sl) => !shakeSlots.includes(sl));
  const sizedPool = (kcal: number) => snack.filter((d) => snackFitsSize(d, kcal));
  const snacks: MealItem[] = snackPlan(mainDishes, T, freeSlots, (kcal) => sizedPool(kcal).length > 0).flatMap(({ slot, target }) => {
    const sized = sizedPool(4 * target[1] + 9 * target[2] + 4 * target[3]);
    return fitSlot(availSnack(sized.length ? sized : snack), slot, target, 1, rng, 70, usedSel, usedToday, usedTodayIng, craving, ingFreq);
  });
  const meals = chronological([...mains, ...snacks]);
  // NO se cuadra aquí: el cuadre del día (topUpDay) corre DESPUÉS del batido, en
  // buildWeeklyPlan, contra la meta COMPLETA menos lo que de verdad aportan los
  // snacks (batido incluido). Cuadrar aquí, antes del batido, dejaba las comidas
  // resueltas contra los snacks normales y luego el batido los reemplazaba y
  // descuadraba el día (proteína de más, carbos de menos).
  return { day: dayNum, theme: '', meals };
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
// v28: DEGRADACIÓN GRADUAL para todo perfil. Las macros son la restricción DURA;
// variedad y 'cada platillo en su tiempo' son BLANDAS. Si con las reglas estrictas
// no se alcanza la meta (típico con exclusiones pesadas que dejan pocos platillos
// altos en carbo), el reintento afloja por niveles: cross-time (una comida sirve
// de cena), luego repetir en la semana, luego sesgar a platillos densos en carbo.
// Exactitud de macros <1%: 87% → 98% de los días; orden 100%. Reglas de porción
// de la v22 intactas.
// v29: se QUITÓ el cross-time (v28 metía cenas en desayunos para clavar el rincón
// de exclusiones pesadas — Magaly lo prohíbe: cada tiempo con sus platillos). La
// degradación ahora solo repite platillos DENTRO de su tiempo, y solo cuando lo
// estricto quedó >2% (el rincón). Casos comunes: <1% con variedad completa y
// desayunos puros. Reglas de porción de la v22 intactas.
// v30: el cuadre del día (topUpDay) corría ANTES de aplicar el batido, así que la
// proteína del batido caía ENCIMA de un día que ya llegaba a la meta (+25 g). Se
// movió DESPUÉS del batido, contra la meta completa menos lo que aportan los
// snacks (batido incluido). Con 1 batido: kcal y macros a ±0.5-0.7%.
// v31: P0-01, P0-02 y P0-03 cambiaron las GARANTÍAS del motor sin subir la versión, que es
// exactamente lo que el comentario de la v24 advierte que no hay que hacer. Un plan
// generado el día antes de P0-03 lleva engineVersion 30, así que `30 >= 30` y la
// auto-regeneración no disparaba nunca: un plan con cruces de tiempo o con un platillo
// incompatible se quedaba vigente para siempre. Subir a 31 los regenera en la siguiente
// carga, ya a través del detector corregido (P0-01), con las restricciones efectivas
// (P0-02) y con el motor que falla cerrado (P0-03). No hay cambio de reglas en este salto.
// Requisito previo: la ruta de auto-regeneración no pasaba `region` — se corrigió en el
// mismo bloque, porque no se activa a conciencia una regeneración que sabemos incompleta.
//
// CAPA 1E · FASE C4 · 31 → 32 · ENERGY AUTHORITY CUTOVER.
// La energía de un plan ya no la estima `legacyEnergy` desde `obData.activity`: la
// prescribe el HSC Energy Engine (DRI 2023 EER + clasificación de actividad +
// prescripción) y llega al generador por `store.planGoal`. Para una parte de los
// socios la cifra CAMBIA, así que todo plan guardado con v31 se armó contra una
// meta que el producto ya no prescribe. El salto de versión es lo que los regenera
// en la siguiente carga, a través de `weeklyPlanCurrentness`.
// Se sube AL FINAL, cuando ya no queda ningún consumidor leyendo la cifra legacy:
// subirla antes habría regenerado planes con la autoridad que estábamos retirando.
// v33 · CAPA 2 · las MACROS diarias pasan a la autoridad nueva (`macroPrescription`:
// proteína por PRW × factor, grasa 25 %, carbohidrato residual). Todo plan v32 se
// armó con gramos de `legacyMacros`; el salto lo marca STALE aunque coincida la kcal.
// v34 · MENÚ V1 · B1 · correcciones sin decisión nueva que CAMBIAN el plan servido: `max_g` del banco
// como TECHO, taza de arroz del catálogo (188 g), rebanadas solo para jamón real (21.33 g pavo), singular
// de piezas y umbrales de snacks contra la meta diaria en ambos caminos. Todo plan v33 queda STALE y se
// regenera una vez (CAPA 1/2/Adaptive no cambian: esta versión solo versiona el motor de platillos).
// v35 · MENÚ V1 · CAPA 4 V1 · 3 principales + 0–2 snacks por NECESIDAD (sin «siempre 5», sin 2 platillos por snack,
// sin umbral de 2800 kcal), snacks a porción normal y del tamaño de su hueco, el bloque respeta los techos de sus
// ingredientes, y medidas D1 (pasta 120 g/taza, aceite en cditas de 5 g, miel cdita 7 g / cda 21 g). Todo plan v34
// queda STALE y se regenera una vez.
// v36 · MENÚ V1 · BLOQUE 3B (integración segura) · HALLAZGO-04: los 6 dulces de Cena dejan de ser elegibles como
// cena principal (cambia el pool de Cena → todo plan v35 se regenera una vez). Además, diagnóstico interno
// INSUFFICIENT_MENU_CAPACITY en `day.capacity` (no cambia el plan). El modelo híbrido de receta quedó en WIP.
// v37 · MENÚ V1 · BLOQUE 4 · porciones visibles con medidas reales (autoridad cerrada > catálogo > SMAE; conflictos
// → gramos), gramos visibles en múltiplos de 5, piezas naturales (pan/pita/bagel cuadrados a rebanada/media pieza en
// el cierre del día), «Fruta» genérica → la fruta real de sus macros, avena cruda ya no se muestra como cocida.
// v38 · MENÚ V1 · BLOQUE 5 · recetas CERRADAS: Pasta con Verduras Asadas, Feta y Garbanzo y Rollitos según su ficha
// (porción única, no se deforman), bolitas 2/4/6 y barrita 1/2/3 (solo porciones válidas; toda la masa escala junta),
// diagnóstico RECIPE_CAPACITY_LIMIT en `day.recipeLimits` (no cambia el plan).
export const PLAN_ENGINE_VERSION = 38;

export interface BuildOpts { seed?: number; avoid?: AvoidInput; cuisines?: string[]; craving?: string; shake?: ProteinShake; region?: Region }

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
  return (d: BancoDish) => dishMatchesAvoidTerms(d, terms);
}

/**
 * WEEKLY PREFERENCES · D-WP2 · filtro de PREFERENCIA SEMANAL (suave). `true` = el platillo tiene la
 * categoría como INGREDIENTE PROPIO / VISIBLE (directo, por alias o por una regla oculta IS como
 * "Crema"), así que esta semana se prefiere evitar. NO cuenta lo que solo vive dentro de una
 * sub-receta ni los compuestos que la CONTIENEN (mayonesa → huevo, aderezo con yogurt → lácteos).
 *
 * Mismo diccionario (AVOID_MAP), mismos alias, mismas excepciones (TERM_EXCEPT) y mismo matcher que
 * `makeAvoidFilter`; solo cambian las unidades. Nunca excluye algo que `makeAvoidFilter` permita.
 * Todavía NO lo consume ningún camino productivo (MB1: solo la autoridad técnica).
 */
export function makePreferenceFilter(softCats: string[]): (d: BancoDish) => boolean {
  const terms = expandAvoid(softCats.map((s) => s.toLowerCase().trim()).filter(Boolean));
  return (d: BancoDish) => unitsMatchAvoidTerms(dishText(d).soft, terms);
}

/**
 * WEEKLY PREFERENCES SPLIT · política de restricciones con el ORIGEN separado.
 *   · `strict` · restricciones PERMANENTES → detector estricto (sub-recetas, ocultos IS y CONTAINS).
 *   · `soft`   · preferencias de ESTA semana que no son ya permanentes → detector suave (MB1).
 * La construye la autoridad (`avoidPolicy`/`avoidPolicyForPlan`); el motor y el validador la consumen.
 */
export interface AvoidPolicy { strict: string[]; soft: string[] }
/** Entrada de restricciones del motor y del validador. Una lista suelta = TODO estricto (contrato
 *  anterior: misma salida, byte a byte). */
export type AvoidInput = string[] | AvoidPolicy;
/** Normaliza la entrada a política. STRICT gana: lo que esté en ambos lados solo queda en `strict`. */
export function toAvoidPolicy(a: AvoidInput | null | undefined): AvoidPolicy {
  if (!a) return { strict: [], soft: [] };
  if (Array.isArray(a)) return { strict: a.filter(Boolean), soft: [] };
  const strict = a.strict.filter(Boolean);
  return { strict, soft: a.soft.filter((c) => c && !strict.includes(c)) };
}
/** Unión de la entrada (strict y luego soft): para lo que todavía no distingue el origen (batido,
 *  bowl hasta MB4) y para el mensaje de `NoEligibleDishesError`. */
export function avoidInputUnion(a: AvoidInput | null | undefined): string[] {
  const p = toAvoidPolicy(a);
  return [...p.strict, ...p.soft];
}
/**
 * MB3 · EL filtro del generador: `true` = el platillo NO es elegible. Excluye si viola lo permanente
 * (`makeAvoidFilter(strict)`) O si sirve visible una preferencia de la semana (`makePreferenceFilter(soft)`).
 * Es la misma pareja de detectores que usa `validatePlan`, así que lo que el generador acepta el
 * validador no lo rechaza por restricción ni por preferencia.
 */
export function makePolicyFilter(a: AvoidInput | null | undefined): (d: BancoDish) => boolean {
  const p = toAvoidPolicy(a);
  const st = makeAvoidFilter(p.strict);
  if (!p.soft.length) return st;
  const so = makePreferenceFilter(p.soft);
  return (d: BancoDish) => st(d) || so(d);
}

/** Banco agrupado por tiempo, ya SIN alérgenos.
 *
 *  P0-03: un pool puede quedar VACÍO y eso es el resultado correcto. Antes caía al
 *  pool COMPLETO sin filtrar «para no quedarse sin opciones», con lo que un usuario
 *  sin opciones compatibles recibía exactamente los platillos que había excluido (70
 *  desayunos, todos incompatibles, medido). El vacío lo resuelve quien consume el
 *  banco: el motor determinista lanza NoEligibleDishesError y la ruta IA no puede
 *  completar los 7 días, así que cae al determinista. Nunca se rellena con alérgenos. */
export function safeBankByTiempo(avoidCats: AvoidInput): Record<'Desayuno' | 'Comida' | 'Cena' | 'Snack', BancoDish[]> {
  const avoid = makePolicyFilter(avoidCats);   // MB3 · strict + soft: el pool de la IA ya llega filtrado en código
  const pick = (t: string) => (BY_TIME[t] ?? []).filter((d) => !avoid(d));
  return { Desayuno: pick('Desayuno'), Comida: pick('Comida'), Cena: pick('Cena'), Snack: pick('Snack') };
}

/** Ajusta las porciones de UNOS platillos dados a `target` y devuelve sus MealItem. */
export function solveSlot(dishes: BancoDish[], label: string, target: number[], merge = false): MealItem[] {
  if (!dishes.length) return [];
  const { fixed, vars } = prep(dishes, label.startsWith('Snack'));   // CAPA 4 · snacks a porción normal
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
  avoidCats: AvoidInput, target: PlanTarget, cravingText = '', region?: Region,
): Record<'Desayuno' | 'Comida' | 'Cena' | 'Snack', BancoDish[]> {
  const safeRaw = safeBankByTiempo(avoidCats);
  // Visibilidad por región (SIEMPRE se aplica): combina el filtro DURO de disponibilidad
  // (fuera de LATAM se descartan mole, nopal, tinga…; la VARIEDAD se conserva) con la
  // segmentación por marca (los platillos "region:ES" solo se ven en EUROPE, y NUNCA se
  // filtran para el resto). Un platillo sin marca sigue siendo global.
  const av = (p: BancoDish[]) => p.filter((d) => dishAllowedInRegion(d, region));
  const safe = {
    Desayuno: av(safeRaw.Desayuno), Comida: av(safeRaw.Comida),
    Cena: av(safeRaw.Cena), Snack: av(safeRaw.Snack),
  };
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
    Snack: safe.Snack,   // CAPA 4 · los densos entran por tamaño en el ensamblado (sin umbral de 2800 kcal)
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
export function assembleFromSelection(target: PlanTarget, days: DaySelection[], avoidCats: AvoidInput = [], shake?: ProteinShake): DayPlan[] {
  // RESTRICCIONES · el batido pasa por la MISMA autoridad que en el motor determinista: si no es
  // compatible (whey con lácteos), el plan va SIN batido. Antes esta ruta lo aplicaba sin comprobar.
  // D-WP5 · whey / mass gainer fuera con lácteos permanente O semanal (`shakeAllowedFor` decide sobre la política).
  if (!shakeAllowedFor(shake, avoidCats)) shake = undefined;
  const T = [target.kcal, target.protG, target.fatG, target.carbG];
  // CAPA 4 V1 · misma lógica que el motor de código: las 3 principales contra la meta de comida (sin el
  // batido), los snacks solo por el hueco real (`snackPlan`), y el cuadre del día (`topUpDay`).
  const foodT = reduceForShake(T, shake);
  const MTm = slotTargets(foodT, [...SNACK_SLOTS]);
  const freeSlots = SNACK_SLOTS.filter((sl) => !shakeSlotsOf(shake).includes(sl));
  const byName = new Map(BANCO.map((d) => [d.nombre, d]));
  const aiAvoid = makePolicyFilter(avoidCats);
  const aiPoolSize = Object.fromEntries(['Desayuno', 'Comida', 'Cena', 'Snack'].map((t) => [t, (BY_TIME[t] ?? []).filter((d) => !aiAvoid(d)).length]));
  const corrUsed = new Set<string>(); // corrector no repite el mismo snack en la semana
  const out: DayPlan[] = [];
  days.forEach((sel, i) => {
    // P0-03 · DOBLE LLAVE sobre la selección de la IA. El orquestador ya solo acepta
    // nombres de `adequateBankByTiempo` (filtrado por tiempo y por restricciones), pero
    // este helper resuelve los nombres contra el BANCO COMPLETO: si alguna vez llegara
    // aquí una selección de otra procedencia, el nombre bastaría para servir un platillo
    // de otro tiempo o un alérgeno. Se verifican las dos invariantes aquí también; un día
    // que no las cumpla se DESCARTA (el plan sale con <7 días → el orquestador devuelve
    // null → motor determinista), nunca se sirve corregido a medias.
    const noEvitado = makePolicyFilter(avoidCats);   // MB3 · re-verifica cada pick de la IA con strict + soft
    const main = (nombre: string, t: string): BancoDish | undefined => {
      const d = byName.get(nombre);
      return d && d.tiempo === t && !noEvitado(d) ? d : undefined;
    };
    const des = main(sel.desayuno, 'Desayuno'), com = main(sel.comida, 'Comida'), cen = main(sel.cena, 'Cena');
    if (!des || !com || !cen || !mainEligible(cen)) return;   // HALLAZGO-04 · misma elegibilidad que el motor
    const snacks = (sel.snacks ?? []).map((n) => byName.get(n))
      .filter((d): d is BancoDish => !!d && d.tiempo === 'Snack' && !noEvitado(d));
    const mains: MealItem[] = [
      ...solveSlot([des], 'Desayuno', MTm['Desayuno']),
      ...solveSlot([com], 'Comida', MTm['Comida']),
      ...solveSlot([cen], 'Cena', MTm['Cena']),
    ];
    // Snacks: los candidatos que eligió la IA, en su orden; cada slot usa el primero que tenga el TAMAÑO de su
    // hueco (si ninguno lo tiene, el que más se acerca). UN platillo por snack, sin repetir en el día.
    const kcalOf = (t: number[]) => 4 * t[1] + 9 * t[2] + 4 * t[3];
    const usedSnack = new Set<string>();
    const snackItems: MealItem[] = snackPlan([des, com, cen], foodT, freeSlots, (k) => snacks.some((d) => snackFitsSize(d, k)))
      .flatMap(({ slot, target: t }) => {
        const free = snacks.filter((d) => !usedSnack.has(d.nombre));
        if (!free.length) return [];
        const k = kcalOf(t);
        const dist = (d: BancoDish) => { const [lo, hi] = dishKcalRange(d); return k < lo ? lo - k : k > hi ? k - hi : 0; };
        const d = free.find((x) => snackFitsSize(x, k)) ?? [...free].sort((a, b) => dist(a) - dist(b))[0];
        usedSnack.add(d.nombre);
        return solveSlot([d], slot, t);
      });
    const meals = chronological([...mains, ...snackItems]);
    if (shake) applyShake(meals, shake); // el batido ocupa SU slot de snack
    topUpDay(meals, T);                              // CAPA 4 · el mismo cuadre del día que el motor de código
    topUpMeals(meals, target, avoidCats, corrUsed); // cierra hueco grande (1 snack, rota en semana)
    const day: DayPlan = { day: i + 1, theme: '', meals: chronological(meals) };
    const cap = capacityIssue(day, T, avoidCats, aiAvoid, aiPoolSize);   // mismo registro que el motor de código
    if (cap) day.capacity = cap;
    const rl = recipeLimits(day, T);   // Bloque 5 · receta cerrada en su límite: registrar, nunca deformar
    if (rl.length) day.recipeLimits = rl;
    out.push(day);
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
  const avoid = makePolicyFilter(opts.avoid);   // MB3 · strict + soft
  const rng = mulberry32(opts.seed ?? 12345);
  const used = new Set<string>(), usedToday = new Set<string>(), usedIng = new Set<string>();
  const craving = cravingTerms(opts.craving ?? '');
  const ingFreq = new Map<string, number>();

  // P0-03 · igual que en buildDay: antes, un tiempo sin opciones caía a «cualquier platillo
  // compatible» y cruzaba de tiempo (medido: servía Merluza al Horno con Patatas, una
  // Comida, como desayuno). El tiempo no se negocia; si no hay candidatos, el día no se
  // puede armar y se dice.
  const clean = (pool: BancoDish[], slot: string) => {
    const f = pool.filter((d) => !avoid(d));
    if (!f.length) throw new NoEligibleDishesError(slot, avoidInputUnion(opts.avoid));
    return f;
  };
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
  // El pool llega PEREZOSO: el tiempo que ocupa el alimento fijo no necesita candidatos,
  // así que no puede declararse imposible por un pool que nunca se iba a usar.
  const add = (slot: Slot, poolOf: () => BancoDish[], n: number, tol: number) => {
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
    // `cabe` y `libre` relajan encaje y repetición, pero SIEMPRE dentro del pool ya limpio
    // de este tiempo: ninguno de los dos puede reintroducir un alérgeno ni otro tiempo.
    const limpio = clean(poolOf(), slot);
    const pool2 = libre(cabe(limpio, t));
    meals.push(...fitSlot(pool2.length ? pool2 : cabe(limpio, t), slot, t, n, rng, tol, used, usedToday, usedIng, craving, ingFreq, esSnack));
  };
  // El pool de snacks se limpia ANTES de gateDense para que, si todo lo compatible es
  // denso, el vacío lo detecte `clean` (imposibilidad) y no gateDense (que daría []).
  const snackPool = (): BancoDish[] => {
    const limpio = clean(BY_TIME.Snack, 'Snack');
    const gated = gateDense(limpio, target.kcal);
    return gated.length ? gated : limpio;
  };
  add('Desayuno', () => BY_TIME.Desayuno, 1, 90);
  add('Snack AM', snackPool, nSnack, 70);
  add('Comida', () => BY_TIME.Comida, 1, 90);
  add('Snack PM', snackPool, nSnack, 70);
  add('Cena', () => BY_TIME.Cena, 1, 90);
  return { day: dayNum, theme: '', meals };
}

export function buildWeeklyPlan(target: PlanTarget, opts: BuildOpts = {}): DayPlan[] {
  cravedCount.clear(); // tope de antojo por semana
  const T = [target.kcal, target.protG, target.fatG, target.carbG];
  // NUTRITION-N3 · SEGURIDAD DEL BATIDO: el whey (regular/mass gainer) es lácteo → si el usuario evita
  // lácteos o es vegano, NO se prescribe (fail-closed). Se omite y los principales cierran la meta con
  // comida real (no inventamos una "proteína vegana" que no exista como dato). El batido 'vegana' sí pasa.
  const shake = shakeAllowedFor(opts.shake, opts.avoid ?? []) ? opts.shake : undefined;   // D-WP5
  const buildT = reduceForShake(T, shake); // los principales van contra la meta MENOS el batido
  const rng = mulberry32(opts.seed ?? 12345);
  // "Evitar": categoría (gluten/lácteos/…) → alimentos reales del banco; excluye esos platillos.
  // MB3 · strict (permanentes) + soft (preferencias de la semana), la misma pareja que el pool de la IA.
  const policyAvoid = makePolicyFilter(opts.avoid);
  // El predicado 'avoid' ya excluye alérgenos; le sumamos la visibilidad por región
  // (filtro DURO fuera de LATAM + segmentación por marca region:ES) para que el fallback
  // determinista tampoco arme mole en España ni platillos de España fuera de EUROPE.
  const avoid = (d: BancoDish) =>
    policyAvoid(d) ||
    !dishAllowedInRegion(d, opts.region);
  const cuisines = (opts.cuisines ?? []).map((s) => s.toLowerCase().trim()).filter(Boolean);
  const poolSize = Object.fromEntries(['Desayuno', 'Comida', 'Cena', 'Snack'].map((t) => [t, (BY_TIME[t] ?? []).filter((d) => !avoid(d)).length]));
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
    // Dos fases. FASE ESTRICTA: variedad completa + cada platillo en su tiempo, sin
    // repetir en la semana. Da <1% en el ~89% de los días. FASE RELAJADA: solo si
    // la estricta se quedó LEJOS (>2%) —el rincón de exclusiones pesadas + meta
    // alta, donde el banco compatible es muy chico— se permite repetir un platillo
    // en la semana y sesgar a densos en carbo, SIN sacar nada de su tiempo. Repetir
    // un plato es preferible a fallar la meta, pero solo cuando de verdad hace falta;
    // así los casos comunes conservan su variedad.
    const correr = (relax: number, intentos: number) => {
      for (let a = 0; a < intentos; a++) {
        used.clear(); preU.forEach((x) => used.add(x));
        ingFreq.clear(); preI.forEach((v, k) => ingFreq.set(k, v));
        cravedCount.clear(); preC.forEach((v, k) => cravedCount.set(k, v));
        // Si un tiempo no tiene candidatos, buildDay lanza NoEligibleDishesError y el error
        // SALE de buildWeeklyPlan: no se reintenta con otro relax (relajar variedad o sesgar
        // a carbo no crea platillos) ni se devuelve un plan incompleto. Lo recoge la UI.
        const day = buildDay(i, buildT, rng, avoid, cuisines, used, craving, ingFreq, relax, avoidInputUnion(opts.avoid), shakeSlotsOf(shake));
        if (shake) { applyShake(day.meals, shake); day.meals = chronological(day.meals); }   // el batido ocupa SU slot de snack
        // Cuadre del día contra la meta COMPLETA (T), ya con el batido puesto: las
        // comidas absorben lo que el batido aporta o deja faltando.
        topUpDay(day.meals, T);
        const com = kcalDe(day, 'Comida');
        const desorden = (com < kcalDe(day, 'Desayuno') ? 1 : 0) + (com < kcalDe(day, 'Cena') ? 1 : 0);
        // CAPA 4 · repetir en la semana una principal cuesta 1 punto: un día variado gana si es, como mucho, ~1 punto
        // menos exacto (antes el desvío solo veía macros y a metas altas el mismo platillo ganaba los 7 días).
        const repetidas = day.meals.filter((m) => !m.time.startsWith('Snack') && preU.has(m.name)).length;
        const score = dayErr(day) + desorden * 0.08 + repetidas * 0.01;
        // CAPA 4 · las fases relajadas (repetir en la semana / sesgo a carbo) solo ganan si MEJORAN de verdad
        // (≥ 1 punto): cuando el desvío tiene un piso estructural (meta muy alta en carbo con poca proteína),
        // repetir el mismo platillo los 7 días no lo baja y solo destruye la variedad.
        if (score < bestErr - (relax > 0 ? 0.01 : 0)) {
          bestErr = score; best = day;
          bU = new Set(used); bI = new Map(ingFreq); bC = new Map(cravedCount);
        }
        if (bestErr <= 0.01) break;   // exacto y ordenado: parar (conserva variedad)
      }
    };
    correr(0, 18);                         // estricto
    if (bestErr > 0.02) correr(1, 8);      // lejos → permite repetir en la semana
    if (bestErr > 0.02) correr(2, 8);      // aún lejos → repetir + sesgo a carbo
    used.clear(); bU.forEach((x) => used.add(x));
    ingFreq.clear(); bI.forEach((v, k) => ingFreq.set(k, v));
    cravedCount.clear(); bC.forEach((v, k) => cravedCount.set(k, v));
    const day = best!;
    topUpMeals(day.meals, target, opts.avoid ?? [], corrUsed);
    day.meals = chronological(day.meals);
    const cap = capacityIssue(day, T, opts.avoid, avoid, poolSize);   // registrar, nunca deformar
    if (cap) day.capacity = cap;
    const rl = recipeLimits(day, T);   // Bloque 5 · receta cerrada en su límite: registrar, nunca deformar
    if (rl.length) day.recipeLimits = rl;
    days.push(day);
  }
  return days;
}
