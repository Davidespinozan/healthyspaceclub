import { describe, it, expect } from 'vitest';
import { calcPortionKcal, calcMealKcal, calcDayKcal } from '../kcalCalc';
import { assignPlan } from '../tdee';
import {
  legacyMacros, legacyMacroWellness, targetWeightNotice, estimateTimeMonths,
  invalidField, mealCalorieSplit, parseObData, type ObInput,
} from '../nutritionTargets';
import { mealPlans } from '../../data/mealPlan';

// ── CAPA 1E · FASE C5 ────────────────────────────────────────────────────────
// `computeNutritionTargets` y `calcTDEE` ya no existen: C5 retiró la energía
// legacy. Los describes que medían kcal/BMR/TDEE desaparecieron con ella; los que
// medían MACROS se migraron aquí, suministrando la energía explícitamente — que
// es el contrato de `legacyMacros` desde C1.
//
// La kcal de cada caso es la que la fórmula legacy producía para ese perfil, así
// que las aserciones siguen midiendo exactamente lo que medían.
const macros = (o: ObInput, energyKcal: number) =>
  legacyMacros(o, energyKcal, legacyMacroWellness(o));

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
/*  Plan Assignment                              */
/* ───────────────────────────────────────────── */
describe('assignPlan (banda por meta YA calculada)', () => {
  it('2400 → planB', () => expect(assignPlan(2400)).toBe('planB'));
  it('2860 → planA', () => expect(assignPlan(2860)).toBe('planA'));
  it('1900 → planC', () => expect(assignPlan(1900)).toBe('planC'));
  it('1500 → planD', () => expect(assignPlan(1500)).toBe('planD'));
});

/* ───────────────────────────────────────────── */
/*  Fase 2 — protecciones y avisos               */
/* ───────────────────────────────────────────── */
describe('predicado de bienestar macro (C5: era `wellnessMode` energético)', () => {
  // C5 · estos casos comprobaban `wellnessMode`/`wellnessReason` y «planGoal ===
  // tdee» sobre la composición legacy. La parte energética murió con ella; lo que
  // sobrevive —y es lo que afecta a las macros— es el booleano del predicado.
  const base = { sexo: 'Mujer', pesoKg: 55, estaturaCm: 160, edad: 16, activity: 'Sedentaria', goal: 'Bajar grasa' } as const;

  it('menor de 18 que quiere bajar → bienestar', () => {
    expect(legacyMacroWellness(base)).toBe(true);
  });

  it('embarazo/lactancia → bienestar', () => {
    expect(legacyMacroWellness({ sexo: 'Mujer', pesoKg: 65, estaturaCm: 165, edad: 30, activity: 'Moderada', goal: 'Bajar grasa', embarazo: true })).toBe(true);
  });

  it('bajo peso (IMC<18.5) que quiere bajar → bienestar', () => {
    expect(legacyMacroWellness({ sexo: 'Mujer', pesoKg: 45, estaturaCm: 165, edad: 25, activity: 'Ligera', goal: 'Bajar grasa' })).toBe(true);
  });

  it('adulto sano que quiere bajar → NO bienestar', () => {
    expect(legacyMacroWellness({ sexo: 'Hombre', pesoKg: 90, estaturaCm: 180, edad: 30, activity: 'Moderada', goal: 'Bajar grasa' })).toBe(false);
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

  // C5 · la kcal de cada caso es la que la fórmula legacy daba para ese perfil.
  const CUT = 2204;       // 80kg 178cm 28a Moderada, bajar grasa
  const MANTENER = 2755;  // el mismo perfil en bienestar integral
  const PISO_MUJER = 1200; // mujer 50kg 155cm sedentaria en déficit: piso de sexo

  it('proteína g/kg por objetivo (bajar grasa, moderada → 2.2)', () => {
    expect(macros({ ...base, goal: 'Bajar grasa' }, CUT).protG).toBe(176); // 80×2.2
  });
  it('techo de proteína 2.4 g/kg', () => {
    const t = macros({ sexo: 'Hombre', pesoKg: 100, estaturaCm: 180, edad: 25, activity: 'Atleta', goal: 'Bajar grasa' }, 3000);
    expect(t.protG).toBeLessThanOrEqual(Math.round(100 * 2.4));
  });
  it('grasa respeta el piso 0.6 g/kg', () => {
    expect(macros({ ...base, goal: 'Bajar grasa' }, CUT).fatG).toBeGreaterThanOrEqual(Math.round(80 * 0.6));
  });
  it('carbos nunca por debajo de 130 g', () => {
    const t = macros({ sexo: 'Mujer', pesoKg: 50, estaturaCm: 155, edad: 25, activity: 'Sedentaria', goal: 'Bajar grasa' }, PISO_MUJER);
    expect(t.carbG).toBeGreaterThanOrEqual(130);
  });
  it('fibra = 14 g por 1000 kcal', () => {
    expect(macros({ ...base, goal: 'Bienestar integral' }, MANTENER).fiberG)
      .toBe(Math.round(MANTENER / 1000 * 14));
  });
  it('kcal de los macros ≈ meta calórica', () => {
    const t = macros({ ...base, goal: 'Bajar grasa' }, CUT);
    const kcalMacros = t.protG * 4 + t.carbG * 4 + t.fatG * 9;
    expect(Math.abs(kcalMacros - CUT)).toBeLessThan(60); // por redondeos
  });
  it('modo bienestar usa proteína de mantenimiento', () => {
    const menor = macros({ ...base, edad: 16, goal: 'Bajar grasa' }, CUT);
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

describe('seguridad nutricional por edad (adultos mayores)', () => {
  // C5 · los dos casos ENERGÉTICOS de este bloque (>=70 sin déficit, 65-69 con
  // déficit suave del -10%) murieron con `legacyEnergy`. En la autoridad nueva la
  // edad no modula el déficit: 19-64 es el alcance de Nutrition V1 y fuera de él
  // no se prescribe, lo que cubre `nutritionScopeGuard.test.ts`. Lo que sobrevive
  // aquí es el tope de PROTEÍNA, que es macro y tiene su propio umbral de 70.
  it('adulto >=70 → bienestar macro (proteína de mantenimiento)', () => {
    expect(legacyMacroWellness({ sexo: 'Hombre', pesoKg: 75, estaturaCm: 172, edad: 78, activity: 'Ligera', goal: 'Bajar grasa' })).toBe(true);
  });

  it('adulto >=70 → proteína tope 2.0 g/kg pero >= anti-sarcopenia', () => {
    const t = macros({ sexo: 'Hombre', pesoKg: 80, estaturaCm: 175, edad: 82, activity: 'Alta', goal: 'Bajar grasa' }, 2400);
    const gkg = t.protG / 80;
    expect(gkg).toBeLessThanOrEqual(2.0);
    expect(gkg).toBeGreaterThanOrEqual(1.5);
  });
});

describe('condición renal (tope de proteína)', () => {
  const RENAL_BASE = { sexo: 'Hombre', pesoKg: 80, estaturaCm: 178, edad: 55, activity: 'Alta', goal: 'Bajar grasa' } as const;
  it('renal → proteína <= 1.0 g/kg (protector ERC), aunque el objetivo pida más', () => {
    const t = macros({ ...RENAL_BASE, conditions: ['renal'] }, 2600);
    expect(t.protG / 80).toBeLessThanOrEqual(1.0);
  });
  it('sin renal → proteína normal (más alta)', () => {
    expect(macros(RENAL_BASE, 2600).protG / 80).toBeGreaterThan(1.0);
  });
});
