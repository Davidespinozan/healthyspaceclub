import { describe, it, expect } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// MENÚ HSC V1 · BLOQUE 7 · AUTORIDAD DIARIA DE MACROS.
//   D1 · la banda por tiempo es una HEURÍSTICA DE ELEGIBILIDAD ×2 (12 → 24 %, pool chico 22 → 44 %); los targets por
//        tiempo son guías blandas y la autoridad final es el DÍA completo (`topUpDay` + elección del día).
//   D3 · un snack se elige por si el DÍA lo compensa (resolución conjunta de las principales con el snack fijo), no por
//        parecerse al hueco de carbo; nunca > ¾ de la principal más chica una vez compensado; nada de fruta + fruta.
//   D4 · la Pasta cerrada entra sin cambiar ni escalar su receta; las otras comidas compensan la proteína.
// ─────────────────────────────────────────────────────────────────────────────
import { BANCO } from '../../data/banco';
import {
  buildWeeklyPlan, adequateBankByTiempo, explainMainSlot, makePolicyFilter, isFruitSnack, dayCompError, snackProfileTarget,
  SLOT_BAND, SLOT_BAND_SMALL_POOL, SLOT_BAND_VARIETY, AI_SLOT_FIT, type PlanTarget,
} from '../planEngine';

const mk = (kcal: number): PlanTarget => ({ kcal, protG: Math.round((kcal * 0.28) / 4), fatG: Math.round((kcal * 0.27) / 9), carbG: Math.round((kcal * 0.45) / 4) });
const PASTA = 'Pasta con Verduras Asadas, Feta y Garbanzo';
const byName = new Map(BANCO.map((d) => [d.nombre, d]));
const sum = (meals: { macros?: { kcal: number; prot: number; fat: number; carb: number } }[], k: 'kcal' | 'prot' | 'fat' | 'carb') => meals.reduce((a, m) => a + (m.macros?.[k] ?? 0), 0);

describe('D1 · banda por tiempo ×2 (heurística de elegibilidad)', () => {
  it('×2 exacto en CODE y en el pool de la IA (×3 rechazado por QA)', () => {
    expect([SLOT_BAND, SLOT_BAND_SMALL_POOL, SLOT_BAND_VARIETY, AI_SLOT_FIT]).toEqual([24, 44, 40, 0.70]);
  });
  it('la Pasta cerrada, que solo fallaba por la proteína de SU tiempo, ya es elegible a 1500 kcal', () => {
    const x = explainMainSlot(mk(1500), 'Comida');
    const p = x.rows.find((r) => r.nombre === PASTA)!;
    expect(x.band).toBe(SLOT_BAND);
    expect(p.accepted).toBe(true);
    // La IA usa la meta por tiempo SIN el recorte a la porción habitual del motor de código: la pasta le entra a 1800.
    expect(adequateBankByTiempo([], mk(1800)).Comida.some((d) => d.nombre === PASTA)).toBe(true);
  });
});

describe('D4 · la Pasta entra sin deformarse y el DÍA compensa', () => {
  it('servida en su receta exacta; la proteína del día cierra con las otras comidas', () => {
    let seen = 0;
    for (const seed of [1, 7, 42, 99, 123, 5, 11]) for (const d of buildWeeklyPlan(mk(1500), { seed })) {
      const m = d.meals.find((x) => x.name === PASTA);
      if (!m) continue;
      seen++;
      expect(m.ings!.filter((i) => i.rol === 'principal').map((i) => i.g)).toEqual([150, 100, 40]);
      expect(m.macros!.prot).toBeLessThan(mk(1500).protG / 3);                       // la comida va baja en proteína…
      expect(Math.abs(sum(d.meals, 'prot') - mk(1500).protG) / mk(1500).protG).toBeLessThan(0.02);   // …y el día cierra
    }
    expect(seen).toBeGreaterThan(0);
  }, 180_000);
});

describe('D3 · snacks con autoridad diaria', () => {
  it('el snack se dimensiona con SU perfil (no con el del hueco)', () => {
    const d = byName.get('Rollitos de Jamón de Pavo con Queso')!;
    const t = snackProfileTarget(d, 300);
    expect(4 * t[1] + 9 * t[2] + 4 * t[3]).toBeCloseTo(300, 0);
    let p = d.fixed[1], c = d.fixed[3];
    for (const i of d.ings) if (i.rol === 'principal' && i.a) { p += i.a[1] * i.g0; c += i.a[3] * i.g0; }
    expect(t[1] / t[3]).toBeCloseTo(p / c, 3);
  });
  it('un snack que, compensado el día, quedaría mayor que ¾ de la principal más chica queda fuera de la banda', () => {
    const mains = ['Huevo a la Mexicana', 'Salmón Bowl', 'Tacos de Carne Asada'].map((n) => byName.get(n)!);
    const ctx = { T: [2200, 154, 66, 248], mains, other: [0, 0, 0, 0], holeKcal: 200, absorb: 300, maxKcal: 400 };
    expect(dayCompError([0, 4, 2, 12], ctx)).toBeLessThan(100);                // ~82 kcal
    expect(dayCompError([0, 40, 40, 120], ctx)).toBeGreaterThanOrEqual(100);   // ~1000 kcal de «snack»
  });
  it('matriz: sin fugas de restricción, sin fruta + fruta, ningún snack > 1.25× la principal más chica, día cerrado', () => {
    for (const k of [2200, 3000]) for (const strict of [[], ['lacteos']]) {
      const avoid = makePolicyFilter({ strict, soft: [] });
      const T = mk(k);
      for (const d of buildWeeklyPlan(T, { seed: 7, avoid: { strict, soft: [] } })) {
        const minMain = Math.min(...d.meals.filter((m) => !m.time.startsWith('Snack')).map((m) => m.macros!.kcal));
        for (const m of d.meals) {
          const parts = m.name.split(' + ').map((n) => byName.get(n)).filter(Boolean) as NonNullable<ReturnType<typeof byName.get>>[];
          for (const x of parts) expect(avoid(x), `${k}/${strict}: ${x.nombre}`).toBe(false);
          if (m.time.startsWith('Snack')) {
            expect(parts.filter((x) => isFruitSnack(x)).length, m.name).toBeLessThanOrEqual(1);
            expect(m.macros!.kcal, `${k}/${strict}: ${m.name}`).toBeLessThanOrEqual(1.25 * minMain);
          }
        }
        expect(Math.abs(sum(d.meals, 'kcal') - T.kcal) / T.kcal, `${k}/${strict}/d${d.day}`).toBeLessThan(0.03);
      }
    }
  }, 240_000);
});
