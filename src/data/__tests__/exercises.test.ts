import { describe, it, expect } from 'vitest';
import { exercises } from '../exercises';

describe('Banco de ejercicios', () => {
  describe('Estructura general', () => {
    it('tiene exactamente 121 entradas', () => {
      expect(exercises).toHaveLength(121);
    });

    it('cada entrada tiene los campos required del Exercise interface', () => {
      exercises.forEach((ex, i) => {
        expect(ex.id, `Exercise[${i}] sin id`).toBeTruthy();
        expect(ex.name, `Exercise ${ex.id} sin name`).toBeTruthy();
        expect(ex.desc, `Exercise ${ex.id} sin desc`).toBeTruthy();
        expect(ex.muscleGroup, `Exercise ${ex.id} sin muscleGroup`).toBeTruthy();
        expect(ex.equipment, `Exercise ${ex.id} sin equipment`).toBeTruthy();
        expect(Array.isArray(ex.equipment)).toBe(true);
        expect(ex.equipment.length).toBeGreaterThan(0);
        expect(ex.goals).toBeTruthy();
        expect(ex.type).toBeTruthy();
        expect(ex.difficulty).toBeTruthy();
        expect(ex.defaultSets).toBeGreaterThan(0);
        expect(ex.defaultReps).toBeTruthy();
        expect(ex.defaultRest).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(ex.steps)).toBe(true);
      });
    });
  });

  describe('IDs únicos', () => {
    it('todos los IDs de ejercicios son únicos', () => {
      const ids = exercises.map(e => e.id);
      const uniqueIds = new Set(ids);

      if (uniqueIds.size !== ids.length) {
        const seen = new Set<string>();
        const duplicates: string[] = [];
        ids.forEach(id => {
          if (seen.has(id)) duplicates.push(id);
          else seen.add(id);
        });
        console.error('IDs duplicados:', duplicates);
      }

      expect(uniqueIds.size).toBe(ids.length);
    });

    it('todos los variant IDs son únicos globalmente', () => {
      const variantIds: string[] = [];
      exercises.forEach(ex => {
        ex.variants?.forEach(v => variantIds.push(v.id));
      });
      const uniqueVariantIds = new Set(variantIds);

      if (uniqueVariantIds.size !== variantIds.length) {
        const seen = new Set<string>();
        const duplicates: string[] = [];
        variantIds.forEach(id => {
          if (seen.has(id)) duplicates.push(id);
          else seen.add(id);
        });
        console.error('Variant IDs duplicados:', duplicates);
      }

      expect(uniqueVariantIds.size).toBe(variantIds.length);
    });
  });

  describe('Yoga preservado', () => {
    it('tiene exactamente 35 poses con isYoga: true', () => {
      const yogaPoses = exercises.filter(e => e.isYoga === true);
      expect(yogaPoses).toHaveLength(35);
    });

    it('todas las yoga poses tienen defaultDuration', () => {
      const yogaPoses = exercises.filter(e => e.isYoga === true);
      yogaPoses.forEach(pose => {
        expect(pose.defaultDuration, `${pose.id} sin defaultDuration`).toBeGreaterThan(0);
      });
    });

    it('los 35 IDs específicos de yoga están presentes', () => {
      const expectedYogaIds = [
        'sun-salutation-a', 'sun-salutation-b', 'warrior-i', 'warrior-ii',
        'reverse-warrior', 'warrior-iii', 'triangle-pose', 'chair-pose',
        'downward-dog', 'pigeon-pose', 'cat-cow', 'lizard-lunge', 'low-lunge',
        'cobra-pose', 'bridge-pose', 'puppy-pose', 'seated-forward-fold',
        'standing-forward-fold', 'wide-leg-forward-fold', 'happy-baby',
        'supine-twist', 'child-pose', 'savasana', 'chaturanga', 'upward-dog',
        'high-plank-yoga', 'crescent-lunge', 'half-moon', 'side-plank-yoga',
        'crow-pose', 'camel-pose', 'boat-pose', 'seated-twist', 'wheel-pose',
        'revolved-chair',
      ];
      const actualYogaIds = exercises.filter(e => e.isYoga).map(e => e.id);
      expectedYogaIds.forEach(id => {
        expect(actualYogaIds, `Yoga pose ${id} no encontrada`).toContain(id);
      });
    });
  });

  describe('Patrones de fuerza/cardio', () => {
    it('tiene exactamente 86 patrones (no-yoga)', () => {
      const patterns = exercises.filter(e => !e.isYoga);
      expect(patterns).toHaveLength(86);
    });

    it('cada patrón no-yoga tiene al menos 1 variante', () => {
      const patterns = exercises.filter(e => !e.isYoga);
      patterns.forEach(p => {
        expect(p.variants, `Patrón ${p.id} sin variants`).toBeTruthy();
        expect(p.variants!.length, `Patrón ${p.id} con variants vacío`).toBeGreaterThan(0);
      });
    });

    it('cada patrón no-yoga tiene exactamente UNA variante con isDefault: true', () => {
      const patterns = exercises.filter(e => !e.isYoga);
      patterns.forEach(p => {
        const defaultVariants = p.variants!.filter(v => v.isDefault === true);
        expect(
          defaultVariants.length,
          `Patrón ${p.id} tiene ${defaultVariants.length} defaults (esperado: 1)`,
        ).toBe(1);
      });
    });

    it('cada variante tiene id, name, equipment válidos', () => {
      const patterns = exercises.filter(e => !e.isYoga);
      patterns.forEach(p => {
        p.variants!.forEach(v => {
          expect(v.id, `Variant sin id en ${p.id}`).toBeTruthy();
          expect(v.name, `Variant ${v.id} sin name`).toBeTruthy();
          expect(Array.isArray(v.equipment)).toBe(true);
          expect(v.equipment.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Invariante: equipment del patrón = unión de variants[].equipment', () => {
    it('para cada patrón no-yoga, equipment cubre todos los equipos de sus variantes', () => {
      const patterns = exercises.filter(e => !e.isYoga);
      patterns.forEach(p => {
        const variantEquipment = new Set<string>();
        p.variants!.forEach(v => {
          v.equipment.forEach(eq => variantEquipment.add(eq));
        });
        const patternEquipment = new Set<string>(p.equipment);

        variantEquipment.forEach(eq => {
          expect(
            patternEquipment.has(eq),
            `Patrón ${p.id} no tiene equipment "${eq}" pero alguna variante sí`,
          ).toBe(true);
        });
      });
    });
  });

  describe('Distribución por grupo muscular', () => {
    it('tiene patrones para todos los grupos principales', () => {
      const groups = new Set(exercises.filter(e => !e.isYoga).map(e => e.muscleGroup));
      expect(groups.has('pecho')).toBe(true);
      expect(groups.has('espalda')).toBe(true);
      expect(groups.has('hombros')).toBe(true);
      expect(groups.has('biceps')).toBe(true);
      expect(groups.has('triceps')).toBe(true);
      expect(groups.has('cuadriceps')).toBe(true);
      expect(groups.has('gluteo')).toBe(true);
      expect(groups.has('isquios')).toBe(true);
      expect(groups.has('core')).toBe(true);
      expect(groups.has('cardio')).toBe(true);
    });

    it('cada grupo muscular tiene variantes para cuerpo o gym (no queda hueco)', () => {
      const groups: Array<'pecho' | 'espalda' | 'hombros' | 'biceps' | 'triceps' | 'cuadriceps' | 'gluteo' | 'isquios' | 'core' | 'cardio'> = [
        'pecho', 'espalda', 'hombros', 'biceps', 'triceps',
        'cuadriceps', 'gluteo', 'isquios', 'core', 'cardio',
      ];
      groups.forEach(group => {
        const exercisesInGroup = exercises.filter(e =>
          !e.isYoga && (e.muscleGroup === group || e.secondaryMuscles?.includes(group)),
        );
        const hasGym = exercisesInGroup.some(e => e.equipment.includes('gym'));
        expect(hasGym, `Grupo ${group} sin ningún ejercicio de gym`).toBe(true);
      });
    });
  });
});
