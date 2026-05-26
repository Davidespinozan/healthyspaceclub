import { describe, it, expect } from 'vitest';
import { countWorkoutDaysSince } from '../workoutWeekStats';

describe('countWorkoutDaysSince', () => {
  it('lista vacía → 0', () => {
    expect(countWorkoutDaysSince([], '2026-05-20')).toBe(0);
  });

  it('todas las sesiones dentro de la ventana, días únicos → cuenta cada día', () => {
    const r = countWorkoutDaysSince(
      [
        { date: '2026-05-21' },
        { date: '2026-05-23' },
        { date: '2026-05-25' },
      ],
      '2026-05-20',
    );
    expect(r).toBe(3);
  });

  it('dos sesiones el mismo día → cuenta 1 (días únicos)', () => {
    const r = countWorkoutDaysSince(
      [
        { date: '2026-05-21' },
        { date: '2026-05-21' },
        { date: '2026-05-23' },
      ],
      '2026-05-20',
    );
    expect(r).toBe(2);
  });

  it('sesión justo en el borde (date === fromDateInclusive) → cuenta', () => {
    const r = countWorkoutDaysSince(
      [{ date: '2026-05-20' }],
      '2026-05-20',
    );
    expect(r).toBe(1);
  });

  it('sesiones anteriores a la ventana → no cuentan', () => {
    const r = countWorkoutDaysSince(
      [
        { date: '2026-05-10' },
        { date: '2026-05-15' },
        { date: '2026-05-25' },
      ],
      '2026-05-20',
    );
    expect(r).toBe(1);
  });

  it('mezcla dentro y fuera → cuenta solo los días únicos dentro', () => {
    const r = countWorkoutDaysSince(
      [
        { date: '2026-05-10' }, // fuera
        { date: '2026-05-21' }, // dentro
        { date: '2026-05-21' }, // dentro (mismo día → no duplica)
        { date: '2026-05-22' }, // dentro
        { date: '2026-05-19' }, // fuera (justo antes)
      ],
      '2026-05-20',
    );
    expect(r).toBe(2);
  });
});
