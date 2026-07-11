import { describe, it, expect } from 'vitest';
import { recentExerciseIds, orderCandidatesForVariety } from './workoutPlanner';
import type { Exercise, CompletedSession } from '../types';

const sess = (iso: string, ids: string[]): CompletedSession =>
  ({ date: iso.slice(0, 10), completedAtIso: iso, exerciseIds: ids } as unknown as CompletedSession);

describe('variedad de ejercicios (rotación de accesorios)', () => {
  it('recentExerciseIds: ids de las últimas N sesiones', () => {
    const s = [
      sess('2026-07-01T10:00:00Z', ['a', 'b']),
      sess('2026-07-05T10:00:00Z', ['c']),
      sess('2026-07-08T10:00:00Z', ['d', 'e']),
    ];
    const ids = recentExerciseIds(s, 2); // las 2 más recientes: 07-08 y 07-05
    expect([...ids].sort()).toEqual(['c', 'd', 'e']);
    expect(ids.has('a')).toBe(false);
  });

  it('manda al final los AISLAMIENTOS repetidos; compuestos y frescos se quedan', () => {
    const EX = [
      { id: 'press', type: 'compuesto' },     // compuesto reciente → NO se mueve (progresión)
      { id: 'curl', type: 'aislamiento' },    // aislamiento reciente → al final
      { id: 'fly', type: 'aislamiento' },     // aislamiento fresco → se queda
    ] as unknown as Exercise[];
    const order = orderCandidatesForVariety(EX, new Set(['press', 'curl'])).map((e) => e.id);
    expect(order).toEqual(['press', 'fly', 'curl']);
  });
});
