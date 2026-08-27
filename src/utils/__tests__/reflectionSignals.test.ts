import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({ supabase: { auth: {}, from: () => ({}) } }));

import { buildReflectionSignals, renderReflectionSignals, type ReflectionRecord } from '../reflectionSignals';
import { buildCoachContext } from '../coachContext';
import { dayKey } from '../localDate';
import { useAppStore } from '../../store';
import type { CoachContext } from '../coachContext';

const TODAY = '2026-08-27';
// YMD (UTC) N días antes de TODAY — espejo del helper interno, para fixtures.
function ago(n: number): string {
  const [y, m, d] = TODAY.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() - n);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}
// CoachContext mínimo (buildReflectionSignals solo lee 4 campos).
const ctx = (over: Partial<{ daysInProgram: number | null; streak: number; sessions: number; trend: CoachContext['training']['trend4wk'] }> = {}): CoachContext => ({
  user: { name: 'x', daysInProgram: over.daysInProgram ?? 40, streak: over.streak ?? 3, today: TODAY } as never,
  training: { todayWorkout: null, why: null, thisWeek: { sessions: over.sessions ?? 1, volumeTop: [] }, trend4wk: over.trend ?? 'n/a', partnerToday: false },
  nutrition: { hasPlan: false, target: { kcal: 0, prot: 0, carb: 0, fat: 0 }, consumed: { kcal: 0, prot: 0, carb: 0, fat: 0 }, remaining: { kcal: 0, prot: 0, carb: 0, fat: 0 }, mealsDone: 0, mealsLeft: 0, todayMeals: [] },
  mindset: { todayReflections: [] },
});
const R = (date: string, dimensionId: string, extra: Partial<ReflectionRecord> = {}): ReflectionRecord => ({ date, dimensionId: dimensionId as never, dimension: dimensionId, response: 'x', safetyLevel: 'NORMAL', ...extra });
const sig = (reflections: ReflectionRecord[], c = ctx()) => buildReflectionSignals({ reflections, coachContext: c, today: TODAY });

// ── §15 A · counts ────────────────────────────────────────────────────────────
describe('§15 signals', () => {
  it('A · 30d/90d/total counts correctos', () => {
    const s = sig([R(ago(5), 'discipline'), R(ago(10), 'discipline'), R(ago(40), 'purpose'), R(ago(100), 'goals')]);
    expect(s.activity.total).toBe(4);
    expect(s.activity.last30).toBe(2);   // ago5, ago10
    expect(s.activity.last90).toBe(3);   // + ago40
  });
  it('B · frecuencia por dimensión y ranking exacto', () => {
    const s = sig([R(ago(1), 'discipline'), R(ago(2), 'discipline'), R(ago(3), 'discipline'), R(ago(4), 'discipline'), R(ago(5), 'purpose'), R(ago(6), 'purpose'), R(ago(7), 'environment')]);
    expect(s.recentDominant.map(d => `${d.id}:${d.count}`)).toEqual(['discipline:4', 'purpose:2', 'environment:1']);
  });
  it('C · recency (lastSeen) correcto', () => {
    const s = sig([R(ago(20), 'discipline'), R(ago(2), 'discipline')]);
    const disc = s.dimensions.find(d => d.id === 'discipline')!;
    expect(disc.lastSeen).toBe(ago(2));
    expect(disc.firstSeen).toBe(ago(20));
  });
  it('D · novedad solo cuando hay periodo previo real', () => {
    // 'purpose' aparece solo en 30d; existe historia previa (discipline ago100) → novedad
    const s = sig([R(ago(100), 'discipline'), R(ago(90), 'discipline'), R(ago(3), 'purpose')]);
    expect(s.hasPriorPeriod).toBe(true);
    expect(s.novelty).toContain('purpose');
    expect(s.novelty).not.toContain('discipline');
  });
  it('D2 · sin periodo previo → NO se declara novedad (evita "todo es nuevo")', () => {
    const s = sig([R(ago(3), 'purpose'), R(ago(5), 'discipline')]);
    expect(s.hasPriorPeriod).toBe(false);
    expect(s.novelty).toEqual([]);
  });
  it('E · inactividad larga → sin "patrón activo" reciente fabricado', () => {
    const s = sig([R(ago(200), 'discipline'), R(ago(210), 'purpose')]);
    expect(s.activity.last30).toBe(0);
    expect(s.recentDominant).toEqual([]);
    expect(renderReflectionSignals(s)).toMatch(/sin reflexiones en los últimos 30 días/i);
  });
  it('F · metadata legacy/desconocida no crashea ni inventa dimensión', () => {
    const s = sig([R(ago(2), 'not-a-real-dim'), { date: ago(3), dimension: 'Disciplina', response: 'x', safetyLevel: 'NORMAL' }]);
    // 'not-a-real-dim' → unknown → ignorado; 'Disciplina' (título legacy) → discipline
    expect(s.dimensions.map(d => d.id)).toEqual(['discipline']);
    expect(s.activity.total).toBe(2); // ambas cuentan como actividad; solo la dim conocida entra a dimensiones
  });
  it('vacío → render vacío', () => {
    expect(renderReflectionSignals(sig([]))).toBe('');
  });
});

// ── §16 · URGENT sentinel ─────────────────────────────────────────────────────
describe('§16 URGENT exclusion', () => {
  const SENT = 'URGENT_SENTINEL_PATTERN_DO_NOT_USE_4827';
  it('URGENT no cuenta en total/dimensión/novelty/render/prompt', () => {
    const s = sig([
      R(ago(2), 'discipline'),
      R(ago(1), 'emotional_control', { response: SENT, safetyLevel: 'URGENT' }),
    ]);
    expect(s.activity.total).toBe(1);                       // URGENT no suma
    expect(s.dimensions.map(d => d.id)).toEqual(['discipline']); // emotional_control (URGENT) ausente
    expect(s.recentDominant.some(d => d.id === 'emotional_control')).toBe(false);
    const rendered = renderReflectionSignals(s);
    expect(rendered).not.toContain(SENT);
    expect(rendered).not.toMatch(/Control Emocional/);
  });
  it('CONCERNING sí es elegible (semántica vigente)', () => {
    const s = sig([R(ago(1), 'resilience', { safetyLevel: 'CONCERNING' })]);
    expect(s.activity.total).toBe(1);
    expect(s.dimensions.map(d => d.id)).toEqual(['resilience']);
  });
});

// ── §19 · HSC authority (== CoachContext) ─────────────────────────────────────
describe('§19 behavior authority', () => {
  it('signals.behavior == buildCoachContext (no recomputa)', () => {
    const today = dayKey(new Date());
    const OB = { sex: 'Hombre', peso: 80, estatura: 180, edad: 30, activity: 'Alta', goal: 'Bajar grasa', trainingGoal: 'hipertrofia' };
    useAppStore.setState({
      userName: 'D', obData: OB as never, startDate: '2026-08-01', streakCount: 7, shoppingDay: new Date().getDay(),
      weeklyPlan: { days: [], selectedDays: [1], mealPlanKey: 'planA', shoppingList: [], preferences: '' } as never,
      mealChecks: {}, mealResolvedByLog: {}, foodLog: [], workoutLog: [],
      completedSessions: [{ sessionId: 's', date: today, modality: 'fuerza', exerciseIds: ['press-horizontal'], exercises: [{ id: 'press-horizontal', sets: [{ reps: 8, kg: 80 }] }] }] as never,
      dailyWorkout: { date: today, generatedAt: '', plan: { exercises: [] } } as never, dailyHSMResponses: [], hsmProfile: null as never,
    });
    const cc = buildCoachContext(useAppStore.getState());
    const s = buildReflectionSignals({ reflections: [], coachContext: cc, today });
    expect(s.behavior.thisWeekSessions).toBe(cc.training.thisWeek.sessions);
    expect(s.behavior.streak).toBe(cc.user.streak);
    expect(s.behavior.daysInProgram).toBe(cc.user.daysInProgram);
    expect(s.behavior.trend4wk).toBe(cc.training.trend4wk);
  });
});

// ── §8 · render tiene observaciones, no adjetivos psicológicos ────────────────
describe('render discipline', () => {
  it('no contiene adjetivos psicológicos', () => {
    const r = renderReflectionSignals(sig([R(ago(2), 'discipline'), R(ago(3), 'discipline')]));
    expect(r).not.toMatch(/evitativo|ansioso|dependiente|perezoso|narcisista|autodestructivo/i);
    expect(r).toMatch(/Disciplina 2/);
  });
});
