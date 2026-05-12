import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  finishWorkoutSession,
  parseRepsToNumber,
  groupLoggedSetsByExercise,
} from '../workoutLogger';

const insertMock = vi.fn((_payload: Record<string, unknown>) =>
  Promise.resolve({ error: null }),
);
const fromMock = vi.fn((_tableName: string) => ({ insert: insertMock }));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (tableName: string) => fromMock(tableName),
  },
}));

describe('finishWorkoutSession', () => {
  beforeEach(() => {
    fromMock.mockClear();
    insertMock.mockClear();
  });

  it('siempre llama addCompletedSession con el entry correcto', async () => {
    const mockAdd = vi.fn();
    await finishWorkoutSession(
      {
        userId: null,
        modality: 'fuerza',
        exercises: [
          { exercise_id: 'press-horizontal', order: 0, planned: { sets: 4, reps: '8-10' } },
          { exercise_id: 'remo-horizontal-pesado', order: 1, planned: { sets: 4, reps: '8-10' } },
        ],
        exercisesCompleted: 2,
        exercisesTotal: 2,
        durationSeconds: 1800,
        targetDurationSeconds: 2700,
        equipment: 'gym',
      },
      mockAdd,
    );
    expect(mockAdd).toHaveBeenCalledOnce();
    const session = mockAdd.mock.calls[0][0];
    expect(session.modality).toBe('fuerza');
    expect(session.exerciseIds).toEqual(['press-horizontal', 'remo-horizontal-pesado']);
    expect(session.durationSeconds).toBe(1800);
    expect(session.exercisesCompleted).toBe(2);
    expect(session.exercisesTotal).toBe(2);
    // date debe estar en formato YYYY-MM-DD
    expect(session.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // completedAtIso debe ser ISO string válida
    expect(new Date(session.completedAtIso).toString()).not.toBe('Invalid Date');
  });

  it('NO llama Supabase si userId es null (anon)', async () => {
    const mockAdd = vi.fn();
    await finishWorkoutSession(
      {
        userId: null,
        modality: 'yoga',
        exercises: [],
        exercisesCompleted: 0,
        exercisesTotal: 0,
        durationSeconds: 0,
        targetDurationSeconds: 0,
        equipment: 'cuerpo',
      },
      mockAdd,
    );
    expect(fromMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('llama Supabase si hay userId con shape correcto', async () => {
    const mockAdd = vi.fn();
    await finishWorkoutSession(
      {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        modality: 'cardio',
        exercises: [{ exercise_id: 'burpee-sprawl', order: 0 }],
        exercisesCompleted: 1,
        exercisesTotal: 1,
        durationSeconds: 600,
        targetDurationSeconds: 600,
        equipment: 'cuerpo',
        dayType: 'cardio',
      },
      mockAdd,
    );
    expect(fromMock).toHaveBeenCalledWith('workout_log');
    expect(insertMock).toHaveBeenCalledOnce();
    const inserted = insertMock.mock.calls[0][0];
    expect(inserted.user_id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(inserted.modality).toBe('cardio');
    expect(inserted.duration_minutes).toBe(10); // 600s / 60 = 10 min
    expect(inserted.target_duration_minutes).toBe(10);
    expect(inserted.equipment).toBe('cuerpo');
    expect(inserted.day_type).toBe('cardio');
    expect(inserted.exercises_completed).toBe(1);
    // date_local debe estar en formato YYYY-MM-DD (local timezone)
    expect(inserted.date_local).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('parseRepsToNumber', () => {
  it('parsea single number "10"', () => {
    expect(parseRepsToNumber('10')).toBe(10);
  });

  it('parsea rango "8-10" como el último número', () => {
    expect(parseRepsToNumber('8-10')).toBe(10);
  });

  it('parsea "12-15 por lado" como 15 (último número)', () => {
    expect(parseRepsToNumber('12-15 por lado')).toBe(15);
  });

  it('parsea "30 seg" como 30 (segundos como número trackeable)', () => {
    expect(parseRepsToNumber('30 seg')).toBe(30);
  });

  it('retorna 0 para vacío / undefined / sin números', () => {
    expect(parseRepsToNumber('')).toBe(0);
    expect(parseRepsToNumber(undefined)).toBe(0);
    expect(parseRepsToNumber('sin números')).toBe(0);
  });
});

describe('groupLoggedSetsByExercise', () => {
  it('agrupa sets planos en arrays por ejercicio según el plan', () => {
    const sets = [
      { reps: 10, kg: 60 },
      { reps: 9, kg: 60 },
      { reps: 8, kg: 60 },
      { reps: 12, kg: 0 },
      { reps: 12, kg: 0 },
    ];
    const exercises = [{ sets: 3 }, { sets: 2 }];
    const result = groupLoggedSetsByExercise(sets, exercises);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(3);
    expect(result[1]).toHaveLength(2);
    expect(result[0][0]).toEqual({ reps: 10, kg: 60 });
    expect(result[1][0]).toEqual({ reps: 12, kg: 0 });
  });

  it('preserva nulls como sets saltados sin descalzar la posición', () => {
    const sets = [
      { reps: 10, kg: 60 },
      null,
      null,
      { reps: 12, kg: 0 },
    ];
    const exercises = [{ sets: 3 }, { sets: 1 }];
    const result = groupLoggedSetsByExercise(sets, exercises);
    expect(result[0]).toEqual([{ reps: 10, kg: 60 }, null, null]);
    expect(result[1]).toEqual([{ reps: 12, kg: 0 }]);
  });
});
