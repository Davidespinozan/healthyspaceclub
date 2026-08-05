import { describe, it, expect } from 'vitest';
import { equipmentFromPlan } from '../workoutPlanner';

// Contrato: al guardar la rutina se sella `userEquipment` en el plan; al recargar
// se recupera con equipmentFromPlan para restaurar selectedEquipment. Sin esto, la
// rutina de ligas se repintaba como gym al dar refresh.
describe('equipmentFromPlan', () => {
  it('recupera el equipo sellado (ligas)', () => {
    expect(equipmentFromPlan({ userEquipment: 'ligas', exercises: [] })).toBe('ligas');
  });

  it('recupera gym y cuerpo', () => {
    expect(equipmentFromPlan({ userEquipment: 'gym' })).toBe('gym');
    expect(equipmentFromPlan({ userEquipment: 'cuerpo' })).toBe('cuerpo');
  });

  it('rutina vieja sin sello → null (el llamador cae a su default)', () => {
    expect(equipmentFromPlan({ exercises: [] })).toBeNull();
    expect(equipmentFromPlan(null)).toBeNull();
    expect(equipmentFromPlan(undefined)).toBeNull();
  });

  it('valor inválido → null (nunca inventa un equipo)', () => {
    expect(equipmentFromPlan({ userEquipment: 'marte' })).toBeNull();
    expect(equipmentFromPlan({ userEquipment: 123 })).toBeNull();
  });
});
