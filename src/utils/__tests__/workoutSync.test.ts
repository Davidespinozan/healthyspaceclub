import { describe, it, expect } from 'vitest';
import {
  mapWorkoutLogRowToSession,
  mergeWorkoutSessions,
  type WorkoutLogRow,
} from '../workoutSync';
import type { CompletedSession } from '../../types';

function row(overrides: Partial<WorkoutLogRow> = {}): WorkoutLogRow {
  return {
    date_local: '2026-05-26',
    completed_at: '2026-05-26T14:30:00.000Z',
    modality: 'fuerza',
    duration_minutes: 45,
    exercises_completed: 3,
    exercises_total: 3,
    exercises: [],
    ...overrides,
  };
}

function session(overrides: Partial<CompletedSession> = {}): CompletedSession {
  return {
    date: '2026-05-26',
    completedAtIso: '2026-05-26T14:30:00.000Z',
    modality: 'fuerza',
    exerciseIds: [],
    durationSeconds: 2700,
    exercisesCompleted: 3,
    exercisesTotal: 3,
    ...overrides,
  };
}

describe('mapWorkoutLogRowToSession', () => {
  it('row con jsonb exercises completo → loggedSets aplanado en orden', () => {
    const r = row({
      exercises: [
        {
          exercise_id: 'squat',
          order: 0,
          planned: { sets: 3 },
          performed: { sets: [{ reps: 8, kg: 60 }, { reps: 8, kg: 60 }, { reps: 6, kg: 60 }] },
        },
        {
          exercise_id: 'bench',
          order: 1,
          planned: { sets: 2 },
          performed: { sets: [{ reps: 10, kg: 40 }, { reps: 10, kg: 40 }] },
        },
      ],
    });
    const s = mapWorkoutLogRowToSession(r);
    expect(s.exerciseIds).toEqual(['squat', 'bench']);
    expect(s.loggedSets).toEqual([
      { reps: 8, kg: 60 }, { reps: 8, kg: 60 }, { reps: 6, kg: 60 },
      { reps: 10, kg: 40 }, { reps: 10, kg: 40 },
    ]);
    expect(s.durationSeconds).toBe(2700);
  });

  it('row sin performed en ningún ejercicio (sesión sin tracking) → loggedSets undefined', () => {
    const r = row({
      exercises: [
        { exercise_id: 'squat', order: 0, planned: { sets: 3 } },
        { exercise_id: 'bench', order: 1, planned: { sets: 2 } },
      ],
    });
    const s = mapWorkoutLogRowToSession(r);
    expect(s.exerciseIds).toEqual(['squat', 'bench']);
    expect(s.loggedSets).toBeUndefined();
  });

  it('ejercicio skipped (performed.sets con nulls) → loggedSets con nulls', () => {
    const r = row({
      exercises: [
        {
          exercise_id: 'squat',
          order: 0,
          planned: { sets: 3 },
          performed: { sets: [{ reps: 8, kg: 60 }, null, null] },
        },
      ],
    });
    const s = mapWorkoutLogRowToSession(r);
    expect(s.loggedSets).toEqual([{ reps: 8, kg: 60 }, null, null]);
  });

  it('ejercicio con performed.sets más corto que planned.sets → padding con null', () => {
    const r = row({
      exercises: [
        {
          exercise_id: 'squat',
          order: 0,
          planned: { sets: 4 },
          performed: { sets: [{ reps: 8, kg: 60 }, { reps: 8, kg: 60 }] }, // solo 2 de 4
        },
      ],
    });
    const s = mapWorkoutLogRowToSession(r);
    expect(s.loggedSets).toEqual([
      { reps: 8, kg: 60 }, { reps: 8, kg: 60 }, null, null,
    ]);
  });

  it('mezcla: un ejercicio con performed, otro sin → solo agrega slots del primero', () => {
    const r = row({
      exercises: [
        {
          exercise_id: 'squat',
          order: 0,
          planned: { sets: 2 },
          performed: { sets: [{ reps: 8, kg: 60 }, { reps: 8, kg: 60 }] },
        },
        {
          exercise_id: 'bench',
          order: 1,
          planned: { sets: 3 },
          // sin performed → no agrega slots
        },
      ],
    });
    const s = mapWorkoutLogRowToSession(r);
    expect(s.exerciseIds).toEqual(['squat', 'bench']);
    expect(s.loggedSets).toEqual([{ reps: 8, kg: 60 }, { reps: 8, kg: 60 }]);
  });

  it('jsonb exercises malformado (no array) → exerciseIds vacío, loggedSets undefined', () => {
    const r = row({ exercises: null });
    const s = mapWorkoutLogRowToSession(r);
    expect(s.exerciseIds).toEqual([]);
    expect(s.loggedSets).toBeUndefined();
  });

  it('items malformados (sin exercise_id) → se filtran', () => {
    const r = row({
      exercises: [
        { exercise_id: 'squat', performed: { sets: [{ reps: 8, kg: 60 }] }, planned: { sets: 1 } },
        { foo: 'bar' }, // malformado
        { exercise_id: 'bench', performed: { sets: [{ reps: 10, kg: 40 }] }, planned: { sets: 1 } },
      ],
    });
    const s = mapWorkoutLogRowToSession(r);
    expect(s.exerciseIds).toEqual(['squat', 'bench']);
    expect(s.loggedSets).toEqual([{ reps: 8, kg: 60 }, { reps: 10, kg: 40 }]);
  });
});

describe('mergeWorkoutSessions', () => {
  const s1 = session({ completedAtIso: '2026-05-24T10:00:00.000Z' });
  const s2 = session({ completedAtIso: '2026-05-25T10:00:00.000Z' });
  const s3 = session({ completedAtIso: '2026-05-26T10:00:00.000Z' });

  it('local vacío + remote con 3 → merged 3, toPush 0', () => {
    const r = mergeWorkoutSessions([], [s1, s2, s3]);
    expect(r.merged).toHaveLength(3);
    expect(r.toPush).toEqual([]);
  });

  it('local 2 + remote vacío → merged 2, toPush 2 (backfill)', () => {
    const r = mergeWorkoutSessions([s1, s2], []);
    expect(r.merged).toHaveLength(2);
    expect(r.toPush).toEqual([s1, s2]);
  });

  it('overlap por completedAtIso → dedup (no duplica)', () => {
    const sLocal = session({ completedAtIso: s2.completedAtIso, durationSeconds: 9999 });
    const r = mergeWorkoutSessions([sLocal], [s1, s2]);
    expect(r.merged).toHaveLength(2);
    expect(r.toPush).toEqual([]);
    // remote ganó (es la "fuente más completa")
    const merged2 = r.merged.find(s => s.completedAtIso === s2.completedAtIso);
    expect(merged2?.durationSeconds).toBe(s2.durationSeconds);
  });

  it('sesiones distintas en local y remote → unión ordenada por timestamp', () => {
    const r = mergeWorkoutSessions([s1, s3], [s2]);
    expect(r.merged.map(s => s.completedAtIso)).toEqual([
      s1.completedAtIso, s2.completedAtIso, s3.completedAtIso,
    ]);
    expect(r.toPush).toHaveLength(2);
    expect(r.toPush.map(s => s.completedAtIso)).toContain(s1.completedAtIso);
    expect(r.toPush.map(s => s.completedAtIso)).toContain(s3.completedAtIso);
  });

  it('local más reciente que el último remote → push', () => {
    const r = mergeWorkoutSessions([s3], [s1, s2]);
    expect(r.merged.map(s => s.completedAtIso)).toEqual([
      s1.completedAtIso, s2.completedAtIso, s3.completedAtIso,
    ]);
    expect(r.toPush).toEqual([s3]);
  });

  it('ambos vacíos → merged vacío, toPush vacío', () => {
    const r = mergeWorkoutSessions([], []);
    expect(r.merged).toEqual([]);
    expect(r.toPush).toEqual([]);
  });

  it('sesión sin completedAtIso (defensivo) → se ignora', () => {
    const sBad = session({ completedAtIso: '' });
    const r = mergeWorkoutSessions([sBad, s1], [s2]);
    expect(r.merged).toHaveLength(2); // s1 + s2, sBad fuera
    expect(r.merged.map(s => s.completedAtIso)).toEqual([s1.completedAtIso, s2.completedAtIso]);
  });
});
