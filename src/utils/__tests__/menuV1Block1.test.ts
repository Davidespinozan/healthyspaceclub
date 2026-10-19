import { describe, it, expect } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// MENÚ HSC V1 · BLOQUE 1 · correcciones sin decisión nueva de producto.
//   1 · `max_g` del banco es TECHO (CORRECCIONES-APP-HSC §3), nunca sube el máximo.
//   2 · copy de porciones: singular real de piezas; rebanadas solo para jamón de verdad.
//   3 · constantes alineadas con food_measures cuando hay una sola autoridad (arroz, jamón de pavo).
//   4 · umbrales de snacks (2200 / 2800) contra la MISMA base en ambos caminos: la meta diaria completa.
//   5 · `gen.source` = camino que produjo el plan.
//   6 · PLAN_ENGINE_VERSION 34: los planes v33 quedan STALE una vez, sin bucles.
// ─────────────────────────────────────────────────────────────────────────────
import { BANCO, type BancoIng } from '../../data/banco';
import {
  ingBounds, portionStr, buildWeeklyPlan, PLAN_ENGINE_VERSION, type PlanTarget,
} from '../planEngine';
import { planSourceTag } from '../planSource';
import { weeklyPlanCurrentness } from '../weeklyPlanState';
import ENGINE_SRC from '../planEngine.ts?raw';
import PLANNER_SRC from '../../components/WeeklyNutritionPlanner.tsx?raw';
import REGEN_SRC from '../useAutoRegenPlan.ts?raw';

const dish = (name: string) => { const d = BANCO.find((x) => x.nombre === name); if (!d) throw new Error(`sin platillo ${name}`); return d; };
const ingOf = (dishName: string, nv: string): BancoIng => { const i = dish(dishName).ings.find((x) => x.nv === nv); if (!i) throw new Error(`sin ${nv} en ${dishName}`); return i; };
const mk = (kcal: number): PlanTarget => ({ kcal, protG: Math.round((kcal * 0.3) / 4), fatG: Math.round((kcal * 0.27) / 9), carbG: Math.round((kcal * 0.43) / 4) });

describe('1 · max_g del banco es TECHO', () => {
  it.each([
    ['Tacos de Machaca', 'Machaca de res', 60],                                  // antes 116 g servidos
    ['Calabacitas con Jamón y Quesadillas', 'Calabacita en cuadritos', 200],      // antes 410 g
    ['Pasta con Verduras Asadas, Feta y Garbanzo', 'Queso feta', 60],             // antes 100+ g
    ['Bowl Griego de Pollo', 'Queso feta', 60],
  ])('%s · %s → techo ≤ %i g (y nunca por debajo de la receta base)', (d, nv, max) => {
    const ing = ingOf(d, nv);
    expect(ing.max).toBe(max);
    const { lo, hi } = ingBounds(ing);
    expect(hi).toBeLessThanOrEqual(max);
    expect(hi).toBeGreaterThanOrEqual(ing.g0);
    expect(lo).toBeLessThanOrEqual(hi);
  });

  it('en TODO el banco: techo ≤ max(max_g, g0) — max_g ya no puede subirlo', () => {
    const malos: string[] = [];
    for (const d of BANCO) for (const i of d.ings) {
      if (i.rol !== 'principal' || !i.a || !i.max) continue;
      const { hi } = ingBounds(i);
      if (hi > Math.max(i.max, i.g0) + 1e-9) malos.push(`${d.nombre} · ${i.nv}: ${hi} > ${i.max}`);
    }
    expect(malos).toEqual([]);
  });

  it('plan real: ningún ingrediente suelto se sirve por encima de su max_g (salvo redondeo a pieza entera)', () => {
    const byName = new Map(BANCO.map((d) => [d.nombre, d]));
    const malos: string[] = [];
    for (const kcal of [1450, 2200, 3000]) for (const seed of [7, 42]) {
      for (const day of buildWeeklyPlan(mk(kcal), { seed })) for (const m of day.meals) {
        const d = byName.get(m.name);
        if (!d || d.tipo === 'bloque') continue;              // bloques escalan por factor (fuera de este bloque)
        for (const g of m.ings ?? []) {
          const i = d.ings.find((x) => x.nv === g.nv && x.rol === 'principal');
          if (!i || !i.a || !i.max || g.g == null) continue;
          const tol = i.pu ? i.pu : 1;                          // huevo/tortilla redondean a pieza entera
          if (g.g > Math.max(i.max, i.g0) + tol) malos.push(`${kcal}/${seed} ${m.name} · ${i.nv} ${g.g} g > ${i.max}`);
        }
      }
    }
    expect(malos).toEqual([]);
  }, 60_000);
});

describe('2 · copy de porciones', () => {
  const ing = (o: Partial<BancoIng> & { nv: string }): BancoIng => ({ rol: 'principal', g0: 50, ...o });
  it('singular real con 1 pieza (antes «1 tortillas de maíz», «1 totopos horneados»)', () => {
    expect(portionStr(ing({ nv: 'Tortillas de maíz', pu: 30, un: 'tortilla' }), 30)).toBe('1 tortilla de maíz');
    expect(portionStr(ing({ nv: 'Tostadas horneadas', pu: 10, un: 'tostada' }), 10)).toBe('1 tostada horneada');
    expect(portionStr(ing({ nv: 'Totopos horneados', pu: 10, un: 'tostada' }), 10)).toBe('1 totopo horneado');
    expect(portionStr(ing({ nv: 'Huevos revueltos', pu: 44, un: 'huevo' }), 44)).toBe('1 huevo revuelto');
    expect(portionStr(ing({ nv: 'Dátiles', pu: 8.5, un: 'dátil' }), 8.5)).toBe('1 dátil');
    expect(portionStr(ing({ nv: 'Aceitunas verdes', pu: 3, un: 'aceituna' }), 3)).toBe('1 aceituna verde');
  });
  it('el plural no cambia', () => {
    expect(portionStr(ing({ nv: 'Tortillas de maíz', pu: 30, un: 'tortilla' }), 60)).toBe('2 tortillas de maíz');
    expect(portionStr(ing({ nv: 'Tostadas horneadas', pu: 10, un: 'tostada' }), 40)).toBe('4 tostadas horneadas');
    expect(portionStr(ing({ nv: 'Huevo', pu: 44, un: 'huevo' }), 88)).toBe('2 huevos');
  });
  it('«carne molida de pavo» NO es rebanada (antes «5 rebanadas de carne molida de pavo»)', () => {
    expect(portionStr(ing({ nv: 'Carne molida de pavo' }), 131)).toBe('130 g Carne molida de pavo')   // Bloque 4 · D3: múltiplo de 5;
  });
  it('jamón en cuadritos tampoco; el jamón real y el pavo en rebanadas sí', () => {
    expect(portionStr(ing({ nv: 'Jamón de pechuga de pavo en cuadritos' }), 109)).toBe('110 g Jamón de pechuga de pavo en cuadritos');
    expect(portionStr(ing({ nv: 'Jamón de pechuga de pavo' }), 64)).toBe('3 rebanadas de jamón de pechuga de pavo');
    expect(portionStr(ing({ nv: 'Pavo en rebanadas' }), 43)).toBe('2 rebanadas de pavo en rebanadas');
  });
});

describe('3 · constantes alineadas con food_measures (solo donde hay una única autoridad)', () => {
  it('arroz cocido: 188 g/taza (antes 158); todo arroz del banco es «Arroz cocido»', () => {
    expect(portionStr({ nv: 'Arroz blanco', rol: 'principal', g0: 150 }, 188)).toBe('1 taza de arroz blanco');
    expect(portionStr({ nv: 'Arroz blanco', rol: 'principal', g0: 150 }, 94)).toBe('½ taza de arroz blanco');
    expect(portionStr({ nv: 'Galletas de arroz', rol: 'principal', g0: 20 }, 20)).toBe('20 g Galletas de arroz');   // no es el grano
  });
  it('jamón de pavo: rebanada 21.33 g (pechuga de pavo); jamón serrano sin dato de catálogo conserva 30 g', () => {
    expect(portionStr({ nv: 'Jamón de pavo', rol: 'principal', g0: 42 }, 42)).toBe('2 rebanadas de jamón de pavo');
    expect(portionStr({ nv: 'Jamón serrano', rol: 'principal', g0: 30 }, 30)).toBe('30 g Jamón serrano')   // Bloque 4 · D2: sin fuente de catálogo/SMAE → gramos;
  });
  // MENÚ V1 · CAPA 4 · D1 cerró pasta / aceite / miel (antes se conservaban por fuentes en conflicto): ver menuV1Capa4.test.ts.
});

// 4 · umbrales de snacks (2200 / 2800): superado por CAPA 4 V1 — el plan semanal ya no usa umbrales de kcal para
// los snacks (ver menuV1Capa4.test.ts). Lo que sigue vigente de B1: los dos caminos aplican la MISMA lógica.
describe('4 · los dos caminos deciden los snacks igual (CAPA 4: sin umbrales de kcal)', () => {
  it('ni el motor de código ni el ensamblado de la IA evalúan 2200 / 2800 para el plan semanal', () => {
    const buildDaySrc = ENGINE_SRC.slice(ENGINE_SRC.indexOf('function buildDay('), ENGINE_SRC.indexOf('// Versión del motor de nutrición'));
    const assembleSrc = ENGINE_SRC.slice(ENGINE_SRC.indexOf('export function assembleFromSelection('), ENGINE_SRC.indexOf('export interface FixedMeal'));
    for (const src of [buildDaySrc, assembleSrc]) {
      expect(src).toContain('snackPlan(');
      expect(src).not.toMatch(/snacksPerSlot\(|gateDense\(|DENSE_SNACK_KCAL_THRESHOLD/);
    }
  });
});

describe('5 · gen.source', () => {
  it('ia → AI · codigo → CODE', () => {
    expect([planSourceTag('ia'), planSourceTag('codigo')]).toEqual(['AI', 'CODE']);
  });
  it('se persiste en los dos caminos que guardan un plan generado', () => {
    expect(PLANNER_SRC).toContain('source: planSourceTag(source) }');
    expect(REGEN_SRC).toContain('craving, shake, source: planSourceTag(source) }');
  });
});

describe('6 · PLAN_ENGINE_VERSION · regeneración una sola vez', () => {
  const macros = { proteinG: 148, fatG: 69, carbG: 315 };
  const plan = (engineVersion: number) => ({ days: [{}, {}, {}, {}, {}, {}, {}], engineVersion, gen: { kcal: 2473, protG: 148, fatG: 69, carbG: 315 } });
  const cur = (p: ReturnType<typeof plan>) => weeklyPlanCurrentness({ status: 'PRESCRIBED', planGoal: 2473, macros, weeklyPlan: p, currentVersion: PLAN_ENGINE_VERSION });
  it('≥ 34 (CAPA 4 la subió a 35)', () => { expect(PLAN_ENGINE_VERSION).toBeGreaterThanOrEqual(34); });
  it('un plan de la versión anterior queda STALE (se regenera)', () => { expect(cur(plan(PLAN_ENGINE_VERSION - 1))).toBe('STALE'); });
  it('el plan regenerado (versión actual, misma meta) queda ACTIVE → no hay bucle', () => { expect(cur(plan(PLAN_ENGINE_VERSION))).toBe('ACTIVE'); });
});
