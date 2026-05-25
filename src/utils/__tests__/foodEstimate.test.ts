import { describe, it, expect } from 'vitest';
import { parseFoodEstimate, sanitizeFoodEntry } from '../foodEstimate';

describe('parseFoodEstimate', () => {
  it('JSON limpio válido → devuelve FoodEstimate', () => {
    const raw = '{"kcal": 350, "prot": 25, "carbs": 30, "fat": 12}';
    expect(parseFoodEstimate(raw)).toEqual({ kcal: 350, prot: 25, carbs: 30, fat: 12 });
  });

  it('JSON con fences ```json...``` → strip + parse OK', () => {
    const raw = '```json\n{"kcal":350,"prot":25,"carbs":30,"fat":12}\n```';
    expect(parseFoodEstimate(raw)).toEqual({ kcal: 350, prot: 25, carbs: 30, fat: 12 });
  });

  it('JSON con fences ```...``` sin language tag → strip + parse OK', () => {
    const raw = '```\n{"kcal":100,"prot":5,"carbs":10,"fat":2}\n```';
    expect(parseFoodEstimate(raw)).toEqual({ kcal: 100, prot: 5, carbs: 10, fat: 2 });
  });

  it('kcal=0 (caso "no comí nada") → válido', () => {
    const raw = '{"kcal":0,"prot":0,"carbs":0,"fat":0}';
    expect(parseFoodEstimate(raw)).toEqual({ kcal: 0, prot: 0, carbs: 0, fat: 0 });
  });

  it('JSON inválido (texto no parseable) → null', () => {
    expect(parseFoodEstimate('no soy json')).toBeNull();
    expect(parseFoodEstimate('{kcal: 350}')).toBeNull(); // sin quotes en key
  });

  it('campos faltantes → null', () => {
    expect(parseFoodEstimate('{"kcal":350,"prot":25}')).toBeNull();
    expect(parseFoodEstimate('{"kcal":350,"prot":25,"carbs":30}')).toBeNull();
  });

  it('kcal negativo → null', () => {
    const raw = '{"kcal":-100,"prot":25,"carbs":30,"fat":12}';
    expect(parseFoodEstimate(raw)).toBeNull();
  });

  it('kcal > 10000 (outlier) → null', () => {
    const raw = '{"kcal":99999,"prot":25,"carbs":30,"fat":12}';
    expect(parseFoodEstimate(raw)).toBeNull();
  });

  it('prot/carbs/fat negativo → null', () => {
    expect(parseFoodEstimate('{"kcal":350,"prot":-5,"carbs":30,"fat":12}')).toBeNull();
    expect(parseFoodEstimate('{"kcal":350,"prot":25,"carbs":-1,"fat":12}')).toBeNull();
    expect(parseFoodEstimate('{"kcal":350,"prot":25,"carbs":30,"fat":-1}')).toBeNull();
  });

  it('NaN explícito como string "NaN" → null (JSON.parse falla)', () => {
    expect(parseFoodEstimate('{"kcal":NaN,"prot":25,"carbs":30,"fat":12}')).toBeNull();
  });

  it('campo no-numérico (string en kcal) → null', () => {
    const raw = '{"kcal":"trescientos","prot":25,"carbs":30,"fat":12}';
    expect(parseFoodEstimate(raw)).toBeNull();
  });

  it('null o array como top-level → null', () => {
    expect(parseFoodEstimate('null')).toBeNull();
    expect(parseFoodEstimate('[1,2,3]')).toBeNull();
  });

  it('string vacío o solo espacios → null', () => {
    expect(parseFoodEstimate('')).toBeNull();
    expect(parseFoodEstimate('   ')).toBeNull();
    expect(parseFoodEstimate('```\n```')).toBeNull();
  });
});

describe('sanitizeFoodEntry', () => {
  it('shape canónico → todos los campos preservados, source incluido', () => {
    const estimate = { kcal: 350, prot: 25, carbs: 30, fat: 12 };
    expect(sanitizeFoodEntry(estimate, 'pollo asado', 'ai')).toEqual({
      desc: 'pollo asado',
      kcal: 350, prot: 25, carbs: 30, fat: 12,
      source: 'ai',
    });
  });

  it('redondea kcal a integer (la columna SQL es integer)', () => {
    const estimate = { kcal: 347.6, prot: 25, carbs: 30, fat: 12 };
    expect(sanitizeFoodEntry(estimate, 'x', 'ai').kcal).toBe(348);
  });

  it('redondea prot/carbs/fat a 1 decimal', () => {
    const estimate = { kcal: 350, prot: 25.456, carbs: 30.991, fat: 12.04 };
    const result = sanitizeFoodEntry(estimate, 'x', 'ai');
    expect(result.prot).toBe(25.5);
    expect(result.carbs).toBe(31.0);
    expect(result.fat).toBe(12.0);
  });

  it('clamp defensivo: kcal > 10000 → 10000', () => {
    const estimate = { kcal: 15000, prot: 0, carbs: 0, fat: 0 };
    expect(sanitizeFoodEntry(estimate, 'x', 'ai').kcal).toBe(10000);
  });

  it('clamp defensivo: macros negativos → 0', () => {
    const estimate = { kcal: 100, prot: -5, carbs: -1, fat: -2 };
    const result = sanitizeFoodEntry(estimate, 'x', 'ai');
    expect(result.prot).toBe(0);
    expect(result.carbs).toBe(0);
    expect(result.fat).toBe(0);
  });

  it('source manual se preserva', () => {
    const estimate = { kcal: 100, prot: 5, carbs: 10, fat: 2 };
    expect(sanitizeFoodEntry(estimate, 'x', 'manual').source).toBe('manual');
  });

  it('desc se preserva tal cual (no trim/case)', () => {
    const estimate = { kcal: 100, prot: 5, carbs: 10, fat: 2 };
    expect(sanitizeFoodEntry(estimate, '  Pizza Margarita  ', 'ai').desc).toBe('  Pizza Margarita  ');
  });
});
