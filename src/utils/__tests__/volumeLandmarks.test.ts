import { describe, it, expect, vi } from 'vitest';

// pickByVolumeDeficit vive en workoutPlanner (que carga videoAvailability). Lo mockeamos
// como en otros tests para no acoplar con el gate de video.
vi.mock('../../data/videoAvailability', () => ({ VIDEO_VARIANT_IDS: new Set<string>() }));

import { computeVolumeTargets, adaptFactor } from '../volumeLandmarks';
import { pickByVolumeDeficit } from '../workoutPlanner';

const base = (over: Partial<Parameters<typeof computeVolumeTargets>[0]> = {}) =>
  computeVolumeTargets({ weeklyVolumes: [], level: 'intermedio', weeksOfHistory: 0, ...over });

describe('volumeLandmarks — baseline y cold start', () => {
  it('usuario NUEVO (sin historial): cold start conservador por nivel', () => {
    expect(base({ level: 'principiante' }).pecho.target).toBe(8);
    expect(base({ level: 'intermedio' }).pecho.target).toBe(11);
    expect(base({ level: 'avanzado' }).pecho.target).toBe(13);
    // siempre da target a los músculos mayores aunque no haya historial
    expect(base().espalda).toBeTruthy();
  });

  it('POCO historial (<2 semanas): conservador aunque haya hecho mucho', () => {
    const t = computeVolumeTargets({ weeklyVolumes: [{ pecho: 20 }], level: 'intermedio', weeksOfHistory: 1 });
    expect(t.pecho.baseline).toBeLessThanOrEqual(11); // no se dispara al 20
  });

  it('músculos con DIFERENTE volumen histórico → baselines distintos', () => {
    const wk = [{ pecho: 16, biceps: 6 }, { pecho: 15, biceps: 6 }, { pecho: 16, biceps: 7 }];
    const t = computeVolumeTargets({ weeklyVolumes: wk, level: 'avanzado', weeksOfHistory: 3 });
    expect(t.pecho.baseline).toBeGreaterThan(t.biceps.baseline);
  });

  it('NO asume que más es mejor: acota al techo operativo del nivel', () => {
    const wk = [{ pecho: 30 }, { pecho: 30 }, { pecho: 30 }];
    const t = computeVolumeTargets({ weeklyVolumes: wk, level: 'avanzado', weeksOfHistory: 3, performance: 'sube', adherence: 'alta', recovery: 'buena' });
    expect(t.pecho.target).toBeLessThanOrEqual(24); // max avanzado
  });
});

describe('volumeLandmarks — adaptación por señales', () => {
  const wk = [{ pecho: 14 }, { pecho: 13 }, { pecho: 14 }];
  const good = { weeklyVolumes: wk, level: 'intermedio' as const, weeksOfHistory: 3 };

  it('buena respuesta SOSTENIDA → progresa (target > baseline)', () => {
    const t = computeVolumeTargets({ ...good, recovery: 'buena', performance: 'sube', adherence: 'alta' });
    expect(t.pecho.target).toBeGreaterThan(t.pecho.baseline);
  });

  it('e1RM cayendo (performance baja) → retrocede', () => {
    const t = computeVolumeTargets({ ...good, performance: 'baja', recovery: 'media', adherence: 'alta' });
    expect(t.pecho.target).toBeLessThan(t.pecho.baseline);
  });

  it('adherencia BAJA → mantiene (no progresa aunque no haya fatiga)', () => {
    const t = computeVolumeTargets({ ...good, recovery: 'buena', performance: 'sube', adherence: 'baja' });
    expect(t.pecho.target).toBe(t.pecho.baseline);
  });

  it('mala recuperación AISLADA: baja el target de HOY pero NO recalibra el baseline', () => {
    const buena = computeVolumeTargets({ ...good, recovery: 'buena', performance: 'sube', adherence: 'alta' });
    const mala = computeVolumeTargets({ ...good, recovery: 'mala', performance: 'estable', adherence: 'alta' });
    expect(mala.pecho.baseline).toBe(buena.pecho.baseline); // el baseline no cambió (deriva del historial)
    expect(mala.pecho.target).toBeLessThan(buena.pecho.target);
  });

  it('mala recuperación PERSISTENTE (+ rendimiento a la baja) → retrocede', () => {
    const t = computeVolumeTargets({ ...good, recovery: 'mala', performance: 'baja', adherence: 'media' });
    expect(t.pecho.target).toBeLessThan(t.pecho.baseline);
  });

  it('adaptFactor: deload es NEUTRAL (no recalibra)', () => {
    expect(adaptFactor({ recovery: 'mala', performance: 'baja', adherence: 'baja', isDeload: true })).toBe(1);
  });
});

describe('volumeLandmarks — deload, regreso y pausa', () => {
  const wk = [{ pecho: 14 }, { pecho: 13 }, { pecho: 14 }];

  it('DELOAD: baja el volumen fuerte pero el baseline NO aprende ese valor bajo', () => {
    const t = computeVolumeTargets({ weeklyVolumes: wk, level: 'intermedio', weeksOfHistory: 3, isDeload: true, volumeMultiplier: 0.55 });
    expect(t.pecho.target).toBeLessThan(t.pecho.baseline * 0.7); // target reducido
    expect(t.pecho.baseline).toBeGreaterThan(10);                 // baseline intacto
  });

  it('REGRESO de deload: una semana baja no tira el baseline (mediana robusta)', () => {
    const conDeload = [{ pecho: 14 }, { pecho: 5 }, { pecho: 14 }, { pecho: 13 }]; // la 2ª fue deload
    const t = computeVolumeTargets({ weeklyVolumes: conDeload, level: 'intermedio', weeksOfHistory: 4 });
    expect(t.pecho.baseline).toBeGreaterThan(12); // la mediana ignora el 5
  });

  it('PAUSA prolongada → cold start conservador (ignora el historial viejo)', () => {
    const t = computeVolumeTargets({ weeklyVolumes: [{ pecho: 22 }, { pecho: 22 }], level: 'intermedio', weeksOfHistory: 2, longPause: true });
    expect(t.pecho.baseline).toBe(11); // cold start intermedio
  });

  it('CAMBIO de objetivo (proxy): el target sigue la distribución actual del historial', () => {
    // Nuevo énfasis en pierna, poco de pecho → cuádriceps > pecho en el target.
    const wkNew = [{ cuadriceps: 16, pecho: 4 }, { cuadriceps: 15, pecho: 4 }];
    const t = computeVolumeTargets({ weeklyVolumes: wkNew, level: 'intermedio', weeksOfHistory: 2 });
    expect(t.cuadriceps.target).toBeGreaterThan(t.pecho.target);
  });
});

describe('volumeLandmarks — integración', () => {
  it('con volumeMultiplier del mesociclo: MODULA el baseline (acotado)', () => {
    const wk = [{ pecho: 12 }, { pecho: 12 }, { pecho: 12 }];
    const alto = computeVolumeTargets({ weeklyVolumes: wk, level: 'intermedio', weeksOfHistory: 3, volumeMultiplier: 1.2 });
    const bajo = computeVolumeTargets({ weeklyVolumes: wk, level: 'intermedio', weeksOfHistory: 3, volumeMultiplier: 0.8 });
    expect(alto.pecho.target).toBeGreaterThan(bajo.pecho.target);
    expect(alto.pecho.target).toBeCloseTo(12 * 1.2, 1);
  });

  it('pickByVolumeDeficit compara contra el target PERSONALIZADO (cambia la decisión vs plano)', () => {
    // Sin volumen aún esta semana. Con target personalizado ALTO en pierna y bajo en
    // torso → elige 'lower'. Con el plano (14 parejo) elegiría 'upper' (tiene 5 músculos).
    const vol = {};
    const personal = { pecho: 6, espalda: 6, hombros: 6, biceps: 6, triceps: 6,
      cuadriceps: 20, isquios: 20, gluteo: 20, pantorrillas: 20 };
    expect(pickByVolumeDeficit(['upper', 'lower'], vol, [], personal)).toBe('lower');
    expect(pickByVolumeDeficit(['upper', 'lower'], vol, [])).toBe('upper'); // plano → torso (más músculos)
  });

  it('pickByVolumeDeficit SIN target → cae al 14 plano (compat): torso lleno → elige pierna', () => {
    const vol = { pecho: 14, espalda: 14, hombros: 14, biceps: 14, triceps: 14 }; // upper al tope
    expect(pickByVolumeDeficit(['upper', 'lower'], vol, [])).toBe('lower');
  });
});
