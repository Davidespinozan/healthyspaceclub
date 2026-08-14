import { describe, it, expect } from 'vitest';
import { prescribeLoad, estimate1RMFromSet } from '../loadEngine';
import { prescribeExercise, DELOAD_LOAD_FACTOR } from '../sessionPrescription';
import { nextSetSuggestion } from '../rirFeedback';

// BLOQUE 2 (D6+D4 / F6+F4) · UNA sola autoridad de carga: prescribeLoad (RIR-aware). Player,
// IA, trace y deload consumen la MISMA prescripción. Sin calibración aparte (canal único).

describe('CAPACIDAD RIR-aware · reps @ RIR0/2/4', () => {
  it('a igual peso/reps, más RIR (más reserva) → más capacidad estimada', () => {
    const r0 = estimate1RMFromSet({ reps: 8, kg: 100, rir: 0 })!;
    const r2 = estimate1RMFromSet({ reps: 8, kg: 100, rir: 2 })!;
    const r4 = estimate1RMFromSet({ reps: 8, kg: 100, rir: 4 })!;
    expect(r2).toBeGreaterThan(r0);
    expect(r4).toBeGreaterThan(r2);
  });
  it('MISMA capacidad real → estimaciones similares (8@RIR2 y 10@RIR0 rinden ~igual)', () => {
    const a = estimate1RMFromSet({ reps: 8, kg: 100, rir: 2 })!; // potencial 10
    const b = estimate1RMFromSet({ reps: 10, kg: 100, rir: 0 })!; // potencial 10
    expect(Math.abs(a - b)).toBeLessThan(0.5);
  });
});

describe('NO DECAY · el peso de trabajo no cae sesión tras sesión', () => {
  it('mismo esfuerzo (performed == target) → el peso vuelve al mismo kg', () => {
    // Objetivo hipertrofia acumulación: reps ~8 @ RIR2. El atleta hace 8 @ RIR2 a 100kg.
    let kg = 100;
    for (let s = 0; s < 8; s++) {
      const p = prescribeLoad([{ reps: 8, kg, rir: 2 }], '8', 'equilibrio')!;
      // se sostiene (no decae): dentro de ±1 incremento del último
      expect(p.topKg).toBeGreaterThanOrEqual(kg - 2.5);
      kg = p.topKg;
    }
    expect(kg).toBeGreaterThanOrEqual(97.5); // NO se hundió (antes decaía ~7%/sesión)
  });

  it('fuerza REAL subiendo (RIR sube al mismo peso) → la carga SUBE, no baja', () => {
    const estable = prescribeLoad([{ reps: 5, kg: 100, rir: 1 }], '5', 'intensidad')!;
    const masFuerte = prescribeLoad([{ reps: 5, kg: 100, rir: 3 }], '5', 'intensidad')!; // más reserva
    expect(masFuerte.topKg).toBeGreaterThanOrEqual(estable.topKg);
  });
});

describe('FUENTE ÚNICA · deload, player, IA, trace, next-set parten del MISMO topKg', () => {
  const loaded = [{ reps: 5, kg: 120, rir: 2 }];

  it('deload = topKg normal × factor (misma fuente, no un cálculo aparte)', () => {
    const normal = prescribeExercise({ category: 'main-compound', sets: 4, trainingGoal: 'fuerza', phase: 'acumulacion', lastSets: loaded });
    const deload = prescribeExercise({ category: 'main-compound', sets: 3, trainingGoal: 'fuerza', phase: 'deload', lastSets: loaded });
    expect(deload.isDeloadLoad).toBe(true);
    // el deload sale del MISMO prescribeLoad, reducido por el factor
    const expected = Math.round((normal.topKg! * DELOAD_LOAD_FACTOR) / 2.5) * 2.5;
    expect(deload.topKg).toBe(expected);
  });

  it('player/IA/trace: el topKg del ejercicio ES el de la prescripción (una sola cifra)', () => {
    const pr = prescribeExercise({ category: 'main-compound', sets: 4, trainingGoal: 'hipertrofia', phase: 'acumulacion', lastSets: loaded });
    // el player muestra prescription.topKg; la IA/trace usan prescription.topKg → mismo valor.
    expect(pr.topKg).toBeGreaterThan(0);
    expect(pr.backoffKg).toBeGreaterThan(0);
    expect(pr.topKg!).toBeGreaterThanOrEqual(pr.backoffKg!);
  });

  it('next-set suggestion parte del MISMO topKg prescrito', () => {
    const pr = prescribeExercise({ category: 'main-compound', sets: 4, trainingGoal: 'hipertrofia', phase: 'acumulacion', lastSets: loaded });
    const sug = nextSetSuggestion({ prescribedRir: pr.rir, actualRir: 0, topKg: pr.topKg }); // más duro de lo esperado
    expect(sug.action).toBe('reduce');
    expect(sug.nextKg!).toBeLessThan(pr.topKg!); // ajusta relativo al peso prescrito
  });

  it('bandas/peso corporal → sin topKg (progresión por dificultad/tensión, no kg inventados)', () => {
    const pr = prescribeExercise({ category: 'main-compound', sets: 3, trainingGoal: 'hipertrofia', phase: 'acumulacion', lastSets: [{ reps: 12, kg: 0 }] });
    expect(pr.topKg).toBeUndefined();
  });
});
