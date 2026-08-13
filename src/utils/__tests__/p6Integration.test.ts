import { describe, it, expect } from 'vitest';
import { prescribeLoad } from '../loadEngine';
import { loadCalibration } from '../rirFeedback';
import { computeReadiness, readinessToRecovery, chronicRecoveryTrend } from '../readiness';
import { deriveMesocycleState } from '../mesocycle';
import { resolvePriorities, applyMusclePriority } from '../musclePriority';
import { allocateSessionVolume } from '../sessionPrescription';
import { computeVolumeTargets, targetsToMap } from '../volumeLandmarks';

describe('P6 · integración P2 — calibración de carga por RIR (sin saltos grandes)', () => {
  const last = [{ reps: 8, kg: 100 }];
  it('RIR muy cerca del fallo (real 0 vs prescrito 2) → baja la carga, pero POCO', () => {
    const cal = loadCalibration({ observations: Array.from({ length: 4 }, () => ({ prescribedRir: 2, actualRir: 0 })) });
    const base = prescribeLoad(last, '8', 'equilibrio', 2.5, 1)!;
    const calibrado = prescribeLoad(last, '8', 'equilibrio', 2.5, cal.factor)!;
    expect(calibrado.topKg).toBeLessThan(base.topKg);
    expect(base.topKg - calibrado.topKg).toBeLessThanOrEqual(base.topKg * 0.06); // ≤ ~6% (redondeo)
  });
  it('un solo RIR NO produce un salto grande de carga', () => {
    const cal = loadCalibration({ observations: [{ prescribedRir: 2, actualRir: 4 }] }); // 1 obs → confianza baja
    const base = prescribeLoad(last, '8', 'equilibrio', 2.5, 1)!;
    const calibrado = prescribeLoad(last, '8', 'equilibrio', 2.5, cal.factor)!;
    expect(Math.abs(calibrado.topKg - base.topKg)).toBeLessThanOrEqual(base.topKg * 0.03);
  });
  it('BANDAS / peso corporal (sin kg) → prescribeLoad null (fallback, no calibra carga)', () => {
    expect(prescribeLoad([{ reps: 15, kg: 0 }], '12', 'equilibrio', 2.5, 0.95)).toBeNull();
  });
  it('RIR corrige la carga por UN SOLO canal (calibración), no dos: prescribeLoad ignora el rir del set', () => {
    // El rir dentro del set NO altera prescribeLoad (evita doble conteo con la calibración).
    const sinRir = prescribeLoad([{ reps: 8, kg: 100 }], '8', 'equilibrio')!;
    const conRirEnSet = prescribeLoad([{ reps: 8, kg: 100, rir: 3 }], '8', 'equilibrio')!;
    expect(conRirEnSet.topKg).toBe(sinRir.topKg); // mismo: el RIR no entra por el e1RM
    // La corrección por RIR llega SOLO por el factor de calibración (canal único).
    const calibrado = prescribeLoad([{ reps: 8, kg: 100 }], '8', 'equilibrio', 2.5, 1.05)!;
    expect(calibrado.topKg).toBeGreaterThan(sinRir.topKg);
  });
});

describe('P6 · separación READINESS AGUDA vs CRÓNICA (un mal día no reescribe el plan)', () => {
  it('meso INTENSIFICACIÓN + readiness baja HOY: el mesociclo sigue en intensificación', () => {
    // Semana 4 con recuperación crónica buena → intensificación. Un día malo NO la cambia.
    const meso = deriveMesocycleState({ weeksAccumulated: 3, recovery: 'buena', adherence: 'alta', performance: 'sube' });
    expect(meso.phase).toBe('intensificacion');
    // readiness aguda baja → solo baja la dosis de HOY
    const today = computeReadiness({ energy: 'baja', sleep: 'malo' });
    expect(today.state).toBe('low');
    expect(readinessToRecovery(today.state)).toBe('mala');
    // …y el mesociclo (crónico) no se ve tocado por ese único día
    expect(chronicRecoveryTrend({ recentReadiness: ['low'], performance: 'sube' })).toBe('stable');
  });

  it('readiness baja HOY reduce la dosis de la sesión (allocateSessionVolume)', () => {
    const base = { weeklyTarget: { pecho: 12 }, doneThisWeek: {}, dayMuscles: ['pecho'], primaryMuscles: ['pecho'], freqTarget: 4, sessionsThisWeekDone: 0, muscleWeeklyFreq: { pecho: 2 } };
    const normal = allocateSessionVolume({ ...base, recovery: 'media' });
    const cansado = allocateSessionVolume({ ...base, recovery: readinessToRecovery('low') });
    expect(cansado.pecho).toBeLessThanOrEqual(normal.pecho);
  });

  it('FATIGA PERSISTENTE (crónica) → recovery mala → el mesociclo puede frenar/retroceder', () => {
    const chronic = chronicRecoveryTrend({ recentReadiness: ['low', 'low', 'low'], rirErrors: [-2, -2, -1] });
    expect(chronic).toBe('declining');
    // semana 2 del bloque (aún no toca deload): la recovery mala crónica → frena (retroceder).
    const meso = deriveMesocycleState({ weeksAccumulated: 1, recovery: 'mala', adherence: 'media', performance: 'baja' });
    expect(meso.progression).toBe('retroceder');
    // más avanzado en el bloque, la misma señal ADELANTA el deload (también válido).
    const mesoLate = deriveMesocycleState({ weeksAccumulated: 2, recovery: 'mala', adherence: 'media', performance: 'baja' });
    expect(mesoLate.deload).toBe(true);
  });
});

describe('P6 · integración P5 — prioridad + readiness baja', () => {
  it('la prioridad PERSISTE aunque hoy la readiness sea baja (solo baja de nivel, no se pierde)', () => {
    // deload/mala-recuperación bajan el nivel de prioridad, pero el músculo sigue priorizado.
    const p = resolvePriorities({ explicit: ['hombros'], recovery: 'mala' });
    expect(p.hombros).toBe('moderate'); // high→moderate por recuperación, NO desaparece
    const targets = computeVolumeTargets({ weeklyVolumes: [{ hombros: 12 }], level: 'intermedio', weeksOfHistory: 1 });
    const prioritized = applyMusclePriority(targets, p);
    expect(targetsToMap(prioritized).hombros).toBeGreaterThan(targetsToMap(targets).hombros);
  });
});
