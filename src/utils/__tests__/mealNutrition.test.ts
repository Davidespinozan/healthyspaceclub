import { describe, it, expect } from 'vitest';
import { mealNutrition } from '../mealNutrition';

describe('mealNutrition — macros reales desde la base de Magaly', () => {
  it('Tinga de Pollo: pollo + arroz cuentan, números sensatos', () => {
    const n = mealNutrition(['230 g pechuga de pollo deshebrada', '3 tz arroz blanco cocido', 'Lechuga + tomate + cebolla', '2 cdas salsa chipotle', 'Limón']);
    expect(n.kcal).toBeGreaterThan(700);   // comida grande
    expect(n.kcal).toBeLessThan(1300);
    expect(n.prot).toBeGreaterThan(40);    // 230 g pollo → proteína real
    expect(n.carbs).toBeGreaterThan(100);  // 3 tz arroz → carbos altos (reales)
  });

  it('Huevos Rancheros: proteína del huevo cuenta', () => {
    const n = mealNutrition(['6 huevos', '⅔ taza frijoles cocidos', '1 tortilla de maíz', '½ pz aguacate']);
    expect(n.prot).toBeGreaterThan(25);    // 6 huevos + frijol
    expect(n.fat).toBeGreaterThan(20);     // huevo + aguacate
    expect(n.kcal).toBeGreaterThan(500);
  });

  it('no revienta con porciones sin cantidad ni ingredientes raros', () => {
    const n = mealNutrition(['Limón', 'Sal al gusto', '']);
    expect(Number.isFinite(n.kcal)).toBe(true);
  });
});
