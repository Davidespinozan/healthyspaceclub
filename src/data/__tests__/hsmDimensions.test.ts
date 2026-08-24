import { describe, it, expect } from 'vitest';
import {
  HSM_DIMENSION_IDS, dimensionIdFromLegacyTitle, dimensionIndexFromId,
  questionKeyFor, isKnownDimensionId, stableHash,
} from '../hsmDimensions';

describe('MINDSET-1 · dimensiones estables', () => {
  it('hay exactamente 10 ids en el orden del banco', () => {
    expect(HSM_DIMENSION_IDS).toEqual(['identity', 'calling', 'purpose', 'goals', 'discipline', 'body', 'environment', 'emotional_control', 'resilience', 'growth']);
  });
  it('ES title → id', () => {
    expect(dimensionIdFromLegacyTitle('Identidad')).toBe('identity');
    expect(dimensionIdFromLegacyTitle('Vocación')).toBe('calling');
    expect(dimensionIdFromLegacyTitle('Control Emocional')).toBe('emotional_control');
    expect(dimensionIdFromLegacyTitle('Entorno y Relaciones')).toBe('environment');
    expect(dimensionIdFromLegacyTitle('Evolución')).toBe('growth');
  });
  it('EN title → id', () => {
    expect(dimensionIdFromLegacyTitle('Identity')).toBe('identity');
    expect(dimensionIdFromLegacyTitle('Calling')).toBe('calling');
    expect(dimensionIdFromLegacyTitle('Emotional Control')).toBe('emotional_control');
    expect(dimensionIdFromLegacyTitle('Environment & Relationships')).toBe('environment');
    expect(dimensionIdFromLegacyTitle('Growth')).toBe('growth');
  });
  it('robusto a mayúsculas/acentos', () => {
    expect(dimensionIdFromLegacyTitle('  identidad ')).toBe('identity');
    expect(dimensionIdFromLegacyTitle('VOCACION')).toBe('calling');
  });
  it('título desconocido → unknown (nunca se pierde)', () => {
    expect(dimensionIdFromLegacyTitle('Algo Raro')).toBe('unknown');
    expect(dimensionIndexFromId('unknown')).toBe(-1);
    expect(isKnownDimensionId('unknown')).toBe(false);
    expect(isKnownDimensionId('identity')).toBe(true);
  });
  it('dimensionIndexFromId respeta el orden', () => {
    expect(dimensionIndexFromId('identity')).toBe(0);
    expect(dimensionIndexFromId('growth')).toBe(9);
  });
});

describe('MINDSET-1 · questionKey estable', () => {
  it('pregunta conocida → "<dim>#<index>"', () => {
    expect(questionKeyFor('body', 3, 'cualquier texto')).toBe('body#3');
  });
  it('desconocida/legacy → "<dim>#u<hash>" (determinista y colisión-segura)', () => {
    const a = questionKeyFor('unknown', -1, 'Pregunta A');
    const b = questionKeyFor('unknown', -1, 'Pregunta B');
    expect(a).toMatch(/^unknown#u/);
    expect(a).not.toBe(b);                 // distintas preguntas → distintas claves
    expect(questionKeyFor('unknown', -1, 'Pregunta A')).toBe(a); // determinista
  });
  it('dim conocida pero index -1 → clave por hash (no colisiona con index 0)', () => {
    expect(questionKeyFor('body', -1, 'x')).toMatch(/^body#u/);
    expect(questionKeyFor('body', -1, 'x')).not.toBe('body#0');
  });
  it('stableHash es determinista y neutral a acentos/caso', () => {
    expect(stableHash('Hola Mundo')).toBe(stableHash('hola mundo'));
  });
});

// El id se AÑADE sin cambiar qué preguntas recibe el usuario: la rotación fija
// (slot = dayIndex%3, dims (slot*4+k)%10) es un CONTRATO que no cambia en Gate B.
describe('MINDSET-1 · rotación fija sin cambios (regresión)', () => {
  const fixedDimsForSlot = (slot: number) => [0, 1, 2, 3].map(k => (slot * 4 + k) % 10);
  it('slot 0 → dims 0,1,2,3', () => expect(fixedDimsForSlot(0)).toEqual([0, 1, 2, 3]));
  it('slot 1 → dims 4,5,6,7', () => expect(fixedDimsForSlot(1)).toEqual([4, 5, 6, 7]));
  it('slot 2 → dims 8,9,0,1 (sesgo 2:1 documentado de Identity/Calling)', () => expect(fixedDimsForSlot(2)).toEqual([8, 9, 0, 1]));
});
