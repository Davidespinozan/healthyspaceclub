import { describe, it, expect } from 'vitest';
import srcTargets from '../nutritionTargets.ts?raw';
import srcOnboarding from '../../screens/OnboardingScreen.tsx?raw';
import srcEdit from '../../components/sheets/EditDataSheet.tsx?raw';
import srcSafety from '../targetWeightSafety.ts?raw';
import {
  classifyTargetWeight,
  targetWeightSafetyFrom,
  isAcceptedTargetWeight,
  InvalidTargetWeightContextError,
  type TargetWeightSafety,
} from '../targetWeightSafety';
import { resolveNutritionEnergyState, buildEnergySnapshot, ENERGY_IDENTITY_FIELDS } from '../nutritionEnergyState';
import { resolveMacroPrescription } from '../macroPrescription';
import { decideEnergyHydration } from '../energyHydration';
import { weeklyPlanCurrentness } from '../weeklyPlanState';
import { PLAN_ENGINE_VERSION } from '../planEngine';

// ─────────────────────────────────────────────────────────────────────────────
// CARRIL A · A8 · TARGET WEIGHT SAFETY
//
// IMC = barandilla de seguridad de producto, no diagnóstico. El peso meta no es
// autoridad energética ni de macros.
// ─────────────────────────────────────────────────────────────────────────────

const sinComentarios = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !l.trim().startsWith('//'))
    .map((l) => l.replace(/\/\/.*$/, '')).join('\n');

const c = (currentWeightKg: number, heightCm: number, targetWeightKg: number): TargetWeightSafety =>
  classifyTargetWeight({ currentWeightKg, heightCm, targetWeightKg });
const kgAt = (bmi: number, heightCm: number) => bmi * (heightCm / 100) ** 2;

// ═════════════════════════════════════════════════════════════════════════════
// A · EJEMPLOS DE LA POLÍTICA
// ═════════════════════════════════════════════════════════════════════════════
describe('A8 · A · ejemplos cerrados (1,65 m)', () => {
  it('1 · 58 → 53 kg (IMC ≈ 19,5) → VALID', () => expect(c(58, 165, 53).status).toBe('VALID'));
  it('2 · 58 → 50 kg (IMC ≈ 18,4) → VALID_WITH_LOW_BMI_NOTICE', () => expect(c(58, 165, 50).status).toBe('VALID_WITH_LOW_BMI_NOTICE'));
  it('3 · 58 → 45 kg (IMC ≈ 16,5) → INVALID', () => {
    const r = c(58, 165, 45);
    expect(r.status).toBe('INVALID');
    expect(r.reason).toBe('TARGET_BMI_TOO_LOW');
  });
  it('4 · 45 → 48 kg (actual ≈ 16,5) → VALID_GAIN_DIRECTION', () => expect(c(45, 165, 48).status).toBe('VALID_GAIN_DIRECTION'));
  it('5 · 43 → 45 kg (meta ≈ 16,5) → VALID_GAIN_DIRECTION', () => expect(c(43, 165, 45).status).toBe('VALID_GAIN_DIRECTION'));
  it('6 · 45 → 43 kg → INVALID', () => {
    const r = c(45, 165, 43);
    expect(r.status).toBe('INVALID');
    expect(r.reason).toBe('UNDERWEIGHT_NO_FURTHER_LOSS');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B · MATRIZ
// ═════════════════════════════════════════════════════════════════════════════
describe('A8 · B · IMC actual normal', () => {
  const H = 170; const CURRENT = 70;
  for (const [bmi, esperado] of [
    [20, 'VALID'], [18.5, 'VALID'], [18.4, 'VALID_WITH_LOW_BMI_NOTICE'],
    [17.0, 'VALID_WITH_LOW_BMI_NOTICE'], [16.9, 'INVALID'],
  ] as const) {
    it(`IMC meta ${bmi} → ${esperado}`, () => expect(c(CURRENT, H, kgAt(bmi, H)).status).toBe(esperado));
  }

  it('meta más alta que el peso actual también es VALID', () => expect(c(70, 170, 80).status).toBe('VALID'));
});

describe('A8 · B · IMC actual < 18,5 · la dirección manda', () => {
  const H = 170;
  it('IMC 15 → 16 (sigue < 17) → VALID_GAIN_DIRECTION', () => expect(c(kgAt(15, H), H, kgAt(16, H)).status).toBe('VALID_GAIN_DIRECTION'));
  it('IMC 16 → 17 → VALID_GAIN_DIRECTION', () => expect(c(kgAt(16, H), H, kgAt(17, H)).status).toBe('VALID_GAIN_DIRECTION'));
  it('IMC 17 → 18 (zona 17–18,49) → VALID_GAIN_DIRECTION', () => expect(c(kgAt(17, H), H, kgAt(18, H)).status).toBe('VALID_GAIN_DIRECTION'));
  it('IMC 17 → 20 (≥ 18,5) → VALID_GAIN_DIRECTION (aceptada)', () => {
    const r = c(kgAt(17, H), H, kgAt(20, H));
    expect(r.status).toBe('VALID_GAIN_DIRECTION');
    expect(isAcceptedTargetWeight(r)).toBe(true);
  });
  it('mismo peso → INVALID', () => expect(c(50, H, 50).reason).toBe('UNDERWEIGHT_NO_FURTHER_LOSS'));
  it('peso menor → INVALID (aunque el IMC meta fuera ≥ 17)', () => {
    expect(c(kgAt(18.2, H), H, kgAt(17.5, H)).reason).toBe('UNDERWEIGHT_NO_FURTHER_LOSS');
  });
  it('nunca se rechaza una subida por el IMC meta, en todo el rango', () => {
    for (let cur = 12; cur < 18.5; cur += 0.25) {
      for (let delta = 0.05; delta < 8; delta += 0.5) {
        const r = c(kgAt(cur, H), H, kgAt(cur, H) + delta);
        if (kgAt(cur, H) + delta > 300 || kgAt(cur, H) + delta < 30) continue;
        expect(isAcceptedTargetWeight(r), `actual ${cur} +${delta} kg`).toBe(true);
      }
    }
  });
});

describe('A8 · B · validación numérica', () => {
  for (const t of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 29.99, 300.01, 0, -5]) {
    it(`meta ${t} → INVALID · TARGET_OUT_OF_RANGE`, () => {
      const r = c(70, 170, t);
      expect(r.status).toBe('INVALID');
      expect(r.reason).toBe('TARGET_OUT_OF_RANGE');
    });
  }
  it('30 y 300 kg exactos entran en el rango', () => {
    expect(c(70, 170, 300).status).toBe('VALID');
    expect(c(32, 170, 30).reason).not.toBe('TARGET_OUT_OF_RANGE');
  });
  it('peso actual o estatura no evaluables lanzan (fail-closed)', () => {
    expect(() => c(Number.NaN, 170, 60)).toThrow(InvalidTargetWeightContextError);
    expect(() => c(70, 0, 60)).toThrow(InvalidTargetWeightContextError);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C · UMBRALES EXACTOS · COMA FLOTANTE
// ═════════════════════════════════════════════════════════════════════════════
describe('A8 · C · umbrales exactos estables', () => {
  const ALTURAS = [150, 155, 160, 165, 170, 175, 178, 180, 185, 190, 200];
  it('IMC exactamente 18,5 → VALID en todas las estaturas (incluida 180 cm, 59,94 kg)', () => {
    for (const h of ALTURAS) expect(c(90, h, kgAt(18.5, h)).status, `${h} cm`).toBe('VALID');
    expect(c(90, 180, 59.94).status).toBe('VALID');
    expect(c(90, 160, 47.36).status).toBe('VALID');
  });
  it('IMC exactamente 17,0 → VALID_WITH_LOW_BMI_NOTICE en todas las estaturas', () => {
    for (const h of ALTURAS) expect(c(90, h, kgAt(17, h)).status, `${h} cm`).toBe('VALID_WITH_LOW_BMI_NOTICE');
  });
  it('una centésima de kg por debajo sí cambia de zona', () => {
    expect(c(90, 180, 59.93).status).toBe('VALID_WITH_LOW_BMI_NOTICE');
    expect(c(90, 180, kgAt(17, 180) - 0.01).status).toBe('INVALID');
  });
  it('IMC actual exactamente 18,5 cuenta como NO bajo peso', () => {
    const h = 180; const cur = 59.94;
    expect(c(cur, h, cur - 1).status).toBe('VALID_WITH_LOW_BMI_NOTICE');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D · DATOS PERSISTIDOS / CAMBIO DE ESTATURA
// ═════════════════════════════════════════════════════════════════════════════
describe('A8 · D · obData persistido (legacy, hidratado, cambio de estatura)', () => {
  const OB = {
    sex: 'Mujer', goal: 'Bajar grasa', edad: 30, estatura: 170, peso: 62, embarazo: 0,
    requiresTherapeuticDiet: 0, dailyLife: 'DL2', trainsHabitually: 0,
    trainingDaysPerWeek: 0, trainingSessionMinutes: 0,
  } as Record<string, string | number>;

  it('sin peso meta → null', () => {
    expect(targetWeightSafetyFrom(OB)).toBeNull();
    expect(targetWeightSafetyFrom({ ...OB, pesoMeta: '' })).toBeNull();
  });

  it('legacy 50 kg a 1,70 m (IMC ≈ 17,3) → aviso, ya no rechazo', () => {
    expect(targetWeightSafetyFrom({ ...OB, pesoMeta: 50 })?.status).toBe('VALID_WITH_LOW_BMI_NOTICE');
  });

  it('legacy 45 kg a 1,70 m (IMC ≈ 15,6) → INVALID: meta no autoritativa', () => {
    const r = targetWeightSafetyFrom({ ...OB, pesoMeta: 45 });
    expect(r?.status).toBe('INVALID');
    expect(isAcceptedTargetWeight(r!)).toBe(false);
  });

  it('lee `altura` como alias de estatura y acepta strings persistidos', () => {
    const { estatura: _omit, ...sinEstatura } = OB;
    expect(targetWeightSafetyFrom({ ...sinEstatura, altura: '170', peso: '62', pesoMeta: '60' })?.status).toBe('VALID');
  });

  it('cambio de estatura reevalúa la MISMA meta: VALID → NOTICE → INVALID → VALID', () => {
    const meta = { ...OB, peso: 70, pesoMeta: 55 };
    expect(targetWeightSafetyFrom({ ...meta, estatura: 165 })?.status).toBe('VALID');                    // 20,2
    expect(targetWeightSafetyFrom({ ...meta, estatura: 175 })?.status).toBe('VALID_WITH_LOW_BMI_NOTICE'); // 18,0
    expect(targetWeightSafetyFrom({ ...meta, estatura: 182 })?.status).toBe('INVALID');                  // 16,6
    expect(targetWeightSafetyFrom({ ...meta, estatura: 170 })?.status).toBe('VALID');                    // 19,0
  });

  it('una meta INVALID guardada NO toca energía, macros ni alcance', () => {
    const valida = { ...OB, pesoMeta: 58 };
    const invalida = { ...OB, pesoMeta: 45 };
    expect(resolveNutritionEnergyState(invalida)).toEqual(resolveNutritionEnergyState(valida));
    expect(resolveNutritionEnergyState(invalida).status).toBe('PRESCRIBED');
    expect(resolveMacroPrescription(resolveNutritionEnergyState(invalida), invalida))
      .toEqual(resolveMacroPrescription(resolveNutritionEnergyState(valida), valida));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E · AISLAMIENTO · energía, macros, vigencia
// ═════════════════════════════════════════════════════════════════════════════
describe('A8 · E · el peso meta no es autoridad energética ni de macros', () => {
  const OB = {
    sex: 'Hombre', goal: 'Bajar grasa', edad: 30, estatura: 178, peso: 82, embarazo: 0,
    requiresTherapeuticDiet: 0, dailyLife: 'DL2', trainsHabitually: 0,
    trainingDaysPerWeek: 0, trainingSessionMinutes: 0,
  } as Record<string, string | number>;

  it('no está en la identidad energética y cambiarlo no recalcula (ADOPT)', () => {
    expect(ENERGY_IDENTITY_FIELDS).not.toContain('pesoMeta');
    const at = '2026-10-07T00:00:00.000Z';
    const { snapshot } = buildEnergySnapshot({ ...OB, pesoMeta: 75 }, at);
    expect(decideEnergyHydration({ obData: { ...OB, pesoMeta: 60 }, rawSnapshot: snapshot, computedAt: at, previousMealPlanKey: 'planA' }).action)
      .toBe('ADOPT');
  });

  it('cambiar SOLO el peso meta no deja el plan STALE', () => {
    const m = resolveMacroPrescription(resolveNutritionEnergyState(OB), OB).prescription;
    if (!m || (m.status !== 'VALID' && m.status !== 'REVIEW')) throw new Error('servible');
    const plan = { days: [{}], engineVersion: PLAN_ENGINE_VERSION, gen: { kcal: m.energyKcal, protG: m.proteinG, fatG: m.fatG, carbG: m.carbG } };
    for (const pesoMeta of [75, 60, 45]) {
      const o = { ...OB, pesoMeta };
      const r = resolveMacroPrescription(resolveNutritionEnergyState(o), o).prescription;
      if (!r || (r.status !== 'VALID' && r.status !== 'REVIEW')) throw new Error('servible');
      expect(weeklyPlanCurrentness({
        status: 'PRESCRIBED', planGoal: r.energyKcal, macros: r, weeklyPlan: plan, currentVersion: PLAN_ENGINE_VERSION,
      })).toBe('ACTIVE');
    }
  });

  it('la autoridad no conoce energía, macros ni alcance', () => {
    expect(sinComentarios(srcSafety)).not.toMatch(/\b(prescribedEnergy|maintenance|macro|protein|PRW|scope|FAT_LOSS)\w*/i);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// F · UNA SOLA AUTORIDAD
// ═════════════════════════════════════════════════════════════════════════════
describe('A8 · F · sin reglas duplicadas', () => {
  const TODO = import.meta.glob('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const PRODUCTIVOS = Object.entries(TODO)
    .filter(([p]) => !p.includes('/__tests__/') && !/\.test\.tsx?$/.test(p))
    .map(([p, src]) => [p, sinComentarios(src)] as const);

  it('el umbral 18,5 / 17 del peso meta solo vive en `targetWeightSafety`', () => {
    const conUmbral = PRODUCTIVOS
      .filter(([, src]) => /\bpesoMeta\b|\btargetWeight/i.test(src))
      .filter(([, src]) => /\b18\.5\b|\b17(\.0)?\b\s*[;)]/.test(src))
      .map(([p]) => p);
    expect(conUmbral).toEqual(['/src/utils/targetWeightSafety.ts']);
  });

  it('`invalidField` delega y ya no calcula el IMC del peso meta', () => {
    const fn = sinComentarios(srcTargets).slice(sinComentarios(srcTargets).indexOf('export function invalidField'));
    const cuerpo = fn.slice(0, fn.indexOf('\n}\n'));
    expect(cuerpo).toContain('classifyTargetWeight(');
    expect(cuerpo).not.toMatch(/pesoMeta\s*\/|18\.5|hM \* hM/);
  });

  it('onboarding y hoja de datos consumen la misma autoridad, sin fórmula propia', () => {
    for (const src of [sinComentarios(srcOnboarding), sinComentarios(srcEdit)]) {
      expect(src).toContain('classifyTargetWeight(');
      expect(src).not.toMatch(/pesoMeta\)?\s*\/\s*\(|18\.5/);
    }
    expect(sinComentarios(srcOnboarding)).toContain("t('onboarding.targetWeightLowBmiNotice')");
    expect(sinComentarios(srcEdit)).toContain("targetSafety?.status === 'INVALID'");
  });
});
