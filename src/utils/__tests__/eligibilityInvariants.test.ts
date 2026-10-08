import { describe, it, expect } from 'vitest';
import srcTabHoy from '../../components/TabHoy.tsx?raw';
import { BANCO, type BancoDish } from '../../data/banco';
import {
  buildWeeklyPlan, buildDayWithFixed, assembleFromSelection,
  safeBankByTiempo, adequateBankByTiempo, makeAvoidFilter,
  NoEligibleDishesError,
  type PlanTarget, type FixedMeal, type DaySelection,
} from '../planEngine';
import { effectiveAvoid, permanentAvoidFrom, weeklyAvoidFrom, avoidForRegen } from '../avoidAuthority';
import { dishAllowedInRegion } from '../../data/regionFood';
import type { Region } from '../region';

// ─────────────────────────────────────────────────────────────────────────────
// P0-03 · SAFE FALLBACKS / ELIGIBILITY INVARIANTS.
//
// Una vez determinadas las restricciones efectivas (P0-02), NINGUNA ruta de
// fallback, degradación o recuperación puede:
//
//   1. RESTRICCIONES · devolver un platillo que viole una categoría excluida.
//   2. TIEMPO        · servir un platillo de otro tiempo. Un Desayuno es un
//                      Desayuno. Un pool vacío NO autoriza buscar en otro tiempo.
//   3. FAIL CLOSED   · si no existe opción válida, HSC lo reconoce. Nunca fabrica
//                      disponibilidad relajando una regla de seguridad.
//
// CÓMO SE PRUEBA EL FAIL-CLOSED. Con las 10 categorías soportadas NINGUNA combinación
// vacía un tiempo (medido abajo: 16.368 pools, cero vacíos), así que la imposibilidad hay
// que CONSTRUIRLA. Se construye con listas de términos SINTÉTICAS —palabras literales de
// ingrediente como 'verduras' o 'pizca', que `expandAvoid` deja pasar tal cual— elegidas
// por cobertura para vaciar exactamente el tiempo que cada test necesita.
//
// Deliberadamente NO se usan `vegetariano`/`vegano`: la Decisión 01 los declara capacidad
// no soportada y la autoridad ya no los admite (ver avoidAuthority), así que no pueden ser
// el fundamento de una garantía de seguridad del producto. Un fixture sintético es además
// mejor prueba: aísla el tiempo que se quiere vaciar sin arrastrar una semántica de dieta.
// ─────────────────────────────────────────────────────────────────────────────

const SLOTS = ['Desayuno', 'Comida', 'Cena', 'Snack'] as const;
const byName = new Map(BANCO.map((d) => [d.nombre, d]));
const mk = (kcal: number): PlanTarget => ({
  kcal, protG: Math.round(kcal * 0.3 / 4), fatG: Math.round(kcal * 0.27 / 9), carbG: Math.round(kcal * 0.43 / 4),
});
/** Slot de una comida generada, normalizando Snack AM/PM → Snack. */
const slotOf = (time: string) => (time.startsWith('Snack') ? 'Snack' : time);
/** Resuelve cada platillo servido (los snacks combinados vienen como "A + B"). */
function servedDishes(days: ReturnType<typeof buildWeeklyPlan>): Array<{ slot: string; dish: BancoDish }> {
  const out: Array<{ slot: string; dish: BancoDish }> = [];
  for (const d of days) for (const m of d.meals) {
    for (const part of m.name.split(' + ')) {
      const dish = byName.get(part);
      if (dish) out.push({ slot: slotOf(m.time), dish });
    }
  }
  return out;
}
/** INVARIANTE 2 · platillos servidos en un slot que no es el suyo. */
const timeCrossings = (days: ReturnType<typeof buildWeeklyPlan>) =>
  servedDishes(days).filter(({ slot, dish }) => dish.tiempo !== slot)
    .map(({ slot, dish }) => `${slot} ← ${dish.nombre} (${dish.tiempo})`);
/** INVARIANTE 1 · platillos servidos que violan alguna categoría excluida. */
function restrictionLeaks(days: ReturnType<typeof buildWeeklyPlan>, cats: string[]): string[] {
  const f = makeAvoidFilter(cats);
  return servedDishes(days).filter(({ dish }) => f(dish)).map(({ slot, dish }) => `${slot} · ${dish.nombre}`);
}

// ── FIXTURES SINTÉTICOS ──────────────────────────────────────────────────────
// Listas de TÉRMINOS, no de categorías de producto. Los tamaños de pool van medidos para
// que se vea qué aísla cada una; si el banco cambia, los asserts de A las revalidan.
/** Vacía solo COMIDA. (Desayuno 26 · Comida 0 · Cena 6 · Snack 100) */
const SIN_COMIDA = ['verduras', 'pizca'];
/** Vacía solo CENA, deja Desayuno y Comida. (Desayuno 8 · Comida 2 · Cena 0 · Snack 66) */
const SIN_CENA = ['verduras', 'miel', 'frijoles', 'queso'];
/** Vacía solo DESAYUNO. (Desayuno 0 · Comida 4 · Cena 5 · Snack 50) */
const SIN_DESAYUNO = ['huevo', 'pizca', 'miel', 'queso', 'avena'];
/** Vacía los TRES tiempos fuertes dejando 19 snacks: aísla la invariante de tiempo, porque
 *  el motor tiene snacks de sobra con los que habría podido rellenar (y antes lo hacía). */
const SIN_NADA_FUERTE = [
  'huevo', 'pizca', 'miel', 'queso', 'avena', 'verduras', 'crema', 'nueces', 'yogurt',
  'fresas', 'manzana', 'melon', 'platano', 'pepino', 'aceitunas', 'nopal', 'jicama',
  'zanahoria', 'edamames', 'garbanzos', 'cacahuates', 'mango', 'higos', 'uvas',
  'datiles', 'pera', 'naranja', 'sandia', 'betabel', 'elote',
];

/** Pool real de un tiempo tras restricciones y región (réplica del que arma buildDay). */
function poolSize(slot: string, cats: string[], region?: Region): number {
  // DECISIÓN 06 · el pool de cada tiempo es el NOMINAL: ya no se filtra por
  // `rol:'guarnicion'`. Esta réplica sigue al motor, no al revés.
  const f = makeAvoidFilter(cats);
  return BANCO.filter((d) => d.tiempo === slot && !f(d) && dishAllowedInRegion(d, region)).length;
}
/** Pool SIN filtro de región: es el que ve `buildDayWithFixed`, que no recibe región. */
function poolSizeSinRegion(slot: string, cats: string[]): number {
  const f = makeAvoidFilter(cats);
  return BANCO.filter((d) => d.tiempo === slot && !f(d)).length;
}

// ═════════════════════════════════════════════════════════════════════════════
// A · LOS FIXTURES SINTÉTICOS AÍSLAN LO QUE DICEN AISLAR
// ═════════════════════════════════════════════════════════════════════════════
describe('P0-03 · A · condición de imposibilidad construida', () => {
  it('cada fixture vacía exactamente el tiempo que pretende', () => {
    expect(poolSizeSinRegion('Comida', SIN_COMIDA), 'SIN_COMIDA').toBe(0);
    expect(poolSizeSinRegion('Desayuno', SIN_COMIDA), 'SIN_COMIDA deja desayunos').toBeGreaterThan(0);

    expect(poolSizeSinRegion('Cena', SIN_CENA), 'SIN_CENA').toBe(0);
    expect(poolSizeSinRegion('Desayuno', SIN_CENA), 'SIN_CENA deja desayunos').toBeGreaterThan(0);

    expect(poolSizeSinRegion('Desayuno', SIN_DESAYUNO), 'SIN_DESAYUNO').toBe(0);
    expect(poolSizeSinRegion('Comida', SIN_DESAYUNO), 'SIN_DESAYUNO deja comidas').toBeGreaterThan(0);

    // El caso fuerte: sin ningún tiempo fuerte, pero con snacks DE SOBRA. Si el motor
    // quisiera hacer trampa, aquí tendría con qué: 19 snacks disponibles.
    for (const slot of ['Desayuno', 'Comida', 'Cena'] as const) {
      expect(poolSizeSinRegion(slot, SIN_NADA_FUERTE), `SIN_NADA_FUERTE ${slot}`).toBe(0);
    }
    expect(poolSizeSinRegion('Snack', SIN_NADA_FUERTE), 'deben quedar snacks con los que rellenar')
      .toBeGreaterThan(10);
  });

  it('las 10 categorías que HSC ofrece nunca vacían un tiempo, en ninguna región', () => {
    // 1.023 subconjuntos × 4 ajustes de región × 4 tiempos = 16.368 pools. Ninguno vacío:
    // el fail-closed de P0-03 es una RED DE SEGURIDAD, no una puerta que se vaya a cerrar
    // en la cara de un usuario soportado. El margen más estrecho es de 1 solo platillo
    // (gluten+lacteos+huevo · EUROPE · Desayuno), que es un dato de producto, no un bug
    // de este bloque: con un platillo, los 7 desayunos de la semana son el mismo.
    const CAT = ['gluten', 'lacteos', 'huevo', 'frutos-secos', 'cacahuate', 'soya', 'ajonjoli', 'pescado', 'mariscos', 'carne-roja'];
    const REG: (Region | undefined)[] = [undefined, 'LATAM', 'EUROPE', 'REST'];
    const vacios: string[] = [];
    let min = Infinity, peor = '';
    for (let m = 1; m < (1 << CAT.length); m++) {
      const s: string[] = [];
      for (let i = 0; i < CAT.length; i++) if (m & (1 << i)) s.push(CAT[i]);
      for (const r of REG) for (const slot of SLOTS) {
        const n = poolSize(slot, s, r);
        if (n === 0) vacios.push(`${s.join('+')} · ${r ?? 'sin-region'} · ${slot}`);
        if (n < min) { min = n; peor = `${s.join('+')} · ${r ?? 'sin-region'} · ${slot}`; }
      }
    }
    expect(vacios.slice(0, 5), 'ninguna combinación ofrecida debe vaciar un tiempo').toEqual([]);
    expect(min, `el pool más estrecho (${peor}) dejó de tener candidatos`).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B · INVARIANTE DE TIEMPO · un pool vacío NO autoriza cruzar de tiempo
// ═════════════════════════════════════════════════════════════════════════════
describe('P0-03 · B · el tiempo de comida es invariante', () => {
  it('2/3 · sin ningún tiempo fuerte pero CON snacks de sobra, el motor NO los usa para rellenar', () => {
    // Éste es el test que de verdad prueba la invariante 2: hay 19 snacks disponibles y el
    // motor podría componer un día entero con ellos —es exactamente lo que hacía antes de
    // P0-03—. Debe negarse y declarar la imposibilidad.
    expect(() => buildWeeklyPlan(mk(2000), { seed: 3, avoid: SIN_NADA_FUERTE }))
      .toThrow(NoEligibleDishesError);
  });

  it('3 · DESAYUNO vacío → el error lo nombra; no se rellena con Comida, Cena ni Snack', () => {
    try {
      buildWeeklyPlan(mk(2000), { seed: 3, avoid: SIN_DESAYUNO });
      throw new Error('debió lanzar NoEligibleDishesError');
    } catch (e) {
      expect(e).toBeInstanceOf(NoEligibleDishesError);
      const err = e as NoEligibleDishesError;
      expect(err.slot, 'el tiempo sin candidatos es Desayuno').toBe('Desayuno');
      expect(err.avoid).toEqual(SIN_DESAYUNO);
      expect(err.message).toMatch(/Desayuno/);
    }
  });

  it('2 · CENA vacía con Desayuno disponible → tampoco recibe otro tiempo', () => {
    // Caso AISLADO: el desayuno se arma sin problema y la Comida la ocupa el alimento fijo,
    // así que el único tiempo imposible es la Cena. Comprueba que el fallo es ESPECÍFICO de
    // ese tiempo y que la Cena no recibe ni el desayuno sobrante ni un snack.
    const bowl: FixedMeal = { slot: 'Comida', name: 'Bowl Verde', kcal: 737, prot: 59, fat: 31, carb: 64 };
    try {
      buildDayWithFixed(mk(2200), bowl, { avoid: SIN_CENA }, 1);
      throw new Error('debió lanzar NoEligibleDishesError');
    } catch (e) {
      expect(e).toBeInstanceOf(NoEligibleDishesError);
      expect((e as NoEligibleDishesError).slot, 'el tiempo imposible es la Cena').toBe('Cena');
    }
  });

  it('1 · COMIDA vacía → el error la nombra, aunque haya desayunos, cenas y snacks', () => {
    try {
      buildWeeklyPlan(mk(2000), { seed: 5, avoid: SIN_COMIDA });
      throw new Error('debió lanzar NoEligibleDishesError');
    } catch (e) {
      expect(e).toBeInstanceOf(NoEligibleDishesError);
      expect((e as NoEligibleDishesError).slot).toBe('Comida');
    }
  });

  it('ningún plan generable cruza de tiempo, en ninguna combinación de las ofrecidas', () => {
    const CASOS: string[][] = [
      [], ['gluten'], ['lacteos'], ['mariscos'], ['carne-roja'],
      ['gluten', 'lacteos'], ['gluten', 'lacteos', 'huevo'],
      ['lacteos', 'ajonjoli', 'mariscos'], ['gluten', 'lacteos', 'huevo', 'pescado'],
    ];
    for (const avoid of CASOS) {
      for (const seed of [2, 19]) {
        const days = buildWeeklyPlan(mk(2200), { seed, avoid });
        expect(timeCrossings(days), `avoid=[${avoid}] seed=${seed}`).toEqual([]);
      }
    }
  });

  it('buildDayWithFixed (bowl del food truck) tampoco cruza de tiempo', () => {
    const bowl: FixedMeal = { slot: 'Comida', name: 'Bowl Verde', kcal: 737, prot: 59, fat: 31, carb: 64 };
    for (const avoid of [[], ['lacteos'], ['gluten', 'lacteos', 'huevo']]) {
      const day = buildDayWithFixed(mk(2200), bowl, { avoid }, 1);
      const cruces = timeCrossings([day]).filter((s) => !s.includes('Bowl Verde'));
      expect(cruces, `avoid=[${avoid}]`).toEqual([]);
    }
  });

  it('buildDayWithFixed falla cerrado cuando un tiempo queda sin candidatos', () => {
    const bowl: FixedMeal = { slot: 'Comida', name: 'Bowl Verde', kcal: 737, prot: 59, fat: 31, carb: 64 };
    expect(() => buildDayWithFixed(mk(2200), bowl, { avoid: SIN_DESAYUNO }, 1))
      .toThrow(NoEligibleDishesError);
  });

  it('assembleFromSelection ignora una selección cuyo platillo no es de ese tiempo', () => {
    const cena = BANCO.find((d) => d.tiempo === 'Cena')!;
    const des = BANCO.find((d) => d.tiempo === 'Desayuno')!;
    const com = BANCO.find((d) => d.tiempo === 'Comida')!;
    // una Cena colocada en el slot de Desayuno NO puede salir como desayuno
    const sel: DaySelection[] = [{ desayuno: cena.nombre, comida: com.nombre, cena: cena.nombre, snacks: [] }];
    const out = assembleFromSelection(mk(2200), sel, []);
    expect(out, 'el día con un platillo de otro tiempo se descarta').toEqual([]);
    // control: la misma selección bien formada sí produce el día
    const ok = assembleFromSelection(mk(2200), [{ desayuno: des.nombre, comida: com.nombre, cena: cena.nombre, snacks: [] }], []);
    expect(ok).toHaveLength(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C · INVARIANTE DE RESTRICCIONES · ningún fallback reintroduce un incompatible
// ═════════════════════════════════════════════════════════════════════════════
describe('P0-03 · C · las restricciones son invariantes', () => {
  it('1 · safeBankByTiempo NUNCA devuelve un platillo incompatible, ni con el pool vacío', () => {
    for (const cats of [SIN_NADA_FUERTE, SIN_COMIDA, ['gluten', 'lacteos', 'huevo']]) {
      const bank = safeBankByTiempo(cats);
      const f = makeAvoidFilter(cats);
      for (const slot of SLOTS) {
        const inc = bank[slot].filter((d) => f(d)).map((d) => d.nombre);
        expect(inc, `${cats} · ${slot}`).toEqual([]);
      }
    }
  });

  it('1 · safeBankByTiempo respeta el tiempo de cada pool', () => {
    const bank = safeBankByTiempo(['gluten', 'lacteos']);
    for (const slot of SLOTS) {
      for (const d of bank[slot]) expect(d.tiempo, `${slot} trae un ${d.tiempo}`).toBe(slot);
    }
  });

  it('5 · ruta IA · adequateBankByTiempo nunca ofrece al modelo un incompatible', () => {
    for (const cats of [SIN_NADA_FUERTE, ['gluten', 'lacteos', 'huevo'], ['lacteos', 'ajonjoli', 'mariscos']]) {
      const bank = adequateBankByTiempo(cats, mk(2200), '', 'LATAM');
      const f = makeAvoidFilter(cats);
      for (const slot of SLOTS) {
        expect(bank[slot].filter((d) => f(d)).map((d) => d.nombre), `${cats} · ${slot}`).toEqual([]);
        expect(bank[slot].filter((d) => d.tiempo !== slot).map((d) => d.nombre), `${cats} · ${slot} cruza tiempo`).toEqual([]);
      }
    }
  });

  it('6 · ruta determinista · effectiveAvoid se respeta en todos los platillos servidos', () => {
    const perm = permanentAvoidFrom({ avoid: 'lacteos,cacahuate' });
    const eff = effectiveAvoid(perm, weeklyAvoidFrom('pescado'));
    for (const seed of [1, 8, 33]) {
      const days = buildWeeklyPlan(mk(2200), { seed, avoid: eff });
      for (const cat of eff) expect(restrictionLeaks(days, [cat]), `seed ${seed} · ${cat}`).toEqual([]);
    }
  });

  it('4 · con múltiples restricciones, ningún fallback elimina ninguna', () => {
    const eff = ['gluten', 'lacteos', 'huevo', 'frutos-secos', 'pescado'];
    for (const seed of [4, 21]) {
      const days = buildWeeklyPlan(mk(2500), { seed, avoid: eff });
      expect(days).toHaveLength(7);
      // cada categoría por separado: ninguna puede haberse "caído" del conjunto
      for (const cat of eff) expect(restrictionLeaks(days, [cat]), `seed ${seed} · ${cat}`).toEqual([]);
      // y el conjunto completo a la vez
      expect(restrictionLeaks(days, eff), `seed ${seed} · conjunto`).toEqual([]);
    }
  });

  it('buildDayWithFixed respeta las restricciones en todos sus tiempos', () => {
    const bowl: FixedMeal = { slot: 'Comida', name: 'Bowl Verde', kcal: 737, prot: 59, fat: 31, carb: 64 };
    const eff = ['gluten', 'lacteos', 'huevo'];
    const day = buildDayWithFixed(mk(2400), bowl, { avoid: eff }, 1);
    expect(restrictionLeaks([day], eff)).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D · FAIL CLOSED · la imposibilidad se reconoce, no se disimula
// ═════════════════════════════════════════════════════════════════════════════
describe('P0-03 · D · fail closed', () => {
  it('8 · un caso imposible termina en error controlado, no en un platillo incorrecto', () => {
    let lanzado: unknown = null;
    try { buildWeeklyPlan(mk(2000), { seed: 1, avoid: SIN_NADA_FUERTE }); } catch (e) { lanzado = e; }
    expect(lanzado, 'debe lanzar, no devolver un plan inventado').toBeInstanceOf(NoEligibleDishesError);
  });

  it('8 · el error es identificable por tipo y por nombre (sobrevive al bundling)', () => {
    const err = new NoEligibleDishesError('Cena', ['lacteos']);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(NoEligibleDishesError);
    expect(err.name).toBe('NoEligibleDishesError');
    expect(err.slot).toBe('Cena');
    expect(err.avoid).toEqual(['lacteos']);
  });

  it('un caso posible NO lanza: la señal es específica, no un apagón general', () => {
    expect(() => buildWeeklyPlan(mk(2000), { seed: 1, avoid: ['gluten', 'lacteos', 'huevo'] })).not.toThrow();
    expect(() => buildWeeklyPlan(mk(2000), { seed: 1, avoid: [] })).not.toThrow();
  });

  it('ninguna ruta devuelve un plan de menos de 7 días en silencio', () => {
    for (const avoid of [[], ['gluten'], ['gluten', 'lacteos', 'huevo'], ['lacteos', 'ajonjoli', 'mariscos']]) {
      expect(buildWeeklyPlan(mk(2200), { seed: 6, avoid }), `avoid=[${avoid}]`).toHaveLength(7);
    }
  });

  it('7 · el call-site del bowl protege la UI del fallo cerrado', () => {
    // buildDayWithFixed ahora puede lanzar: TabHoy no puede quedar sin guardia
    expect(srcTabHoy, 'la llamada a buildDayWithFixed debe estar envuelta').toMatch(/try\s*\{[\s\S]{0,800}buildDayWithFixed/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// F · LAS CATEGORÍAS NO SOPORTADAS NO PUEDEN LLEGAR AL MOTOR
//
// La Decisión 01 declara `vegetariano`/`vegano` capacidad NO soportada: el banco no tiene
// profundidad para sostenerlas. HSC no tiene todavía usuarios reales, así que no hay
// población histórica que preservar, y admitirlas sería peor que ignorarlas (el motor no
// podría construir ningún plan). Que sigan existiendo términos en AVOID_MAP es capacidad
// inactiva, no una promesa: lo que estos tests fijan es que es INALCANZABLE desde los datos.
// ═════════════════════════════════════════════════════════════════════════════
describe('P0-03 · F · vegetariano/vegano son inalcanzables desde los datos activos', () => {
  const NO_SOPORTADAS = ['vegetariano', 'vegano'];

  it('un obData.avoid de desarrollo con vegetariano/vegano no produce restricción efectiva', () => {
    for (const v of NO_SOPORTADAS) {
      expect(permanentAvoidFrom({ avoid: v }), `permanente ${v}`).toEqual([]);
      expect(weeklyAvoidFrom(v), `semanal ${v}`).toEqual([]);
      expect(effectiveAvoid([v], [v]), `efectiva ${v}`).toEqual([]);
    }
    // mezclado con categorías reales: sobreviven las soportadas y solo ellas
    expect(permanentAvoidFrom({ avoid: 'vegano,lacteos,vegetariano,gluten' }))
      .toEqual(['lacteos', 'gluten']);
    expect(effectiveAvoid(permanentAvoidFrom({ avoid: 'vegetariano,huevo' }), weeklyAvoidFrom('vegano,pescado')))
      .toEqual(['huevo', 'pescado']);
  });

  it('todo lo que SÍ llega al motor es una de las 10 soportadas', () => {
    const SOPORTADAS = new Set(['gluten', 'lacteos', 'huevo', 'frutos-secos', 'cacahuate',
      'soya', 'ajonjoli', 'pescado', 'mariscos', 'carne-roja']);
    const sucios = ['vegano', 'vegetariano', 'paleo', 'keto', 'todas', 'nada', 'lacteos', 'maní'];
    const eff = effectiveAvoid(permanentAvoidFrom({ avoid: sucios.join(',') }), weeklyAvoidFrom(sucios));
    for (const c of eff) expect(SOPORTADAS.has(c), `${c} no es una categoría soportada`).toBe(true);
    expect(eff).toEqual(['lacteos', 'cacahuate']);   // 'maní' se canoniza; el resto se descarta
  });

  it('la regeneración de un plan guardado tampoco las readmite', () => {
    // un plan de desarrollo guardado con vegano en su bloque gen
    const usado = avoidForRegen(
      { avoid: ['vegano', 'gluten'], avoidWeekly: ['vegano'] },
      'vegetariano, vegano',
      { avoid: 'vegano,lacteos' },
    );
    expect(usado).not.toContain('vegano');
    expect(usado).not.toContain('vegetariano');
    expect(usado).toContain('lacteos');
  });

  // Consecuencia de todo lo anterior: la imposibilidad que P0-03 sabe declarar NO es
  // alcanzable por un usuario del producto actual. Con las 10 soportadas ningún tiempo se
  // vacía (grupo A), y las dos categorías que sí vaciaban el banco ya no pueden entrar.
  it('el fail-closed queda como red de seguridad, no como estado alcanzable', () => {
    const eff = effectiveAvoid(permanentAvoidFrom({ avoid: 'vegano,vegetariano' }), []);
    expect(eff).toEqual([]);
    expect(() => buildWeeklyPlan(mk(2200), { seed: 7, avoid: eff })).not.toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E · LOS HELPERS QUE SÍ PUEDEN RELAJAR (y por qué son seguros)
// ═════════════════════════════════════════════════════════════════════════════
describe('P0-03 · E · las relajaciones permitidas no tocan las invariantes', () => {
  it('relajar "no repetir hoy" mantiene tiempo y restricciones', () => {
    // un pool de 1 solo platillo fuerza a avail()/libre() a devolver el ya usado
    const eff = ['gluten', 'lacteos', 'huevo', 'frutos-secos', 'cacahuate', 'soya', 'ajonjoli', 'pescado', 'mariscos', 'carne-roja'];
    const days = buildWeeklyPlan(mk(1600), { seed: 9, avoid: eff });
    expect(days).toHaveLength(7);
    expect(timeCrossings(days)).toEqual([]);
    expect(restrictionLeaks(days, eff)).toEqual([]);
  });

  it('la degradación por relax (variedad/carbo) no cruza de tiempo ni relaja restricciones', () => {
    // metas extremas fuerzan relax≥1 y relax≥2
    for (const kcal of [1300, 3800]) {
      for (const avoid of [['gluten', 'lacteos'], ['lacteos', 'mariscos']]) {
        const days = buildWeeklyPlan(mk(kcal), { seed: 12, avoid });
        expect(timeCrossings(days), `${kcal} · ${avoid}`).toEqual([]);
        expect(restrictionLeaks(days, avoid), `${kcal} · ${avoid}`).toEqual([]);
      }
    }
  });
});
