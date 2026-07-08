/**
 * scalePlan.ts — Escala las porciones de un plan a las kcal exactas del usuario.
 *
 * Funciona sobre el formato de strings existente en mealPlan.ts:
 *   "200 g pechuga de pollo" × 0.85  →  "170 g pechuga de pollo"
 *   "1 ½ tz arroz cocido"    × 1.20  →  "1 ¾ tz arroz cocido"
 *   "2 pz huevo"             × 0.80  →  "2 pz huevo"   (discretos: min 1)
 *   "Limón, sal y pimienta"  × cualquier  →  sin cambio (sin cantidad)
 *
 * Cada día se escala de forma independiente usando su propia base de kcal.
 */

import { dayNutrition } from './mealNutrition';
import type { DayPlan } from '../types';

// Base kcal del día desde la base de Magaly (consistente con lo que se muestra).
const calcDayKcal = (meals: DayPlan['meals']): number => dayNutrition(meals).kcal;

// ── Fracciones unicode disponibles ──────────────────────────────────────────
const FRAC_MAP: Record<string, number> = {
  '½': 0.5, '⅓': 1 / 3, '¼': 0.25, '¾': 0.75,
  '⅔': 2 / 3, '⅙': 1 / 6, '⅜': 3 / 8,
};
// Solo las fracciones que la gente usa al cocinar
const DISPLAY_FRACS: [number, string][] = [
  [1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾'],
];

function parseAmt(s: string): number {
  s = s.trim();
  const mixed = s.match(/^(\d+)\s*([½⅓¼¾⅔⅙⅜])$/);
  if (mixed) return parseInt(mixed[1]) + (FRAC_MAP[mixed[2]] ?? 0);
  if (FRAC_MAP[s] !== undefined) return FRAC_MAP[s];
  const slash = s.match(/^(\d+)\/(\d+)$/);
  if (slash) return parseInt(slash[1]) / parseInt(slash[2]);
  return parseFloat(s) || 0;
}

function bestFrac(frac: number): { sym: string; dist: number } {
  let best = { sym: DISPLAY_FRACS[0][1], dist: Math.abs(frac - DISPLAY_FRACS[0][0]) };
  for (const [v, s] of DISPLAY_FRACS) {
    const d = Math.abs(frac - v);
    if (d < best.dist) best = { sym: s, dist: d };
  }
  return best;
}

// Ingredientes que solo existen en unidades enteras (no puedes usar ⅔ de huevo)
const WHOLE_ONLY_RE = /\b(huevos?|claras de huevo)\b/i;

function displayAmt(n: number, unit: string, ingredient?: string): string {
  if (n <= 0) return '0';

  // Huevos → siempre enteros (mínimo 1)
  if (ingredient && WHOLE_ONLY_RE.test(ingredient)) {
    return String(Math.max(1, Math.round(n)));
  }

  // Gramos → múltiplos de 5 (≥20g) o entero (<20g), mínimo 1
  if (unit === 'g') {
    const r = n >= 20 ? Math.round(n / 5) * 5 : Math.round(n);
    return String(Math.max(1, r));
  }

  // Rebanadas y latas → siempre enteras (mínimo 1)
  if (unit === 'reb' || unit === 'lata') {
    return String(Math.max(1, Math.round(n)));
  }

  // Piezas y volumen (tz, cda, cdita) → permite fracciones sin mínimo duro
  const whole = Math.floor(n);
  const frac  = n - whole;

  if (frac < 0.15)  return String(whole || 1);   // fracción despreciable → entero
  if (frac > 0.85)  return String(whole + 1);     // casi entero → redondear arriba

  const { sym, dist } = bestFrac(frac);
  if (dist > 0.13) {
    // Fracción no cae cerca de ninguna estándar → decimal con 1 cifra
    const rounded = Math.round(n * 10) / 10;
    return rounded.toFixed(1).replace(/\.0$/, '');
  }
  return whole > 0 ? `${whole} ${sym}` : sym;
}

// ── Regex ────────────────────────────────────────────────────────────────────
const AMT_PAT   = '((?:\\d+\\s*)?[½⅓¼¾⅔⅙⅜]|\\d+(?:\\.\\d+)?(?:/\\d+)?)';
const UNIT_FULL = '(g|gr|tz|tazas?|pz|piezas?|cdas?|cditas?|cucharadas?|cucharaditas?|rebanadas?|reb|latas?)';
const NORM_UNIT: Record<string, string> = {
  'taza': 'tz', 'tazas': 'tz', 'tz': 'tz',
  'pieza': 'pz', 'piezas': 'pz', 'pz': 'pz',
  'cda': 'cda', 'cdas': 'cda', 'cucharada': 'cda', 'cucharadas': 'cda',
  'cdita': 'cdita', 'cditas': 'cdita', 'cucharadita': 'cdita', 'cucharaditas': 'cdita',
  'rebanada': 'reb', 'rebanadas': 'reb', 'reb': 'reb',
  'lata': 'lata', 'latas': 'lata',
  'g': 'g', 'gr': 'g',
};
const RE_QTY_UNIT = new RegExp(`^${AMT_PAT}\\s+${UNIT_FULL}\\s+(.+)$`, 'i');
const RE_QTY_ING  = new RegExp(`^${AMT_PAT}\\s+(.+)$`);

/** Escala un string de porción individual. Devuelve el original si no tiene cantidad. */
function scaleSingle(raw: string, factor: number): string {
  const s = raw.trim();
  if (!s) return s;

  // "Label: contenido" — escalar solo el contenido
  const labelMatch = s.match(/^([^:]+):\s+(.+)$/);
  if (labelMatch) return `${labelMatch[1]}: ${scaleSingle(labelMatch[2], factor)}`;

  // Compuesto con " + "
  if (s.includes(' + ')) {
    return s.split(' + ').map(p => scaleSingle(p.trim(), factor)).join(' + ');
  }

  // Lista con comas (ej: "1 pz papa, 2 pz tomate, ½ cebolla")
  if (s.includes(',')) {
    return s.split(',').map(p => scaleSingle(p.trim(), factor)).join(', ');
  }

  // {cantidad} {unidad} {ingrediente}
  const m = s.match(RE_QTY_UNIT);
  if (m) {
    const qty  = parseAmt(m[1]);
    const unit = NORM_UNIT[m[2].toLowerCase()] ?? m[2];
    const rest = m[3].trim();
    if (qty > 0) return `${displayAmt(qty * factor, unit, rest)} ${unit} ${rest}`;
  }

  // {cantidad} {ingrediente} — unidad implícita pz
  const m2 = s.match(RE_QTY_ING);
  if (m2) {
    const qty  = parseAmt(m2[1]);
    const rest = m2[2].trim();
    // Evitar re-parsear si "rest" empieza con una unidad (doble-match)
    if (qty > 0 && !/^(g|tz|pz|cda|cdita|reb)\b/i.test(rest)) {
      return `${displayAmt(qty * factor, 'pz', rest)} ${rest}`;
    }
  }

  // Sin cantidad → guarnición / descriptor → sin cambio
  return s;
}

/**
 * Devuelve una copia de `plan` con todas las cantidades de porciones
 * escaladas para que cada día alcance exactamente `targetKcal`.
 *
 * - Cada día se escala de manera independiente.
 * - Factor acotado a [0.40 – 2.50] para evitar distorsiones extremas.
 * - Días con base < 400 kcal (fallo de parseo) se dejan sin cambio.
 */
/**
 * Factor de escala de un día (misma regla que scalePlan) — para escalar el
 * desglose estructurado del platillo a la meta del usuario, coherente con las
 * porciones de texto ya escaladas. Devuelve 1 si no aplica escala.
 */
export function dayScaleFactor(meals: DayPlan['meals'], targetKcal: number): number {
  const base = calcDayKcal(meals);
  if (base < 400 || targetKcal <= 0) return 1;
  const f = Math.max(0.40, Math.min(2.50, targetKcal / base));
  return Math.abs(f - 1) < 0.04 ? 1 : f;
}

export function scalePlan(plan: DayPlan[], targetKcal: number): DayPlan[] {
  return plan.map(day => {
    const base = calcDayKcal(day.meals);
    if (base < 400) return day;
    const factor = Math.max(0.40, Math.min(2.50, targetKcal / base));
    if (Math.abs(factor - 1) < 0.04) return day; // ya está dentro del 4 %
    return {
      ...day,
      meals: day.meals.map(meal => ({
        ...meal,
        portions: meal.portions.map(p => scaleSingle(p, factor)),
      })),
    };
  });
}
