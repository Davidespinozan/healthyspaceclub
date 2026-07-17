import { describe, it, expect } from 'vitest';
import { buildWeeklyPlan, type PlanTarget } from './planEngine';

function dayTotals(meals: { macros?: { kcal: number; prot: number; fat: number; carb: number } }[]) {
  return meals.reduce(
    (a, m) => ({
      kcal: a.kcal + (m.macros?.kcal ?? 0),
      prot: a.prot + (m.macros?.prot ?? 0),
      fat: a.fat + (m.macros?.fat ?? 0),
      carb: a.carb + (m.macros?.carb ?? 0),
    }),
    { kcal: 0, prot: 0, fat: 0, carb: 0 },
  );
}

const CASES: PlanTarget[] = [
  { kcal: 1450, protG: 110, fatG: 50, carbG: 140 }, // mujer déficit
  { kcal: 1800, protG: 120, fatG: 55, carbG: 190 }, // mujer mantenimiento
  { kcal: 2300, protG: 160, fatG: 70, carbG: 250 }, // hombre mantenimiento
  { kcal: 2700, protG: 180, fatG: 80, carbG: 310 }, // hombre volumen (atleta)
];

describe('planEngine — ajuste a la meta', () => {
  for (const T of CASES) {
    it(`pega la meta ${T.kcal} kcal (P${T.protG}/F${T.fatG}/C${T.carbG})`, () => {
      const days = buildWeeklyPlan(T, { seed: 42 });
      expect(days).toHaveLength(7);
      for (const d of days) {
        const tot = dayTotals(d.meals);
        // Precisión: error máx por macro ≤ 12% (el prototipo da 0-3%; margen holgado).
        expect(Math.abs(tot.kcal - T.kcal) / T.kcal).toBeLessThan(0.12);
        expect(Math.abs(tot.prot - T.protG) / T.protG).toBeLessThan(0.12);
        expect(Math.abs(tot.fat - T.fatG) / T.fatG).toBeLessThan(0.15);
        expect(Math.abs(tot.carb - T.carbG) / T.carbG).toBeLessThan(0.15);
      }
    });
  }

  // Metas ALTAS (volumen) CON batido de proteína. Antes, el batido reemplazaba el snack
  // pero reduceForShake solo descontaba el batido (no reintegraba el snack perdido, casi
  // puro carbo) → desfase fuerte en carbos/grasa. Estos casos lo blindan.
  const HIGH_SHAKE: { T: PlanTarget; shake: import('./planEngine').ProteinShake }[] = [
    { T: { kcal: 3500, protG: 187, fatG: 117, carbG: 425 }, shake: { slots: ['am', 'pm'], type: 'massgainer', protG: 50 } },
    { T: { kcal: 3500, protG: 220, fatG: 117, carbG: 391 }, shake: { slots: ['am', 'pm'], type: 'vegana', protG: 30 } },
    { T: { kcal: 3200, protG: 176, fatG: 107, carbG: 396 }, shake: { slots: ['am'], type: 'regular', protG: 40 } },
    { T: { kcal: 3000, protG: 190, fatG: 90, carbG: 360 }, shake: { slots: ['am', 'pm'], type: 'massgainer', protG: 40 } },
  ];
  for (const { T, shake } of HIGH_SHAKE) {
    it(`meta alta ${T.kcal} + batido ${shake.type} pega carbos/grasa`, () => {
      for (const d of buildWeeklyPlan(T, { seed: 42, shake })) {
        const tot = dayTotals(d.meals);
        expect(Math.abs(tot.kcal - T.kcal) / T.kcal).toBeLessThan(0.10);
        expect(Math.abs(tot.carb - T.carbG) / T.carbG).toBeLessThan(0.10);
        expect(Math.abs(tot.fat - T.fatG) / T.fatG).toBeLessThan(0.10);
      }
    });
  }

  it('respeta el reparto de Magaly: comida es la más grande, cena ≤ comida', () => {
    const T = CASES[2];
    for (const d of buildWeeklyPlan(T, { seed: 7 })) {
      const kcalOf = (time: string) =>
        d.meals.filter((m) => m.time === time).reduce((a, m) => a + (m.macros?.kcal ?? 0), 0);
      const des = kcalOf('Desayuno'), com = kcalOf('Comida'), cen = kcalOf('Cena');
      const snacks = kcalOf('Snack AM') + kcalOf('Snack PM');
      expect(com).toBeGreaterThanOrEqual(des);   // comida (35%) ≥ desayuno (25%)
      expect(com).toBeGreaterThanOrEqual(cen);   // comida (35%) ≥ cena (25%)
      expect(snacks).toBeLessThan(com);          // snacks (15%) < comida
    }
  });

  const mealText = (m: { name: string; ings?: { nv: string }[] }) =>
    (m.name + ' ' + (m.ings ?? []).map((i) => i.nv).join(' ')).toLowerCase();

  it('evitar carne-roja → no aparece res en el plan', () => {
    const days = buildWeeklyPlan(CASES[2], { seed: 9, avoid: ['carne-roja'] });
    const rm = /\b(res|sirloin|bistec|falda|molida|machaca|chambarete)\b/;
    for (const d of days) for (const m of d.meals) expect(rm.test(mealText(m))).toBe(false);
  });

  it('alergias: evitar huevo + cacahuate → no aparecen en el plan', () => {
    const days = buildWeeklyPlan(CASES[1], { seed: 4, avoid: ['huevo', 'cacahuate'] });
    const bad = /\b(huevo|huevos|cacahuate|cacahuates)\b/;
    for (const d of days) for (const m of d.meals) expect(bad.test(mealText(m))).toBe(false);
  });

  it('antojo "pollo" → prefiere platillos con pollo', () => {
    const cnt = (days: ReturnType<typeof buildWeeklyPlan>) =>
      days.reduce((a, d) => a + d.meals.filter((m) => /pollo/.test(mealText(m))).length, 0);
    const withCrave = cnt(buildWeeklyPlan(CASES[1], { seed: 2, craving: 'pollo' }));
    const without = cnt(buildWeeklyPlan(CASES[1], { seed: 2 }));
    expect(withCrave).toBeGreaterThan(without);
  });

  it('dentro de un día NADA se repite (ni comida ni snack)', () => {
    for (const T of CASES) {
      for (const d of buildWeeklyPlan(T, { seed: 6 })) {
        // los snacks combinados llevan nombre "A + B" → separar para checar cada platillo
        const items = d.meals.flatMap((m) => m.name.split(' + '));
        expect(new Set(items).size).toBe(items.length);
      }
    }
  });

  it('variedad: los 7 días no repiten el mismo desayuno/comida/cena', () => {
    const days = buildWeeklyPlan(CASES[1], { seed: 5 });
    for (const time of ['Desayuno', 'Comida', 'Cena']) {
      const names = days.map((d) => d.meals.find((m) => m.time === time)!.name);
      const distintos = new Set(names).size;
      expect(distintos).toBeGreaterThanOrEqual(6); // casi todos distintos (de 7)
    }
  });

  it('sesga por cocina: elegir italiana → comidas italianas', () => {
    const days = buildWeeklyPlan(CASES[1], { seed: 3, cuisines: ['italiana'] });
    const comidas = days.map((d) => d.meals.find((m) => m.time === 'Comida')!.name.toLowerCase());
    const italian = comidas.filter((n) => /pasta|espagueti|bolo|pizza/.test(n)).length;
    expect(italian).toBeGreaterThanOrEqual(5); // la mayoría de las 7 comidas
  });

  it('5 tiempos; snack AM/PM aparecen UNA vez; combina 2 snacks dentro del mismo', () => {
    const low = buildWeeklyPlan(CASES[0], { seed: 1 })[0];
    const high = buildWeeklyPlan(CASES[3], { seed: 1 })[0];
    const amCount = (d: typeof low) => d.meals.filter((m) => m.time === 'Snack AM').length;
    // Snack AM aparece exactamente 1 vez en ambos (no duplicado), aunque combine.
    expect(amCount(low)).toBe(1);
    expect(amCount(high)).toBe(1);
    expect(low.meals.map((m) => m.time)).toContain('Snack PM');
    // Meta alta: el snack combinado trae más ingredientes que el de meta baja.
    const amIngs = (d: typeof low) => d.meals.find((m) => m.time === 'Snack AM')!.ings!.length;
    expect(amIngs(high)).toBeGreaterThan(amIngs(low));
  });
});
