// ─────────────────────────────────────────────────────────────────────────────
// MENÚ HSC V1 · BLOQUE 3 · COMPLEMENTOS DE UNA COMIDA PRINCIPAL (D2: comida = platillo + complementos).
//
// Catálogo DERIVADO del banco de Magaly, sin inventar alimentos, medidas ni maridajes:
//   · un complemento es un alimento que Magaly ya sirve como ACOMPAÑAMIENTO (`seccion = acompañamiento`) de
//     algún platillo, con su ficha completa (macros, `max_g`, medida casera), dominante en CARBOHIDRATO y que
//     no es fruta (D3: la fruta no es relleno);
//   · es compatible con un platillo si Magaly lo sirve así en el MISMO tiempo y con el MISMO `sabor`;
//   · coherencia culinaria: si el platillo ya lleva un almidón, el complemento solo puede ser MÁS de ese mismo
//     almidón (más tortillas con los tacos, más arroz con el bowl de arroz); si su almidón no está en el
//     catálogo (pasta, quinoa, avena…), no lleva complemento; sin almidón, cualquiera compatible.
// Las restricciones las decide la MISMA autoridad que para un platillo: el motor (su filtro de política) y la
// validación final (`validatePlan`) evalúan `complementDish(c)` igual que cualquier platillo. Puro.
// ─────────────────────────────────────────────────────────────────────────────
import { BANCO, type BancoDish, type BancoIng } from '../data/banco';
import { portionBoundsFor } from './portionPlausibility';

export interface Complement {
  /** Familia de almidón (tortilla, tostada, arroz, papa, pan, frijol, granola). */
  family: string;
  /** Ficha del alimento: macros por gramo, medida casera, `g0` = porción típica de acompañamiento (mediana del banco), `max` = su `max_g` (mediana). */
  ing: BancoIng;
  tiempos: ReadonlySet<string>;
  sabores: ReadonlySet<string>;
  /** Cuántas veces lo sirve Magaly como acompañamiento (orden de preferencia). */
  uses: number;
}

const FRUIT_FAMILIES = new Set(['berries', 'grapes', 'cutFruit', 'wholeFruit']);
const isFruit = (nv: string) => FRUIT_FAMILIES.has(portionBoundsFor(nv)?.family ?? '') || /\bfruta\b|\bmoras?\b/i.test(nv);
// Orden importa: «Pan tostado» es PAN (no tostada), así que `pan` va antes que `tostad`.
const STARCH_FAMILY: Array<[RegExp, string]> = [
  [/tortilla/i, 'tortilla'], [/\bpan\b/i, 'pan'], [/tostad/i, 'tostada'], [/arroz/i, 'arroz'], [/\bpapas?\b/i, 'papa'],
  [/frijol/i, 'frijol'], [/granola/i, 'granola'],
];
/** Familia de almidón del catálogo, o null. Puro. */
export function starchFamily(nv: string): string | null {
  for (const [re, f] of STARCH_FAMILY) if (re.test(nv)) return f;
  return null;
}
/** ¿Es un almidón (aunque no esté en el catálogo de complementos: pasta, quinoa, avena, camote…)? */
const ANY_STARCH_RE = /arroz|papa|camote|pasta|espagueti|fideo|macarr|quinoa|avena|cusc[uú]s|bulgur|frijol|lenteja|garbanzo|elote|pur[eé]|yuca|pl[aá]tano macho|tortilla|tostad|totopo|\bpan\b|bagel|pita|granola|galleta|arepa|\bmasa\b|sope|tamal|gordita|tlacoyo|empanada|hot ?cakes?|crepas?|waffles?|bollo|baguette|bisquet|harina/i;
const carbDominant = (a: number[]) => 4 * a[3] > 4 * a[1] && 4 * a[3] > 9 * a[2];
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

function buildCatalog(): Complement[] {
  const by = new Map<string, { ings: BancoIng[]; tiempos: Set<string>; sabores: Set<string> }>();
  for (const d of BANCO) for (const i of d.ings) {
    if (i.sec !== 'a' || i.rol !== 'principal' || !i.a || /\(topping\)/i.test(i.nv) || isFruit(i.nv) || !carbDominant(i.a)) continue;
    if (!starchFamily(i.nv)) continue;
    const e = by.get(i.nv) ?? by.set(i.nv, { ings: [], tiempos: new Set(), sabores: new Set() }).get(i.nv)!;
    e.ings.push(i); e.tiempos.add(d.tiempo); if (d.sabor) e.sabores.add(d.sabor);
  }
  return [...by.entries()].map(([nv, e]) => {
    const base = e.ings[0];
    return {
      family: starchFamily(nv)!, tiempos: e.tiempos, sabores: e.sabores, uses: e.ings.length,
      ing: { nv, rol: 'principal', g0: median(e.ings.map((x) => x.g0)), max: median(e.ings.map((x) => x.max ?? x.g0)), a: base.a, ...(base.pu ? { pu: base.pu, un: base.un } : {}) },
    };
  }).sort((a, b) => b.uses - a.uses);
}

/** Catálogo de complementos (derivado del banco; inmutable). */
export const COMPLEMENTS: readonly Complement[] = buildCatalog();
export const COMPLEMENT_BY_NV: ReadonlyMap<string, Complement> = new Map(COMPLEMENTS.map((c) => [c.ing.nv, c]));

/** Familias de almidón que ya lleva un platillo ('otro' = almidón fuera del catálogo: pasta, masa de arepa,
 *  avena…). Se decide por DATOS: cualquier principal dominante en carbohidrato que no sea fruta es el almidón del
 *  platillo (así una arepa, un sope o un hot cake cuentan aunque su nombre no diga «tortilla»). Puro. */
export function dishStarchFamilies(d: BancoDish): Set<string> {
  const out = new Set<string>();
  for (const i of d.ings) {
    if (i.rol === 'condimento' || i.rol === 'guarnicion' || isFruit(i.nv)) continue;
    // Principal dominante en carbo, o cualquier ingrediente (también sub-receta / fijo: la arepa es una
    // sub-receta de masa) cuyo nombre es un almidón.
    const byMacro = i.rol === 'principal' && !!i.a && carbDominant(i.a);
    if (!byMacro && !ANY_STARCH_RE.test(i.nv)) continue;
    out.add(starchFamily(i.nv) ?? 'otro');
  }
  return out;
}

/** Complementos compatibles con un platillo servido en `slot`, en orden de preferencia. Puro. */
export function compatibleComplements(d: BancoDish, slot: string): Complement[] {
  const own = dishStarchFamilies(d);
  return COMPLEMENTS.filter((c) => {
    if (!c.tiempos.has(slot) || !(d.sabor && c.sabores.has(d.sabor))) return false;
    if (own.size === 0) return true;                 // sin almidón: cualquiera compatible
    return own.has(c.family);                        // con almidón: solo más del MISMO
  });
}

/** El complemento como «platillo» de un solo alimento, para evaluarlo con la MISMA autoridad de restricciones. */
export function complementDish(c: Complement, slot: string): BancoDish {
  return { nombre: c.ing.nv, tiempo: slot, tipo: 'suelto', multMax: 1, img: '', fixed: [0, 0, 0, 0, 0], ings: [c.ing], sabor: [...c.sabores][0] };
}
