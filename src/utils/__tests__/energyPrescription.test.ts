import { describe, it, expect } from 'vitest';
import srcPrescription from '../energyPrescription.ts?raw';
import * as prescriptionModule from '../energyPrescription';
import {
  prescribeEnergy,
  canonicalGoalFrom,
  InvalidPrescriptionInputError,
  ENERGY_PRESCRIPTION_VERSION,
  CANONICAL_GOALS,
  FAT_LOSS_RELATIVE_DEFICIT,
  FAT_LOSS_ABSOLUTE_DEFICIT_CAP,
  MUSCLE_GAIN_RELATIVE_SURPLUS,
  FAT_LOSS_BLOCKED_BELOW_BMI,
  HSC_FAT_LOSS_SCOPE_MIN_ENERGY,
  type PrescriptionRequest,
  type EnergyPrescription,
  type CanonicalGoal,
} from '../energyPrescription';
import {
  estimateMaintenance,
  MAINTENANCE_ESTIMATE_VERSION,
  type MaintenanceEstimate,
} from '../maintenanceEstimate';
import { classifyActivity, ACTIVITY_CLASSIFIER_VERSION } from '../activityClassifier';

// ─────────────────────────────────────────────────────────────────────────────
// CAPA 1 · ENERGY PRESCRIPTION V1
//
// Fija el contrato de la única autoridad de prescripción energética DENTRO de
// su frontera: consume una MaintenanceEstimate ya calculada y un objetivo
// canónico, y produce la cifra. No orquesta la cadena, no conoce sexo, edad,
// embarazo ni ActivityProfile, y no emite OUTSIDE_HSC_NUTRITION_SCOPE.
//
// La aritmética se prueba A TRAVÉS de `prescribeEnergy`: `goalEnergy` es un
// helper interno a propósito y no debe existir como API pública.
//
// Los valores esperados están calculados aparte (aritmética float de JS) y
// escritos como literales.
//
// Nadie en producción consume todavía este módulo.
// ─────────────────────────────────────────────────────────────────────────────

const CODIGO = srcPrescription
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((l) => !l.trim().startsWith('//'))
  .map((l) => l.replace(/\/\/.*$/, ''))
  .join('\n');

const usaIdentificador = (id: string) =>
  new RegExp(`\\b${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(CODIGO);

/**
 * MaintenanceEstimate SINTÉTICA con un `initialMaintenance` exacto. Permite
 * probar la frontera del gate sobre valores crudos precisos sin tener que
 * resolver antropometrías, y mantiene este módulo desacoplado de la cadena.
 */
const synthM = (initialMaintenance: number): MaintenanceEstimate => ({
  classificationConfidence: 'CLEAR',
  category: 'ACTIVE',
  eer: initialMaintenance,
  initialMaintenance,
  source: 'DRI_2023_EER_ADULT',
  engineVersion: MAINTENANCE_ESTIMATE_VERSION,
  classifierEngineVersion: ACTIVITY_CLASSIFIER_VERSION,
});

/** Antropometría con IMC claramente ≥ 18.5, para que el guard de IMC no intervenga. */
interface Anthro { heightCm: number; weightKg: number }
const SANA: Anthro = { heightCm: 170, weightKg: 60 };   // IMC 20.76

const pedir = (goal: CanonicalGoal, m: number, anthro: Anthro = SANA): PrescriptionRequest =>
  (goal === 'FAT_LOSS'
    ? { goal, maintenance: synthM(m), ...anthro }
    : { goal, maintenance: synthM(m) });

const prescribir = (goal: CanonicalGoal, m: number, anthro: Anthro = SANA) =>
  prescribeEnergy(pedir(goal, m, anthro));

// Valores de referencia calculados aparte.
// EER(hombre 35a/178cm/82kg): INACTIVE 2687.2200000000003 · LOW 2904.9
//                             ACTIVE 3090.95 · VERY 3448.67
const M_REF = 3090.95;

// ═════════════════════════════════════════════════════════════════════════════
// 1 · LOS CUATRO OBJETIVOS · a través de la API pública
// ═════════════════════════════════════════════════════════════════════════════
describe('EnergyPrescription V1 · 1 · los cuatro objetivos', () => {
  it('los parámetros de política son los cerrados', () => {
    expect(FAT_LOSS_RELATIVE_DEFICIT).toBe(0.15);
    expect(FAT_LOSS_ABSOLUTE_DEFICIT_CAP).toBe(500);
    expect(MUSCLE_GAIN_RELATIVE_SURPLUS).toBe(0.05);
    expect(FAT_LOSS_BLOCKED_BELOW_BMI).toBe(18.5);
    expect(HSC_FAT_LOSS_SCOPE_MIN_ENERGY).toBe(1200);
    expect([...CANONICAL_GOALS].sort())
      .toEqual(['FAT_LOSS', 'MAINTENANCE', 'MUSCLE_GAIN', 'RECOMPOSITION']);
  });

  it('MAINTENANCE = M · sin déficit ni superávit', () => {
    const r = prescribir('MAINTENANCE', 3000);
    expect(r.status).toBe('PRESCRIBED');
    expect(r.rawPrescribedEnergy).toBe(3000);
    expect(r.prescribedEnergy).toBe(3000);
    expect(r.appliedDeficit).toBe(0);
    expect(r.appliedSurplus).toBe(0);
    expect(r.deficitBound).toBeNull();
  });

  it('RECOMPOSITION = M · NO es «fat loss suave»: sin −10 % ni −5 %', () => {
    for (const m of [1500, 2000, 2500, 3000, 4000]) {
      const r = prescribir('RECOMPOSITION', m);
      expect(r.rawPrescribedEnergy, `M=${m}`).toBe(m);
      expect(r.appliedDeficit).toBe(0);
      expect(r.appliedSurplus).toBe(0);
      // El legacy aplicaba 0.90 a recomposición. Comprobación explícita.
      expect(r.rawPrescribedEnergy).not.toBeCloseTo(m * 0.90, 6);
    }
  });

  it('MAINTENANCE y RECOMPOSITION dan la misma cifra', () => {
    for (const m of [1800, 2400, 3300, 4200]) {
      expect(prescribir('RECOMPOSITION', m).prescribedEnergy)
        .toBe(prescribir('MAINTENANCE', m).prescribedEnergy);
    }
  });

  it('FAT_LOSS = M − min(0.15·M, 500) · régimen RELATIVO', () => {
    const r = prescribir('FAT_LOSS', M_REF);
    expect(r.appliedDeficit).toBeCloseTo(463.6425, 6);
    expect(r.rawPrescribedEnergy).toBeCloseTo(2627.3075, 6);
    expect(r.prescribedEnergy).toBe(2627);
    expect(r.deficitBound).toBe('relative');
    expect(r.appliedSurplus).toBe(0);
  });

  it('FAT_LOSS · régimen del CAP ABSOLUTO', () => {
    const r = prescribir('FAT_LOSS', 3617.34);   // EER(H 25/186/105, ACTIVE)
    expect(r.appliedDeficit).toBe(500);
    expect(r.rawPrescribedEnergy).toBeCloseTo(3117.34, 6);
    expect(r.deficitBound).toBe('absolute_cap');
  });

  it('el cruce del cap está en M = 500/0.15 = 3333.33…', () => {
    expect(prescribir('FAT_LOSS', 3333).deficitBound).toBe('relative');
    expect(prescribir('FAT_LOSS', 3333.33).deficitBound).toBe('relative');
    expect(prescribir('FAT_LOSS', 3333.34).deficitBound).toBe('absolute_cap');
    expect(prescribir('FAT_LOSS', 4000).appliedDeficit).toBe(500);
    expect(prescribir('FAT_LOSS', 4000).rawPrescribedEnergy).toBe(3500);
  });

  it('el déficit relativo DECRECE por encima del cruce (el cap manda)', () => {
    const pct = (m: number) => prescribir('FAT_LOSS', m).appliedDeficit! / m;
    expect(pct(3000)).toBeCloseTo(0.15, 9);
    expect(pct(4000)).toBeCloseTo(0.125, 9);
    expect(pct(5000)).toBeCloseTo(0.10, 9);
    expect(pct(6000)).toBeCloseTo(0.0833333, 6);
  });

  it('MUSCLE_GAIN = M + 0.05·M', () => {
    const r = prescribir('MUSCLE_GAIN', M_REF);
    expect(r.appliedSurplus).toBeCloseTo(154.5475, 6);
    expect(r.rawPrescribedEnergy).toBeCloseTo(3245.4975, 6);
    expect(r.prescribedEnergy).toBe(3245);
    expect(r.appliedDeficit).toBe(0);
    expect(r.deficitBound).toBeNull();
    // Nada de +300/+500 mínimos ni del +12 % legacy.
    expect(r.rawPrescribedEnergy).not.toBeCloseTo(M_REF * 1.12, 6);
    expect(r.appliedSurplus!).toBeLessThan(300);
  });

  it('MUSCLE_GAIN no tiene superávit mínimo absoluto', () => {
    const r = prescribir('MUSCLE_GAIN', 1400);
    expect(r.appliedSurplus).toBeCloseTo(70, 9);
    expect(r.rawPrescribedEnergy).toBeCloseTo(1470, 9);
  });

  it('el cap de 500 NO se aplica al superávit de MUSCLE_GAIN', () => {
    // 0.05 × 12000 = 600 > 500 y debe pasar: el cap es del DÉFICIT.
    expect(prescribir('MUSCLE_GAIN', 12000).appliedSurplus).toBeCloseTo(600, 9);
  });

  it('no hay tablas beginner/intermediate/advanced ni factores por edad', () => {
    for (const id of ['beginner', 'intermediate', 'advanced', 'mayor65', 'mayor70', 'nivel']) {
      expect(usaIdentificador(id), `no debe existir ${id}`).toBe(false);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2 · MAPEO DE OBJETIVOS · los 4 strings del repo
// ═════════════════════════════════════════════════════════════════════════════
describe('EnergyPrescription V1 · 2 · mapeo de objetivos', () => {
  const PARES: Array<[string, CanonicalGoal]> = [
    ['Bajar grasa', 'FAT_LOSS'],
    ['Ganar músculo', 'MUSCLE_GAIN'],
    ['Recomposición', 'RECOMPOSITION'],
    ['Bienestar integral', 'MAINTENANCE'],
  ];

  for (const [repo, canonico] of PARES) {
    it(`'${repo}' → ${canonico}`, () => {
      expect(canonicalGoalFrom(repo)).toBe(canonico);
    });
  }

  it('acepta también los valores canónicos', () => {
    for (const g of CANONICAL_GOALS) expect(canonicalGoalFrom(g)).toBe(g);
  });

  it('normaliza acentos, espacios y mayúsculas (sin inventar fallback)', () => {
    expect(canonicalGoalFrom('recomposicion')).toBe('RECOMPOSITION');
    expect(canonicalGoalFrom('  Ganar musculo  ')).toBe('MUSCLE_GAIN');
    expect(canonicalGoalFrom('BAJAR GRASA')).toBe('FAT_LOSS');
  });

  it('«Bienestar integral» → MAINTENANCE y deja de ser un goal energético propio', () => {
    expect(canonicalGoalFrom('Bienestar integral')).toBe('MAINTENANCE');
    // El legacy le daba goalFactor 1.0, así que la energía no cambia…
    expect(prescribir(canonicalGoalFrom('Bienestar integral'), 2500).prescribedEnergy).toBe(2500);
    // …pero el CONCEPTO energético de bienestar del legacy ya no existe.
    for (const id of ['wellnessMode', 'wellnessReason', 'WellnessReason']) {
      expect(usaIdentificador(id), `no debe existir ${id}`).toBe(false);
    }
  });

  it('NO hay fallback silencioso a mantenimiento (el defecto del legacy)', () => {
    // El legacy devolvía 1.0 para cualquier texto no reconocido: un objetivo mal
    // escrito se convertía en mantenimiento sin avisar.
    for (const v of ['', '   ', 'perder peso', 'definir', 'déficit', 'tonificar',
      'Bajar', 'musculo', 'otro', null, undefined, 1, {}]) {
      expect(() => canonicalGoalFrom(v), `valor: ${String(v)}`)
        .toThrow(InvalidPrescriptionInputError);
    }
  });

  it('no usa regex sobre texto libre para decidir el objetivo', () => {
    expect(CODIGO).not.toMatch(/bajar\|perder/);
    expect(CODIGO).not.toMatch(/recompos\//);
    expect(usaIdentificador('goalFactor')).toBe(false);
  });

  it('prescribeEnergy exige el objetivo YA canónico', () => {
    for (const v of ['Bajar grasa', 'Bienestar integral', 'fat_loss', '', null, undefined]) {
      expect(() => prescribeEnergy(
        { goal: v, maintenance: synthM(2500) } as unknown as PrescriptionRequest,
      ), `goal=${String(v)}`).toThrow(InvalidPrescriptionInputError);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3 · GATE DE 1200 SOBRE EL VALOR CRUDO · los cuatro casos del contrato
// ═════════════════════════════════════════════════════════════════════════════
describe('EnergyPrescription V1 · 3 · gate de 1200 sobre rawPrescribedEnergy', () => {
  /** M sintético que produce exactamente el raw buscado (raw = 0.85·M). */
  const conRaw = (raw: number) => prescribir('FAT_LOSS', raw / 0.85);

  it('raw = 1199.9 → OUTSIDE_HSC_FAT_LOSS_SCOPE', () => {
    const r = conRaw(1199.9);
    expect(r.rawPrescribedEnergy).toBeCloseTo(1199.9, 9);
    expect(r.status).toBe('OUTSIDE_HSC_FAT_LOSS_SCOPE');
    expect(r.prescribedEnergy).toBeUndefined();
  });

  it('raw = 1200.0 → OUTSIDE_HSC_FAT_LOSS_SCOPE (el `<=` es intencional)', () => {
    const r = conRaw(1200);
    expect(r.rawPrescribedEnergy).toBe(1200);
    expect(r.status).toBe('OUTSIDE_HSC_FAT_LOSS_SCOPE');
    expect(r.prescribedEnergy).toBeUndefined();
  });

  it('raw = 1200.4 → PRESCRIBED con prescribedEnergy = 1200', () => {
    const r = conRaw(1200.4);
    expect(r.rawPrescribedEnergy).toBeCloseTo(1200.4, 9);
    expect(r.status).toBe('PRESCRIBED');
    expect(r.prescribedEnergy).toBe(1200);
  });

  it('raw = 1200.5 → PRESCRIBED con prescribedEnergy = 1201', () => {
    const r = conRaw(1200.5);
    expect(r.rawPrescribedEnergy).toBeCloseTo(1200.5, 9);
    expect(r.status).toBe('PRESCRIBED');
    expect(r.prescribedEnergy).toBe(1201);
  });

  it('el gate NO usa el valor redondeado: 1200.4 prescribe aunque redondee a 1200', () => {
    const r = conRaw(1200.4);
    // Si el gate mirara el redondeado, 1200 <= 1200 lo habría sacado de alcance.
    expect(r.status).toBe('PRESCRIBED');
    expect(r.prescribedEnergy).toBe(HSC_FAT_LOSS_SCOPE_MIN_ENERGY);
  });

  it('frontera cruda completa, de extremo a extremo', () => {
    const casos: Array<[number, 'PRESCRIBED' | 'OUTSIDE_HSC_FAT_LOSS_SCOPE', number | undefined]> = [
      [900, 'OUTSIDE_HSC_FAT_LOSS_SCOPE', undefined],
      [1150, 'OUTSIDE_HSC_FAT_LOSS_SCOPE', undefined],
      [1199.9, 'OUTSIDE_HSC_FAT_LOSS_SCOPE', undefined],
      [1200, 'OUTSIDE_HSC_FAT_LOSS_SCOPE', undefined],
      [1200.4, 'PRESCRIBED', 1200],
      [1200.5, 'PRESCRIBED', 1201],
      [1201, 'PRESCRIBED', 1201],
      [1500, 'PRESCRIBED', 1500],
    ];
    for (const [raw, esperado, kcal] of casos) {
      const r = conRaw(raw);
      expect(r.status, `raw=${raw}`).toBe(esperado);
      expect(r.prescribedEnergy, `raw=${raw}`).toBe(kcal);
    }
  });

  it('SIN CLAMP: fuera de alcance no se eleva la cifra a 1200', () => {
    const r = conRaw(1150);
    expect(r.status).toBe('OUTSIDE_HSC_FAT_LOSS_SCOPE');
    expect(r.prescribedEnergy).toBeUndefined();
    expect(r.rawPrescribedEnergy).toBeCloseTo(1150, 9);   // el crudo se conserva
    expect(CODIGO).not.toMatch(/Math\.max\s*\(\s*\d{4}/);
    expect(CODIGO).not.toMatch(/clamp/i);
  });

  it('el gate es SOLO de FAT_LOSS: los otros objetivos no lo tienen', () => {
    for (const goal of ['MAINTENANCE', 'RECOMPOSITION', 'MUSCLE_GAIN'] as CanonicalGoal[]) {
      const r = prescribir(goal, 1000);
      expect(r.status, goal).toBe('PRESCRIBED');
      expect(r.prescribedEnergy!, goal).toBeLessThanOrEqual(1050);
    }
    // El mismo mantenimiento con FAT_LOSS sí queda fuera.
    expect(prescribir('FAT_LOSS', 1000).status).toBe('OUTSIDE_HSC_FAT_LOSS_SCOPE');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4 · REDONDEO · un solo punto
// ═════════════════════════════════════════════════════════════════════════════
describe('EnergyPrescription V1 · 4 · redondeo único', () => {
  it('prescribedEnergy es SIEMPRE entero', () => {
    for (const goal of CANONICAL_GOALS) {
      for (const m of [1500.37, 2500.5, 3090.95, 4123.456]) {
        const r = prescribir(goal, m);
        expect(Number.isInteger(r.prescribedEnergy!), `${goal} @ ${m}`).toBe(true);
      }
    }
  });

  it('rawPrescribedEnergy conserva los decimales junto a la cifra redondeada', () => {
    const r = prescribir('FAT_LOSS', M_REF);
    expect(r.rawPrescribedEnergy).toBeCloseTo(2627.3075, 6);
    expect(r.prescribedEnergy).toBe(2627);
    expect(Number.isInteger(r.rawPrescribedEnergy!)).toBe(false);
  });

  it('es Math.round (nearest 1 kcal), no floor ni ceil', () => {
    expect(prescribir('MAINTENANCE', 2500.4).prescribedEnergy).toBe(2500);
    expect(prescribir('MAINTENANCE', 2500.5).prescribedEnergy).toBe(2501);
    expect(prescribir('MAINTENANCE', 2500.6).prescribedEnergy).toBe(2501);
    const r = prescribir('MUSCLE_GAIN', M_REF);
    expect(r.rawPrescribedEnergy).toBeCloseTo(3245.4975, 6);
    expect(r.prescribedEnergy).toBe(3245);   // .4975 baja
  });

  it('un ÚNICO Math.round en todo el módulo', () => {
    const ocurrencias = (CODIGO.match(/Math\.round/g) ?? []).length;
    expect(ocurrencias, 'el redondeo debe ocurrir en un solo lugar').toBe(1);
    expect(CODIGO).not.toMatch(/toFixed|Math\.floor|Math\.ceil|Math\.trunc/);
  });

  it('no hay redondeo a 5/10/25/50/100 kcal', () => {
    expect(prescribir('FAT_LOSS', M_REF).prescribedEnergy! % 5).not.toBe(0);
    expect(CODIGO).not.toMatch(/\/\s*(5|10|25|50|100)\s*\)\s*\*\s*(5|10|25|50|100)/);
  });

  it('el mantenimiento de entrada NO se redondea al pasar por aquí', () => {
    const r = prescribir('MAINTENANCE', 2997.925);
    expect(r.maintenance.initialMaintenance).toBe(2997.925);
    expect(r.rawPrescribedEnergy).toBe(2997.925);
    expect(r.prescribedEnergy).toBe(2998);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5 · FAT LOSS GATE · IMC
// ═════════════════════════════════════════════════════════════════════════════
describe('EnergyPrescription V1 · 5 · guard de IMC', () => {
  const conAnthro = (h: number, w: number) => prescribir('FAT_LOSS', 2500, { heightCm: h, weightKg: w });

  it('IMC < 18.5 → FAT_LOSS_BLOCKED, conservando el mantenimiento', () => {
    const r = conAnthro(170, 53);   // IMC 18.3391
    expect(r.status).toBe('FAT_LOSS_BLOCKED');
    expect(r.bmi).toBeCloseTo(18.3391, 3);
    expect(r.maintenance.initialMaintenance).toBe(2500);
    expect(r.prescribedEnergy).toBeUndefined();
    expect(r.rawPrescribedEnergy).toBeUndefined();
    expect(r.appliedDeficit).toBeUndefined();
  });

  it('frontera de IMC 18.49 / 18.50 a 170 cm', () => {
    expect(conAnthro(170, 53.4361).status).toBe('FAT_LOSS_BLOCKED');   // IMC 18.49
    expect(conAnthro(170, 53.465).status).toBe('PRESCRIBED');          // IMC 18.50
  });

  it('el guard va ANTES del gate de 1200', () => {
    // IMC bajo Y raw muy por debajo de 1200: debe salir BLOCKED, no fuera de alcance.
    const r = prescribir('FAT_LOSS', 1000, { heightCm: 170, weightKg: 50 });
    expect(r.bmi!).toBeLessThan(18.5);
    expect(r.status).toBe('FAT_LOSS_BLOCKED');
  });

  it('el guard es CONDICIONAL al objetivo: solo FAT_LOSS lo tiene', () => {
    // Los otros tres ni reciben antropometría, así que no pueden bloquearse.
    for (const goal of ['MAINTENANCE', 'RECOMPOSITION', 'MUSCLE_GAIN'] as CanonicalGoal[]) {
      const r = prescribir(goal, 2500);
      expect(r.status, goal).toBe('PRESCRIBED');
      expect(r.bmi, goal).toBeUndefined();
    }
  });

  it('IMC alto no altera la aritmética', () => {
    const normal = prescribir('FAT_LOSS', 2500, { heightCm: 170, weightKg: 60 });
    const alto = prescribir('FAT_LOSS', 2500, { heightCm: 170, weightKg: 120 });
    expect(alto.rawPrescribedEnergy).toBe(normal.rawPrescribedEnergy);
    expect(alto.appliedDeficit).toBe(normal.appliedDeficit);
  });

  it('bmi es DERIVADO de talla y peso, nunca un input', () => {
    expect(prescribir('FAT_LOSS', 2500, { heightCm: 178, weightKg: 82 }).bmi)
      .toBeCloseTo(25.8806, 4);
    expect(prescribir('FAT_LOSS', 2500, { heightCm: 170, weightKg: 53.465 }).bmi)
      .toBeCloseTo(18.5, 9);
    expect(usaIdentificador('bmi')).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6 · PASS-THROUGH DEL MANTENIMIENTO · el edge case DRI, sin corregir
// ═════════════════════════════════════════════════════════════════════════════
describe('EnergyPrescription V1 · 6 · pass-through del mantenimiento', () => {
  // Hombre 30a / 150cm / 45kg (IMC 20.0): el edge case documentado en
  // maintenanceEstimate, donde VERY_ACTIVE da un EER INFERIOR a ACTIVE.
  const ANTHRO_EDGE = { sex: 'male' as const, ageYears: 30, heightCm: 150, weightKg: 45 };
  const CLASIF_CLEAR_ACTIVE = classifyActivity({
    dailyLife: 'DL3',
    habitualTraining: { trainsHabitually: true, daysPerWeek: 1, habitualSessionMinutes: 200 },
  });
  const CLASIF_BORDERLINE_AV = classifyActivity({
    dailyLife: 'DL4',
    habitualTraining: { trainsHabitually: false, daysPerWeek: 0, habitualSessionMinutes: 0 },
  });

  it('el fixture reproduce el edge case: la clasificación MÁS alta da MENOS mantenimiento', () => {
    expect(CLASIF_CLEAR_ACTIVE.classificationConfidence).toBe('CLEAR');
    expect(CLASIF_CLEAR_ACTIVE.category).toBe('ACTIVE');
    expect(CLASIF_BORDERLINE_AV.classificationConfidence).toBe('BORDERLINE');
    expect(CLASIF_BORDERLINE_AV.upperCategory).toBe('VERY_ACTIVE');

    const mA = estimateMaintenance(ANTHRO_EDGE, CLASIF_CLEAR_ACTIVE);
    const mB = estimateMaintenance(ANTHRO_EDGE, CLASIF_BORDERLINE_AV);
    expect(mA.initialMaintenance).toBeCloseTo(2373.87, 6);
    expect(mB.initialMaintenance).toBeCloseTo(2366.27, 6);
    expect(mB.initialMaintenance).toBeLessThan(mA.initialMaintenance);
  });

  it('si el mantenimiento B < A, la prescripción B < A · se consume TAL CUAL', () => {
    const mA = estimateMaintenance(ANTHRO_EDGE, CLASIF_CLEAR_ACTIVE);
    const mB = estimateMaintenance(ANTHRO_EDGE, CLASIF_BORDERLINE_AV);

    const a = prescribeEnergy({ goal: 'MAINTENANCE', maintenance: mA });
    const b = prescribeEnergy({ goal: 'MAINTENANCE', maintenance: mB });
    expect(a.prescribedEnergy).toBe(2374);
    expect(b.prescribedEnergy).toBe(2366);
    expect(b.prescribedEnergy!).toBeLessThan(a.prescribedEnergy!);

    // Y lo mismo con un objetivo que aplica déficit.
    const fa = prescribeEnergy({ goal: 'FAT_LOSS', maintenance: mA, heightCm: 150, weightKg: 45 });
    const fb = prescribeEnergy({ goal: 'FAT_LOSS', maintenance: mB, heightCm: 150, weightKg: 45 });
    expect(fa.prescribedEnergy).toBe(2018);
    expect(fb.prescribedEnergy).toBe(2011);
    expect(fb.prescribedEnergy!).toBeLessThan(fa.prescribedEnergy!);
  });

  it('NO corrige el mantenimiento: sin clamp, sin Math.max, sin saneamiento', () => {
    const mB = estimateMaintenance(ANTHRO_EDGE, CLASIF_BORDERLINE_AV);
    const r = prescribeEnergy({ goal: 'MAINTENANCE', maintenance: mB });
    expect(r.rawPrescribedEnergy).toBe(mB.initialMaintenance);
    expect(CODIGO).not.toMatch(/Math\.max\s*\(\s*(m|initialMaintenance|maintenance)/);
    expect(CODIGO).not.toMatch(/Math\.min\s*\(\s*(m|initialMaintenance)\b/);
    expect(usaIdentificador('lowerEER')).toBe(false);
    expect(usaIdentificador('upperEER')).toBe(false);
  });

  it('«más actividad ⇒ nunca menos kcal» NO es un invariante de este módulo', () => {
    // Se afirma la NEGACIÓN a propósito, para que nadie lo convierta en regla:
    // existe al menos un perfil real donde subir de categoría baja la cifra.
    const mA = estimateMaintenance(ANTHRO_EDGE, CLASIF_CLEAR_ACTIVE);
    const mB = estimateMaintenance(ANTHRO_EDGE, CLASIF_BORDERLINE_AV);
    const a = prescribeEnergy({ goal: 'MAINTENANCE', maintenance: mA }).prescribedEnergy!;
    const b = prescribeEnergy({ goal: 'MAINTENANCE', maintenance: mB }).prescribedEnergy!;
    expect(b < a, 'el edge case DRI debe seguir siendo observable aquí').toBe(true);
  });

  it('en una antropometría SIN el edge case, subir de categoría sí sube la cifra', () => {
    // Contraparte: el edge case es un rincón, no la norma. Hombre 35/178/82.
    const anthro = { sex: 'male' as const, ageYears: 35, heightCm: 178, weightKg: 82 };
    const cifras = (
      [
        { dailyLife: 'DL1', habitualTraining: { trainsHabitually: false, daysPerWeek: 0, habitualSessionMinutes: 0 } },
        { dailyLife: 'DL1', habitualTraining: { trainsHabitually: true, daysPerWeek: 1, habitualSessionMinutes: 200 } },
        { dailyLife: 'DL1', habitualTraining: { trainsHabitually: true, daysPerWeek: 1, habitualSessionMinutes: 500 } },
        { dailyLife: 'DL4', habitualTraining: { trainsHabitually: false, daysPerWeek: 0, habitualSessionMinutes: 0 } },
      ] as const
    ).map((ap) => prescribeEnergy({
      goal: 'MAINTENANCE',
      maintenance: estimateMaintenance(anthro, classifyActivity(ap)),
    }).prescribedEnergy!);
    for (let i = 0; i < cifras.length - 1; i++) {
      expect(cifras[i + 1]).toBeGreaterThanOrEqual(cifras[i]);
    }
  });

  it('acepta una MaintenanceEstimate CLEAR y una BORDERLINE sin distinción', () => {
    const anthro = { sex: 'female' as const, ageYears: 30, heightCm: 165, weightKg: 62 };
    const clear = estimateMaintenance(anthro, classifyActivity({
      dailyLife: 'DL2',
      habitualTraining: { trainsHabitually: true, daysPerWeek: 5, habitualSessionMinutes: 60 },
    }));
    const border = estimateMaintenance(anthro, classifyActivity({
      dailyLife: 'DL4',
      habitualTraining: { trainsHabitually: false, daysPerWeek: 0, habitualSessionMinutes: 0 },
    }));
    expect(clear.classificationConfidence).toBe('CLEAR');
    expect(border.classificationConfidence).toBe('BORDERLINE');
    for (const m of [clear, border]) {
      const r = prescribeEnergy({ goal: 'MAINTENANCE', maintenance: m });
      expect(r.status).toBe('PRESCRIBED');
      expect(r.rawPrescribedEnergy).toBe(m.initialMaintenance);
    }
  });

  it('un BORDERLINE no se entrega como rango: la cifra es una', () => {
    const anthro = { sex: 'male' as const, ageYears: 35, heightCm: 178, weightKg: 82 };
    const border = estimateMaintenance(anthro, classifyActivity({
      dailyLife: 'DL4',
      habitualTraining: { trainsHabitually: false, daysPerWeek: 0, habitualSessionMinutes: 0 },
    }));
    expect(border.lowerEER).toBeCloseTo(3090.95, 6);
    expect(border.upperEER).toBeCloseTo(3448.67, 6);
    const r = prescribeEnergy({ goal: 'MAINTENANCE', maintenance: border });
    expect(typeof r.prescribedEnergy).toBe('number');
    expect(r.prescribedEnergy).toBe(3270);   // midpoint 3269.81
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 7 · FORMA DE LOS TRES ESTADOS
// ═════════════════════════════════════════════════════════════════════════════
describe('EnergyPrescription V1 · 7 · forma de cada estado', () => {
  const porEstado: Record<string, EnergyPrescription> = {
    PRESCRIBED: prescribir('MAINTENANCE', 2500),
    FAT_LOSS_BLOCKED: prescribir('FAT_LOSS', 2500, { heightCm: 170, weightKg: 50 }),
    OUTSIDE_HSC_FAT_LOSS_SCOPE: prescribir('FAT_LOSS', 1000),
  };

  it('los TRES estados son alcanzables, y son solo tres', () => {
    for (const [nombre, r] of Object.entries(porEstado)) expect(r.status).toBe(nombre);
    expect(Object.keys(porEstado)).toHaveLength(3);
  });

  it('OUTSIDE_HSC_NUTRITION_SCOPE NO existe en este módulo', () => {
    const estados = new Set(Object.values(porEstado).map((r) => r.status));
    expect(estados.has('OUTSIDE_HSC_NUTRITION_SCOPE' as never)).toBe(false);
    expect(usaIdentificador('OUTSIDE_HSC_NUTRITION_SCOPE')).toBe(false);
    expect(usaIdentificador('scopeReason')).toBe(false);
    expect(usaIdentificador('NutritionScopeReason')).toBe(false);
  });

  it('solo PRESCRIBED trae prescribedEnergy', () => {
    for (const [nombre, r] of Object.entries(porEstado)) {
      if (nombre === 'PRESCRIBED') expect(typeof r.prescribedEnergy).toBe('number');
      else expect(r.prescribedEnergy, nombre).toBeUndefined();
    }
  });

  it('los TRES conservan la MaintenanceEstimate de entrada', () => {
    for (const [nombre, r] of Object.entries(porEstado)) {
      expect(r.maintenance, nombre).toBeDefined();
      expect(r.maintenance.source, nombre).toBe('DRI_2023_EER_ADULT');
      expect(typeof r.maintenance.initialMaintenance, nombre).toBe('number');
    }
  });

  it('FAT_LOSS_BLOCKED no trae cifras de energía; el otro sí trae el crudo', () => {
    expect(porEstado.FAT_LOSS_BLOCKED.rawPrescribedEnergy).toBeUndefined();
    expect(porEstado.FAT_LOSS_BLOCKED.appliedDeficit).toBeUndefined();
    expect(porEstado.OUTSIDE_HSC_FAT_LOSS_SCOPE.rawPrescribedEnergy).toBeDefined();
    expect(porEstado.OUTSIDE_HSC_FAT_LOSS_SCOPE.appliedDeficit).toBeGreaterThan(0);
    expect(porEstado.OUTSIDE_HSC_FAT_LOSS_SCOPE.deficitBound).toBe('relative');
  });

  it('los dos estados de parada solo ocurren con goal FAT_LOSS', () => {
    expect(porEstado.FAT_LOSS_BLOCKED.goal).toBe('FAT_LOSS');
    expect(porEstado.OUTSIDE_HSC_FAT_LOSS_SCOPE.goal).toBe('FAT_LOSS');
  });

  it('todos llevan goal y engineVersion', () => {
    for (const [nombre, r] of Object.entries(porEstado)) {
      expect(CANONICAL_GOALS, nombre).toContain(r.goal);
      expect(r.engineVersion, nombre).toBe(1);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 8 · TRAZABILIDAD
// ═════════════════════════════════════════════════════════════════════════════
describe('EnergyPrescription V1 · 8 · trazabilidad', () => {
  it('PRESCRIBED permite reconstruir el «por qué» de la cifra', () => {
    const r = prescribir('FAT_LOSS', M_REF);
    expect(r.goal).toBe('FAT_LOSS');
    expect(r.engineVersion).toBe(ENERGY_PRESCRIPTION_VERSION);
    expect(r.maintenance.initialMaintenance).toBe(M_REF);
    expect(r.appliedDeficit).toBeCloseTo(463.6425, 6);
    expect(r.appliedSurplus).toBe(0);
    expect(r.deficitBound).toBe('relative');
    expect(r.rawPrescribedEnergy).toBeCloseTo(2627.3075, 6);
    expect(r.prescribedEnergy).toBe(2627);
    // M − déficit = raw, verificable desde los propios campos.
    expect(r.maintenance.initialMaintenance - r.appliedDeficit!)
      .toBeCloseTo(r.rawPrescribedEnergy!, 9);
  });

  it('MUSCLE_GAIN: M + superávit = raw', () => {
    const r = prescribir('MUSCLE_GAIN', M_REF);
    expect(r.maintenance.initialMaintenance + r.appliedSurplus!)
      .toBeCloseTo(r.rawPrescribedEnergy!, 9);
  });

  it('deficitBound distingue el régimen relativo del cap', () => {
    expect(prescribir('FAT_LOSS', M_REF).deficitBound).toBe('relative');
    expect(prescribir('FAT_LOSS', 3617.34).deficitBound).toBe('absolute_cap');
    expect(prescribir('FAT_LOSS', 3617.34).appliedDeficit).toBe(500);
  });

  it('las versiones del eslabón anterior viajan intactas', () => {
    const anthro = { sex: 'male' as const, ageYears: 35, heightCm: 178, weightKg: 82 };
    const m = estimateMaintenance(anthro, classifyActivity({
      dailyLife: 'DL2',
      habitualTraining: { trainsHabitually: true, daysPerWeek: 5, habitualSessionMinutes: 60 },
    }));
    const r = prescribeEnergy({ goal: 'MAINTENANCE', maintenance: m });
    expect(r.engineVersion).toBe(1);
    expect(r.maintenance.engineVersion).toBe(MAINTENANCE_ESTIMATE_VERSION);
    expect(r.maintenance.classifierEngineVersion).toBe(ACTIVITY_CLASSIFIER_VERSION);
  });

  it('engineVersion es PROPIO · no se reutiliza ninguno de los otros', () => {
    expect(ENERGY_PRESCRIPTION_VERSION).toBe(1);
    expect(usaIdentificador('PLAN_ENGINE_VERSION')).toBe(false);
    expect(usaIdentificador('ACTIVITY_CLASSIFIER_VERSION')).toBe(false);
    expect(usaIdentificador('MAINTENANCE_ESTIMATE_VERSION')).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 9 · DETERMINISMO
// ═════════════════════════════════════════════════════════════════════════════
describe('EnergyPrescription V1 · 9 · determinismo', () => {
  it('mismo input → mismo resultado exacto (50 veces)', () => {
    const req = pedir('FAT_LOSS', M_REF);
    const primero = prescribeEnergy(req);
    for (let i = 0; i < 50; i++) expect(prescribeEnergy(req)).toEqual(primero);
  });

  it('no muta la entrada', () => {
    const req = pedir('FAT_LOSS', M_REF);
    const copia = structuredClone(req);
    prescribeEnergy(req);
    expect(req).toEqual(copia);
  });

  it('no lee reloj, aleatoriedad ni entorno', () => {
    expect(CODIGO).not.toMatch(/Math\.random/);
    expect(CODIGO).not.toMatch(/Date\.now|new Date\(/);
    expect(CODIGO).not.toMatch(/localStorage|sessionStorage|process\.env|import\.meta\.env/);
  });

  it('un cambio mínimo en el mantenimiento mueve el crudo', () => {
    const a = prescribir('MAINTENANCE', 2500.000);
    const b = prescribir('MAINTENANCE', 2500.001);
    expect(b.rawPrescribedEnergy).not.toBe(a.rawPrescribedEnergy);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 10 · INPUTS INVÁLIDOS · fail-closed, solo los PROPIOS
// ═════════════════════════════════════════════════════════════════════════════
describe('EnergyPrescription V1 · 10 · inputs inválidos', () => {
  describe('maintenance', () => {
    for (const v of [null, undefined, 'M', 2500, []]) {
      it(`rechaza maintenance = ${String(v)}`, () => {
        expect(() => prescribeEnergy(
          { goal: 'MAINTENANCE', maintenance: v } as unknown as PrescriptionRequest,
        )).toThrow(InvalidPrescriptionInputError);
      });
    }
    for (const v of [NaN, Infinity, -Infinity, 0, -2500, '2500', null, undefined]) {
      it(`rechaza initialMaintenance = ${String(v)}`, () => {
        expect(() => prescribeEnergy({
          goal: 'MAINTENANCE',
          maintenance: { ...synthM(2500), initialMaintenance: v } as unknown as MaintenanceEstimate,
        })).toThrow(InvalidPrescriptionInputError);
      });
    }
  });

  describe('goal', () => {
    for (const v of ['', 'FATLOSS', 'fat_loss', 'Bajar grasa', 'otro', null, undefined, 1, {}]) {
      it(`rechaza goal = ${String(v)}`, () => {
        expect(() => prescribeEnergy(
          { goal: v, maintenance: synthM(2500) } as unknown as PrescriptionRequest,
        )).toThrow(InvalidPrescriptionInputError);
      });
    }
  });

  describe('heightCm / weightKg · obligatorios SOLO en FAT_LOSS', () => {
    for (const v of [0, -1, NaN, Infinity, '170', null, undefined]) {
      it(`FAT_LOSS rechaza heightCm = ${String(v)}`, () => {
        expect(() => prescribeEnergy(
          { goal: 'FAT_LOSS', maintenance: synthM(2500), heightCm: v, weightKg: 60 } as unknown as PrescriptionRequest,
        )).toThrow(InvalidPrescriptionInputError);
      });
      it(`FAT_LOSS rechaza weightKg = ${String(v)}`, () => {
        expect(() => prescribeEnergy(
          { goal: 'FAT_LOSS', maintenance: synthM(2500), heightCm: 170, weightKg: v } as unknown as PrescriptionRequest,
        )).toThrow(InvalidPrescriptionInputError);
      });
    }
    it('los otros tres objetivos NO los exigen', () => {
      for (const goal of ['MAINTENANCE', 'RECOMPOSITION', 'MUSCLE_GAIN'] as CanonicalGoal[]) {
        expect(() => prescribeEnergy({ goal, maintenance: synthM(2500) } as PrescriptionRequest))
          .not.toThrow();
      }
    });
    it('no impone límites fisiológicos nuevos de talla ni peso', () => {
      expect(() => prescribir('FAT_LOSS', 2500, { heightCm: 300, weightKg: 300 })).not.toThrow();
    });
  });

  describe('estructura', () => {
    for (const v of [null, undefined, 'req', 42, []]) {
      it(`rechaza request = ${String(v)}`, () => {
        expect(() => prescribeEnergy(v as unknown as PrescriptionRequest)).toThrow();
      });
    }
  });

  it('el error identifica tipo, nombre y campo', () => {
    try {
      prescribeEnergy({ goal: 'FAT_LOSS', maintenance: synthM(2500), heightCm: -1, weightKg: 60 });
      expect.unreachable('debió lanzar');
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidPrescriptionInputError);
      expect((e as InvalidPrescriptionInputError).name).toBe('InvalidPrescriptionInputError');
      expect((e as InvalidPrescriptionInputError).field).toBe('heightCm');
      expect((e as InvalidPrescriptionInputError).received).toBe(-1);
    }
  });

  it('ningún input inválido devuelve una prescripción', () => {
    const invalidos: unknown[] = [
      { goal: 'MAINTENANCE', maintenance: null },
      { goal: 'otro', maintenance: synthM(2500) },
      { goal: 'FAT_LOSS', maintenance: synthM(2500), heightCm: 0, weightKg: 60 },
      { goal: 'MAINTENANCE', maintenance: { ...synthM(2500), initialMaintenance: NaN } },
      null, undefined,
    ];
    for (const req of invalidos) {
      let r: EnergyPrescription | null = null;
      try { r = prescribeEnergy(req as PrescriptionRequest); } catch { /* esperado */ }
      expect(r, JSON.stringify(req) ?? String(req)).toBeNull();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 11 · FRONTERA DEL MÓDULO · lo que ya NO le pertenece
// ═════════════════════════════════════════════════════════════════════════════
describe('EnergyPrescription V1 · 11 · frontera del módulo', () => {
  it('NO importa activityClassifier', () => {
    const from = srcPrescription.split('\n')
      .map((l) => l.match(/from\s+'([^']+)'/)?.[1])
      .filter((x): x is string => !!x);
    expect(from).not.toContain('./activityClassifier');
    expect([...new Set(from)]).toEqual(['./maintenanceEstimate']);
  });

  it('solo importa el CONTRATO de maintenanceEstimate, como import de tipo', () => {
    expect(srcPrescription).toMatch(/import\s+type\s*\{[^}]*MaintenanceEstimate[^}]*\}\s*from\s*'\.\/maintenanceEstimate'/);
  });

  it('NO llama classifyActivity ni estimateMaintenance', () => {
    expect(usaIdentificador('classifyActivity')).toBe(false);
    expect(usaIdentificador('estimateMaintenance')).toBe(false);
    expect(usaIdentificador('biologicalSexFrom')).toBe(false);
    expect(usaIdentificador('eerForCategory')).toBe(false);
  });

  it('NO conoce sexo', () => {
    for (const id of ['sex', 'sexo', 'BiologicalSex', 'male', 'female', 'Hombre', 'Mujer']) {
      expect(usaIdentificador(id), `no debe conocer ${id}`).toBe(false);
    }
  });

  it('NO conoce edad ni su frontera de alcance', () => {
    for (const id of ['ageYears', 'edad', 'ADULT_ROUTE_MIN_AGE_YEARS', 'age_under_19']) {
      expect(usaIdentificador(id), `no debe conocer ${id}`).toBe(false);
    }
    expect(CODIGO).not.toMatch(/\b19\b/);
  });

  it('NO conoce embarazo ni lactancia', () => {
    for (const id of ['pregnantOrLactating', 'pregnancy', 'lactation', 'embarazo', 'lactancia']) {
      expect(usaIdentificador(id), `no debe conocer ${id}`).toBe(false);
    }
  });

  it('NO recibe ActivityProfile ni ActivityClassification', () => {
    for (const id of ['ActivityProfile', 'ActivityClassification', 'dailyLife',
      'habitualTraining', 'weeklyTrainingMinutes', 'matrixCell', 'trainingBand']) {
      expect(usaIdentificador(id), `no debe conocer ${id}`).toBe(false);
    }
  });

  it('`goalEnergy` NO está exportado', () => {
    expect(Object.keys(prescriptionModule)).not.toContain('goalEnergy');
    expect((prescriptionModule as Record<string, unknown>).goalEnergy).toBeUndefined();
    expect(CODIGO, 'debe declararse sin export').toMatch(/^function goalEnergy/m);
    expect(CODIGO).not.toMatch(/export\s+function\s+goalEnergy/);
  });

  it('la ÚNICA API pública de prescripción es prescribeEnergy', () => {
    const funciones = Object.entries(prescriptionModule)
      .filter(([, v]) => typeof v === 'function')
      .map(([k]) => k)
      .sort();
    // `canonicalGoalFrom` es un mapeo de taxonomía (no calcula energía) y
    // `InvalidPrescriptionInputError` es una clase de error.
    expect(funciones).toEqual(['InvalidPrescriptionInputError', 'canonicalGoalFrom', 'prescribeEnergy']);
  });

  it('ningún export calcula energía saltándose los guards', () => {
    for (const [nombre, v] of Object.entries(prescriptionModule)) {
      if (typeof v !== 'function' || nombre === 'prescribeEnergy') continue;
      // Ni `canonicalGoalFrom` ni el constructor del error devuelven kcal.
      const salida = nombre === 'canonicalGoalFrom' ? (v as typeof canonicalGoalFrom)('Bajar grasa') : null;
      expect(typeof salida, nombre).not.toBe('number');
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 12 · AISLAMIENTO DE AUTORIDAD LEGACY
// ═════════════════════════════════════════════════════════════════════════════
describe('EnergyPrescription V1 · 12 · aislamiento de autoridad legacy', () => {
  it('NO usa ninguna autoridad energética legacy', () => {
    const PROHIBIDAS = [
      'nutritionTargets', 'computeNutritionTargets', 'parseObData',
      'ACTIVITY_FACTORS', 'activityFactor', 'calcTDEE', 'goalFactor', 'sexFloor',
      'wellnessMode', 'wellnessReason', 'assignPlan', 'mealCalorieSplit',
      'obData', 'bodyFat', 'bodyFatPct', 'targetWeight', 'pesoMeta',
      'planGoal', 'tdee', 'useAppStore', 'supabase', 'actIdx',
      'completedSessions', 'workout_log', 'trainingFrequency',
    ];
    for (const p of PROHIBIDAS) {
      expect(usaIdentificador(p), `no debe usar ${p}`).toBe(false);
    }
  });

  it('NO reimplementa ningún piso legacy', () => {
    expect(CODIGO, 'sin piso de mujer 1200 como clamp').not.toMatch(/Math\.max[^)]*1200/);
    expect(CODIGO, 'sin piso de hombre 1500').not.toMatch(/\b1500\b/);
    expect(CODIGO, 'sin BMR').not.toMatch(/\bbmr\b/i);
    expect(CODIGO, 'sin Mifflin/Katch').not.toMatch(/Mifflin|Katch/);
    expect(CODIGO, 'sin los factores legacy').not.toMatch(/\b0\.80\b|\b1\.12\b|\b1\.375\b|\b1\.725\b/);
  });

  it('NO toca macros', () => {
    for (const p of ['protG', 'fatG', 'carbG', 'fiberG', 'macros', 'normalizeGoal',
      'conditions', 'renal']) {
      expect(usaIdentificador(p), `no debe usar ${p}`).toBe(false);
    }
  });

  it('targetWeight queda FUERA de la cadena energética', () => {
    for (const p of ['targetWeight', 'pesoMeta', 'targetBmi', 'targetWeightNotice']) {
      expect(usaIdentificador(p), `${p} no pertenece al camino energético`).toBe(false);
    }
    // TS ya rechaza `targetWeight` en `PrescriptionRequest` (propiedad excedente),
    // así que para comprobar el comportamiento en ejecución hay que forzar el tipo.
    const base = prescribir('FAT_LOSS', M_REF);
    const conTarget = prescribeEnergy(
      { ...pedir('FAT_LOSS', M_REF), targetWeight: 60 } as unknown as PrescriptionRequest,
    );
    expect(conTarget).toEqual(base);
  });

  it('% de grasa adjunto no cambia nada', () => {
    const base = prescribir('FAT_LOSS', M_REF);
    for (const extra of [{ grasa: 25 }, { bodyFat: 12 }, { activity: 'Atleta' }]) {
      expect(prescribeEnergy(
        { ...pedir('FAT_LOSS', M_REF), ...extra } as unknown as PrescriptionRequest,
      )).toEqual(base);
    }
  });

  it('no se auto-integra: sin React, sin store, sin rutas relativas al exterior', () => {
    expect(CODIGO).not.toMatch(/from\s+'\.\.\//);
    expect(CODIGO).not.toMatch(/react|zustand/i);
  });
});
