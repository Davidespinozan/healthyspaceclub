/**
 * Equivalentes SME por plato — planA (3 000 kcal)
 *
 * Grupos:  🥩 AOA (Proteínas)  🌾 Cereales  🫘 Leguminosas
 *          🥛 Lácteos  🍎 Frutas  🫒 Grasas  🥬 Verduras (libre)
 *
 * Referencia base (1 equiv):
 *   🥩 30g proteína animal | huevo 1 pz | queso panela 40g | queso mozz/oax 30g
 *   🌾 ⅓ tz arroz | 1 tortilla | 1 reb pan integral | ½ papa med | ⅓ tz pasta/fideos | ¼ tz avena cruda
 *   🫘 ½ tz frijoles/garbanzos/lentejas | ¼ tz tofu firme (50g)
 *   🥛 1 tz leche | ¾ tz yogur natural | ½ tz yogur griego
 *   🍎 1 manzana | 1 pera | 1 naranja | ½ plátano | ½ tz mango | 1 tz fresas/papaya/sandía
 *   🫒 ⅓ pz aguacate | 1 cdita aceite | 1 cda mayonesa
 */

const equivData: Record<string, string[]> = {
  // ── DÍA 1 — Mexicana ──────────────────────────────────────
  'planA-1-desayuno': ['🥩 ×3.5', '🌾 ×2',   '🫒 ×2',   '🥬 libre'],
  'planA-1-comida':   ['🥩 ×7.5', '🌾 ×6',   '🥬 libre'],
  'planA-1-cena':     ['🥩 ×4',   '🌾 ×2',   '🫒 ×1',   '🥬 libre'],

  // ── DÍA 2 ──────────────────────────────────────────────────
  'planA-2-desayuno': ['🥩 ×10',  '🌾 ×4',   '🍎 ×1',   '🥬 libre'],
  'planA-2-comida':   ['🥩 ×6.5', '🌾 ×9',   '🥬 libre'],
  'planA-2-cena':     ['🥩 ×2.5', '🌾 ×3',   '🫘 ×1',   '🥬 libre'],

  // ── DÍA 3 ──────────────────────────────────────────────────
  'planA-3-desayuno': ['🥩 ×4.5', '🌾 ×4',   '🫒 ×1.5', '🍎 ×1',   '🥬 libre'],
  'planA-3-comida':   ['🥩 ×5.5', '🌾 ×4',   '🥬 libre'],
  'planA-3-cena':     ['🥩 ×3',   '🌾 ×4',   '🫘 ×1',   '🥬 libre'],

  // ── DÍA 4 ──────────────────────────────────────────────────
  'planA-4-desayuno': ['🥩 ×6',   '🌾 ×1',   '🫘 ×1.5', '🫒 ×1.5', '🥬 libre'],
  'planA-4-comida':   ['🥩 ×7.5', '🌾 ×9',   '🥬 libre'],
  'planA-4-cena':     ['🥩 ×4',   '🌾 ×2',   '🥬 libre'],

  // ── DÍA 5 ──────────────────────────────────────────────────
  'planA-5-desayuno': ['🥩 ×5',   '🌾 ×4',   '🫘 ×1.5', '🥬 libre'],
  'planA-5-comida':   ['🥩 ×7.5', '🌾 ×2',   '🫒 ×1',   '🥬 libre'],
  'planA-5-cena':     ['🥩 ×8',   '🌾 ×4',   '🫒 ×2',   '🥬 libre'],

  // ── DÍA 6 ──────────────────────────────────────────────────
  'planA-6-desayuno': ['🥩 ×4',   '🥛 ×1.5', '🌾 ×1',   '🍎 ×1.5'],
  'planA-6-comida':   ['🥩 ×9',   '🌾 ×9',   '🥬 libre'],
  'planA-6-cena':     ['🥩 ×6',   '🌾 ×4',   '🥬 libre'],

  // ── DÍA 7 ──────────────────────────────────────────────────
  'planA-7-desayuno': ['🥩 ×4.5', '🌾 ×4',   '🥬 libre'],
  'planA-7-comida':   ['🥩 ×6.5', '🌾 ×6',   '🥬 libre'],
  'planA-7-cena':     ['🥩 ×8',   '🌾 ×8',   '🫒 ×1',   '🥬 libre'],

  // ── DÍA 8 — Japonesa ───────────────────────────────────────
  'planA-8-desayuno': ['🥛 ×1.5', '🍎 ×3',   '🌾 ×0.5'],
  'planA-8-comida':   ['🥩 ×6.5', '🌾 ×6',   '🫘 ×1',   '🥬 libre'],
  'planA-8-cena':     ['🫘 ×3.5', '🌾 ×6',   '🥬 libre'],

  // ── DÍA 9 ──────────────────────────────────────────────────
  'planA-9-desayuno': ['🥩 ×5',   '🌾 ×2',   '🫒 ×1',   '🍎 ×0.5', '🥬 libre'],
  'planA-9-comida':   ['🥩 ×6.5', '🌾 ×6',   '🫒 ×2',   '🥬 libre'],
  'planA-9-cena':     ['🫘 ×4',   '🌾 ×6',   '🥬 libre'],

  // ── DÍA 10 ─────────────────────────────────────────────────
  'planA-10-desayuno': ['🥩 ×5',   '🥛 ×2',  '🌾 ×4',   '🍎 ×1',   '🫒 ×1'],
  'planA-10-comida':   ['🥩 ×8.5', '🌾 ×9',  '🥬 libre'],
  'planA-10-cena':     ['🥩 ×6.5', '🌾 ×3',  '🥬 libre'],

  // ── DÍA 11 ─────────────────────────────────────────────────
  'planA-11-desayuno': ['🥩 ×3',   '🌾 ×8',  '🥛 ×0.5'],
  'planA-11-comida':   ['🥩 ×6',   '🌾 ×5',  '🫒 ×1',   '🥬 libre'],
  'planA-11-cena':     ['🥩 ×4',   '🌾 ×3',  '🥛 ×0.5', '🥬 libre'],

  // ── DÍA 12 ─────────────────────────────────────────────────
  'planA-12-desayuno': ['🥩 ×3',   '🌾 ×6',  '🥛 ×1'],
  'planA-12-comida':   ['🥩 ×6',   '🌾 ×6.5','🫒 ×1',   '🥬 libre'],
  'planA-12-cena':     ['🥩 ×7.5', '🌾 ×6',  '🫒 ×1',   '🥬 libre'],

  // ── DÍA 13 ─────────────────────────────────────────────────
  'planA-13-desayuno': ['🥩 ×2',   '🥛 ×1',  '🍎 ×2',   '🫒 ×1'],
  'planA-13-comida':   ['🥩 ×6',   '🌾 ×4',  '🥬 libre'],
  'planA-13-cena':     ['🥩 ×6',   '🌾 ×6',  '🥬 libre'],

  // ── DÍA 14 ─────────────────────────────────────────────────
  'planA-14-desayuno': ['🥩 ×4.5', '🌾 ×3',  '🥛 ×1',   '🫒 ×1',   '🥬 libre'],
  'planA-14-comida':   ['🥩 ×6.5', '🌾 ×6',  '🥬 libre'],
  'planA-14-cena':     ['🥩 ×6.5', '🌾 ×6',  '🫒 ×1',   '🥬 libre'],

  // ── DÍA 15 — Italiana ──────────────────────────────────────
  'planA-15-desayuno': ['🥩 ×2',   '🌾 ×4',  '🍎 ×1'],
  'planA-15-comida':   ['🥩 ×6',   '🌾 ×6',  '🫘 ×2',   '🥬 libre'],
  'planA-15-cena':     ['🥩 ×3',   '🌾 ×6',  '🫘 ×2',   '🥬 libre'],

  // ── DÍA 16 ─────────────────────────────────────────────────
  'planA-16-desayuno': ['🥩 ×6.5', '🌾 ×3',  '🫒 ×1',   '🥬 libre'],
  'planA-16-comida':   ['🥩 ×6.5', '🌾 ×9',  '🫒 ×1',   '🥬 libre'],
  'planA-16-cena':     ['🥩 ×6.5', '🌾 ×2',  '🥬 libre'],

  // ── DÍA 17 ─────────────────────────────────────────────────
  'planA-17-desayuno': ['🥩 ×3',   '🌾 ×2',  '🫒 ×1',   '🍎 ×1'],
  'planA-17-comida':   ['🥩 ×8',   '🌾 ×9',  '🫘 ×1',   '🥬 libre'],
  'planA-17-cena':     ['🥩 ×6.5', '🌾 ×3.5','🫒 ×1.5', '🥬 libre'],

  // ── DÍA 18 ─────────────────────────────────────────────────
  'planA-18-desayuno': ['🥛 ×2',   '🌾 ×7',  '🍎 ×1'],
  'planA-18-comida':   ['🥩 ×7',   '🥬 libre'],
  'planA-18-cena':     ['🥩 ×5',   '🌾 ×6',  '🥬 libre'],

  // ── DÍA 19 ─────────────────────────────────────────────────
  'planA-19-desayuno': ['🥩 ×2',   '🥛 ×2',  '🌾 ×2.5', '🍎 ×0.5'],
  'planA-19-comida':   ['🥩 ×6',   '🌾 ×3',  '🫘 ×2',   '🥬 libre'],
  'planA-19-cena':     ['🥩 ×3.5', '🌾 ×4',  '🫒 ×1',   '🍎 ×1',   '🥬 libre'],

  // ── DÍA 20 ─────────────────────────────────────────────────
  'planA-20-desayuno': ['🥩 ×3',   '🌾 ×3',  '🥛 ×1.5', '🍎 ×1',   '🫒 ×1'],
  'planA-20-comida':   ['🥩 ×6.5', '🌾 ×6',  '🥬 libre'],
  'planA-20-cena':     ['🥩 ×7',   '🌾 ×4',  '🥬 libre'],

  // ── DÍA 21 ─────────────────────────────────────────────────
  'planA-21-desayuno': ['🥩 ×1.5', '🌾 ×4',  '🍎 ×1'],
  'planA-21-comida':   ['🥩 ×6',   '🌾 ×4',  '🥬 libre'],
  'planA-21-cena':     ['🥩 ×7',   '🌾 ×4.5','🥬 libre'],

  // ── DÍA 22 — Americana ─────────────────────────────────────
  'planA-22-desayuno': ['🥩 ×3',   '🌾 ×4',  '🥛 ×2',   '🍎 ×1'],
  'planA-22-comida':   ['🥩 ×6',   '🌾 ×5',  '🫒 ×1',   '🥬 libre'],
  'planA-22-cena':     ['🥩 ×5',   '🌾 ×3.5','🫒 ×1.5', '🥬 libre'],

  // ── DÍA 23 ─────────────────────────────────────────────────
  'planA-23-desayuno': ['🥩 ×1.5', '🌾 ×2',  '🥬 libre'],
  'planA-23-comida':   ['🥩 ×5',   '🌾 ×6',  '🫘 ×1',   '🫒 ×1',   '🥬 libre'],
  'planA-23-cena':     ['🥩 ×6',   '🌾 ×3',  '🥬 libre'],

  // ── DÍA 24 ─────────────────────────────────────────────────
  'planA-24-desayuno': ['🥩 ×3',   '🌾 ×2',  '🫒 ×1',   '🥬 libre'],
  'planA-24-comida':   ['🥩 ×7',   '🫒 ×1',  '🥬 libre'],
  'planA-24-cena':     ['🥩 ×5',   '🌾 ×7',  '🫘 ×1',   '🥬 libre'],

  // ── DÍA 25 ─────────────────────────────────────────────────
  'planA-25-desayuno': ['🥩 ×4.5', '🌾 ×2',  '🍎 ×0.5'],
  'planA-25-comida':   ['🥩 ×5',   '🌾 ×6',  '🫒 ×1.5', '🥬 libre'],
  'planA-25-cena':     ['🥩 ×5',   '🌾 ×3.5','🥬 libre'],

  // ── DÍA 26 ─────────────────────────────────────────────────
  'planA-26-desayuno': ['🥩 ×3.5', '🌾 ×2',  '🫒 ×1',   '🍎 ×1',   '🥬 libre'],
  'planA-26-comida':   ['🥩 ×6',   '🌾 ×4',  '🥬 libre'],
  'planA-26-cena':     ['🥩 ×4',   '🌾 ×6',  '🫒 ×2',   '🥬 libre'],

  // ── DÍA 27 ─────────────────────────────────────────────────
  'planA-27-desayuno': ['🥛 ×2',   '🍎 ×1',  '🌾 ×0.5', '🫒 ×1'],
  'planA-27-comida':   ['🥩 ×5',   '🌾 ×6',  '🫒 ×1',   '🥬 libre'],
  'planA-27-cena':     ['🥩 ×5',   '🌾 ×2',  '🫒 ×2',   '🥬 libre'],

  // ── DÍA 28 ─────────────────────────────────────────────────
  'planA-28-desayuno': ['🌾 ×4',   '🍎 ×1',  '🫒 ×1'],
  'planA-28-comida':   ['🥩 ×6',   '🌾 ×3',  '🥬 libre'],
  'planA-28-cena':     ['🥩 ×6',   '🌾 ×6',  '🥬 libre'],

  // ═══ SNACKS ═══════════════════════════════════════════════

  // DÍA 1
  'planA-1-snackam':  ['🌾 ×2',   '🫒 ×1',  '🍎 ×4'],
  'planA-1-snackpm':  ['🥛 ×2.5', '🌾 ×4',  '🍎 ×1'],
  // DÍA 2
  'planA-2-snackam':  ['🥛 ×0.5', '🍎 ×2'],
  'planA-2-snackpm':  ['🫒 ×1'],
  // DÍA 3
  'planA-3-snackam':  ['🥩 ×1.5', '🌾 ×2',  '🫒 ×1',  '🥬 libre'],
  'planA-3-snackpm':  ['🍎 ×2',   '🥬 libre'],
  // DÍA 4
  'planA-4-snackam':  ['🍎 ×1',   '🫒 ×1'],
  'planA-4-snackpm':  ['🫒 ×1',   '🥬 libre'],
  // DÍA 5
  'planA-5-snackam':  ['🍎 ×2'],
  'planA-5-snackpm':  ['🌾 ×1'],
  // DÍA 6
  'planA-6-snackam':  ['🥩 ×1.5'],
  'planA-6-snackpm':  ['🫒 ×1',   '🍎 ×2'],
  // DÍA 7
  'planA-7-snackam':  ['🍎 ×1'],
  'planA-7-snackpm':  ['🫒 ×1.5'],
  // DÍA 8
  'planA-8-snackam':  ['🫘 ×1'],
  'planA-8-snackpm':  ['🌾 ×2'],
  // DÍA 9
  'planA-9-snackam':  ['🫒 ×1',   '🍎 ×2'],
  'planA-9-snackpm':  ['🍎 ×1'],
  // DÍA 10
  'planA-10-snackam': ['🌾 ×3',   '🫒 ×2',  '🍎 ×2'],
  'planA-10-snackpm': ['🌾 ×4'],
  // DÍA 11
  'planA-11-snackam': ['🍎 ×1',   '🥬 libre'],
  'planA-11-snackpm': ['🌾 ×2',   '🫒 ×1',  '🍎 ×2'],
  // DÍA 12
  'planA-12-snackam': ['🫘 ×1'],
  'planA-12-snackpm': ['🍎 ×2'],
  // DÍA 13
  'planA-13-snackam': ['🥬 libre'],
  'planA-13-snackpm': ['🥛 ×1',   '🌾 ×2'],
  // DÍA 14
  'planA-14-snackam': ['🍎 ×2'],
  'planA-14-snackpm': ['🌾 ×2',   '🫒 ×0.5'],
  // DÍA 15
  'planA-15-snackam': ['🥬 libre'],
  'planA-15-snackpm': ['🫒 ×1',   '🍎 ×2'],
  // DÍA 16
  'planA-16-snackam': ['🫒 ×1.5', '🍎 ×3'],
  'planA-16-snackpm': ['🌾 ×4',   '🫒 ×3'],
  // DÍA 17
  'planA-17-snackam': ['🫒 ×1',   '🍎 ×2'],
  'planA-17-snackpm': ['🥛 ×0.5', '🫒 ×0.5'],
  // DÍA 18
  'planA-18-snackam': ['🫒 ×0.5', '🥬 libre'],
  'planA-18-snackpm': ['🍎 ×2'],
  // DÍA 19
  'planA-19-snackam': ['🫒 ×1'],
  'planA-19-snackpm': ['🫒 ×1',   '🍎 ×1'],
  // DÍA 20
  'planA-20-snackam': ['🫒 ×0.5', '🍎 ×1',  '🥬 libre'],
  'planA-20-snackpm': ['🌾 ×2',   '🥛 ×1',  '🫒 ×2'],
  // DÍA 21
  'planA-21-snackam': ['🫘 ×2',   '🥬 libre'],
  'planA-21-snackpm': ['🥛 ×1',   '🫒 ×2.5','🍎 ×1'],
  // DÍA 22
  'planA-22-snackam': ['🌾 ×2',   '🫒 ×2',  '🍎 ×2'],
  'planA-22-snackpm': ['🌾 ×2'],
  // DÍA 23
  'planA-23-snackam': ['🫒 ×1',   '🍎 ×2'],
  'planA-23-snackpm': ['🥛 ×1',   '🫒 ×1',  '🍎 ×1'],
  // DÍA 24
  'planA-24-snackam': ['🥛 ×0.5', '🌾 ×2',  '🍎 ×2'],
  'planA-24-snackpm': ['🌾 ×1',   '🫒 ×0.5','🍎 ×2'],
  // DÍA 25
  'planA-25-snackam': ['🌾 ×2'],
  'planA-25-snackpm': ['🍎 ×2'],
  // DÍA 26
  'planA-26-snackam': ['🫒 ×1',   '🍎 ×3'],
  'planA-26-snackpm': ['🫒 ×1',   '🍎 ×0.5'],
  // DÍA 27
  'planA-27-snackam': ['🫒 ×1',   '🍎 ×2'],
  'planA-27-snackpm': ['🌾 ×1',   '🫒 ×0.5','🍎 ×0.5'],
  // DÍA 28
  'planA-28-snackam': ['🫘 ×0.5', '🥬 libre'],
  'planA-28-snackpm': ['🫒 ×1',   '🍎 ×2'],
};

/** Devuelve los equivalentes SME de un plato dado el plan, día y franja horaria. */
export function getMealEquiv(planKey: string, day: number, timeStr: string): string[] | null {
  const lower = timeStr.toLowerCase();
  const slot = lower.includes('desayuno') ? 'desayuno'
    : lower.includes('comida') ? 'comida'
    : lower.includes('cena') ? 'cena'
    : lower.includes('snack am') ? 'snackam'
    : lower.includes('snack pm') ? 'snackpm'
    : null;
  if (!slot) return null;
  return equivData[`${planKey}-${day}-${slot}`] ?? null;
}
