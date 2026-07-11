import { describe, it, expect } from 'vitest';
import { computeProgression, parseRepRange, incrementForMuscle } from './progression';

describe('progression — doble progresión', () => {
  it('parsea rangos de reps', () => {
    expect(parseRepRange('8-10')).toEqual([8, 10]);
    expect(parseRepRange('12')).toEqual([12, 12]);
    expect(parseRepRange('8 a 12')).toEqual([8, 12]);
  });

  it('primera vez → sin peso, encuentra tu carga', () => {
    const t = computeProgression(undefined, '8-10', 2.5);
    expect(t.action).toBe('first-time');
    expect(t.kg).toBeNull();
  });

  it('llegó al tope de reps → sube el peso, reinicia reps', () => {
    const t = computeProgression([{ reps: 10, kg: 40 }, { reps: 10, kg: 40 }], '8-10', 2.5);
    expect(t.action).toBe('add-weight');
    expect(t.kg).toBe(42.5);
    expect(t.reps).toBe('8-10');
  });

  it('NO llegó al tope → mismo peso, busca más reps', () => {
    const t = computeProgression([{ reps: 8, kg: 40 }], '8-10', 2.5);
    expect(t.action).toBe('add-reps');
    expect(t.kg).toBe(40);
    expect(t.reps).toBe('9-10');
  });

  it('serie más dura manda (mín reps al peso tope)', () => {
    // 3 series a 50kg: 10,10,8 → la dura es 8 < 10 → aún no sube peso
    const t = computeProgression([{ reps: 10, kg: 50 }, { reps: 10, kg: 50 }, { reps: 8, kg: 50 }], '8-10', 5);
    expect(t.action).toBe('add-reps');
    expect(t.kg).toBe(50);
  });

  it('peso corporal → progresa en reps', () => {
    const t = computeProgression([{ reps: 12, kg: 0 }], '8-12', 2.5);
    expect(t.action).toBe('add-reps');
    expect(t.kg).toBe(0);
    expect(t.reps).toBe('14');
  });

  it('incremento: tren inferior/compuesto grande sube 5, resto 2.5', () => {
    expect(incrementForMuscle('cuadriceps')).toBe(5);
    expect(incrementForMuscle('espalda')).toBe(5);
    expect(incrementForMuscle('biceps')).toBe(2.5);
    expect(incrementForMuscle(undefined)).toBe(2.5);
  });
});
