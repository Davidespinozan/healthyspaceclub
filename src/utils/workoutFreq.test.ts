import { describe, it, expect } from 'vitest';
import { trainingFrequency, splitTypesForFrequency } from './workoutPlanner';
import { dayKey } from './localDate';
import type { CompletedSession } from '../types';

const sess = (date: string): CompletedSession => ({ date, exerciseIds: ['x'] } as unknown as CompletedSession);
const recent = (n: number) => Array.from({ length: n }, (_, i) => sess(dayKey(new Date(Date.now() - i * 86400000))));

describe('frecuencia de entreno → estructura de split', () => {
  it('sin historial → default 3 (full-body)', () => {
    expect(trainingFrequency([], [])).toBe(3);
  });

  it('entrena ~5 días/sem (10 días distintos en 14) → freq 5', () => {
    expect(trainingFrequency(recent(10), [])).toBe(5);
  });

  it('entrena poco (4 días distintos en 14) → freq baja', () => {
    expect(trainingFrequency(recent(4), [])).toBeLessThanOrEqual(3);
  });

  it('estructura por frecuencia (regla estándar)', () => {
    expect(splitTypesForFrequency(3)).toEqual(['full-body']);
    expect(splitTypesForFrequency(4)).toEqual(['upper', 'lower']);
    expect(splitTypesForFrequency(6)).toContain('push');
    expect(splitTypesForFrequency(6)).toContain('legs');
  });
});
