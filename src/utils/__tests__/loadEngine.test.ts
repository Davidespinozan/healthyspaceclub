import { describe, it, expect } from 'vitest';
import {
  estimate1RM, loadForReps, roundToIncrement,
  targetRepsForPhase, rirForBias, prescribeLoad, aggregateE1RM, e1RMTrend,
  estimate1RMFromSet, robustE1RM, blendE1RM,
} from '../loadEngine';

describe('loadEngine — e1RM', () => {
  it('estima 1RM (Epley) del mejor set', () => {
    // 100kg×5 → 100*(1+5/30)=116.67 ; 90kg×10 → 90*1.333=120 → gana el de 90×10
    const e = estimate1RM([{ reps: 5, kg: 100 }, { reps: 10, kg: 90 }])!;
    expect(Math.round(e)).toBe(120);
  });
  it('null si no hay peso (peso corporal / banda)', () => {
    expect(estimate1RM([{ reps: 12, kg: 0 }])).toBeNull();
    expect(estimate1RM([])).toBeNull();
    expect(estimate1RM(undefined)).toBeNull();
  });
  it('loadForReps es coherente con el e1RM', () => {
    const e = 120;
    expect(loadForReps(e, 1)).toBeCloseTo(116.1, 0); // ~1 rep ≈ casi el 1RM
    expect(loadForReps(e, 10)).toBeCloseTo(90, 0);    // 10 reps ≈ 90
  });
  it('redondea al incremento del gym', () => {
    expect(roundToIncrement(91.2, 2.5)).toBe(90);
    expect(roundToIncrement(93.8, 2.5)).toBe(95);
    expect(roundToIncrement(92, 5)).toBe(90);
  });
});

describe('loadEngine — reps/RIR por fase', () => {
  it('intensificación = extremo bajo (pesado), acumulación = alto (volumen)', () => {
    expect(targetRepsForPhase('8-12', 'intensidad')).toBe(8);
    expect(targetRepsForPhase('8-12', 'volumen')).toBe(12);
    expect(targetRepsForPhase('8-12', 'equilibrio')).toBe(10);
  });
  it('RIR: más cerca del fallo en intensificación', () => {
    expect(rirForBias('intensidad')).toBeLessThan(rirForBias('volumen'));
    expect(rirForBias('descarga')).toBeGreaterThanOrEqual(3);
  });
});

describe('loadEngine — prescribeLoad', () => {
  const last = [{ reps: 8, kg: 100 }]; // e1RM ≈ 126.7

  it('intensificación pesa MÁS que acumulación (mismo historial)', () => {
    const inten = prescribeLoad(last, '8-12', 'intensidad')!;
    const acum = prescribeLoad(last, '8-12', 'volumen')!;
    expect(inten.topKg).toBeGreaterThan(acum.topKg);
    expect(inten.reps).toBe(8);
    expect(acum.reps).toBe(12);
  });

  it('serie tope > backoff (~10% menos), redondeado a placa', () => {
    const p = prescribeLoad(last, '6-10', 'equilibrio')!;
    expect(p.topKg).toBeGreaterThan(p.backoffKg);
    expect(p.backoffKg).toBeCloseTo(Math.round(p.topKg * 0.9 / 2.5) * 2.5, 1);
    expect(p.topKg % 2.5).toBe(0);
  });

  it('deja RIR: el peso es para (reps + RIR), no al fallo puro', () => {
    const p = prescribeLoad(last, '8-8', 'equilibrio')!; // reps 8, rir 2 → peso para 10
    expect(p.rir).toBe(2);
    expect(p.topKg).toBeLessThan(100); // más ligero que su 8RM real (deja margen)
  });

  it('sin peso → null (deja la progresión por dificultad/tensión)', () => {
    expect(prescribeLoad([{ reps: 15, kg: 0 }], '12-15', 'equilibrio')).toBeNull();
  });
});

describe('loadEngine — aggregateE1RM (señal de fuerza)', () => {
  it('suma el mejor e1RM por ejercicio (para la tendencia del mesociclo)', () => {
    const entries = [
      { exercise: 'press-banca', sets: [{ reps: 5, kg: 80 }] },
      { exercise: 'press-banca', sets: [{ reps: 5, kg: 85 }] }, // mejor sesión
      { exercise: 'sentadilla', sets: [{ reps: 5, kg: 120 }] },
      { exercise: 'peso-corporal', sets: [{ reps: 12, kg: 0 }] }, // ignorado
    ];
    const agg = aggregateE1RM(entries);
    // press-banca mejor = 85*(1+5/30)=99.17 ; sentadilla = 120*1.1667=140 ; suma ≈ 239
    expect(Math.round(agg)).toBe(239);
  });

  it('e1RMTrend compara el MISMO ejercicio entre periodos', () => {
    const older = [{ exercise: 'press', sets: [{ reps: 5, kg: 80 }] }];
    const subiendo = [{ exercise: 'press', sets: [{ reps: 5, kg: 90 }] }];
    const bajando = [{ exercise: 'press', sets: [{ reps: 5, kg: 72 }] }];
    expect(e1RMTrend(subiendo, older)).toBe('sube');
    expect(e1RMTrend(bajando, older)).toBe('baja');
    // sin ejercicios comparables → null (el llamador cae a volumen)
    expect(e1RMTrend([{ exercise: 'otro', sets: [{ reps: 5, kg: 50 }] }], older)).toBeNull();
  });
});

describe('loadEngine — P6 · e1RM ajustado por RIR', () => {
  it('estimate1RMFromSet usa reps + RIR (mayor capacidad que asumir fallo)', () => {
    // 100×8 @0 RIR (al fallo) = 100*(1+8/30)=126.7
    const alFallo = estimate1RMFromSet({ reps: 8, kg: 100, rir: 0 })!;
    // 100×8 @2 RIR (quedaban 2) → potencial 10 → 100*(1+10/30)=133.3 → capacidad mayor
    const conReserva = estimate1RMFromSet({ reps: 8, kg: 100, rir: 2 })!;
    expect(Math.round(alFallo)).toBe(127);
    expect(conReserva).toBeGreaterThan(alFallo);
  });
  it('sin carga (peso corporal / banda) → null', () => {
    expect(estimate1RMFromSet({ reps: 12, kg: 0, rir: 2 })).toBeNull();
  });
  it('robustE1RM con ≥2 series con RIR → mediana (protege del outlier)', () => {
    const r = robustE1RM([
      { reps: 8, kg: 100, rir: 2 }, { reps: 8, kg: 100, rir: 2 }, { reps: 8, kg: 200, rir: 2 }, // outlier
    ])!;
    expect(r.ridCount).toBe(3);
    expect(r.e1RM).toBeLessThan(estimate1RMFromSet({ reps: 8, kg: 200, rir: 2 })!); // el outlier no gana
  });
  it('FALLBACK Epley: sin RIR en las series → cae a estimate1RM (ridCount 0)', () => {
    const r = robustE1RM([{ reps: 8, kg: 100 }, { reps: 8, kg: 100 }])!;
    expect(r.ridCount).toBe(0);
    expect(r.e1RM).toBeCloseTo(estimate1RM([{ reps: 8, kg: 100 }])!, 1);
  });
  it('robustE1RM sin datos → null', () => {
    expect(robustE1RM([])).toBeNull();
    expect(robustE1RM([{ reps: 10, kg: 0 }])).toBeNull();
  });
  it('blendE1RM: sin RIR → 100% medido; con más exposiciones → más peso al RIR (tope 0.5)', () => {
    const measured = 120;
    expect(blendE1RM(measured, { e1RM: 140, ridCount: 0 })).toBe(120); // sin RIR → medido
    const una = blendE1RM(measured, { e1RM: 140, ridCount: 1 })!;
    const varias = blendE1RM(measured, { e1RM: 140, ridCount: 5 })!;
    expect(una).toBeGreaterThan(120);
    expect(varias).toBeGreaterThan(una);         // más evidencia → más ajuste
    expect(varias).toBeLessThanOrEqual((120 + 140) / 2); // pero nunca lo domina (w≤0.5)
  });
  it('blendE1RM sin nada medido pero con RIR → usa el RIR', () => {
    expect(blendE1RM(null, { e1RM: 140, ridCount: 2 })).toBe(140);
    expect(blendE1RM(null, { e1RM: 140, ridCount: 0 })).toBeNull();
  });
});
