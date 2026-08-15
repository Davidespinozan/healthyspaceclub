import { describe, it, expect } from 'vitest';
import { buildOnCompletePayload, type WorkoutExercise } from '../workoutSession';

// ────────────────────────────────────────────────────────────────────────────
// REGRESIÓN — BUG: al cambiar (swap) un ejercicio en el player, el historial se
// guardaba bajo el exerciseId ORIGINAL del plan, no bajo el ejecutado.
// Fix: el payload de onComplete lleva `exercises` = los REALMENTE ejecutados
// (swaps aplicados por el player), y el consumidor (WorkoutPlan) lo usa como
// autoridad para history/progresión. Aquí probamos que el payload propaga el id ejecutado.
// ────────────────────────────────────────────────────────────────────────────
const ex = (id: string, sets = 3): WorkoutExercise => ({ id, sets, reps: '8-10', rest: 90 });
const set = (reps: number, kg: number) => ({ reps, kg });

describe('Swap → history: el payload lleva el ejercicio EJECUTADO, no el del plan', () => {
  it('main swap: press-horizontal → press-inclinado ⇒ payload.exercises[0] = press-inclinado', () => {
    // el player pasa la lista YA con el swap aplicado (exercises = swaps[i] ?? plan[i])
    const executed = [ex('press-inclinado'), ex('curl-pie')];
    const logged = [set(10, 60), set(10, 60), set(10, 60), set(12, 15), set(12, 15), set(12, 15)];
    const payload = buildOnCompletePayload(logged, 1000, 1000 + 30 * 60_000, executed);
    expect(payload.exercises[0].id).toBe('press-inclinado');
    expect(payload.exercises.map(e => e.id)).toEqual(['press-inclinado', 'curl-pie']);
    // el original NO aparece → no se actualizará su historial
    expect(payload.exercises.some(e => e.id === 'press-horizontal')).toBe(false);
  });

  it('isolation swap: curl-pie → curl-martillo ⇒ payload.exercises refleja curl-martillo', () => {
    const executed = [ex('press-horizontal'), ex('curl-martillo')];
    const logged = [set(10, 60), set(10, 60), set(10, 60), set(12, 15), set(12, 15), set(12, 15)];
    const payload = buildOnCompletePayload(logged, 1000, 1000 + 20 * 60_000, executed);
    expect(payload.exercises[1].id).toBe('curl-martillo');
    expect(payload.exercises.some(e => e.id === 'curl-pie')).toBe(false);
  });

  it('sin swap: el payload lleva los ejercicios del plan tal cual (no rompe el caso normal)', () => {
    const executed = [ex('press-horizontal'), ex('curl-pie')];
    const payload = buildOnCompletePayload([set(10, 60)], 1000, 2000, executed);
    expect(payload.exercises.map(e => e.id)).toEqual(['press-horizontal', 'curl-pie']);
  });

  it('duración se calcula por timestamps reales (no por lo prescrito)', () => {
    const p = buildOnCompletePayload([set(10, 60)], 1000, 1000 + 18 * 60_000, [ex('press-horizontal')]);
    expect(p.durationSeconds).toBe(18 * 60); // 18 min reales
  });
});
