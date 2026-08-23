// ─────────────────────────────────────────────────────────────────────────────
// NUTRITION-N3 · COMPOSITE-INGREDIENT / ALLERGEN SAFETY (capa DERIVADA).
//
// El enforcement (makeAvoidFilter → dishMatches) ya es fail-closed, pero SOLO veía `dish.nombre +
// dish.ings[].nv`. Alérgenos escondidos en (a) SUB-RECETAS opacas (Aderezo César → mayonesa+parmesano)
// y (b) composites atómicos (Mayonesa=huevo, Hummus=ajonjolí) pasaban el filtro. Esta capa DERIVA el
// texto EFECTIVO del plato para que el MISMO filtro los vea. No hay segunda autoridad: reutiliza
// SUBRECETAS (ya en banco.ts) + un mapa PEQUEÑO de composites que SUBRECETAS no descompone.
//
// Puro / determinista / no-mutante. NO modifica BANCO ni SUBRECETAS. NO toca macros/porciones.
// ─────────────────────────────────────────────────────────────────────────────
import { SUBRECETAS, type BancoDish } from '../data/banco';

/** Normalización idéntica a la del matcher del motor: minúsculas, sin acentos. */
export const normAllergen = (s: string): string =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Índice de SUBRECETAS case/acento-insensible: las llaves son Title-Case ("Aderezo César") pero los
// platos las referencian en minúscula ("Aderezo césar"/"Vinagreta balsámica") → un lookup exacto fallaría.
const SUB_INDEX = new Map<string, { ings: { nv: string }[] }>();
for (const [k, v] of Object.entries(SUBRECETAS)) SUB_INDEX.set(normAllergen(k), v);

/** Ingredientes REALES de una sub-receta por su nombre (case/acento-insensible), o [] si no es sub-receta. */
export function subRecipeIngredientNames(nv: string): string[] {
  const sr = SUB_INDEX.get(normAllergen(nv));
  return sr ? sr.ings.map((i) => i.nv) : [];
}

// ── Alérgenos OCULTOS en composites atómicos NO descompuestos en SUBRECETAS ──────────────────────
// Cada regla: si el nombre normalizado del ingrediente matchea `test`, el plato "contiene" esas
// CATEGORÍAS de avoid (mismas llaves que AVOID_MAP). Mínimo, auditado contra los nv reales del banco.
interface HiddenRule { name: string; test: (n: string) => boolean; cats: string[] }
const HIDDEN_RULES: HiddenRule[] = [
  { name: 'mayonesa→huevo', test: (n) => /\bmayonesa\b/.test(n), cats: ['huevo'] },
  { name: 'hummus/tahini→ajonjoli', test: (n) => /\bhummus\b|\btahini\b/.test(n), cats: ['ajonjoli'] },
  { name: 'pesto→lacteos+frutos-secos', test: (n) => /\bpesto\b/.test(n), cats: ['lacteos', 'frutos-secos'] },
  // La SALSA DE SOYA lleva trigo → gluten (la soya ya la ve el token 'soya'; NO se marca gluten a la soya en grano).
  { name: 'salsa-de-soya→gluten', test: (n) => /salsa de soya/.test(n), cats: ['gluten'] },
  { name: 'corn-flakes→gluten', test: (n) => /corn\s*flakes/.test(n), cats: ['gluten'] },  // malta de cebada
  // "Crema"/"Crema light"/"Queso crema"/"Crema ácida" = lácteo; PERO NO "Crema de cacahuate/almendra" (mantequillas).
  { name: 'crema(dairy)→lacteos', test: (n) => /\bcrema\b(?!\s+de\s+(cacahuate|almendra|man|avellana|maran|caju))/.test(n), cats: ['lacteos'] },
];

/** Categorías de avoid OCULTAS que implica un nombre de ingrediente (por sus composites). */
export function hiddenAllergenCatsFor(nv: string): string[] {
  const n = normAllergen(nv);
  const out: string[] = [];
  for (const r of HIDDEN_RULES) if (r.test(n)) out.push(...r.cats);
  return out;
}

/**
 * MARCADOR de una categoría de avoid como UN token (sin guiones/espacios), para que sobreviva la
 * tokenización de dishMatches (que parte por `[^a-z0-9]+`, p.ej. "frutos-secos" → "frutos","secos").
 * Se emite en el texto efectivo del plato Y se agrega a la expansión del usuario → matchean 1:1.
 */
export const catMarker = (cat: string): string => 'xcat' + normAllergen(cat).replace(/[^a-z0-9]/g, '');

/**
 * TEXTO EFECTIVO de un plato para la detección de restricciones:
 *   nombre + ingredientes propios + ingredientes REALES de sus sub-recetas (SUBRECETAS) +
 *   marcadores de CATEGORÍA de los alérgenos ocultos en composites atómicos (mayonesa/hummus/…).
 * `dishMatches` corre sobre este texto → el MISMO filtro (makeAvoidFilter) ahora ve lo oculto.
 * Puro/determinista; NO muta el plato. Las sub-recetas no anidan (un solo nivel de expansión).
 */
export function effectiveDishAvoidText(dish: BancoDish): string {
  const names: string[] = [dish.nombre];
  const cats: string[] = [];
  for (const ing of dish.ings) {
    names.push(ing.nv);
    cats.push(...hiddenAllergenCatsFor(ing.nv));
    for (const subNv of subRecipeIngredientNames(ing.nv)) {   // descompone la sub-receta (Aderezo César → …)
      names.push(subNv);
      cats.push(...hiddenAllergenCatsFor(subNv));              // p.ej. "Mayonesa light" dentro del Aderezo César
    }
  }
  return normAllergen([...names, ...cats.map(catMarker)].join(' '));
}

// Alias de ENTRADA del usuario (localización) → llave canónica de AVOID_MAP. Mínimo demostrado; no es
// un diccionario multi-idioma. El usuario que escribe "maní"/"cacahuete"/"sésamo" debe filtrar igual.
const USER_AVOID_ALIAS: Record<string, string> = {
  mani: 'cacahuate', cacahuete: 'cacahuate',
  sesamo: 'ajonjoli',
  lacteo: 'lacteos', 'sin lacteos': 'lacteos', 'sin gluten': 'gluten', 'sin huevo': 'huevo',
};
/** Canónica de un término de avoid del usuario (localización → llave del banco). Puro. */
export function canonicalizeAvoidTerm(term: string): string {
  const n = normAllergen(term).trim();
  return USER_AVOID_ALIAS[n] ?? n;
}
