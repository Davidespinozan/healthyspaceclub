import { describe, it, expect } from 'vitest';
import {
  strengthWarmupMinutes, pickWarmupRaise, pickSpecificActivation, warmupRegion, firstApproachExercise,
} from '../strengthWarmup';
import { deriveCapabilities } from '../equipmentImplement';
import { exercises as BANK } from '../../data/exercises';

// ═══════════════════════════════════════════════════════════════════════════
// PREPARACIÓN de fuerza: duración desacoplada del reloj + contenido derivado de la rutina real.
// ═══════════════════════════════════════════════════════════════════════════
const gym = deriveCapabilities(['gym']);
const cuerpo = deriveCapabilities([]);
// Rutina real observada (orden final).
const upperRoutine = ['traccion-vertical-polea', 'remo-horizontal-pesado', 'remo-invertido', 'press-horizontal', 'press-inclinado', 'press-vertical', 'triceps-push-down', 'curl-polea-alta'].map(id => ({ id }));

describe('duración · desacoplada del tiempo disponible', () => {
  const base = { trainingGoal: 'hipertrofia' as const, readinessLow: false, lowImpactMode: false, hasPain: false };
  it('60/90/120 con las MISMAS señales → mismos minutos (no escala con el reloj)', () => {
    const m60 = strengthWarmupMinutes({ ...base, availableMinutes: 60 });
    const m90 = strengthWarmupMinutes({ ...base, availableMinutes: 90 });
    const m120 = strengthWarmupMinutes({ ...base, availableMinutes: 120 });
    expect(m60).toBe(m90);
    expect(m90).toBe(m120);
    expect(m120).toBeLessThanOrEqual(8); // NO 15
  });
  it('sesión normal cae en ~5–8 min', () => {
    const m = strengthWarmupMinutes({ ...base, availableMinutes: 90 });
    expect(m).toBeGreaterThanOrEqual(5);
    expect(m).toBeLessThanOrEqual(8);
  });
  it('fuerza pesada justifica más (pero acotado)', () => {
    const hip = strengthWarmupMinutes({ ...base, availableMinutes: 90 });
    const fue = strengthWarmupMinutes({ ...base, trainingGoal: 'fuerza', availableMinutes: 90 });
    expect(fue).toBeGreaterThan(hip);
    expect(fue).toBeLessThanOrEqual(10);
  });
  it('readiness baja / bajo impacto / dolor adaptan sin volverse absurdos (≤10)', () => {
    const m = strengthWarmupMinutes({ trainingGoal: 'fuerza', readinessLow: true, lowImpactMode: true, hasPain: true, availableMinutes: 120 });
    expect(m).toBeLessThanOrEqual(10);
  });
  it('sesión corta: cap ligero evita desproporción (no toma 1/3 del tiempo)', () => {
    const m = strengthWarmupMinutes({ trainingGoal: 'fuerza', lowImpactMode: true, hasPain: true, readinessLow: true, availableMinutes: 20 });
    expect(m).toBeLessThanOrEqual(Math.round(20 * 0.25)); // ≤5
  });
});

describe('raise · equipment-aware', () => {
  it('Full Gym prefiere máquina de cardio, NO marcha en el lugar', () => {
    const r = pickWarmupRaise(BANK, gym.equipmentList, true);
    expect(r).not.toBeNull();
    expect(r!.equipment.includes('gym')).toBe(true);
    expect(r!.id).not.toBe('marcha-en-lugar');
  });
  it('sin gym → cae a bajo impacto reproducible (marcha/paso lateral)', () => {
    const r = pickWarmupRaise(BANK, cuerpo.equipmentList, false);
    expect(r).not.toBeNull();
    expect(r!.impact).not.toBe('high');
  });
});

describe('activación específica · gate por región (no core en upper/lower/mixed) · NO yoga', () => {
  it('upper → activación no-yoga con video O null (jamás yoga; jamás core)', () => {
    const a = pickSpecificActivation(BANK, 'upper', gym.equipmentList);
    if (a) {
      expect(a.isYoga).toBeFalsy();
      expect(a.type).toBe('activacion');
      expect(['espalda', 'hombros', 'pecho']).toContain(a.muscleGroup); // región upper, NO core
    }
    expect(a?.id).not.toBe('sun-salutation-a');
  });
  it('mixed (Full Body observado) → NO selecciona core isométrico → null → fallback textual', () => {
    // en el banco actual, las únicas activaciones con video son core (anti-*) → gate mixed las excluye.
    const a = pickSpecificActivation(BANK, 'mixed', gym.equipmentList);
    if (a) expect(a.muscleGroup).not.toBe('core');
    // el caso real: sin activación region-relevante con video → null → el caller usa texto por región.
    expect(a?.id).not.toBe('anti-extension-isometrica');
  });
  it('lower → NO core; null o activación de cadera/pierna', () => {
    const a = pickSpecificActivation(BANK, 'lower', gym.equipmentList);
    if (a) expect(['gluteo', 'cuadriceps', 'isquios']).toContain(a.muscleGroup);
    expect(a?.id).not.toBe('anti-extension-isometrica');
  });
  it('core region → una activación de core SÍ es elegible', () => {
    const a = pickSpecificActivation(BANK, 'core', gym.equipmentList);
    expect(a).not.toBeNull();
    expect(a!.muscleGroup).toBe('core');
    expect(a!.isYoga).toBeFalsy();
  });
  it('region-relevant + video + equipo compatible → se selecciona (core en core)', () => {
    // control positivo: cuando existe un candidato coherente con la región, se devuelve (no null).
    const a = pickSpecificActivation(BANK, 'core', gym.equipmentList);
    expect(a?.type).toBe('activacion');
  });
  it('nunca yoga en ninguna región', () => {
    for (const r of ['upper', 'lower', 'mixed', 'core'] as const) {
      const a = pickSpecificActivation(BANK, r, gym.equipmentList);
      if (a) expect(a.isYoga).toBeFalsy();
    }
  });
});

describe('región (fallback textual)', () => {
  it('rutina de tirones+press → upper', () => {
    expect(warmupRegion(upperRoutine, BANK)).toBe('upper');
  });
  it('rutina de sentadilla+bisagra → lower', () => {
    expect(warmupRegion([{ id: 'sentadilla-bilateral' }, { id: 'peso-muerto-rumano' }], BANK)).toBe('lower');
  });
  it('upper+lower → mixed', () => {
    expect(warmupRegion([{ id: 'press-horizontal' }, { id: 'sentadilla-bilateral' }], BANK)).toBe('mixed');
  });
});

describe('primer ejercicio de aproximación (nombrar)', () => {
  it('con anchor → primer anchor en el orden', () => {
    const ex = firstApproachExercise(upperRoutine, ['press-horizontal'], BANK);
    expect(ex?.id).toBe('press-horizontal');
  });
  it('sin anchor → primer main-compound (Tracción Vertical en el caso real)', () => {
    const ex = firstApproachExercise(upperRoutine, [], BANK);
    expect(ex?.id).toBe('traccion-vertical-polea');
    expect(ex?.name).toBeTruthy();
  });
  it('sin compuesto (solo aislamientos) → primer ejercicio, sin romper', () => {
    const iso = [{ id: 'curl-polea-alta' }, { id: 'triceps-push-down' }];
    const ex = firstApproachExercise(iso, [], BANK);
    expect(ex).not.toBeNull(); // no rompe; el caller decidirá nota genérica si no es compuesto
  });
});
