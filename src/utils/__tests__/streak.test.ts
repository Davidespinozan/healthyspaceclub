import { describe, it, expect } from 'vitest';
import { computeStreak } from '../streak';

describe('computeStreak', () => {
  it('primer día (lastActiveDate === null) → inicia racha en 1', () => {
    const r = computeStreak(0, null, '2026-05-25');
    expect(r).toEqual({ newStreak: 1, changed: true });
  });

  it('mismo día (lastActiveDate === today) → sin cambio (idempotente)', () => {
    const r = computeStreak(7, '2026-05-25', '2026-05-25');
    expect(r).toEqual({ newStreak: 7, changed: false });
  });

  it('día consecutivo (lastActiveDate === ayer) → +1', () => {
    const r = computeStreak(7, '2026-05-24', '2026-05-25');
    expect(r).toEqual({ newStreak: 8, changed: true });
  });

  it('gap > 1 día (lastActiveDate hace 3 días) → reset a 1', () => {
    const r = computeStreak(7, '2026-05-22', '2026-05-25');
    expect(r).toEqual({ newStreak: 1, changed: true });
  });

  it('fecha futura defensiva (lastActiveDate > today) → reset a 1', () => {
    const r = computeStreak(7, '2026-05-26', '2026-05-25');
    expect(r).toEqual({ newStreak: 1, changed: true });
  });

  it('cruce de mes funciona (ayer = último día del mes anterior)', () => {
    const r = computeStreak(5, '2026-04-30', '2026-05-01');
    expect(r).toEqual({ newStreak: 6, changed: true });
  });

  it('cruce de año funciona (ayer = 31-dic)', () => {
    const r = computeStreak(10, '2025-12-31', '2026-01-01');
    expect(r).toEqual({ newStreak: 11, changed: true });
  });
});
