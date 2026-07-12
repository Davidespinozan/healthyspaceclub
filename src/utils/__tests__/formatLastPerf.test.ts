import { describe, it, expect } from 'vitest';
import { formatLastPerf } from '../workoutOrchestration';

describe('formatLastPerf (feed de sobrecarga progresiva)', () => {
  it('peso libre: peso máx × reps de cada serie', () => {
    expect(formatLastPerf([{ reps: 10, kg: 22.5 }, { reps: 10, kg: 22.5 }, { reps: 8, kg: 22.5 }]))
      .toBe('22.5kg×10,10,8');
  });
  it('peso corporal / banda (kg=0): solo reps', () => {
    expect(formatLastPerf([{ reps: 12, kg: 0 }, { reps: 10, kg: 0 }])).toBe('×12,10');
  });
  it('sin registro → cadena vacía', () => {
    expect(formatLastPerf([])).toBe('');
    expect(formatLastPerf(undefined)).toBe('');
  });
  it('ignora series no realizadas (reps 0)', () => {
    expect(formatLastPerf([{ reps: 10, kg: 20 }, { reps: 0, kg: 0 }])).toBe('20kg×10');
  });
});
