import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({ supabase: { auth: {}, from: () => ({}) } }));

import { renderReflectionBehaviorFacts } from '../reflectionContext';
import { buildCoachContext } from '../coachContext';
import { buildHSMDailyReviewPrompt } from '../../ai/prompts/hsmReview';
import { dayKey } from '../localDate';
import { useAppStore } from '../../store';

const ST = () => useAppStore.getState();
const facts = () => renderReflectionBehaviorFacts(ST());
const today = dayKey(new Date());
const daysAgo = (n: number) => dayKey(new Date(Date.now() - n * 86400000));

const OB = { sex: 'Hombre', peso: 80, estatura: 180, edad: 30, activity: 'Alta', goal: 'Bajar grasa', trainingGoal: 'hipertrofia' };
const DINNER = { time: 'Cena', name: 'Salmón con arroz', desc: 's', portions: ['150g'], macros: { kcal: 600, prot: 40, carb: 50, fat: 20 } };

function seed(over: Record<string, unknown> = {}) {
  useAppStore.setState({
    userName: 'Dae', obData: OB as never, startDate: daysAgo(10), streakCount: 9,
    shoppingDay: new Date().getDay(),
    weeklyPlan: { days: [{ day: 1, meals: [DINNER] }], selectedDays: [1,2,3,4,5,6,7], mealPlanKey: 'planA', shoppingList: [], preferences: '' } as never,
    mealChecks: {}, mealResolvedByLog: {}, foodLog: [], workoutLog: [],
    completedSessions: [{ sessionId: 's1', date: today, modality: 'fuerza', exerciseIds: ['press-horizontal'], exercises: [{ id: 'press-horizontal', sets: [{ reps: 8, kg: 80 }] }] }] as never,
    dailyWorkout: { date: today, generatedAt: new Date().toISOString(), plan: { type: 'fuerza', exercises: [{ id: 'press-horizontal', sets: 4, reps: '8', topKg: 80, rir: 2 }], partnerMode: false } } as never,
    dailyHSMResponses: [], hsmProfile: { text: 'perfil secreto', updatedAt: today } as never,
    ...over,
  });
}

beforeEach(() => seed());

// ── §15 · CONTEXT proofs ─────────────────────────────────────────────────────
describe('§15 · behavioral facts', () => {
  it('A · sesiones de esta semana entran al bloque de hechos', () => {
    expect(facts()).toMatch(/1 sesi(ó|o)n\(es\) completada/i);
  });
  it('B · racha y días en programa entran', () => {
    const f = facts();
    expect(f).toMatch(/día 10 en Healthy Space/i);
    expect(f).toMatch(/racha 9 día/i);
  });
  it('C · nutrición usa el resultado EXACTO de CoachContext (no recalcula)', () => {
    seed({ foodLog: [{ date: today, desc: 'pollo', kcal: 300, prot: 30, carbs: 10, fat: 8 }] as never });
    const ctx = buildCoachContext(ST());
    const f = facts();
    // los valores del bloque === CoachContext.remaining (autoridad), sin target-consumed local
    expect(f).toContain(String(ctx.nutrition.remaining.prot));
    expect(f).toContain(String(ctx.nutrition.remaining.kcal));
    expect(f).toContain(String(ctx.nutrition.consumed.kcal));
  });
  it('D · sin entreno hoy → NO se llama "día de descanso"', () => {
    seed({ dailyWorkout: { date: daysAgo(3), generatedAt: '', plan: { exercises: [] } } as never });
    const f = facts();
    expect(f).toMatch(/no hay entreno generado hoy/i);
    expect(f).not.toMatch(/día de descanso(?!\))/i); // no lo afirma como descanso
  });
  it('E · datos insuficientes de 4 semanas → no fabrica tendencia', () => {
    // una sola semana con datos → trend n/a
    const f = facts();
    expect(f).toMatch(/sin datos suficientes para una tendencia/i);
    expect(f).not.toMatch(/tendencia de volumen \(4 sem\): (al alza|a la baja|estable)/i);
  });
  it('F · sin identidad de pareja en el bloque', () => {
    seed({ dailyWorkout: { date: today, generatedAt: '', plan: { exercises: [{ id: 'press-horizontal', sets: 4, reps: '8' }], partnerMode: true, partnerName: 'Ana Pérez', partnerId: 'uuid-p' } } as never });
    const f = facts();
    expect(f).not.toContain('Ana Pérez');
    expect(f).not.toContain('uuid-p');
  });
  it('G · sin id/email/stripe/perfil psicológico en el bloque', () => {
    seed({ user: { id: 'uuid-user', email: 'x@y.com' } as never });
    const f = facts();
    expect(f).not.toMatch(/@/);
    expect(f).not.toContain('uuid-user');
    expect(f).not.toMatch(/stripe|access_token|refresh_token/i);
    expect(f).not.toContain('perfil secreto'); // mindset NO entra por el bloque conductual
  });
});

// ── §16 · PROMPT assembly + regression ───────────────────────────────────────
describe('§16 · daily-review prompt', () => {
  const todaySummary = 'Disciplina: "no estoy avanzando"';
  const past = '[2026-08-20] Metas: "quiero constancia"';

  it('con hscFacts → bloque de HECHOS + reglas de autoridad presentes', () => {
    const p = buildHSMDailyReviewPrompt(todaySummary, 'es', past, facts());
    expect(p).toMatch(/HECHOS ACTUALES DE HSC/);
    expect(p).toMatch(/AUTORITATIVO/);
    expect(p).toMatch(/úsalos SOLO cuando de verdad iluminen/i);      // relevancia
    expect(p).toMatch(/muestra el contraste sin juzgar/i);           // contraste sin shaming
    expect(p).toMatch(/HIPÓTESIS, no hecho/i);                        // interp ≠ fact
    expect(p).toMatch(/Ausencia de dato no es evidencia/i);          // absent-data
    expect(p).toMatch(/espejo, no un coach/i);                       // non-directive
  });
  it('SIN hscFacts → prompt idéntico al comportamiento previo (sin bloque de hechos)', () => {
    const p = buildHSMDailyReviewPrompt(todaySummary, 'es', past);
    expect(p).not.toMatch(/HECHOS ACTUALES DE HSC/);
  });
  it('preserva las cualidades existentes de hsmReview', () => {
    const p = buildHSMDailyReviewPrompt(todaySummary, 'es', past, facts());
    expect(p).toMatch(/taza motivacional/i);        // anti-cliché
    expect(p).toMatch(/LEER DEBAJO/i);              // reads beneath surface
    expect(p).toMatch(/CRUZAR CON SU HISTORIA/i);   // contradiction/pattern
    expect(p).toMatch(/nunca una instrucción ni un "deberías"/i); // non-directive
  });
  it('CASE 1 · reflexión y hecho conductual coexisten en el prompt', () => {
    const p = buildHSMDailyReviewPrompt(todaySummary, 'es', undefined, facts());
    expect(p).toMatch(/no estoy avanzando/);                       // user reflection
    expect(p).toMatch(/1 sesi(ó|o)n\(es\) completada/i);          // HSC fact
  });
});

// ── §17 · account isolation (contexto = snapshot local actual) ────────────────
describe('§17 · isolation', () => {
  it('A → resetUserScopedData → B: el bloque de hechos no arrastra datos de A', () => {
    seed({ userName: 'A', foodLog: [{ date: today, desc: 'comida-de-A', kcal: 999, prot: 1, carbs: 1, fat: 1 }] as never });
    ST().resetUserScopedData();
    useAppStore.setState({ userName: 'B', obData: OB as never });
    const f = facts();
    expect(f).not.toContain('comida-de-A');
    expect(f).not.toContain('999');
  });
});
