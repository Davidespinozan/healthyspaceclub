import { describe, it, expect } from 'vitest';
import { tDishName, tIngName, tSubName, tPortion, tDesc } from './nutritionI18n';

const EN = 'en' as const;
const ing = (nv: string, rol = 'principal', g: number | null = 100) => ({ nv, g, rol });

describe('nutritionI18n · overlay EN del banco en render', () => {
  it('platillos (culturales intactos, combinados con " + ", ES sin tocar)', () => {
    expect(tDishName('Huevo a la Mexicana', EN)).toBe('Mexican-Style Eggs');
    expect(tDishName('Machaca con Huevo', EN)).toBe('Machaca with Eggs');
    expect(tDishName('Alambre de Pollo + Guacamole', EN)).toBe('Chicken Alambre + Guacamole');
    expect(tDishName('Huevo a la Mexicana', 'es')).toBe('Huevo a la Mexicana');
  });

  it('ingredientes + fallback', () => {
    expect(tIngName('Huevo', EN)).toBe('Egg');
    expect(tIngName('Pan de caja', EN)).toBe('Sliced bread');
    expect(tIngName('Ingrediente inexistente', EN)).toBe('Ingrediente inexistente');
  });

  it('sub-recetas', () => {
    expect(tSubName('Aderezo César', EN)).toBe('Caesar Dressing');
    expect(tSubName('Guacamole', EN)).toBe('Guacamole');
  });

  it('desc separada por " · "', () => {
    expect(tDesc('Huevo · Pan de caja · Aguacate', EN)).toBe('Egg · Sliced bread · Avocado');
  });

  it('porciones · piezas contables pluralizadas', () => {
    expect(tPortion('2 huevos', ing('Huevo'), EN)).toBe('2 eggs');
    expect(tPortion('1 huevo', ing('Huevo'), EN)).toBe('1 egg');
    expect(tPortion('½ huevo', ing('Huevo'), EN)).toBe('½ egg');
  });

  it('porciones · tazas / cdas / rebanadas', () => {
    expect(tPortion('2 tazas de arroz', ing('Arroz'), EN)).toContain('2 cups of');
    expect(tPortion('2 cdas de aceite de oliva', ing('Aceite de oliva'), EN)).toContain('2 tbsp of');
    expect(tPortion('3 rebanadas de pan de caja', ing('Pan de caja'), EN)).toBe('3 slices of sliced bread');
    expect(tPortion('1 rebanada de pan de caja', ing('Pan de caja'), EN)).toBe('1 slice of sliced bread');
  });

  it('porciones · gramos / al gusto / condimento / ES intacto', () => {
    expect(tPortion('60 g Pollo', ing('Pollo'), EN)).toBe('60 g Chicken');
    expect(tPortion('Verduras (jitomate, cebolla, chile) al gusto', ing('Verduras (jitomate, cebolla, chile)', 'guarnicion', null), EN)).toContain(' to taste');
    expect(tPortion('2 huevos', ing('Huevo'), 'es')).toBe('2 huevos');
  });
});
