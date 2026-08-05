import { describe, it, expect } from 'vitest';
import { expandAvoidCats, textMatchesAvoid } from '../planEngine';

describe('helpers de avoid (filtro de alérgenos)', () => {
  it('expandAvoidCats expande categorías a ingredientes', () => {
    const terms = expandAvoidCats(['cacahuate']);
    expect(terms).toContain('cacahuate');
  });
  it('vegetariano expande a proteína animal', () => {
    const terms = expandAvoidCats(['vegetariano']);
    expect(terms).toContain('pollo');
    expect(terms).toContain('pescado');
  });
  it('textMatchesAvoid detecta el término por palabra completa', () => {
    const terms = expandAvoidCats(['cacahuate']);
    expect(textMatchesAvoid('2 cda crema de cacahuate', terms)).toBe(true);
    expect(textMatchesAvoid('2 tz de arroz', terms)).toBe(false);
  });
  it('ignora "nada"/"ninguna"', () => {
    expect(expandAvoidCats(['nada'])).toHaveLength(0);
  });
});
