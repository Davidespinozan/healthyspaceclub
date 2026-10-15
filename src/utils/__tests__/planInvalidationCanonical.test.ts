import { describe, it, expect, vi, beforeEach } from 'vitest';

// El store importa el cliente de Supabase: se simula (sin usuario no se escribe nada).
vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: null } }) }, from: () => ({ upsert: async () => ({ error: null }) }) },
}));

import { BANCO, type BancoDish } from '../../data/banco';
import { solveSlot, makeAvoidFilter, buildWeeklyPlan, type ProteinShake, type PlanTarget } from '../planEngine';
import { validatePlan } from '../planIntegrity';
import {
  planViolatesAvoid, planInvalidatedByAvoidChange, PERMANENT_AVOID_CATALOG,
  effectiveAvoid, permanentAvoidFrom, weeklyAvoidFrom,
} from '../avoidAuthority';
import { useAppStore } from '../../store';
import type { DayPlan, MealItem } from '../../types';
import AUTHORITY_SRC from '../avoidAuthority.ts?raw';

// ─────────────────────────────────────────────────────────────────────────────
// RESTRICTIONS SAFETY · INVALIDACIÓN CANÓNICA. Al endurecer restricciones, el plan vigente se
// descarta SOLO si la autoridad canónica (la misma de generación y validación final) encuentra
// una violación real. Antes, una búsqueda por texto borraba planes seguros (falsos positivos)
// y dejaba pasar alérgenos ocultos (falsos negativos).
// ─────────────────────────────────────────────────────────────────────────────

const TARGET: PlanTarget = { kcal: 2400, protG: 160, fatG: 70, carbG: 280 };
const dish = (nombre: string) => {
  const d = BANCO.find((x) => x.nombre === nombre);
  if (!d) throw new Error(`no está en el banco: ${nombre}`);
  return d;
};
/** El servicio tal como lo sirve el motor (nombre, ingredientes y porciones reales). */
const served = (d: BancoDish): MealItem => solveSlot([d], d.tiempo === 'Snack' ? 'Snack AM' : d.tiempo, [0, 25, 12, 40])[0];
/** Plan mínimo con el servicio de `d`. Un solo día → `validatePlan` añade una violación de FORMA,
 *  que no es de restricciones: así cada caso prueba además que solo cuenta `restriction`. */
const planWith = (d: BancoDish) => ({ days: [{ day: 1, theme: '', meals: [served(d)] }] as DayPlan[] });

const GLUTEN_FALSE_POSITIVES = [
  'Hot Cakes de Avena', 'Hot Cakes de Chocolate', 'Hot Cakes de Zanahoria', 'Hot Cakes de Camote',
  'Waffles Caseros con Fruta y Miel', 'Galletas de Arroz con Crema de Cacahuate y Plátano',
];

describe('AUTORIDAD ÚNICA · la invalidación coincide con el detector canónico en TODO el banco', () => {
  it('para cada platillo y cada categoría: invalida ⇔ makeAvoidFilter dice que viola', () => {
    const diffs: string[] = [];
    for (const cat of PERMANENT_AVOID_CATALOG) {
      const viola = makeAvoidFilter([cat]);
      for (const d of BANCO) {
        const inv = planViolatesAvoid({ days: [{ meals: [served(d)] }] }, [cat]);
        if (inv !== viola(d)) diffs.push(`${cat} · ${d.nombre}: invalida=${inv} canónico=${viola(d)}`);
      }
    }
    expect(diffs).toEqual([]);
  });
  it('no queda una segunda lógica de texto en la invalidación', () => {
    const code = AUTHORITY_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/textMatchesAvoid|expandAvoidCats/);
    // MB2 · solo STRICT: un cambio de restricciones permanentes nunca se juzga con el modo suave
    expect(code).toMatch(/validatePlan\(plan, \{ strict: norm, soft: \[\] \}\)\.violations\.some\(\(v\) => v\.kind === 'restriction' \|\| v\.kind === 'unverifiable'\)/);
  });
});

describe('A · falsos positivos conocidos de gluten: compatibles por composición → NO invalidan', () => {
  it.each(GLUTEN_FALSE_POSITIVES)('%s', (nombre) => {
    const d = dish(nombre);
    expect(makeAvoidFilter(['gluten'])(d), 'el detector canónico lo considera seguro').toBe(false);
    const plan = planWith(d);
    expect(planViolatesAvoid(plan, ['gluten'])).toBe(false);
    expect(planInvalidatedByAvoidChange('', 'gluten', plan)).toEqual({ invalidated: false, added: ['gluten'] });
  });
});

describe('B · platillo realmente incompatible con gluten → SÍ invalida', () => {
  it('un platillo con pan/pasta de trigo', () => {
    const d = BANCO.find((x) => makeAvoidFilter(['gluten'])(x) && /pasta|pan /i.test(x.nombre))!;
    expect(planViolatesAvoid(planWith(d), ['gluten']), d.nombre).toBe(true);
    expect(planInvalidatedByAvoidChange('', 'gluten', planWith(d)).invalidated).toBe(true);
  });
});

describe('C · alérgeno oculto (sub-receta / compuesto) → SÍ invalida (antes se escapaba)', () => {
  it.each([
    ['huevo', 'Tostadas de Atún'],                          // mayonesa
    ['gluten', 'Pollo Salteado Asiático con Verduras'],     // salsa de soya
    ['ajonjoli', 'Zanahoria y Pepino con Hummus'],          // tahini
    ['lacteos', 'Pasta Fría con Pollo y Aderezo Chipotle'], // aderezo
  ])('%s · %s', (cat, nombre) => {
    const d = dish(nombre);
    expect(makeAvoidFilter([cat])(d)).toBe(true);
    expect(planViolatesAvoid(planWith(d), [cat])).toBe(true);
  });
});

describe('D · excepción: si el detector canónico lo considera seguro, NO invalida', () => {
  it('ningún platillo seguro por composición invalida, en ninguna categoría', () => {
    for (const cat of PERMANENT_AVOID_CATALOG) {
      const seguros = BANCO.filter((d) => !makeAvoidFilter([cat])(d));
      for (const d of seguros.slice(0, 40)) expect(planViolatesAvoid(planWith(d), [cat]), `${cat} · ${d.nombre}`).toBe(false);
    }
  });
});

describe('E · restricción permanente y semanal: misma semántica', () => {
  it('lo que la generación semanal deja pasar, el endurecimiento permanente no lo borra', () => {
    const plan = { days: buildWeeklyPlan(TARGET, { seed: 5, avoid: effectiveAvoid([], weeklyAvoidFrom('gluten')) }) };
    expect(validatePlan(plan, ['gluten']).valid).toBe(true);
    expect(planInvalidatedByAvoidChange('', 'gluten', plan).invalidated).toBe(false);
  });
  it('alias de la entrada (Gluten, sin gluten…) llegan a la misma categoría', () => {
    const plan = planWith(dish('Hot Cakes de Avena'));
    for (const v of ['gluten', 'Gluten', 'sin gluten']) expect(planViolatesAvoid(plan, [v]), v).toBe(false);
    const malo = planWith(BANCO.find((x) => makeAvoidFilter(['gluten'])(x))!);
    for (const v of ['gluten', 'Gluten']) expect(planViolatesAvoid(malo, [v]), v).toBe(true);
  });
  it('la invalidación coincide con la validación final de las restricciones efectivas', () => {
    const plan = planWith(dish('Tostadas de Atún'));
    const eff = effectiveAvoid(permanentAvoidFrom({ avoid: 'huevo' }), weeklyAvoidFrom(''));
    expect(planViolatesAvoid(plan, eff)).toBe(validatePlan(plan, eff).violations.some((v) => v.kind === 'restriction' || v.kind === 'unverifiable'));
  });
});

describe('F / G · batido (regresión del fix recién cerrado)', () => {
  const shakePlan = (type: ProteinShake['type'], avoid: string[] = []) =>
    ({ days: buildWeeklyPlan({ kcal: 2473, protG: 148, fatG: 69, carbG: 315 }, { seed: 12345, avoid, shake: { slots: ['pm'], type, protG: 25 } }) });
  const isShake = (m: MealItem) => m.name.startsWith('Batido de Proteína');
  it('F · whey (solo o combinado) + lacteos → SÍ invalida', () => {
    for (const type of ['regular', 'massgainer'] as const) {
      const plan = shakePlan(type);
      expect(plan.days.flatMap((d) => d.meals).some(isShake)).toBe(true);
      expect(planViolatesAvoid(plan, ['lacteos']), type).toBe(true);
    }
    // whey COMBINADO (servicio "Batido de Proteína + <snack>") en un plan por lo demás sin lácteos
    const base = shakePlan('vegana', ['lacteos']);
    const combinado = base.days.flatMap((d) => d.meals).find((m) => m.name.startsWith('Batido de Proteína + '));
    if (combinado) {
      const whey = { ...combinado, desc: combinado.desc.replace(' (vegana)', ''), portions: [combinado.portions[0].replace(' (vegana)', ''), ...combinado.portions.slice(1)] };
      const d0 = base.days.findIndex((d) => d.meals.includes(combinado));
      const days = base.days.map((d, i) => (i === d0 ? { ...d, meals: d.meals.map((m) => (m === combinado ? whey : m)) } : d));
      expect(planViolatesAvoid({ days }, ['lacteos'])).toBe(true);
    }
  });
  it('G · vegana + lacteos con partes compatibles → NO invalida por el tipo de proteína', () => {
    const plan = shakePlan('vegana', ['lacteos']);
    expect(plan.days.flatMap((d) => d.meals).some(isShake)).toBe(true);
    expect(planViolatesAvoid(plan, ['lacteos'])).toBe(false);
  });
});

describe('H · un defecto que NO es de restricciones no invalida por cambio de restricciones', () => {
  it('violación de tiempo, forma o nombre desconocido → false', () => {
    const cena = dish(BANCO.find((d) => d.tiempo === 'Cena' && !makeAvoidFilter(['gluten'])(d))!.nombre);
    const fueraDeTiempo = { days: [{ meals: [{ ...served(cena), time: 'Desayuno' }] }] };
    expect(validatePlan(fueraDeTiempo, ['gluten']).violations.map((v) => v.kind)).toContain('time');
    expect(planViolatesAvoid(fueraDeTiempo, ['gluten'])).toBe(false);
    const desconocido = { days: [{ meals: [{ time: 'Comida', name: 'Platillo Inventado', desc: '', portions: ['x'], ings: [{ nv: 'Algo' }] }] }] };
    expect(validatePlan(desconocido, ['gluten']).violations.map((v) => v.kind)).toContain('unknown-dish');
    expect(planViolatesAvoid(desconocido, ['gluten'])).toBe(false);
  });
  it('sin plan / sin días / sin categorías / solo centinelas → false', () => {
    const plan = planWith(dish('Tostadas de Atún'));
    expect(planViolatesAvoid(null, ['huevo'])).toBe(false);
    expect(planViolatesAvoid({ days: [] }, ['huevo'])).toBe(false);
    expect(planViolatesAvoid(plan, [])).toBe(false);
    expect(planViolatesAvoid(plan, ['ninguno', 'vegano'])).toBe(false);
  });
});

describe('STORE · setObData(\'avoid\') usa la invalidación canónica', () => {
  const S = () => useAppStore.getState();
  beforeEach(() => { useAppStore.setState({ user: null, obData: { avoid: '' } as never, planClearedByAvoid: false }); });
  it('añadir gluten con un plan compatible por composición → el plan se conserva', () => {
    const plan = { ...planWith(dish('Hot Cakes de Avena')), generatedAt: 'x', mealPlanKey: 'planA', selectedDays: [1], shoppingList: [], nota: '', preferences: '' };
    useAppStore.setState({ weeklyPlan: plan as never });
    S().setObData('avoid', 'gluten');
    expect(S().weeklyPlan).toBe(plan);
    expect(S().planClearedByAvoid).toBe(false);
  });
  it('añadir huevo con un alérgeno oculto en el plan → el plan se descarta y se avisa', () => {
    const plan = { ...planWith(dish('Tostadas de Atún')), generatedAt: 'x', mealPlanKey: 'planA', selectedDays: [1], shoppingList: [], nota: '', preferences: '' };
    useAppStore.setState({ weeklyPlan: plan as never });
    S().setObData('avoid', 'huevo');
    expect(S().weeklyPlan).toBeNull();
    expect(S().planClearedByAvoid).toBe(true);
  });
});
