import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({ supabase: { auth: {}, from: () => ({}) } }));

import { buildCoachContext, renderHscFacts } from '../coachContext';
import { buildCoachSystemPrompt } from '../../ai/prompts/coach';
import { computeNutritionTargets, parseObData } from '../nutritionTargets';
import { dayKey } from '../localDate';
import { useAppStore } from '../../store';

const ST = () => useAppStore.getState();
const ctx = () => buildCoachContext(ST());
const today = dayKey(new Date());
const daysAgo = (n: number) => dayKey(new Date(Date.now() - n * 86400000));

const OB = { sex: 'Hombre', peso: 80, estatura: 180, edad: 30, activity: 'Alta', goal: 'Bajar grasa', trainingGoal: 'hipertrofia' };
const TRACE = {
  week: 5, phase: 'acumulacion', progression: 'lineal', deload: true, recovery: 'media',
  readinessState: 'ok', readinessFactors: ['sueño bajo'], priorityMuscles: ['pecho'],
  loads: [{ id: 'press-horizontal', muscle: 'pecho', sets: 4, reps: '6', rir: 2, topKg: 80 }],
  replaced: [], notes: [],
};
const DINNER = { time: 'Cena', name: 'Salmón con arroz', desc: 'salmón + arroz', portions: ['150g'], macros: { kcal: 600, prot: 40, carb: 50, fat: 20 } };

function seed(over: Record<string, unknown> = {}) {
  useAppStore.setState({
    userName: 'Dae', obData: OB as never, startDate: daysAgo(10), streakCount: 9,
    shoppingDay: new Date().getDay(), // todayOffset = 0 → selectedDays[0]
    weeklyPlan: { days: [{ day: 1, meals: [DINNER] }, { day: 2, meals: [{ ...DINNER, name: 'Pollo (mañana)' }] }], selectedDays: [1, 2, 3, 4, 5, 6, 7], mealPlanKey: 'planA', shoppingList: [], preferences: '' } as never,
    mealChecks: {}, mealResolvedByLog: {}, foodLog: [],
    completedSessions: [{ sessionId: 's1', date: today, modality: 'fuerza', exerciseIds: ['press-horizontal'], exercises: [{ id: 'press-horizontal', sets: [{ reps: 6, kg: 80 }, { reps: 6, kg: 80 }] }] }] as never,
    workoutLog: [],
    dailyWorkout: { date: today, generatedAt: new Date().toISOString(), plan: { type: 'fuerza', exercises: [{ id: 'press-horizontal', sets: 4, reps: '6', topKg: 80, rir: 2 }], partnerMode: false, coachTrace: TRACE } } as never,
    dailyHSMResponses: [
      { date: today, dimension: 'Disciplina', question: 'q', response: 'hoy sí entrené', dimensionId: 'discipline', questionIndex: 0, questionKey: 'd#0', safetyLevel: 'NORMAL' },
    ] as never,
    hsmProfile: { text: 'Tiende a autoexigirse de más.', updatedAt: today } as never,
    ...over,
  });
}

beforeEach(() => seed());

// ── §20A · NUTRITION AUTHORITY (no re-cálculo, no déficit hard-coded) ─────────
describe('nutrition authority', () => {
  it('A · target macros === computeNutritionTargets; remaining === computeCoach (sin hard-code)', () => {
    const c = ctx().nutrition;
    const tgt = computeNutritionTargets(parseObData(OB as never));
    expect(c.target).toEqual({ kcal: tgt.planGoal, prot: tgt.protG, carb: tgt.carbG, fat: tgt.fatG });
    // sin comida registrada → resta = meta completa (target − 0)
    expect(c.remaining.kcal).toBe(tgt.planGoal);
    expect(c.remaining.prot).toBe(tgt.protG);
  });
  it('A2 · con comida registrada, remaining = target − consumed (exacto)', () => {
    seed({ foodLog: [{ date: today, desc: 'pollo', kcal: 300, prot: 30, carbs: 10, fat: 8 }] as never });
    const c = ctx().nutrition;
    const tgt = computeNutritionTargets(parseObData(OB as never));
    expect(c.consumed.kcal).toBe(300);
    expect(c.remaining.prot).toBe(Math.max(0, tgt.protG - 30));
  });
});

// ── §20B · today's meals ─────────────────────────────────────────────────────
describe('today meals', () => {
  it('B · la cena de HOY aparece; la comida de MAÑANA no aparece como de hoy; sin alternativas inventadas', () => {
    const meals = ctx().nutrition.todayMeals;
    expect(meals.map(m => m.name)).toContain('Salmón con arroz');
    expect(meals.map(m => m.name)).not.toContain('Pollo (mañana)');
    const facts = renderHscFacts(ctx());
    expect(facts).toMatch(/no tiene alternativas/i); // no finge sustituciones
  });
});

// ── §20C · today workout ─────────────────────────────────────────────────────
describe('today workout', () => {
  it('C · dailyWorkout de HOY → ejercicio/sets/reps/carga/rir presentes', () => {
    const w = ctx().training.todayWorkout!;
    expect(w).not.toBeNull();
    const ex = w.exercises[0];
    expect(ex.sets).toBe(4); expect(ex.reps).toBe('6'); expect(ex.load).toBe(80); expect(ex.rir).toBe(2);
  });
  it('C2 · dailyWorkout de OTRA fecha → NO se representa como el entreno de hoy', () => {
    seed({ dailyWorkout: { date: daysAgo(3), generatedAt: '', plan: { exercises: [{ id: 'x', sets: 3, reps: '8' }] } } as never });
    expect(ctx().training.todayWorkout).toBeNull();
  });
});

// ── §20D · coachTrace "why" ──────────────────────────────────────────────────
describe('coachTrace why', () => {
  it('D · deload/readiness/prioridad llegan al contexto', () => {
    const y = ctx().training.why!;
    expect(y.deload).toBe(true);
    expect(y.readinessState).toBe('ok');
    expect(y.priorityMuscles).toContain('pecho');
    expect(renderHscFacts(ctx())).toMatch(/DELOAD activo/i);
  });
  it('D2 · sin coachTrace en el plan → why null, no se inventa la razón', () => {
    seed({ dailyWorkout: { date: today, generatedAt: '', plan: { exercises: [{ id: 'press-horizontal', sets: 4, reps: '6' }] } } as never });
    expect(ctx().training.why).toBeNull();
    expect(renderHscFacts(ctx())).toMatch(/no hay traza de decisión/i);
  });
});

// ── §20E/F · weekly + days-in-program ────────────────────────────────────────
describe('temporal', () => {
  it('E · thisWeek session count correcto', () => {
    expect(ctx().training.thisWeek.sessions).toBe(1);
  });
  it('F · daysInProgram derivado de startDate (10 días)', () => {
    expect(ctx().user.daysInProgram).toBe(10);
  });
});

// ── §20G · freshness ─────────────────────────────────────────────────────────
describe('freshness', () => {
  it('G · cambiar foodLog cambia el contexto de nutrición en el siguiente build', () => {
    const before = ctx().nutrition.consumed.kcal;
    useAppStore.setState({ foodLog: [{ date: today, desc: 'x', kcal: 500, prot: 10, carbs: 10, fat: 10 }] as never });
    const after = ctx().nutrition.consumed.kcal;
    expect(before).toBe(0); expect(after).toBe(500);
  });
});

// ── §20H · account isolation ─────────────────────────────────────────────────
describe('account isolation', () => {
  it('H · A → resetUserScopedData → B: el contexto solo tiene datos de B', () => {
    seed({ userName: 'A-user', foodLog: [{ date: today, desc: 'comida-de-A', kcal: 999, prot: 1, carbs: 1, fat: 1 }] as never });
    ST().resetUserScopedData();                       // frontera de cuenta (M-1)
    useAppStore.setState({ userName: 'B-user', obData: OB as never });
    const c = ctx();
    expect(c.user.name).toBe('B-user');
    expect(JSON.stringify(c)).not.toContain('comida-de-A');
    expect(c.training.todayWorkout).toBeNull();       // dailyWorkout de A purgado
    expect(c.mindset.todayReflections).toHaveLength(0);
  });
});

// ── §20I · URGENT exclusion ──────────────────────────────────────────────────
describe('urgent exclusion', () => {
  it('I · reflexión NORMAL incluida; URGENT excluida del contexto', () => {
    seed({ dailyHSMResponses: [
      { date: today, dimension: 'Disciplina', question: 'q', response: 'reflexion normal', dimensionId: 'discipline', questionIndex: 0, questionKey: 'd#0', safetyLevel: 'NORMAL' },
      { date: today, dimension: 'Emocional', question: 'q', response: 'texto urgente secreto', dimensionId: 'emotional', questionIndex: 0, questionKey: 'e#0', safetyLevel: 'URGENT' },
    ] as never });
    const c = ctx();
    expect(c.mindset.todayReflections.map(r => r.response)).toContain('reflexion normal');
    expect(JSON.stringify(c)).not.toContain('texto urgente secreto');
  });
});

// ── §20K · data minimization ─────────────────────────────────────────────────
describe('data minimization', () => {
  it('K · el contexto serializado no contiene email/token/user id/stripe/identidad de pareja', () => {
    seed({
      dailyWorkout: { date: today, generatedAt: '', plan: { exercises: [{ id: 'press-horizontal', sets: 4, reps: '6' }], partnerMode: true, partnerName: 'Ana Pérez', partnerId: 'uuid-partner', ownerId: 'uuid-owner' } } as never,
    });
    const s = JSON.stringify(ctx());
    expect(s).not.toMatch(/@/);                 // sin email
    expect(s).not.toContain('Ana Pérez');       // sin nombre de pareja
    expect(s).not.toContain('uuid-partner');    // sin id de pareja
    expect(s).not.toContain('uuid-owner');
    expect(s).not.toMatch(/access_token|refresh_token|service_role|stripe/i);
    // pero SÍ el hecho no-identificante: entrena en pareja hoy
    expect(ctx().training.partnerToday).toBe(true);
  });
});

// ── §21 · ACCEPTANCE — si HSC sabe la respuesta, el modelo la recibe ──────────
describe('§21 target-question acceptance (el prompt contiene los hechos)', () => {
  it('el system prompt incluye los datos para responder las preguntas objetivo', () => {
    seed({ foodLog: [{ date: today, desc: 'pollo', kcal: 300, prot: 30, carbs: 10, fat: 8 }] as never });
    const p = buildCoachSystemPrompt(ST(), 'es', 'NORMAL');
    const tgt = computeNutritionTargets(parseObData(OB as never));
    expect(p).toMatch(/DATOS ACTUALES DE HSC/);            // bloque de hechos
    expect(p).toMatch(/ENTRENO DE HOY/);                   // Q1 qué entreno hoy
    expect(p).toContain('Press');                          // ejercicio real (nombre del banco)
    expect(p).toMatch(/POR QUÉ HSC prescribió/);           // Q2/Q3 por qué / deload
    expect(p).toMatch(/DELOAD activo/i);                   // Q3
    expect(p).toMatch(/RESTA HOY/);                        // Q4-7 calorías/macros restantes
    expect(p).toContain(String(tgt.protG - 30));           // proteína restante EXACTA
    expect(p).toMatch(/Salmón con arroz/);                 // Q9 cena
    expect(p).toMatch(/ESTA SEMANA: 1 sesion/);            // Q10 esta semana
    expect(p).toMatch(/tendencia de volumen/);             // Q11
    expect(p).toMatch(/Día 10 en Healthy Space/);          // Q12 cuánto llevo
    expect(p).toMatch(/PERFIL PSICOL/i);                   // Q13 patrón reflexiones
    expect(p).toMatch(/HECHOS vs SUGERENCIA/);             // §19 boundary
    expect(p).toMatch(/no eres psic/i);                    // COACH-SAFETY boundary intacta
  });
});
