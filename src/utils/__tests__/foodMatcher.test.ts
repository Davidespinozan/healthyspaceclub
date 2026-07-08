import { describe, it, expect } from 'vitest';
import { matchFood, matchReport, type FoodRef } from '../foodMatcher';

// Catálogo fixture con nombres REALES del estilo de Magaly.
const FOODS: FoodRef[] = [
  { id: 'aguacate-hass', name: 'Aguacate Hass' },
  { id: 'aceite-de-aguacate', name: 'Aceite de aguacate' },
  { id: 'mantequilla-de-cacahuate', name: 'Mantequilla de cacahuate' },
  { id: 'huevo-entero-fresco', name: 'Huevo entero fresco' },
  { id: 'pechuga-sin-piel', name: 'Pechuga de pollo sin piel' },
  { id: 'tomate', name: 'Tomate' },
  { id: 'arroz-cocido', name: 'Arroz blanco cocido' },
  { id: 'tortilla-de-maiz', name: 'Tortilla de maíz' },
  { id: 'frijol-cocido', name: 'Frijol negro cocido' },
  { id: 'queso-panela', name: 'Queso Panela' },
  { id: 'nuez', name: 'Nuez' },
  { id: 'papilla-pollo', name: 'Papilla de macarrones con pollo' },
];

describe('foodMatcher — robusto a nombres, encuentra errores', () => {
  it('empata aunque el nombre venga escrito distinto', () => {
    expect(matchFood('6 huevos', FOODS).foodId).toBe('huevo-entero-fresco'); // plural + cantidad
    expect(matchFood('pechuga de pollo deshebrada', FOODS).foodId).toBe('pechuga-sin-piel'); // prep stripped
    expect(matchFood('arroz blanco', FOODS).foodId).toBe('arroz-cocido');
    expect(matchFood('nueces', FOODS).foodId).toBe('nuez'); // irregular plural
    expect(matchFood('tortillas de maíz', FOODS).foodId).toBe('tortilla-de-maiz');
  });

  it('sustantivo-cabeza manda: aguacate ≠ aceite de aguacate', () => {
    expect(matchFood('aguacate', FOODS).foodId).toBe('aguacate-hass');
    expect(matchFood('½ pz aguacate', FOODS).foodId).toBe('aguacate-hass');
    // NO debe caer en "Aceite de aguacate"
    expect(matchFood('aguacate', FOODS).foodId).not.toBe('aceite-de-aguacate');
  });

  it('resuelve sinónimos que las letras no infieren', () => {
    expect(matchFood('crema de cacahuate', FOODS).foodId).toBe('mantequilla-de-cacahuate');
    expect(matchFood('jitomate', FOODS).foodId).toBe('tomate');
  });

  it('NO adivina: marca lo que no puede resolver', () => {
    const r = matchFood('salsa verde hecha en casa', FOODS);
    expect(r.status).toBe('none');
    expect(r.foodId).toBeNull();
    const r2 = matchFood('quinoa tricolor', FOODS);
    expect(r2.status).toBe('none'); // no está en el catálogo → error surface
  });

  it('no confunde pollo con papilla de bebé (penaliza ruido largo)', () => {
    const r = matchFood('pollo', FOODS);
    expect(r.foodId).not.toBe('papilla-pollo');
  });

  it('reporte batch separa ok / revisar / errores', () => {
    const rep = matchReport(
      ['6 huevos', 'aguacate', 'salsa verde', 'ingrediente inexistente xyz'],
      FOODS,
    );
    expect(rep.ok.length).toBeGreaterThanOrEqual(2);
    expect(rep.none.length).toBeGreaterThanOrEqual(1); // los errores quedan aislados
  });
});
