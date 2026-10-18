// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE · QA DOMINGO 2026-10-18 · «el plan sigue en 2569 tras el step −1».
//
// Diagnóstico (lecturas de la QA controlada): la vigencia funcionó — el plan se invalidó y se REGENERÓ con la meta
// efectiva nueva (gen = 2349 / P147 / G65 / C294). El «2569» era el TOTAL DEL DÍA (domingo = día 4 con
// shopping_day = jueves) que armaba el ensamblado de la IA del motor v33 (preview), que resolvía cada tiempo por
// separado y NO cerraba el día. CAPA 4 (v35+) añadió el cuadre del día (`topUpDay`) también en la ruta de la IA.
//
//   1 · recorrido completo: meta A vigente → cambio Adaptive efectivo a B → STALE → auto-regeneración con B → ACTIVE.
//   2 · regresión de la causa real: la MISMA selección de la IA de la QA cierra cada día en la meta.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: null } }) },
    functions: { invoke: async () => ({ data: null, error: null }) },
    from: () => ({ upsert: async () => ({ error: null }) }),
  },
}));
const h = vi.hoisted(() => ({ gen: vi.fn() }));
vi.mock('../planOrchestration', () => ({ generateWeeklyPlan: (...a: unknown[]) => h.gen(...a) }));

import { renderHook, waitFor } from '@testing-library/react';
import { useAutoRegenPlan } from '../useAutoRegenPlan';
import { useAppStore } from '../../store';
import { weeklyPlanCurrentness } from '../weeklyPlanState';
import { buildWeeklyPlan, assembleFromSelection, PLAN_ENGINE_VERSION } from '../planEngine';
import { isServableMacroPrescription } from '../macroPrescription';

const OB = { sex: 'Hombre', goal: 'Bajar grasa', edad: 35, estatura: 178, peso: 82, embarazo: 0, requiresTherapeuticDiet: 0,
  dailyLife: 'DL2', trainsHabitually: 1, trainingDaysPerWeek: 5, trainingSessionMinutes: 60, trainingModalities: 'strength', avoid: '' };
const S = () => useAppStore.getState();
const B = { kcal: 2349, protG: 147, fatG: 65, carbG: 294 };     // meta efectiva de la QA tras el step −1
const currentness = () => {
  const s = S();
  return weeklyPlanCurrentness({
    status: s.energyState?.status, planGoal: s.planGoal,
    macros: isServableMacroPrescription(s.macroTargets) ? s.macroTargets : null,
    weeklyPlan: s.weeklyPlan, currentVersion: PLAN_ENGINE_VERSION,
  });
};

beforeEach(() => {
  h.gen.mockReset();
  h.gen.mockImplementation(async (target: typeof B) => ({ days: buildWeeklyPlan(target, { seed: 2 }), source: 'codigo' }));
});

describe('1 · cambio Adaptive efectivo → el plan viejo deja de ser vigente y se regenera con la meta nueva', () => {
  it('A vigente (no regenera) → B efectiva → STALE → regenera UNA vez con B → ACTIVE', async () => {
    useAppStore.setState({ user: null, obData: { ...OB } as never, weeklyPlan: null });
    await S().recalcFromObData('test');
    const mA = S().macroTargets!;
    expect(isServableMacroPrescription(mA)).toBe(true);
    const A = { kcal: S().planGoal!, protG: (mA as { proteinG: number }).proteinG, fatG: (mA as { fatG: number }).fatG, carbG: (mA as { carbG: number }).carbG };
    expect(A.kcal).not.toBe(B.kcal);
    useAppStore.setState({ weeklyPlan: {
      generatedAt: new Date().toISOString(), mealPlanKey: 'planA', selectedDays: [1, 2, 3, 4, 5, 6, 7], shoppingList: [], nota: '', preferences: '',
      days: buildWeeklyPlan(A, { seed: 1 }), engineVersion: PLAN_ENGINE_VERSION, gen: { ...A, craving: '' },
    } as never });
    expect(currentness()).toBe('ACTIVE');

    const { rerender } = renderHook(() => useAutoRegenPlan());
    await new Promise((r) => setTimeout(r, 20));
    expect(h.gen).not.toHaveBeenCalled();                          // plan A vigente: nada que hacer

    // La prescripción Adaptive EFECTIVA cambia (step −1 rige): misma autoridad, nueva cifra y nuevas macros.
    useAppStore.setState({ planGoal: B.kcal, macroTargets: { ...(mA as object), proteinG: B.protG, fatG: B.fatG, carbG: B.carbG } as never });
    expect(currentness()).toBe('STALE');                           // el plan de A ya NO es vigente
    rerender();

    await waitFor(() => expect(h.gen).toHaveBeenCalledTimes(1));
    expect(h.gen.mock.calls[0][0]).toEqual(B);                     // regenera con la meta NUEVA
    await waitFor(() => expect(S().weeklyPlan?.gen).toMatchObject(B));
    expect(S().weeklyPlan?.engineVersion).toBe(PLAN_ENGINE_VERSION);
    expect(currentness()).toBe('ACTIVE');                          // el plan nuevo es el vigente

    rerender();
    await new Promise((r) => setTimeout(r, 20));
    expect(h.gen).toHaveBeenCalledTimes(1);                        // idempotente: no vuelve a regenerar
  });
});

describe('2 · regresión de la causa real: la selección de la IA de la QA cierra CADA día en la meta', () => {
  // Selección reconstruida del plan persistido de la QA (platillos del banco; v33 servía el domingo en 2569 kcal).
  const SEL = [
    { desayuno: 'Pan Pita con Hummus y Pollo', comida: 'Poke Bowl de Atún', cena: 'Bowl de Camarón Mediterráneo', snacks: ['Mango Picado', 'Puñado de Almendras', 'Yogurt Griego con Granola y Fruta', 'Zanahoria y Pepino con Hummus'] },
    { desayuno: 'Calabacitas con Jamón y Quesadillas', comida: 'Carne Molida de Pavo con Calabacitas', cena: 'Tostadas de Champiñones y Espinaca', snacks: ['Plátano con Crema de Cacahuate', 'Fresas', 'Requesón con Nueces Miel y Fruta', 'Bastones de Zanahoria'] },
    { desayuno: 'Tacos de Machaca', comida: 'Bowl de Salmón Glaseado con Mango', cena: 'Caldo de Pollo con Verduras', snacks: ['Rodajas de Piña', 'Puñado de Cacahuates', 'Yogurt con Fruta', 'Pepino con Limón y Chile'] },
    { desayuno: 'Sincronizadas', comida: 'Entomatadas de Pollo', cena: 'Bowl de Pescado Blanco y Verdes', snacks: ['Manzana con Crema de Cacahuate', 'Edamames', 'Mix de Frutos Secos y Chocolate', 'Kiwi'] },
    { desayuno: 'Bagel con Salmón Ahumado', comida: 'Bowl Mediterráneo de Garbanzo y Atún', cena: 'Quesadillas de Camarón', snacks: ['Durazno', 'Huevo Cocido', 'Fresas con Chocolate Negro', 'Carrot Fries al Horno con Chipotle'] },
    { desayuno: 'Omelette de Champiñones y Espinacas', comida: 'Salmón con Ensalada de Papa', cena: 'Tacos de Carne Asada', snacks: ['Mandarina', 'Puñado de Nueces', 'Plátano con Crema de Cacahuate y Avena', 'Esquite Fit'] },
    { desayuno: 'Chilaquiles con Pollo', comida: 'Asado de Res', cena: 'Ensalada Cobb Fit', snacks: ['Toronja', 'Pistaches', 'Dátiles con Nuez', 'Garbanzos Horneados Crujientes'] },
  ];
  it('7 días, cada uno a ±3 % de 2349 kcal y macros a ±15 % (v33 servía el domingo +9.4 %, grasa +31 %)', () => {
    const days = assembleFromSelection(B, SEL, []);
    expect(days).toHaveLength(7);
    for (const d of days) {
      const tot = (k: 'kcal' | 'prot' | 'fat' | 'carb') => d.meals.reduce((a, m) => a + (m.macros?.[k] ?? 0), 0);
      expect(Math.abs(tot('kcal') - B.kcal) / B.kcal, `día ${d.day} kcal ${tot('kcal')}`).toBeLessThanOrEqual(0.03);
      expect(Math.abs(tot('prot') - B.protG) / B.protG, `día ${d.day} P`).toBeLessThanOrEqual(0.15);
      expect(Math.abs(tot('fat') - B.fatG) / B.fatG, `día ${d.day} G`).toBeLessThanOrEqual(0.15);
      expect(Math.abs(tot('carb') - B.carbG) / B.carbG, `día ${d.day} C`).toBeLessThanOrEqual(0.15);
    }
    const domingo = days[3];   // shopping_day = jueves → hoy domingo = día 4 del plan
    expect(domingo.meals.reduce((a, m) => a + (m.macros?.kcal ?? 0), 0)).toBeLessThanOrEqual(Math.round(B.kcal * 1.03));
  });
});
