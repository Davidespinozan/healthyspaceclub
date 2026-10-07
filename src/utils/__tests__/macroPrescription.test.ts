import { describe, it, expect } from 'vitest';
import srcMacro from '../macroPrescription.ts?raw';
import {
  prescribeMacros,
  proteinReferenceWeightKg,
  proteinFactor,
  resolveMacroPrescription,
  isServableMacroPrescription,
  InvalidMacroInputError,
  MACRO_PRESCRIPTION_VERSION,
  PROTEIN_ACTIVITY_CLASSES,
  type MacroInput,
  type ProteinActivityClass,
} from '../macroPrescription';
import { resolveNutritionEnergyState } from '../nutritionEnergyState';
import { PERMANENT_AVOID_CATALOG } from '../avoidAuthority';
import type { CanonicalGoal } from '../energyPrescription';

// ─────────────────────────────────────────────────────────────────────────────
// CAPA 2 · MACRO PRESCRIPTION AUTHORITY · contrato
//
// Energía (dura) → proteína (PRW × factor) → grasa 25 % → carbohidrato residual.
// ─────────────────────────────────────────────────────────────────────────────

const sinComentarios = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !l.trim().startsWith('//'))
    .map((l) => l.replace(/\/\/.*$/, '')).join('\n');
const CODE = sinComentarios(srcMacro);

const BASE: MacroInput = {
  energyKcal: 2000, goal: 'MAINTENANCE', weightKg: 80, heightCm: 180, activityClass: 'MIXED', trainingBand: 'T2',
};
const served = (input: Partial<MacroInput> = {}) => {
  const m = prescribeMacros({ ...BASE, ...input });
  if (!isServableMacroPrescription(m)) throw new Error(`esperaba VALID/REVIEW, salió ${m.status}`);
  return m;
};

// ═════════════════════════════════════════════════════════════════════════════
// A · PRW
// ═════════════════════════════════════════════════════════════════════════════
describe('CAPA 2 · A · peso de referencia proteica (PRW)', () => {
  it('IMC 24 → PRW = peso actual', () => {
    const w = 24 * 1.8 * 1.8;
    expect(proteinReferenceWeightKg(w, 180)).toBe(w);
  });

  it('IMC 29.9 → PRW = peso actual', () => {
    const w = 29.9 * 1.8 * 1.8;
    expect(proteinReferenceWeightKg(w, 180)).toBe(w);
  });

  it('IMC 30 exacto → PRW = peso a IMC 30 (continuo en el umbral)', () => {
    expect(proteinReferenceWeightKg(97.2, 180)).toBeCloseTo(97.2, 10);
  });

  it('IMC > 30 → peso a IMC 30 + 25 % del exceso', () => {
    // 180 cm · 120 kg → w30 = 97.2 · PRW = 97.2 + 0.25 × 22.8 = 102.9
    expect(proteinReferenceWeightKg(120, 180)).toBeCloseTo(102.9, 10);
  });

  it('persona baja · 150 cm, 90 kg → 73.125', () => {
    // w30 = 30 × 1.5² = 67.5 · PRW = 67.5 + 0.25 × 22.5
    expect(proteinReferenceWeightKg(90, 150)).toBeCloseTo(73.125, 10);
  });

  it('persona alta · 200 cm, 140 kg → 125', () => {
    expect(proteinReferenceWeightKg(140, 200)).toBeCloseTo(125, 10);
  });

  it('peso muy alto · 170 cm, 200 kg → 115.025 (no 200)', () => {
    expect(proteinReferenceWeightKg(200, 170)).toBeCloseTo(115.025, 10);
  });

  it('monótono: más peso nunca baja el PRW', () => {
    let prev = 0;
    for (let w = 40; w <= 250; w += 0.5) {
      const p = proteinReferenceWeightKg(w, 170);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });

  it('el PRW NO se presenta como masa magra', () => {
    expect(CODE).not.toMatch(/\b(ffm|lbm|leanMass|fatFreeMass)\b/i);
    expect(srcMacro).toMatch(/NO es masa magra/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B · PROTEÍNA · objetivo × clase de actividad
// ═════════════════════════════════════════════════════════════════════════════
describe('CAPA 2 · B · factor de proteína', () => {
  const STANDARD: Record<Exclude<ProteinActivityClass, 'SPECIALIZED_SPORT'>, number> = {
    NO_STRUCTURED_TRAINING: 1.0, LOW_DEMAND: 1.2, STRENGTH: 1.6,
    ENDURANCE_GENERAL: 1.6, MIXED: 1.6, TEAM_INTERMITTENT: 1.6,
  };
  const FAT_LOSS: typeof STANDARD = {
    NO_STRUCTURED_TRAINING: 1.3, LOW_DEMAND: 1.3, STRENGTH: 1.8,
    ENDURANCE_GENERAL: 1.8, MIXED: 1.8, TEAM_INTERMITTENT: 1.8,
  };

  for (const goal of ['MAINTENANCE', 'MUSCLE_GAIN', 'RECOMPOSITION'] as CanonicalGoal[]) {
    for (const [cls, f] of Object.entries(STANDARD)) {
      it(`${goal} × ${cls} → ${f} g/kg PRW`, () => {
        expect(proteinFactor(goal, cls as ProteinActivityClass)).toBe(f);
        expect(served({ goal, activityClass: cls as ProteinActivityClass }).proteinG).toBe(Math.round(80 * f));
      });
    }
  }
  for (const [cls, f] of Object.entries(FAT_LOSS)) {
    it(`FAT_LOSS × ${cls} → ${f} g/kg PRW`, () => {
      expect(proteinFactor('FAT_LOSS', cls as ProteinActivityClass)).toBe(f);
      expect(served({ goal: 'FAT_LOSS', activityClass: cls as ProteinActivityClass }).proteinG).toBe(Math.round(80 * f));
    });
  }

  it('deporte especializado → SPORTS_SCOPE en los cuatro objetivos, sin gramos', () => {
    for (const goal of ['MAINTENANCE', 'MUSCLE_GAIN', 'RECOMPOSITION', 'FAT_LOSS'] as CanonicalGoal[]) {
      expect(proteinFactor(goal, 'SPECIALIZED_SPORT')).toBeNull();
      const m = prescribeMacros({ ...BASE, goal, activityClass: 'SPECIALIZED_SPORT' });
      expect(m.status).toBe('SPORTS_SCOPE');
      expect(m.proteinG).toBeUndefined();
      expect(isServableMacroPrescription(m)).toBe(false);
    }
  });

  it('la proteína se calcula sobre el PRW, no sobre el peso actual', () => {
    // 180 cm · 120 kg · MIXED · MAINTENANCE → 102.9 × 1.6 = 164.64 → 165 (no 192)
    expect(served({ weightKg: 120, energyKcal: 2600 }).proteinG).toBe(165);
  });

  it('la autoridad pura no depende del sexo, la edad ni los minutos: no son entradas', () => {
    const pura = CODE.slice(CODE.indexOf('export function prescribeMacros'), CODE.indexOf('export function isServableMacroPrescription'));
    expect(pura.length).toBeGreaterThan(0);
    expect(pura).not.toMatch(/\b(sex|sexo|ageYears|edad|weeklyTrainingMinutes)\b/);
    // A4 · la banda de carga solo entra para la prioridad de carbohidrato.
    expect(pura.match(/\btrainingBand\b/g)).toEqual(['trainingBand']);
    expect(pura).toContain('deriveCarbohydratePriority(activityClass, input.trainingBand)');
  });

  it('sin techo universal (2.2 / 2.4) ni tabla GKG', () => {
    expect(CODE).not.toMatch(/\b2\.2\b|\b2\.4\b|\bGKG\b/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C · GRASA 25 %
// ═════════════════════════════════════════════════════════════════════════════
describe('CAPA 2 · C · grasa = 25 % de la energía', () => {
  it('2000 kcal → 56 g (500 kcal / 9)', () => {
    expect(served().fatG).toBe(56);
  });

  it('igual en los cuatro objetivos: no hay tabla por objetivo', () => {
    for (const goal of ['MAINTENANCE', 'MUSCLE_GAIN', 'RECOMPOSITION', 'FAT_LOSS'] as CanonicalGoal[]) {
      expect(served({ goal }).fatG).toBe(56);
    }
  });

  it('SIN piso de 0.6 g/kg: 100 kg a 1500 kcal → 42 g (< 60 g)', () => {
    const m = served({ weightKg: 100, energyKcal: 1500, activityClass: 'NO_STRUCTURED_TRAINING' });
    expect(m.fatG).toBe(42);
    expect(m.fatG).toBeLessThan(100 * 0.6);
  });

  it('el AMDR no se usa como objetivo ni reequilibra', () => {
    expect(CODE).not.toMatch(/0\.20|0\.35|AMDR/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D · CARBOHIDRATO RESIDUAL
// ═════════════════════════════════════════════════════════════════════════════
describe('CAPA 2 · D · carbohidrato = residuo', () => {
  it('residuo positivo: 2000 kcal, 80 kg, FAT_LOSS × MIXED → P 144 · G 56 · C 230', () => {
    const m = served({ goal: 'FAT_LOSS' });
    expect([m.proteinG, m.fatG, m.carbG]).toEqual([144, 56, 230]);
  });

  it('residuo bajo, por debajo de 130 g: sin piso de 130', () => {
    const m = served({ goal: 'FAT_LOSS', energyKcal: 1200 });
    expect(m.carbG).toBe(82);
  });

  it('residuo por debajo de 50 g: sin piso de 50', () => {
    const m = served({ goal: 'FAT_LOSS', energyKcal: 1100, weightKg: 90 });
    expect(m.carbG).toBe(43);
  });

  it('residuo ≤ 0 → INFEASIBLE con motivo legible por máquina; ni clamp ni gramos', () => {
    // 185 cm · 110 kg → PRW ≈ 104.5 · ×1.8 ≈ 188 g · 1000 kcal → carbKcal ≈ −2
    const m = prescribeMacros({ ...BASE, goal: 'FAT_LOSS', energyKcal: 1000, weightKg: 110, heightCm: 185 });
    expect(m.status).toBe('INFEASIBLE');
    if (m.status !== 'INFEASIBLE') return;
    expect(m.reason).toBe('CARB_RESIDUAL_NON_POSITIVE');
    expect(m.carbKcal).toBeLessThanOrEqual(0);
    expect(m.carbG).toBeUndefined();
    expect(isServableMacroPrescription(m)).toBe(false);
  });

  it('residuo exactamente 0 → INFEASIBLE', () => {
    // 75 kg × 1.0 = 75 g → 300 kcal · grasa 100 kcal · 400 − 300 − 100 = 0
    const m = prescribeMacros({ ...BASE, energyKcal: 400, weightKg: 75, activityClass: 'NO_STRUCTURED_TRAINING' });
    expect(m.status).toBe('INFEASIBLE');
  });

  it('sin pisos, multiplicadores ni escalera de actividad en el código', () => {
    expect(CODE).not.toMatch(/\b130\b|Math\.max\(50/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E · RECONCILIACIÓN Y REDONDEO
// ═════════════════════════════════════════════════════════════════════════════
describe('CAPA 2 · E · reconciliación y redondeo', () => {
  it('la energía no se toca: sale idéntica a la recibida', () => {
    expect(served({ energyKcal: 1987 }).energyKcal).toBe(1987);
  });

  it('4P + 9G + 4C reproduce la energía con ±2 kcal en todo el barrido', () => {
    for (let kcal = 1200; kcal <= 4000; kcal += 37) {
      for (const weightKg of [50, 70, 95, 130]) {
        for (const goal of ['MAINTENANCE', 'FAT_LOSS'] as CanonicalGoal[]) {
          const m = prescribeMacros({ ...BASE, energyKcal: kcal, weightKg, goal });
          if (!isServableMacroPrescription(m)) continue;
          const sum = 4 * m.proteinG + 9 * m.fatG + 4 * m.carbG;
          expect(Math.abs(sum - kcal), `${kcal} kcal · ${weightKg} kg · ${goal}`).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  it('gramos enteros', () => {
    const m = served({ energyKcal: 2333, weightKg: 77.7 });
    for (const g of [m.proteinG, m.fatG, m.carbG, m.fiberG]) expect(Number.isInteger(g)).toBe(true);
  });

  it('la fibra es referencia (14 g / 1000 kcal), no un objetivo del solver', () => {
    expect(served({ energyKcal: 2000 }).fiberG).toBe(28);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// F · ESTADOS
// ═════════════════════════════════════════════════════════════════════════════
describe('CAPA 2 · F · estados', () => {
  it('VALID por defecto, sin motivos', () => {
    const m = served();
    expect(m.status).toBe('VALID');
    expect(m.reviewReasons).toEqual([]);
    expect(m.version).toBe(MACRO_PRESCRIPTION_VERSION);
  });

  it('REVIEW · enfermedad renal declarada: tope heredado de 1.0 g/kg PRW, con motivo', () => {
    const m = served({ goal: 'FAT_LOSS', declaredRenalCondition: true });
    expect(m.status).toBe('REVIEW');
    expect(m.reviewReasons).toEqual(['RENAL_CONDITION_DECLARED']);
    expect(m.proteinFactor).toBe(1.0);
    expect(m.proteinG).toBe(80);
  });

  it('la prioridad de carbohidrato es metadato: no mueve un gramo (T0–T3 de MIXED)', () => {
    const ref = served({ trainingBand: 'T0' });
    for (const [band, p] of [['T0', 'STANDARD'], ['T1', 'ELEVATED'], ['T2', 'HIGH'], ['T3', 'HIGH']] as const) {
      const m = served({ trainingBand: band });
      expect(m.carbohydratePriority).toBe(p);
      expect(m.status).toBe('VALID');
      expect([m.proteinG, m.fatG, m.carbG]).toEqual([ref.proteinG, ref.fatG, ref.carbG]);
    }
  });

  it('entradas sin sentido físico lanzan (fail-closed)', () => {
    for (const bad of [
      { energyKcal: 0 }, { energyKcal: Number.NaN }, { weightKg: -1 }, { heightCm: 0 },
      { goal: 'BULK' as never }, { activityClass: 'YOGA' as never }, { trainingBand: 'T9' as never },
    ]) {
      expect(() => prescribeMacros({ ...BASE, ...bad }), JSON.stringify(bad)).toThrow(InvalidMacroInputError);
    }
  });

  it('las siete clases están declaradas', () => {
    expect(PROTEIN_ACTIVITY_CLASSES).toHaveLength(7);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// G · ADAPTADOR DE PRODUCCIÓN + ALCANCE (CAPA 0)
// ═════════════════════════════════════════════════════════════════════════════
describe('CAPA 2 · G · adaptador y alcance', () => {
  // A2 · la clase sale de la modalidad DECLARADA. Esta base entrena y declara fuerza.
  const OB = {
    sex: 'Hombre', goal: 'Bienestar integral', edad: 30, estatura: 180, peso: 80,
    embarazo: 0, dailyLife: 'DL2', trainsHabitually: 1,
    trainingDaysPerWeek: 4, trainingSessionMinutes: 60, trainingModalities: 'strength',
  } as Record<string, string | number>;
  const resolve = (over: Record<string, string | number> = {}) => {
    const ob = { ...OB, ...over };
    return resolveMacroPrescription(resolveNutritionEnergyState(ob), ob);
  };
  const rx = (over: Record<string, string | number> = {}) => resolve(over).prescription;

  it('end-to-end · PRESCRIBED → macros con la energía prescrita', () => {
    const state = resolveNutritionEnergyState(OB);
    if (state.status !== 'PRESCRIBED') throw new Error('debería ser PRESCRIBED');
    const r = resolveMacroPrescription(state, OB);
    expect(r.kind).toBe('RESOLVED');
    const m = r.prescription;
    if (!isServableMacroPrescription(m)) throw new Error('debería ser servible');
    expect(m.energyKcal).toBe(state.prescribedEnergy);
    expect(m.activityClass).toBe('STRENGTH');
    expect(m.proteinG).toBe(128);                       // 80 × 1.6
  });

  it('no entrena → 1.0 g/kg; solo baja demanda → 1.2 g/kg', () => {
    expect(rx({ trainsHabitually: 0, trainingDaysPerWeek: 0, trainingSessionMinutes: 0, trainingModalities: '' })?.proteinFactor).toBe(1.0);
    expect(rx({ trainingModalities: 'low_demand' })?.proteinFactor).toBe(1.2);
  });

  it('renal en `conditions` (CSV) → REVIEW con tope', () => {
    expect(rx({ conditions: 'diabetes,renal' })?.status).toBe('REVIEW');
    expect(rx({ conditions: 'diabetes,renal' })?.proteinFactor).toBe(1.0);
    expect(rx({ conditions: 'diabetes' })?.status).toBe('VALID');
  });

  it('edad 18 y 65 → sin macros · 19 y 64 → con macros (D01)', () => {
    expect(resolve({ edad: 18 }).kind).toBe('NO_ENERGY');
    expect(resolve({ edad: 19 }).kind).toBe('RESOLVED');
    expect(resolve({ edad: 64 }).kind).toBe('RESOLVED');
    expect(resolve({ edad: 65 }).kind).toBe('NO_ENERGY');
  });

  it('embarazo/lactancia → sin macros (D02)', () => {
    expect(resolve({ sex: 'Mujer', embarazo: 1, peso: 62, estatura: 165 }).kind).toBe('NO_ENERGY');
  });

  it('bajo peso + pérdida de grasa → FAT_LOSS_BLOCKED → sin macros (D03)', () => {
    const ob = { ...OB, goal: 'Bajar grasa', peso: 55, estatura: 180 };
    expect(resolveNutritionEnergyState(ob).status).toBe('FAT_LOSS_BLOCKED');
    expect(resolveMacroPrescription(resolveNutritionEnergyState(ob), ob).kind).toBe('NO_ENERGY');
  });

  it('perfil incompleto → sin macros', () => {
    const ob = { ...OB };
    delete ob.peso;
    expect(resolveMacroPrescription(resolveNutritionEnergyState(ob), ob).kind).toBe('NO_ENERGY');
  });

  it('vegetariano/vegano no son restricciones permanentes expuestas (D04)', () => {
    expect(PERMANENT_AVOID_CATALOG).not.toContain('vegetariano');
    expect(PERMANENT_AVOID_CATALOG).not.toContain('vegano');
  });

  it('el adaptador no lee la actividad legacy ni el sexo ni la edad', () => {
    expect(CODE).not.toMatch(/obData\??\.(activity|actividad|nivel|sex|edad)\b/);
    expect(CODE).not.toMatch(/\[['"](activity|actividad|nivel|sex|edad)['"]\]/);
  });
});
