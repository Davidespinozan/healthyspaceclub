import { it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({ supabase: { auth: {}, from: () => ({}) } }));

import { buildCoachContext, renderHscFacts } from '../coachContext';
import { buildCoachSystemPrompt } from '../../ai/prompts/coach';
import { dayKey } from '../localDate';
import { useAppStore } from '../../store';

// ═══════════════════════════════════════════════════════════════════════════
// PROD-REGRESSION-1 · COACH-REFLECTION-FACT-P0 · reflectionCompletedToday.
// Metadata-only (fecha), verdadero en todos los caminos de completado, y el texto
// URGENT sigue EXCLUIDO del contexto/prompt del Coach.
// ═══════════════════════════════════════════════════════════════════════════

const today = dayKey(new Date());
const daysAgo = (n: number) => dayKey(new Date(Date.now() - n * 86400000));
const OB = { sex: 'Hombre', peso: 80, estatura: 180, edad: 30, activity: 'Alta', goal: 'Bajar grasa', trainingGoal: 'hipertrofia' };
const SENTINEL = 'URGENT_SENTINEL_DO_NOT_SERIALIZE';

function baseSeed(over: Record<string, unknown> = {}) {
  useAppStore.setState({
    userName: 'Dae', obData: OB as never, startDate: daysAgo(10), streakCount: 3,
    shoppingDay: new Date().getDay(),
    weeklyPlan: { days: [{ day: 1, meals: [] }], selectedDays: [1, 2, 3, 4, 5, 6, 7], mealPlanKey: 'planA', shoppingList: [], preferences: '' } as never,
    mealChecks: {}, mealResolvedByLog: {}, foodLog: [], completedSessions: [] as never, workoutLog: [],
    dailyWorkout: { date: daysAgo(2), generatedAt: '', plan: { exercises: [] } } as never,
    dailyHSMResponses: [] as never,
    hsmProfile: null as never,
    hsmDailyReview: null as never,
    ...over,
  });
}
const R = (over: Record<string, unknown> = {}) => ({ date: today, dimension: 'Disciplina', question: 'q', response: 'hoy reflexioné', dimensionId: 'discipline', questionIndex: 0, questionKey: 'd#0', safetyLevel: 'NORMAL', ...over });
const flag = () => buildCoachContext(useAppStore.getState()).mindset.reflectionCompletedToday;

beforeEach(() => baseSeed());

// ── 1 · sin reflexión hoy → false ────────────────────────────────────────────
it('1 · sin evidencia de hoy → reflectionCompletedToday === false', () => {
  baseSeed({ dailyHSMResponses: [] as never, hsmDailyReview: null as never });
  expect(flag()).toBe(false);
});

// ── 2/3/4 · NORMAL / CONCERNING / URGENT hoy → true ──────────────────────────
it('2 · reflexión NORMAL de hoy → true', () => {
  baseSeed({ dailyHSMResponses: [R({ safetyLevel: 'NORMAL' })] as never, hsmDailyReview: { date: today, text: 'ok', source: 'base' } as never });
  expect(flag()).toBe(true);
});
it('3 · reflexión CONCERNING de hoy → true (semántica de seguridad intacta)', () => {
  baseSeed({ dailyHSMResponses: [R({ safetyLevel: 'CONCERNING' })] as never, hsmDailyReview: { date: today, text: 'ok', source: 'base' } as never });
  expect(flag()).toBe(true);
});
it('4 · reflexión URGENT de hoy → true', () => {
  baseSeed({ dailyHSMResponses: [R({ safetyLevel: 'URGENT', response: SENTINEL })] as never, hsmDailyReview: { date: today, text: 'safe', source: 'safe' } as never });
  expect(flag()).toBe(true);
});

// ── 5 · MURO DURO: texto URGENT no aparece en NINGÚN lado de la IA ────────────
it('5 · URGENT_RAW_TEXT ⇒ NEVER_AI_CONTEXT (contexto, hechos y prompt)', () => {
  baseSeed({ dailyHSMResponses: [R({ safetyLevel: 'URGENT', response: SENTINEL })] as never, hsmDailyReview: { date: today, text: 'safe', source: 'safe' } as never });
  const ctx = buildCoachContext(useAppStore.getState());
  expect(ctx.mindset.reflectionCompletedToday).toBe(true);            // completado sí
  expect(JSON.stringify(ctx)).not.toContain(SENTINEL);                // contexto sin texto crudo
  const facts = renderHscFacts(ctx);
  expect(facts).not.toContain(SENTINEL);                              // hechos sin texto crudo
  expect(facts).toMatch(/REFLEXIÓN DE HOY: completada/);              // pero el hecho sí/no está
  const prompt = buildCoachSystemPrompt(useAppStore.getState());
  expect(prompt).not.toContain(SENTINEL);                             // prompt final sin texto crudo
});

// ── 6 · fallback: reseña de hoy sin respuestas locales → true ────────────────
it('6 · hsmDailyReview de hoy aunque responses esté vacío → true', () => {
  baseSeed({ dailyHSMResponses: [] as never, hsmDailyReview: { date: today, text: 'ok', source: 'base' } as never });
  expect(flag()).toBe(true);
});

// ── 7 · fallback free/AI-fail: respuesta de hoy sin reseña → true ────────────
it('7 · respuesta de hoy sin hsmDailyReview → true', () => {
  baseSeed({ dailyHSMResponses: [R()] as never, hsmDailyReview: null as never });
  expect(flag()).toBe(true);
});

// ── 8 · ayer no cuenta hoy ───────────────────────────────────────────────────
it('8 · reflexión/reseña de AYER → false hoy', () => {
  baseSeed({ dailyHSMResponses: [R({ date: daysAgo(1) })] as never, hsmDailyReview: { date: daysAgo(1), text: 'ok', source: 'base' } as never });
  expect(flag()).toBe(false);
});

// ── 9 · fecha local (dayKey), sin drift UTC ──────────────────────────────────
it('9 · usa dayKey local: respuesta con dayKey(hoy) → true; el hecho lo refleja', () => {
  baseSeed({ dailyHSMResponses: [R({ date: dayKey(new Date()) })] as never });
  const facts = renderHscFacts(buildCoachContext(useAppStore.getState()));
  expect(facts).toMatch(/REFLEXIÓN DE HOY: completada/);
});

// ── 10 · aislamiento de cuenta: store limpio → false ─────────────────────────
it('10 · store limpio (sin reflexión de la cuenta actual) → false', () => {
  baseSeed({ dailyHSMResponses: [] as never, hsmProfile: null as never, hsmDailyReview: null as never });
  const facts = renderHscFacts(buildCoachContext(useAppStore.getState()));
  expect(flag()).toBe(false);
  expect(facts).toMatch(/REFLEXIÓN DE HOY: no completada/);
});
