import { describe, it, expect } from 'vitest';
import {
  buildDayEvidence, upsertSummary, toSummary, nutritionEvidenceWindow,
  NUTRITION_SUMMARY_RETENTION_DAYS, type NutritionDaySummary,
} from '../nutritionEvidence';

// NUTRITION-N10.2A · evidencia de adherencia (no cambia calorías). Todo puro.
const K = (date: string, i: number) => `meal-${date}-${i}`;
const D = '2026-08-24';
const base = (over: Partial<Parameters<typeof buildDayEvidence>[0]> = {}) =>
  buildDayEvidence({ date: D, targetKcal: 2000, totalSlots: 5, mealChecks: {}, mealResolvedByLog: {}, foodLog: [], ...over });

describe('N10.2A · EVIDENCE class', () => {
  it('1 · 0 checks + 0 logs → NO_DATA (no es 0 intake ni non-adherencia)', () => {
    const e = base();
    expect(e.evidenceClass).toBe('NO_DATA');
    expect(e.adaptationEvidence).toBe('NONE');
    expect(e.hasLoggedEvidence).toBe(false);
  });
  it('2 · 5 checks + 0 logs → CHECK_ONLY, NO medido', () => {
    const checks = Object.fromEntries([0, 1, 2, 3, 4].map((i) => [K(D, i), true]));
    const e = base({ mealChecks: checks });
    expect(e.evidenceClass).toBe('CHECK_ONLY');
    expect(e.loggedKcal).toBe(0);
    expect(e.measuredSlots).toBe(0);
    expect(e.adaptationEvidence).toBe('NONE');   // ✓ nunca cuenta como intake medido
  });
  it('3 · 1 log en 1/5 slots → LOGGED_PARTIAL, coverage 0.2, no apto', () => {
    const e = base({ foodLog: [{ date: D, kcal: 400, mealIndex: 0 }] });
    expect(e.evidenceClass).toBe('LOGGED_PARTIAL');
    expect(e.loggedCoverage).toBe(0.2);
    expect(e.adaptationEvidence).toBe('WEAK');
  });
  it('4 · resolved-by-log gana (cuenta como medido)', () => {
    const e = base({ mealResolvedByLog: { [K(D, 1)]: true }, foodLog: [{ date: D, kcal: 300, mealIndex: 1 }] });
    expect(e.measuredSlots).toBe(1);
  });
  it('5 · food log SIN mealIndex → kcal pero NO cobertura de slot', () => {
    const e = base({ foodLog: [{ date: D, kcal: 500 }] });
    expect(e.loggedKcal).toBe(500);
    expect(e.measuredSlots).toBe(0);
    expect(e.evidenceClass).toBe('LOGGED_PARTIAL');   // hay log pero 0 cobertura
  });
  it('6 · comida extra fuera del plan → suma kcal, no suma cobertura', () => {
    const e = base({ foodLog: [{ date: D, kcal: 250, mealIndex: 9 }] }); // mealIndex fuera de rango
    expect(e.loggedKcal).toBe(250);
    expect(e.measuredSlots).toBe(0);
  });
  it('7 · ayuno explícito (log 0 kcal) ≠ NO_DATA', () => {
    const e = base({ foodLog: [{ date: D, kcal: 0 }] });
    expect(e.evidenceClass).not.toBe('NO_DATA');
    expect(e.hasLoggedEvidence).toBe(true);
  });
  it('8 · 2 logs mismo slot → agregan kcal pero slot cuenta 1', () => {
    const e = base({ foodLog: [{ date: D, kcal: 200, mealIndex: 2 }, { date: D, kcal: 150, mealIndex: 2 }] });
    expect(e.loggedKcal).toBe(350);
    expect(e.measuredSlots).toBe(1);
  });
  it('9 · logger fuerte multi-slot (3/5) → LOGGED_STRONG, STRONG', () => {
    const e = base({ foodLog: [0, 1, 2].map((i) => ({ date: D, kcal: 400, mealIndex: i })) });
    expect(e.evidenceClass).toBe('LOGGED_STRONG');
    expect(e.adaptationEvidence).toBe('STRONG');
  });
  it('10 · MIXED: logs + franjas ✓ sin medir → adaptación usa cobertura medida', () => {
    const e = base({ mealChecks: { [K(D, 3)]: true, [K(D, 4)]: true }, foodLog: [{ date: D, kcal: 400, mealIndex: 0 }] });
    expect(e.evidenceClass).toBe('MIXED');
    expect(e.checkedOnlySlots).toBe(2);
    expect(e.adaptationEvidence).toBe('WEAK'); // solo 1/5 medido
  });
});

describe('N10.2A · SUMMARY snapshot / retención', () => {
  const s = (date: string, over: Partial<NutritionDaySummary> = {}): NutritionDaySummary =>
    ({ date, targetKcal: 2000, loggedKcal: 0, measuredSlots: 0, totalSlots: 5, evidenceClass: 'NO_DATA', ...over });
  it('11 · targetKcal se congela: refresco posterior NO lo reescribe', () => {
    let list = upsertSummary([], s(D, { targetKcal: 2000 }), D);
    // N10.1 luego baja planGoal; un nuevo snapshot del MISMO día llega con 1950
    list = upsertSummary(list, s(D, { targetKcal: 1950, loggedKcal: 500 }), D);
    const day = list.find((x) => x.date === D)!;
    expect(day.targetKcal).toBe(2000);      // congelado
    expect(day.loggedKcal).toBe(500);       // evidencia sí se actualiza
  });
  it('14 · retención poda solo días viejos (>35d)', () => {
    const old = '2026-06-01'; // >35 días antes de D
    let list = upsertSummary([s(old)], s(D), D);
    expect(list.some((x) => x.date === old)).toBe(false);
    expect(list.some((x) => x.date === D)).toBe(true);
    expect(NUTRITION_SUMMARY_RETENTION_DAYS).toBe(35);
  });
  it('15/16 · determinista + no muta', () => {
    const l0: NutritionDaySummary[] = [s('2026-08-20')];
    const snap = JSON.parse(JSON.stringify(l0));
    const a = upsertSummary(l0, s(D), D); const b = upsertSummary(l0, s(D), D);
    expect(a).toEqual(b);
    expect(l0).toEqual(snap);
  });
  it('toSummary proyecta solo el subconjunto mínimo', () => {
    const ev = buildDayEvidence({ date: D, targetKcal: 2000, totalSlots: 5, mealChecks: {}, mealResolvedByLog: {}, foodLog: [{ date: D, kcal: 400, mealIndex: 0 }] });
    expect(Object.keys(toSummary(ev)).sort()).toEqual(['date', 'evidenceClass', 'loggedKcal', 'measuredSlots', 'targetKcal', 'totalSlots']);
  });
});

describe('N10.2A · WINDOW', () => {
  const s = (date: string, cls: NutritionDaySummary['evidenceClass']): NutritionDaySummary =>
    ({ date, targetKcal: 2000, loggedKcal: cls.startsWith('LOGGED') ? 1800 : 0, measuredSlots: cls === 'LOGGED_STRONG' ? 3 : 0, totalSlots: 5, evidenceClass: cls });
  const day = (i: number) => { const dt = new Date(2026, 7, 24 - i); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; };
  it('18 · NO_DATA (ausentes o clase NO_DATA) no cuentan como evidencia', () => {
    const list = [s(day(0), 'LOGGED_STRONG'), s(day(1), 'NO_DATA')]; // resto de la ventana ausente
    const w = nutritionEvidenceWindow(list, day(0), 14);
    expect(w.strongEvidenceDays).toBe(1);
    expect(w.evidenceDays).toBe(1);
    expect(w.noDataDays).toBe(13); // 14 − 1 con evidencia
  });
  it('19 · check-only no es fuerte', () => {
    const list = [0, 1, 2].map((i) => s(day(i), 'CHECK_ONLY'));
    const w = nutritionEvidenceWindow(list, day(0), 14);
    expect(w.strongEvidenceDays).toBe(0);
    expect(w.checkOnlyDays).toBe(3);
  });
  it('20 · cobertura fuerte contada bien', () => {
    const list = Array.from({ length: 14 }, (_, i) => s(day(i), i < 10 ? 'LOGGED_STRONG' : 'NO_DATA'));
    const w = nutritionEvidenceWindow(list, day(0), 14);
    expect(w.strongEvidenceDays).toBe(10);
    expect(w.windowCoverage).toBeCloseTo(10 / 14, 2);
  });
  it('21 · máx días consecutivos sin datos', () => {
    const list = [s(day(0), 'LOGGED_STRONG'), s(day(5), 'LOGGED_STRONG')]; // huecos en medio
    const w = nutritionEvidenceWindow(list, day(0), 14);
    expect(w.consecutiveNoDataMax).toBeGreaterThanOrEqual(4);
  });
});
