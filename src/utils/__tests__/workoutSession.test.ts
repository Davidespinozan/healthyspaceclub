import { describe, it, expect } from 'vitest';
import {
  startPosFor,
  prefilledKgForCurrent,
  markSet,
  editSetAt,
  padForNextExercise,
  padToTotal,
  computeExercisesCompleted,
  computeSessionStats,
  buildOnCompletePayload,
  parseResumeState,
  type WorkoutExercise,
} from '../workoutSession';
import type { LoggedSet } from '../../types';

// Fixtures
const ex = (id: string, sets: number, reps = '8-10', rest = 90): WorkoutExercise => ({
  id, sets, reps, rest,
});

const PLAN_3x3 = [ex('a', 3), ex('b', 3), ex('c', 3)]; // 9 sets totales
const PLAN_MIXED = [ex('a', 4), ex('b', 2), ex('c', 3)]; // 9 sets totales
const set = (reps: number, kg: number): LoggedSet => ({ reps, kg });

// ════════════════════════════════════════════════════════════════
// startPosFor
// ════════════════════════════════════════════════════════════════

describe('startPosFor', () => {
  it('ejercicio 0 arranca en 0', () => {
    expect(startPosFor(0, PLAN_3x3)).toBe(0);
  });

  it('ejercicio N suma sets de ejercicios anteriores (sets variables)', () => {
    expect(startPosFor(0, PLAN_MIXED)).toBe(0);
    expect(startPosFor(1, PLAN_MIXED)).toBe(4); // ex a tiene 4 sets
    expect(startPosFor(2, PLAN_MIXED)).toBe(6); // ex a(4) + ex b(2)
    expect(startPosFor(3, PLAN_MIXED)).toBe(9); // suma total
  });
});

// ════════════════════════════════════════════════════════════════
// prefilledKgForCurrent
// ════════════════════════════════════════════════════════════════

describe('prefilledKgForCurrent', () => {
  it('devuelve 0 si no hay sets previos en la franja', () => {
    expect(prefilledKgForCurrent([], 0)).toBe(0);
    expect(prefilledKgForCurrent([null, null], 0)).toBe(0);
  });

  it('devuelve kg del último set non-null del ejercicio actual', () => {
    const sets = [set(10, 20), set(10, 22.5), set(10, 25)];
    expect(prefilledKgForCurrent(sets, 0)).toBe(25);
  });

  it('respeta el offset (no mira sets de ejercicios anteriores)', () => {
    // ej 0: 2 sets @ 50kg; ej 1: 1 set @ 10kg
    const sets = [set(8, 50), set(8, 50), set(12, 10)];
    expect(prefilledKgForCurrent(sets, 2)).toBe(10); // solo el del ej actual
  });

  it('salta nulls hacia atrás hasta encontrar un set non-null', () => {
    const sets: Array<LoggedSet | null> = [set(10, 30), null, null];
    expect(prefilledKgForCurrent(sets, 0)).toBe(30);
  });
});

// ════════════════════════════════════════════════════════════════
// markSet
// ════════════════════════════════════════════════════════════════

describe('markSet', () => {
  it('marca el próximo set con reps del rango y kg pre-fill', () => {
    const { newLoggedSets, restSeconds } = markSet([], 0, PLAN_3x3);
    expect(newLoggedSets).toHaveLength(1);
    expect(newLoggedSets[0]).toEqual({ reps: 10, kg: 0 }); // "8-10" → 10
    expect(restSeconds).toBe(90); // no es última, arranca rest
  });

  it('pre-fill kg desde último set non-null del ejercicio actual', () => {
    const prev = [set(10, 22.5)];
    const { newLoggedSets } = markSet(prev, 0, PLAN_3x3);
    expect(newLoggedSets[1]).toEqual({ reps: 10, kg: 22.5 });
  });

  it('última serie del ejercicio → restSeconds null (no arranca rest)', () => {
    // 3 sets del ej 0 ya marcados → la próxima es la última de ese ejercicio... espera
    // ex 0 tiene 3 sets. Si pongo 2 sets → markSet marca el 3ro (último). restSeconds = null.
    const prev = [set(10, 20), set(10, 20)];
    const { restSeconds } = markSet(prev, 0, PLAN_3x3);
    expect(restSeconds).toBeNull();
  });

  it('no marca más allá del límite del ejercicio (no-op si ya completo)', () => {
    const prev = [set(10, 20), set(10, 20), set(10, 20)]; // ya 3/3 en ej 0
    const result = markSet(prev, 0, PLAN_3x3);
    expect(result.newLoggedSets).toEqual(prev); // sin cambios
    expect(result.restSeconds).toBeNull();
  });

  it('no muta el array original (inmutabilidad)', () => {
    const prev = [set(10, 20)];
    const { newLoggedSets } = markSet(prev, 0, PLAN_3x3);
    expect(prev).toHaveLength(1); // sin cambios
    expect(newLoggedSets).not.toBe(prev); // referencia distinta
  });
});

// ════════════════════════════════════════════════════════════════
// editSetAt
// ════════════════════════════════════════════════════════════════

describe('editSetAt', () => {
  it('actualiza solo la posición plana correcta, deja el resto intacto', () => {
    const sets = [set(10, 20), set(10, 22), set(10, 25), set(8, 30)];
    const result = editSetAt(sets, 0, 1, PLAN_3x3, { reps: 12, kg: 24 });
    expect(result[0]).toEqual({ reps: 10, kg: 20 });
    expect(result[1]).toEqual({ reps: 12, kg: 24 }); // editado
    expect(result[2]).toEqual({ reps: 10, kg: 25 });
    expect(result[3]).toEqual({ reps: 8, kg: 30 });
  });

  it('calcula flatIdx correcto con sets variables por ejercicio', () => {
    // PLAN_MIXED: ex a=4 sets, ex b=2, ex c=3
    // Editar ej 2 set 1 → flatIdx = 4+2+1 = 7
    const sets: Array<LoggedSet | null> = Array.from({ length: 8 }, (_, i) => set(10, i));
    const result = editSetAt(sets, 2, 1, PLAN_MIXED, { reps: 99, kg: 99 });
    expect(result[7]).toEqual({ reps: 99, kg: 99 });
    expect(result[6]).toEqual({ reps: 10, kg: 6 }); // no tocado
  });

  it('no edita si el set aún no se registró (flatIdx fuera del array)', () => {
    const sets = [set(10, 20)];
    const result = editSetAt(sets, 1, 0, PLAN_3x3, { reps: 99, kg: 99 });
    expect(result).toEqual(sets); // sin cambios
  });

  it('clamps reps/kg a >= 0 (defensive)', () => {
    const sets = [set(10, 20)];
    const result = editSetAt(sets, 0, 0, PLAN_3x3, { reps: -5, kg: -10 });
    expect(result[0]).toEqual({ reps: 0, kg: 0 });
  });

  it('no muta el array original', () => {
    const sets = [set(10, 20)];
    const result = editSetAt(sets, 0, 0, PLAN_3x3, { reps: 12, kg: 25 });
    expect(sets[0]).toEqual({ reps: 10, kg: 20 });
    expect(result).not.toBe(sets);
  });
});

// ════════════════════════════════════════════════════════════════
// padForNextExercise
// ════════════════════════════════════════════════════════════════

describe('padForNextExercise', () => {
  it('si todos los sets del ej actual están marcados, no padda', () => {
    const sets = [set(10, 20), set(10, 20), set(10, 20)]; // ej 0 completo
    const result = padForNextExercise(sets, 0, PLAN_3x3);
    expect(result).toEqual(sets);
    expect(result.length).toBe(3);
  });

  it('si quedan sets sin marcar, pushea nulls preservando shape', () => {
    const sets = [set(10, 20)]; // solo 1/3 marcado en ej 0
    const result = padForNextExercise(sets, 0, PLAN_3x3);
    expect(result).toHaveLength(3); // startPos(0) + sets(3)
    expect(result[0]).toEqual({ reps: 10, kg: 20 });
    expect(result[1]).toBeNull();
    expect(result[2]).toBeNull();
  });

  it('longitud post-pad = Σ exercises[0..currentExerciseIndex].sets', () => {
    // Mixed: ej 0 = 4 sets. Marcar 2, pad debe llegar a 4.
    const sets = [set(8, 50), set(8, 50)];
    const result = padForNextExercise(sets, 0, PLAN_MIXED);
    expect(result.length).toBe(4);
  });
});

// ════════════════════════════════════════════════════════════════
// padToTotal
// ════════════════════════════════════════════════════════════════

describe('padToTotal', () => {
  it('extiende array corto hasta Σ exercises[i].sets con nulls', () => {
    const sets = [set(10, 20), set(10, 20)]; // 2 de 9 esperados
    const result = padToTotal(sets, PLAN_3x3);
    expect(result.length).toBe(9);
    expect(result.slice(2).every(s => s === null)).toBe(true);
  });

  it('idempotente: si ya está al total, devuelve sin cambios', () => {
    const sets: Array<LoggedSet | null> = Array.from({ length: 9 }, (_, i) =>
      i < 6 ? set(10, 20) : null,
    );
    const result = padToTotal(sets, PLAN_3x3);
    expect(result).toEqual(sets);
    expect(result.length).toBe(9);
  });

  it('si ya excede el total, no recorta (defensive)', () => {
    const sets: Array<LoggedSet | null> = Array.from({ length: 11 }, () => set(10, 20));
    const result = padToTotal(sets, PLAN_3x3);
    expect(result.length).toBe(11);
  });
});

// ════════════════════════════════════════════════════════════════
// computeExercisesCompleted
// ════════════════════════════════════════════════════════════════

describe('computeExercisesCompleted', () => {
  it('cuenta 0 si no hay ningún set marcado', () => {
    expect(computeExercisesCompleted([], PLAN_3x3)).toBe(0);
  });

  it('cuenta un ejercicio con al menos 1 set non-null como completado', () => {
    const sets = [set(10, 20), null, null]; // ej 0: 1/3, ej 1/2: 0
    expect(computeExercisesCompleted(sets, PLAN_3x3)).toBe(1);
  });

  it('NO cuenta ejercicio con todos los sets skipped (null)', () => {
    const sets: Array<LoggedSet | null> = [null, null, null]; // ej 0 completo skipped
    expect(computeExercisesCompleted(sets, PLAN_3x3)).toBe(0);
  });

  it('cuenta correctamente con sets variables', () => {
    // PLAN_MIXED: ej 0=4, ej 1=2, ej 2=3
    // ej 0: 2 set marcados + 2 null → counts
    // ej 1: 2 nulls → no counts
    // ej 2: 1 set marcado + 2 nulls → counts
    const sets: Array<LoggedSet | null> = [
      set(10, 20), set(10, 20), null, null, // ej 0
      null, null,                            // ej 1
      set(8, 50), null, null,                // ej 2
    ];
    expect(computeExercisesCompleted(sets, PLAN_MIXED)).toBe(2);
  });
});

// ════════════════════════════════════════════════════════════════
// computeSessionStats
// ════════════════════════════════════════════════════════════════

describe('computeSessionStats', () => {
  it('totalSetsCompleted = count de non-null', () => {
    const sets: Array<LoggedSet | null> = [set(10, 20), null, set(10, 25)];
    const stats = computeSessionStats(sets, 0, 0, PLAN_3x3);
    expect(stats.totalSetsCompleted).toBe(2);
  });

  it('totalKg = suma de kg de todos los sets non-null', () => {
    const sets: Array<LoggedSet | null> = [set(10, 20), set(8, 25), null, set(8, 30)];
    const stats = computeSessionStats(sets, 0, 0, PLAN_3x3);
    expect(stats.totalKg).toBe(75); // 20 + 25 + 30
  });

  it('durationSeconds calcula desde startedAt hasta now en segundos redondeados', () => {
    const startedAt = 1_000_000;
    const now = 1_000_000 + 1830 * 1000; // 30:30
    const stats = computeSessionStats([], startedAt, now, PLAN_3x3);
    expect(stats.durationSeconds).toBe(1830);
    expect(stats.minutes).toBe(31); // round(1830/60) = 31
  });

  it('si startedAt <= 0, duration y minutes son 0 (sesión no iniciada)', () => {
    const stats = computeSessionStats([], 0, Date.now(), PLAN_3x3);
    expect(stats.durationSeconds).toBe(0);
    expect(stats.minutes).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════
// buildOnCompletePayload — CONTRATO DOWNSTREAM CRÍTICO
// ════════════════════════════════════════════════════════════════

describe('buildOnCompletePayload', () => {
  it('emite shape exacto con las 4 keys del contrato', () => {
    const payload = buildOnCompletePayload([], 0, 0, PLAN_3x3);
    expect(Object.keys(payload).sort()).toEqual([
      'durationSeconds',
      'exercisesCompleted',
      'loggedSets',
      'totalSetsCompleted',
    ]);
  });

  it('loggedSets.length === Σ exercises[i].sets (padding aplicado)', () => {
    const partial = [set(10, 20), set(10, 22)]; // 2 de 9
    const payload = buildOnCompletePayload(partial, 0, 0, PLAN_3x3);
    expect(payload.loggedSets.length).toBe(9);
  });

  it('preserva sets non-null + completa con nulls al final', () => {
    const partial = [set(10, 20), set(10, 22.5)];
    const payload = buildOnCompletePayload(partial, 0, 0, PLAN_3x3);
    expect(payload.loggedSets[0]).toEqual({ reps: 10, kg: 20 });
    expect(payload.loggedSets[1]).toEqual({ reps: 10, kg: 22.5 });
    expect(payload.loggedSets.slice(2).every(s => s === null)).toBe(true);
  });

  it('totalSetsCompleted = sets non-null en el payload final', () => {
    const partial: Array<LoggedSet | null> = [set(10, 20), null, set(10, 25)];
    const payload = buildOnCompletePayload(partial, 0, 0, PLAN_3x3);
    expect(payload.totalSetsCompleted).toBe(2);
  });

  it('exercisesCompleted = ejercicios con al menos 1 set non-null en el payload final', () => {
    const partial: Array<LoggedSet | null> = [
      set(10, 20), set(10, 22), set(10, 25), // ej 0 completo
      null, null, null,                      // ej 1 skipped
      // ej 2 vacío (será paddeado a null × 3)
    ];
    const payload = buildOnCompletePayload(partial, 0, 0, PLAN_3x3);
    expect(payload.exercisesCompleted).toBe(1);
  });

  it('durationSeconds calculado desde startedAt → now', () => {
    const startedAt = 1_700_000_000_000;
    const now = startedAt + 25 * 60 * 1000; // 25 min
    const payload = buildOnCompletePayload([], startedAt, now, PLAN_3x3);
    expect(payload.durationSeconds).toBe(1500);
  });
});

// ════════════════════════════════════════════════════════════════
// parseResumeState
// ════════════════════════════════════════════════════════════════

describe('parseResumeState', () => {
  const today = '2026-05-22';
  const planHash = 'a,b,c';
  const validPayload = JSON.stringify({
    workoutDate: today,
    planHash,
    currentExerciseIndex: 1,
    currentSet: 2,
    startedAt: 1_700_000_000_000,
    loggedSets: [set(10, 20), set(10, 22.5), set(10, 25)],
  });

  it('hidrata correctamente con payload válido', () => {
    const result = parseResumeState(validPayload, planHash, today, 3);
    expect(result).not.toBeNull();
    expect(result?.currentExerciseIndex).toBe(1);
    expect(result?.startedAt).toBe(1_700_000_000_000);
    expect(result?.loggedSets).toHaveLength(3);
  });

  it('devuelve null si no hay rawJson', () => {
    expect(parseResumeState(null, planHash, today, 3)).toBeNull();
    expect(parseResumeState(undefined, planHash, today, 3)).toBeNull();
    expect(parseResumeState('', planHash, today, 3)).toBeNull();
  });

  it('devuelve null si JSON corrupto (no crashea)', () => {
    expect(parseResumeState('{not valid json', planHash, today, 3)).toBeNull();
    expect(parseResumeState('null', planHash, today, 3)).toBeNull();
    expect(parseResumeState('"string"', planHash, today, 3)).toBeNull();
  });

  it('devuelve null si workoutDate es de otro día', () => {
    const otherDay = JSON.stringify({
      workoutDate: '2026-05-21',
      planHash,
      currentExerciseIndex: 1,
      startedAt: 1_700_000_000_000,
      loggedSets: [],
    });
    expect(parseResumeState(otherDay, planHash, today, 3)).toBeNull();
  });

  it('devuelve null si planHash no coincide (plan distinto)', () => {
    const otherPlan = JSON.stringify({
      workoutDate: today,
      planHash: 'x,y,z',
      currentExerciseIndex: 1,
      startedAt: 1_700_000_000_000,
      loggedSets: [],
    });
    expect(parseResumeState(otherPlan, planHash, today, 3)).toBeNull();
  });

  it('devuelve null si currentExerciseIndex es 0 (recién empezado, no se ofrece resume)', () => {
    const justStarted = JSON.stringify({
      workoutDate: today,
      planHash,
      currentExerciseIndex: 0,
      startedAt: 1_700_000_000_000,
      loggedSets: [],
    });
    expect(parseResumeState(justStarted, planHash, today, 3)).toBeNull();
  });

  it('devuelve null si currentExerciseIndex >= totalExercises (ya terminó)', () => {
    const finished = JSON.stringify({
      workoutDate: today,
      planHash,
      currentExerciseIndex: 3,
      startedAt: 1_700_000_000_000,
      loggedSets: [],
    });
    expect(parseResumeState(finished, planHash, today, 3)).toBeNull();
  });

  it('fallback seguros: startedAt → 0, loggedSets → [] si vienen malformed', () => {
    const malformed = JSON.stringify({
      workoutDate: today,
      planHash,
      currentExerciseIndex: 1,
      startedAt: 'not a number',
      loggedSets: 'not an array',
    });
    const result = parseResumeState(malformed, planHash, today, 3);
    expect(result).not.toBeNull();
    expect(result?.startedAt).toBe(0);
    expect(result?.loggedSets).toEqual([]);
  });
});
