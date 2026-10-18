import { describe, it, expect } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// MENÚ HSC V1 · BLOQUE 7B · RENDIMIENTO SIN CAMBIAR RESULTADOS.
//   · `ingBounds` / techo preferido / plantillas de `prep` memoizados por objeto del banco (inmutable).
//   · `fitSlot` resuelve UNA vez cada combinación de platillos por llamada (los intentos al azar se repetían).
//   · Cota inferior barata de `dayCompError`: descarta sin resolver solo snacks que NO pueden entrar en la banda.
//   · IA: salida temprana exacta al rankear snacks.
// La paridad byte a byte contra el Bloque 7 original (a70b73d) se verificó en QA; aquí quedan las GARANTÍAS que la
// sostienen y la regresión de la Pasta cerrada.
// ─────────────────────────────────────────────────────────────────────────────
import { BANCO } from '../../data/banco';
import {
  buildWeeklyPlan, ingBounds, dayCompError, dayCompLowerBound, type PlanTarget, type SnackDayCtx,
} from '../planEngine';

const mk = (kcal: number): PlanTarget => ({ kcal, protG: Math.round((kcal * 0.28) / 4), fatG: Math.round((kcal * 0.27) / 9), carbG: Math.round((kcal * 0.45) / 4) });
const byName = new Map(BANCO.map((d) => [d.nombre, d]));
const PASTA = 'Pasta con Verduras Asadas, Feta y Garbanzo';
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

describe('memoización pura', () => {
  it('ingBounds memoizado: mismo valor siempre y el objeto devuelto no comparte estado', () => {
    for (const d of BANCO) for (const i of d.ings) {
      if (i.rol !== 'principal' || !i.a) continue;
      const a = ingBounds(i);
      a.lo = -1; a.hi = -1;                     // mutar la copia no corrompe el memo
      const b = ingBounds(i);
      expect(b.lo).toBeGreaterThanOrEqual(0);
      expect(b.hi).toBeGreaterThanOrEqual(i.g0);
      expect(ingBounds(i)).toEqual(b);
    }
  });
});

describe('cota inferior de dayCompError (base del descarte sin resolver)', () => {
  it('NUNCA supera el error real: 600 casos al azar sobre principales y snacks reales', () => {
    const R = rng(7);
    const by = (t: string) => BANCO.filter((d) => d.tiempo === t && d.ings.some((i) => i.rol === 'principal' && i.a));
    const D = by('Desayuno'), C = by('Comida'), N = by('Cena');
    let checked = 0, tooBig = 0;
    for (let n = 0; n < 600; n++) {
      const mains = [D[Math.floor(R() * D.length)], C[Math.floor(R() * C.length)], N[Math.floor(R() * N.length)]];
      const k = 1500 + Math.floor(R() * 2000);
      const T = mk(k);
      const ctx: SnackDayCtx = { T: [T.kcal, T.protG, T.fatG, T.carbG], mains, other: [0, R() * 20, R() * 10, R() * 40], holeKcal: 200, absorb: 300, maxKcal: 400 };
      const m = [0, R() * 40, R() * 30, R() * 90];
      const lb = dayCompLowerBound(m, ctx), e = dayCompError(m, ctx);
      expect(lb, `caso ${n}`).toBeLessThanOrEqual(e + 1e-9);
      checked++; if (lb >= 100) tooBig++;
    }
    expect(checked).toBe(600);
    expect(tooBig).toBeGreaterThan(0);          // el atajo del castigo de tamaño también se ejercita
  });
});

describe('regresión · la Pasta cerrada sigue entrando y el día cierra', () => {
  it('1500 kcal sin restricciones: aparece, receta exacta, sin deformarse, día cerrado en kcal y proteína', () => {
    let seen = 0;
    for (const seed of [1, 7, 42, 99, 123]) for (const d of buildWeeklyPlan(mk(1500), { seed })) {
      const m = d.meals.find((x) => x.name === PASTA);
      if (!m) continue;
      seen++;
      const pasta = byName.get(PASTA)!;
      expect(m.ings!.map((i) => [i.nv, i.g])).toEqual(pasta.ings.map((i) => [i.nv, i.rol === 'condimento' ? null : i.g0]));
      const T = mk(1500);
      const tot = (k: 'kcal' | 'prot') => d.meals.reduce((a, x) => a + (x.macros?.[k] ?? 0), 0);
      expect(Math.abs(tot('kcal') - T.kcal) / T.kcal).toBeLessThan(0.02);
      expect(Math.abs(tot('prot') - T.protG) / T.protG).toBeLessThan(0.02);
    }
    expect(seen).toBeGreaterThanOrEqual(3);     // QA del Bloque 7: 4 apariciones en estas 5 semanas
  }, 180_000);
});
