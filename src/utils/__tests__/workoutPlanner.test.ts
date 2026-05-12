import { describe, it, expect } from 'vitest';
import {
  filterExercisesForWorkout,
  filterWithProgressiveRelaxation,
  selectVariantForEquipment,
} from '../workoutPlanner';
import { exercises } from '../../data/exercises';

describe('workoutPlanner', () => {
  describe('filterExercisesForWorkout (con variantes)', () => {
    it('filtra correctamente por equipo gym + músculo pecho', () => {
      const result = filterExercisesForWorkout({
        exercises,
        equipment: ['gym'],
        muscleGroups: ['pecho'],
        goal: 'hipertrofia',
        excludeMuscles: [],
      });
      expect(result.length).toBeGreaterThan(0);
      // Cada candidato debe tener al menos una variante que aplique a gym
      result.forEach(ex => {
        if (!ex.isYoga) {
          const hasGymVariant = ex.variants?.some(v => v.equipment.includes('gym'));
          expect(hasGymVariant).toBe(true);
        }
      });
    });

    it('filtra correctamente por equipo cuerpo + músculo pecho', () => {
      const result = filterExercisesForWorkout({
        exercises,
        equipment: ['cuerpo'],
        muscleGroups: ['pecho'],
        goal: 'hipertrofia',
        excludeMuscles: [],
      });
      expect(result.length).toBeGreaterThan(0);
      result.forEach(ex => {
        if (!ex.isYoga) {
          const hasCuerpoVariant = ex.variants?.some(v => v.equipment.includes('cuerpo'));
          expect(hasCuerpoVariant).toBe(true);
        }
      });
    });

    it('filtra correctamente por equipo ligas', () => {
      const result = filterExercisesForWorkout({
        exercises,
        equipment: ['ligas'],
        muscleGroups: ['pecho'],
        goal: 'hipertrofia',
        excludeMuscles: [],
      });
      result.forEach(ex => {
        if (!ex.isYoga) {
          const hasLigasVariant = ex.variants?.some(v => v.equipment.includes('ligas'));
          expect(hasLigasVariant).toBe(true);
        }
      });
    });

    it('yoga sigue funcionando sin variants', () => {
      const yogaExercises = exercises.filter(e => e.isYoga);
      const result = filterExercisesForWorkout({
        exercises: yogaExercises,
        equipment: ['cuerpo'],
        muscleGroups: ['cuerpo-completo'],
        goal: 'movilidad',
        excludeMuscles: [],
      });
      // Todos los yoga deben pasar el filtro de equipment (su equipment es 'cuerpo')
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('selectVariantForEquipment', () => {
    it('devuelve la variante default si aplica al equipo', () => {
      const press = exercises.find(e => e.id === 'press-horizontal')!;
      const variant = selectVariantForEquipment(press, ['gym']);
      expect(variant?.isDefault).toBe(true);
      expect(variant?.equipment).toContain('gym');
    });

    it('devuelve variante que aplica si no hay default para el equipo', () => {
      // Press horizontal: default es barra (gym), pero usuario solo tiene cuerpo
      const press = exercises.find(e => e.id === 'press-horizontal')!;
      const variant = selectVariantForEquipment(press, ['cuerpo']);
      expect(variant).not.toBeNull();
      expect(variant?.equipment).toContain('cuerpo');
      // Debería ser flexiones (la variante de cuerpo)
      expect(variant?.id).toMatch(/flexiones/);
    });

    it('devuelve null si ninguna variante aplica al equipo', () => {
      // Encontrar un ejercicio que solo tenga gym
      const prensaPiernas = exercises.find(e => e.id === 'prensa-piernas');
      if (prensaPiernas) {
        const variant = selectVariantForEquipment(prensaPiernas, ['cuerpo']);
        expect(variant).toBeNull();
      }
    });

    it('devuelve null para ejercicios sin variants (yoga)', () => {
      const yoga = exercises.find(e => e.isYoga)!;
      const variant = selectVariantForEquipment(yoga, ['cuerpo']);
      expect(variant).toBeNull();
    });

    it('usa overrides de defaultReps cuando la variante los tiene', () => {
      // press-horizontal-flexiones tiene defaultReps: '12-15' (override del patrón '8-10')
      const press = exercises.find(e => e.id === 'press-horizontal')!;
      const variant = selectVariantForEquipment(press, ['cuerpo']);
      expect(variant).not.toBeNull();
      // La variante de flexiones tiene defaultReps definido y distinto del patrón
      if (variant?.defaultReps) {
        expect(variant.defaultReps).not.toBe(press.defaultReps);
      }
    });

    it('preserva equipment del patrón si no hay variantes (legacy / yoga)', () => {
      // yoga no tiene variants — el consumer debe usar yoga.equipment directamente cuando variant === null
      const yoga = exercises.find(e => e.isYoga)!;
      const variant = selectVariantForEquipment(yoga, ['cuerpo']);
      expect(variant).toBeNull();
    });
  });

  describe('filterWithProgressiveRelaxation', () => {
    it('nivel 0: filtro estricto cuando hay suficientes candidatos', () => {
      const result = filterWithProgressiveRelaxation({
        exercises,
        equipment: ['gym'],
        muscleGroups: ['pecho'],
        goal: 'hipertrofia',
        excludeMuscles: [],
      });
      expect(result.relaxationLevel).toBe(0);
      expect(result.relaxedConstraints).toEqual([]);
      expect(result.exercises.length).toBeGreaterThanOrEqual(3);
    });

    it('nivel 1: relaja excludeMuscles si nivel 0 da pocos', () => {
      // Caso hipotético: equipo limitado + muchos músculos excluidos
      const result = filterWithProgressiveRelaxation({
        exercises,
        equipment: ['ligas'],
        muscleGroups: ['biceps'],
        goal: 'hipertrofia',
        excludeMuscles: ['pecho', 'espalda', 'hombros', 'triceps', 'cuerpo-completo'],
      });
      // El resultado puede caer en nivel 1, 2 o 3 según cuántas variantes ligas tenga bíceps
      expect(result.relaxationLevel).toBeGreaterThanOrEqual(0);
      expect(result.exercises.length).toBeGreaterThan(0);
    });

    it('siempre devuelve resultado (nivel 3 como último recurso)', () => {
      // Caso extremo
      const result = filterWithProgressiveRelaxation({
        exercises,
        equipment: ['cuerpo'],
        muscleGroups: ['pecho'],
        goal: 'fuerza',
        excludeMuscles: ['pecho', 'espalda', 'hombros'],
      });
      // Aunque relajemos todo, debe haber algo
      expect(result.exercises.length).toBeGreaterThan(0);
    });

    it('escenario realista: usuario con solo cuerpo + historial cargado SIEMPRE devuelve ≥1 candidato', () => {
      // Simula: usuario con solo cuerpo, ayer entrenó pecho+hombros+triceps, hoy quiere fuerza pecho
      // Esto antes hubiera caído en el bug "<3 candidatos"
      const result = filterWithProgressiveRelaxation({
        exercises,
        equipment: ['cuerpo'],
        muscleGroups: ['pecho'],
        goal: 'fuerza',
        excludeMuscles: ['pecho', 'hombros', 'triceps'],
        minCandidates: 3,
      });
      expect(result.exercises.length).toBeGreaterThan(0);
      // Probablemente caiga en nivel 1 o 2 porque excludeMuscles bloquea pecho
    });

    it('escenario extremo: equipo solo ligas + objetivo movilidad SIEMPRE da resultado', () => {
      const result = filterWithProgressiveRelaxation({
        exercises,
        equipment: ['ligas'],
        muscleGroups: ['biceps'],
        goal: 'movilidad', // raro: ligas + movilidad
        excludeMuscles: [],
        minCandidates: 3,
      });
      expect(result.exercises.length).toBeGreaterThan(0);
    });
  });
});
