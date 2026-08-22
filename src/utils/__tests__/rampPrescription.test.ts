import { describe, it, expect } from 'vitest';
import { buildRampPrescription, type RampStep } from '../rampPrescription';

// ─────────────────────────────────────────────────────────────────────────────
// F2C-9C.2C · SERIES DE APROXIMACIÓN (potentiate ejecutable, Option W).
// El motor es PURO: recibe el topKg de trabajo YA prescrito y deriva la escalera. Nunca inventa carga,
// nunca aproxima con ≥ topKg, siempre asciende, y respeta los caps de dosis/tiempo. No se loguea (aquí
// solo se prueba la escalera; el cero-credit es estructural: nunca entra a exercises[]/LoggedSet).
// ─────────────────────────────────────────────────────────────────────────────

const kgs = (steps: RampStep[]) => steps.map(s => s.kg);

describe('buildRampPrescription · sin carga interpretable → sin escalera', () => {
  it('E · new-user / topKg ausente → []', () => {
    expect(buildRampPrescription({ topKg: undefined, availableMinutes: 60 })).toEqual([]);
    expect(buildRampPrescription({ topKg: null, availableMinutes: 60 })).toEqual([]);
  });
  it('D · peso corporal / bandas (topKg 0 o no finito) → []', () => {
    expect(buildRampPrescription({ topKg: 0, availableMinutes: 60 })).toEqual([]);
    expect(buildRampPrescription({ topKg: -20, availableMinutes: 60 })).toEqual([]);
    expect(buildRampPrescription({ topKg: NaN, availableMinutes: 60 })).toEqual([]);
    expect(buildRampPrescription({ topKg: Infinity, availableMinutes: 60 })).toEqual([]);
  });
});

describe('buildRampPrescription · forma de la escalera', () => {
  it('I+J · ascendente y SIEMPRE por debajo del topKg', () => {
    for (const topKg of [30, 40, 55, 80, 100, 140, 180]) {
      const steps = buildRampPrescription({ topKg, availableMinutes: 90 });
      const ks = kgs(steps);
      // estrictamente ascendente
      for (let i = 1; i < ks.length; i++) expect(ks[i]).toBeGreaterThan(ks[i - 1]);
      // todas < topKg y > 0
      for (const k of ks) { expect(k).toBeGreaterThan(0); expect(k).toBeLessThan(topKg); }
    }
  });
  it('L · nunca más de 3 aproximaciones', () => {
    for (const topKg of [10, 40, 80, 140, 300]) {
      expect(buildRampPrescription({ topKg, availableMinutes: 120 }).length).toBeLessThanOrEqual(3);
    }
  });
  it('reps conservadoras (pocas, sin AMRAP/fallo): 2–5', () => {
    const steps = buildRampPrescription({ topKg: 140, availableMinutes: 90 });
    for (const s of steps) { expect(s.reps).toBeGreaterThanOrEqual(2); expect(s.reps).toBeLessThanOrEqual(5); }
  });
  it('cada aproximación cae a un incremento de 2.5 kg (misma granularidad que el working load)', () => {
    const steps = buildRampPrescription({ topKg: 137, availableMinutes: 90 });
    for (const s of steps) expect(Math.round((s.kg / 2.5) % 1 * 1000) / 1000).toBe(0);
  });
  it('K · el redondeo que duplica/rebasa se elimina (menos series, sin repetir kg)', () => {
    // topKg pequeño: varias fracciones colapsan al mismo múltiplo de 2.5 → dedup deja kg únicos < topKg.
    const steps = buildRampPrescription({ topKg: 7.5, availableMinutes: 90 });
    const ks = kgs(steps);
    expect(new Set(ks).size).toBe(ks.length);          // sin duplicados
    for (const k of ks) expect(k).toBeLessThan(7.5);   // ninguno ≥ topKg
  });
});

describe('buildRampPrescription · dosis por magnitud de carga (la carga manda)', () => {
  it('M · carga baja → ≤ 1 aproximación', () => {
    expect(buildRampPrescription({ topKg: 40, availableMinutes: 120 }).length).toBeLessThanOrEqual(1);
    expect(buildRampPrescription({ topKg: 20, availableMinutes: 120 }).length).toBeLessThanOrEqual(1);
  });
  it('N · carga moderada → ≤ 2', () => {
    expect(buildRampPrescription({ topKg: 80, availableMinutes: 120 }).length).toBeLessThanOrEqual(2);
    expect(buildRampPrescription({ topKg: 100, availableMinutes: 120 }).length).toBeLessThanOrEqual(2);
  });
  it('O · carga alta → hasta 3', () => {
    expect(buildRampPrescription({ topKg: 140, availableMinutes: 120 }).length).toBe(3);
    expect(buildRampPrescription({ topKg: 180, availableMinutes: 120 }).length).toBe(3);
  });
});

describe('buildRampPrescription · el tiempo solo RECORTA (nunca amplía)', () => {
  it('AC · 20 min → ≤ 1 aun con carga alta', () => {
    expect(buildRampPrescription({ topKg: 180, availableMinutes: 20 }).length).toBeLessThanOrEqual(1);
  });
  it('AD · 45 min → ≤ 2 aun con carga alta', () => {
    expect(buildRampPrescription({ topKg: 180, availableMinutes: 45 }).length).toBeLessThanOrEqual(2);
  });
  it('AE · 60 min → hasta 3 con carga alta', () => {
    expect(buildRampPrescription({ topKg: 180, availableMinutes: 60 }).length).toBe(3);
  });
  it('AF/AG · sesión larga NO agranda la escalera (máximo fisiológico sigue 3)', () => {
    const at90 = buildRampPrescription({ topKg: 180, availableMinutes: 90 });
    const at120 = buildRampPrescription({ topKg: 180, availableMinutes: 120 });
    expect(at90.length).toBe(3);
    expect(at120.length).toBe(3);
    expect(at120).toEqual(at90); // 90 y 120 idénticos: el tiempo no escala el warm-up
  });
});

describe('buildRampPrescription · pureza / determinismo', () => {
  it('AO · mismos inputs → mismo output (determinista, sin Date/random)', () => {
    const a = buildRampPrescription({ topKg: 140, availableMinutes: 75 });
    const b = buildRampPrescription({ topKg: 140, availableMinutes: 75 });
    expect(a).toEqual(b);
  });
  it('AP · no muta el input', () => {
    const input = { topKg: 140, availableMinutes: 75 };
    const frozen = Object.freeze({ ...input });
    expect(() => buildRampPrescription(frozen)).not.toThrow();
    expect(frozen).toEqual({ topKg: 140, availableMinutes: 75 });
  });
});

describe('buildRampPrescription · matriz de realidad (valores concretos)', () => {
  it('intermediate bench 80 @ 60min → 2 aproximaciones ascendentes < 80', () => {
    const steps = buildRampPrescription({ topKg: 80, availableMinutes: 60 });
    expect(steps.length).toBe(2);
    expect(kgs(steps)).toEqual([...kgs(steps)].sort((x, y) => x - y));
    for (const k of kgs(steps)) expect(k).toBeLessThan(80);
  });
  it('advanced squat 140 @ 90min → 3 aproximaciones, la más pesada más cercana a 140', () => {
    const steps = buildRampPrescription({ topKg: 140, availableMinutes: 90 });
    expect(steps.length).toBe(3);
    expect(steps[2].kg).toBeGreaterThan(steps[0].kg);
    expect(steps[2].kg).toBeLessThan(140);
  });
  it('DB press 30 @ 60min → ≤ 1 (carga baja)', () => {
    expect(buildRampPrescription({ topKg: 30, availableMinutes: 60 }).length).toBeLessThanOrEqual(1);
  });
});
