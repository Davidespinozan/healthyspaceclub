// ─────────────────────────────────────────────────────────────────────────────
// NUTRITION-N8 · NORMALIZACIÓN DE LISTA DE COMPRAS (solo representación).
//
// El plan nutricional NO cambia. Esta capa DERIVA una lista de compras que representa SKUs reales:
//  1) expande el ÚNICO wrapper compuesto del banco — "Verduras (lechuga, jitomate, cebolla)" → cada verdura,
//  2) colapsa sinónimos de compra FACTUALES (jitomate=tomate, yogur=yogurt) y variantes acento/plural,
//  3) deduplica por SKU (la cebolla que sale en 20 platos = 1 renglón), preservando el orden de aparición
//     y el NOMBRE ORIGINAL (primero visto) para no romper el renombrado regional de display (tIngName).
//
// Pura / determinista / sin dependencias. NO participa en elegibilidad (alérgenos/dietas) ni en macros.
// NO inventa gramos: la lista es de NOMBRES (string[]), igual que el contrato persistido actual.
// ─────────────────────────────────────────────────────────────────────────────

export interface GroceryInput { nv: string; rol?: string }

const fold = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
// plural español no ambiguo: quita -es / -s final por token (champiñones→champiñon, pimientos→pimiento).
const singular = (tok: string) => tok.replace(/(?:es|s)$/i, (m) => (tok.length - m.length >= 3 ? '' : m));
// alias SEMÁNTICO factual (mismo SKU de compra) — aplicado al PRIMER token del key. Intencionalmente MÍNIMO.
const CANON: Record<string, string> = { jitomate: 'tomate', yogur: 'yogurt', yoghurt: 'yogurt' };

/** Clave canónica de SKU: fold + plural + alias del primer token. NO colapsa alimentos distintos
 *  (feta≠panela, arroz≠arroz integral, pollo≠pechuga: sus keys difieren). */
export function skuKey(nv: string): string {
  const tokens = fold(nv).split(' ').map(singular).filter(Boolean);
  if (tokens.length) tokens[0] = CANON[tokens[0]] ?? tokens[0];
  return tokens.join(' ') || fold(nv);
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Expande SOLO el wrapper compuesto "Verduras (...)" en verduras individuales. Otros paréntesis
// (Corte de res (sirloin), Pan (2 rebanadas)) NO se tocan.
function expand(nv: string): string[] {
  if (!/^\s*verduras?\s*\(/i.test(fold(nv))) return [nv];
  const open = nv.indexOf('(');
  const inner = nv.slice(open + 1, nv.lastIndexOf(')'));
  const flat = inner.replace(/\([^)]*\)/g, ' ');          // quita paréntesis anidados: "pimientos (verde, rojo)" → "pimientos "
  const parts = flat.split(/,|\sy\s/).map((p) => p.trim()).filter((p) => p.length > 1);
  return parts.length ? parts.map(cap) : [nv];
}

/** Lista de compras normalizada: nombres de SKU deduplicados, en orden de primera aparición.
 *  Excluye condimento y sub-receta (misma política que producción). Solo cambia la REPRESENTACIÓN. */
export function normalizeGroceryList(ings: GroceryInput[]): string[] {
  const seen = new Map<string, string>();  // skuKey → nombre de display (primero visto)
  for (const ing of ings) {
    if (ing.rol === 'condimento' || ing.rol === 'sub-receta') continue;
    for (const name of expand(ing.nv)) {
      const k = skuKey(name);
      if (!k) continue;
      if (!seen.has(k)) seen.set(k, name);
    }
  }
  return [...seen.values()];
}
