import { describe, it, expect } from 'vitest';
import { BANCO } from '../../data/banco';
import { adequateBankByTiempo, DENSE_SNACK_KCAL_THRESHOLD, type PlanTarget } from '../planEngine';

const dense = BANCO.filter(d => d.dense);
const target = (kcal: number): PlanTarget => ({ kcal, protG: Math.round(kcal * 0.075), fatG: Math.round(kcal * 0.03), carbG: Math.round(kcal * 0.11) });
const snackPool = (kcal: number) => adequateBankByTiempo([], target(kcal), '').Snack;

describe('Snacks densos · marca y gating por requerimiento calórico', () => {
  it('el banco tiene 50 snacks densos, todos tiempo=Snack y con foto', () => {
    expect(dense.length).toBe(50);
    for (const d of dense) {
      expect(d.tiempo, `${d.nombre} debe ser Snack`).toBe('Snack');
      expect(d.img.endsWith('.webp'), `${d.nombre} sin .webp`).toBe(true);
    }
  });

  it('SOLO los snacks tienen la marca dense (nada en Desayuno/Comida/Cena)', () => {
    const denseNonSnack = BANCO.filter(d => d.dense && d.tiempo !== 'Snack');
    expect(denseNonSnack.map(d => d.nombre)).toEqual([]);
  });

  it('con requerimiento NORMAL (< umbral) NINGÚN snack denso entra al pool', () => {
    const pool = snackPool(DENSE_SNACK_KCAL_THRESHOLD - 300);
    expect(pool.some(d => d.dense), 'un denso se coló bajo el umbral').toBe(false);
    expect(pool.length, 'el pool normal de snacks no debe quedar vacío').toBeGreaterThan(0);
  });

  it('con requerimiento ALTO (≥ umbral) los snacks densos SÍ entran al pool', () => {
    const pool = snackPool(DENSE_SNACK_KCAL_THRESHOLD + 400);
    expect(pool.filter(d => d.dense).length, 'no aparecieron densos con meta alta').toBeGreaterThan(0);
  });

  it('el pool alto = pool normal + densos (superconjunto, no reemplazo)', () => {
    const low = new Set(snackPool(2000).map(d => d.nombre));
    const high = snackPool(3200).map(d => d.nombre);
    for (const n of low) expect(high.includes(n), `meta alta perdió el snack normal ${n}`).toBe(true);
  });

  it('el umbral es un valor único configurable (provisional)', () => {
    expect(typeof DENSE_SNACK_KCAL_THRESHOLD).toBe('number');
    expect(DENSE_SNACK_KCAL_THRESHOLD).toBeGreaterThan(2000);
  });

  it('los snacks normales del banco NO están marcados dense (solo se AÑADIÓ)', () => {
    const normalSnacks = BANCO.filter(d => d.tiempo === 'Snack' && !d.dense);
    expect(normalSnacks.length, 'deben seguir existiendo los snacks ligeros previos').toBeGreaterThan(5);
  });
});
