import { describe, it, expect } from 'vitest';
import { rirError, nextSetSuggestion } from '../rirFeedback';

// BLOQUE 2 · loadCalibration/aggregateRirError se ELIMINARON (canal único: el RIR entra por la
// e1RM RIR-aware en loadEngine.prescribeLoad; ver p6Integration + loadEngine tests). rirError se
// conserva para la tendencia crónica; nextSetSuggestion para el autoajuste entre series.

describe('rirFeedback — rirError', () => {
  it('prescrito 2, real 0 → −2 (más agresivo de lo planeado)', () => {
    expect(rirError({ prescribedRir: 2, actualRir: 0 })).toBe(-2);
  });
  it('prescrito 2, real 4 → +2 (quedó fácil)', () => {
    expect(rirError({ prescribedRir: 2, actualRir: 4 })).toBe(2);
  });
  it('exacto → 0', () => {
    expect(rirError({ prescribedRir: 2, actualRir: 2 })).toBe(0);
  });
});

describe('rirFeedback — nextSetSuggestion (autoajuste entre series)', () => {
  it('objetivo 2, real 0 → reduce ligeramente el siguiente', () => {
    const s = nextSetSuggestion({ prescribedRir: 2, actualRir: 0, topKg: 100 });
    expect(s.action).toBe('reduce');
    expect(s.deltaKg!).toBeLessThan(0);
    expect(s.nextKg!).toBeLessThan(100);
  });
  it('objetivo 2, real 4 → sube ligeramente', () => {
    const s = nextSetSuggestion({ prescribedRir: 2, actualRir: 4, topKg: 100 });
    expect(s.action).toBe('increase');
    expect(s.nextKg!).toBeGreaterThan(100);
  });
  it('desviación de 1 (ruido) → mantener', () => {
    expect(nextSetSuggestion({ prescribedRir: 2, actualRir: 1, topKg: 100 }).action).toBe('hold');
  });
  it('el ajuste es PEQUEÑO (≤7.5%), nunca un salto grande', () => {
    const s = nextSetSuggestion({ prescribedRir: 2, actualRir: 0, topKg: 100 });
    expect(Math.abs(s.deltaKg!)).toBeLessThanOrEqual(7.5);
  });
  it('SIN carga comparable (bandas / peso corporal) → sugiere sin kg', () => {
    const s = nextSetSuggestion({ prescribedRir: 2, actualRir: 0 });
    expect(s.action).toBe('reduce');
    expect(s.deltaKg).toBeUndefined();
  });
});
