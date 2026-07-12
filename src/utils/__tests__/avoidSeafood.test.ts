import { describe, it, expect } from 'vitest';
import { safeBankByTiempo } from '../planEngine';
const seaCount = (av: string[]) => {
  const b = safeBankByTiempo(av);
  const all = [...b.Desayuno, ...b.Comida, ...b.Cena, ...b.Snack];
  return {
    camaron: all.filter(d => /camar/i.test(d.nombre)).length,
    pescado: all.filter(d => /atun|salmon|pescado|tilapia/i.test(d.nombre)).length,
  };
};
describe('evitar mariscos (Magaly: incluye pescado)', () => {
  it('mariscos → quita camarón Y pescado', () => {
    const c = seaCount(['mariscos']);
    expect(c.camaron).toBe(0);
    expect(c.pescado).toBe(0);
  });
  it('pescado → quita solo pescado (camarón se queda)', () => {
    const c = seaCount(['pescado']);
    expect(c.pescado).toBe(0);
    expect(c.camaron).toBeGreaterThan(0);
  });
});
