import { describe, it, expect } from 'vitest';
import {
  extractDateAndIndex,
  mergeMealProgress,
  pruneMealProgressFromDate,
} from '../mealProgressSync';

describe('extractDateAndIndex', () => {
  it('parsea key válido meal-YYYY-MM-DD-N', () => {
    expect(extractDateAndIndex('meal-2026-05-26-0')).toEqual({ date: '2026-05-26', index: 0 });
    expect(extractDateAndIndex('meal-2026-12-31-4')).toEqual({ date: '2026-12-31', index: 4 });
  });

  it('parsea índice de 2 dígitos', () => {
    expect(extractDateAndIndex('meal-2026-05-26-10')).toEqual({ date: '2026-05-26', index: 10 });
  });

  it('rechaza key sin prefijo meal-', () => {
    expect(extractDateAndIndex('shop-0')).toBeNull();
    expect(extractDateAndIndex('foo-bar-baz')).toBeNull();
  });

  it('rechaza fecha malformada', () => {
    expect(extractDateAndIndex('meal-26-05-26-0')).toBeNull();   // 8 chars
    expect(extractDateAndIndex('meal-202605260-0')).toBeNull();  // sin guiones
  });

  it('rechaza índice no numérico', () => {
    expect(extractDateAndIndex('meal-2026-05-26-abc')).toBeNull();
  });

  it('rechaza key vacío o sin índice', () => {
    expect(extractDateAndIndex('meal-')).toBeNull();
    expect(extractDateAndIndex('meal-2026-05-26-')).toBeNull();
  });
});

describe('mergeMealProgress — política "true wins"', () => {
  it('ambos vacíos → merged vacío, sin push', () => {
    const r = mergeMealProgress(
      { mealChecks: {}, mealResolvedByLog: {} },
      [],
    );
    expect(r.merged).toEqual({ mealChecks: {}, mealResolvedByLog: {} });
    expect(r.toPush).toEqual([]);
  });

  it('local check, remote vacío → merged con check, push para subir', () => {
    const r = mergeMealProgress(
      { mealChecks: { 'meal-2026-05-26-0': true }, mealResolvedByLog: {} },
      [],
    );
    expect(r.merged.mealChecks).toEqual({ 'meal-2026-05-26-0': true });
    expect(r.toPush).toEqual([
      { date: '2026-05-26', meal_index: 0, checked: true, resolved_by_log: false },
    ]);
  });

  it('remote check, local vacío → merged con check, sin push (ya está en remote)', () => {
    const r = mergeMealProgress(
      { mealChecks: {}, mealResolvedByLog: {} },
      [{ date: '2026-05-26', meal_index: 0, checked: true, resolved_by_log: false }],
    );
    expect(r.merged.mealChecks).toEqual({ 'meal-2026-05-26-0': true });
    expect(r.toPush).toEqual([]);
  });

  it('local y remote coinciden con check → merged con check, sin push', () => {
    const r = mergeMealProgress(
      { mealChecks: { 'meal-2026-05-26-0': true }, mealResolvedByLog: {} },
      [{ date: '2026-05-26', meal_index: 0, checked: true, resolved_by_log: false }],
    );
    expect(r.merged.mealChecks).toEqual({ 'meal-2026-05-26-0': true });
    expect(r.toPush).toEqual([]);
  });

  it('local checked, remote resolved → merged con AMBOS true, push (true wins en cada flag)', () => {
    const r = mergeMealProgress(
      { mealChecks: { 'meal-2026-05-26-0': true }, mealResolvedByLog: {} },
      [{ date: '2026-05-26', meal_index: 0, checked: false, resolved_by_log: true }],
    );
    expect(r.merged.mealChecks).toEqual({ 'meal-2026-05-26-0': true });
    expect(r.merged.mealResolvedByLog).toEqual({ 'meal-2026-05-26-0': true });
    expect(r.toPush).toEqual([
      { date: '2026-05-26', meal_index: 0, checked: true, resolved_by_log: true },
    ]);
  });

  it('uncheck stale: local sin check, remote con check → check "wins" (no se pierde)', () => {
    const r = mergeMealProgress(
      { mealChecks: {}, mealResolvedByLog: {} },
      [{ date: '2026-05-26', meal_index: 2, checked: true, resolved_by_log: false }],
    );
    // Política "true wins": el check del remote sobrevive
    expect(r.merged.mealChecks).toEqual({ 'meal-2026-05-26-2': true });
    expect(r.toPush).toEqual([]);
  });

  it('múltiples slots: 2 locales + 2 remotos no superpuestos → merged contiene 4, push de los 2 locales', () => {
    const r = mergeMealProgress(
      {
        mealChecks: { 'meal-2026-05-26-0': true },
        mealResolvedByLog: { 'meal-2026-05-26-1': true },
      },
      [
        { date: '2026-05-26', meal_index: 2, checked: true, resolved_by_log: false },
        { date: '2026-05-26', meal_index: 3, checked: false, resolved_by_log: true },
      ],
    );
    expect(r.merged.mealChecks).toEqual({
      'meal-2026-05-26-0': true,
      'meal-2026-05-26-2': true,
    });
    expect(r.merged.mealResolvedByLog).toEqual({
      'meal-2026-05-26-1': true,
      'meal-2026-05-26-3': true,
    });
    expect(r.toPush).toHaveLength(2);
    expect(r.toPush).toContainEqual({ date: '2026-05-26', meal_index: 0, checked: true, resolved_by_log: false });
    expect(r.toPush).toContainEqual({ date: '2026-05-26', meal_index: 1, checked: false, resolved_by_log: true });
  });

  it('ignora keys que no son de meal_progress (ej. shop-0)', () => {
    const r = mergeMealProgress(
      { mealChecks: { 'shop-0': true, 'meal-2026-05-26-0': true }, mealResolvedByLog: {} },
      [],
    );
    // shop- no se mergea ni se pushea
    expect(r.merged.mealChecks).toEqual({ 'meal-2026-05-26-0': true });
    expect(r.toPush).toEqual([
      { date: '2026-05-26', meal_index: 0, checked: true, resolved_by_log: false },
    ]);
  });
});

describe('pruneMealProgressFromDate', () => {
  it('elimina entradas con fecha >= fromDate, conserva las anteriores', () => {
    const records = {
      mealChecks: {
        'meal-2026-05-24-0': true, // pasado: queda
        'meal-2026-05-25-1': true, // pasado: queda
        'meal-2026-05-26-2': true, // hoy: se va
        'meal-2026-05-27-3': true, // futuro: se va
      },
      mealResolvedByLog: {
        'meal-2026-05-24-0': true as const, // pasado: queda
        'meal-2026-05-26-1': true as const, // hoy: se va
      },
    };
    const r = pruneMealProgressFromDate(records, '2026-05-26');
    expect(r.mealChecks).toEqual({
      'meal-2026-05-24-0': true,
      'meal-2026-05-25-1': true,
    });
    expect(r.mealResolvedByLog).toEqual({
      'meal-2026-05-24-0': true,
    });
  });

  it('conserva keys que no parsean (ej. shop-)', () => {
    const records = {
      mealChecks: { 'shop-0': true, 'meal-2026-05-26-0': true },
      mealResolvedByLog: {},
    };
    const r = pruneMealProgressFromDate(records, '2026-05-26');
    expect(r.mealChecks).toEqual({ 'shop-0': true });
  });

  it('fromDate en el futuro → conserva todo', () => {
    const records = {
      mealChecks: { 'meal-2026-05-26-0': true },
      mealResolvedByLog: { 'meal-2026-05-26-1': true as const },
    };
    const r = pruneMealProgressFromDate(records, '2099-01-01');
    expect(r).toEqual(records);
  });
});
