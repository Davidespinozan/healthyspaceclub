import { describe, it, expect } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// MENÚ HSC V1 · CAPA 4 V1 · decisiones D1–D3.
//   D1 · medidas: pasta cocida 1 taza = 120 g; aceite en cucharaditas de 5 g; miel cdita 7 g / cda 21 g.
//   D2 · 3 principales + 0–2 snacks (máx. 5 tiempos), por practicidad y tamaño — sin porcentajes fijos.
//   D3 · snacks culinariamente creíbles: sin fruta de relleno, sin «fruta + fruta», densos por necesidad.
//   Siempre: respeto absoluto a max_g (también dentro de los bloques).
// ─────────────────────────────────────────────────────────────────────────────
import { BANCO, type BancoDish } from '../../data/banco';
import {
  portionStr, buildWeeklyPlan, snackPlan, snackFitsSize, isFruitSnack, assembleFromSelection, ingBounds,
  type PlanTarget, type DaySelection,
} from '../planEngine';
import { portionBoundsFor } from '../portionPlausibility';

const mk = (kcal: number): PlanTarget => ({ kcal, protG: Math.round((kcal * 0.28) / 4), fatG: Math.round((kcal * 0.27) / 9), carbG: Math.round((kcal * 0.45) / 4) });
const dish = (n: string): BancoDish => { const d = BANCO.find((x) => x.nombre === n); if (!d) throw new Error(n); return d; };
const byName = new Map(BANCO.map((d) => [d.nombre, d]));
const FRUIT = new Set(['berries', 'grapes', 'cutFruit', 'wholeFruit']);

describe('D1 · medidas', () => {
  const ing = (nv: string, rol = 'principal') => ({ nv, rol, g0: 50 });
  it('pasta cocida: 1 taza = 120 g (el 40 g/taza del catálogo para codito es un dato defectuoso)', () => {
    expect(portionStr(ing('Pasta cocida'), 120)).toBe('1 taza de pasta cocida');
    expect(portionStr(ing('Pasta'), 60)).toBe('½ taza de pasta');
    expect(portionStr(ing('Pasta cocida'), 180)).toBe('1½ tazas de pasta cocida');
  });
  it('aceite en cucharaditas de 5 g; si no hay una cucharadita natural, gramos', () => {
    expect(portionStr(ing('Aceite de oliva', 'fijo'), 5)).toBe('1 cdita de aceite de oliva');
    expect(portionStr(ing('Aceite de oliva', 'fijo'), 10)).toBe('2 cditas de aceite de oliva');
    expect(portionStr(ing('Aceite de oliva', 'fijo'), 3)).toBe('½ cdita de aceite de oliva');
    expect(portionStr(ing('Aceite de ajonjolí', 'fijo'), 12)).toBe('2½ cditas de aceite de ajonjolí');
    expect(portionStr(ing('Aceite de oliva', 'fijo'), 1)).toBe('1 g Aceite de oliva');
  });
  it('miel: cdita 7 g bajo 1 cda, cda 21 g desde ahí; fuera de la regla genérica de salsa (15 g/cda)', () => {
    expect(portionStr(ing('Miel', 'fijo'), 7)).toBe('1 cdita de miel');
    expect(portionStr(ing('Miel', 'fijo'), 10)).toBe('1½ cditas de miel');
    expect(portionStr(ing('Miel', 'fijo'), 14)).toBe('2 cditas de miel');
    expect(portionStr(ing('Miel', 'fijo'), 21)).toBe('1 cda de miel');
    expect(portionStr(ing('Miel', 'fijo'), 42)).toBe('2 cdas de miel');
    expect(portionStr(ing('Miel', 'fijo'), 5)).toBe('5 g Miel');                     // ninguna cuchara honesta
    expect(portionStr({ nv: 'Glaseado de miel y soya', rol: 'sub-receta', g0: 30 }, 30)).toBe('2 cdas de glaseado de miel y soya');   // sub-receta: sigue siendo salsa
  });
});

describe('D2 · 3 principales + 0–2 snacks', () => {
  it('toda meta: 3 principales exactas, 0–2 snacks, máximo 5 tiempos, cada slot a lo sumo una vez', () => {
    for (const kcal of [1450, 1800, 2200, 2600, 3000, 3600]) for (const seed of [7, 42]) {
      for (const d of buildWeeklyPlan(mk(kcal), { seed })) {
        const t = d.meals.map((m) => m.time);
        for (const s of ['Desayuno', 'Comida', 'Cena']) expect(t.filter((x) => x === s).length, `${kcal}/${seed} ${s}`).toBe(1);
        expect(t.filter((x) => x.startsWith('Snack')).length).toBeLessThanOrEqual(2);
        expect(new Set(t).size).toBe(t.length);
      }
    }
  }, 120_000);
  it('meta baja: los días sin snack son válidos (3 comidas razonables bastan)', () => {
    const days = buildWeeklyPlan(mk(1450), { seed: 7 });
    expect(days.filter((d) => d.meals.length === 3).length).toBeGreaterThan(0);
  });
  it('meta muy alta: 4–5 tiempos, no 3 comidas gigantes', () => {
    for (const d of buildWeeklyPlan(mk(3600), { seed: 7 })) expect(d.meals.length).toBeGreaterThanOrEqual(4);
  }, 60_000);
  it('snackPlan: sin hueco no hay snack; hueco grande → 2; el batido ocupa su slot; un snack nunca supera ¾ de la principal más chica', () => {
    const mains = [dish('Huevo a la Mexicana'), dish('Salmón Bowl'), dish('Tostadas de Panela')];
    const fits = () => true;
    expect(snackPlan(mains, [0, 30, 10, 40], ['Snack AM', 'Snack PM'], fits)).toEqual([]);   // meta chica: sobra capacidad
    const big = snackPlan(mains, [0, 200, 150, 600], ['Snack AM', 'Snack PM'], () => false);
    expect(big.map((s) => s.slot)).toEqual(['Snack AM', 'Snack PM']);
    const onlyPm = snackPlan(mains, [0, 200, 150, 600], ['Snack PM'], () => false);
    expect(onlyPm.map((s) => s.slot)).toEqual(['Snack PM']);                                // AM lo ocupa el batido
    expect(snackPlan(mains, [0, 200, 150, 600], [], () => false)).toEqual([]);             // dos batidos: sin slot libre
  });
});

describe('D3 · snacks creíbles', () => {
  const plans = () => [1800, 2600, 3200].flatMap((kcal) => [7, 42].flatMap((seed) => buildWeeklyPlan(mk(kcal), { seed })));
  it('isFruitSnack: fruta sola sí; fruta con complemento no', () => {
    expect(isFruitSnack(dish('Plátano'))).toBe(true);
    expect(isFruitSnack(dish('Plátano con Crema de Cacahuate y Avena'))).toBe(false);
  });
  it('un snack de fruta sola nunca es candidato para un hueco grande (su porción normal es chica)', () => {
    const fruitOnly = BANCO.filter((d) => d.tiempo === 'Snack' && isFruitSnack(d));
    expect(fruitOnly.length).toBeGreaterThan(5);
    expect(fruitOnly.filter((d) => snackFitsSize(d, 450)).map((d) => d.nombre)).toEqual([]);
  });
  it('planes reales: nunca «fruta + fruta» en un mismo snack', () => {
    const bad: string[] = [];
    for (const d of plans()) for (const m of d.meals) {
      if (!m.time.startsWith('Snack')) continue;
      const parts = m.name.split(' + ').map((n) => byName.get(n)).filter((x): x is BancoDish => !!x);
      if (parts.length > 1 && parts.filter(isFruitSnack).length > 1) bad.push(m.name);
    }
    expect(bad).toEqual([]);
  }, 120_000);
  it('planes reales: la fruta de un snack nunca pasa de su porción NORMAL (adiós «6½ guayabas»)', () => {
    const bad: string[] = [];
    for (const d of plans()) for (const m of d.meals) {
      if (!m.time.startsWith('Snack')) continue;
      for (const g of m.ings ?? []) {
        const b = portionBoundsFor(g.nv);
        if (b && FRUIT.has(b.family) && g.g != null && g.g > Math.max(b.preferredMaxG, 0) * 1.0 + 1) {
          const base = [...byName.values()].flatMap((x) => x.ings).find((i) => i.nv === g.nv)?.g0 ?? 0;
          if (g.g > Math.max(b.preferredMaxG, base) + 1) bad.push(`${m.name}: ${g.nv} ${g.g} g`);
        }
      }
    }
    expect(bad).toEqual([]);
  }, 120_000);
});

describe('max_g · respeto absoluto (también en bloques)', () => {
  it('ningún principal servido (suelto o bloque) pasa su techo (max_g, PIECE/GRAM_MAX, techo humano)', () => {
    const bad: string[] = [];
    for (const kcal of [1800, 2600, 3600]) for (const seed of [7, 42]) for (const d of buildWeeklyPlan(mk(kcal), { seed })) for (const m of d.meals) {
      for (const part of m.name.split(' + ')) {
        const dd = byName.get(part);
        if (!dd) continue;
        for (const g of m.ings ?? []) {
          const i = dd.ings.find((x) => x.nv === g.nv && x.rol === 'principal');
          if (!i || !i.a || g.g == null) continue;
          if (g.g > ingBounds(i).hi + (i.pu ?? 1)) bad.push(`${kcal}/${seed} ${m.name} · ${i.nv} ${g.g} > ${ingBounds(i).hi}`);
        }
      }
    }
    expect(bad).toEqual([]);
  }, 120_000);
});

describe('camino IA · misma CAPA 4', () => {
  it('assembleFromSelection: 3 principales + 0–2 snacks de los candidatos de la IA, un platillo por snack', () => {
    const pick = (t: string, i: number) => BANCO.filter((d) => d.tiempo === t && !d.region)[i].nombre;
    const snacks = BANCO.filter((d) => d.tiempo === 'Snack' && !d.region);
    const days: DaySelection[] = Array.from({ length: 7 }, (_, i) => ({
      desayuno: pick('Desayuno', i), comida: pick('Comida', i), cena: pick('Cena', i), snacks: [snacks[2 * i].nombre, snacks[2 * i + 1].nombre],
    }));
    for (const kcal of [1600, 3200]) {
      const out = assembleFromSelection(mk(kcal), days, []);
      expect(out).toHaveLength(7);
      for (const d of out) {
        const t = d.meals.map((m) => m.time);
        expect(t.filter((x) => !x.startsWith('Snack')).length).toBe(3);
        expect(t.filter((x) => x.startsWith('Snack')).length).toBeLessThanOrEqual(2);
      }
    }
  });
});
