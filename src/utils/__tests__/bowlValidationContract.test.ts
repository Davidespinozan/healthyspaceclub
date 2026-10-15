import { describe, it, expect, vi } from 'vitest';

// El store importa el cliente de Supabase: se simula (sin usuario no se escribe nada).
vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: null } }) }, from: () => ({ upsert: async () => ({ error: null }) }) },
}));

import { buildDayWithFixed, buildWeeklyPlan, expandAvoidCats, textMatchesAvoid, type FixedMeal, type PlanTarget, type Slot } from '../planEngine';
import { validatePlan, planIfValid, classifyService, InvalidPlanError } from '../planIntegrity';
import { planViolatesAvoid, planInvalidatedByAvoidChange, PERMANENT_AVOID_CATALOG } from '../avoidAuthority';
import { useAppStore } from '../../store';
import type { DayPlan } from '../../types';
import INTEGRITY_SRC from '../planIntegrity.ts?raw';

// ─────────────────────────────────────────────────────────────────────────────
// RESTRICTIONS SAFETY · CONTRATO DEL BOWL. El bowl del food truck entra al plan SIN composición
// (`ings: []`, porción = su nombre, solo macros). Antes se "validaba" buscando términos en su
// nombre: con los nombres reales (Fuego, Brasa, Humo, Oro, Verde) eso no detectaba nada y dejaba
// pasar chamberete, pollo y hummus. Sin composición no hay verificación posible: con restricciones
// activas FALLA CERRADO (`unverifiable`); sin restricciones no hay nada que comprobar.
// ─────────────────────────────────────────────────────────────────────────────

const TARGET: PlanTarget = { kcal: 2400, protG: 160, fatG: 70, carbG: 280 };

/** Los 5 bowls de `truck_bowls` (nombres y componentes leídos de producción, 2026-10-15). `fixed`
 *  tiene la forma que el widget entrega al motor (nombre + macros; el RPC no devuelve ingredientes);
 *  las macros son ILUSTRATIVAS (las del fixture «Bowl Verde» de planEngine.test), no las reales.
 *  `componentes` es la lista operativa del truck: NO llega al plan; solo documenta lo que el nombre
 *  no dice. `restringidoPor` usa solo categorías del catálogo activo: chamberete ⇒ carne-roja (está en
 *  la lista del detector) y hummus ⇒ ajonjolí (regla canónica de HSC: el hummus lleva tahini). */
const TRUCK_BOWLS: Array<{ fixed: FixedMeal; componentes: string[]; restringidoPor: string[] }> = [
  { fixed: { slot: 'Comida', name: 'Fuego', kcal: 737, prot: 59, fat: 31, carb: 64 }, componentes: ['pollo-lento', 'arroz-blanco', 'elote', 'pico', 'aguacate', 'hummus-elote', 's-chipotle'], restringidoPor: ['ajonjoli'] },
  { fixed: { slot: 'Comida', name: 'Brasa', kcal: 737, prot: 59, fat: 31, carb: 64 }, componentes: ['chamberete', 'quinoa', 'papa', 'pepino', 'cebolla', 'aguacate', 'hummus-chiles', 's-cilantro'], restringidoPor: ['carne-roja', 'ajonjoli'] },
  { fixed: { slot: 'Comida', name: 'Humo', kcal: 737, prot: 59, fat: 31, carb: 64 }, componentes: ['chamberete', 'arroz-integral', 'papa', 'aguacate', 'cebolla', 'pico', 'hummus-chiles', 's-chipotle'], restringidoPor: ['carne-roja', 'ajonjoli'] },
  { fixed: { slot: 'Comida', name: 'Oro', kcal: 737, prot: 59, fat: 31, carb: 64 }, componentes: ['chamberete', 'arroz-blanco', 'camote', 'pico', 'aguacate', 'hummus-elote'], restringidoPor: ['carne-roja', 'ajonjoli'] },
  { fixed: { slot: 'Comida', name: 'Verde', kcal: 737, prot: 59, fat: 31, carb: 64 }, componentes: ['pollo-lento', 'quinoa', 'brocoli', 'pepino', 'aguacate', 'hummus-jalapeno', 's-cilantro'], restringidoPor: ['ajonjoli'] },
];

/** Plan real de 7 días con el día 1 rearmado alrededor del bowl (el mismo camino que TabHoy). */
function planWithBowl(fixed: FixedMeal, avoid: string[] = [], safeFor: string[] = avoid) {
  const days = buildWeeklyPlan(TARGET, { seed: 7, avoid: safeFor });
  const d1 = buildDayWithFixed(TARGET, fixed, { avoid: safeFor, seed: 7 }, 1);
  return { days: [d1, ...days.slice(1)] as DayPlan[] };
}
const bowlOf = (plan: { days: DayPlan[] }, name: string) => plan.days[0].meals.find((m) => m.name === name)!;

describe('FORMA REAL · lo que el motor guarda de un bowl', () => {
  it.each(TRUCK_BOWLS.map((b) => b.fixed.name))('%s: sin ingredientes, porción = nombre, solo macros → clase bowl', (name) => {
    const b = TRUCK_BOWLS.find((x) => x.fixed.name === name)!;
    const svc = bowlOf(planWithBowl(b.fixed), name);
    expect(svc.ings).toEqual([]);
    expect(svc.portions).toEqual([name]);
    expect(classifyService(svc)).toBe('bowl');
  });
});

describe('SIN RESTRICCIONES · nada que comprobar → válido', () => {
  it.each(TRUCK_BOWLS.map((b) => b.fixed.name))('%s es válido sin restricciones', (name) => {
    const plan = planWithBowl(TRUCK_BOWLS.find((x) => x.fixed.name === name)!.fixed);
    expect(validatePlan(plan, []).violations).toEqual([]);
    expect(planIfValid(plan, [])).toBe(plan);
  });
  it('los centinelas («ninguno», «todas») no son una restricción: el bowl sigue válido', () => {
    const plan = planWithBowl(TRUCK_BOWLS[0].fixed);
    for (const s of [['ninguno'], ['todas'], ['nada', '']]) expect(validatePlan(plan, s).violations, String(s)).toEqual([]);
  });
  it('un bowl cuyo nombre suena a un alimento evitado tampoco se marca sin restricciones', () => {
    const plan = planWithBowl({ slot: 'Cena', name: 'Bowl de Salmón', kcal: 600, prot: 45, fat: 20, carb: 55 });
    expect(validatePlan(plan, []).violations).toEqual([]);
  });
});

describe('CON RESTRICCIONES · falla cerrado, explícito (unverifiable)', () => {
  it('directo (chamberete con carne-roja) y oculto (hummus con ajonjolí): el plan NO pasa', () => {
    for (const b of TRUCK_BOWLS) for (const cat of b.restringidoPor) {
      const plan = planWithBowl(b.fixed, [cat]);
      const v = validatePlan(plan, [cat]).violations;
      expect(v.map((x) => [x.kind, x.dish]), `${b.fixed.name} · ${cat}`).toEqual([['unverifiable', b.fixed.name]]);
      expect(v[0].detail).toMatch(/sin composición modelada/);
      expect(planIfValid(plan, [cat])).toBeNull();
    }
  });
  it('el texto del nombre no podía detectarlos: ningún nombre real delata su composición (el agujero que se cierra)', () => {
    for (const b of TRUCK_BOWLS) for (const cat of b.restringidoPor) {
      expect(textMatchesAvoid(b.fixed.name, expandAvoidCats([cat])), `${b.fixed.name} · ${cat}`).toBe(false);
    }
  });
  it('composición insuficiente con CUALQUIER restricción del catálogo → unverifiable, nunca válido', () => {
    const b = TRUCK_BOWLS[4].fixed;
    for (const cat of PERMANENT_AVOID_CATALOG) {
      const plan = planWithBowl(b, [cat]);
      expect(validatePlan(plan, [cat]).violations.map((x) => x.kind), cat).toEqual(['unverifiable']);
    }
  });
  it('sin falso «restriction» por nombre: un bowl que suena a excepción o a alérgeno se declara no verificable, no violador', () => {
    for (const [name, cat] of [['Bowl de Hot Cakes de Avena', 'gluten'], ['Bowl de Salmón', 'pescado'], ['Bowl Galletas de Arroz', 'gluten']] as const) {
      const plan = planWithBowl({ slot: 'Comida', name, kcal: 650, prot: 40, fat: 22, carb: 70 }, [cat]);
      const v = validatePlan(plan, [cat]).violations;
      expect(v.some((x) => x.kind === 'restriction'), name).toBe(false);
      expect(v.map((x) => x.kind), name).toEqual(['unverifiable']);
    }
  });
  it('la exención de tiempo del bowl sigue acotada: cualquier slot elegido es legítimo', () => {
    for (const slot of ['Desayuno', 'Comida', 'Cena', 'Snack AM'] as Slot[]) {
      const plan = planWithBowl({ ...TRUCK_BOWLS[0].fixed, slot });
      expect(validatePlan(plan, []).violations, slot).toEqual([]);
    }
  });
  it('el validador del bowl ya no busca texto en su nombre/porción', () => {
    const code = INTEGRITY_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const rama = code.slice(code.indexOf("} else if (kind === 'bowl') {"), code.indexOf('} else {', code.indexOf("} else if (kind === 'bowl') {")));
    expect(rama.length).toBeGreaterThan(40);
    expect(rama).not.toMatch(/textoViola|textMatchesAvoid/);
    expect(rama).toMatch(/kind: 'unverifiable'/);
  });
});

describe('INVALIDACIÓN · endurecer restricciones con un bowl en el plan', () => {
  it('añadir una restricción invalida el plan SOLO por el bowl (el resto del plan ya la respeta)', () => {
    // Todo el plan se arma seguro para carne-roja y ajonjolí: si invalida, es por el bowl.
    const SAFE = ['carne-roja', 'ajonjoli'];
    const sinBowl = { days: buildWeeklyPlan(TARGET, { seed: 7, avoid: SAFE }) };
    expect(planViolatesAvoid(sinBowl, ['carne-roja'])).toBe(false);
    expect(planInvalidatedByAvoidChange('', 'ajonjoli', sinBowl).invalidated).toBe(false);
    const conBowl = planWithBowl(TRUCK_BOWLS[2].fixed, [], SAFE);   // Humo: chamberete + hummus
    expect(planViolatesAvoid(conBowl, ['carne-roja'])).toBe(true);
    expect(planInvalidatedByAvoidChange('', 'ajonjoli', conBowl)).toEqual({ invalidated: true, added: ['ajonjoli'] });
  });
  it('quitar restricciones o no cambiar nada no invalida', () => {
    const plan = planWithBowl(TRUCK_BOWLS[2].fixed);
    expect(planInvalidatedByAvoidChange('gluten', '', plan).invalidated).toBe(false);
    expect(planInvalidatedByAvoidChange('', '', plan).invalidated).toBe(false);
  });
});

describe('GUARDADO · el call-site de TabHoy no puede persistir un bowl no verificable', () => {
  it('saveWeeklyPlan rechaza el día con bowl si hay restricciones; lo acepta sin ellas', async () => {
    const base = { generatedAt: 'x', mealPlanKey: 'planA', selectedDays: [1, 2, 3, 4, 5, 6, 7], shoppingList: [], nota: '', preferences: '' };
    useAppStore.setState({ user: null, weeklyPlan: null, obData: { avoid: 'ajonjoli' } as never });
    const conAjonjoli = { ...base, ...planWithBowl(TRUCK_BOWLS[0].fixed, ['ajonjoli']), gen: { avoid: ['ajonjoli'], avoidPermanent: ['ajonjoli'], avoidWeekly: [] } };
    await expect(useAppStore.getState().saveWeeklyPlan(conAjonjoli as never)).rejects.toBeInstanceOf(InvalidPlanError);
    expect(useAppStore.getState().weeklyPlan).toBeNull();
    useAppStore.setState({ obData: { avoid: '' } as never });
    const libre = { ...base, ...planWithBowl(TRUCK_BOWLS[0].fixed), gen: { avoid: [], avoidPermanent: [], avoidWeekly: [] } };
    await useAppStore.getState().saveWeeklyPlan(libre as never);
    expect(useAppStore.getState().weeklyPlan?.days?.[0].meals.some((m) => m.name === 'Fuego')).toBe(true);
  });
});
