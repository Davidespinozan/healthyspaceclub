// ─────────────────────────────────────────────────────────────────────────────
// MENÚ HSC V1 · BLOQUE 3B · ESTRUCTURA DE LA RECETA: núcleo + acompañamiento flexible.
//
// Clasifica cada ingrediente de un platillo con los DATOS del banco (rol, `seccion`, tipo bloque, macros) y reglas
// explícitas; si la evidencia no alcanza, NO inventa: marca el platillo AMBIGUOUS_RECIPE_STRUCTURE.
//
//   CORE_RECIPE      · lo que forma el platillo: su fuente de proteína, el vehículo (tortilla, tostada, pan, pita,
//                      pasta, fideo, avena, masa…), los almidones de preparaciones INTEGRADAS (sopa, caldo, relleno,
//                      guiso, yakimeshi…) y el resto de principales del plato. Se sirve en su PORCIÓN BASE.
//   FLEXIBLE_SIDE    · acompañamiento separable: lo que Magaly marcó `seccion = acompañamiento` (salvo una fuente de
//                      proteína), y el almidón cocido simple (arroz, papa, camote, puré, quinoa) de un platillo que
//                      tiene su propia fuente de proteína y no es una preparación integrada. Se mueve dentro de sus
//                      límites existentes (piso, `max_g`, techos).
//   FIXED_CONDIMENT  · fijo / condimento / guarnición / sub-receta: no escala (como siempre).
//   (EXTERNAL_COMPLEMENT lo agrega el motor desde `menuComplements`; no es un ingrediente del banco.)
//
// Un `bloque` (masa / proporción sagrada) conserva su semántica existente: su estructura escala como bloque.
// Puro, sin estado.
// ─────────────────────────────────────────────────────────────────────────────
import type { BancoDish, BancoIng } from '../data/banco';

export type IngredientClass = 'CORE_RECIPE' | 'FLEXIBLE_SIDE' | 'FIXED_CONDIMENT';

/** Fuente de proteína: ≥ 35 % de sus kcal vienen de proteína y no es dominante en carbohidrato (el salmón es
 *  dominante en grasa y aun así es la proteína del plato; las leguminosas son carbohidrato). */
export function isProteinSource(ing: BancoIng): boolean {
  if (!ing.a) return false;
  const p = 4 * ing.a[1], f = 9 * ing.a[2], c = 4 * ing.a[3];
  const tot = p + f + c;
  return tot > 0 && p / tot >= 0.35 && !(c > p && c > f);
}

/** Almidón cocido simple que puede ser acompañamiento separable. */
const PLAIN_STARCH_RE = /\barroz\b|\bpapas?\b|\bcamote\b|pur[eé]|\bquinoa\b/i;
/** Vehículo o base estructural del platillo: nunca es un acompañamiento libre. */
const VEHICLE_RE = /tortilla|tostad|totopo|\bpan\b|pita|wrap|thin|bagel|pasta|espagueti|fideo|noodle|ramen|avena|harina|\bmasa\b|arepa|crut[oó]n|galleta|granola/i;
/** Preparación integrada: el almidón es parte de la receta, no un lado del plato. */
const INTEGRATED_DISH_RE = /relleno|rellena|\bsopa\b|\bcaldo\b|\basado\b|guiso|estofado|yakimeshi|frito|risotto|ensalada de (papa|arroz|quinoa|camote)|pastel|tortitas?|croqueta|lasa[ñn]a/i;

export interface DishStructure {
  classes: Map<BancoIng, IngredientClass>;
  ambiguous: string | null;
  hasProteinSource: boolean;
  /** ¿Tiene un acompañamiento flexible dominante en carbohidrato (por donde suben las kcal sin tocar el núcleo)? */
  hasCarbSide: boolean;
}

const _memo = new WeakMap<BancoDish, DishStructure>();

/** Estructura de un platillo (memoizada). Puro. */
export function dishStructure(d: BancoDish): DishStructure {
  const hit = _memo.get(d);
  if (hit) return hit;
  const classes = new Map<BancoIng, IngredientClass>();
  const principals = d.ings.filter((i) => i.rol === 'principal' && i.a);
  const hasProteinSource = principals.some(isProteinSource);
  let ambiguous: string | null = null;
  for (const i of d.ings) {
    if (i.rol !== 'principal' || !i.a) { classes.set(i, 'FIXED_CONDIMENT'); continue; }
    if (d.tipo === 'bloque') { classes.set(i, 'CORE_RECIPE'); continue; }   // semántica de bloque existente
    if (i.sec === 'a') { classes.set(i, isProteinSource(i) ? 'CORE_RECIPE' : 'FLEXIBLE_SIDE'); continue; }
    if (isProteinSource(i) || VEHICLE_RE.test(i.nv)) { classes.set(i, 'CORE_RECIPE'); continue; }
    if (PLAIN_STARCH_RE.test(i.nv)) {
      if (INTEGRATED_DISH_RE.test(d.nombre)) { classes.set(i, 'CORE_RECIPE'); continue; }
      if (hasProteinSource) { classes.set(i, 'FLEXIBLE_SIDE'); continue; }
      // Almidón simple sin fuente de proteína en el plato: no hay evidencia de si es lado o base.
      ambiguous ??= `almidón «${i.nv}» sin fuente de proteína que lo haga separable`;
      classes.set(i, 'CORE_RECIPE');
      continue;
    }
    classes.set(i, 'CORE_RECIPE');
  }
  const hasCarbSide = principals.some((i) => classes.get(i) === 'FLEXIBLE_SIDE' && 4 * i.a![3] > 4 * i.a![1] && 4 * i.a![3] > 9 * i.a![2]);
  const out = { classes, ambiguous, hasProteinSource, hasCarbSide };
  _memo.set(d, out);
  return out;
}
