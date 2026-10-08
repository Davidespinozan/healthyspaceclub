import { describe, it, expect } from 'vitest';
import { calcPortionKcal, calcMealKcal, calcDayKcal } from '../kcalCalc';
import { assignPlan } from '../tdee';
import {
  targetWeightNotice, estimateTimeMonths, invalidField, mealCalorieSplit,
} from '../nutritionTargets';
import { mealPlans } from '../../data/mealPlan';

// ── CAPA 2 ───────────────────────────────────────────────────────────────────
// `computeNutritionTargets`/`calcTDEE` (C5) y `legacyMacros`/`legacyMacroWellness`/
// `parseObData` (CAPA 2) ya no existen. Los describes de macros legacy (tabla GKG,
// techo 2.4, piso de grasa 0.6 g/kg, carbos ≥ 130 g, bienestar, tope ≥ 70 y tope
// renal) se retiraron con ellas; la política nueva —incluido el tope renal que
// se conserva— se prueba en `macroPrescription.test.ts`.

/* ───────────────────────────────────────────── */
/*  Plan Assignment                              */
/* ───────────────────────────────────────────── */
describe('assignPlan (banda por meta YA calculada)', () => {
  it('2400 → planB', () => expect(assignPlan(2400)).toBe('planB'));
  it('2860 → planA', () => expect(assignPlan(2860)).toBe('planA'));
  it('1900 → planC', () => expect(assignPlan(1900)).toBe('planC'));
  it('1500 → planD', () => expect(assignPlan(1500)).toBe('planD'));
});

describe('targetWeightNotice (peso meta)', () => {
  it('CAPA 0 · D03 · la meta bajo un peso saludable ya no es un aviso: no hay `bajopeso-meta`', () => {
    const n = targetWeightNotice({ sexo: 'Mujer', pesoKg: 60, estaturaCm: 165, edad: 25, activity: 'Ligera', goal: 'Bajar grasa', pesoMeta: 48 });
    expect(n?.kind).not.toBe('bajopeso-meta');
  });

  it('sube con IMC alto pero % grasa bajo = músculo (ok)', () => {
    const n = targetWeightNotice({ sexo: 'Hombre', pesoKg: 80, estaturaCm: 178, edad: 28, activity: 'Alta', goal: 'Ganar músculo', pesoMeta: 95, grasa: 12 });
    expect(n?.kind).toBe('sube-musculo');
  });

  it('meta saludable pero lejana bajando → por etapas', () => {
    const n = targetWeightNotice({ sexo: 'Hombre', pesoKg: 100, estaturaCm: 178, edad: 30, activity: 'Moderada', goal: 'Bajar grasa', pesoMeta: 80 });
    expect(n?.kind).toBe('meta-etapas');
    expect(n?.etapaKg).toBe(92);
  });
});

describe('estimateTimeMonths', () => {
  it('bajar 10 kg → rango de meses > 0', () => {
    const r = estimateTimeMonths({ sexo: 'Hombre', pesoKg: 100, estaturaCm: 178, edad: 30, activity: 'Moderada', goal: 'Bajar grasa', pesoMeta: 90 });
    expect(r).not.toBeNull();
    expect(r!.min).toBeGreaterThanOrEqual(1);
    expect(r!.max).toBeGreaterThanOrEqual(r!.min);
  });
});

describe('invalidField (datos imposibles)', () => {
  const ok = { sexo: 'Hombre', pesoKg: 80, estaturaCm: 178, edad: 28 };
  it('datos válidos → null', () => expect(invalidField(ok)).toBeNull());
  it('edad fuera de rango', () => expect(invalidField({ ...ok, edad: 12 })).toBe('edad'));
  it('peso fuera de rango', () => expect(invalidField({ ...ok, pesoKg: 500 })).toBe('peso'));
  it('% grasa fuera de rango (hombre)', () => expect(invalidField({ ...ok, grasa: 60 })).toBe('grasa'));
  // A8 · el peso meta lo decide `classifyTargetWeight`; `invalidField` solo traduce
  // su INVALID a un código. La matriz completa vive en `targetWeightSafety.test.ts`.
  it('IMC meta 17–18,5 → aviso informativo, NO error', () => {
    // 165 cm: IMC 18,5 ≈ 50,37 kg · IMC 17 ≈ 46,28 kg
    expect(invalidField({ ...ok, pesoKg: 60, estaturaCm: 165, pesoMeta: 48 })).toBeNull();
    expect(invalidField({ ...ok, pesoKg: 60, estaturaCm: 165, pesoMeta: 50 })).toBeNull();
  });
  it('IMC meta < 17 bajando desde un peso normal → pesoMetaBajoPeso', () => {
    expect(invalidField({ ...ok, pesoKg: 60, estaturaCm: 165, pesoMeta: 45 })).toBe('pesoMetaBajoPeso');
  });
  it('ya en bajo peso y meta más baja → pesoMetaBajoPesoActual; subir → válido', () => {
    expect(invalidField({ ...ok, pesoKg: 45, estaturaCm: 165, pesoMeta: 43 })).toBe('pesoMetaBajoPesoActual');
    expect(invalidField({ ...ok, pesoKg: 43, estaturaCm: 165, pesoMeta: 45 })).toBeNull();
  });
  it('peso meta con IMC ≥ 18.5 → aceptado', () => {
    expect(invalidField({ ...ok, estaturaCm: 165, pesoMeta: 51 })).toBeNull();
    expect(invalidField({ ...ok, pesoMeta: 75 })).toBeNull();
  });
  it('rango absoluto (30–300 kg) y no finitos → pesoMeta', () => {
    expect(invalidField({ ...ok, pesoMeta: 20 })).toBe('pesoMeta');
    expect(invalidField({ ...ok, pesoMeta: 301 })).toBe('pesoMeta');
    expect(invalidField({ ...ok, pesoMeta: Number.NaN })).toBe('pesoMeta');
    expect(invalidField({ ...ok, pesoMeta: Number('53,5') })).toBe('pesoMeta');
  });
});

describe('mealCalorieSplit (25/35/25/15)', () => {
  it('suma la meta y la comida es 35%', () => {
    const s = mealCalorieSplit(2000);
    expect(s.desayuno + s.comida + s.cena + s.snacks).toBe(2000);
    expect(s.comida).toBe(700);
  });
});

/* ───────────────────────────────────────────── */
/*  Calorie Calculation                          */
/* ───────────────────────────────────────────── */
describe('calcPortionKcal', () => {
  it('200 g pechuga de pollo ≈ 330 kcal', () => {
    const kcal = calcPortionKcal('200 g pechuga de pollo');
    expect(kcal).toBeGreaterThan(250);
    expect(kcal).toBeLessThan(400);
  });

  it('2 tz arroz cocido ≈ 420 kcal', () => {
    const kcal = calcPortionKcal('2 tz arroz cocido');
    expect(kcal).toBeGreaterThan(350);
    expect(kcal).toBeLessThan(500);
  });

  it('2 pz de huevo ≈ 143 kcal', () => {
    const kcal = calcPortionKcal('2 pz de huevo');
    expect(kcal).toBeGreaterThan(100);
    expect(kcal).toBeLessThan(200);
  });

  it('salsa free items return near 0 (≤15 kcal)', () => {
    expect(calcPortionKcal('Salsa verde hecha en casa')).toBeLessThanOrEqual(15);
    expect(calcPortionKcal('Salsa de tu preferencia')).toBeLessThanOrEqual(15);
  });

  it('½ tz yogur natural sin azúcar > 0', () => {
    const kcal = calcPortionKcal('½ tz yogur natural sin azúcar');
    expect(kcal).toBeGreaterThan(20);
    expect(kcal).toBeLessThan(120);
  });
});

describe('calcMealKcal', () => {
  it('sums portion kcals correctly', () => {
    const portions = ['200 g pechuga de pollo', '2 tz arroz cocido'];
    const total = calcMealKcal(portions);
    expect(total).toBeGreaterThan(500);
    expect(total).toBeLessThan(900);
  });
});

describe('calcDayKcal', () => {
  it('planA day 1 totals fall within ±20% of 3000', () => {
    const day = mealPlans['planA'][0];
    const total = calcDayKcal(day.meals);
    expect(total).toBeGreaterThan(2200);
    expect(total).toBeLessThan(3800);
  });
});
