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
  { id: 'peso-muerto-rumano', name: 'Peso Muerto Rumano', type: 'compuesto', muscleGroup: 'isquios' },
  { id: 'remo-mancuerna', name: 'Remo con Mancuerna', type: 'compuesto', muscleGroup: 'espalda' },
  { id: 'zancada-mancuerna', name: 'Zancada con Mancuerna', type: 'compuesto', muscleGroup: 'cuadriceps' },
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

  it('full body NO rebota: tren inferior queda junto (no leg → upper → leg)', () => {
    // Entrada desordenada como la mandaría la IA: pierna, upper, upper, pierna.
    const r = repairWorkoutStructure(
      [{ id: 'sentadilla-barra' }, { id: 'press-banca-barra' },
       { id: 'remo-mancuerna' }, { id: 'peso-muerto-rumano' }], bank);
    const order = ids(r);
    const cuad = order.indexOf('sentadilla-barra');
    const isq = order.indexOf('peso-muerto-rumano');
    expect(Math.abs(cuad - isq)).toBe(1);       // las dos de pierna, adyacentes
    expect(cuad).toBeLessThan(order.indexOf('press-banca-barra')); // inferior antes que superior
  });

  it('rompe una superserie que mezcla tren superior e inferior (con pesas)', () => {
    const r = repairWorkoutStructure(
      [{ id: 'zancada-mancuerna', group: 'B' },      // inferior
       { id: 'elevacion-lateral', group: 'B' }], bank); // superior
    expect(r.exercises.every(e => e.group === undefined)).toBe(true);
    expect(r.fixes.some(f => /tren superior e inferior/i.test(f))).toBe(true);
  });

  it('SIN pesas (circuito) NO rompe una mezcla de tren superior/inferior', () => {
    const r = repairWorkoutStructure(
      [{ id: 'zancada-mancuerna', group: 'B' },
       { id: 'elevacion-lateral', group: 'B' }], bank, { hasWeights: false });
    expect(r.exercises.filter(e => e.group === 'B')).toHaveLength(2);
  });

  it('piso de series: sube compuestos flojos al mínimo (aislamiento no se toca)', () => {
    const r = repairWorkoutStructure(
      [{ id: 'sentadilla-barra', sets: 2 }, { id: 'apertura-mancuerna', sets: 2 }],
      bank, { compoundSetFloor: 3 });
    const sent = r.exercises.find(e => e.id === 'sentadilla-barra')!;
    const aper = r.exercises.find(e => e.id === 'apertura-mancuerna')!;
    expect(sent.sets).toBe(3);   // compuesto subido al piso
    expect(aper.sets).toBe(2);   // aislamiento intacto
  });

  it('sin piso (compoundSetFloor 0) no cambia las series', () => {
    const r = repairWorkoutStructure([{ id: 'sentadilla-barra', sets: 2 }], bank);
    expect(r.exercises[0].sets).toBe(2);
  });
});
