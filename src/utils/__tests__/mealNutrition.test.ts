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

  // Regresión: un batido de un plan GUARDADO sin campo `macros` llega solo como texto.
  // Su string no matchea ningún alimento del banco → antes daba 0 y descuadraba el día.
  // Ahora se reconstruye con el modelo del motor (shakeMacros).
  describe('batido de proteína por texto (plan sin macros guardados)', () => {
    it('regular: reconstruye macros en vez de dar 0', () => {
      const n = mealNutrition(['1 scoop de proteína — 25 g proteína']);
      expect(n.prot).toBe(25);
      expect(n.kcal).toBeGreaterThan(100);   // 25·4 + carbo/grasa
      expect(n.misses).toHaveLength(0);      // ya no es un "miss"
    });
    it('mass gainer: carbos altos por diseño', () => {
      const n = mealNutrition(['1 scoop de proteína (mass gainer) — 30 g proteína']);
      expect(n.prot).toBe(30);
      expect(n.carbs).toBeGreaterThan(30);   // cf 1.5 → muchos carbos
    });
    it('coherente: kcal = 4·P + 4·C + 9·F', () => {
      const n = mealNutrition(['1 scoop de proteína (vegana) — 25 g proteína']);
      expect(n.kcal).toBe(Math.round(4 * n.prot + 4 * n.carbs + 9 * n.fat));
    });
    it('no es falso positivo: un platillo real no se trata como batido', () => {
      const n = mealNutrition(['230 g pechuga de pollo deshebrada', '3 tz arroz blanco cocido']);
      expect(n.prot).toBeGreaterThan(40);    // pollo real, no 25 g fijos del batido
    });
  });
});
