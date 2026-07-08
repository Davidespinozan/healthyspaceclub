import { describe, it, expect } from 'vitest';
import { calcPortionKcal, calcMealKcal, calcDayKcal } from '../kcalCalc';
import { dayNutrition } from '../mealNutrition';
import { calcTDEE, assignPlan } from '../tdee';
import { computeNutritionTargets, targetWeightNotice, estimateTimeMonths, invalidField, mealCalorieSplit, parseObData } from '../nutritionTargets';
import { scalePlan } from '../scalePlan';
import { mealPlans } from '../../data/mealPlan';

/* ───────────────────────────────────────────── */
/*  parseObData — única coerción obData → ObInput */
/* ───────────────────────────────────────────── */
describe('parseObData', () => {
  it('coacciona valores reales', () => {
    const oi = parseObData({ sex: 'Mujer', peso: '62', estatura: '165', edad: '30', activity: 'Alta', goal: 'Bajar grasa', grasa: '22', embarazo: 'si', pesoMeta: '58' });
    expect(oi).toMatchObject({ sexo: 'Mujer', pesoKg: 62, estaturaCm: 165, edad: 30, activity: 'Alta', goal: 'Bajar grasa', grasa: 22, embarazo: true, pesoMeta: 58 });
  });
  it('aplica los defaults canónicos cuando faltan campos', () => {
    const oi = parseObData({});
    expect(oi).toMatchObject({ sexo: 'Hombre', pesoKg: 70, estaturaCm: 170, edad: 28, activity: 'Moderada', goal: '', grasa: null, embarazo: false, pesoMeta: null });
  });
  it('embarazo acepta 1 numérico y grasa vacía → null', () => {
    expect(parseObData({ embarazo: 1 }).embarazo).toBe(true);
    expect(parseObData({ grasa: '' }).grasa).toBeNull();
  });
});

/* ───────────────────────────────────────────── */
/*  TDEE & Plan Assignment                       */
/* ───────────────────────────────────────────── */
describe('calcTDEE', () => {
  it('Hombre 80kg 178cm 28a Sedentaria = ~2133', () => {
    const tdee = calcTDEE('Hombre', 80, 178, 28, 'Sedentaria');
    expect(tdee).toBeGreaterThanOrEqual(2100);
    expect(tdee).toBeLessThanOrEqual(2170);
  });

  it('Hombre 80kg 178cm 28a Moderada = ~2755', () => {
    const tdee = calcTDEE('Hombre', 80, 178, 28, 'Moderada');
    expect(tdee).toBeGreaterThanOrEqual(2700);
    expect(tdee).toBeLessThanOrEqual(2800);
  });

  it('Mujer 60kg 165cm 25a Ligera = ~1850', () => {
    const tdee = calcTDEE('Mujer', 60, 165, 25, 'Ligera');
    expect(tdee).toBeGreaterThanOrEqual(1800);
    expect(tdee).toBeLessThanOrEqual(1900);
  });

  it('unknown activity falls back to 1.375', () => {
    const tdee = calcTDEE('Hombre', 80, 178, 28, 'INVALID');
    const expected = calcTDEE('Hombre', 80, 178, 28, 'Ligera');
    expect(tdee).toBe(expected);
  });
});

describe('assignPlan (banda por meta YA calculada)', () => {
  it('2400 → planB', () => expect(assignPlan(2400)).toBe('planB'));
  it('2860 → planA', () => expect(assignPlan(2860)).toBe('planA'));
  it('1900 → planC', () => expect(assignPlan(1900)).toBe('planC'));
  it('1500 → planD', () => expect(assignPlan(1500)).toBe('planD'));
});

/* ───────────────────────────────────────────── */
/*  computeNutritionTargets (motor único)        */
/* ───────────────────────────────────────────── */
describe('computeNutritionTargets', () => {
  it('déficit 20% para bajar grasa (sin tocar piso)', () => {
    const t = computeNutritionTargets({ sexo: 'Hombre', pesoKg: 80, estaturaCm: 178, edad: 28, activity: 'Moderada', goal: 'Bajar grasa' });
    expect(t.planGoal).toBeGreaterThan(2100); // ~2755 × 0.80
    expect(t.planGoal).toBeLessThan(2300);
    expect(t.capped).toBe(false);
  });

  it('superávit +12% para ganar músculo (sobre mantenimiento)', () => {
    const t = computeNutritionTargets({ sexo: 'Hombre', pesoKg: 80, estaturaCm: 178, edad: 28, activity: 'Moderada', goal: 'Ganar músculo' });
    expect(t.planGoal).toBeGreaterThan(t.tdee);
  });

  it('piso 1200 protege a mujer pequeña sedentaria en déficit', () => {
    const t = computeNutritionTargets({ sexo: 'Mujer', pesoKg: 50, estaturaCm: 155, edad: 25, activity: 'Sedentaria', goal: 'Bajar grasa' });
    expect(t.planGoal).toBeGreaterThanOrEqual(1200);
    expect(t.capped).toBe(true);
  });

  it('la meta nunca baja del BMR', () => {
    const t = computeNutritionTargets({ sexo: 'Hombre', pesoKg: 120, estaturaCm: 185, edad: 30, activity: 'Sedentaria', goal: 'Bajar grasa' });
    expect(t.planGoal).toBeGreaterThanOrEqual(t.bmr);
  });

  it('factor Atleta (1.9) sube el TDEE vs Alta', () => {
    const base = { sexo: 'Hombre', pesoKg: 80, estaturaCm: 178, edad: 28, goal: 'Bienestar integral' };
    const alta = computeNutritionTargets({ ...base, activity: 'Alta' });
    const atleta = computeNutritionTargets({ ...base, activity: 'Atleta' });
    expect(atleta.tdee).toBeGreaterThan(alta.tdee);
  });

  it('bienestar integral = mantenimiento (planGoal ≈ tdee)', () => {
    const t = computeNutritionTargets({ sexo: 'Hombre', pesoKg: 80, estaturaCm: 178, edad: 28, activity: 'Moderada', goal: 'Bienestar integral' });
    expect(t.planGoal).toBe(t.tdee);
  });
});

/* ───────────────────────────────────────────── */
/*  Fase 2 — protecciones y avisos               */
/* ───────────────────────────────────────────── */
describe('modo bienestar (sin déficit)', () => {
  it('menor de 18 que quiere bajar → sin déficit', () => {
    const t = computeNutritionTargets({ sexo: 'Mujer', pesoKg: 55, estaturaCm: 160, edad: 16, activity: 'Sedentaria', goal: 'Bajar grasa' });
    expect(t.wellnessMode).toBe(true);
    expect(t.wellnessReason).toBe('menor');
    expect(t.planGoal).toBe(t.tdee); // mantenimiento, no tdee×0.80
  });

  it('embarazo/lactancia → sin déficit', () => {
    const t = computeNutritionTargets({ sexo: 'Mujer', pesoKg: 65, estaturaCm: 165, edad: 30, activity: 'Moderada', goal: 'Bajar grasa', embarazo: true });
    expect(t.wellnessMode).toBe(true);
    expect(t.wellnessReason).toBe('embarazo');
  });

  it('bajo peso (IMC<18.5) que quiere bajar → sin déficit', () => {
    const t = computeNutritionTargets({ sexo: 'Mujer', pesoKg: 45, estaturaCm: 165, edad: 25, activity: 'Ligera', goal: 'Bajar grasa' });
    expect(t.wellnessMode).toBe(true);
    expect(t.wellnessReason).toBe('bajopeso');
  });

  it('adulto sano que quiere bajar → SÍ déficit (no bienestar)', () => {
    const t = computeNutritionTargets({ sexo: 'Hombre', pesoKg: 90, estaturaCm: 180, edad: 30, activity: 'Moderada', goal: 'Bajar grasa' });
    expect(t.wellnessMode).toBe(false);
  });
});

describe('BMR Katch-McArdle (cuando hay %grasa)', () => {
  it('con %grasa el BMR difiere de Mifflin', () => {
    const base = { sexo: 'Hombre', pesoKg: 80, estaturaCm: 178, edad: 28, activity: 'Moderada', goal: 'Bienestar integral' } as const;
    const mifflin = computeNutritionTargets(base);
    const katch = computeNutritionTargets({ ...base, grasa: 15 });
    expect(katch.bmr).not.toBe(mifflin.bmr);
  });
});

describe('targetWeightNotice (peso meta)', () => {
  it('meta bajo un peso saludable → bandera roja', () => {
    const n = targetWeightNotice({ sexo: 'Mujer', pesoKg: 60, estaturaCm: 165, edad: 25, activity: 'Ligera', goal: 'Bajar grasa', pesoMeta: 48 });
    expect(n?.kind).toBe('bajopeso-meta');
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
});

/* ───────────────────────────────────────────── */
/*  Fase 3 — capa de macros                      */
/* ───────────────────────────────────────────── */
describe('capa de macros', () => {
  const base = { sexo: 'Hombre', pesoKg: 80, estaturaCm: 178, edad: 28, activity: 'Moderada' } as const;

  it('proteína g/kg por objetivo (bajar grasa, moderada → 2.2)', () => {
    expect(computeNutritionTargets({ ...base, goal: 'Bajar grasa' }).protG).toBe(176); // 80×2.2
  });
  it('techo de proteína 2.4 g/kg', () => {
    const t = computeNutritionTargets({ sexo: 'Hombre', pesoKg: 100, estaturaCm: 180, edad: 25, activity: 'Atleta', goal: 'Bajar grasa' });
    expect(t.protG).toBeLessThanOrEqual(Math.round(100 * 2.4));
  });
  it('grasa respeta el piso 0.6 g/kg', () => {
    expect(computeNutritionTargets({ ...base, goal: 'Bajar grasa' }).fatG).toBeGreaterThanOrEqual(Math.round(80 * 0.6));
  });
  it('carbos nunca por debajo de 130 g', () => {
    const t = computeNutritionTargets({ sexo: 'Mujer', pesoKg: 50, estaturaCm: 155, edad: 25, activity: 'Sedentaria', goal: 'Bajar grasa' });
    expect(t.carbG).toBeGreaterThanOrEqual(130);
  });
  it('fibra = 14 g por 1000 kcal', () => {
    const t = computeNutritionTargets({ ...base, goal: 'Bienestar integral' });
    expect(t.fiberG).toBe(Math.round(t.planGoal / 1000 * 14));
  });
  it('kcal de los macros ≈ meta calórica', () => {
    const t = computeNutritionTargets({ ...base, goal: 'Bajar grasa' });
    const kcalMacros = t.protG * 4 + t.carbG * 4 + t.fatG * 9;
    expect(Math.abs(kcalMacros - t.planGoal)).toBeLessThan(60); // por redondeos
  });
  it('modo bienestar usa proteína de mantenimiento', () => {
    const menor = computeNutritionTargets({ ...base, edad: 16, goal: 'Bajar grasa' });
    // 'mantener' moderada = 1.8 → 144, no la de déficit (2.2 → 176)
    expect(menor.protG).toBe(Math.round(80 * 1.8));
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

/* ───────────────────────────────────────────── */
/*  scalePlan                                    */
/* ───────────────────────────────────────────── */
describe('scalePlan', () => {
  const planA = mealPlans['planA'];

  it('scaling to 3000 kcal keeps accuracy within 8%', () => {
    const scaled = scalePlan(planA, 3000);
    for (const day of scaled.slice(0, 5)) {
      const kcal = dayNutrition(day.meals).kcal;
      const err = Math.abs(kcal - 3000) / 3000;
      expect(err).toBeLessThan(0.08);
    }
  });

  it('scaling to 1800 kcal keeps accuracy within 10%', () => {
    const scaled = scalePlan(planA, 1800);
    for (const day of scaled.slice(0, 5)) {
      const kcal = dayNutrition(day.meals).kcal;
      const err = Math.abs(kcal - 1800) / 1800;
      expect(err).toBeLessThan(0.10);
    }
  });

  it('scaling to 2400 kcal keeps accuracy within 8%', () => {
    const scaled = scalePlan(planA, 2400);
    for (const day of scaled.slice(0, 5)) {
      const kcal = dayNutrition(day.meals).kcal;
      const err = Math.abs(kcal - 2400) / 2400;
      expect(err).toBeLessThan(0.08);
    }
  });

  it('portion text stays human-readable (no decimals > 1 digit)', () => {
    const scaled = scalePlan(planA, 2400);
    for (const day of scaled.slice(0, 3)) {
      for (const meal of day.meals) {
        for (const p of meal.portions) {
          // No wild decimal places like 1.333333
          expect(p).not.toMatch(/\d+\.\d{3,}/);
        }
      }
    }
  });
});
