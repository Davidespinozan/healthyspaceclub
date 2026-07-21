import { describe, it, expect } from 'vitest';
import { buildWeeklyPlan, buildDayWithFixed, type PlanTarget, type FixedMeal } from './planEngine';
import { BANCO } from '../data/banco';

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
    // Meta alta: el snack COMBINA 2 platillos; el de meta baja es uno solo. (Antes se
    // medía por nº de ingredientes, pero un platillo suelto puede tener más que dos
    // combinados — se mide el nº de platillos, que es lo que la prueba quiere garantizar.)
    const amDishes = (d: typeof low) => {
      const m = d.meals.find((x) => x.time === 'Snack AM')!;
      return (m as { imgs?: string[] }).imgs?.length || 1;
    };
    expect(amDishes(high)).toBe(2);
    expect(amDishes(low)).toBe(1);
  });

  // ── Sustituir una comida por un bowl del food truck (o cualquier alimento fijo) ──
  // El día debe seguir cerrando en la meta. El caso duro es la mujer en déficit: un bowl
  // es la mitad de su día, así que el resto tiene que armarse con platillos LIGEROS.
  describe('sustitución por alimento fijo (bowl)', () => {
    const VERDE: FixedMeal = { slot: 'Comida', name: 'Bowl Verde', kcal: 737, prot: 59, fat: 31, carb: 64 };
    const PERFILES: PlanTarget[] = [
      { kcal: 1450, protG: 110, fatG: 50, carbG: 140 },  // mujer déficit — el más apretado
      { kcal: 1800, protG: 120, fatG: 55, carbG: 190 },
      { kcal: 2873, protG: 154, fatG: 96, carbG: 348 },
      { kcal: 3500, protG: 263, fatG: 117, carbG: 350 },
    ];
    for (const T of PERFILES) {
      it(`día de ${T.kcal} kcal cierra en la meta con un bowl en la comida`, () => {
        for (let seed = 1; seed <= 5; seed++) {
          const day = buildDayWithFixed(T, VERDE, { seed });
          const tot = dayTotals(day.meals);
          expect(Math.abs(tot.kcal - T.kcal) / T.kcal).toBeLessThan(0.10);
          expect(Math.abs(tot.prot - T.protG) / T.protG).toBeLessThan(0.12);
          // El bowl va servido tal cual, sin escalar.
          const bowl = day.meals.find((m) => m.name === 'Bowl Verde')!;
          expect(bowl.macros!.kcal).toBe(737);
          expect(bowl.time).toBe('Comida');
          // Nada repetido en el día.
          const names = day.meals.map((m) => m.name);
          expect(new Set(names).size).toBe(names.length);
        }
      });
    }
  });
});
// ── Piso de porciones (correcciones de Magaly, julio 2026) ──────────────────
// Magaly reportó dos cosas: porciones de carne ridículas (80 g) y proteína suelta
// de relleno en los snacks. Lo primero se había arreglado con un piso; lo que
// seguía vivo era el huevo, porque por CALORÍAS el huevo es grasa (90 kcal de
// grasa contra 50 de proteína por 100 g) y se llevaba el piso flojo. De ahí salía
// un omelette de UN huevo sobre una receta de tres.
describe('porciones mínimas realistas', () => {
  const PROT_RE = /(?:^|[ (])(pollo|res|carne|at[uú]n|salm[oó]n|pescado|camar[oó]n|pavo|jam[oó]n|cerdo|bistec|arrachera|tilapia|lomo|milanesa)/i;
  const metas = [1400, 1900, 2500, 3200];

  it('ninguna fuente de proteína baja del piso de su receta', () => {
    for (const kcal of metas) {
      const t = { kcal, protG: Math.round(kcal * 0.3 / 4), fatG: Math.round(kcal * 0.28 / 9), carbG: Math.round(kcal * 0.42 / 4) };
      for (const seed of [1, 7, 21]) {
        for (const d of buildWeeklyPlan(t, { seed })) {
          for (const m of d.meals) {
            if (m.time.startsWith('Snack')) continue;
            for (const i of (m.ings ?? [])) {
              // El caldo de una sopa no es una porción de proteína.
              if (i.rol !== 'principal' || i.g === null) continue;
              if (!PROT_RE.test(i.nv) || /caldo|consom/i.test(i.nv)) continue;
              // Relativo a la receta, no absoluto: si Magaly puso 63 g de jamón en una
              // pizza de pan pita, exigir 100 g sería exigir más de lo que ella escribió.
              const ing = BANCO.find((x) => x.nombre === m.name)?.ings.find((x) => x.nv === i.nv);
              const base = ing?.g0 ?? 0, a = ing?.a ?? [0, 0, 0, 0];
              // Magra (la proteína domina sus calorías) → piso fuerte. Grasa (salmón,
              // queso) → 60%: es la palanca de grasa del solver y apretarla descuadra
              // las macros. Los dos casos son porciones razonables, no de 80 g.
              const magra = a[1] * 4 >= a[2] * 9 && a[1] * 4 >= a[3] * 4;
              const piso = magra ? Math.max(base * 0.7, Math.min(base, 110)) : base * 0.6;
              expect(i.g, `${kcal} kcal · ${m.name} · ${i.nv} (receta ${base} g)`).toBeGreaterThanOrEqual(Math.floor(piso));
            }
          }
        }
      }
    }
  });

  it('el huevo nunca queda en 1 pieza cuando la receta trae más', () => {
    // El omelette de 3 huevos (132 g) puede bajar a 2, nunca a 1.
    for (const kcal of metas) {
      const t = { kcal, protG: Math.round(kcal * 0.3 / 4), fatG: Math.round(kcal * 0.28 / 9), carbG: Math.round(kcal * 0.42 / 4) };
      for (const seed of [1, 7, 21]) {
        for (const d of buildWeeklyPlan(t, { seed })) {
          for (const m of d.meals) {
            const receta = BANCO.find((x) => x.nombre === m.name);
            for (const i of (m.ings ?? [])) {
              if (i.g === null || !/^huevo/i.test(i.nv)) continue;
              const base = receta?.ings.find((x) => x.nv === i.nv)?.g0 ?? 0;
              if (base >= 88) expect(i.g, `${m.name} · ${i.nv} (receta ${base} g)`).toBeGreaterThanOrEqual(88);
            }
          }
        }
      }
    }
  });

  it('no mete proteína suelta en los snacks', () => {
    for (const kcal of metas) {
      const t = { kcal, protG: Math.round(kcal * 0.3 / 4), fatG: Math.round(kcal * 0.28 / 9), carbG: Math.round(kcal * 0.42 / 4) };
      for (const seed of [1, 7, 21]) {
        for (const d of buildWeeklyPlan(t, { seed })) {
          for (const m of d.meals) {
            if (!m.time.startsWith('Snack')) continue;
            for (const i of (m.ings ?? [])) {
              if (i.rol !== 'principal' || i.g === null) continue;
              expect(PROT_RE.test(i.nv), `${kcal} kcal · snack ${m.name} trae ${i.nv}`).toBe(false);
            }
          }
        }
      }
    }
  });
});
