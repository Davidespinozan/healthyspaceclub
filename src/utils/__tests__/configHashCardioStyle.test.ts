import { describe, it, expect } from 'vitest';
import { buildConfigHash } from '../workoutPlanner';

// Base común: mismo gear, misma duración, misma modalidad cardio. Solo cambia cardioStyle.
const cardioBase = {
  duration: 60, equipment: 'cuerpo', goal: 'condicion', dayType: 'cardio',
  modality: 'cardio', objective: 'Bajar grasa', locale: 'es', schemaVersion: 13,
};
const h = (over: Partial<Parameters<typeof buildConfigHash>[0]>) => buildConfigHash({ ...cardioBase, ...over });

describe('buildConfigHash · cardioStyle invalida cache al cambiar de estilo', () => {
  it('mismo gear + misma duración: correr ≠ funcional en hash', () => {
    expect(h({ cardioStyle: 'correr' })).not.toBe(h({ cardioStyle: 'funcional' }));
  });

  it('funcional ≠ lowImpact', () => {
    expect(h({ cardioStyle: 'funcional' })).not.toBe(h({ cardioStyle: 'lowImpact' }));
  });

  it('lowImpact ≠ explosividad y todos los pares de estilos son distintos', () => {
    const styles = ['correr', 'funcional', 'lowImpact', 'explosividad'] as const;
    const hashes = styles.map(s => h({ cardioStyle: s }));
    expect(new Set(hashes).size, 'algún par de estilos colisiona en el hash').toBe(styles.length);
  });

  it('cambiar SOLO cardioStyle (todo lo demás igual) provoca cache MISS', () => {
    const a = h({ cardioStyle: 'correr' });
    const b = h({ cardioStyle: 'explosividad' });
    expect(a).not.toBe(b); // hash distinto → getCachedWorkout no encuentra la rutina anterior
  });

  it('mismo cardioStyle + mismos inputs → hash ESTABLE (idéntico)', () => {
    expect(h({ cardioStyle: 'funcional' })).toBe(h({ cardioStyle: 'funcional' }));
  });

  it('fuerza/hipertrofia (sin cardioStyle) NO cambian su hash — segmento condicional', () => {
    const fuerza = {
      duration: 60, equipment: 'gym', goal: 'hipertrofia', trainingGoal: 'hipertrofia',
      dayType: 'fuerza:push', modality: 'fuerza', objective: 'Ganar músculo', locale: 'es', schemaVersion: 13,
    };
    // pasar cardioStyle undefined (caso real de fuerza) == no pasarlo → mismo hash
    expect(buildConfigHash(fuerza)).toBe(buildConfigHash({ ...fuerza, cardioStyle: undefined }));
    // y dos sesiones de fuerza idénticas → mismo hash (comportamiento intacto)
    expect(buildConfigHash(fuerza)).toBe(buildConfigHash(fuerza));
  });

  it('cardio y fuerza con mismos campos base siguen diferenciados por modality (sin colisión)', () => {
    expect(h({ cardioStyle: 'correr' })).not.toBe(buildConfigHash({ ...cardioBase, modality: 'fuerza' }));
  });
});
