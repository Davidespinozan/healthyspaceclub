import { describe, it, expect, vi, beforeEach } from 'vitest';

// La ruta IA llama a callAI: se simula para controlar la SELECCIÓN y comprobar que el código manda.
const callAI = vi.fn();
vi.mock('../aiProxy', () => ({ callAI: (...a: unknown[]) => callAI(...a) }));

import { BANCO, type BancoDish } from '../../data/banco';
import {
  makeAvoidFilter, makePreferenceFilter, makePolicyFilter, toAvoidPolicy, avoidInputUnion,
  safeBankByTiempo, adequateBankByTiempo, buildWeeklyPlan, buildDayWithFixed, solveSlot,
  type AvoidPolicy, type PlanTarget,
} from '../planEngine';
import { generateWeeklyPlan } from '../planOrchestration';
import { validatePlan } from '../planIntegrity';
import { avoidPolicy } from '../avoidAuthority';
import type { DayPlan } from '../../types';
import PLANNER_SRC from '../../components/WeeklyNutritionPlanner.tsx?raw';
import TABHOY_SRC from '../../components/TabHoy.tsx?raw';
import ORCH_SRC from '../planOrchestration.ts?raw';

// ─────────────────────────────────────────────────────────────────────────────
// WEEKLY PREFERENCES SPLIT · MB3 · el GENERADOR filtra con la política: strict (permanentes) con el
// detector estricto + soft (semana) con el suave. Pool de la IA, ensamblado, fallback, corrector y día
// con bowl usan el MISMO `makePolicyFilter`; `validatePlan(policy)` es el guard final, en paridad.
// ─────────────────────────────────────────────────────────────────────────────

const TARGETS: PlanTarget[] = [
  { kcal: 2473, protG: 148, fatG: 69, carbG: 315 },
  { kcal: 1800, protG: 130, fatG: 55, carbG: 195 },
  { kcal: 3000, protG: 170, fatG: 85, carbG: 390 },
];
const P = (strict: string[], soft: string[]): AvoidPolicy => ({ strict, soft });
const dish = (n: string): BancoDish => { const d = BANCO.find((x) => x.nombre === n); if (!d) throw new Error(n); return d; };
const allSafe = (a: AvoidPolicy | string[]) => Object.values(safeBankByTiempo(a)).flat().map((d) => d.nombre);
const names = (days: DayPlan[]) => days.flatMap((d) => d.meals.flatMap((m) => m.name.split(' + ')));
const excluded = (a: AvoidPolicy) => BANCO.filter(makePolicyFilter(a)).length;
const contradicts = (days: DayPlan[], a: AvoidPolicy) =>
  validatePlan({ days }, a).violations.filter((v) => v.kind === 'restriction' || v.kind === 'preference');

beforeEach(() => { callAI.mockReset(); callAI.mockResolvedValue({ content: [{ text: '{}' }] }); });

describe('A · POOL strict vs soft', () => {
  it('el filtro del generador = makeAvoidFilter(strict) ∪ makePreferenceFilter(soft), sin colapsar', () => {
    const pol = P(['gluten'], ['huevo', 'lacteos']);
    const f = makePolicyFilter(pol), st = makeAvoidFilter(['gluten']), so = makePreferenceFilter(['huevo', 'lacteos']);
    for (const d of BANCO) expect(f(d), d.nombre).toBe(st(d) || so(d));
  });
  it('una lista suelta sigue siendo TODO estricto (misma salida que antes de MB3)', () => {
    expect(toAvoidPolicy(['huevo'])).toEqual({ strict: ['huevo'], soft: [] });
    expect(allSafe(['huevo'])).toEqual(allSafe(P(['huevo'], [])));
  });
  it('strict gana en el solapamiento', () => {
    expect(toAvoidPolicy(P(['huevo'], ['huevo', 'soya']))).toEqual({ strict: ['huevo'], soft: ['soya'] });
    expect(allSafe(P(['huevo'], ['huevo']))).toEqual(allSafe(P(['huevo'], [])));
    expect(avoidInputUnion(P(['huevo'], ['soya']))).toEqual(['huevo', 'soya']);
  });
});

describe('B–E · CONTEOS DE EXCLUSIÓN en el banco real (mismos que MB1)', () => {
  it('B · huevo soft → 64', () => expect(excluded(P([], ['huevo']))).toBe(64));
  it('C · huevo strict → 84', () => expect(excluded(P(['huevo'], []))).toBe(84));
  it('D · lácteos soft → 169', () => expect(excluded(P([], ['lacteos']))).toBe(169));
  it('E · lácteos strict → 175', () => expect(excluded(P(['lacteos'], []))).toBe(175));
});

describe('CASOS DE PRODUCTO · elegibilidad en el pool del generador', () => {
  it.each(['Huevos Rancheros', 'Machaca con Huevo', 'Bowl de Lentejas con Huevo Pochado', 'Huevos Pochados sobre Toast de Aguacate'])(
    'huevo visible · %s → fuera con huevo semanal y con permanente', (n) => {
      expect(allSafe(P([], ['huevo']))).not.toContain(n);
      expect(allSafe(P(['huevo'], []))).not.toContain(n);
    });
  it.each(['Tostadas de Atún', 'Pasta Fría con Pollo y Aderezo Chipotle', 'Ensalada César con Pollo'])(
    'huevo en mayonesa/aderezo · %s → PUEDE entrar con huevo semanal; fuera con permanente', (n) => {
      expect(allSafe(P([], ['huevo']))).toContain(n);
      expect(allSafe(P(['huevo'], []))).not.toContain(n);
    });
  it.each(['Queso Fresco con Cacahuate y Manzana', 'Bowl de Cottage con Durazno y Nuez', 'Panela a la Plancha con Salsa', 'Camote Relleno de Carne Molida'])(
    'lácteo visible (queso/cottage/panela/crema) · %s → fuera con lácteos semanal y permanente', (n) => {
      expect(allSafe(P([], ['lacteos']))).not.toContain(n);
      expect(allSafe(P(['lacteos'], []))).not.toContain(n);
    });
  it.each(['Bowl de Camarón Mediterráneo', 'Burger Bowl', 'Bowl de Salmón y Quinoa con Aguacate'])(
    'K/L · yogurt solo en la sub-receta · %s → elegible con lácteos semanal; fuera con permanente', (n) => {
      expect(allSafe(P([], ['lacteos']))).toContain(n);
      expect(allSafe(P(['lacteos'], []))).not.toContain(n);
    });
});

describe('F · RUTA IA · el pool llega filtrado en código y cada pick se re-verifica', () => {
  it('la IA no recibe restricciones en el prompt: la autoridad es el pool', () => {
    expect(ORCH_SRC).toMatch(/const bank = adequateBankByTiempo\(avoid, target, craving, region\);/);
    expect(ORCH_SRC).toMatch(/buildWeeklyPlanSelectPrompt\(\{ target, craving, bank, snacksPerDay \}\)/);
  });
  it('soft huevo: la IA pide Huevos Rancheros y Tostadas de Atún → solo entra lo compatible con soft', async () => {
    const t = TARGETS[1];
    const bank = adequateBankByTiempo(P([], ['huevo']), t, '', undefined);
    const desayunos = bank.Desayuno.map((d) => d.nombre);
    expect(desayunos).not.toContain('Huevos Rancheros');
    const pideMayo = [...bank.Comida, ...bank.Cena].find((d) => makeAvoidFilter(['huevo'])(d));   // huevo SOLO oculto
    expect(pideMayo, 'el pool suave ofrece al menos un platillo con huevo solo oculto').toBeDefined();
    const dias = Array.from({ length: 7 }, (_, i) => ({ desayuno: i === 0 ? 'Huevos Rancheros' : desayunos[i], comida: pideMayo?.tiempo === 'Comida' ? pideMayo.nombre : bank.Comida[i].nombre,
      cena: pideMayo?.tiempo === 'Cena' ? pideMayo.nombre : bank.Cena[i].nombre, snacks: [] }));
    callAI.mockResolvedValue({ content: [{ text: JSON.stringify({ dias }) }] });
    const r = await generateWeeklyPlan(t, P([], ['huevo']), '', 3);
    expect(r.source).toBe('ia');
    expect(names(r.days)).not.toContain('Huevos Rancheros');
    expect(r.days.flatMap((d) => d.meals.flatMap((m) => m.name.split(' + ').map((n) => BANCO.find((x) => x.nombre === n)!)))
      .filter((d) => d && makePreferenceFilter(['huevo'])(d))).toEqual([]);
    expect(names(r.days), 'el huevo solo oculto sí puede entrar').toContain(pideMayo!.nombre);
    expect(contradicts(r.days, P([], ['huevo']))).toEqual([]);
  });
  it('strict huevo: nada con presencia real de huevo entra por la IA', async () => {
    const r = await generateWeeklyPlan(TARGETS[0], P(['huevo'], []), '', 3);
    expect(r.days.flatMap((d) => d.meals.flatMap((m) => m.name.split(' + ').map((n) => BANCO.find((x) => x.nombre === n))))
      .filter((d) => d && makeAvoidFilter(['huevo'])(d))).toEqual([]);
  });
});

describe('G · FALLBACK · misma semántica que la IA', () => {
  it('soft huevo: sin huevo visible; con huevo solo oculto permitido', async () => {
    callAI.mockRejectedValue(new Error('ia caída'));
    let ocultos = 0;
    for (const t of TARGETS) for (const seed of [1, 2, 3, 4]) {
      const r = await generateWeeklyPlan(t, P([], ['huevo']), '', seed);
      expect(r.source).toBe('codigo');
      const ds = names(r.days).map((n) => BANCO.find((x) => x.nombre === n)!).filter(Boolean);
      expect(ds.filter((d) => makePreferenceFilter(['huevo'])(d)).map((d) => d.nombre)).toEqual([]);
      ocultos += ds.filter((d) => makeAvoidFilter(['huevo'])(d)).length;
      expect(contradicts(r.days, P([], ['huevo']))).toEqual([]);
    }
    expect(ocultos, 'el fallback sí usa el pool suave (antes estaba vetado)').toBeGreaterThan(0);
  });
  it('IA y fallback comparten el mismo filtro: ningún platillo fuera del pool seguro en ninguna ruta', async () => {
    const pol = P(['gluten'], ['lacteos']);
    const seguros = new Set(allSafe(pol));
    for (const mode of ['ia', 'codigo'] as const) {
      callAI.mockReset();
      if (mode === 'ia') callAI.mockResolvedValue({ content: [{ text: '{}' }] }); else callAI.mockRejectedValue(new Error('x'));
      const r = await generateWeeklyPlan(TARGETS[0], pol, '', 9);
      expect(r.source).toBe(mode);
      for (const n of names(r.days)) if (n !== 'Batido de Proteína') expect(seguros.has(n), `${mode} · ${n}`).toBe(true);
    }
  });
});

describe('I / J · huevo + mayonesa', () => {
  it('I · soft huevo: un plan generado con platillos de mayonesa pasa validatePlan', async () => {
    let conMayo = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const days = buildWeeklyPlan(TARGETS[1], { seed, avoid: P([], ['huevo']) });
      conMayo += days.flatMap((d) => d.meals).filter((m) => (m.ings ?? []).some((i) => /mayonesa/i.test(i.nv))).length;
      expect(validatePlan({ days }, P([], ['huevo'])).violations, `seed ${seed}`).toEqual([]);
    }
    expect(conMayo, 'la mayonesa sí aparece con huevo semanal').toBeGreaterThan(0);
  });
  it('J · strict huevo: la mayonesa nunca entra al pool ni al plan', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const days = buildWeeklyPlan(TARGETS[1], { seed, avoid: P(['huevo'], []) });
      expect(days.flatMap((d) => d.meals).filter((m) => (m.ings ?? []).some((i) => /mayonesa/i.test(i.nv)))).toEqual([]);
    }
    expect(allSafe(P(['huevo'], [])).filter((n) => dish(n).ings.some((i) => /mayonesa/i.test(i.nv)))).toEqual([]);
  });
});

describe('PARIDAD generador ↔ validador', () => {
  const POLS = [P([], ['huevo']), P([], ['lacteos']), P(['huevo'], ['lacteos']), P(['gluten'], ['huevo', 'soya']), P(['lacteos'], []), P([], ['gluten', 'ajonjoli', 'frutos-secos'])];
  it('por platillo: el pool del generador y el validador coinciden en todo el banco', () => {
    for (const pol of POLS) {
      const f = makePolicyFilter(pol);
      for (const d of BANCO) {
        const svc = solveSlot([d], d.tiempo === 'Snack' ? 'Snack AM' : d.tiempo, [0, 25, 12, 40])[0];
        const v = validatePlan({ days: [{ day: 1, meals: [svc] }] }, pol).violations.filter((x) => x.kind === 'restriction' || x.kind === 'preference');
        expect(v.length > 0, `${JSON.stringify(pol)} · ${d.nombre}`).toBe(f(d));
      }
    }
  });
  it('por plan: todo lo que generan IA y fallback pasa validatePlan(policy) sin restriction/preference', async () => {
    for (const pol of POLS) for (const t of TARGETS) for (const mode of ['ia', 'codigo'] as const) {
      callAI.mockReset();
      if (mode === 'ia') callAI.mockResolvedValue({ content: [{ text: '{}' }] }); else callAI.mockRejectedValue(new Error('x'));
      const r = await generateWeeklyPlan(t, pol, '', 5, { slots: ['am'], type: 'vegana', protG: 25 });
      expect(contradicts(r.days, pol), `${JSON.stringify(pol)} · ${t.kcal} · ${mode}`).toEqual([]);
    }
  }, 60_000);   // 36 generaciones completas: bajo la carga de la suite completa rozaba el timeout global de 20 s
});

describe('PLANIFICADOR y TabHoy pasan la política (no la unión) al generador', () => {
  it('planificador: genera con la política y persiste avoid / avoidPermanent / avoidWeekly / avoidSemantics', () => {
    expect(PLANNER_SRC).toMatch(/const policy = avoidPolicy\(avoidPermanent, avoidWeekly\);/);
    expect(PLANNER_SRC).toMatch(/await generateWeeklyPlan\(target, policy, /);
    expect(PLANNER_SRC).toMatch(/avoid, avoidPermanent, avoidWeekly, avoidSemantics: AVOID_SEMANTICS,/);
    expect(avoidPolicy(['huevo'], ['huevo', 'lacteos'])).toEqual({ strict: ['huevo'], soft: ['lacteos'] });
  });
  it('TabHoy (día con bowl): el resto del día se genera con la política del plan', () => {
    expect(TABHOY_SRC).toMatch(/const avoidAhora = avoidPolicyForPlan\(g, weeklyPlan\.preferences, obData\);/);
    expect(TABHOY_SRC).toMatch(/\{ avoid: avoidAhora, craving: g\.craving \}/);
  });
});

describe('N / O · batido (D-WP5) y bowl (D-WP6)', () => {
  it('el batido se decide sobre la UNIÓN: whey se omite con lácteos permanente o semanal', () => {
    for (const pol of [P(['lacteos'], []), P([], ['lacteos'])]) {
      const days = buildWeeklyPlan(TARGETS[0], { seed: 1, avoid: pol, shake: { slots: ['am'], type: 'regular', protG: 25 } });
      expect(days.flatMap((d) => d.meals).filter((m) => m.name.startsWith('Batido de Proteína'))).toEqual([]);
    }
    const vegana = buildWeeklyPlan(TARGETS[0], { seed: 1, avoid: P([], ['lacteos']), shake: { slots: ['am'], type: 'vegana', protG: 25 } });
    expect(vegana.flatMap((d) => d.meals).some((m) => m.name.startsWith('Batido de Proteína'))).toBe(true);
  });
  it('el día con bowl se arma con el pool de la política; con solo soft el bowl se permite (D-WP6, MB4)', () => {
    const day = buildDayWithFixed(TARGETS[0], { slot: 'Comida', name: 'Verde', kcal: 737, prot: 59, fat: 31, carb: 64 }, { seed: 2, avoid: P([], ['huevo']) }, 1);
    const ds = day.meals.flatMap((m) => m.name.split(' + ')).map((n) => BANCO.find((x) => x.nombre === n)).filter(Boolean) as BancoDish[];
    expect(ds.filter((d) => makePreferenceFilter(['huevo'])(d))).toEqual([]);
    const plan = { days: [day, ...buildWeeklyPlan(TARGETS[0], { seed: 2, avoid: P([], ['huevo']) }).slice(1)] };
    expect(validatePlan(plan, P([], ['huevo'])).violations).toEqual([]);
    expect([...new Set(validatePlan(plan, P(['huevo'], [])).violations.map((v) => v.kind))]).toContain('unverifiable');
  });
});
