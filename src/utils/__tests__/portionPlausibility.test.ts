import { describe, it, expect } from 'vitest';
import { portionBoundsFor, validatePortionPlausibility } from '../portionPlausibility';
import { buildWeeklyPlan, type PlanTarget } from '../planEngine';

// ─────────────────────────────────────────────────────────────────────────────
// NUTRITION-N1 · HUMAN PORTION PLAUSIBILITY.
// El solver ya no puede cerrar calorías con "2–3 tazas de fresas". Techo humano por familia consumido en
// ingBounds. Prioridad: plausibilidad humana > ajuste exacto de macros. No toca metas/macros/SHARE/allergy.
// ─────────────────────────────────────────────────────────────────────────────

// ── Unidad: la tabla de familias ────────────────────────────────────────────
describe('portionBoundsFor · familias y valores', () => {
  it('fruta (bandera): fresas acotadas, preferred < hard', () => {
    const b = portionBoundsFor('Fresas')!;
    expect(b.family).toBe('berries');
    expect(b.preferredMaxG).toBeLessThan(b.hardMaxG);
    expect(b.hardMaxG).toBeLessThanOrEqual(255);   // < 2 tazas (150 g/taza) → nunca "2 ½ tz"
  });
  it('familias energéticas densas acotadas', () => {
    expect(portionBoundsFor('Aceite de oliva')!.family).toBe('oil');
    expect(portionBoundsFor('Crema de cacahuate')!.family).toBe('nutButter');   // antes que "cacahuate"
    expect(portionBoundsFor('Almendras')!.family).toBe('nutsSeeds');
    expect(portionBoundsFor('Granola casera')!.family).toBe('granola');
    expect(portionBoundsFor('Miel de abeja')!.family).toBe('sweetener');
  });
  it('lácteos acotados', () => {
    expect(portionBoundsFor('Yogur griego')!.family).toBe('yogurt');
    expect(portionBoundsFor('Leche descremada')!.family).toBe('milk');
    expect(portionBoundsFor('Queso panela')!.family).toBe('cheese');
    // "leche de almendra/coco" es una BEBIDA (líquido) → familia milk, NO nueces (aunque diga "almendra").
    expect(portionBoundsFor('Leche de almendra')!.family).toBe('milk');
  });
  it('fruta entera por pieza acotada (plátano/manzana), pero NO plátano macho (almidón)', () => {
    expect(portionBoundsFor('Plátano')!.family).toBe('wholeFruit');
    expect(portionBoundsFor('Manzana verde')!.family).toBe('wholeFruit');
    expect(portionBoundsFor('Plátano macho')).toBeNull();   // almidón → lo rige GRAM_MAX existente
  });
  it('PROTEÍNAS y ALMIDONES no pertenecen a N1 (los rige ing.max/PIECE_MAX/GRAM_MAX)', () => {
    for (const nv of ['Pechuga de pollo', 'Res molida', 'Salmón', 'Huevo', 'Atún en agua', 'Tofu firme',
      'Arroz cocido', 'Papa cocida', 'Pasta integral', 'Tortilla de maíz', 'Frijol negro', 'Avena']) {
      expect(portionBoundsFor(nv)).toBeNull();
    }
  });
  it('validatePortionPlausibility: PASS / LARGE / HARD_FAIL', () => {
    expect(validatePortionPlausibility('Fresas', 150)).toBe('PASS');    // 1 taza
    expect(validatePortionPlausibility('Fresas', 230)).toBe('LARGE');   // ~1.5 taza
    expect(validatePortionPlausibility('Fresas', 375)).toBe('HARD_FAIL'); // 2.5 tazas (el bug)
    expect(validatePortionPlausibility('Pechuga de pollo', 450)).toBe('PASS'); // sin familia → no es N1
  });
  it('puro / determinista / no muta el input', () => {
    const nv = 'Fresas';
    expect(portionBoundsFor(nv)).toEqual(portionBoundsFor(nv));
    expect(nv).toBe('Fresas');
  });
});

// ── Integración: el plan generado nunca cruza un hardMax ─────────────────────
const MATRIX: PlanTarget[] = [1450, 1600, 1800, 2000, 2200, 2500, 2800, 3000, 3200, 3500].map(kcal => ({
  kcal,
  protG: Math.round(kcal * 0.25 / 4),
  fatG: Math.round(kcal * 0.28 / 9),
  carbG: Math.round(kcal * 0.47 / 4),
}));
const SEEDS = [7, 42, 99];

function everyIng(cb: (nv: string, g: number, kcal: number) => void, seed: number, T: PlanTarget) {
  for (const d of buildWeeklyPlan(T, { seed })) {
    for (const m of d.meals) {
      for (const ing of (m.ings ?? [])) {
        if (ing.g != null && ing.g > 0) cb(ing.nv, ing.g, T.kcal);
      }
    }
  }
}

describe('NUTRITION-N1 · invariante: ninguna porción cruza su hardMax humano', () => {
  it('AC/AD/AE/AF/AG · matriz completa de calorías × semillas → 0 HARD_FAIL', () => {
    const fails: string[] = [];
    for (const T of MATRIX) for (const seed of SEEDS) {
      everyIng((nv, g, kcal) => {
        if (validatePortionPlausibility(nv, g) === 'HARD_FAIL') fails.push(`${kcal}kcal/seed${seed}: ${nv}=${g}g`);
      }, seed, T);
    }
    expect(fails).toEqual([]);
  });

  it('AG · fresas/berries jamás alcanzan 2 tazas (≤ 255 g) en ningún perfil', () => {
    let maxBerries = 0;
    for (const T of MATRIX) for (const seed of SEEDS) {
      everyIng((nv, g) => { if (portionBoundsFor(nv)?.family === 'berries') maxBerries = Math.max(maxBerries, g); }, seed, T);
    }
    expect(maxBerries).toBeLessThanOrEqual(255);
  });

  it('J/K/L/N/O · aceite/nueces/lácteos/granola acotados en todo el rango', () => {
    const worst: Record<string, number> = {};
    for (const T of MATRIX) for (const seed of SEEDS) {
      everyIng((nv, g) => { const b = portionBoundsFor(nv); if (b) worst[b.family] = Math.max(worst[b.family] ?? 0, g); }, seed, T);
    }
    // Cada familia observada respeta su propio hardMax (traducido por portionBoundsFor).
    for (const [fam, g] of Object.entries(worst)) {
      // Reconstruye el hardMax representativo de la familia con un nombre canónico.
      const canon: Record<string, string> = { oil: 'aceite', nutsSeeds: 'almendra', nutButter: 'crema de cacahuate', granola: 'granola', yogurt: 'yogur', milk: 'leche', cheese: 'queso', berries: 'fresa', grapes: 'uva', cutFruit: 'mango', wholeFruit: 'plátano', sweetener: 'miel' };
      const hard = portionBoundsFor(canon[fam])!.hardMaxG;
      expect(g).toBeLessThanOrEqual(hard + 0.5);
    }
  });
});

// ── Regresión: los topes existentes de almidón/contable NO se aflojan ────────
describe('NUTRITION-N1 · regresión: PIECE_MAX/GRAM_MAX intactos', () => {
  it('P/Q/R/S · arroz ≤300 · papa ≤320 · pasta ≤280 en el plan (GRAM_MAX existente sin aflojar)', () => {
    // NOTA: `avena` la excluimos del assert — su GRAM_MAX (100 g seco) puede quedar por debajo de la RECETA
    // BASE (g0≈105 g cocida) y el guard `max(hi,g0)` la preserva; eso es comportamiento PREVIO a N1, no una
    // regresión. Verificamos los almidones cuyo tope holgado no choca con la base.
    const overflow: string[] = [];
    const cap: [RegExp, number][] = [
      [/arroz|quinoa/i, 300], [/papa|camote/i, 320], [/pasta|espagueti|fideo/i, 280],
    ];
    for (const T of MATRIX) for (const seed of SEEDS) {
      everyIng((nv, g) => {
        for (const [rx, gmax] of cap) if (rx.test(nv) && g > gmax + 0.5) overflow.push(`${nv}=${g}g>${gmax}`);
      }, seed, T);
    }
    expect(overflow).toEqual([]);
  });
});

// ── Determinismo del generador con la capa instalada ─────────────────────────
describe('NUTRITION-N1 · determinista + sin gramos inválidos', () => {
  it('W/X/U/V · misma semilla → mismo plan; sin NaN ni gramos negativos', () => {
    const T = MATRIX[3];
    const a = JSON.stringify(buildWeeklyPlan(T, { seed: 42 }));
    const b = JSON.stringify(buildWeeklyPlan(T, { seed: 42 }));
    expect(a).toBe(b);
    for (const d of buildWeeklyPlan(T, { seed: 42 })) for (const m of d.meals) for (const ing of (m.ings ?? [])) {
      if (ing.g != null) { expect(Number.isFinite(ing.g)).toBe(true); expect(ing.g).toBeGreaterThanOrEqual(0); }
    }
  });
});
