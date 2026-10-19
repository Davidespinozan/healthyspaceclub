import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Supabase falso que REGISTRA cada escritura (tabla + operación + payload) ──────────
type Call = { table: string; op: 'upsert' | 'delete'; payload?: Record<string, unknown> };
const calls: Call[] = [];
const invoke = vi.fn();
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: null } }) },
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    from: (table: string) => ({
      upsert: async (payload: Record<string, unknown>) => { calls.push({ table, op: 'upsert', payload }); return { error: null }; },
      delete: () => {
        calls.push({ table, op: 'delete' });
        const q: { eq: () => typeof q; then: (r: (v: { error: null }) => void) => void } = { eq: () => q, then: (r) => r({ error: null }) };
        return q;
      },
    }),
  },
}));

import { useAppStore } from '../../store';
import { dayKey } from '../localDate';
import { resolveNutritionEnergyState } from '../nutritionEnergyState';
import { resolveMacroPrescription } from '../macroPrescription';
import { latestBodyWeightKg } from '../bodyWeight';
import { buildCoachContext } from '../coachContext';
import { callNutritionCheckin } from '../nutritionCheckinClient';
import STORE_SRC from '../../store/index.ts?raw';
import EDIT_SRC from '../../components/sheets/EditDataSheet.tsx?raw';
import TRAINER_SRC from '../../components/DailyTrainer.tsx?raw';

// ─────────────────────────────────────────────────────────────────────────────
// Bloque 4 · autoridad del peso nutricional. Un pesaje es SOLO historial: no mueve
// obData.peso, energía, macros, plan_goal ni el plan. El peso nutricional cambia por
// onboarding, por la corrección explícita de «Mis datos» o por el servidor.
// ─────────────────────────────────────────────────────────────────────────────

const OB = { sex: 'Hombre', goal: 'Bajar grasa', edad: 35, estatura: 178, peso: 82, embarazo: 0, requiresTherapeuticDiet: 0,
  dailyLife: 'DL2', trainsHabitually: 1, trainingDaysPerWeek: 5, trainingSessionMinutes: 60, trainingModalities: 'strength', avoid: 'lacteos' };
const S = () => useAppStore.getState();
const PLAN = { days: [], selectedDays: [1], mealPlanKey: 'planA', shoppingList: [], preferences: '' };

async function seed() {
  useAppStore.setState({ user: { id: 'u-1' } as never, obData: { ...OB } as never, weightLog: [], weeklyPlan: PLAN as never });
  await S().recalcFromObData('test-seed');
  calls.length = 0;
}
const nutritionSnapshot = () => {
  const s = S();
  return { peso: s.obData.peso, planGoal: s.planGoal, tdee: s.tdee, mealPlanKey: s.mealPlanKey, energyState: s.energyState, macroTargets: s.macroTargets, weeklyPlan: s.weeklyPlan };
};

beforeEach(async () => { invoke.mockReset(); await seed(); });

describe('WEIGHT LOG · solo historial', () => {
  it('addWeight añade al historial y SOLO escribe weight_log', async () => {
    const before = nutritionSnapshot();
    await S().addWeight(75);
    expect(S().weightLog).toEqual([{ date: dayKey(new Date()), kg: 75 }]);
    expect(calls).toEqual([{ table: 'weight_log', op: 'upsert', payload: { user_id: 'u-1', date: dayKey(new Date()), kg: 75 } }]);
    const after = nutritionSnapshot();
    expect(after.peso).toBe(82);                         // obData.peso intacto
    expect(after.planGoal).toBe(before.planGoal);        // prescribedEnergy / plan_goal intactos
    expect(after.tdee).toBe(before.tdee);
    expect(after.energyState).toBe(before.energyState);  // sin recálculo (misma referencia)
    expect(after.macroTargets).toBe(before.macroTargets);// macros intactas
    expect(after.weeklyPlan).toBe(before.weeklyPlan);    // el plan no se marca stale ni se regenera
  });
  it('removeWeight quita del historial y SOLO borra en weight_log', async () => {
    await S().addWeight(75);
    calls.length = 0;
    const before = nutritionSnapshot();
    await S().removeWeight(dayKey(new Date()));
    expect(S().weightLog).toEqual([]);
    expect(calls).toEqual([{ table: 'weight_log', op: 'delete' }]);
    expect(nutritionSnapshot()).toEqual(before);
    expect(nutritionSnapshot().energyState).toBe(before.energyState);
  });
  it('ni una tendencia sostenida de pesajes mueve el peso nutricional (la mediana N10.1 ya no manda)', async () => {
    const before = nutritionSnapshot();
    useAppStore.setState({ weightLog: Array.from({ length: 13 }, (_, i) => ({ date: dayKey(new Date(Date.now() - (14 - i) * 86_400_000)), kg: 74 })) });
    await S().addWeight(74);
    expect(S().obData.peso).toBe(82);
    expect(S().planGoal).toBe(before.planGoal);
    expect(calls.filter((c) => c.table !== 'weight_log')).toEqual([]);
  });
});

describe('PESO NUTRICIONAL ACEPTADO POR EL SERVIDOR · store y carrera', () => {
  it('applyServerNutritionWeight fija el peso, recalcula y persiste ob_data sin perder claves', async () => {
    const before = nutritionSnapshot();
    await S().applyServerNutritionWeight(76);
    expect(S().obData.peso).toBe(76);
    expect(S().planGoal).not.toBe(before.planGoal);      // el check-in SÍ recalcula (decisión de producto)
    const up = calls.find((c) => c.table === 'user_profiles');
    expect(up?.payload?.ob_data).toEqual({ ...OB, peso: 76 });
  });
  it('un recálculo posterior no revierte el peso aceptado', async () => {
    await S().applyServerNutritionWeight(76);
    calls.length = 0;
    await S().recalcFromObData('later');
    expect((calls.find((c) => c.table === 'user_profiles')?.payload?.ob_data as Record<string, unknown>).peso).toBe(76);
  });
  it('valores inválidos se ignoran', async () => {
    for (const bad of [0, -5, NaN, Infinity]) await S().applyServerNutritionWeight(bad);
    expect(S().obData.peso).toBe(82);
    expect(calls).toEqual([]);
  });
  it('callNutritionCheckin aplica el peso del servidor ANTES de devolver, solo en STARTED/RECORDED', async () => {
    const order: string[] = [];
    const apply = vi.fn(async (kg: number) => { order.push(`apply:${kg}`); });
    invoke.mockResolvedValueOnce({ data: { status: 'RECORDED', nutritionWeightKg: 80.6 }, error: null });
    const r = await callNutritionCheckin('checkin', { requestId: 'x' }, apply);
    order.push('returned');
    expect(order).toEqual(['apply:80.6', 'returned']);
    expect(r.body).toMatchObject({ status: 'RECORDED' });
    expect(invoke).toHaveBeenCalledWith('nutrition-checkin', { body: { action: 'checkin', requestId: 'x' } });

    apply.mockClear();
    invoke.mockResolvedValueOnce({ data: { status: 'ALREADY_ACTIVE', calibrationId: 'c' }, error: null });
    await callNutritionCheckin('start', { requestId: 'y' }, apply);
    invoke.mockResolvedValueOnce({ data: null, error: { context: { status: 400, json: async () => ({ status: 'UNEXPECTED_FIELDS' }) } } });
    expect((await callNutritionCheckin('checkin', { requestId: 'z', objective: 'X' }, apply)).body).toEqual({ status: 'UNEXPECTED_FIELDS' });
    expect(apply).not.toHaveBeenCalled();
  });
});

describe('GUARDS Y MACROS · usan el peso nutricional vigente', () => {
  it('un peso nutricional nuevo sí puede cambiar el alcance (IMC) cuando corresponde', () => {
    expect(resolveNutritionEnergyState({ ...OB, peso: 82 } as never).status).toBe('PRESCRIBED');
    expect(resolveNutritionEnergyState({ ...OB, peso: 55 } as never).status).toBe('FAT_LOSS_BLOCKED'); // IMC 17.4
  });
  it('PRW/proteína se calculan con el peso nutricional vigente', () => {
    const m = (peso: number) => { const ob = { ...OB, peso }; return resolveMacroPrescription(resolveNutritionEnergyState(ob as never), ob as never).prescription; };
    const normal = m(82), obeso = m(120);
    expect(normal?.status).toBe('VALID');
    expect(obeso && 'prwKg' in obeso ? obeso.prwKg : null).not.toBe(normal && 'prwKg' in normal ? normal.prwKg : null);
  });
});

describe('OTROS CONSUMIDORES · Training y Coach siguen viendo el último pesaje', () => {
  it('latestBodyWeightKg: último pesaje válido; si no hay, el del perfil', () => {
    expect(latestBodyWeightKg([{ date: '2026-10-01', kg: 80 }, { date: '2026-10-10', kg: 78.5 }, { date: '2026-10-05', kg: 79 }], 82)).toBe(78.5);
    expect(latestBodyWeightKg([], '82')).toBe(82);
    expect(latestBodyWeightKg([{ date: '2026-10-01', kg: NaN }], 82)).toBe(82);
    expect(latestBodyWeightKg(undefined, undefined)).toBeUndefined();
  });
  it('el contexto del Coach muestra el último pesaje sin tocar el peso nutricional', async () => {
    await S().addWeight(77.2);
    expect(buildCoachContext(S()).user.weightKg).toBe(77.2);
    expect(S().obData.peso).toBe(82);
  });
  it('Training recibe el último pesaje explícitamente', () => {
    expect(TRAINER_SRC).toMatch(/peso: latestBodyWeightKg\(weightLog, obData\?\.peso\)/);
  });
});

describe('UNA SOLA RUTA · sin camino accidental weight_log → kcal', () => {
  const body = (src: string, name: string) => { const i = src.indexOf(`  ${name}: async`); return src.slice(i, src.indexOf('\n  },', i)); };
  const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  it('addWeight/removeWeight no tocan peso nutricional, energía ni plan', () => {
    for (const fn of ['addWeight', 'removeWeight']) {
      const b = code(body(STORE_SRC, fn));
      expect(b.length, fn).toBeGreaterThan(50);
      for (const banned of ['setObData', 'recalcFromObData', 'nextNutritionWeight', 'obData', 'planGoal', 'user_profiles', 'clearWeeklyPlan']) {
        expect(b.includes(banned), `${fn} · ${banned}`).toBe(false);
      }
    }
  });
  it('ningún módulo productivo importa la derivación de peso nutricional de la mediana', () => {
    const files = import.meta.glob('../../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const users = Object.entries(files).filter(([p, src]) => !p.includes('__tests__') && !/\.(test|spec)\.tsx?$/.test(p)
      && /nextNutritionWeight|deriveStableNutritionWeight/.test(code(src))).map(([p]) => p);
    expect(users).toEqual([]);
    // BLOQUE 9 · el módulo de la mediana (`weightTrend.ts`) se retiró: no puede volver a importarse.
    expect(Object.keys(files).some((p) => p.endsWith('/utils/weightTrend.ts'))).toBe(false);
  });
  it('«Mis datos» es corrección explícita: fija peso → recalcula → luego guarda el pesaje como historial', () => {
    const c = code(EDIT_SRC);
    const setPeso = c.indexOf("setObData('peso', pesoN);");
    const recalc = c.indexOf("await recalcFromObData('edit-data');");
    const hist = c.indexOf('await addWeight(pesoN);');
    expect(setPeso).toBeGreaterThan(0);
    expect(recalc).toBeGreaterThan(setPeso);
    expect(hist).toBeGreaterThan(recalc);
  });
});
