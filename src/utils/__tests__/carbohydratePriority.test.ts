import { describe, it, expect } from 'vitest';
import srcMacro from '../macroPrescription.ts?raw';
import {
  deriveCarbohydratePriority,
  prescribeMacros,
  resolveMacroPrescription,
  isServableMacroPrescription,
  InvalidMacroInputError,
  PROTEIN_ACTIVITY_CLASSES,
  type MacroInput,
  type ProteinActivityClass,
  type CarbohydratePriority,
} from '../macroPrescription';
import { TRAINING_BANDS, type TrainingBand } from '../activityClassifier';
import { resolveNutritionEnergyState } from '../nutritionEnergyState';

// ─────────────────────────────────────────────────────────────────────────────
// CAPA 2 · A4 · CARBOHYDRATE PRIORITY · matriz CERRADA
//
// Clase declarada × banda de carga. Metadato: STANDARD/ELEVATED/HIGH no mueven
// un gramo ni disparan REVIEW. SPORTS_SCOPE saca el contexto del alcance
// automático con el MacroStatus que ya existía.
// ─────────────────────────────────────────────────────────────────────────────

const sinComentarios = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !l.trim().startsWith('//'))
    .map((l) => l.replace(/\/\/.*$/, '')).join('\n');

const ESPERADA: Record<ProteinActivityClass, CarbohydratePriority[]> = {
  //                         T0          T1          T2          T3          T4
  NO_STRUCTURED_TRAINING: ['STANDARD', 'STANDARD', 'STANDARD', 'STANDARD', 'STANDARD'],
  LOW_DEMAND:             ['STANDARD', 'STANDARD', 'STANDARD', 'STANDARD', 'STANDARD'],
  STRENGTH:               ['STANDARD', 'ELEVATED', 'ELEVATED', 'ELEVATED', 'ELEVATED'],
  ENDURANCE_GENERAL:      ['STANDARD', 'ELEVATED', 'HIGH', 'HIGH', 'SPORTS_SCOPE'],
  MIXED:                  ['STANDARD', 'ELEVATED', 'HIGH', 'HIGH', 'SPORTS_SCOPE'],
  TEAM_INTERMITTENT:      ['STANDARD', 'ELEVATED', 'HIGH', 'HIGH', 'SPORTS_SCOPE'],
  SPECIALIZED_SPORT:      ['SPORTS_SCOPE', 'SPORTS_SCOPE', 'SPORTS_SCOPE', 'SPORTS_SCOPE', 'SPORTS_SCOPE'],
};

const BASE: MacroInput = {
  energyKcal: 2400, goal: 'MAINTENANCE', weightKg: 75, heightCm: 178,
  activityClass: 'STRENGTH', trainingBand: 'T1',
};
const rx = (over: Partial<MacroInput> = {}) => prescribeMacros({ ...BASE, ...over });
const grams = (over: Partial<MacroInput>) => {
  const m = rx(over);
  if (!isServableMacroPrescription(m)) throw new Error(`esperaba servible, salió ${m.status}`);
  return [m.proteinG, m.fatG, m.carbG];
};

// ═════════════════════════════════════════════════════════════════════════════
// A · MATRIZ
// ═════════════════════════════════════════════════════════════════════════════
describe('A4 · A · matriz cerrada (7 clases × 5 bandas)', () => {
  for (const cls of PROTEIN_ACTIVITY_CLASSES) {
    TRAINING_BANDS.forEach((band, i) => {
      it(`${cls} × ${band} → ${ESPERADA[cls][i]}`, () => {
        expect(deriveCarbohydratePriority(cls, band)).toBe(ESPERADA[cls][i]);
      });
    });
  }

  it('entradas desconocidas lanzan; nunca caen a STANDARD', () => {
    expect(() => deriveCarbohydratePriority('YOGA' as never, 'T1')).toThrow(InvalidMacroInputError);
    expect(() => deriveCarbohydratePriority('STRENGTH', 'T5' as TrainingBand)).toThrow(InvalidMacroInputError);
    expect(() => rx({ trainingBand: undefined as never })).toThrow(InvalidMacroInputError);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B · INVARIANTES · la prioridad no mueve gramos
// ═════════════════════════════════════════════════════════════════════════════
describe('A4 · B · la prioridad es metadato', () => {
  it('STRENGTH T1 vs T3: misma prioridad (ELEVATED) y mismos gramos', () => {
    expect(rx({ trainingBand: 'T1' }).carbohydratePriority).toBe('ELEVATED');
    expect(rx({ trainingBand: 'T3' }).carbohydratePriority).toBe('ELEVATED');
    expect(grams({ trainingBand: 'T3' })).toEqual(grams({ trainingBand: 'T1' }));
  });

  it('STRENGTH T0 vs T1: STANDARD → ELEVATED, mismos gramos', () => {
    expect(rx({ trainingBand: 'T0' }).carbohydratePriority).toBe('STANDARD');
    expect(grams({ trainingBand: 'T0' })).toEqual(grams({ trainingBand: 'T1' }));
  });

  it('ENDURANCE T1 vs T2: ELEVATED → HIGH, los gramos de carbohidrato no cambian', () => {
    const t1 = rx({ activityClass: 'ENDURANCE_GENERAL', trainingBand: 'T1' });
    const t2 = rx({ activityClass: 'ENDURANCE_GENERAL', trainingBand: 'T2' });
    expect(t1.carbohydratePriority).toBe('ELEVATED');
    expect(t2.carbohydratePriority).toBe('HIGH');
    expect(t2.carbG).toBe(t1.carbG);
    expect([t2.proteinG, t2.fatG]).toEqual([t1.proteinG, t1.fatG]);
  });

  it('ENDURANCE T3 (HIGH) vs las mismas entradas en T0 (STANDARD): mismas macros, VALID, sin motivos', () => {
    const t3 = rx({ activityClass: 'ENDURANCE_GENERAL', trainingBand: 'T3' });
    expect(t3.carbohydratePriority).toBe('HIGH');
    expect(t3.status).toBe('VALID');
    expect(t3.reviewReasons).toEqual([]);
    expect(grams({ activityClass: 'ENDURANCE_GENERAL', trainingBand: 'T3' }))
      .toEqual(grams({ activityClass: 'ENDURANCE_GENERAL', trainingBand: 'T0' }));
  });

  it('el reparto sigue siendo energía → proteína → grasa 25 % → carbohidrato residual', () => {
    for (const band of ['T0', 'T1', 'T2', 'T3'] as const) {
      const m = rx({ activityClass: 'MIXED', trainingBand: band });
      if (!isServableMacroPrescription(m)) throw new Error('servible');
      expect(m.fatG).toBe(Math.round((BASE.energyKcal * 0.25) / 9));
      expect(m.carbG).toBe(Math.round((BASE.energyKcal - 4 * m.proteinG - 9 * m.fatG) / 4));
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C · SIN PISO DE CARBOHIDRATO
// ═════════════════════════════════════════════════════════════════════════════
describe('A4 · C · HIGH no crea un piso', () => {
  it('HIGH con residuo de carbohidrato comparativamente bajo: no se toca, ni REVIEW', () => {
    const input: Partial<MacroInput> = {
      energyKcal: 1400, goal: 'FAT_LOSS', weightKg: 90, heightCm: 180, activityClass: 'ENDURANCE_GENERAL',
    };
    const high = rx({ ...input, trainingBand: 'T2' });
    const standard = rx({ ...input, trainingBand: 'T0' });
    if (!isServableMacroPrescription(high) || !isServableMacroPrescription(standard)) throw new Error('servibles');
    expect(high.carbohydratePriority).toBe('HIGH');
    expect(standard.carbohydratePriority).toBe('STANDARD');
    // El residuo calculado es exactamente el mismo con y sin HIGH.
    expect(high.carbG).toBe(Math.round((1400 - 4 * high.proteinG - 9 * high.fatG) / 4));
    expect(high.carbG).toBe(standard.carbG);
    expect(high.status).toBe('VALID');
    expect(high.reviewReasons).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D · SPORTS_SCOPE
// ═════════════════════════════════════════════════════════════════════════════
describe('A4 · D · SPORTS_SCOPE', () => {
  for (const cls of ['ENDURANCE_GENERAL', 'MIXED', 'TEAM_INTERMITTENT'] as const) {
    it(`${cls} × T4 → status SPORTS_SCOPE (CARB_PRIORITY_SPORTS_SCOPE), sin gramos ni VALID`, () => {
      const m = rx({ activityClass: cls, trainingBand: 'T4' });
      expect(m.status).toBe('SPORTS_SCOPE');
      expect(m.reason).toBe('CARB_PRIORITY_SPORTS_SCOPE');
      expect(m.carbohydratePriority).toBe('SPORTS_SCOPE');
      expect(m.proteinG).toBeUndefined();
      expect(m.carbG).toBeUndefined();
      expect(isServableMacroPrescription(m)).toBe(false);
    });
  }

  it('STRENGTH × T4 sigue siendo ordinario: ELEVATED y VALID', () => {
    const m = rx({ activityClass: 'STRENGTH', trainingBand: 'T4' });
    expect(m.status).toBe('VALID');
    expect(m.carbohydratePriority).toBe('ELEVATED');
  });

  it('deporte especializado → SPORTS_SCOPE por su clase, en cualquier banda', () => {
    for (const band of TRAINING_BANDS) {
      const m = rx({ activityClass: 'SPECIALIZED_SPORT', trainingBand: band });
      expect(m.status).toBe('SPORTS_SCOPE');
      expect(m.reason).toBe('SPECIALIZED_SPORT');
      expect(m.carbohydratePriority).toBe('SPORTS_SCOPE');
    }
  });

  it('end-to-end · 7 × 60 min (T4): resistencia → SPORTS_SCOPE · fuerza → VALID', () => {
    const ob = (m: string) => ({
      sex: 'Mujer', goal: 'Bienestar integral', edad: 32, estatura: 168, peso: 62, embarazo: 0,
      dailyLife: 'DL2', trainsHabitually: 1, trainingDaysPerWeek: 7, trainingSessionMinutes: 60,
      trainingModalities: m,
    }) as Record<string, string | number>;
    const run = (m: string) => resolveMacroPrescription(resolveNutritionEnergyState(ob(m)), ob(m)).prescription;
    expect(run('endurance')?.status).toBe('SPORTS_SCOPE');
    expect(run('endurance')?.reason).toBe('CARB_PRIORITY_SPORTS_SCOPE');
    expect(run('strength,team_intermittent')?.status).toBe('SPORTS_SCOPE');
    expect(run('strength')?.status).toBe('VALID');
    expect(run('strength')?.carbohydratePriority).toBe('ELEVATED');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E · BARRIDO · ni blanket, ni matriz paralela, ni efecto en gramos
// ═════════════════════════════════════════════════════════════════════════════
describe('A4 · E · barrido', () => {
  const TODO = import.meta.glob('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const PRODUCTIVOS = Object.entries(TODO)
    .filter(([p]) => !p.includes('/__tests__/') && !/\.test\.tsx?$/.test(p))
    .map(([p, src]) => [p, sinComentarios(src)] as const);
  const CODE = sinComentarios(srcMacro);

  it('no queda la asignación STANDARD-para-todos', () => {
    expect(CODE).not.toMatch(/\?\?\s*'STANDARD'/);
    expect(CODE).not.toMatch(/carbohydratePriority:\s*'STANDARD'/);
  });

  it('una sola matriz: ninguna otra fuente asigna ELEVATED/HIGH', () => {
    const otros = PRODUCTIVOS
      .filter(([p]) => !p.endsWith('/macroPrescription.ts'))
      .filter(([, src]) => /'ELEVATED'|carbohydratePriority|CarbohydratePriority/.test(src))
      .map(([p]) => p);
    expect(otros).toEqual([]);
  });

  it('en `prescribeMacros` la prioridad solo se deriva, se adjunta y decide SPORTS_SCOPE', () => {
    const pura = CODE.slice(CODE.indexOf('export function prescribeMacros'), CODE.indexOf('export function isServableMacroPrescription'));
    const usos = pura.match(/\bcarbohydratePriority\b/g) ?? [];
    expect(usos).toHaveLength(3);   // declaración · `base` · comparación con SPORTS_SCOPE
    expect(pura).toContain("if (carbohydratePriority === 'SPORTS_SCOPE') return { ...base, status: 'SPORTS_SCOPE', reason: 'CARB_PRIORITY_SPORTS_SCOPE' };");
    // Ninguna fórmula de gramos la menciona.
    for (const linea of pura.split('\n').filter((l) => /proteinRaw|fatRaw|carbKcalRaw|const carbG|const fatG|const proteinG/.test(l))) {
      expect(linea).not.toMatch(/carbohydratePriority|ELEVATED|HIGH/);
    }
    // Sin pisos nuevos.
    expect(pura).not.toMatch(/\b130\b|\b3\s*\*\s*prw|\bMath\.max\(50/);
  });
});
