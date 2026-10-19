import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BANCO, type BancoDish } from '../../data/banco';
import { makeAvoidFilter } from '../planEngine';
import type { InvalidPlanError as InvalidPlanErrorType } from '../planIntegrity';

// `vi.resetModules()` + import dinámico del store cargan un grafo de módulos NUEVO, así que
// la clase InvalidPlanError del grafo del test NO es la misma identidad que la que lanza el
// store. Se importa dentro de cada test, del mismo grafo, para que instanceof sea válido.
const cargar = async () => ({
  useAppStore: (await import('../../store')).useAppStore,
  InvalidPlanError: (await import('../planIntegrity')).InvalidPlanError,
});

// ─────────────────────────────────────────────────────────────────────────────
// P0-04 · LAS PUERTAS, PROBADAS DE VERDAD (no por texto del código fuente).
//
// Este entorno jsdom no expone `localStorage` —es la causa raíz de los fallos
// preexistentes del store en la suite completa—, así que se stubea aquí un Storage en
// memoria. No se arregla nada ajeno: solo se da a ESTE fichero lo que necesita para poder
// ejercitar la rehidratación y el guardado reales del store.
//
// Se cubren las dos puertas que P0-04 añade:
//   · AL GUARDAR    · saveWeeklyPlan valida contra el perfil ACTUAL y rechaza.
//   · AL HIDRATAR   · merge sanea el plan persistido antes de que el estado exista.
// ─────────────────────────────────────────────────────────────────────────────

function memStorage(): Storage {
  let m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => { m = new Map(); },
    getItem: (k: string) => m.get(k) ?? null,
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => { m.delete(k); },
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
  } as Storage;
}
vi.stubGlobal('localStorage', memStorage());

const find = (t: string, p: (d: BancoDish) => boolean = () => true) => BANCO.find((d) => d.tiempo === t && p(d))!;
const DES = find('Desayuno', (d) => !makeAvoidFilter(['lacteos', 'gluten'])(d));
const CENA = find('Cena');
const DES_LACTEO = find('Desayuno', (d) => makeAvoidFilter(['lacteos'])(d));
const ings = (d: BancoDish) => d.ings.map((i) => ({ nv: i.nv, g: 1, rol: i.rol }));

/** Plan de 7 días cuyo único servicio diario es el platillo indicado, en el slot indicado. */
function planDe(d: BancoDish, slot = d.tiempo) {
  return {
    generatedAt: '2026-09-01T00:00:00.000Z', mealPlanKey: 'planA',
    selectedDays: [1, 2, 3, 4, 5, 6, 7], shoppingList: [], nota: '', preferences: '',
    engineVersion: 30,
    gen: { kcal: 2000, protG: 150, fatG: 60, carbG: 215, avoid: [] as string[], avoidWeekly: [] as string[] },
    days: Array.from({ length: 7 }, (_, k) => ({
      day: k + 1, theme: '',
      meals: [{ time: slot, name: d.nombre, desc: '', portions: ['porción'], ings: ings(d) }],
    })),
  };
}
const seed = (state: Record<string, unknown>) =>
  localStorage.setItem('hsc-store', JSON.stringify({ state, version: 0 }));

beforeEach(() => { localStorage.clear(); vi.resetModules(); });

// ═════════════════════════════════════════════════════════════════════════════
describe('P0-04 · AL HIDRATAR · localStorage', () => {
  it('un plan con un platillo en el tiempo incorrecto NO llega al estado', async () => {
    seed({ weeklyPlan: planDe(CENA, 'Desayuno'), obData: {} });
    const { useAppStore } = await import('../../store');
    await new Promise((r) => setTimeout(r, 50));
    expect(useAppStore.getState().weeklyPlan).toBeNull();
  });

  it('un plan válido SÍ se conserva (no es un apagón general)', async () => {
    seed({ weeklyPlan: planDe(DES), obData: {} });
    const { useAppStore } = await import('../../store');
    await new Promise((r) => setTimeout(r, 50));
    expect(useAppStore.getState().weeklyPlan?.days).toHaveLength(7);
  });

  it('un plan coherente consigo mismo pero incompatible con el obData PERSISTIDO se descarta', async () => {
    // el plan se generó sin restricciones (gen.avoid vacío) y sirve lácteos; el perfil
    // guardado dice «sin lácteos» → las permanentes actuales mandan.
    seed({ weeklyPlan: planDe(DES_LACTEO), obData: { avoid: 'lacteos' } });
    const { useAppStore } = await import('../../store');
    await new Promise((r) => setTimeout(r, 50));
    expect(useAppStore.getState().weeklyPlan).toBeNull();
  });

  it('el plan descartado tampoco pasa el gate de render', async () => {
    seed({ weeklyPlan: planDe(CENA, 'Desayuno'), obData: {} });
    const { useAppStore } = await import('../../store');
    const { hasGeneratedWeeklyPlan } = await import('../weeklyPlanState');
    await new Promise((r) => setTimeout(r, 50));
    expect(hasGeneratedWeeklyPlan(useAppStore.getState().weeklyPlan)).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('P0-04 · AL GUARDAR · saveWeeklyPlan', () => {
  it('rechaza un plan con tiempo incorrecto: lanza y NO toca el estado', async () => {
    const { useAppStore, InvalidPlanError } = await cargar();
    await expect(useAppStore.getState().saveWeeklyPlan(planDe(CENA, 'Desayuno') as never))
      .rejects.toBeInstanceOf(InvalidPlanError);
    expect(useAppStore.getState().weeklyPlan, 'no debe persistir nada').toBeNull();
  });

  it('acepta un plan válido', async () => {
    const { useAppStore } = await import('../../store');
    await useAppStore.getState().saveWeeklyPlan(planDe(DES) as never);
    expect(useAppStore.getState().weeklyPlan?.days).toHaveLength(7);
  });

  it('EL AGUJERO DEL BOWL · valida contra el perfil ACTUAL, no contra plan.gen.avoid', async () => {
    const { useAppStore, InvalidPlanError } = await cargar();
    // perfil endurecido DESPUÉS de generar: «sin lácteos»
    useAppStore.setState({ obData: { avoid: 'lacteos' } });
    const plan = planDe(DES_LACTEO);          // gen.avoid = [] → "válido" según el propio plan
    await expect(useAppStore.getState().saveWeeklyPlan(plan as never))
      .rejects.toBeInstanceOf(InvalidPlanError);
    expect(useAppStore.getState().weeklyPlan).toBeNull();
  });

  it('el error explica qué violó, para poder diagnosticarlo', async () => {
    const { useAppStore, InvalidPlanError } = await cargar();
    try {
      await useAppStore.getState().saveWeeklyPlan(planDe(CENA, 'Desayuno') as never);
      throw new Error('debió lanzar');
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidPlanError);
      const err = e as InvalidPlanErrorType;
      expect(err.verdict.valid).toBe(false);
      expect(err.verdict.violations.every((v) => v.kind === 'time')).toBe(true);
      expect(err.verdict.violations[0].dish).toBe(CENA.nombre);
    }
  });
});
