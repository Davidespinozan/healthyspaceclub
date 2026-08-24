import { describe, it, expect } from 'vitest';
import { portionStr, buildWeeklyPlan, type PlanTarget } from '../planEngine';
import type { BancoIng } from '../../data/banco';

// ─────────────────────────────────────────────────────────────────────────────
// NUTRITION-N6 · realismo de porciones contables (fix de DESPLIEGUE, no del solver).
//
// Piezas WHOLE_ONLY (huevo, dátil, aceituna, cereza, sardina, tortilla, tostada) se cuentan
// SIEMPRE enteras — nunca "3½ dátiles" ni "1½ tortillas". La cortable (aguacate, plátano…)
// conserva fracciones finas; el pan/pita/bagel/fruta grande conserva medios.
//
// Contrato de honestidad (intacto): el entero se muestra SOLO si |n·pu − g| ≤ 20 %·g; si un
// entero mentiría sobre los gramos reales del solver, se cae a GRAMOS (nunca un entero falso).
// Los gramos del solver NO se tocan (solo el huevo cuadra gramos↔pieza, como siempre).
// ─────────────────────────────────────────────────────────────────────────────

const FRAC = /[¼⅓½⅔¾]/;                 // cualquier fracción visible
const isGrams = (s: string) => /\d+\s*g\b/.test(s);
const isFractional = (s: string) => FRAC.test(s) || /\b\d+\.\d/.test(s);
const ing = (un: string, pu: number, nv = un, rol = 'principal'): BancoIng => ({ nv, rol, g0: pu, pu, un });

// pu reales del banco (peso por pieza).
const WHOLE: Array<[string, number]> = [
  ['huevo', 46], ['dátil', 8.5], ['aceituna', 5], ['cereza', 4.4],
  ['sardinas', 12], ['tortilla', 30], ['tostada', 10],
];

describe('N6 · WHOLE_ONLY nunca renderiza fracción de pieza', () => {
  for (const [un, pu] of WHOLE) {
    it(`${un}: barrido 0.5–8 piezas → jamás fracción (entero o gramos)`, () => {
      for (let k = 0.5; k <= 8; k += 0.05) {
        const s = portionStr(ing(un, pu), k * pu);
        expect(isFractional(s), `"${s}" (@${(k * pu).toFixed(1)}g) no debe traer fracción`).toBe(false);
        // salida legítima: conteo entero de piezas O gramos — nunca otra cosa.
        expect(isGrams(s) || /^\d+\s/.test(s), `"${s}" debe ser entero-pieza o gramos`).toBe(true);
      }
    });
    it(`${un}: conteo limpio (×3) → entero honesto, sin fracción`, () => {
      const s = portionStr(ing(un, pu), 3 * pu);
      expect(isFractional(s)).toBe(false);
      expect(s).toMatch(/^3\s/);
    });
    it(`${un}: ~1.5 piezas (el entero mentiría >20%) → cae a GRAMOS, no entero falso`, () => {
      const s = portionStr(ing(un, pu), 1.5 * pu);
      expect(isGrams(s), `"${s}" debe caer a gramos`).toBe(true);
      expect(isFractional(s)).toBe(false);
    });
  }
});

describe('N6 · comportamientos NO tocados (regresión)', () => {
  it('cortable (aguacate) conserva fracción fina: ½ aguacate', () => {
    expect(portionStr(ing('aguacate', 150), 0.5 * 150)).toMatch(FRAC);
  });
  it('cortable (plátano) conserva fracción: ⅓ plátano', () => {
    expect(portionStr(ing('plátano', 120), (1 / 3) * 120)).toMatch(FRAC);
  });
  it('fruta grande halveable (manzana) conserva el medio: 1½ manzanas', () => {
    expect(portionStr(ing('manzana', 150), 1.5 * 150)).toMatch(FRAC);
  });
  it('pan pita conserva el medio: ½ pita', () => {
    expect(portionStr(ing('pan pita', 60), 0.5 * 60)).toMatch(FRAC);
  });
});

// ── §3 barrido sobre el motor REAL: ninguna porción contable-entera sale fraccionada ──
const KW = /(tortilla|tostada|d[aá]til|aceituna|cereza|sardina|huevo)/i;
function parts(raw: string): string[] {
  return raw.replace(/^[^:]+:\s*/, '').split(/\s+\+\s+/).map((p) => p.trim());
}
const mk = (kcal: number): PlanTarget => ({
  kcal, protG: Math.round((kcal * 0.3) / 4), fatG: Math.round((kcal * 0.27) / 9), carbG: Math.round((kcal * 0.43) / 4),
});

describe('N6 · plan generado real: 0 piezas contables fraccionadas', () => {
  it('barrido determinista kcal × perfiles × seeds', () => {
    const TIERS = [1450, 1800, 2200, 2800, 3500];
    const PROFILES: Array<[string, string[]]> = [
      ['normal', []], ['vegetariano', ['vegetariano']], ['vegano', ['vegano']], ['sinHuevo', ['huevo']],
    ];
    // 2 seeds (antes 3): N7 adelgazó el pool vegano/vegetariano (quita "Tacos de Carne Asada"),
    // lo que sube ~4s el tiempo de generación de este barrido y lo empujaba sobre el testTimeout
    // global de 20s. 280 días × 4 perfiles × 5 tiers siguen anclando el invariante 0-fraccional.
    const SEEDS = [7, 42];
    const offenders: string[] = [];
    let days = 0;
    for (const kcal of TIERS) for (const [, avoid] of PROFILES) for (const seed of SEEDS) {
      for (const d of buildWeeklyPlan(mk(kcal), { seed, avoid })) {
        days++;
        for (const m of d.meals) for (const raw of m.portions ?? []) {
          for (const p of parts(raw)) {
            if (!KW.test(p)) continue;
            if (isGrams(p)) continue;                 // gramos = honesto, permitido
            if (isFractional(p)) offenders.push(p);   // pieza contable con fracción = fallo
          }
        }
      }
    }
    expect(days).toBeGreaterThan(250);   // 280 días (5 tiers × 4 perfiles × 2 seeds)
    expect(offenders, `piezas contables fraccionadas: ${[...new Set(offenders)].slice(0, 12).join(' · ')}`).toEqual([]);
  });
});

// ── §4 los gramos del solver son deterministas y no se tocan por el despliegue ──
describe('N6 · gramos/macros deterministas (display no altera el motor)', () => {
  it('misma semilla → gramos y macros idénticos', () => {
    const t = mk(2200);
    const a = buildWeeklyPlan(t, { seed: 55 });
    const b = buildWeeklyPlan(t, { seed: 55 });
    const gramsOf = (plan: typeof a) => plan.flatMap((d) => d.meals.flatMap((m) => (m.ings ?? []).map((i) => i.g)));
    const macrosOf = (plan: typeof a) => plan.flatMap((d) => d.meals.map((m) => m.macros?.kcal ?? null));
    expect(gramsOf(a)).toEqual(gramsOf(b));
    expect(macrosOf(a)).toEqual(macrosOf(b));
  });
});
