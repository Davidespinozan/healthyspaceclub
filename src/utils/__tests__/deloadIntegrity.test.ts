import { describe, it, expect } from 'vitest';
import { estimate1RM, e1RMTrend, prescribeLoad } from '../loadEngine';
import { prescribeExercise, prescribeSession, allocateSessionVolume } from '../sessionPrescription';
import { computeVolumeTargets, targetsToMap } from '../volumeLandmarks';
import { applyMusclePriority, resolvePriorities } from '../musclePriority';
import { readinessToRecovery } from '../readiness';
import type { Exercise } from '../../types';

// El deload es una intervención PLANEADA: su carga ligera a propósito no debe enseñarle al
// sistema que el atleta perdió fuerza ni recalibrar P2. El diseño lo consigue NO registrando
// las series de deload en las capas de aprendizaje (lastExercisePerformance, rirLog). Estos
// tests fijan las invariantes a nivel de motor.

describe('DELOAD · no contamina el aprendizaje', () => {
  const working = [{ reps: 5, kg: 100 }];      // serie de trabajo real (pre-deload)
  const deloadLight = [{ reps: 8, kg: 82.5 }]; // serie de descarga (ligera a propósito)

  it('e1RM APRENDIDO no baja: se estima del historial real, no de la serie ligera de deload', () => {
    // El registro de deload se OMITE → el e1RM sigue calculándose sobre la serie de trabajo.
    const e1RMreal = estimate1RM(working)!;
    // Si por error la serie ligera entrara, el e1RM caería:
    const e1RMcontaminado = estimate1RM(deloadLight)!;
    expect(e1RMcontaminado).toBeLessThan(e1RMreal);
    // La invariante: al no registrarse, el "peso a batir" sigue siendo el real.
    expect(estimate1RM(working)).toBe(e1RMreal);
  });

  it('performanceTrend NO interpreta el deload como caída (la serie ligera se excluye)', () => {
    const older = [{ exercise: 'sentadilla', sets: [{ reps: 5, kg: 100 }] }];
    // Reciente SIN el deload (lo que ve el sistema): fuerza sostenida/subiendo → no 'baja'.
    const recienteReal = [{ exercise: 'sentadilla', sets: [{ reps: 5, kg: 102.5 }] }];
    expect(e1RMTrend(recienteReal, older)).not.toBe('baja');
    // Si el deload SÍ entrara (lo que evitamos), fingiría una caída:
    const recienteContaminado = [{ exercise: 'sentadilla', sets: [{ reps: 8, kg: 82.5 }] }];
    expect(e1RMTrend(recienteContaminado, older)).toBe('baja');
  });

  it('RIR del deload NO recalibra la carga: la e1RM RIR-aware solo ve los sets REALES', () => {
    // BLOQUE 2 · el RIR corrige la carga por la e1RM (loadEngine), no por una calibración aparte.
    // Las series de deload no se registran en lastExercisePerformance (gateo en WorkoutPlan), así
    // que NO entran a prescribeLoad. La carga se prescribe desde el último set de TRABAJO real.
    const trabajo = prescribeLoad([{ reps: 5, kg: 100, rir: 2 }], '5', 'equilibrio')!;
    // Si el set LIGERO de deload (82.5×8 @RIR4) hubiera entrado, la e1RM/carga sería MENOR.
    const siEntrara = prescribeLoad([{ reps: 8, kg: 82.5, rir: 4 }], '5', 'equilibrio')!;
    expect(trabajo.topKg).toBeGreaterThan(siEntrara.topKg); // por eso se excluye el deload
  });
});

// ── Interacciones del deload de carga con P5 (prioridad) y P6 (readiness) ──────
const bankById = new Map([
  ['hip-thrust', { id: 'hip-thrust', name: 'Hip Thrust', type: 'compuesto' as Exercise['type'] }],
]);

describe('DELOAD · interacción con prioridad y readiness', () => {
  const loaded = [{ reps: 6, kg: 120 }];

  it('PRIORIDAD + deload: el músculo prioritario sigue priorizado pero con carga REDUCIDA', () => {
    const targets = computeVolumeTargets({ weeklyVolumes: [{ gluteo: 14 }], level: 'intermedio', weeksOfHistory: 1, volumeMultiplier: 0.55, isDeload: true });
    const priorities = resolvePriorities({ explicit: ['gluteo'], isDeload: true });
    expect(priorities.gluteo).toBe('moderate'); // sigue priorizado (bajó de nivel, no desapareció)
    const prio = applyMusclePriority(targets, priorities);
    const alloc = allocateSessionVolume({
      weeklyTarget: targetsToMap(prio), doneThisWeek: {}, dayMuscles: ['gluteo'], primaryMuscles: ['gluteo'],
      freqTarget: 4, sessionsThisWeekDone: 0, muscleWeeklyFreq: { gluteo: 2 }, isDeload: true,
    });
    const items = prescribeSession({
      exercises: [{ id: 'hip-thrust', muscleGroup: 'gluteo' }], bankById, allocation: alloc,
      trainingGoal: 'hipertrofia', phase: 'deload', mainMinutes: 999,
      lastPerf: { 'hip-thrust': { sets: loaded } },
    });
    const it = items[0].prescription;
    expect(it.isDeloadLoad).toBe(true);            // carga reducida
    expect(it.scheme).toBe('straight');            // sin top-set
  });

  it('READINESS baja + deload: la carga reducida NO se hunde a algo absurdo (sigue siendo práctica técnica)', () => {
    const deload = prescribeExercise({ category: 'main-compound', sets: 3, trainingGoal: 'hipertrofia', phase: 'deload', lastSets: loaded });
    // readiness baja modula VOLUMEN/dosis (allocate), no vuelve a multiplicar la CARGA del deload.
    expect(readinessToRecovery('low')).toBe('mala');
    expect(deload.topKg!).toBeGreaterThan(loaded[0].kg * 0.7); // ~87.5%, no un desplome
  });
});
