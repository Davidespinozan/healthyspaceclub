/**
 * IngredientSwap — dado un string de porción, busca alimentos equivalentes
 * dentro del mismo subgrupo del Sistema Mexicano de Equivalentes.
 *
 * Misma lógica de matching que smeCalc.ts / kcalCalc.ts.
 */

import { smeGroups, type SmeFood, type SmeSubgroup } from '../data/foodEquivalents';
import { stripAccents } from './smeCalc';

export interface SwapOption {
  name: string;
  amount: string;
  subgroup: string;
  group: string;
}

// Genera la clave de búsqueda (minúsculas, sin acentos)
function smeKey(name: string): string {
  return stripAccents(name)
    .toLowerCase()
    .replace(/\s*\/.*$/, '')
    .replace(/\s*\(.*?\)/g, '')
    .replace(/\bcocidos?\b/g, '')
    .replace(/\bcocidas?\b/g, '')
    .replace(/\bsin piel\b/g, '')
    .replace(/\ben agua\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Índice invertido: foodKey → { subgroup, group, food }
interface SmeIndex { sub: SmeSubgroup; groupLabel: string; food: SmeFood }
const _index: Map<string, SmeIndex> = new Map();

for (const group of smeGroups) {
  for (const sub of group.subgroups) {
    for (const food of sub.foods) {
      const variants = food.name.split('/').map(v => smeKey(v.trim()));
      for (const key of variants) {
        if (key.length >= 3) _index.set(key, { sub, groupLabel: group.label, food });
      }
    }
  }
}

// Extrae el nombre del ingrediente principal de un string de porción
function extractIngredient(raw: string): string {
  return stripAccents(raw)
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/^[\d½⅓¼¾⅔⅙⅜/.\s]+/, '')  // strip cantidad
    .replace(/^(?:tz|pz|reb|cda|cdita|g|lata)\s+(?:de\s+)?/i, '') // strip unidad
    .replace(/\s+con\s+.*$/, '')
    .replace(/\s+a\s+la\s+.*$/, '')
    .replace(/\s+al\s+.*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Dado un string de porción, devuelve hasta `limit` alternativas equivalentes
 * del mismo subgrupo (excluyendo el ingrediente original).
 */
export function findSwaps(portionText: string, limit = 5): SwapOption[] {
  const ing = extractIngredient(portionText);
  if (!ing || ing.length < 3) return [];

  // Buscar el ingrediente en el índice
  let match: SmeIndex | undefined;
  const sorted = Array.from(_index.keys()).sort((a, b) => b.length - a.length);
  for (const key of sorted) {
    if (ing.includes(key) || key.includes(ing)) {
      match = _index.get(key);
      break;
    }
  }
  if (!match) return [];

  // Mismo subgrupo → mismas kcal/macros por equivalente
  const alternatives: SwapOption[] = [];
  for (const food of match.sub.foods) {
    const fKey = smeKey(food.name);
    if (fKey === smeKey(match.food.name)) continue; // skip self
    alternatives.push({
      name: food.name,
      amount: food.amount,
      subgroup: match.sub.name,
      group: match.groupLabel,
    });
    if (alternatives.length >= limit) break;
  }
  return alternatives;
}
