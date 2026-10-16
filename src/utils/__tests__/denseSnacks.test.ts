import { describe, it, expect } from 'vitest';
import { BANCO } from '../../data/banco';
import { adequateBankByTiempo, buildWeeklyPlan, snackFitsSize, DENSE_SNACK_KCAL_THRESHOLD, type PlanTarget } from '../planEngine';

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

  // MENÚ V1 · CAPA 4 · D3: los densos ya NO se filtran por un umbral de kcal del día. Están en el pool y entran solo
  // por NECESIDAD REAL: cuando su porción mínima cabe en el hueco de un snack (`snackFitsSize`).
  it('CAPA 4 · el pool de snacks trae los densos a toda meta (decide el tamaño, no un umbral)', () => {
    expect(snackPool(1800).filter(d => d.dense).length).toBe(dense.length);
    expect(snackPool(1800).length, 'el pool de snacks no debe quedar vacío').toBeGreaterThan(0);
  });

  it('CAPA 4 · un denso NUNCA es candidato para un snack chico (su mínimo no cabe), y sí para uno grande', () => {
    expect(dense.filter(d => snackFitsSize(d, 150)), 'un denso cupo en un snack de 150 kcal').toEqual([]);
    expect(dense.filter(d => snackFitsSize(d, 450)).length, 'ningún denso sirve a un snack de 450 kcal').toBeGreaterThan(0);
  });

  it('CAPA 4 · plan real con meta normal: ningún snack denso servido', () => {
    const names = new Set(dense.map(d => d.nombre));
    for (const kcal of [1450, 1800]) for (const seed of [7, 42]) {
      const served = buildWeeklyPlan({ kcal, protG: Math.round(kcal * 0.28 / 4), fatG: Math.round(kcal * 0.27 / 9), carbG: Math.round(kcal * 0.45 / 4) }, { seed })
        .flatMap(d => d.meals).filter(m => m.time.startsWith('Snack') && m.name.split(' + ').some(n => names.has(n)));
      expect(served.map(m => m.name), `${kcal}/${seed}`).toEqual([]);
    }
  }, 60_000);

  it('el pool alto = pool normal + densos (superconjunto, no reemplazo)', () => {
    const low = new Set(snackPool(2000).map(d => d.nombre));
    const high = snackPool(3200).map(d => d.nombre);
    for (const n of low) expect(high.includes(n), `meta alta perdió el snack normal ${n}`).toBe(true);
  });

  it('el umbral 2800 queda SOLO para el camino del bowl (diferido); el plan semanal ya no lo usa', () => {
    expect(typeof DENSE_SNACK_KCAL_THRESHOLD).toBe('number');
    expect(DENSE_SNACK_KCAL_THRESHOLD).toBeGreaterThan(2000);
  });

  it('los snacks normales del banco NO están marcados dense (solo se AÑADIÓ)', () => {
    const normalSnacks = BANCO.filter(d => d.tiempo === 'Snack' && !d.dense);
    expect(normalSnacks.length, 'deben seguir existiendo los snacks ligeros previos').toBeGreaterThan(5);
  });
});
