import { describe, it, expect } from 'vitest';
import { deloadCheck } from './workoutPlanner';
import { dayKey } from './localDate';
import type { CompletedSession } from '../types';

const at = (daysAgo: number): CompletedSession =>
  ({ date: dayKey(new Date(Date.now() - daysAgo * 86400000)), exerciseIds: ['x'] } as unknown as CompletedSession);

// 3 sesiones dentro de la ventana de la semana w (días w*7-6 .. w*7).
const hardWeek = (w: number) => [at(w * 7 - 5), at(w * 7 - 3), at(w * 7 - 1)];

describe('deload — periodización', () => {
  it('sin historial → no deload', () => {
    expect(deloadCheck([], [])).toEqual({ deload: false, weeksAccumulated: 0 });
  });

  it('4 semanas duras seguidas → toca descarga', () => {
    const s = [...hardWeek(1), ...hardWeek(2), ...hardWeek(3), ...hardWeek(4)];
    const r = deloadCheck(s, []);
    expect(r.weeksAccumulated).toBe(4);
    expect(r.deload).toBe(true);
  });

  it('una semana ligera de por medio reinicia el contador (sin deload)', () => {
    // semanas 1 y 2 duras, semana 3 ligera (1 sesión) → corta en 2
    const s = [...hardWeek(1), ...hardWeek(2), at(3 * 7 - 3)];
    const r = deloadCheck(s, []);
    expect(r.weeksAccumulated).toBe(2);
    expect(r.deload).toBe(false);
  });
});
