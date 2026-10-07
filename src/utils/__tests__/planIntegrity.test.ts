import { describe, it, expect } from 'vitest';
import srcStore from '../../store/index.ts?raw';
import srcApp from '../../App.tsx?raw';
import srcAutoRegen from '../useAutoRegenPlan.ts?raw';
import srcTabHoy from '../../components/TabHoy.tsx?raw';
import { BANCO, type BancoDish } from '../../data/banco';
import { PLAN_ENGINE_VERSION, buildWeeklyPlan, makeAvoidFilter, type PlanTarget } from '../planEngine';
import { avoidForRegen, effectiveAvoid, permanentAvoidFrom, weeklyAvoidFrom } from '../avoidAuthority';
import {
  validatePlan, planIfValid, classifyService, normalizeSlot, InvalidPlanError,
  type PlanViolation,
} from '../planIntegrity';

// ─────────────────────────────────────────────────────────────────────────────
// P0-04 · VALIDACIÓN FINAL DEL PLAN.
//
// Barrera de integridad sobre el plan TERMINADO: restricciones efectivas ACTUALES + tiempo
// de comida + la forma mínima para poder comprobar las dos. Nada de macros ni calidad.
//
// Lo que hace falta probar de verdad es (a) que detecta las dos violaciones, (b) que las
// tres formas legítimas sin BancoDish detrás no se marcan como falsas violaciones, y
// (c) que esas excepciones NO son un bypass para cualquier nombre desconocido.
// ─────────────────────────────────────────────────────────────────────────────

const mk = (kcal: number): PlanTarget => ({
  kcal, protG: Math.round(kcal * 0.3 / 4), fatG: Math.round(kcal * 0.27 / 9), carbG: Math.round(kcal * 0.43 / 4),
});
const dishOf = (tiempo: string, pred: (d: BancoDish) => boolean = () => true) =>
  BANCO.find((d) => d.tiempo === tiempo && pred(d))!;
const kinds = (vs: PlanViolation[]) => [...new Set(vs.map((v) => v.kind))].sort();

/** Un plan de 7 días bien formado, con los servicios que se le pasen para el día 1. */
function planCon(mealsDia1: Array<Record<string, unknown>>, extra: Record<string, unknown> = {}) {
  const des = dishOf('Desayuno'), com = dishOf('Comida'), cen = dishOf('Cena'), sn = dishOf('Snack');
  const diaOk = (n: number) => ({ day: n, theme: '', meals: [
    { time: 'Desayuno', name: des.nombre, desc: '', portions: ['x'], ings: des.ings.map((i) => ({ nv: i.nv, g: 1, rol: i.rol })) },
    { time: 'Snack AM', name: sn.nombre, desc: '', portions: ['x'], ings: sn.ings.map((i) => ({ nv: i.nv, g: 1, rol: i.rol })) },
    { time: 'Comida', name: com.nombre, desc: '', portions: ['x'], ings: com.ings.map((i) => ({ nv: i.nv, g: 1, rol: i.rol })) },
    { time: 'Cena', name: cen.nombre, desc: '', portions: ['x'], ings: cen.ings.map((i) => ({ nv: i.nv, g: 1, rol: i.rol })) },
  ] });
  return {
    generatedAt: '2026-09-01T00:00:00.000Z', mealPlanKey: 'planA',
    selectedDays: [1, 2, 3, 4, 5, 6, 7], shoppingList: [], nota: '', preferences: '',
    engineVersion: PLAN_ENGINE_VERSION,
    gen: { kcal: 2000, protG: 150, fatG: 60, carbG: 215, avoid: [] as string[], avoidWeekly: [] as string[] },
    days: [{ day: 1, theme: '', meals: mealsDia1 }, ...[2, 3, 4, 5, 6, 7].map(diaOk)],
    ...extra,
  };
}
/** Servicio normal, resoluble, construido desde un platillo real del banco. */
const servicio = (d: BancoDish, time = d.tiempo) => ({
  time, name: d.nombre, desc: '', portions: ['porción'],
  ings: d.ings.map((i) => ({ nv: i.nv, g: 1, rol: i.rol })),
});

// ═════════════════════════════════════════════════════════════════════════════
// A · UN PLAN REAL DEL MOTOR SIEMPRE ES VÁLIDO (control de falsos positivos)
// ═════════════════════════════════════════════════════════════════════════════
describe('P0-04 · A · los planes que el motor produce hoy pasan la validación', () => {
  it('planes reales con y sin restricciones → 0 violaciones', () => {
    for (const avoid of [[], ['lacteos'], ['gluten', 'lacteos', 'huevo'], ['pescado', 'mariscos']]) {
      for (const seed of [7, 31]) {
        const days = buildWeeklyPlan(mk(2200), { seed, avoid });
        const plan = { ...planCon([]), days, gen: { kcal: 2200, protG: 165, fatG: 66, carbG: 237, avoid, avoidWeekly: avoid } };
        const v = validatePlan(plan, avoid);
        expect(v.violations, `avoid=[${avoid}] seed=${seed}`).toEqual([]);
        expect(v.valid).toBe(true);
      }
    }
  });

  it('un plan real con BATIDO (forma especial) sigue siendo válido', () => {
    const shake = { slots: ['am'] as ('am' | 'pm')[], type: 'vegana' as const, protG: 30 };
    const days = buildWeeklyPlan(mk(2600), { seed: 5, avoid: ['lacteos'], shake });
    const nombres = days.flatMap((d) => d.meals.map((m) => m.name));
    expect(nombres, 'el plan debe traer el batido').toContain('Batido de Proteína');
    expect(validatePlan({ ...planCon([]), days }, ['lacteos']).violations).toEqual([]);
  });

  it('un plan real con SNACKS COMBINADOS ("A + B") sigue siendo válido', () => {
    const days = buildWeeklyPlan(mk(3000), { seed: 9 });   // >2200 kcal → 2 snacks por slot
    const combinados = days.flatMap((d) => d.meals.filter((m) => m.name.includes(' + ')));
    expect(combinados.length, 'el plan debe traer snacks combinados').toBeGreaterThan(0);
    expect(validatePlan({ ...planCon([]), days }, []).violations).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B · INVARIANTE DE RESTRICCIONES
// ═════════════════════════════════════════════════════════════════════════════
describe('P0-04 · B · ningún servicio puede violar las restricciones efectivas', () => {
  it('1 · un plan terminado con un alimento prohibido se rechaza, señalando el platillo', () => {
    const conLacteos = BANCO.find((d) => d.tiempo === 'Desayuno' && makeAvoidFilter(['lacteos'])(d))!;
    const v = validatePlan(planCon([servicio(conLacteos)]), ['lacteos']);
    expect(v.valid).toBe(false);
    expect(kinds(v.violations)).toEqual(['restriction']);
    expect(v.violations[0].dish).toBe(conLacteos.nombre);
    expect(v.violations[0].day).toBe(1);
    expect(v.violations[0].slot).toBe('Desayuno');
  });

  it('usa el detector REAL de P0-01: alérgeno vía SUB-RECETA, no solo por el nombre', () => {
    // un platillo cuyo lácteo entra por una sub-receta (aderezo/tzatziki), no por su nombre
    const porSub = BANCO.find((d) =>
      makeAvoidFilter(['lacteos'])(d) &&
      !/queso|yogur|leche|crema/i.test(d.nombre) &&
      d.ings.some((i) => i.rol === 'sub-receta' || /aderezo|tzatziki|pesto|cesar/i.test(i.nv)));
    if (porSub) {
      const v = validatePlan(planCon([servicio(porSub, 'Desayuno')]), ['lacteos']);
      // solo el día 1: los días de relleno del helper son platillos reales y pueden
      // violar legítimamente la categoría que se esté probando.
      expect(v.violations.some((x) => x.day === 1 && x.kind === 'restriction'), `${porSub.nombre}`).toBe(true);
    }
  });

  it('NO inventa violaciones por el nombre (Decisión 05 / P0-01 respetadas)', () => {
    // "Hot Cakes"/"Waffles" de avena: el nombre suena a gluten, la composición no lo es.
    const falso = BANCO.find((d) => /hot ?cake|waffle/i.test(d.nombre) && !makeAvoidFilter(['gluten'])(d));
    if (falso) {
      const v = validatePlan(planCon([servicio(falso, 'Desayuno')]), ['gluten']);
      // día 1 = el platillo bajo prueba; los de relleno sí pueden llevar gluten de verdad.
      expect(v.violations.filter((x) => x.day === 1 && x.kind === 'restriction'), falso.nombre).toEqual([]);
    }
  });

  it('con restricciones vacías no hay violaciones de restricción', () => {
    const conLacteos = BANCO.find((d) => d.tiempo === 'Desayuno' && makeAvoidFilter(['lacteos'])(d))!;
    expect(validatePlan(planCon([servicio(conLacteos)]), []).violations).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C · INVARIANTE DE TIEMPO
// ═════════════════════════════════════════════════════════════════════════════
describe('P0-04 · C · cada platillo en su tiempo', () => {
  it('2 · una Cena servida como Desayuno se rechaza', () => {
    const cena = dishOf('Cena');
    const v = validatePlan(planCon([servicio(cena, 'Desayuno')]), []);
    expect(v.valid).toBe(false);
    expect(kinds(v.violations)).toEqual(['time']);
    expect(v.violations[0].detail).toMatch(/es de Cena y está servido en Desayuno/);
  });

  it('un Snack servido como Comida se rechaza (el caso que P0-03 destapó)', () => {
    const snack = dishOf('Snack');
    const v = validatePlan(planCon([servicio(snack, 'Comida')]), []);
    expect(v.violations.some((x) => x.kind === 'time')).toBe(true);
  });

  it('Snack AM y Snack PM se normalizan a Snack: un snack ahí NO es violación', () => {
    expect(normalizeSlot('Snack AM')).toBe('Snack');
    expect(normalizeSlot('Snack PM')).toBe('Snack');
    expect(normalizeSlot('Cena')).toBe('Cena');
    const snack = dishOf('Snack');
    for (const t of ['Snack AM', 'Snack PM']) {
      expect(validatePlan(planCon([servicio(snack, t)]), []).violations, t).toEqual([]);
    }
  });

  it('en un snack combinado se comprueba CADA parte', () => {
    const a = dishOf('Snack'), cena = dishOf('Cena');
    const combinado = {
      time: 'Snack AM', name: `${a.nombre} + ${cena.nombre}`, desc: '', portions: ['x', 'y'],
      ings: [...a.ings, ...cena.ings].map((i) => ({ nv: i.nv, g: 1, rol: i.rol })),
    };
    const v = validatePlan(planCon([combinado]), []);
    const t = v.violations.filter((x) => x.kind === 'time');
    expect(t).toHaveLength(1);
    expect(t[0].dish, 'señala la parte culpable, no el nombre entero').toBe(cena.nombre);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D · CONTRATO DE LAS FORMAS ESPECIALES (y que no son un bypass)
// ═════════════════════════════════════════════════════════════════════════════
describe('P0-04 · D · formas especiales vs nombre desconocido', () => {
  const BOWL = { time: 'Comida', name: 'Bowl Verde', desc: 'del food truck', portions: ['Bowl Verde'], ings: [] as unknown[] };
  const BATIDO = { time: 'Snack AM', name: 'Batido de Proteína', desc: '30 g proteína', portions: ['1 scoop de proteína — 30 g proteína'], ings: [{ nv: 'Proteína en polvo', g: 0, rol: 'principal' }] };

  it('clasifica cada forma por su ESTRUCTURA', () => {
    expect(classifyService(servicio(dishOf('Comida')))).toBe('dish');
    expect(classifyService(BOWL)).toBe('bowl');
    expect(classifyService(BATIDO)).toBe('shake');
    const a = dishOf('Snack'), b = BANCO.filter((d) => d.tiempo === 'Snack')[1];
    expect(classifyService({ ...BOWL, name: `${a.nombre} + ${b.nombre}`, ings: [{ nv: a.ings[0].nv }], portions: ['x', 'y'] })).toBe('combined');
  });

  it('3 · un BOWL y un BATIDO legítimos NO son violación', () => {
    expect(validatePlan(planCon([BOWL]), []).violations).toEqual([]);
    expect(validatePlan(planCon([BATIDO]), []).violations).toEqual([]);
  });

  it('4 · un nombre DESCONOCIDO se rechaza, no hereda la exención', () => {
    const fantasma = { time: 'Comida', name: 'Pizza de Pepperoni Gigante', desc: '', portions: ['1 pizza — 400 g'], ings: [{ nv: 'Masa de pizza', g: 400, rol: 'principal' }] };
    const v = validatePlan(planCon([fantasma]), []);
    expect(v.valid).toBe(false);
    expect(kinds(v.violations)).toEqual(['unknown-dish']);
    expect(v.violations[0].dish).toBe('Pizza de Pepperoni Gigante');
  });

  it('no se puede DISFRAZAR un desconocido de batido usando su nombre', () => {
    const falsoBatido = { ...BATIDO, ings: [{ nv: 'Pastel de chocolate', g: 200, rol: 'principal' }] };
    expect(classifyService(falsoBatido)).toBe('unknown');
    expect(validatePlan(planCon([falsoBatido]), []).violations.some((x) => x.kind === 'unknown-dish')).toBe(true);
  });

  it('no se puede disfrazar un desconocido de bowl: la firma exige 0 ingredientes y 1 porción = su nombre', () => {
    for (const impostor of [
      { ...BOWL, ings: [{ nv: 'Chorizo', g: 100, rol: 'principal' }] },   // tiene ingredientes
      { ...BOWL, portions: ['Otra cosa'] },                               // la porción no es su nombre
      { ...BOWL, portions: ['Bowl Verde', 'extra'] },                     // más de una porción
    ]) {
      expect(classifyService(impostor), JSON.stringify(impostor.portions)).toBe('unknown');
    }
  });

  it('una parte desconocida dentro de un "A + B" invalida el servicio', () => {
    const a = dishOf('Snack');
    const medio = { time: 'Snack AM', name: `${a.nombre} + Galletas Rellenas de Chocolate`, desc: '', portions: ['x'], ings: [{ nv: a.ings[0].nv, g: 1, rol: 'principal' }] };
    expect(classifyService(medio)).toBe('unknown');
    expect(validatePlan(planCon([medio]), []).violations.some((x) => x.kind === 'unknown-dish')).toBe(true);
  });

  it('el BATIDO solo puede ocupar un snack: en una comida fuerte es violación de tiempo', () => {
    const v = validatePlan(planCon([{ ...BATIDO, time: 'Comida' }]), []);
    expect(v.violations.some((x) => x.kind === 'time' && /batido/i.test(x.detail))).toBe(true);
  });

  it('un BOWL cuyo nombre delata un alimento excluido se marca (comprobación débil, documentada)', () => {
    const bowlSalmon = { time: 'Comida', name: 'Bowl de Salmón', desc: '', portions: ['Bowl de Salmón'], ings: [] as unknown[] };
    expect(classifyService(bowlSalmon)).toBe('bowl');
    expect(validatePlan(planCon([bowlSalmon]), ['pescado']).violations.some((x) => x.kind === 'restriction')).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E · INTEGRIDAD ESTRUCTURAL MÍNIMA
// ═════════════════════════════════════════════════════════════════════════════
describe('P0-04 · E · forma mínima para poder validar', () => {
  it('rechaza lo que no se puede evaluar, sin reventar', () => {
    for (const malo of [null, undefined, 42, 'plan', {}, { days: null }, { days: [] }]) {
      const v = validatePlan(malo, ['lacteos']);
      expect(v.valid, JSON.stringify(malo)).toBe(false);
      expect(v.violations[0].kind).toBe('shape');
    }
  });

  it('exige 7 días', () => {
    const p = planCon([servicio(dishOf('Desayuno'))]);
    const v = validatePlan({ ...p, days: p.days.slice(0, 3) }, []);
    expect(v.violations.some((x) => x.kind === 'shape' && /3 días/.test(x.detail))).toBe(true);
  });

  it('un día sin comidas, o una comida sin time/name, es defecto de forma', () => {
    expect(validatePlan(planCon([]), []).violations.some((x) => x.kind === 'shape')).toBe(true);
    expect(validatePlan(planCon([{ name: 'X' }]), []).violations.some((x) => x.kind === 'shape')).toBe(true);
    expect(validatePlan(planCon([{ time: 'Comida' }]), []).violations.some((x) => x.kind === 'shape')).toBe(true);
  });

  it('acumula TODAS las violaciones, no solo la primera', () => {
    const cena = dishOf('Cena');
    const conLacteos = BANCO.find((d) => d.tiempo === 'Comida' && makeAvoidFilter(['lacteos'])(d))!;
    const v = validatePlan(planCon([servicio(cena, 'Desayuno'), servicio(conLacteos)]), ['lacteos']);
    expect(v.violations.length).toBeGreaterThanOrEqual(2);
    expect(kinds(v.violations)).toEqual(['restriction', 'time']);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// F · planIfValid · la puerta de las rutas de hidratación
// ═════════════════════════════════════════════════════════════════════════════
describe('P0-04 · F · planIfValid', () => {
  it('devuelve el plan si es válido y null si no', () => {
    const bueno = planCon([servicio(dishOf('Desayuno'))]);
    expect(planIfValid(bueno, [])).toBe(bueno);
    expect(planIfValid(planCon([servicio(dishOf('Cena'), 'Desayuno')]), [])).toBeNull();
  });

  it('la ausencia de plan no es un defecto', () => {
    expect(planIfValid(null, ['lacteos'])).toBeNull();
    expect(planIfValid(undefined, ['lacteos'])).toBeNull();
  });

  it('InvalidPlanError lleva el veredicto y es identificable', () => {
    const v = validatePlan(planCon([servicio(dishOf('Cena'), 'Desayuno')]), []);
    const err = new InvalidPlanError(v);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('InvalidPlanError');
    expect(err.verdict.violations).toHaveLength(1);
    expect(err.message).toMatch(/Plan inválido/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// G · EL AGUJERO DEL BOWL · gen.avoid obsoleto vs perfil actual
// ═════════════════════════════════════════════════════════════════════════════
describe('P0-04 · G · el bowl ya no puede usar restricciones obsoletas', () => {
  it('5 · un plan válido con su gen.avoid viejo es INVÁLIDO contra el perfil endurecido', () => {
    // el plan se generó sin restricciones y sirve pescado; el perfil ahora excluye pescado
    const conPescado = BANCO.find((d) => d.tiempo === 'Comida' && makeAvoidFilter(['pescado'])(d))!;
    const plan = planCon([servicio(conPescado)], { preferences: '' });
    // válido con lo que el plan recuerda…
    expect(validatePlan(plan, plan.gen.avoid).valid).toBe(true);
    // …e inválido con lo que el perfil dice AHORA
    const ahora = avoidForRegen(plan.gen, plan.preferences, { avoid: 'pescado' });
    expect(ahora).toContain('pescado');
    expect(validatePlan(plan, ahora).valid).toBe(false);
  });

  it('avoidForRegen es la fuente que usan los tres puntos: permanentes de AHORA ∪ semana del plan', () => {
    const r = avoidForRegen({ avoid: ['gluten'], avoidWeekly: ['gluten'] }, '', { avoid: 'lacteos,huevo' });
    expect([...r].sort()).toEqual(['gluten', 'huevo', 'lacteos']);
  });

  it('TabHoy construye el día con las restricciones actuales, no con g.avoid', () => {
    expect(srcTabHoy).toMatch(/avoidForRegen\(\s*g\s*,/);
    expect(srcTabHoy, 'ya no debe pasar g.avoid al motor').not.toMatch(/avoid:\s*g\.avoid/);
    expect(srcTabHoy, 'el guardado del bowl debe atrapar el rechazo').toMatch(/saveWeeklyPlan\(\{[^}]*\}\)\s*\n?\s*\.catch/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H · LOS PUNTOS DE INTEGRACIÓN ESTÁN CABLEADOS
// ═════════════════════════════════════════════════════════════════════════════
describe('P0-04 · H · las cuatro puertas', () => {
  it('AL GUARDAR · saveWeeklyPlan valida contra el perfil actual ANTES del set', () => {
    const save = srcStore.slice(srcStore.indexOf('saveWeeklyPlan: async (plan)'), srcStore.indexOf('clearWeeklyPlan: async'));
    expect(save).toMatch(/validatePlan\(plan,\s*avoidAhora\)/);
    expect(save).toMatch(/avoidForRegen\(plan\.gen, plan\.preferences, prevState\.obData\)/);
    expect(save).toMatch(/throw err/);
    // el orden importa: validar DESPUÉS del set no evitaría nada
    expect(save.indexOf('validatePlan'), 'valida antes de set({ weeklyPlan')
      .toBeLessThan(save.indexOf('set({ weeklyPlan: plan })'));
  });

  it('AL CARGAR (Supabase) · el pull remoto pasa por planIfValid', () => {
    expect(srcApp).toMatch(/planIfValid\(remotePlan, avoid\)/);
    expect(srcApp, 'ya no debe entrar crudo').not.toMatch(/setState\(\{ weeklyPlan: remotePlan \}\)/);
  });

  it('AL HIDRATAR (localStorage) · merge sanea el plan antes de que exista el estado', () => {
    expect(srcStore).toMatch(/merge:\s*\(persisted, current\)/);
    expect(srcStore).toMatch(/merged\.weeklyPlan = planIfValid/);
  });

  it('ANTES DE RENDER · el gate sigue siendo el estructural barato, sin duplicar autoridad', () => {
    // P0-04 no mete validación en el render: toda entrada al estado ya está cubierta.
    expect(srcTabHoy).toMatch(/hasGeneratedWeeklyPlan/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// I · VERSIÓN DEL MOTOR + REGIÓN EN LA AUTO-REGENERACIÓN
// ═════════════════════════════════════════════════════════════════════════════
describe('P0-04 · I · versión y región', () => {
  it('6 · PLAN_ENGINE_VERSION = 33 → un plan v32 (macros legacy) queda por debajo y se regenera', () => {
    expect(PLAN_ENGINE_VERSION).toBe(33);
    const guardado = 32;
    expect(guardado >= PLAN_ENGINE_VERSION, 'un plan v32 YA NO debe considerarse al día').toBe(false);
    // C4 · el gate dejó de ser una comparación suelta en el efecto: ahora lo hace
    // `weeklyPlanCurrentness`, que compara la versión Y la cifra prescrita. La
    // comparación de versión sigue existiendo, pero dentro del selector.
    expect(srcAutoRegen).toMatch(/weeklyPlanCurrentness\(/);
    expect(srcAutoRegen).toMatch(/currentVersion: PLAN_ENGINE_VERSION/);
    expect(srcAutoRegen).toMatch(/currentness !== 'STALE'/);
  });

  it('7 · la auto-regeneración pasa región, con la MISMA derivación que la generación normal', () => {
    expect(srcAutoRegen).toMatch(/generateWeeklyPlan\(target, avoid, craving, Date\.now\(\) & 0x7fffffff, shake, region\)/);
    const deriva = /obData\.country\s*\n?\s*\?\s*regionFromCountry\(String\(obData\.country\)\)\s*\n?\s*:\s*\(getCachedRegion\(\) \?\? undefined\)/;
    expect(srcAutoRegen, 'misma derivación país → región').toMatch(deriva);
  });

  it('la región cambia el plan, así que pasarla no es cosmético', () => {
    const nombres = (r?: 'LATAM' | 'EUROPE') =>
      buildWeeklyPlan(mk(2200), { seed: 11, region: r }).flatMap((d) => d.meals.map((m) => m.name)).join('|');
    expect(nombres('EUROPE')).not.toBe(nombres('LATAM'));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// J · LA CADENA COMPLETA P0-01 → P0-04
// ═════════════════════════════════════════════════════════════════════════════
describe('P0-04 · J · la cadena entera', () => {
  it('perfil + semana → effectiveAvoid → plan generado → validación: 0 violaciones', () => {
    const avoid = effectiveAvoid(permanentAvoidFrom({ avoid: 'lacteos,cacahuate' }), weeklyAvoidFrom('pescado'));
    expect([...avoid].sort()).toEqual(['cacahuate', 'lacteos', 'pescado']);
    const days = buildWeeklyPlan(mk(2300), { seed: 21, avoid, region: 'LATAM' });
    expect(validatePlan({ ...planCon([]), days }, avoid).violations).toEqual([]);
  });

  it('las categorías no soportadas no llegan a la validación (P0-03)', () => {
    const avoid = avoidForRegen({ avoid: ['vegano'] }, '', { avoid: 'vegetariano' });
    expect(avoid).toEqual([]);
    const days = buildWeeklyPlan(mk(2200), { seed: 3, avoid });
    expect(validatePlan({ ...planCon([]), days }, avoid).valid).toBe(true);
  });
});
