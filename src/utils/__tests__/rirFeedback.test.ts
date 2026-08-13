import { describe, it, expect } from 'vitest';
import {
  rirError, aggregateRirError, loadCalibration, nextSetSuggestion, type RirObservation,
} from '../rirFeedback';

const obs = (prescribedRir: number, actualRir: number, date?: string): RirObservation =>
  ({ prescribedRir, actualRir, date });

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

describe('rirFeedback — aggregateRirError', () => {
  it('SIN observaciones → 0, confianza baja', () => {
    expect(aggregateRirError([])).toEqual({ meanError: 0, n: 0, confidence: 'baja' });
  });
  it('una sola observación → confianza baja', () => {
    expect(aggregateRirError([obs(2, 0)]).confidence).toBe('baja');
  });
  it('varias consistentes → confianza alta y error estable', () => {
    const a = aggregateRirError([obs(2, 0, '2026-08-01'), obs(2, 0, '2026-08-03'), obs(2, 0, '2026-08-05'), obs(2, 0, '2026-08-07')]);
    expect(a.confidence).toBe('alta');
    expect(a.meanError).toBeCloseTo(-2, 1);
  });
  it('OUTLIER aislado no domina (se diluye entre consistentes)', () => {
    const consistente = aggregateRirError([obs(2, 2, '2026-08-01'), obs(2, 2, '2026-08-03'), obs(2, 2, '2026-08-05')]);
    const conOutlier = aggregateRirError([obs(2, 2, '2026-08-01'), obs(2, 2, '2026-08-03'), obs(2, 2, '2026-08-05'), obs(2, 4, '2026-08-06')]);
    expect(Math.abs(conOutlier.meanError)).toBeLessThan(1); // no se dispara por 1 rara
    expect(consistente.meanError).toBe(0);
  });
  it('usuario NUEVO → menos confianza que el mismo nº con historial', () => {
    const nuevo = aggregateRirError([obs(2, 0), obs(2, 0), obs(2, 0), obs(2, 0)], { isNewUser: true });
    const veterano = aggregateRirError([obs(2, 0), obs(2, 0), obs(2, 0), obs(2, 0)]);
    expect(veterano.confidence).toBe('alta');
    expect(nuevo.confidence).toBe('media'); // degradado
  });
});

describe('rirFeedback — loadCalibration (cambios pequeños, sin saltos)', () => {
  it('SIN RIR → factor 1.0 (fallback puro, no cambia nada)', () => {
    expect(loadCalibration({ observations: [] }).factor).toBe(1);
  });
  it('RIR real menor al prescrito (muy cerca del fallo) → BAJA la carga', () => {
    const c = loadCalibration({ observations: [obs(2, 0), obs(2, 0), obs(2, 0), obs(2, 0)] });
    expect(c.factor).toBeLessThan(1);
  });
  it('RIR real mayor (demasiado fácil) → SUBE la carga', () => {
    const c = loadCalibration({ observations: [obs(2, 4), obs(2, 4), obs(2, 4), obs(2, 4)] });
    expect(c.factor).toBeGreaterThan(1);
  });
  it('NUNCA salta más de ±5% ni con error máximo', () => {
    const c = loadCalibration({ observations: Array.from({ length: 8 }, (_, i) => obs(4, 0, `2026-08-0${i + 1}`)) });
    expect(c.factor).toBeGreaterThanOrEqual(0.95);
    expect(c.factor).toBeLessThanOrEqual(1.05);
  });
  it('usuario NUEVO / pocas obs → ajuste MÍNIMO (más cerca de 1 que con historial)', () => {
    const nuevo = loadCalibration({ observations: [obs(2, 0)], isNewUser: true });
    const veterano = loadCalibration({ observations: [obs(2, 0), obs(2, 0), obs(2, 0), obs(2, 0)] });
    expect(Math.abs(1 - nuevo.factor)).toBeLessThan(Math.abs(1 - veterano.factor));
  });
  it('RIR exacto al prescrito → factor 1.0 (no toca la carga)', () => {
    const c = loadCalibration({ observations: [obs(2, 2), obs(2, 2), obs(2, 2)] });
    expect(c.factor).toBe(1);
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
