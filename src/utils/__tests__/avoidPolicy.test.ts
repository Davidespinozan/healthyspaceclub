import { describe, it, expect, vi, beforeEach } from 'vitest';

// El store importa el cliente de Supabase: se simula (sin usuario no se escribe nada).
vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: null } }) }, from: () => ({ upsert: async () => ({ error: null }) }) },
}));

import { BANCO, type BancoDish } from '../../data/banco';
import { buildWeeklyPlan, buildDayWithFixed, solveSlot, type PlanTarget, type ProteinShake } from '../planEngine';
import { validatePlan, planIfValid, InvalidPlanError, type PlanViolation } from '../planIntegrity';
import {
  avoidPolicy, avoidPolicyForPlan, avoidForRegen, policyUnion, effectiveAvoid, permanentAvoidFrom, weeklyAvoidFrom,
  planViolatesAvoid, planInvalidatedByAvoidChange, AVOID_SEMANTICS,
} from '../avoidAuthority';
import { useAppStore } from '../../store';
import type { DayPlan, MealItem } from '../../types';
import REGEN_SRC from '../useAutoRegenPlan.ts?raw';
import PLANNER_SRC from '../../components/WeeklyNutritionPlanner.tsx?raw';
import APP_SRC from '../../App.tsx?raw';
import STORE_SRC from '../../store/index.ts?raw';

// ─────────────────────────────────────────────────────────────────────────────
// WEEKLY PREFERENCES SPLIT · MB2 · AvoidPolicy { strict, soft } en los consumidores de VALIDACIÓN.
//   strict = permanentes (detector estricto) · soft = semanales que no son permanentes (detector MB1).
// La generación sigue recibiendo la unión (MB3): filtra lo semanal en estricto, que es más restrictivo.
// ─────────────────────────────────────────────────────────────────────────────

const TARGET: PlanTarget = { kcal: 2400, protG: 160, fatG: 70, carbG: 280 };
const dish = (nombre: string): BancoDish => {
  const d = BANCO.find((x) => x.nombre === nombre);
  if (!d) throw new Error(`no está en el banco: ${nombre}`);
  return d;
};
const served = (d: BancoDish): MealItem => solveSlot([d], d.tiempo === 'Snack' ? 'Snack AM' : d.tiempo, [0, 25, 12, 40])[0];
const BASE = new Map<string, DayPlan[]>();
/** Plan real de 7 días, SEGURO en estricto para `safe`, con `nombre` servido en el día 1. */
function planWith(nombre: string, safe: string[]) {
  const key = safe.join(',');
  if (!BASE.has(key)) BASE.set(key, buildWeeklyPlan(TARGET, { seed: 11, avoid: safe }));
  const days = BASE.get(key)!;
  const item = served(dish(nombre));
  const meals = days[0].meals.map((m) => (m.time === item.time ? item : m));
  return { days: [{ ...days[0], meals }, ...days.slice(1)] as DayPlan[] };
}
const kinds = (vs: PlanViolation[]) => [...new Set(vs.map((v) => v.kind))].sort();

describe('A · la política separa el origen', () => {
  it('permanent=[huevo], weekly=[huevo, lacteos] → strict=[huevo], soft=[lacteos]', () => {
    expect(avoidPolicy(['huevo'], ['huevo', 'lacteos'])).toEqual({ strict: ['huevo'], soft: ['lacteos'] });
    expect(avoidPolicyForPlan({ avoidWeekly: ['huevo', 'lacteos'] }, '', { avoid: 'huevo' })).toEqual({ strict: ['huevo'], soft: ['lacteos'] });
  });
  it('normaliza igual que siempre (alias, centinelas, catálogo)', () => {
    expect(avoidPolicy(['Lácteos', 'vegano'], ['sésamo', 'nada', 'lacteo'])).toEqual({ strict: ['lacteos'], soft: ['ajonjoli'] });
  });
  it('la unión de la política es exactamente la lista de antes (misma entrada al generador)', () => {
    const casos: Array<[Record<string, unknown> | null, string | null, Record<string, unknown>]> = [
      [{ avoid: ['gluten'], avoidWeekly: ['gluten', 'huevo'] }, '', { avoid: 'lacteos' }],
      [{ avoid: ['huevo', 'soya'] }, '', { avoid: 'gluten' }],                   // legacy sin avoidWeekly
      [null, 'antojo · lacteos, gluten', { avoid: '' }],                          // legacy sin gen
      [{ avoidWeekly: [] }, '', { avoid: 'huevo,pescado' }],
    ];
    for (const [gen, prefs, ob] of casos) {
      const antes = effectiveAvoid(permanentAvoidFrom(ob), weeklyAvoidFrom(gen?.avoidWeekly ?? gen?.avoid
        ?? ['gluten', 'lacteos', 'huevo', 'frutos-secos', 'cacahuate', 'soya', 'ajonjoli', 'pescado', 'mariscos', 'carne-roja'].filter((k) => (prefs || '').includes(k))));
      expect(avoidForRegen(gen as never, prefs, ob)).toEqual(antes);
      expect(policyUnion(avoidPolicyForPlan(gen as never, prefs, ob))).toEqual(antes);
    }
  });
});

describe('HUEVO', () => {
  it('B · semanal: Tostadas de Atún (mayonesa propia) → válido', () => {
    expect(validatePlan(planWith('Tostadas de Atún', ['huevo']), { strict: [], soft: ['huevo'] }).violations).toEqual([]);
  });
  it('C · permanente: el mismo plan → restriction', () => {
    const v = validatePlan(planWith('Tostadas de Atún', ['huevo']), { strict: ['huevo'], soft: [] }).violations;
    expect(v.map((x) => [x.kind, x.dish])).toEqual([['restriction', 'Tostadas de Atún']]);
  });
  it('D · semanal visible: Huevos Rancheros → preference (inválido, sin confundirse con permanente)', () => {
    const v = validatePlan(planWith('Huevos Rancheros', ['huevo']), { strict: [], soft: ['huevo'] });
    expect(v.valid).toBe(false);
    expect(v.violations.map((x) => [x.kind, x.dish])).toEqual([['preference', 'Huevos Rancheros']]);
  });
});

describe('LÁCTEOS', () => {
  it.each(['Panela a la Plancha con Salsa', 'Queso Fresco con Cacahuate y Manzana', 'Camote Relleno de Carne Molida'])(
    'E · semanal: queso/crema visible · %s → preference', (n) => {
      const v = validatePlan(planWith(n, ['lacteos']), { strict: [], soft: ['lacteos'] }).violations;
      expect(v.map((x) => [x.kind, x.dish])).toEqual([['preference', n]]);
    });
  it.each(['Bowl de Camarón Mediterráneo', 'Burger Bowl'])('F · semanal: yogurt solo dentro de la sub-receta · %s → válido', (n) => {
    expect(validatePlan(planWith(n, ['lacteos']), { strict: [], soft: ['lacteos'] }).violations).toEqual([]);
  });
  it.each(['Bowl de Camarón Mediterráneo', 'Burger Bowl'])('G · permanente: el mismo caso · %s → restriction', (n) => {
    expect(kinds(validatePlan(planWith(n, ['lacteos']), { strict: ['lacteos'], soft: [] }).violations)).toEqual(['restriction']);
  });
});

describe('H · solapamiento: STRICT gana', () => {
  it('una categoría en ambas solo se valida en estricto', () => {
    expect(avoidPolicy(['huevo'], ['huevo'])).toEqual({ strict: ['huevo'], soft: [] });
    // aunque llegue una política mal formada con la categoría en los dos lados
    const v = validatePlan(planWith('Tostadas de Atún', ['huevo']), { strict: ['huevo'], soft: ['huevo'] }).violations;
    expect(v.map((x) => x.kind)).toEqual(['restriction']);
  });
  it('un plan con permanente Y semanal distintos reporta cada violación con su origen', () => {
    const base = planWith('Tostadas de Atún', ['huevo', 'lacteos']);
    const panela = served(dish('Panela a la Plancha con Salsa'));
    const days = base.days.map((d, i) => (i === 1 ? { ...d, meals: d.meals.map((m) => (m.time === panela.time ? panela : m)) } : d));
    const v = validatePlan({ days }, { strict: ['huevo'], soft: ['lacteos'] }).violations;
    expect(v.map((x) => [x.kind, x.dish]).sort()).toEqual([['preference', 'Panela a la Plancha con Salsa'], ['restriction', 'Tostadas de Atún']]);
  });
  it('una lista suelta se sigue interpretando como STRICT (contrato anterior intacto)', () => {
    expect(kinds(validatePlan(planWith('Tostadas de Atún', ['huevo']), ['huevo']).violations)).toEqual(['restriction']);
  });
});

describe('I · HIDRATACIÓN', () => {
  it('un plan generado hoy con huevo SEMANAL (generador estricto) sigue válido con la política suave', () => {
    const days = buildWeeklyPlan(TARGET, { seed: 3, avoid: ['huevo'] });
    const plan = { days, preferences: 'huevo', gen: { avoid: ['huevo'], avoidPermanent: [], avoidWeekly: ['huevo'] } };
    expect(planIfValid(plan, avoidPolicyForPlan(plan.gen, plan.preferences, { avoid: '' }))).toBe(plan);
  });
  it('mayonesa + huevo SOLO semanal → se conserva; + huevo PERMANENTE → se descarta', () => {
    const plan = { ...planWith('Tostadas de Atún', ['huevo']), preferences: 'huevo', gen: { avoid: ['huevo'], avoidWeekly: ['huevo'] } };
    expect(planIfValid(plan, avoidPolicyForPlan(plan.gen, plan.preferences, { avoid: '' }))).toBe(plan);
    expect(planIfValid(plan, avoidPolicyForPlan(plan.gen, plan.preferences, { avoid: 'huevo' }))).toBeNull();
  });
  it('semanal incompatible según SOFT → se descarta', () => {
    const plan = { ...planWith('Huevos Rancheros', ['huevo']), preferences: 'huevo', gen: { avoid: ['huevo'], avoidWeekly: ['huevo'] } };
    expect(planIfValid(plan, avoidPolicyForPlan(plan.gen, plan.preferences, { avoid: '' }))).toBeNull();
  });
  it('LEGACY sin avoidWeekly: el origen no se inventa → STRICT (mismo veredicto que antes de MB2)', () => {
    const conMayonesa = planWith('Tostadas de Atún', ['huevo']);
    expect(avoidPolicyForPlan({ avoid: ['huevo'] }, '', { avoid: '' })).toEqual({ strict: ['huevo'], soft: [] });
    expect(planIfValid({ ...conMayonesa, gen: { avoid: ['huevo'] } }, avoidPolicyForPlan({ avoid: ['huevo'] }, '', {}))).toBeNull();
    expect(avoidPolicyForPlan(null, 'antojo · gluten', {})).toEqual({ strict: ['gluten'], soft: [] });
    expect(avoidPolicyForPlan(undefined, '', null)).toEqual({ strict: [], soft: [] });
  });
  it('gen.avoidPermanent es solo la foto: manda el perfil ACTUAL', () => {
    expect(avoidPolicyForPlan({ avoidPermanent: ['huevo'], avoidWeekly: [] }, '', { avoid: '' })).toEqual({ strict: [], soft: [] });
    expect(avoidPolicyForPlan({ avoidPermanent: [], avoidWeekly: ['huevo'] }, '', { avoid: 'huevo' })).toEqual({ strict: ['huevo'], soft: [] });
  });
  it('las dos hidrataciones y el guardado usan la política (no la unión)', () => {
    expect(APP_SRC).toMatch(/const avoid = avoidPolicyForPlan\(\s*remotePlan\?\.gen, remotePlan\?\.preferences,/);
    expect(STORE_SRC).toMatch(/const avoid = avoidPolicyForPlan\(p\.weeklyPlan\.gen, p\.weeklyPlan\.preferences, p\.obData\);/);
    expect(STORE_SRC).toMatch(/const avoidAhora = avoidPolicyForPlan\(plan\.gen, plan\.preferences, prevState\.obData\);/);
  });
});

describe('GUARDADO · saveWeeklyPlan valida con la política separada', () => {
  const S = () => useAppStore.getState();
  const base = { generatedAt: 'x', mealPlanKey: 'planA', selectedDays: [1, 2, 3, 4, 5, 6, 7], shoppingList: [], nota: '', preferences: 'huevo' };
  beforeEach(() => { useAppStore.setState({ user: null, weeklyPlan: null }); });
  it('huevo semanal + mayonesa → se guarda; huevo permanente → se rechaza; huevo visible semanal → se rechaza', async () => {
    const plan = { ...base, ...planWith('Tostadas de Atún', ['huevo']), gen: { avoid: ['huevo'], avoidPermanent: [], avoidWeekly: ['huevo'], avoidSemantics: 2 } };
    useAppStore.setState({ obData: { avoid: '' } as never });
    await S().saveWeeklyPlan(plan as never);
    expect(S().weeklyPlan).toBe(plan);
    useAppStore.setState({ weeklyPlan: null, obData: { avoid: 'huevo' } as never });
    await expect(S().saveWeeklyPlan(plan as never)).rejects.toBeInstanceOf(InvalidPlanError);
    useAppStore.setState({ obData: { avoid: '' } as never });
    const visible = { ...plan, ...planWith('Huevos Rancheros', ['huevo']) };
    const err = await S().saveWeeklyPlan(visible as never).catch((e) => e);
    expect(err).toBeInstanceOf(InvalidPlanError);
    expect((err as InvalidPlanError).verdict.violations.map((v) => v.kind)).toEqual(['preference']);
  });
});

describe('J · INVALIDACIÓN · solo responde a permanentes nuevas, en estricto', () => {
  it('añadir huevo PERMANENTE con mayonesa en el plan sigue borrándolo (nunca se juzga en suave)', () => {
    const plan = planWith('Tostadas de Atún', ['huevo']);
    expect(planViolatesAvoid(plan, ['huevo'])).toBe(true);
    expect(planInvalidatedByAvoidChange('', 'huevo', plan)).toEqual({ invalidated: true, added: ['huevo'] });
  });
  it('setObData(\'avoid\') borra el plan incompatible y avisa', () => {
    useAppStore.setState({ user: null, obData: { avoid: '' } as never, planClearedByAvoid: false, weeklyPlan: { ...planWith('Tostadas de Atún', ['huevo']), generatedAt: 'x', mealPlanKey: 'planA', selectedDays: [1], shoppingList: [], nota: '', preferences: '' } as never });
    useAppStore.getState().setObData('avoid', 'huevo');
    expect(useAppStore.getState().weeklyPlan).toBeNull();
    expect(useAppStore.getState().planClearedByAvoid).toBe(true);
  });
});

describe('K / L · batido y bowl conservan su comportamiento hasta MB4', () => {
  const shakePlan = (type: ProteinShake['type'], avoid: string[]) =>
    ({ days: buildWeeklyPlan({ kcal: 2473, protG: 148, fatG: 69, carbG: 315 }, { seed: 5, avoid, shake: { slots: ['am'], type, protG: 25 } }) });
  it('K · whey con lácteos: permanente → restriction; solo semanal → sigue bloqueado (preference); vegana → válido', () => {
    const whey = shakePlan('regular', []);
    expect(whey.days.flatMap((d) => d.meals).some((m) => m.name.startsWith('Batido de Proteína'))).toBe(true);
    const shakeKinds = (p: AvoidArg) => validatePlan(whey, p).violations.filter((v) => v.dish === 'Batido de Proteína').map((v) => v.kind);
    expect(new Set(shakeKinds({ strict: ['lacteos'], soft: [] }))).toEqual(new Set(['restriction']));
    expect(new Set(shakeKinds({ strict: [], soft: ['lacteos'] }))).toEqual(new Set(['preference']));
    const vegana = shakePlan('vegana', ['lacteos']);
    expect(validatePlan(vegana, { strict: [], soft: ['lacteos'] }).violations).toEqual([]);
    expect(validatePlan(vegana, { strict: ['lacteos'], soft: [] }).violations).toEqual([]);
  });
  it('L · bowl: falla cerrado con strict y también con solo soft (D-WP6 llega en MB4); sin categorías, válido', () => {
    const days = buildWeeklyPlan(TARGET, { seed: 7, avoid: ['ajonjoli'] });
    const plan = { days: [buildDayWithFixed(TARGET, { slot: 'Comida', name: 'Humo', kcal: 737, prot: 59, fat: 31, carb: 64 }, { seed: 7, avoid: ['ajonjoli'] }, 1), ...days.slice(1)] };
    expect(kinds(validatePlan(plan, { strict: ['ajonjoli'], soft: [] }).violations)).toEqual(['unverifiable']);
    expect(kinds(validatePlan(plan, { strict: [], soft: ['ajonjoli'] }).violations)).toEqual(['unverifiable']);
    expect(validatePlan(plan, { strict: [], soft: [] }).violations).toEqual([]);
  });
});

describe('REGEN y PERSISTENCIA · el origen se conserva', () => {
  it('el planificador marca avoidSemantics = 2 junto a avoidPermanent / avoidWeekly / avoid', () => {
    expect(AVOID_SEMANTICS).toBe(2);
    expect(PLANNER_SRC).toMatch(/avoid, avoidPermanent, avoidWeekly, avoidSemantics: AVOID_SEMANTICS,/);
  });
  it('la regeneración NO convierte el gen.avoid legacy en semanal; solo copia un avoidWeekly conocido', () => {
    const code = REGEN_SRC.replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/avoidWeekly: weeklyPlan\.gen\?\.avoidWeekly \?\? weeklyPlan\.gen\?\.avoid/);
    expect(code).toMatch(/\.\.\.\(weeklyPlan\.gen\?\.avoidWeekly \? \{ avoidWeekly: weeklyPlan\.gen\.avoidWeekly, avoidSemantics: AVOID_SEMANTICS \} : \{\}\)/);
    // el generador sigue recibiendo la UNIÓN (MB3)
    expect(code).toMatch(/const avoid = avoidForRegen\(weeklyPlan\.gen, weeklyPlan\.preferences, obData\);/);
  });
});

type AvoidArg = Parameters<typeof validatePlan>[1];
