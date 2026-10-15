import { describe, it, expect, vi, beforeEach } from 'vitest';

// La ruta IA llama a callAI: se simula. '{}' obliga a la orquestación a rellenar la selección con
// platillos del banco filtrado, pero el ensamblado (donde se aplicaba el batido) es el de producción.
const callAI = vi.fn();
vi.mock('../aiProxy', () => ({ callAI: (...a: unknown[]) => callAI(...a) }));

import {
  shakeCompatibleWith,
  shakeAllowedFor,
  shakeTypeOfService,
  buildWeeklyPlan,
  type ProteinShake,
} from '../planEngine';
import { generateWeeklyPlan } from '../planOrchestration';
import { validatePlan, planIfValid } from '../planIntegrity';
import { effectiveAvoid, permanentAvoidFrom, weeklyAvoidFrom, planViolatesAvoid, PERMANENT_AVOID_CATALOG } from '../avoidAuthority';
import type { DayPlan } from '../../types';
import PLANNER_SRC from '../../components/WeeklyNutritionPlanner.tsx?raw';

// ─────────────────────────────────────────────────────────────────────────────
// RESTRICTIONS SAFETY FIX · batido vs restricciones. `lacteos` → nunca whey (regular / mass gainer).
// Una sola autoridad (`shakeCompatibleWith`) en: ruta IA, fallback, validación final e invalidación.
// ─────────────────────────────────────────────────────────────────────────────

const TARGET = { kcal: 2400, protG: 160, fatG: 70, carbG: 280 };
const shake = (type: ProteinShake['type']): ProteinShake => ({ slots: ['am'], type, protG: 30 });
const shakesIn = (days: DayPlan[]) => days.flatMap((d) => d.meals).filter((m) => m.name === 'Batido de Proteína');

beforeEach(() => { callAI.mockReset(); callAI.mockResolvedValue({ content: [{ text: '{}' }] }); });

describe('AUTORIDAD ÚNICA · shakeCompatibleWith', () => {
  it('whey (regular / mass gainer) es incompatible con lacteos; vegana sí es compatible', () => {
    expect(shakeCompatibleWith('regular', ['lacteos'])).toBe(false);
    expect(shakeCompatibleWith('massgainer', ['lacteos'])).toBe(false);
    expect(shakeCompatibleWith('vegana', ['lacteos'])).toBe(true);
  });
  it('sin lacteos el whey sigue permitido', () => {
    expect(shakeCompatibleWith('regular', [])).toBe(true);
    expect(shakeCompatibleWith('massgainer', [])).toBe(true);
  });
  it('ninguna otra categoría del catálogo bloquea el whey por accidente', () => {
    for (const c of PERMANENT_AVOID_CATALOG.filter((x) => x !== 'lacteos')) {
      expect(shakeCompatibleWith('regular', [c]), c).toBe(true);
    }
  });
  it('alias canónicos de lácteos también bloquean; vegano (inactivo) no bloquea nada', () => {
    for (const a of ['lacteos', 'Lácteos', 'lacteo', 'sin lacteos']) expect(shakeCompatibleWith('regular', [a]), a).toBe(false);
    expect(shakeCompatibleWith('regular', ['vegano'])).toBe(true);
    expect(shakeCompatibleWith('regular', ['vegetariano'])).toBe(true);
  });
  it('tipo desconocido con lacteos falla cerrado', () => {
    expect(shakeCompatibleWith(null, ['lacteos'])).toBe(false);
    expect(shakeCompatibleWith(null, [])).toBe(true);
  });
  it('shakeAllowedFor: sin batido no hay nada que bloquear; no sustituye por otro tipo', () => {
    expect(shakeAllowedFor(undefined, ['lacteos'])).toBe(true);
    expect(shakeAllowedFor(shake('regular'), ['lacteos'])).toBe(false);
  });
});

describe('AUTORIDAD DE RESTRICCIONES · permanente, semanal y unión', () => {
  const perm = permanentAvoidFrom({ avoid: 'lacteos' });
  const week = weeklyAvoidFrom('lacteos');
  it('lacteos permanente + whey → no permitido', () => expect(shakeAllowedFor(shake('regular'), effectiveAvoid(perm, []))).toBe(false));
  it('lacteos semanal + whey → no permitido', () => expect(shakeAllowedFor(shake('regular'), effectiveAvoid([], week))).toBe(false));
  it('la unión conserva el bloqueo', () => {
    expect(shakeAllowedFor(shake('massgainer'), effectiveAvoid(permanentAvoidFrom({ avoid: 'gluten' }), week))).toBe(false);
    expect(shakeAllowedFor(shake('regular'), effectiveAvoid(perm, weeklyAvoidFrom('gluten')))).toBe(false);
  });
  it('vegano / vegetariano siguen fuera de la autoridad activa', () => {
    expect(permanentAvoidFrom({ avoid: 'vegano,vegetariano' })).toEqual([]);
    expect(weeklyAvoidFrom('vegano')).toEqual([]);
    expect(PERMANENT_AVOID_CATALOG as readonly string[]).not.toContain('vegano');
  });
});

describe('BUG DE CARRIL B · lacteos + batido Regular (whey)', () => {
  const avoid = effectiveAvoid(permanentAvoidFrom({ avoid: 'lacteos' }), []);
  it('RUTA IA principal: ya NO sirve whey (antes sí)', async () => {
    const r = await generateWeeklyPlan(TARGET, avoid, '', 7, shake('regular'));
    expect(r.source).toBe('ia');
    expect(callAI).toHaveBeenCalled();
    expect(shakesIn(r.days)).toEqual([]);
    expect(validatePlan({ days: r.days }, avoid).valid).toBe(true);
  });
  it('RUTA IA principal sin lacteos: el whey sí aparece', async () => {
    const r = await generateWeeklyPlan(TARGET, [], '', 7, shake('regular'));
    expect(r.source).toBe('ia');
    expect(shakesIn(r.days).length).toBeGreaterThan(0);
    expect(shakesIn(r.days).every((m) => shakeTypeOfService(m) === 'regular')).toBe(true);
  });
  it('RUTA IA con lacteos + batido vegano: el batido vegano sí se sirve', async () => {
    const r = await generateWeeklyPlan(TARGET, avoid, '', 7, shake('vegana'));
    expect(r.source).toBe('ia');
    expect(shakesIn(r.days).length).toBeGreaterThan(0);
    expect(shakesIn(r.days).every((m) => shakeTypeOfService(m) === 'vegana')).toBe(true);
  });
  it('FALLBACK (IA caída): tampoco sirve whey', async () => {
    callAI.mockRejectedValue(new Error('ia caída'));
    const r = await generateWeeklyPlan(TARGET, avoid, '', 7, shake('regular'));
    expect(r.source).toBe('codigo');
    expect(shakesIn(r.days)).toEqual([]);
    expect(shakesIn(buildWeeklyPlan(TARGET, { avoid, shake: shake('massgainer'), seed: 3 }))).toEqual([]);
  });
});

describe('VALIDACIÓN FINAL · defensa en profundidad', () => {
  const wheyPlan = () => ({ days: buildWeeklyPlan(TARGET, { avoid: [], shake: shake('regular'), seed: 11 }) });
  it('un plan con whey se rechaza bajo lacteos (aunque venga de un bug o del historial)', () => {
    const plan = wheyPlan();
    expect(shakesIn(plan.days).length).toBe(7);
    const v = validatePlan(plan, ['lacteos']);
    expect(v.valid).toBe(false);
    expect(v.violations.some((x) => x.kind === 'restriction' && x.dish === 'Batido de Proteína')).toBe(true);
  });
  it('el mismo plan es válido sin lacteos', () => expect(validatePlan(wheyPlan(), []).valid).toBe(true));
  it('mass gainer también se rechaza; vegano no', () => {
    const mg = { days: buildWeeklyPlan(TARGET, { shake: shake('massgainer'), seed: 5 }) };
    expect(validatePlan(mg, ['lacteos']).valid).toBe(false);
    const vg = { days: buildWeeklyPlan(TARGET, { avoid: ['lacteos'], shake: shake('vegana'), seed: 5 }) };
    expect(shakesIn(vg.days).length).toBe(7);
    expect(validatePlan(vg, ['lacteos']).valid).toBe(true);
  });
  it('hidratación: planIfValid descarta un plan guardado con whey incompatible', () => {
    expect(planIfValid(wheyPlan(), ['lacteos'])).toBeNull();
    // whey + una restricción no relacionada (plan generado ya sin gluten): se conserva
    const sinGluten = { days: buildWeeklyPlan(TARGET, { avoid: ['gluten'], shake: shake('regular'), seed: 11 }) };
    expect(shakesIn(sinGluten.days).length).toBeGreaterThan(0);
    expect(planIfValid(sinGluten, ['gluten'])).not.toBeNull();
  });
  it('endurecer restricciones: añadir lacteos invalida un plan vigente con whey', () => {
    expect(planViolatesAvoid(wheyPlan(), ['lacteos'])).toBe(true);
    expect(planViolatesAvoid({ days: buildWeeklyPlan(TARGET, { shake: shake('vegana'), seed: 2 }) }, ['lacteos'])).toBe(
      planViolatesAvoid({ days: buildWeeklyPlan(TARGET, { seed: 2 }) }, ['lacteos']),
    );
  });
  it('shakeTypeOfService lee el tipo de las mismas etiquetas con que se construye', () => {
    const all = (['regular', 'vegana', 'massgainer'] as const).map((t) => shakesIn(buildWeeklyPlan(TARGET, { shake: shake(t), seed: 1 }))[0]);
    expect(all.map((m) => shakeTypeOfService(m))).toEqual(['regular', 'vegana', 'massgainer']);
  });
});

describe('UI · estado actual del selector (sin cambiar)', () => {
  it('el selector sigue ofreciendo los tres tipos, incluido «Regular» (whey): pendiente de decisión UX', () => {
    expect(PLANNER_SRC).toMatch(/useState<'regular' \| 'vegana' \| 'massgainer'>\('regular'\)/);
  });
});
