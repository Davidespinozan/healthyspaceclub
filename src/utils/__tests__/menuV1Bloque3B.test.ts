import { describe, it, expect } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// MENÚ HSC V1 · BLOQUE 3B · integración SEGURA (D5). El modelo híbrido nuevo NO pasó el gate y vive en
// `wip/menu-v1-bloque3b`; aquí solo lo independiente de él:
//   1 · HALLAZGO-04: los 6 dulces de Cena dejan de ser elegibles como cena principal (siguen en el banco).
//   2 · campos del banco que reflejan datos existentes del CSV: sabor, sec, blq, multMaxCsv.
//   3 · catálogo de complementos derivado de los acompañamientos de Magaly.
//   4 · validación de restricciones de un complemento (misma autoridad que un platillo).
//   5 · diagnóstico interno INSUFFICIENT_MENU_CAPACITY (no cambia el plan).
//   + clasificación de estructura de receta (base del reporte de cobertura para Magaly).
// ─────────────────────────────────────────────────────────────────────────────
import { BANCO } from '../../data/banco';
import { buildWeeklyPlan, mainEligible, MENU_CAPACITY_KCAL_TOL, PROTEIN_SOFT_OVER, type PlanTarget } from '../planEngine';
import { COMPLEMENTS, compatibleComplements } from '../menuComplements';
import { dishStructure, isProteinSource } from '../recipeStructure';
import { validatePlan } from '../planIntegrity';
import { portionBoundsFor } from '../portionPlausibility';

const HALLAZGO_04 = [
  'Hot Cakes de Camote', 'Hot Cakes de Zanahoria', 'Crepas Dulces de Plátano y Cacahuate',
  'Overnight Oats de Mango y Coco', 'Overnight Oats de Zanahoria', 'Yogurt con Frutos Rojos y Almendras',
];
const dish = (n: string) => { const d = BANCO.find((x) => x.nombre === n); if (!d) throw new Error(n); return d; };
const mk = (kcal: number): PlanTarget => ({ kcal, protG: Math.round((kcal * 0.28) / 4), fatG: Math.round((kcal * 0.27) / 9), carbG: Math.round((kcal * 0.45) / 4) });

describe('1 · HALLAZGO-04', () => {
  it('exactamente los 6 dulces de Cena del CSV dejan de ser elegibles como cena; siguen en el banco', () => {
    const ineligible = BANCO.filter((d) => !mainEligible(d)).map((d) => d.nombre).sort();
    expect(ineligible).toEqual([...HALLAZGO_04].sort());
    for (const n of HALLAZGO_04) expect(dish(n).tiempo).toBe('Cena');
  });
  it('los dulces de Desayuno y los snacks siguen elegibles', () => {
    expect(BANCO.filter((d) => d.tiempo === 'Desayuno' && d.sabor === 'dulce').every(mainEligible)).toBe(true);
    expect(BANCO.filter((d) => d.tiempo === 'Snack').every(mainEligible)).toBe(true);
  });
  it('planes reales: ninguno de los 6 se sirve como cena', () => {
    const served = [1450, 2200, 3000].flatMap((k) => [7, 42].flatMap((seed) => buildWeeklyPlan(mk(k), { seed })))
      .flatMap((d) => d.meals).filter((m) => m.time === 'Cena' && HALLAZGO_04.includes(m.name));
    expect(served).toEqual([]);
  }, 60_000);
});

describe('2 · campos del banco = datos del CSV', () => {
  it('sabor en los 307 platillos; los dulces de Cena son exactamente HALLAZGO-04', () => {
    expect(BANCO).toHaveLength(307);
    expect(BANCO.every((d) => !!d.sabor)).toBe(true);
    expect(BANCO.filter((d) => d.tiempo === 'Cena' && d.sabor === 'dulce').map((d) => d.nombre).sort()).toEqual([...HALLAZGO_04].sort());
  });
  it('seccion=acompañamiento → sec:"a" (121), nota BLOQUE → blq (53), mult_max del CSV → multMaxCsv (solo bloques)', () => {
    expect(BANCO.flatMap((d) => d.ings).filter((i) => i.sec === 'a')).toHaveLength(121);
    expect(BANCO.flatMap((d) => d.ings).filter((i) => i.blq)).toHaveLength(53);
    const withMm = BANCO.filter((d) => d.multMaxCsv);
    expect(withMm).toHaveLength(32);
    expect(withMm.every((d) => d.tipo === 'bloque')).toBe(true);
  });
});

describe('3 · catálogo de complementos', () => {
  it('cada complemento es un acompañamiento REAL del banco, de carbohidrato y no fruta', () => {
    expect(COMPLEMENTS.length).toBeGreaterThan(0);
    for (const c of COMPLEMENTS) {
      expect(BANCO.some((d) => d.ings.some((i) => i.nv === c.ing.nv && i.sec === 'a' && i.rol === 'principal')), c.ing.nv).toBe(true);
      expect(['berries', 'grapes', 'cutFruit', 'wholeFruit']).not.toContain(portionBoundsFor(c.ing.nv)?.family ?? '');
      const a = c.ing.a!;
      expect(4 * a[3] > 4 * a[1] && 4 * a[3] > 9 * a[2], c.ing.nv).toBe(true);
    }
  });
  it('compatibilidad coherente: más del mismo almidón; ninguno si el almidón no está en el catálogo', () => {
    const names = (n: string) => compatibleComplements(dish(n), dish(n).tiempo).map((c) => c.ing.nv);
    expect(names('Tacos de Carne Asada')).toEqual(['Tortilla de maíz']);
    expect(names('Salmón Bowl')).toEqual(['Arroz blanco']);
    expect(names('Pasta con Verduras Asadas, Feta y Garbanzo')).toEqual([]);
    expect(names('Arepas de Reina Pepiada')).toEqual([]);     // la arepa (sub-receta de masa) es su almidón
  });
});

describe('4 · validación de restricciones de un complemento', () => {
  const planWith = (nv: string, time = 'Cena') => ({
    days: Array.from({ length: 7 }, (_, i) => ({ day: i + 1, theme: '', meals: [{
      time, name: time === 'Desayuno' ? 'Huevo a la Mexicana' : 'Tacos de Carne Asada', desc: '', portions: [],
      ings: [{ nv, g: 60, rol: 'complemento' }],
    }] })),
  });
  it('un complemento compatible y permitido pasa', () => {
    expect(validatePlan(planWith('Tortilla de maíz'), []).violations).toEqual([]);
  });
  it('pan con gluten permanente → restriction; semanal → preference', () => {
    const plan = planWith('Pan tostado', 'Desayuno');
    expect(validatePlan(plan, { strict: ['gluten'], soft: [] }).violations.some((v) => v.kind === 'restriction' && v.dish === 'Pan tostado')).toBe(true);
    expect(validatePlan(plan, { strict: [], soft: ['gluten'] }).violations.some((v) => v.kind === 'preference' && v.dish === 'Pan tostado')).toBe(true);
  });
  it('fuera del catálogo → unknown-dish (falla cerrado); en un tiempo donde no se sirve → time', () => {
    expect(validatePlan(planWith('Pastel de chocolate'), []).violations.some((v) => v.kind === 'unknown-dish')).toBe(true);
    expect(validatePlan(planWith('Arroz blanco', 'Desayuno'), []).violations.some((v) => v.kind === 'time' && v.dish === 'Arroz blanco')).toBe(true);
  });
});

describe('5 · INSUFFICIENT_MENU_CAPACITY (diagnóstico, no cambia el plan)', () => {
  it('umbrales provisionales: energía ±5 %, proteína > meta +10 %', () => {
    expect([MENU_CAPACITY_KCAL_TOL, PROTEIN_SOFT_OVER]).toEqual([0.05, 0.10]);
  });
  it('meta normal: sin diagnóstico', () => {
    expect(buildWeeklyPlan(mk(2200), { seed: 7 }).filter((d) => d.capacity)).toEqual([]);
  }, 60_000);
  it('meta alta con restricciones pesadas: se registra con meta, alcanzado, hueco, motivo, restricciones y banco compatible', () => {
    const t = { kcal: 3983, protG: 152, fatG: 111, carbG: 594 };
    const days = buildWeeklyPlan(t, { seed: 7, avoid: { strict: ['lacteos', 'gluten', 'huevo'], soft: [] } });
    const caps = days.map((d) => d.capacity).filter((c): c is NonNullable<typeof c> => !!c);
    expect(caps.length).toBeGreaterThan(0);
    for (const c of caps) {
      expect(c.status).toBe('INSUFFICIENT_MENU_CAPACITY');
      expect(c.target).toEqual([3983, 152, 111, 594]);
      expect(c.gap).toEqual(c.target.map((x, i) => x - c.reached[i]));
      expect(c.reasons.length).toBeGreaterThan(0);
      expect(c.restrictions.strict).toEqual(['lacteos', 'gluten', 'huevo']);
      expect(c.poolSize.Comida).toBeGreaterThan(0);
    }
  }, 60_000);
});

describe('clasificación de estructura de receta (para el reporte de cobertura)', () => {
  const cls = (n: string) => Object.fromEntries([...dishStructure(dish(n)).classes].filter(([i]) => i.rol === 'principal').map(([i, c]) => [i.nv, c]));
  it('salmón + arroz: la proteína es núcleo y el arroz un acompañamiento flexible', () => {
    expect(cls('Salmón Bowl')).toMatchObject({ 'Salmón a la plancha': 'CORE_RECIPE', 'Arroz blanco': 'FLEXIBLE_SIDE' });
    expect(isProteinSource(dish('Salmón Bowl').ings.find((i) => i.nv === 'Salmón a la plancha')!)).toBe(true);   // dominante en grasa, aun así proteína
  });
  it('pasta integrada: todo es núcleo; yakimeshi y camote relleno también', () => {
    expect(Object.values(cls('Pasta Cremosa con Pollo y Brócoli')).every((c) => c === 'CORE_RECIPE')).toBe(true);
    expect(cls('Yakimeshi de Pollo')['Arroz blanco']).toBe('CORE_RECIPE');
    expect(cls('Camote Relleno de Carne Molida')['Camote horneado']).toBe('CORE_RECIPE');
  });
  it('acompañamiento marcado por Magaly → flexible; tortilla de tacos → núcleo', () => {
    expect(cls('Pollo en Salsa de Champiñones')['Papas al horno']).toBe('FLEXIBLE_SIDE');
    expect(cls('Tacos de Carne Asada')['Tortilla de maíz']).toBe('CORE_RECIPE');
  });
  it('sin evidencia suficiente → AMBIGUOUS (no se inventa)', () => {
    const amb = BANCO.filter((d) => d.tiempo !== 'Snack' && dishStructure(d).ambiguous);
    expect(amb.length).toBeLessThan(5);
    for (const d of amb) expect(dishStructure(d).ambiguous).toMatch(/sin fuente de proteína/);
  });
});
