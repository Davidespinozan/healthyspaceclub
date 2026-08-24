import { describe, it, expect } from 'vitest';
import { normalizeGroceryList, skuKey } from '../groceryList';

// NUTRITION-N8 · normalización de lista de compras (solo representación; el plan no cambia).
const nl = (names: string[], roles: (string | undefined)[] = []) =>
  normalizeGroceryList(names.map((nv, i) => ({ nv, rol: roles[i] })));

describe('N8 · A · expansión de "Verduras (...)"', () => {
  it('expande el compuesto en verduras individuales', () => {
    expect(nl(['Verduras (lechuga, jitomate, cebolla)'])).toEqual(['Lechuga', 'Jitomate', 'Cebolla']); // display = 1er nombre visto (key jitomate=tomate)
  });
  it('preserva nombres multi-palabra ("jitomate cherry", "cebolla morada")', () => {
    expect(nl(['Verduras (pepino, jitomate cherry, cebolla morada)'])).toEqual(['Pepino', 'Jitomate cherry', 'Cebolla morada']);
  });
  it('maneja paréntesis anidados sin romper', () => {
    expect(nl(['Verduras (pimientos (verde, rojo, amarillo), cebolla morada)'])).toEqual(['Pimientos', 'Cebolla morada']);
  });
  it('separa por " y " además de coma', () => {
    expect(nl(['Verduras (espinaca y champiñón)'])).toEqual(['Espinaca', 'Champiñón']);
  });
});

describe('N8 · reality: NO parte nombres con paréntesis que NO son el wrapper', () => {
  for (const nv of ['Corte de res (sirloin)', 'Pan (2 rebanadas)', 'Alubias (frijol blanco)', 'Yogurt griego (topping)', 'Zanahoria (en la masa)'])
    it(`"${nv}" queda intacto (1 SKU)`, () => { expect(nl([nv]).length).toBe(1); });
});

describe('N8 · B · acentos / C · alias exactos', () => {
  it('acento/mayúscula colapsan al mismo SKU', () => {
    expect(nl(['Plátano', 'platano', 'PLÁTANO']).length).toBe(1);
  });
  it('jitomate = tomate (mismo SKU de compra)', () => {
    expect(nl(['Jitomate', 'Tomate']).length).toBe(1);
  });
  it('yogur = yogurt = yoghurt', () => {
    expect(nl(['Yogur', 'Yogurt', 'Yoghurt']).length).toBe(1);
  });
  it('plural no ambiguo colapsa: pimiento/pimientos, champiñón/champiñones', () => {
    expect(nl(['Pimiento', 'Pimientos']).length).toBe(1);
    expect(nl(['Champiñón', 'Champiñones']).length).toBe(1);
  });
});

describe('N8 · D-F · NO falsos merges (adversarial)', () => {
  const distinct: Array<[string, string]> = [
    ['Queso feta', 'Queso panela'], ['Ricotta', 'Cottage'], ['Requesón', 'Cottage'],
    ['Arroz', 'Arroz integral'], ['Pollo deshebrado', 'Pechuga de pollo'],
    ['Crema de cacahuate', 'Crema de almendra'], ['Leche', 'Yogurt'],
    ['Mango', 'Papaya'], ['Fresas', 'Frutos rojos'], ['Tomate', 'Tomate cherry'],
    ['Frambuesas', 'Zarzamoras'],
  ];
  for (const [a, b] of distinct)
    it(`"${a}" ≠ "${b}" (2 SKUs)`, () => { expect(nl([a, b]).length).toBe(2); });
});

describe('N8 · G · determinismo · H · count<=raw · M · agregación', () => {
  it('mismo input → mismo output', () => {
    const input = ['Verduras (lechuga, jitomate, cebolla)', 'Pollo', 'Arroz', 'Jitomate', 'Pollo'];
    expect(nl(input)).toEqual(nl(input));
  });
  it('normalized count <= raw distinct count', () => {
    const raw = ['Verduras (lechuga, cebolla)', 'Verduras (lechuga, jitomate)', 'Cebolla', 'Jitomate', 'Tomate'];
    const out = nl(raw);
    expect(out.length).toBeLessThanOrEqual(new Set(raw).size + 4); // expandidos, pero deduplicados
    // lechuga/cebolla/jitomate=tomate → {Lechuga, Cebolla, Tomate}
    expect(out).toEqual(['Lechuga', 'Cebolla', 'Jitomate']); // jitomate 1º visto; Tomate dedupe al mismo SKU
  });
  it('ocurrencias repetidas del mismo SKU → 1 renglón, orden de 1ª aparición', () => {
    expect(nl(['Cebolla', 'Pollo', 'Cebolla', 'Arroz', 'cebollas'])).toEqual(['Cebolla', 'Pollo', 'Arroz']);
  });
});

describe('N8 · N · roles condimento/sub-receta excluidos · L · nombres raros', () => {
  it('excluye condimento y sub-receta', () => {
    expect(nl(['Sal', 'Pollo', 'Aderezo César'], ['condimento', 'principal', 'sub-receta'])).toEqual(['Pollo']);
  });
  it('nombre vacío / raro no rompe', () => {
    expect(() => nl(['', '   ', 'Verduras ()'])).not.toThrow();
  });
});

describe('N8 · J · pureza (no muta el plan/ings de entrada)', () => {
  it('no muta el array ni los objetos ing (plan byte-equivalente)', () => {
    const ings = [{ nv: 'Verduras (lechuga, cebolla)', rol: 'guarnicion', g: 60 }, { nv: 'Pollo', rol: 'principal', g: 120 }];
    const snapshot = JSON.parse(JSON.stringify(ings));
    normalizeGroceryList(ings);
    expect(ings).toEqual(snapshot); // entrada intacta → el plan (m.ings) no cambia
  });
});

describe('N8 · skuKey no colapsa alimentos distintos', () => {
  it('keys distintos para foods distintos', () => {
    expect(skuKey('Queso feta')).not.toBe(skuKey('Queso panela'));
    expect(skuKey('Arroz')).not.toBe(skuKey('Arroz integral'));
    expect(skuKey('Pollo')).not.toBe(skuKey('Pechuga de pollo'));
    expect(skuKey('Jitomate')).toBe(skuKey('Tomate'));
  });
});
