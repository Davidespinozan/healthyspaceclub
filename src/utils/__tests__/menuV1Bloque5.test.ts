import { describe, it, expect } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// MENÚ HSC V1 · BLOQUE 5 · FIDELIDAD DE RECETAS CERRADAS.
//   1 · Pasta con Verduras Asadas, Feta y Garbanzo = ficha cerrada, porción única (no se deforma).
//   2 · Rollitos = 6 rebanadas de pavo + 3 cdas de queso crema light + pepino/pimiento al gusto; sin nuez ni
//       aguacate. «Rollitos de Pavo, Queso Crema y Nuez» es otro producto y queda intacto.
//   3 · Bolitas 2 → 4 y barrita 1 → 2 (V1 final, Bloque 6 · D1): solo esas porciones; toda la masa escala junta.
//   4 · Recetas con decisión abierta (Avena, French Toast, Toast Ricotta y Fresa): sin cambios.
//   6 · RECIPE_CAPACITY_LIMIT: la receta cerrada no se deforma para cuadrar; se registra el hueco.
// ─────────────────────────────────────────────────────────────────────────────
import { BANCO } from '../../data/banco';
import { buildWeeklyPlan, solveSlot, closedRecipeMacros, recipeLimits, type PlanTarget } from '../planEngine';
import { tPortion } from '../nutritionI18n';
import type { DayPlan } from '../../types';

const dish = (n: string) => { const d = BANCO.find((x) => x.nombre === n); if (!d) throw new Error(n); return d; };
const PASTA = 'Pasta con Verduras Asadas, Feta y Garbanzo';
const ROLL = 'Rollitos de Jamón de Pavo con Queso';
const BOL_P = 'Bolitas de Avena, Dátil, Cacahuate y Chocolate';
const BOL_C = 'Bolitas de Dátil, Avena, Almendra y Coco';
const BARRA = 'Barrita de Avena, Nuez, Yogur y Miel';
const mk = (kcal: number): PlanTarget => ({ kcal, protG: Math.round((kcal * 0.28) / 4), fatG: Math.round((kcal * 0.27) / 9), carbG: Math.round((kcal * 0.45) / 4) });
const servedSolo = (n: string, kcal: number) => {
  const d = dish(n);
  const base = closedRecipeMacros(d, 'min');   // forma de la receta → metas proporcionales a ella
  const k = kcal / base[0];
  return solveSlot([d], 'Snack', [kcal, base[1] * k, base[2] * k, base[3] * k])[0];
};

describe('1 · Pasta con Verduras Asadas, Feta y Garbanzo', () => {
  it('banco = ficha cerrada (macros de pasta COCIDA del catálogo, no seca)', () => {
    const d = dish(PASTA);
    expect(d.cr).toBe(true);
    expect(d.steps).toEqual([1]);
    expect(d.ings.map((i) => [i.rol, i.nv, i.g0])).toEqual([
      ['principal', 'Pasta cocida', 150], ['principal', 'Garbanzos', 100], ['principal', 'Queso feta', 40],
      ['guarnicion', 'Verduras asadas (berenjena, calabacita, pimiento, cebolla morada, jitomate cherry)', 225],
      ['fijo', 'Aceite de oliva', 5],
      ['condimento', 'Limón', 0], ['condimento', 'Ajo', 3], ['condimento', 'Albahaca', 2], ['condimento', 'Pizca de sal', 1],
    ]);
    expect(d.ings[0].fid).toBe('pasta-cocida');
    expect(d.ings[0].a![0]).toBeLessThan(2);          // 1.3 kcal/g: cocida
    expect(d.ings[3].rg).toEqual([200, 250]);
  });
  it('el solver no la deforma: con cualquier meta se sirve EXACTA', () => {
    for (const kcal of [400, 588, 900]) {
      const m = solveSlot([dish(PASTA)], 'Comida', [kcal, 40, 25, 100])[0];
      expect(m.ings!.filter((i) => i.rol === 'principal').map((i) => i.g)).toEqual([150, 100, 40]);
      expect(m.portions).toEqual([
        '1¼ tazas de pasta cocida', '⅔ taza de garbanzos', '40 g Queso feta',
        '200–250 g de verduras asadas (berenjena, calabacita, pimiento, cebolla morada, jitomate cherry)',
        '1 cdita de aceite de oliva', 'Limón al gusto', 'Ajo al gusto', 'Albahaca al gusto', 'Pizca de sal',
      ]);
    }
  });
});

describe('2 · Rollitos', () => {
  it('banco = ficha cerrada: 6 rebanadas de pavo + 3 cdas de queso crema light, sin nuez ni aguacate', () => {
    const d = dish(ROLL);
    expect(d.ings.map((i) => [i.rol, i.nv, i.g0])).toEqual([
      ['principal', 'Jamón de pechuga de pavo', 128], ['principal', 'Queso crema light', 45],
      ['guarnicion', 'Pepino y pimiento en tiras', 0], ['condimento', 'Condimentos', 0],
    ]);
    const m = solveSlot([d], 'Snack', [600, 60, 20, 20])[0];
    expect(m.portions).toEqual(['6 rebanadas de jamón de pechuga de pavo', '3 cdas de queso crema light', 'Pepino y pimiento en tiras al gusto', 'Condimentos al gusto']);
    expect(m.ings!.some((i) => /nuez|nueces|aguacate/i.test(i.nv))).toBe(false);
  });
  it('«Rollitos de Pavo, Queso Crema y Nuez» es OTRO producto (snack denso): intacto', () => {
    const d = dish('Rollitos de Pavo, Queso Crema y Nuez');
    expect(d.cr).toBeUndefined();
    expect(d.ings.map((i) => [i.nv, i.g0])).toEqual([['Jamón de pavo', 120], ['Queso crema light', 60], ['Nueces', 30], ['Aguacate', 70], ['Verduras (espinaca, pepino)', 50], ['Pimienta', 1]]);
  });
});

describe('3 · bolitas 2 → 4 · barrita 1 → 2 (V1 final)', () => {
  it('porciones válidas y unidad', () => {
    for (const n of [BOL_P, BOL_C]) expect([dish(n).steps, dish(n).srv]).toEqual([[0.5, 1], { unit: 'bolita', base: 4 }]);
    expect([dish(BARRA).steps, dish(BARRA).srv]).toEqual([[0.5, 1], { unit: 'barrita', base: 2 }]);
  });
  it('toda la masa escala JUNTA (antes chocolate/chía/coco/miel/crema quedaban fijos)', () => {
    for (const n of [BOL_P, BOL_C, BARRA]) {
      expect(dish(n).ings.every((i) => i.rol === 'principal'), n).toBe(true);
      const d = dish(n);
      const m = servedSolo(n, closedRecipeMacros(d, 'min')[0]);
      const f = d.ings.map((i) => (m.ings!.find((x) => x.nv === i.nv)!.g as number) / i.g0);
      for (const x of f) expect(x, `${n}: ${f}`).toBeCloseTo(0.5, 1);
    }
  });
  it('el solver solo sirve porciones válidas: nunca 3 ni 5 bolitas, nunca fracciones', () => {
    for (const n of [BOL_P, BOL_C, BARRA]) {
      const d = dish(n);
      for (let kcal = 150; kcal <= 1200; kcal += 25) {
        const m = servedSolo(n, kcal);
        const valid = d.srv!.unit === 'bolita' ? ['2 bolitas', '4 bolitas'] : ['1 barrita', '2 barritas'];
        expect(valid, `${n} @${kcal}`).toContain(m.serving);
        expect(m.desc.startsWith(`${m.serving} · `)).toBe(true);
      }
    }
    expect(servedSolo(BOL_C, 330).serving).toBe('2 bolitas');
    expect(servedSolo(BOL_C, 660).serving).toBe('4 bolitas');
    expect(servedSolo(BARRA, 350).serving).toBe('1 barrita');
  });
  it('6 bolitas / 3 barritas NO existen (V1 final): la receta base es la porción máxima; N1/N2 intactos', () => {
    for (const n of [BOL_P, BOL_C, BARRA]) {
      const d = dish(n);
      const base = closedRecipeMacros(d, 'min')[0] * 2;   // receta base = paso 1
      expect(Math.round(closedRecipeMacros(d, 'max')[0]), n).toBe(Math.round(base));
      expect(servedSolo(n, base * 1.6).serving, n).toBe(d.srv!.unit === 'bolita' ? '4 bolitas' : '2 barritas');
    }
  });
  it('planes reales: solo porciones válidas, sin fracciones visibles de dátil', () => {
    const seen = new Set<string>();
    for (const k of [2200, 3000, 3500]) for (const seed of [7, 42]) for (const day of buildWeeklyPlan(mk(k), { seed, avoid: { strict: ['lacteos'], soft: [] } })) {
      for (const m of day.meals) if (/Bolitas|Barrita/.test(m.name)) {
        seen.add(m.serving!);
        expect(['2 bolitas', '4 bolitas', '1 barrita', '2 barritas']).toContain(m.serving);
        for (const p of m.portions) if (/d[aá]til/i.test(p)) expect(p).not.toMatch(/[½⅓⅔¼¾]/);
      }
    }
    expect(seen.size).toBeGreaterThan(0);
  }, 180_000);
});

describe('4 · recetas con decisión de producto ABIERTA: sin cambios', () => {
  const g = (d: string, nv: string, rol: string) => dish(d).ings.find((i) => i.nv === nv && i.rol === rol)?.g0;
  it('Avena (nuez 15 g + miel 7 g), French Toast (miel 7 g), Toast Ricotta y Fresa (almendras 15 g + miel 10 g)', () => {
    expect([g('Avena con Manzana y Canela', 'Nueces', 'principal'), g('Avena con Manzana y Canela', 'Miel', 'fijo')]).toEqual([15, 7]);
    expect(g('French Toast', 'Miel', 'fijo')).toBe(7);
    expect([g('Toast de Ricotta y Fresa', 'Almendras', 'fijo'), g('Toast de Ricotta y Fresa', 'Miel', 'fijo')]).toEqual([15, 10]);
    for (const n of ['Avena con Manzana y Canela', 'French Toast', 'Toast de Ricotta y Fresa']) expect(dish(n).cr).toBeUndefined();
  });
});

describe('6 · RECIPE_CAPACITY_LIMIT', () => {
  const day = (meals: DayPlan['meals']): DayPlan => ({ day: 1, theme: '', meals });
  it('receta cerrada en su porción máxima y el día corto > 5 % → se registra (no se deforma)', () => {
    const m = solveSlot([dish(PASTA)], 'Comida', [900, 60, 30, 100])[0];
    const r = recipeLimits(day([m]), [1200, 80, 40, 130]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ status: 'RECIPE_CAPACITY_LIMIT', recipe: PASTA, slot: 'Comida', maxValid: 'porción única de la receta' });
    expect(r[0].gap).toBe(1200 - m.macros!.kcal);
    expect(r[0].target).toBe(r[0].served + r[0].gap);
  });
  it('con margen en sus porciones válidas o con el día cerrado → nada', () => {
    const m = servedSolo(BOL_C, 330);   // 2 bolitas: aún podía crecer
    expect(recipeLimits(day([m]), [2000, 80, 60, 250])).toEqual([]);
    const p = solveSlot([dish(PASTA)], 'Comida', [588, 27, 19, 80])[0];
    expect(recipeLimits(day([p]), [p.macros!.kcal, 27, 19, 80])).toEqual([]);
  });
  it('bolitas al máximo servible y el día corto → límite con su porción máxima nombrada', () => {
    const m = servedSolo(BOL_C, 990);
    expect(recipeLimits(day([m]), [2000, 80, 60, 250])[0]).toMatchObject({ maxValid: '4 bolitas', recipe: BOL_C, slot: 'Snack' });
  });
});

describe('texto', () => {
  it('rango cerrado en inglés', () => {
    expect(tPortion('200–250 g de verduras asadas (berenjena)', { nv: 'Verduras asadas (berenjena)', g: 225, rol: 'guarnicion' }, 'en')).toMatch(/^200–250 g /);
  });
});
