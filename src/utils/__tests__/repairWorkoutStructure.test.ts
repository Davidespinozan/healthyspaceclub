import { describe, it, expect } from 'vitest';
import { repairWorkoutStructure } from '../exerciseOrder';
import type { Exercise } from '../../types';

// Banco mínimo con los campos que usa el reparador (type, muscleGroup, name).
const bank = [
  { id: 'press-banca-barra', name: 'Press de Banca con Barra', type: 'compuesto', muscleGroup: 'pecho' },
  { id: 'sentadilla-barra', name: 'Sentadilla con Barra', type: 'compuesto', muscleGroup: 'cuadriceps' },
  { id: 'apertura-mancuerna', name: 'Apertura con Mancuerna', type: 'aislamiento', muscleGroup: 'pecho' },
  { id: 'curl-biceps', name: 'Curl de Bíceps', type: 'aislamiento', muscleGroup: 'biceps' },
  { id: 'extension-triceps', name: 'Extensión de Tríceps', type: 'aislamiento', muscleGroup: 'triceps' },
  { id: 'plancha', name: 'Plancha', type: 'aislamiento', muscleGroup: 'core' },
  { id: 'elevacion-lateral', name: 'Elevación Lateral', type: 'aislamiento', muscleGroup: 'hombros' },
] as unknown as Exercise[];

const ids = (r: { exercises: { id: string }[] }) => r.exercises.map(e => e.id);

describe('repairWorkoutStructure', () => {
  it('core siempre al final', () => {
    const r = repairWorkoutStructure(
      [{ id: 'plancha', sets: 3, rest: 45 }, { id: 'press-banca-barra', sets: 4, rest: 120 }], bank);
    expect(ids(r)[ids(r).length - 1]).toBe('plancha');
  });

  it('compuestos antes que aislamiento (arrancar con aislado se corrige)', () => {
    const r = repairWorkoutStructure(
      [{ id: 'curl-biceps', sets: 3, rest: 60 }, { id: 'sentadilla-barra', sets: 4, rest: 120 }], bank);
    expect(ids(r)[0]).toBe('sentadilla-barra');
  });

  it('compuesto pesado NUNCA en superserie (lo saca del group)', () => {
    const r = repairWorkoutStructure(
      [{ id: 'press-banca-barra', sets: 4, rest: 120, group: 'A' },
       { id: 'apertura-mancuerna', sets: 3, rest: 60, group: 'A' }], bank);
    const press = r.exercises.find(e => e.id === 'press-banca-barra')!;
    expect(press.group).toBeUndefined();
  });

  it('técnica de intensidad solo en aislamiento (la quita del compuesto)', () => {
    const r = repairWorkoutStructure(
      [{ id: 'sentadilla-barra', sets: 4, rest: 120, tecnica: 'Drop set' }], bank);
    expect(r.exercises[0].tecnica).toBeUndefined();
    expect(r.fixes.some(f => /técnica/i.test(f))).toBe(true);
  });

  it('integridad de superserie: iguala sets y rest al máximo', () => {
    const r = repairWorkoutStructure(
      [{ id: 'curl-biceps', sets: 3, rest: 60, group: 'B' },
       { id: 'extension-triceps', sets: 4, rest: 45, group: 'B' }], bank);
    const grp = r.exercises.filter(e => e.group === 'B');
    expect(grp.every(e => e.sets === 4)).toBe(true);
    expect(grp.every(e => e.rest === 60)).toBe(true);
  });

  it('preserva una biserie de aislamientos legítima (no la rompe)', () => {
    const r = repairWorkoutStructure(
      [{ id: 'sentadilla-barra', sets: 4, rest: 120 },
       { id: 'curl-biceps', sets: 3, rest: 60, group: 'A' },
       { id: 'extension-triceps', sets: 3, rest: 60, group: 'A' }], bank);
    expect(r.exercises.filter(e => e.group === 'A')).toHaveLength(2);
    expect(ids(r)[0]).toBe('sentadilla-barra'); // compuesto primero
  });
});
