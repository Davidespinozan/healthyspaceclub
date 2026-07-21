import { describe, it, expect } from 'vitest';
import { computeCoach } from '../nutritionCoach';

// El caso real de David: cerró el día con 3701 de 3982 kcal —281 de menos— y la
// tarjeta le dijo "Cerraste tu día en tu meta" mientras el renglón de arriba
// decía "faltan 281". Se contradecía sola porque al cerrar solo se revisaba si
// te habías PASADO o si faltaba proteína, nunca si te quedaste corto.
describe('cierre del día', () => {
  const cerrado = { mealsDone: 5, mealsTotal: 5 };

  it('no dice "en tu meta" cuando faltan calorías', () => {
    const c = computeCoach({
      consumed: { kcal: 3701, prot: 207, carbs: 464, fat: 113 },
      target: { kcal: 3982, prot: 187, carbs: 509, fat: 133 },
      ...cerrado,
    });
    expect(c.headline).toBe('doneShortKcal');
    expect(c.kcalLeft).toBe(281);
  });

  it('sí dice "en tu meta" cuando de verdad cerró en su meta', () => {
    const c = computeCoach({
      consumed: { kcal: 3950, prot: 190, carbs: 505, fat: 132 },
      target: { kcal: 3982, prot: 187, carbs: 509, fat: 133 },
      ...cerrado,
    });
    expect(c.headline).toBe('doneGood');
  });

  it('la proteína faltante sigue mandando sobre las calorías', () => {
    const c = computeCoach({
      consumed: { kcal: 3701, prot: 90, carbs: 464, fat: 113 },
      target: { kcal: 3982, prot: 187, carbs: 509, fat: 133 },
      ...cerrado,
    });
    expect(c.headline).toBe('doneShort');
  });
});
