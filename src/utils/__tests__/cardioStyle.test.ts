import { describe, it, expect } from 'vitest';
import {
  cardioEquipmentFor,
  defaultCardioStyle,
  matchesCardioStyle,
  filterByModality,
} from '../workoutPlanner';
import { exercises } from '../../data/exercises';

describe('cardio Fase 2 — estilo y equipo efectivo', () => {
  it('equipo efectivo: peso corporal universal; gym añade máquinas', () => {
    expect(cardioEquipmentFor(['ligas'])).toEqual(['cuerpo']);
    expect(cardioEquipmentFor(['cuerpo'])).toEqual(['cuerpo']);
    expect(cardioEquipmentFor(['gym'])).toEqual(['gym', 'cuerpo']);
  });

  it('estilo por defecto según objetivo; lowImpactMode manda', () => {
    expect(defaultCardioStyle('perder-grasa')).toBe('funcional');
    expect(defaultCardioStyle('ganar-musculo')).toBe('lowImpact');
    expect(defaultCardioStyle('mantener')).toBe('correr');
    expect(defaultCardioStyle('rendimiento atlético')).toBe('explosividad');
    // seguridad sobre preferencia
    expect(defaultCardioStyle('perder-grasa', true)).toBe('lowImpact');
  });

  it('matchesCardioStyle considera el override por variante (cardio-maquina)', () => {
    const maquina = exercises.find(e => e.id === 'cardio-maquina')!;
    expect(matchesCardioStyle(maquina, 'funcional')).toBe(true);   // patrón
    expect(matchesCardioStyle(maquina, 'correr')).toBe(true);       // caminadora
    expect(matchesCardioStyle(maquina, 'lowImpact')).toBe(true);    // bici/elíptica
    expect(matchesCardioStyle(maquina, 'explosividad')).toBe(false);
  });

  it('REGRESIÓN: un usuario de bandas ya recibe cardio (antes ~vacío)', () => {
    const cardio = filterByModality(exercises, 'cardio');
    const eq = cardioEquipmentFor(['ligas']); // ['cuerpo']
    const pool = cardio.filter(ex => ex.equipment.some(e => eq.includes(e)));
    expect(pool.length).toBeGreaterThanOrEqual(8); // pool robusto de peso corporal
  });

  it('todo patrón muscleGroup:cardio tiene cardioStyle (patrón o variante)', () => {
    // El scope de la Fase 1 son los patrones de cardio "puro" (muscleGroup:'cardio').
    // El pool de acondicionamiento más amplio (goal:condicion / type:funcional) que
    // filterByModality también trae entra por relleno; se etiquetará en fases futuras.
    const puros = exercises.filter(ex => ex.muscleGroup === 'cardio');
    expect(puros.length).toBeGreaterThanOrEqual(12);
    for (const ex of puros) {
      const has = !!ex.cardioStyle || (ex.variants?.some(v => !!v.cardioStyle) ?? false);
      expect(has, `${ex.id} sin cardioStyle`).toBe(true);
    }
  });
});
