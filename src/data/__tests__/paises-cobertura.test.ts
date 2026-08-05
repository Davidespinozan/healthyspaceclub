import { describe, it, expect } from 'vitest';
import { PAISES } from '../ubicaciones';
import { LATAM_CODES, EUROPE_CODES, regionFromCountry } from '../../utils/region';

// Guardrail: el pre-llenado por IP mapea el código detectado a un slug de PAISES,
// y si no existe cae en 'otro'. Este test asegura que todo país que region.ts
// reconoce tenga su botón en el picker, para no perder el pre-llenado en un país
// conocido cuando alguien edite region.ts.
describe('cobertura de PAISES vs códigos reconocidos', () => {
  const slugs = new Set(PAISES.map((p) => p.slug));

  it('cada código LATAM tiene entrada en PAISES', () => {
    for (const code of LATAM_CODES) {
      expect(slugs.has(code.toLowerCase()), `falta ${code} en PAISES`).toBe(true);
    }
  });

  it('cada código de Europa tiene entrada en PAISES', () => {
    for (const code of EUROPE_CODES) {
      expect(slugs.has(code.toLowerCase()), `falta ${code} en PAISES`).toBe(true);
    }
  });

  it('todos los slugs de PAISES son únicos', () => {
    expect(slugs.size).toBe(PAISES.length);
  });

  it('cada slug real mapea a la región esperada', () => {
    // 'otro' no es un código ISO; se excluye.
    for (const { slug } of PAISES) {
      if (slug === 'otro') continue;
      const region = regionFromCountry(slug);
      expect(['LATAM', 'EUROPE', 'REST']).toContain(region);
    }
    expect(regionFromCountry('es')).toBe('EUROPE');
    expect(regionFromCountry('mx')).toBe('LATAM');
    expect(regionFromCountry('br')).toBe('REST'); // Brasil está en el picker pero no en los sets de precio
  });
});
