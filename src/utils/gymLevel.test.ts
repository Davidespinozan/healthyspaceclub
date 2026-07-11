import { describe, it, expect } from 'vitest';
import { levelFromActivity, levelFromObData, filterExercisesForWorkout } from './workoutPlanner';
import type { Exercise } from '../types';

describe('nivel del usuario', () => {
  it('deriva nivel del factor de actividad', () => {
    expect(levelFromActivity('Sedentaria')).toBe('principiante');
    expect(levelFromActivity('Ligera')).toBe('principiante');
    expect(levelFromActivity('Moderada')).toBe('intermedio');
    expect(levelFromActivity('Alta')).toBe('avanzado');
    expect(levelFromActivity('Atleta')).toBe('avanzado');
  });

  it('nivel explícito (obData.nivel) gana sobre la derivación', () => {
    expect(levelFromObData({ nivel: 'avanzado', activity: 'Sedentaria' })).toBe('avanzado');
    expect(levelFromObData({ activity: 'Atleta' })).toBe('avanzado');
    expect(levelFromObData({})).toBe('intermedio');
  });

  it('principiante NO recibe ejercicios avanzados; intermedio/avanzado sí', () => {
    const mk = (id: string, difficulty: string): Exercise => ({
      id, name: id, muscleGroup: 'pecho', secondaryMuscles: [], goals: ['hipertrofia'],
      type: 'compuesto', difficulty, variants: [{ id: id + '-v', name: id, equipment: ['gym'], difficulty }],
    } as unknown as Exercise);
    const bank = [mk('facil', 'principiante'), mk('medio', 'intermedio'), mk('duro', 'avanzado')];
    const base = { exercises: bank, equipment: ['gym'] as any, muscleGroups: ['pecho'] as any, goal: 'hipertrofia' as any };

    const princ = filterExercisesForWorkout({ ...base, difficulty: 'principiante' }).map((e) => e.id);
    expect(princ).toEqual(['facil', 'medio']);      // sin 'duro'
    const avz = filterExercisesForWorkout({ ...base, difficulty: 'avanzado' }).map((e) => e.id);
    expect(avz).toEqual(['facil', 'medio', 'duro']); // todo
  });
});
