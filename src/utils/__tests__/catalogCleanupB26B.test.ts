import { describe, it, expect } from 'vitest';
import foodsCsv from '../../../docs/nutricion/foods.csv?raw';
import { BANCO } from '../../data/banco';

// ─────────────────────────────────────────────────────────────────────────────
// B2.6B · Catalog Cleanup — las nueve correcciones de ALTA confianza del catálogo
// (`docs/nutricion/foods.csv`) y su consecuencia en el banco GENERADO
// (`scripts/gen_banco.py` → `src/data/banco.ts`).
//
// Los valores del CSV son por PORCIÓN (`peso_neto_g`), no por 100 g. El generador
// copia la columna `kcal` tal cual: los defectos estaban solo en las macros, así que
// la kcal de cada platillo NO cambia; P/G/HC sí.
// ─────────────────────────────────────────────────────────────────────────────

const lines = foodsCsv.replace(/^﻿/, '').split(/\r?\n/);
const header = lines[0].split(',');
const col = (name: string) => header.indexOf(name);
function row(id: string): string[] {
  const hits = lines.filter((l) => l.startsWith(`${id},`)).map((l) => l.split(','));
  expect(hits).toHaveLength(1);
  return hits[0];
}
const n = (r: string[], c: string) => Number(r[col(c)]);

/** Mismo cálculo que gen_banco.py: por gramo = valor × 100 / peso_neto, ÷ 100, a 5 decimales. */
function perGram(r: string[]): number[] {
  const pn = n(r, 'peso_neto_g');
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  const r5 = (x: number) => Math.round(x * 1e5) / 1e5;
  return ['kcal', 'prot_g', 'lip_g', 'hc_g', 'fibra_g'].map((c) => r5(r3((n(r, c) * 100) / pn) / 100));
}
const atwater = (r: string[]) => 4 * n(r, 'prot_g') + 9 * n(r, 'lip_g') + 4 * n(r, 'hc_g');

const CORRECTED: Record<string, Record<string, number>> = {
  'nuez-entera': { prot_g: 0.9 },
  'mayonesa-light': { lip_g: 9.5, hc_g: 1.9 },
  'espagueti-cocido': { lip_g: 0.3 },
  jitomate: { lip_g: 0.2 },
  toronja: { lip_g: 0.2 },
  pera: { lip_g: 0.1 },
  'camote-cocido': { lip_g: 0.2 },
  'cereal-kelloggs-corn-flakes': { lip_g: 0.2 },
  'jugo-de-naranja-natural': { prot_g: 0.8 },
};

describe('B2.6B · catálogo fuente corregido', () => {
  it.each(Object.entries(CORRECTED))('%s trae los valores corregidos', (id, fields) => {
    const r = row(id);
    for (const [c, v] of Object.entries(fields)) expect(n(r, c)).toBe(v);
  });

  it('mayonesa-light: sin el azúcar 9.5 corrupto (vacío: no hay fuente confiable)', () => {
    expect(row('mayonesa-light')[col('azucar_g')]).toBe('');
  });

  // ±15 %: con carbohidrato TOTAL (fibra a 4 kcal/g) las verduras/frutas fibrosas quedan algo
  // por ENCIMA de su kcal (jitomate 23.8 vs 21, +13 %; antes de corregir era 40 vs 21, +90 %).
  it('cada fila corregida queda Atwater-plausible frente a su kcal (TOTAL_CARB_ATWATER, ±15 %)', () => {
    for (const id of Object.keys(CORRECTED)) {
      const r = row(id);
      expect(Math.abs(atwater(r) - n(r, 'kcal')) / n(r, 'kcal'), id).toBeLessThanOrEqual(0.15);
    }
  });

  it('espagueti-cocido: la fila ganadora (primera por nombre) ya coincide con su duplicado -2', () => {
    const [a, b] = [row('espagueti-cocido'), row('espagueti-cocido-2')];
    expect(a[col('alimento')]).toBe(b[col('alimento')]);
    expect(n(a, 'lip_g')).toBe(n(b, 'lip_g'));
  });
});

describe('B2.6B · banco regenerado desde el catálogo corregido', () => {
  const dish = (name: string) => {
    const d = BANCO.find((x) => x.nombre === name);
    expect(d, name).toBeDefined();
    return d!;
  };
  const CASES: [string, string, string][] = [
    ['Toronja', 'Toronja', 'toronja'],
    ['Pera', 'Pera', 'pera'],
    ['Espagueti a la Boloñesa', 'Espagueti', 'espagueti-cocido'],
    ['Hot Cakes de Camote', 'Camote cocido', 'camote-cocido'],
    ['Milanesa de Pollo al Horno con Ensalada', 'Corn flakes triturados', 'cereal-kelloggs-corn-flakes'],
    ['Gouda con Nueces y Dátiles', 'Nueces', 'nuez-entera'],
  ];
  it.each(CASES)('%s · «%s» usa el por-gramo del catálogo corregido', (name, nv, id) => {
    const ing = dish(name).ings.find((i) => i.nv === nv && i.rol === 'principal');
    expect(ing?.a).toEqual(perGram(row(id)));
  });

  it('platillos afectados: totales finitos y positivos', () => {
    const AFFECTED = [
      'Toronja', 'Pera', 'Espagueti a la Boloñesa', 'Hot Cakes de Camote', 'Milanesa de Pollo al Horno con Ensalada',
      'Gouda con Nueces y Dátiles', 'Cottage con Nuez, Pera y Miel', 'Tostadas de Atún', 'Huevos Rancheros',
      'Pollo a la Naranja con Arroz',
    ];
    for (const name of AFFECTED) {
      const d = dish(name);
      const tot = [...d.fixed];
      for (const i of d.ings) if (i.a) i.a.forEach((v, k) => { tot[k] += v * i.g0; });
      expect(tot.every((v) => Number.isFinite(v) && v >= 0), name).toBe(true);
      expect(tot[0], name).toBeGreaterThan(0);
    }
  });

  it('ningún ingrediente del banco conserva el por-gramo legacy de nuez (prot 1 g/g) ni de toronja (grasa 2/162)', () => {
    const all = BANCO.flatMap((d) => d.ings).filter((i) => i.a);
    expect(all.some((i) => i.a![1] === 1 && i.nv === 'Nueces')).toBe(false);
    expect(all.some((i) => i.nv === 'Toronja' && i.a![2] === 0.01235)).toBe(false);
  });
});
