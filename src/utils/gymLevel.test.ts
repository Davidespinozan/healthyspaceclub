import { describe, it, expect, vi } from 'vitest';
import type { Exercise } from '../types';

// Este test aísla el filtro por NIVEL. El gate only-video (VIDEO_VARIANT_IDS) es
// ortogonal aquí: mockeamos que las variantes mock SÍ tienen clip para no cruzar
// ambas reglas. La cobertura real del gate de video vive en su propio test.
vi.mock('../data/videoAvailability', () => ({
  VIDEO_VARIANT_IDS: new Set(['facil-v', 'medio-v', 'duro-v']),
}));

import { levelFromActivity, levelFromObData, filterExercisesForWorkout, orderByChallenge } from './workoutPlanner';

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

  describe('orderByChallenge — reta al nivel sin carga externa', () => {
    // Ejercicios cuya variante de peso corporal tiene distinta dificultad.
    const bw = (id: string, difficulty: string): Exercise => ({
      id, name: id, muscleGroup: 'gluteo', secondaryMuscles: [], goals: ['hipertrofia'],
      type: 'compuesto', difficulty,
      variants: [{ id: id + '-v', name: id, equipment: ['cuerpo'], difficulty }],
    } as unknown as Exercise);
    const pool = [bw('hipthrust', 'principiante'), bw('desplante', 'intermedio'), bw('pistol', 'avanzado')];

    it('avanzado + peso corporal: el más DURO primero (pistol/desplante sobre hipthrust)', () => {
      const out = orderByChallenge(pool, 'avanzado', ['cuerpo']).map(e => e.id);
      expect(out[0]).toBe('pistol');
      expect(out.indexOf('desplante')).toBeLessThan(out.indexOf('hipthrust'));
    });

    it('principiante + peso corporal: prioriza lo básico (hipthrust antes que pistol)', () => {
      const out = orderByChallenge(pool, 'principiante', ['cuerpo']).map(e => e.id);
      expect(out.indexOf('hipthrust')).toBeLessThan(out.indexOf('pistol'));
    });

    it('con GYM no reordena (la carga da el estímulo)', () => {
      const out = orderByChallenge(pool, 'avanzado', ['gym']).map(e => e.id);
      expect(out).toEqual(['hipthrust', 'desplante', 'pistol']); // orden original
    });
  });
});
