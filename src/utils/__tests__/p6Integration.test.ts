import { describe, it, expect } from 'vitest';
import { prescribeLoad } from '../loadEngine';
import { computeReadiness, readinessToRecovery, chronicRecoveryTrend } from '../readiness';
import { deriveMesocycleState } from '../mesocycle';
import { resolvePriorities, applyMusclePriority } from '../musclePriority';
import { allocateSessionVolume } from '../sessionPrescription';
import { computeVolumeTargets, targetsToMap } from '../volumeLandmarks';

// BLOQUE 2 · el RIR corrige la carga por UN SOLO canal: la e1RM RIR-aware. No hay calibración
// aparte. El paso es ACOTADO (±1 incremento/sesión) → un RIR aislado no dispara la carga.
describe('BLOQUE 2 · carga RIR-aware, canal único, paso acotado', () => {
  const INC = 2.5;
  it('el RIR del set SÍ entra por la e1RM (antes lo ignoraba): fácil (RIR alto) → sube, no baja', () => {
    const sinRir = prescribeLoad([{ reps: 8, kg: 100 }], '8', 'equilibrio')!;
    const facil = prescribeLoad([{ reps: 8, kg: 100, rir: 4 }], '8', 'equilibrio')!;
    expect(facil.topKg).toBeGreaterThan(sinRir.topKg); // el RIR real informa la capacidad
  });
  it('un solo RIR (fácil o falso) NO dispara la carga: el rango del RIR (0-4) la acota a ~±5%', () => {
    const facil = prescribeLoad([{ reps: 8, kg: 100, rir: 4 }], '8', 'equilibrio')!;
    // RIR 4 vs objetivo 2 → +2 reps de reserva → ~+5% (auto-corrige cuando el peso queda a tono).
    expect(Math.abs(facil.topKg - 100)).toBeLessThanOrEqual(100 * 0.06 + INC);
    expect(facil.topKg).toBeGreaterThan(100); // sube (era demasiado fácil), no baja
    void INC;
  });
  it('NO decae: con RIR en el set, el peso de trabajo se sostiene (no cae sesión a sesión)', () => {
    // performed 100×8 @ RIR2, objetivo 8@RIR2 → capacidad implica ~100 → se sostiene (±1 inc).
    const p = prescribeLoad([{ reps: 8, kg: 100, rir: 2 }], '8', 'equilibrio')!;
    expect(p.topKg).toBeGreaterThanOrEqual(100 - INC);
    expect(p.topKg).toBeLessThanOrEqual(100 + INC);
  });
  it('BANDAS / peso corporal (sin kg) → null (progresión por dificultad/tensión, no kg)', () => {
    expect(prescribeLoad([{ reps: 15, kg: 0 }], '12', 'equilibrio')).toBeNull();
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
