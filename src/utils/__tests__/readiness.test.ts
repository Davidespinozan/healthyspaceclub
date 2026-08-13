import { describe, it, expect } from 'vitest';
import {
  computeReadiness, readinessToRecovery, chronicRecoveryTrend, chronicToRecovery,
  type ReadinessState,
} from '../readiness';

describe('readiness — computeReadiness (aguda)', () => {
  it('todo ausente (cold start / check-in omitido) → NORMAL, nunca bloquea', () => {
    expect(computeReadiness({}).state).toBe('normal');
  });
  it('energía baja + durmió mal → LOW', () => {
    expect(computeReadiness({ energy: 'baja', sleep: 'malo' }).state).toBe('low');
  });
  it('energía alta + durmió bien → HIGH', () => {
    expect(computeReadiness({ energy: 'alta', sleep: 'bueno' }).state).toBe('high');
  });
  it('señales mixtas / parciales → NORMAL', () => {
    expect(computeReadiness({ energy: 'alta', sleep: 'malo' }).state).toBe('normal');
    expect(computeReadiness({ energy: 'normal' }).state).toBe('normal');
  });
  it('agujetas fuertes empujan a LOW junto con otra señal', () => {
    expect(computeReadiness({ energy: 'baja', soreness: 'alta' }).state).toBe('low');
  });
  it('expone factores legibles para la nota de la IA', () => {
    expect(computeReadiness({ energy: 'baja', sleep: 'malo' }).factors).toContain('energía baja');
  });
});

describe('readiness — mapeo a Recovery (dosis de hoy)', () => {
  it('low→mala, normal→media, high→buena', () => {
    expect(readinessToRecovery('low')).toBe('mala');
    expect(readinessToRecovery('normal')).toBe('media');
    expect(readinessToRecovery('high')).toBe('buena');
  });
});

describe('readiness — chronicRecoveryTrend (crónica, toca planificación)', () => {
  const low: ReadinessState = 'low', norm: ReadinessState = 'normal', high: ReadinessState = 'high';

  it('UNA mala noche NO es tendencia crónica (evidencia insuficiente)', () => {
    expect(chronicRecoveryTrend({ recentReadiness: [low], performance: 'baja' })).toBe('stable');
    expect(chronicRecoveryTrend({ recentReadiness: [low, norm], performance: 'baja' })).toBe('stable');
  });
  it('FATIGA PERSISTENTE: varias sesiones low + RIR peor de lo esperado → declining', () => {
    expect(chronicRecoveryTrend({
      recentReadiness: [low, low, low], rirErrors: [-2, -2, -1],
    })).toBe('declining');
  });
  it('varias low + performance cayendo → declining (aunque falte RIR)', () => {
    expect(chronicRecoveryTrend({ recentReadiness: [low, low, low], performance: 'baja' })).toBe('declining');
  });
  it('readiness alta sostenida + performance al alza → improving', () => {
    expect(chronicRecoveryTrend({ recentReadiness: [high, high, high], performance: 'sube' })).toBe('improving');
  });
  it('mezcla sin patrón → stable', () => {
    expect(chronicRecoveryTrend({ recentReadiness: [low, high, norm], performance: 'estable' })).toBe('stable');
  });
  it('chronicToRecovery: declining→mala, improving→buena, stable→fallback', () => {
    expect(chronicToRecovery('declining')).toBe('mala');
    expect(chronicToRecovery('improving')).toBe('buena');
    expect(chronicToRecovery('stable', 'media')).toBe('media');
  });
});
