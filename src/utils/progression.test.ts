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

  it('peso corporal: al tope de reps → hazlo más difícil (no +reps infinito)', () => {
    const t = computeProgression([{ reps: 12, kg: 0 }], '8-12', 2.5);
    expect(t.action).toBe('add-difficulty');
    expect(t.kg).toBe(0);
    expect(t.reps).toBe('8-12');
  });

  it('peso corporal: sin llegar al tope → más reps', () => {
    const t = computeProgression([{ reps: 9, kg: 0 }], '8-12', 2.5);
    expect(t.action).toBe('add-reps');
  });

  it('bandas: al tope de reps → sube TENSIÓN (no peso)', () => {
    const t = computeProgression([{ reps: 12, kg: 0 }], '8-12', 2.5, true);
    expect(t.action).toBe('add-tension');
    expect(t.kg).toBeNull();
    expect(t.reps).toBe('8-12');
  });

  it('bandas: sin llegar al tope → misma liga, más reps', () => {
    const t = computeProgression([{ reps: 9, kg: 0 }], '8-12', 2.5, true);
    expect(t.action).toBe('add-reps');
    expect(t.kg).toBeNull();
  });

  it('bandas: primera vez → habla de liga, no de peso', () => {
    const t = computeProgression(undefined, '8-12', 2.5, true);
    expect(t.action).toBe('first-time');
    expect(t.note.toLowerCase()).toContain('liga');
  });

  it('incremento: tren inferior/compuesto grande sube 5, resto 2.5', () => {
    expect(incrementForMuscle('cuadriceps')).toBe(5);
    expect(incrementForMuscle('espalda')).toBe(5);
    expect(incrementForMuscle('biceps')).toBe(2.5);
    expect(incrementForMuscle(undefined)).toBe(2.5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRATO: PRESCRIPCIÓN ≠ DESEMPEÑO. La progresión solo usa reps CONFIRMADAS.
// Una serie marcada sin confirmar (repsUnconfirmed) mantiene la carga pero NO sube peso.
// ─────────────────────────────────────────────────────────────────────────────
describe('progression · actual performance only (repsUnconfirmed)', () => {
  const conf = (reps: number, kg: number) => ({ reps, kg });                       // confirmada
  const unconf = (reps: number, kg: number) => ({ reps, kg, repsUnconfirmed: true }); // solo prefill

  it('1. target 8-10 sin confirmar (reps=10 pero unconfirmed) ≠ actual 10 → NO add-weight', () => {
    const r = computeProgression([unconf(10, 40), unconf(10, 40)], '8-10', 2.5, false);
    expect(r.action).toBe('hold');
    expect(r.kg).toBe(40); // mantiene el peso real, no sube
  });

  it('2. set completado sin reps reales (todo unconfirmed) no dispara add-weight → hold', () => {
    const r = computeProgression([unconf(10, 60), unconf(10, 60), unconf(10, 60)], '8-10', 5, false);
    expect(r.action).toBe('hold');
    expect(r.kg).toBe(60);
  });

  it('3. actual 10/10 CONFIRMADO al tope → puede disparar add-weight', () => {
    const r = computeProgression([conf(10, 40), conf(10, 40)], '8-10', 2.5, false);
    expect(r.action).toBe('add-weight');
    expect(r.kg).toBe(42.5);
  });

  it('4. actual 8 CONFIRMADO (bajo el tope 10) → mantiene peso, busca reps (add-reps)', () => {
    const r = computeProgression([conf(8, 40), conf(8, 40)], '8-10', 2.5, false);
    expect(r.action).toBe('add-reps');
    expect(r.kg).toBe(40); // NO sube peso
  });

  it('5. actual por debajo del mínimo CONFIRMADO (6 en rango 8-10) → no sube peso', () => {
    const r = computeProgression([conf(6, 40)], '8-10', 2.5, false);
    expect(r.action).toBe('add-reps');
    expect(r.kg).toBe(40);
  });

  it('6. deload NO contamina: una serie ligera NO baja la referencia si hay un top confirmado', () => {
    // top real 40kg confirmado + una serie floja a 20kg → refKg=40 (max), progresa desde 40.
    const r = computeProgression([conf(10, 40), conf(12, 20)], '8-10', 2.5, false);
    expect(r.kg).toBe(42.5); // referencia = 40 (top), no 20
  });

  it('7. mezcla: top CONFIRMADO al tope + backoff unconfirmed → progresa por el top real', () => {
    const r = computeProgression([conf(10, 40), unconf(12, 30)], '8-10', 2.5, false);
    expect(r.action).toBe('add-weight');
    expect(r.kg).toBe(42.5);
  });

  it('8. top unconfirmed pero backoff CONFIRMADO → sin evidencia AL PESO TOP → hold en el top real', () => {
    const r = computeProgression([unconf(10, 40), conf(12, 30)], '8-10', 2.5, false);
    expect(r.action).toBe('hold');
    expect(r.kg).toBe(40); // mantiene la carga real máxima, no inventa subida
  });

  it('9. bandas sin confirmar → hold (no sube tensión sin evidencia)', () => {
    const r = computeProgression([unconf(12, 0)], '8-12', 0, true);
    expect(r.action).toBe('hold');
    const rc = computeProgression([conf(12, 0)], '8-12', 0, true);
    expect(rc.action).toBe('add-tension');
  });

  it('10. peso corporal sin confirmar → hold (no sube dificultad sin evidencia)', () => {
    const r = computeProgression([unconf(15, 0)], '10-15', 0, false);
    expect(r.action).toBe('hold');
    const rc = computeProgression([conf(15, 0)], '10-15', 0, false);
    expect(rc.action).toBe('add-difficulty');
  });

  it('legacy: historial viejo sin flag (undefined) se trata como CONFIRMADO → comportamiento intacto', () => {
    const r = computeProgression([{ reps: 10, kg: 40 }], '8-10', 2.5, false);
    expect(r.action).toBe('add-weight'); // no rompe sesiones/tests previos
  });
});
