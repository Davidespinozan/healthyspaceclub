import { describe, it, expect, vi, beforeEach } from 'vitest';

// La ruta IA llama a callAI ('{}' → la orquestación rellena con el pool); el store importa Supabase.
const callAI = vi.fn();
vi.mock('../aiProxy', () => ({ callAI: (...a: unknown[]) => callAI(...a) }));
vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: null } }) }, from: () => ({ upsert: async () => ({ error: null }) }) },
}));

import { BANCO, type BancoDish } from '../../data/banco';
import {
  buildWeeklyPlan, buildDayWithFixed, shakeTypeVerdict, shakeTypeOptions, shakeAllowedFor, shakeTypeOfService,
  makeAvoidFilter, makePreferenceFilter, SHAKE_NAME, type AvoidPolicy, type ProteinShake, type PlanTarget, type FixedMeal,
} from '../planEngine';
import { generateWeeklyPlan } from '../planOrchestration';
import { validatePlan, planIfValid, classifyService, InvalidPlanError, type PlanViolation } from '../planIntegrity';
import { avoidPolicyForPlan, planViolatesAvoid, planInvalidatedByAvoidChange } from '../avoidAuthority';
import { useAppStore } from '../../store';
import type { DayPlan, MealItem } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// WEEKLY PREFERENCES SPLIT · MB4 · las dos excepciones con decisión cerrada.
//   D-WP5 · BATIDO: lácteos permanente O semanal bloquea whey / mass gainer (elección directa de
//           proteína). Validación: `restriction` si es permanente, `preference` si es de la semana.
//   D-WP6 · BOWL: sin composición verificable → falla cerrado solo con `strict`; con solo `soft`,
//           permitido (el usuario lo eligió y una preferencia no es una alergia).
// ─────────────────────────────────────────────────────────────────────────────

const T: PlanTarget = { kcal: 2473, protG: 148, fatG: 69, carbG: 315 };
const P = (strict: string[], soft: string[]): AvoidPolicy => ({ strict, soft });
const STRICT_L = P(['lacteos'], []), SOFT_L = P([], ['lacteos']);
const shake = (type: ProteinShake['type'], slots: ProteinShake['slots'] = ['am']): ProteinShake => ({ slots, type, protG: 25 });
const shakes = (days: DayPlan[]) => days.flatMap((d) => d.meals).filter((m) => m.name === SHAKE_NAME || m.name.startsWith(`${SHAKE_NAME} + `));
const shakeKinds = (days: DayPlan[], pol: AvoidPolicy) => [...new Set(validatePlan({ days }, pol).violations.filter((v) => v.dish === SHAKE_NAME).map((v) => v.kind))];

beforeEach(() => { callAI.mockReset(); callAI.mockResolvedValue({ content: [{ text: '{}' }] }); });

describe('SHAKE · D-WP5 en generación', () => {
  it.each([['A', 'regular', STRICT_L], ['B', 'regular', SOFT_L], ['C', 'massgainer', STRICT_L], ['D', 'massgainer', SOFT_L]] as const)(
    '%s · %s con lácteos %s → bloqueado en IA y fallback (el plan va sin batido)', async (_k, type, pol) => {
      expect(shakeAllowedFor(shake(type), pol)).toBe(false);
      expect(shakes(buildWeeklyPlan(T, { seed: 1, avoid: pol, shake: shake(type) }))).toEqual([]);
      const ia = await generateWeeklyPlan(T, pol, '', 1, shake(type, ['pm']));
      expect(ia.source).toBe('ia');
      expect(shakes(ia.days)).toEqual([]);
    });
  it('E · vegana con lácteos semanal → se sirve y el plan es válido', async () => {
    const ia = await generateWeeklyPlan(T, SOFT_L, '', 1, shake('vegana', ['pm']));
    expect(shakes(ia.days).length).toBeGreaterThan(0);
    expect(shakes(ia.days).every((m) => shakeTypeOfService(m) === 'vegana')).toBe(true);
    expect(validatePlan({ days: ia.days }, SOFT_L).violations).toEqual([]);
  });
});

describe('SHAKE · D-WP5 en validación (solo y combinado)', () => {
  const wheyDays = (type: ProteinShake['type']) => buildWeeklyPlan(T, { seed: 1, avoid: [], shake: shake(type) });
  it('A/B · whey solo: strict → restriction; soft → preference', () => {
    const d = wheyDays('regular');
    expect(shakes(d).some((m) => m.name === SHAKE_NAME)).toBe(true);
    expect(shakeKinds(d, STRICT_L)).toEqual(['restriction']);
    expect(shakeKinds(d, SOFT_L)).toEqual(['preference']);
  });
  it('C/D · mass gainer: igual que el whey', () => {
    const d = wheyDays('massgainer');
    expect(shakeKinds(d, STRICT_L)).toEqual(['restriction']);
    expect(shakeKinds(d, SOFT_L)).toEqual(['preference']);
  });
  async function combined(type: ProteinShake['type'], pol: AvoidPolicy | string[]): Promise<{ days: DayPlan[]; svc: MealItem }> {
    // MENÚ V1 · Bloque 6 · con snacks más variados el día suele cerrar sin que el corrector fusione en el batido: se
    // busca un combinado REAL en más semillas y con el batido en los dos slots (sin slot libre el corrector fusiona).
    for (const slots of [['pm'], ['am', 'pm']] as ProteinShake['slots'][]) for (const seed of [12345, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      const r = await generateWeeklyPlan(T, pol, '', seed, shake(type, slots));
      const svc = r.days.flatMap((d) => d.meals).find((m) => m.name.startsWith(`${SHAKE_NAME} + `));
      if (svc) return { days: r.days, svc };
    }
    throw new Error('el motor no produjo un batido combinado');
  }
  it('F/G · whey COMBINADO: strict → restriction; soft → preference (nunca unknown-dish)', async () => {
    const { days, svc } = await combined('regular', []);
    expect(classifyService(svc)).toBe('shake-combined');
    for (const [pol, kind] of [[STRICT_L, 'restriction'], [SOFT_L, 'preference']] as const) {
      const v = validatePlan({ days }, pol).violations;
      expect(v.some((x) => x.kind === 'unknown-dish')).toBe(false);
      expect(shakeKinds(days, pol)).toEqual([kind]);
    }
  });
  it('H · vegana COMBINADA con lácteos semanal y partes compatibles → válida', async () => {
    const { days, svc } = await combined('vegana', SOFT_L);
    const added = svc.name.split(' + ').slice(1).map((n) => BANCO.find((d) => d.nombre === n)!);
    expect(added.every((d) => !makePreferenceFilter(['lacteos'])(d))).toBe(true);
    expect(validatePlan({ days }, SOFT_L).violations).toEqual([]);
  });
});

describe('I · SELECTOR · la autoridad no ofrece whey / mass gainer con lácteos semanal', () => {
  it('veredicto por tipo con su origen', () => {
    expect(shakeTypeOptions(SOFT_L)).toEqual([
      { type: 'regular', compatible: false, blockedBy: 'lacteos', origin: 'soft' },
      { type: 'vegana', compatible: true, blockedBy: null, origin: null },
      { type: 'massgainer', compatible: false, blockedBy: 'lacteos', origin: 'soft' },
    ]);
    expect(shakeTypeVerdict('regular', STRICT_L)).toEqual({ compatible: false, blockedBy: 'lacteos', origin: 'strict' });
    expect(shakeTypeVerdict('regular', P(['lacteos'], ['lacteos']))).toMatchObject({ origin: 'strict' });   // strict gana
    expect(shakeTypeVerdict('regular', P(['gluten'], ['huevo']))).toEqual({ compatible: true, blockedBy: null, origin: null });
    expect(shakeTypeVerdict('regular', ['lacteos'])).toMatchObject({ compatible: false, origin: 'strict' });   // lista = strict
  });
});

// ── BOWL ─────────────────────────────────────────────────────────────────────
const HUMO: FixedMeal = { slot: 'Comida', name: 'Humo', kcal: 737, prot: 59, fat: 31, carb: 64 };
function bowlPlan(pol: AvoidPolicy) {
  const days = buildWeeklyPlan({ kcal: 2400, protG: 160, fatG: 70, carbG: 280 }, { seed: 7, avoid: pol });
  return { days: [buildDayWithFixed({ kcal: 2400, protG: 160, fatG: 70, carbG: 280 }, HUMO, { seed: 7, avoid: pol }, 1), ...days.slice(1)] as DayPlan[] };
}
const bowlKinds = (pol: AvoidPolicy) => validatePlan(bowlPlan(pol), pol).violations.filter((v) => v.dish === 'Humo').map((v) => v.kind);

describe('BOWL · D-WP6', () => {
  it.each([['J', P(['huevo'], [])], ['K', P(['lacteos'], [])], ['N', P(['huevo'], ['lacteos'])]] as const)(
    '%s · strict no vacío → falla cerrado (unverifiable)', (_k, pol) => {
      expect(bowlKinds(pol)).toEqual(['unverifiable']);
      expect(planIfValid(bowlPlan(pol), pol)).toBeNull();
    });
  it.each([['L', P([], ['huevo'])], ['M', P([], ['lacteos'])]] as const)('%s · solo soft → permitido; el plan es válido', (_k, pol) => {
    expect(bowlKinds(pol)).toEqual([]);
    const plan = bowlPlan(pol);
    expect(validatePlan(plan, pol).violations).toEqual([]);
    expect(planIfValid(plan, pol)).toBe(plan);
  });
  it('O · sin restricciones ni preferencias → válido (comportamiento existente)', () => {
    expect(validatePlan(bowlPlan(P([], [])), P([], [])).violations).toEqual([]);
  });
  it('no se aplica soft por nombre: un bowl que «suena» a la categoría también se permite con solo soft', () => {
    const days = buildWeeklyPlan({ kcal: 2400, protG: 160, fatG: 70, carbG: 280 }, { seed: 7, avoid: P([], ['pescado']) });
    const plan = { days: [buildDayWithFixed({ kcal: 2400, protG: 160, fatG: 70, carbG: 280 }, { ...HUMO, name: 'Bowl de Salmón' }, { seed: 7, avoid: P([], ['pescado']) }, 1), ...days.slice(1)] };
    expect(validatePlan(plan, P([], ['pescado'])).violations).toEqual([]);
    expect(validatePlan(plan, P(['pescado'], [])).violations.map((v) => v.kind)).toContain('unverifiable');
  });
  it('P · el resto del día alrededor del bowl respeta strict + soft (ningún otro platillo se relaja)', () => {
    const pol = P(['huevo'], ['lacteos']);
    for (const seed of [1, 2, 3, 4]) {
      const day = buildDayWithFixed({ kcal: 2400, protG: 160, fatG: 70, carbG: 280 }, HUMO, { seed, avoid: pol }, 1);
      const resto = day.meals.filter((m) => m.name !== 'Humo').flatMap((m) => m.name.split(' + ').map((n) => BANCO.find((d) => d.nombre === n)!)) as BancoDish[];
      expect(resto.length).toBeGreaterThan(0);
      expect(resto.filter((d) => makeAvoidFilter(['huevo'])(d) || makePreferenceFilter(['lacteos'])(d)).map((d) => d.nombre), `seed ${seed}`).toEqual([]);
    }
  });
  it('invalidación: añadir una restricción PERMANENTE a un plan con bowl lo descarta (strict-only, sin cambio)', () => {
    const plan = bowlPlan(P([], ['lacteos']));
    expect(planViolatesAvoid(plan, ['gluten'])).toBe(true);
    expect(planInvalidatedByAvoidChange('', 'gluten', plan).invalidated).toBe(true);
  });
});

describe('TabHoy · guardado del día con bowl con la política del plan', () => {
  const S = () => useAppStore.getState();
  const base = { generatedAt: 'x', mealPlanKey: 'planA', selectedDays: [1, 2, 3, 4, 5, 6, 7], shoppingList: [], nota: '', preferences: 'lacteos' };
  it('solo preferencia semanal → se guarda; con la misma categoría PERMANENTE → se rechaza (unverifiable)', async () => {
    const plan = { ...base, ...bowlPlan(P([], ['lacteos'])), gen: { avoid: ['lacteos'], avoidPermanent: [], avoidWeekly: ['lacteos'], avoidSemantics: 2 } };
    expect(avoidPolicyForPlan(plan.gen, plan.preferences, { avoid: '' })).toEqual(SOFT_L);
    useAppStore.setState({ user: null, weeklyPlan: null, obData: { avoid: '' } as never });
    await S().saveWeeklyPlan(plan as never);
    expect(S().weeklyPlan).toBe(plan);
    useAppStore.setState({ weeklyPlan: null, obData: { avoid: 'lacteos' } as never });
    const err = await S().saveWeeklyPlan(plan as never).catch((e) => e);
    expect(err).toBeInstanceOf(InvalidPlanError);
    expect((err as InvalidPlanError).verdict.violations.map((v: PlanViolation) => v.kind)).toContain('unverifiable');
  });
});
