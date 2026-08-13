import { describe, it, expect } from 'vitest';
import { deriveMesocycleState, type Recovery, type Adherence, type Trend } from '../mesocycle';

// BLOQUE 4 (D3/F3) · progresión menos conservadora: "ausencia de señales negativas + evidencia
// suficiente de tolerancia" → avanza. Ya NO exige readiness HIGH sostenida. Se conservan los
// frenos (mala recuperación / rendimiento cayendo → retroceder; ambiguo → mantener).
const meso = (recovery: Recovery, adherence: Adherence, performance: Trend, weeksAccumulated = 1) =>
  deriveMesocycleState({ weeksAccumulated, recovery, adherence, performance });

describe('D3 · cuándo AVANZA', () => {
  it('recuperación NORMAL/media + rendimiento SUBIENDO + adherencia alta → avanza (antes: mantenía)', () => {
    expect(meso('media', 'alta', 'sube').progression).toBe('avanzar');
  });
  it('readiness ALTA (recuperación buena) sola → avanza (no requiere adherencia alta simultánea)', () => {
    expect(meso('buena', 'media', 'estable').progression).toBe('avanzar');
  });
  it('adherencia media + rendimiento subiendo → avanza (consistente y progresando)', () => {
    expect(meso('media', 'media', 'sube').progression).toBe('avanzar');
  });
});

describe('D3 · cuándo MANTIENE (señal ambigua / insuficiente)', () => {
  it('todo NORMAL/estable (recuperación media, rendimiento estable) → mantiene, no avanza', () => {
    expect(meso('media', 'alta', 'estable').progression).toBe('mantener');
  });
  it('avanzado con progreso LENTO (media/estable) → mantiene (ni avanza ni retrocede)', () => {
    expect(meso('media', 'media', 'estable').progression).toBe('mantener');
  });
});

describe('D3 · los FRENOS se conservan (no se volvió agresivo)', () => {
  it('mala recuperación → retrocede (aunque el rendimiento suba)', () => {
    expect(meso('mala', 'alta', 'sube').progression).toBe('retroceder');
  });
  it('rendimiento CAYENDO → retrocede', () => {
    expect(meso('buena', 'alta', 'baja').progression).toBe('retroceder');
  });
  it('adherencia BAJA (entrena poco) → NO avanza, aunque el resto esté bien', () => {
    expect(meso('media', 'baja', 'sube').progression).not.toBe('avanzar');
  });
  it('fatiga crónica en semana avanzada → deload', () => {
    expect(meso('mala', 'media', 'baja', 5).deload).toBe(true);
  });
});

describe('D3 · post-deload puede volver a avanzar', () => {
  it('bloque nuevo (semana 1) + señales de tolerancia → avanza', () => {
    // tras un deload, weeksAccumulated reset a 0 → week 1, no deload → puede avanzar
    const m = deriveMesocycleState({ weeksAccumulated: 0, recovery: 'media', adherence: 'alta', performance: 'sube', inDeloadWeek: false });
    expect(m.deload).toBe(false);
    expect(m.progression).toBe('avanzar');
  });
});
