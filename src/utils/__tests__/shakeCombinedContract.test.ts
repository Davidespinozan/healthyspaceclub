import { describe, it, expect, vi, beforeEach } from 'vitest';

// La ruta IA llama a callAI: se simula. '{}' obliga a la orquestación a rellenar la selección con
// platillos del banco filtrado; el ensamblado (batido + corrector de macros) es el de producción.
const callAI = vi.fn();
vi.mock('../aiProxy', () => ({ callAI: (...a: unknown[]) => callAI(...a) }));

import { BANCO } from '../../data/banco';
import { makeAvoidFilter, shakeTypeOfService, isShakeName, SHAKE_NAME, type ProteinShake, type PlanTarget } from '../planEngine';
import { generateWeeklyPlan } from '../planOrchestration';
import { validatePlan, classifyService, type PlanViolation } from '../planIntegrity';
import { planViolatesAvoid } from '../avoidAuthority';
import type { DayPlan, MealItem } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// RESTRICTIONS SHAKE FIX · contrato del BATIDO COMBINADO. El corrector de macros (`mergeIntoSnack`)
// fusiona legítimamente un snack del banco con el batido → "Batido de Proteína + <snack>". Antes la
// validación final lo clasificaba `unknown` y `saveWeeklyPlan` rechazaba el plan («No pudimos generar
// tu plan»). Ahora se reconoce por ESTRUCTURA cerrada, conserva el tipo del batido y sus partes
// añadidas se validan como cualquier platillo.
// ─────────────────────────────────────────────────────────────────────────────

const QA_TARGET: PlanTarget = { kcal: 2473, protG: 148, fatG: 69, carbG: 315 };
const TARGETS: PlanTarget[] = [QA_TARGET, { kcal: 1800, protG: 130, fatG: 55, carbG: 195 }, { kcal: 3000, protG: 170, fatG: 85, carbG: 390 }];
const SLOTS: ProteinShake['slots'][] = [['am'], ['pm'], ['am', 'pm']];
const TYPES: ProteinShake['type'][] = ['regular', 'vegana', 'massgainer'];

beforeEach(() => { callAI.mockReset(); callAI.mockResolvedValue({ content: [{ text: '{}' }] }); });

const meals = (days: DayPlan[]) => days.flatMap((d) => d.meals);
const combinedShakes = (days: DayPlan[]) => meals(days).filter((m) => m.name.startsWith(`${SHAKE_NAME} + `));
const kinds = (vs: PlanViolation[]) => [...new Set(vs.map((v) => v.kind))].sort();
async function gen(type: ProteinShake['type'], slots: ProteinShake['slots'], avoid: string[], target = QA_TARGET, seed = 12345, craving = '') {
  const r = await generateWeeklyPlan(target, avoid, craving, seed, { slots, type, protG: 25 });
  expect(r.source).toBe('ia');
  return r.days;
}
/** Un batido combinado REAL producido por el motor (no una imitación a mano). */
async function realCombined(type: ProteinShake['type'], avoid: string[] = []): Promise<{ days: DayPlan[]; svc: MealItem }> {
  // MENÚ V1 · CAPA 4 · con un slot de snack libre el corrector sirve un snack PROPIO (no fusiona). Con el batido en
  // los DOS slots no queda ninguno libre y el corrector fusiona en el batido: el combinado sigue siendo REAL.
  for (const seed of [12345, 1, 2, 3, 4]) for (const slots of [['pm'], ['am', 'pm']] as ProteinShake['slots'][]) {
    const days = await gen(type, slots, avoid, QA_TARGET, seed);
    const svc = combinedShakes(days)[0];
    if (svc) return { days, svc };
  }
  throw new Error('el motor no produjo un batido combinado');
}
/** El mismo plan con UN servicio del día 1 sustituido (el resto es un plan real válido). */
function withService(days: DayPlan[], svc: Partial<MealItem> & { name: string }, time = String(svc.time)) {
  const d1 = days[0];
  const idx = d1.meals.findIndex((m) => m.time === time);
  const meals1 = [...d1.meals];
  if (idx >= 0) meals1[idx] = { ...svc, time } as MealItem; else meals1.push({ ...svc, time } as MealItem);
  return { days: [{ ...d1, meals: meals1 }, ...days.slice(1)] };
}
const asType = (svc: MealItem, type: ProteinShake['type']): MealItem => {
  const tag = type === 'vegana' ? ' (vegana)' : type === 'massgainer' ? ' (mass gainer)' : '';
  const strip = (s: string) => s.replace(' (vegana)', '').replace(' (mass gainer)', '');
  const [own, ...rest] = svc.desc.split(' · ');
  const ownDesc = strip(own).replace('g proteína', `g proteína${tag}`);
  const [p0, ...pRest] = svc.portions;
  return { ...svc, desc: [ownDesc, ...rest].join(' · '), portions: [strip(p0).replace('proteína —', `proteína${tag} —`), ...pRest] };
};

describe('A · el caso de la QA visual: lacteos + Vegana AM + antojo PASTA', () => {
  it('generateWeeklyPlan con el target real → el plan pasa la validación final', async () => {
    // MENÚ V1 · CAPA 4 · el mismo caso; si el corrector ya no fusiona en el batido (usa el slot libre), se reproduce
    // el combinado con el batido en los dos slots. Lo que se valida no cambia: el plan pasa la validación final.
    let days = await gen('vegana', ['am'], ['lacteos'], QA_TARGET, 12345, 'PASTA');
    if (!combinedShakes(days).length) days = await gen('vegana', ['am', 'pm'], ['lacteos'], QA_TARGET, 12345, 'PASTA');
    expect(combinedShakes(days).length, 'el caso reproduce el batido combinado').toBeGreaterThan(0);
    const v = validatePlan({ days }, ['lacteos']);
    expect(v.violations).toEqual([]);
    expect(v.valid).toBe(true);
    const shakes = meals(days).filter((m) => isShakeName(m.name));
    expect(shakes.every((m) => shakeTypeOfService(m) === 'vegana')).toBe(true);
    expect(planViolatesAvoid({ days }, ['lacteos'])).toBe(false);
  });
});

describe('B · whey en PM sin restricciones', () => {
  it('el plan con batido combinado es válido', async () => {
    const days = await gen('regular', ['pm'], []);
    expect(combinedShakes(days).length).toBeGreaterThan(0);
    expect(validatePlan({ days }, []).violations).toEqual([]);
  });
});

describe('MATRIZ · AM / PM / AM+PM × Regular / Vegana / Mass gainer (ruta IA)', () => {
  it('sin restricciones: todo plan generado es válido y conserva su tipo', async () => {
    let combinados = 0;
    for (const type of TYPES) for (const slots of SLOTS) for (const target of TARGETS) {
      const days = await gen(type, slots, [], target, 7);
      combinados += combinedShakes(days).length;
      expect(validatePlan({ days }, []).violations, `${type}/${slots}/${target.kcal}`).toEqual([]);
      expect(meals(days).filter((m) => isShakeName(m.name)).every((m) => shakeTypeOfService(m) === type), `${type}/${slots}`).toBe(true);
    }
    expect(combinados, 'la matriz ejercita batidos combinados').toBeGreaterThan(0);
  });
  it('con lacteos: Vegana válida en todos los slots; whey nunca se sirve', async () => {
    for (const slots of SLOTS) for (const target of TARGETS) {
      const vg = await gen('vegana', slots, ['lacteos'], target, 7);
      expect(validatePlan({ days: vg }, ['lacteos']).violations, `vegana/${slots}/${target.kcal}`).toEqual([]);
      for (const whey of ['regular', 'massgainer'] as const) {
        const d = await gen(whey, slots, ['lacteos'], target, 7);
        expect(meals(d).filter((m) => isShakeName(m.name)), `${whey}/${slots}`).toEqual([]);
        expect(validatePlan({ days: d }, ['lacteos']).valid).toBe(true);
      }
    }
  });
});

describe('C · batido combinado de whey bajo lacteos → restriction (no unknown-dish)', () => {
  it.each(['regular', 'massgainer'] as const)('%s combinado', async (type) => {
    const { days, svc } = await realCombined(type);
    expect(classifyService(svc)).toBe('shake-combined');
    // el mismo plan, pero el día 1 lleva el batido whey combinado (las partes añadidas son compatibles)
    const added = svc.name.split(' + ').slice(1).map((n) => BANCO.find((d) => d.nombre === n)!);
    const base = await gen('vegana', ['pm'], ['lacteos']);
    const plan = withService(base, svc);
    const v = validatePlan(plan, ['lacteos']);
    expect(v.valid).toBe(false);
    expect(v.violations.some((x) => x.kind === 'unknown-dish')).toBe(false);
    const shakeV = v.violations.filter((x) => x.dish === SHAKE_NAME);
    expect(shakeV.map((x) => x.kind)).toEqual(['restriction']);
    if (added.every((d) => !makeAvoidFilter(['lacteos'])(d))) expect(kinds(v.violations)).toEqual(['restriction']);
    expect(planViolatesAvoid(plan, ['lacteos'])).toBe(true);
    expect(planViolatesAvoid({ days }, ['lacteos'])).toBe(true);
  });
  it('el mismo batido combinado como Vegana es válido bajo lacteos (si sus partes son compatibles)', async () => {
    const { svc } = await realCombined('vegana', ['lacteos']);
    const base = await gen('vegana', ['pm'], ['lacteos']);
    expect(validatePlan(withService(base, svc), ['lacteos']).violations).toEqual([]);
    // tipo cambiado a whey sobre la MISMA estructura → restriction
    expect(validatePlan(withService(base, asType(svc, 'regular')), ['lacteos']).violations.map((x) => x.kind)).toEqual(['restriction']);
  });
});

describe('PARTES AÑADIDAS · se validan como platillos', () => {
  it('componente añadido compatible → válido; incompatible → restriction sobre ESA parte', async () => {
    const { svc } = await realCombined('vegana', ['lacteos']);
    const base = await gen('vegana', ['pm'], ['lacteos']);
    const conLacteo = BANCO.find((d) => d.tiempo === 'Snack' && makeAvoidFilter(['lacteos'])(d))!;
    const bad = {
      ...svc,
      name: `${SHAKE_NAME} + ${conLacteo.nombre}`,
      portions: [svc.portions[0], 'porción'],
      ings: [svc.ings![0], ...conLacteo.ings.map((i) => ({ nv: i.nv, g: 1, rol: i.rol }))],
    };
    expect(classifyService(bad)).toBe('shake-combined');
    const v = validatePlan(withService(base, bad), ['lacteos']);
    expect(v.violations.map((x) => [x.kind, x.dish])).toEqual([['restriction', conLacteo.nombre]]);
    expect(planViolatesAvoid(withService(base, bad), ['lacteos'])).toBe(true);
  });
  it('una parte añadida de otro tiempo → violación de tiempo', async () => {
    const { svc } = await realCombined('vegana');
    const cena = BANCO.find((d) => d.tiempo === 'Cena')!;
    const svcCena = { ...svc, name: `${SHAKE_NAME} + ${cena.nombre}`, ings: [svc.ings![0], ...cena.ings.map((i) => ({ nv: i.nv, g: 1, rol: i.rol }))] };
    const base = await gen('vegana', ['pm'], []);
    const v = validatePlan(withService(base, svcCena), []);
    expect(v.violations.map((x) => [x.kind, x.dish])).toEqual([['time', cena.nombre]]);
  });
  it('el batido combinado sigue sin poder ocupar una comida fuerte', async () => {
    const { svc } = await realCombined('vegana');
    const base = await gen('vegana', ['pm'], []);
    const v = validatePlan(withService(base, { ...svc, time: 'Comida' }, 'Comida'), []);
    expect(v.violations.some((x) => x.kind === 'time' && x.dish === SHAKE_NAME)).toBe(true);
  });
  it('el tipo lo decide el texto PROPIO del batido: un snack añadido no lo vuelve «vegana»', async () => {
    const { svc } = await realCombined('regular');
    const disfrazado = { ...svc, desc: `${svc.desc} (vegana)`, portions: [...svc.portions, 'algo (vegana)'] };
    expect(shakeTypeOfService(disfrazado)).toBe('regular');
    const base = await gen('vegana', ['pm'], ['lacteos']);
    expect(validatePlan(withService(base, disfrazado), ['lacteos']).violations.some((x) => x.kind === 'restriction' && x.dish === SHAKE_NAME)).toBe(true);
  });
});

describe('ESTRUCTURA FALSA · no es un bypass de unknown-dish', () => {
  it.each([
    ['primer ingrediente incorrecto', (s: MealItem) => ({ ...s, ings: [...s.ings!.slice(1), s.ings![0]] })],
    ['sin proteína en polvo', (s: MealItem) => ({ ...s, ings: s.ings!.slice(1) })],
    ['ingrediente ajeno colado', (s: MealItem) => ({ ...s, ings: [...s.ings!, { nv: 'Pastel de chocolate', g: 200, rol: 'principal' }] })],
    ['parte adicional inexistente', (s: MealItem) => ({ ...s, name: `${SHAKE_NAME} + Galletas Rellenas de Chocolate` })],
    ['parte adicional parcial (prefijo de un nombre real)', (s: MealItem) => ({ ...s, name: s.name.slice(0, -3) })],
    ['una parte real y otra inexistente', (s: MealItem) => ({ ...s, name: `${s.name} + Pizza` })],
    ['batido sin parte añadida ("Batido de Proteína + ")', (s: MealItem) => ({ ...s, name: `${SHAKE_NAME} + ` })],
    ['separador manipulado', (s: MealItem) => ({ ...s, name: s.name.replace(' + ', '+') })],
    ['batido en segunda posición', (s: MealItem) => ({ ...s, name: `${s.name.split(' + ')[1]} + ${SHAKE_NAME}` })],
    ['nombre parecido', (s: MealItem) => ({ ...s, name: s.name.replace(SHAKE_NAME, 'Batido de Proteina') })],
  ])('%s → unknown-dish', async (_label, mutate) => {
    const { svc } = await realCombined('vegana');
    const fake = mutate(svc);
    expect(classifyService(fake)).toBe('unknown');
    const base = await gen('vegana', ['pm'], []);
    expect(validatePlan(withService(base, fake), []).violations.some((x) => x.kind === 'unknown-dish')).toBe(true);
  });
  it('el batido solo y los snacks combinados normales no cambian de clase', async () => {
    const days = await gen('vegana', ['am', 'pm'], [], TARGETS[2], 7);
    for (const m of meals(days)) {
      const k = classifyService(m);
      if (m.name === SHAKE_NAME) expect(k).toBe('shake');
      else if (m.name.startsWith(`${SHAKE_NAME} + `)) expect(k).toBe('shake-combined');
      else expect(k === 'dish' || k === 'combined', m.name).toBe(true);
    }
  });
});
