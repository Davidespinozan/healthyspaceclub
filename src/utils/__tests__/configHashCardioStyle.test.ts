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

describe('buildConfigHash · señales materiales que faltaban (caché GLOBAL cross-user)', () => {
  const base = { duration: 60, equipment: 'cuerpo', goal: 'hipertrofia', trainingGoal: 'hipertrofia', dayType: 'full-body', modality: 'fuerza', objective: 'Ganar músculo', locale: 'es', schemaVersion: 13 };
  const H = (o: Partial<Parameters<typeof buildConfigHash>[0]>) => buildConfigHash({ ...base, ...o });

  it('SEGURIDAD (P0): lowImpact separa el caché → un usuario bajo-impacto NO recibe la sesión de alto impacto', () => {
    expect(H({ lowImpact: true })).not.toBe(H({ lowImpact: false }));
  });
  it('level (P1): principiante ≠ avanzado en hash', () => {
    expect(H({ level: 'principiante' })).not.toBe(H({ level: 'avanzado' }));
  });
  it('readiness (P1): low ≠ high en hash', () => {
    expect(H({ readiness: 'low' })).not.toBe(H({ readiness: 'high' }));
  });
  it('mesociclo (P1): fase/deload separan el caché', () => {
    expect(H({ mesoPhase: 'accumulation' })).not.toBe(H({ mesoPhase: 'intensification' }));
    expect(H({ deload: true })).not.toBe(H({ deload: false }));
  });
  it('determinismo + estabilidad: misma config → mismo hash', () => {
    expect(H({ level: 'intermedio', readiness: 'normal', lowImpact: false })).toBe(H({ level: 'intermedio', readiness: 'normal', lowImpact: false }));
  });
  it('todas las señales materiales combinadas producen hashes únicos (sin colisión)', () => {
    const hashes = new Set<string>();
    for (const level of ['principiante', 'intermedio', 'avanzado'])
      for (const readiness of ['low', 'normal', 'high'])
        for (const lowImpact of [false, true])
          for (const deload of [false, true]) hashes.add(H({ level, readiness, lowImpact, deload }));
    expect(hashes.size).toBe(3 * 3 * 2 * 2); // 36 configs → 36 hashes distintos
  });
});
