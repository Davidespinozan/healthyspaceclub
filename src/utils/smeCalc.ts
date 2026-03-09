/**
 * Sistema Mexicano de Equivalentes — 4ª Edición
 *
 * Construye automáticamente un mapa de nutrición a partir de los datos de
 * smeGroups (foodEquivalents.ts).  Cada alimento produce kcal/100g y el
 * peso en gramos de su unidad representativa (tz / pz / cda / cdita / reb).
 *
 * Se usa como fuente PRIMARIA en findEntry() de kcalCalc.ts; el nutritionDB
 * actúa como fallback para alimentos no cubiertos por el SME.
 */

import { smeGroups } from '../data/foodEquivalents';

// ── Fracciones unicode ────────────────────────────────────────────────────
const FRAC: Record<string, number> = {
  '½': 0.5, '⅓': 1 / 3, '¼': 0.25, '¾': 0.75,
  '⅔': 2 / 3, '⅙': 1 / 6, '⅜': 0.375,
};

function parseFrac(s: string): number {
  s = s.trim();
  const mixed = s.match(/^(\d+)\s*([½⅓¼¾⅔⅙⅜])$/);
  if (mixed) return parseInt(mixed[1]) + (FRAC[mixed[2]] ?? 0);
  if (FRAC[s] !== undefined) return FRAC[s];
  const slash = s.match(/^(\d+)\/(\d+)$/);
  if (slash) return +slash[1] / +slash[2];
  return parseFloat(s) || 0;
}

// ── Extrae gramos de la parte "(Xg)" o "(X ml)" del string de cantidad ───
function parseGrams(amount: string): number | null {
  const m = amount.match(/\((\d+(?:\.\d+)?)(?:g|ml)\)/);
  return m ? parseFloat(m[1]) : null;
}

// ── Extrae unidad y cantidad del string de porción ───────────────────────
type UnitKey = 'tz' | 'pz' | 'cda' | 'cdita' | 'reb';

function parseUnit(amount: string): { type: UnitKey | null; qty: number } {
  // Tomar solo la primera opción si hay "A / B"
  const s = amount.split('/')[0].toLowerCase();
  const Q = '([\\d½⅓¼¾⅔⅙⅜]+(?:\\s+[½⅓¼¾⅔⅙⅜]+)?)';
  const patterns: [RegExp, UnitKey][] = [
    [new RegExp(Q + '\\s+(?:tazas?|tz)\\b'),              'tz'],
    [new RegExp(Q + '\\s+(?:piezas?|pz|mitades?)\\b'),    'pz'],
    [new RegExp(Q + '\\s+(?:cditas?|cucharaditas?)\\b'),  'cdita'],
    [new RegExp(Q + '\\s+(?:cdas?|cucharadas?)\\b'),      'cda'],
    [new RegExp(Q + '\\s+rebanadas?\\b'),                  'reb'],
  ];
  for (const [re, type] of patterns) {
    const m = s.match(re);
    if (m) return { type, qty: parseFrac(m[1]) };
  }
  return { type: null, qty: 1 };
}

// ── Elimina tilde/acento de un string ────────────────────────────────────
export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ── Genera la clave de búsqueda (minúsculas, sin acentos, sin descriptores) ─
function smeKey(name: string): string {
  return stripAccents(name)
    .toLowerCase()
    .replace(/\s*\/.*$/, '')              // primera opción antes de "/"
    .replace(/\s*\(.*?\)/g, '')           // strip paréntesis
    .replace(/\bcocidos?\b/g, '')         // cocido/a/s
    .replace(/\bcocidas?\b/g, '')
    .replace(/\bsin piel\b/g, '')
    .replace(/\ben agua\b/g, '')
    .replace(/\ben grano\b/g, '')
    .replace(/\bliquidas?\b/g, '')        // (acento ya eliminado: líquida)
    .replace(/\bmagr[oa]s?\b/g, '')       // magro/magra
    .replace(/\bfirmes?\b/g, '')          // tofu firme → tofu
    .replace(/\blight\b/g, '')
    .replace(/\bnatural\b/g, '')
    .replace(/\bregular\b/g, '')
    .replace(/\bcon grasa\b/g, '')
    .replace(/\bhorneadas?\b/g, '')
    .replace(/\bsin az[uu]?car\b/g, '')   // sin azúcar / sin azucar
    .replace(/\b0%\s*grasa\b/g, '')
    .replace(/\bde abeja\b/g, '')         // "miel de abeja" → "miel"
    .replace(/\s+o\s+.*/g, '')            // "blanca o morena" → "blanca"
    .replace(/\b(blanca?|morena?)\b/g, '')// "azucar blanca" → "azucar"
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Tipo de entrada compatible con NutrientEntry de nutritionDB ──────────
export interface SmeNutrientEntry {
  kcal: number;         // kcal por 100 g
  prot: number;         // g proteína por 100 g
  cho:  number;         // g carbohidratos por 100 g
  fat:  number;         // g grasa por 100 g
  units?: {
    tz?:    number;     // g por taza
    pz?:    number;     // g por pieza
    cda?:   number;     // g por cucharada
    cdita?: number;     // g por cucharadita
    reb?:   number;     // g por rebanada
    lata?:  number;     // g por lata (para compatibilidad con NutrientEntry)
  };
}

// ── Construye el mapa de nutrición desde smeGroups ───────────────────────
export const smeNutritionDB: Record<string, SmeNutrientEntry> = (() => {
  const db: Record<string, SmeNutrientEntry> = {};

  for (const group of smeGroups) {
    for (const sub of group.subgroups) {
      for (const food of sub.foods) {
        const grams = parseGrams(food.amount);
        if (!grams || grams === 0) continue;  // sin dato de gramos → omitir

        const factor = 100 / grams;
        const kcalPer100g = Math.round(sub.kcal * factor * 10) / 10;
        const protPer100g = Math.round(sub.prot * factor * 10) / 10;
        const choPer100g  = Math.round(sub.cho  * factor * 10) / 10;
        const fatPer100g  = Math.round(sub.fat  * factor * 10) / 10;
        const { type, qty } = parseUnit(food.amount);

        const entry: SmeNutrientEntry = { kcal: kcalPer100g, prot: protPer100g, cho: choPer100g, fat: fatPer100g };
        if (type && qty > 0) {
          const gPerUnit = Math.round((grams / qty) * 10) / 10;
          entry.units = { [type]: gPerUnit };
        }

        // Registrar cada variante cuando el nombre tiene "A / B"
        const variants = food.name.split('/').map(v => smeKey(v.trim()));
        for (const key of variants) {
          if (key.length >= 3) db[key] = entry;
        }
      }
    }
  }

  return db;
})();
