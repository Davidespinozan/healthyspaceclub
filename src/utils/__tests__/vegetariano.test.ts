import { describe, it, expect } from 'vitest';
import { buildWeeklyPlan } from '../planEngine';

// Food-safety: un usuario vegetariano/vegano NUNCA debe recibir proteína animal.
const MEAT = ['pollo', 'pechuga', 'pavo', 'cerdo', 'chorizo', 'tocino', 'jamon', 'res', 'sirloin', 'bistec', 'arrachera', 'camaron', 'marisco', 'pescado', 'salmon', 'atun', 'tilapia'];
const ANIMAL = [...MEAT, 'huevo', 'queso', 'leche', 'yogur', 'panela', 'mozzarella'];
const target = { kcal: 2200, protG: 140, fatG: 70, carbG: 230 };

function ingNames(days: ReturnType<typeof buildWeeklyPlan>): string[] {
  const out: string[] = [];
  for (const d of days) for (const m of d.meals) for (const ing of m.ings ?? []) out.push((ing.nv || '').toLowerCase());
  return out;
}

describe('dieta vegetariana / vegana (food-safety)', () => {
  it('vegetariano: sin carne, pollo, pavo, cerdo ni pescado', () => {
    const days = buildWeeklyPlan(target, { seed: 7, avoid: ['vegetariano'] });
    const ings = ingNames(days);
    const found = ings.filter((nv) => MEAT.some((t) => new RegExp(`\\b${t}\\b`).test(nv)));
    expect(found, `proteína animal encontrada: ${[...new Set(found)].join(', ')}`).toHaveLength(0);
  });

  it('vegano: además sin huevo ni lácteos', () => {
    const days = buildWeeklyPlan(target, { seed: 7, avoid: ['vegano'] });
    const ings = ingNames(days);
    const found = ings.filter((nv) => ANIMAL.some((t) => new RegExp(`\\b${t}\\b`).test(nv)));
    expect(found, `producto animal encontrado: ${[...new Set(found)].join(', ')}`).toHaveLength(0);
  });
});
