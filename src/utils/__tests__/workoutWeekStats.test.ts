import { describe, it, expect } from 'vitest';
import { countWorkoutDaysSince, summarizeWeekWorkouts } from '../workoutWeekStats';

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

describe('summarizeWeekWorkouts', () => {
  it('lista vacía → 0 / 0', () => {
    expect(summarizeWeekWorkouts([], '2026-05-20'))
      .toEqual({ count: 0, totalMinutes: 0 });
  });

  it('3 sesiones todas dentro → count 3 + suma de minutos', () => {
    const r = summarizeWeekWorkouts(
      [
        { date: '2026-05-21', durationSeconds: 2700 }, // 45 min
        { date: '2026-05-23', durationSeconds: 1800 }, // 30 min
        { date: '2026-05-25', durationSeconds: 3600 }, // 60 min
      ],
      '2026-05-20',
    );
    expect(r).toEqual({ count: 3, totalMinutes: 135 });
  });

  it('2 sesiones el mismo día → cuenta SESIONES (no días únicos)', () => {
    const r = summarizeWeekWorkouts(
      [
        { date: '2026-05-21', durationSeconds: 2700 },
        { date: '2026-05-21', durationSeconds: 1200 }, // segunda sesión mismo día
      ],
      '2026-05-20',
    );
    expect(r).toEqual({ count: 2, totalMinutes: 65 });
  });

  it('sesiones fuera de la ventana → no cuentan ni suman', () => {
    const r = summarizeWeekWorkouts(
      [
        { date: '2026-05-10', durationSeconds: 9999 }, // fuera
        { date: '2026-05-21', durationSeconds: 1800 }, // dentro
      ],
      '2026-05-20',
    );
    expect(r).toEqual({ count: 1, totalMinutes: 30 });
  });

  it('sesión en el borde (date === fromDateInclusive) → cuenta', () => {
    const r = summarizeWeekWorkouts(
      [{ date: '2026-05-20', durationSeconds: 1800 }],
      '2026-05-20',
    );
    expect(r).toEqual({ count: 1, totalMinutes: 30 });
  });

  it('durationSeconds no-finito (NaN, undefined) → cuenta sesión pero suma 0', () => {
    const r = summarizeWeekWorkouts(
      [
        { date: '2026-05-21', durationSeconds: NaN as number },
        { date: '2026-05-22', durationSeconds: 1800 },
      ],
      '2026-05-20',
    );
    expect(r).toEqual({ count: 2, totalMinutes: 30 });
  });

  it('redondeo a entero (segundos no múltiplos de 60)', () => {
    const r = summarizeWeekWorkouts(
      [{ date: '2026-05-21', durationSeconds: 2730 }], // 45.5 min → 46
      '2026-05-20',
    );
    expect(r).toEqual({ count: 1, totalMinutes: 46 });
  });
});
