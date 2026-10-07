import { describe, it, expect } from 'vitest';
import srcOrchestrator from '../nutritionEnergyOrchestrator.ts?raw';
import {
  resolveNutritionEnergy,
  ORCHESTRATOR_VERSION,
  type NutritionEnergyResult,
} from '../nutritionEnergyOrchestrator';
import { InvalidProfileInputError, type ProfileInput } from '../profileValidation';
import {
  InvalidActivityProfileError,
  ACTIVITY_CLASSIFIER_VERSION,
  type ActivityProfile,
} from '../activityClassifier';
import { InvalidMaintenanceInputError, MAINTENANCE_ESTIMATE_VERSION } from '../maintenanceEstimate';
import { ENERGY_PRESCRIPTION_VERSION } from '../energyPrescription';

// ─────────────────────────────────────────────────────────────────────────────
// CAPA 1 · NUTRITION ENERGY ORCHESTRATOR
//
// Fija el ensamblaje: el orden de los cinco pasos, el cortocircuito del Scope
// Guard, la unión de cuatro estados, y que nada se recalcule ni se reinterprete.
//
// Los valores esperados vienen de los módulos cerrados y están calculados
// aparte: EER(hombre 35a/178cm/82kg) = INACTIVE 2687.22 · LOW 2904.9 ·
// ACTIVE 3090.95 · VERY 3448.67.
//
// Nadie en producción consume todavía este módulo.
// ─────────────────────────────────────────────────────────────────────────────

const CODIGO = srcOrchestrator
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((l) => !l.trim().startsWith('//'))
  .map((l) => l.replace(/\/\/.*$/, ''))
  .join('\n');

const usaIdentificador = (id: string) =>
  new RegExp(`\\b${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(CODIGO);

/** DL2 × T3 (300 min/sem) → CLEAR_ACTIVE. */
const ACT_CLEAR_ACTIVE: ActivityProfile = {
  dailyLife: 'DL2',
  habitualTraining: { trainsHabitually: true, daysPerWeek: 5, habitualSessionMinutes: 60 },
};
/** DL1 × T0 → CLEAR_INACTIVE. */
const ACT_CLEAR_INACTIVE: ActivityProfile = {
  dailyLife: 'DL1',
  habitualTraining: { trainsHabitually: false, daysPerWeek: 0, habitualSessionMinutes: 0 },
};
/** DL4 × T0 → BORDERLINE ACTIVE↔VERY. */
const ACT_BORDERLINE_AV: ActivityProfile = {
  dailyLife: 'DL4',
  habitualTraining: { trainsHabitually: false, daysPerWeek: 0, habitualSessionMinutes: 0 },
};
/** Estructuralmente inválido para el clasificador. */
const ACT_ROTO = { dailyLife: 'DL9', habitualTraining: { trainsHabitually: 'x' } } as unknown as ActivityProfile;

const perfil = (over: Partial<ProfileInput> = {}): ProfileInput => ({
  sex: 'Hombre', goal: 'Bienestar integral', ageYears: 35, heightCm: 178, weightKg: 82,
  pregnantOrLactating: false, requiresTherapeuticDiet: false, activityProfile: ACT_CLEAR_ACTIVE, ...over,
});

const resolver = (over: Partial<ProfileInput> = {}) => resolveNutritionEnergy(perfil(over));

const M_ACTIVE = 3090.95;

// ═════════════════════════════════════════════════════════════════════════════
// 1 · ORDEN DE LOS PASOS
// ═════════════════════════════════════════════════════════════════════════════
describe('Orchestrator · 1 · orden de los pasos', () => {
  it('0 antes de 1: un dato inválido LANZA aunque también esté fuera de alcance', () => {
    // sex vacío + edad 16: gana INVALID PROFILE INPUT, no OUTSIDE_SCOPE.
    expect(() => resolver({ sex: '', ageYears: 16 })).toThrow(InvalidProfileInputError);
  });

  it('0 antes de 1: objetivo no mapeable LANZA aunque esté embarazada', () => {
    expect(() => resolver({ goal: 'tonificar', sex: 'Mujer', pregnantOrLactating: true }))
      .toThrow(InvalidProfileInputError);
  });

  it('1 antes de 2: fuera de alcance no clasifica ni estima', () => {
    const r = resolver({ ageYears: 16 });
    expect(r.status).toBe('OUTSIDE_HSC_NUTRITION_SCOPE');
    expect(r.classification).toBeUndefined();
    expect(r.maintenance).toBeUndefined();
  });

  it('2 → 3 → 4: dentro de alcance se ejecutan los tres motores', () => {
    const r = resolver();
    expect(r.status).toBe('PRESCRIBED');
    expect(r.classification).toBeDefined();
    expect(r.maintenance).toBeDefined();
    expect(r.prescribedEnergy).toBeDefined();
  });

  it('los pasos se invocan en el orden contractual DENTRO de la función', () => {
    // Se mide en el CUERPO, no en el archivo: los `import` del tope aparecen en
    // otro orden y medirlos ahí sería un test sobre formato incidental.
    const cuerpo = CODIGO.slice(CODIGO.indexOf('export function resolveNutritionEnergy'));
    const pos = (s: string) => cuerpo.indexOf(`${s}(`);
    expect(pos('validateNutritionProfile')).toBeGreaterThan(-1);
    expect(pos('validateNutritionProfile')).toBeLessThan(pos('checkNutritionScope'));
    expect(pos('checkNutritionScope')).toBeLessThan(pos('classifyActivity'));
    expect(pos('classifyActivity')).toBeLessThan(pos('estimateMaintenance'));
    expect(pos('estimateMaintenance')).toBeLessThan(pos('prescribeEnergy'));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2 · CORTOCIRCUITO DEL SCOPE GUARD · el requisito crítico
// ═════════════════════════════════════════════════════════════════════════════
describe('Orchestrator · 2 · cortocircuito del Scope Guard', () => {
  it('edad < 19 + ActivityProfile INVÁLIDO → OUTSIDE_HSC_NUTRITION_SCOPE, NO error', () => {
    const r = resolveNutritionEnergy(perfil({ ageYears: 16, activityProfile: ACT_ROTO }));
    expect(r.status).toBe('OUTSIDE_HSC_NUTRITION_SCOPE');
    expect(r.scopeReason).toBe('age_under_19');
  });

  it('el mismo ActivityProfile inválido SÍ lanza cuando está dentro de alcance', () => {
    // Contraparte: demuestra que el fixture es realmente inválido y que la
    // diferencia la hace el cortocircuito, no el fixture.
    expect(() => resolveNutritionEnergy(perfil({ ageYears: 35, activityProfile: ACT_ROTO })))
      .toThrow(InvalidActivityProfileError);
  });

  it('embarazo/lactancia + ActivityProfile INVÁLIDO → estado, NO error', () => {
    const r = resolveNutritionEnergy(perfil({
      sex: 'Mujer', pregnantOrLactating: true, activityProfile: ACT_ROTO,
    }));
    expect(r.status).toBe('OUTSIDE_HSC_NUTRITION_SCOPE');
    expect(r.scopeReason).toBe('pregnancy_or_lactation');
  });

  it('edad < 19 + talla/peso que MaintenanceEstimate rechazaría → estado, NO error', () => {
    const r = resolveNutritionEnergy(perfil({ ageYears: 16, heightCm: 0, weightKg: -5 }));
    expect(r.status).toBe('OUTSIDE_HSC_NUTRITION_SCOPE');
  });

  it('la contraparte: esa talla/peso SÍ lanza dentro de alcance', () => {
    expect(() => resolveNutritionEnergy(perfil({ ageYears: 35, heightCm: 0 })))
      .toThrow(InvalidMaintenanceInputError);
  });

  it('MaintenanceEstimate nunca ve una edad < 19', () => {
    // Si la viera, lanzaría InvalidMaintenanceInputError en lugar de devolver.
    for (const age of [18.999, 18, 13, 0]) {
      const r = resolveNutritionEnergy(perfil({ ageYears: age }));
      expect(r.status, `edad ${age}`).toBe('OUTSIDE_HSC_NUTRITION_SCOPE');
    }
  });

  // ── C4-PRE · 19–64 inclusive ────────────────────────────────────────────
  it('edad >= 65 CORTOCIRCUITA en el Scope Guard, sin ejecutar ningún motor', () => {
    for (const age of [65, 70, 90]) {
      const r = resolveNutritionEnergy(perfil({ ageYears: age }));
      expect(r.status, `edad ${age}`).toBe('OUTSIDE_HSC_NUTRITION_SCOPE');
      expect(r.scopeReason, `edad ${age}`).toBe('age_65_or_over');
      // Ningún motor corrió: ni clasificación, ni mantenimiento, ni prescripción.
      expect(r.classification, `edad ${age}`).toBeUndefined();
      expect(r.maintenance, `edad ${age}`).toBeUndefined();
      expect(r.prescribedEnergy, `edad ${age}`).toBeUndefined();
      expect(r.rawPrescribedEnergy, `edad ${age}`).toBeUndefined();
      expect(r.engineVersion, `edad ${age}`).toBeUndefined();
      expect(r.bmi, `edad ${age}`).toBeUndefined();
    }
  });

  it('64 sigue entrando al pipeline completo y 65 no', () => {
    const dentro = resolveNutritionEnergy(perfil({ ageYears: 64 }));
    expect(dentro.status).toBe('PRESCRIBED');
    expect(dentro.maintenance).toBeDefined();
    expect(dentro.classification).toBeDefined();

    const fuera = resolveNutritionEnergy(perfil({ ageYears: 65 }));
    expect(fuera.status).toBe('OUTSIDE_HSC_NUTRITION_SCOPE');
    expect(fuera.maintenance).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3 · UNIÓN DE CUATRO ESTADOS
// ═════════════════════════════════════════════════════════════════════════════
describe('Orchestrator · 3 · unión de cuatro estados', () => {
  const porEstado: Record<string, NutritionEnergyResult> = {
    PRESCRIBED: resolver(),
    FAT_LOSS_BLOCKED: resolver({ goal: 'Bajar grasa', heightCm: 170, weightKg: 50 }),
    OUTSIDE_HSC_FAT_LOSS_SCOPE: resolver({
      sex: 'Mujer', goal: 'Bajar grasa', ageYears: 64, heightCm: 138, weightKg: 35.24,
      activityProfile: ACT_CLEAR_INACTIVE,
    }),
    OUTSIDE_HSC_NUTRITION_SCOPE: resolver({ ageYears: 16 }),
  };

  it('los CUATRO estados son alcanzables, y son exactamente cuatro', () => {
    for (const [nombre, r] of Object.entries(porEstado)) expect(r.status).toBe(nombre);
    expect(Object.keys(porEstado)).toHaveLength(4);
  });

  it('solo PRESCRIBED contiene prescribedEnergy', () => {
    for (const [nombre, r] of Object.entries(porEstado)) {
      if (nombre === 'PRESCRIBED') expect(typeof r.prescribedEnergy).toBe('number');
      else expect(r.prescribedEnergy, nombre).toBeUndefined();
    }
  });

  it('INVALID PROFILE INPUT no es un quinto estado: lanza', () => {
    let r: NutritionEnergyResult | null = null;
    try { r = resolver({ sex: '' }); } catch { /* esperado */ }
    expect(r).toBeNull();
    expect(usaIdentificador('INVALID_PROFILE_INPUT')).toBe(false);
  });

  it('los tres primeros conservan la SEMÁNTICA de EnergyPrescription', () => {
    // Sin traducir, sin renombrar, sin reconstruir: los nombres de estado son
    // literalmente los del módulo cerrado.
    expect(porEstado.PRESCRIBED.status).toBe('PRESCRIBED');
    expect(porEstado.FAT_LOSS_BLOCKED.status).toBe('FAT_LOSS_BLOCKED');
    expect(porEstado.OUTSIDE_HSC_FAT_LOSS_SCOPE.status).toBe('OUTSIDE_HSC_FAT_LOSS_SCOPE');
    // Y sus campos llegan intactos.
    expect(porEstado.FAT_LOSS_BLOCKED.bmi).toBeCloseTo(17.3010, 3);
    expect(porEstado.OUTSIDE_HSC_FAT_LOSS_SCOPE.rawPrescribedEnergy).toBeCloseTo(1137.53834, 5);
    expect(porEstado.OUTSIDE_HSC_FAT_LOSS_SCOPE.deficitBound).toBe('relative');
  });

  it('scopeReason existe SOLO en OUTSIDE_HSC_NUTRITION_SCOPE', () => {
    for (const [nombre, r] of Object.entries(porEstado)) {
      if (nombre === 'OUTSIDE_HSC_NUTRITION_SCOPE') expect(r.scopeReason).toBeDefined();
      else expect(r.scopeReason, nombre).toBeUndefined();
    }
  });

  it('los cuatro llevan goal y orchestratorVersion', () => {
    for (const [nombre, r] of Object.entries(porEstado)) {
      expect(r.goal, nombre).toBeDefined();
      expect(r.orchestratorVersion, nombre).toBe(1);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4 · LA CADENA · CLEAR, BORDERLINE y los cuatro objetivos
// ═════════════════════════════════════════════════════════════════════════════
describe('Orchestrator · 4 · la cadena', () => {
  it('ruta CLEAR · hombre 35/178/82 · los cuatro objetivos', () => {
    const esperado: Array<[string, number]> = [
      ['Bienestar integral', 3091],   // M = 3090.95
      ['Recomposición', 3091],
      ['Bajar grasa', 2627],          // 3090.95 − 463.6425
      ['Ganar músculo', 3245],        // 3090.95 × 1.05
    ];
    for (const [goal, kcal] of esperado) {
      const r = resolver({ goal });
      expect(r.status, goal).toBe('PRESCRIBED');
      expect(r.classification!.classificationConfidence, goal).toBe('CLEAR');
      expect(r.maintenance!.initialMaintenance, goal).toBeCloseTo(M_ACTIVE, 6);
      expect(r.prescribedEnergy, goal).toBe(kcal);
    }
  });

  it('el objetivo legacy «Subir masa muscular» recorre la cadena igual', () => {
    const a = resolver({ goal: 'Ganar músculo' });
    const b = resolver({ goal: 'Subir masa muscular' });
    expect(b.goal).toBe('MUSCLE_GAIN');
    expect(b).toEqual(a);
    expect(b.prescribedEnergy).toBe(3245);
  });

  it('ruta BORDERLINE · la cifra sale del midpoint, no de un rango', () => {
    const r = resolver({ activityProfile: ACT_BORDERLINE_AV });
    expect(r.classification!.classificationConfidence).toBe('BORDERLINE');
    expect(r.maintenance!.lowerEER).toBeCloseTo(3090.95, 6);
    expect(r.maintenance!.upperEER).toBeCloseTo(3448.67, 6);
    expect(r.maintenance!.initialMaintenance).toBeCloseTo(3269.81, 6);
    expect(typeof r.prescribedEnergy).toBe('number');
    expect(r.prescribedEnergy).toBe(3270);
  });

  it('CLEAR_INACTIVE da un mantenimiento distinto y una cifra distinta', () => {
    const r = resolver({ activityProfile: ACT_CLEAR_INACTIVE });
    expect(r.maintenance!.initialMaintenance).toBeCloseTo(2687.22, 6);
    expect(r.prescribedEnergy).toBe(2687);
  });

  it('FAT_LOSS_BLOCKED conserva mantenimiento y clasificación', () => {
    const r = resolver({ goal: 'Bajar grasa', heightCm: 170, weightKg: 50 });
    expect(r.status).toBe('FAT_LOSS_BLOCKED');
    expect(r.maintenance).toBeDefined();
    expect(r.classification).toBeDefined();
    expect(r.prescribedEnergy).toBeUndefined();
  });

  it('las 20 celdas del clasificador × 4 objetivos recorren la cadena', () => {
    const DL = ['DL1', 'DL2', 'DL3', 'DL4'] as const;
    const MINS = [0, 90, 200, 350, 500];
    let n = 0;
    for (const dailyLife of DL) {
      for (const mins of MINS) {
        const activityProfile: ActivityProfile = {
          dailyLife,
          habitualTraining: mins === 0
            ? { trainsHabitually: false, daysPerWeek: 0, habitualSessionMinutes: 0 }
            : { trainsHabitually: true, daysPerWeek: 1, habitualSessionMinutes: mins },
        };
        for (const goal of ['Bajar grasa', 'Ganar músculo', 'Recomposición', 'Bienestar integral']) {
          const r = resolver({ goal, activityProfile });
          expect(r.status).toBe('PRESCRIBED');
          expect(Number.isInteger(r.prescribedEnergy!)).toBe(true);
          n++;
        }
      }
    }
    expect(n).toBe(80);
  });

  it('el edge case no monótono del DRI pasa SIN clamp', () => {
    // Hombre 30a/150cm/45kg (IMC 20): la clasificación MÁS alta produce MENOS
    // mantenimiento, porque las ecuaciones del DRI no son monótonas ahí.
    const base = { sex: 'Hombre', goal: 'Bienestar integral', ageYears: 30,
      heightCm: 150, weightKg: 45 };
    const clearActive = resolver({
      ...base,
      activityProfile: { dailyLife: 'DL3',
        habitualTraining: { trainsHabitually: true, daysPerWeek: 1, habitualSessionMinutes: 200 } },
    });
    const borderlineAV = resolver({ ...base, activityProfile: ACT_BORDERLINE_AV });

    expect(clearActive.maintenance!.initialMaintenance).toBeCloseTo(2373.87, 6);
    expect(borderlineAV.maintenance!.initialMaintenance).toBeCloseTo(2366.27, 6);
    expect(clearActive.prescribedEnergy).toBe(2374);
    expect(borderlineAV.prescribedEnergy).toBe(2366);
    // Más actividad, MENOS kcal: se consume tal cual.
    expect(borderlineAV.prescribedEnergy!).toBeLessThan(clearActive.prescribedEnergy!);
  });

  it('el orquestador no corrige ese edge case', () => {
    expect(CODIGO).not.toMatch(/Math\.max|Math\.min|clamp/i);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5 · TRAZABILIDAD
// ═════════════════════════════════════════════════════════════════════════════
describe('Orchestrator · 5 · trazabilidad', () => {
  it('la classification completa es recuperable', () => {
    const r = resolver();
    expect(r.classification!.classificationConfidence).toBe('CLEAR');
    expect(r.classification!.matrixCell).toEqual({ dailyLife: 'DL2', trainingBand: 'T3' });
    expect(r.classification!.weeklyTrainingMinutes).toBe(300);
    expect(r.classification!.engineVersion).toBe(ACTIVITY_CLASSIFIER_VERSION);
  });

  it('las CUATRO versiones son recuperables en PRESCRIBED', () => {
    const r = resolver();
    expect(r.orchestratorVersion).toBe(ORCHESTRATOR_VERSION);
    expect(r.engineVersion).toBe(ENERGY_PRESCRIPTION_VERSION);
    expect(r.maintenance!.engineVersion).toBe(MAINTENANCE_ESTIMATE_VERSION);
    expect(r.classification!.engineVersion).toBe(ACTIVITY_CLASSIFIER_VERSION);
  });

  it('ORCHESTRATOR_VERSION es PROPIA y vale 1', () => {
    expect(ORCHESTRATOR_VERSION).toBe(1);
    expect(usaIdentificador('PLAN_ENGINE_VERSION')).toBe(false);
  });

  it('maintenance llega ANIDADO y tal cual lo entregó su módulo', () => {
    const r = resolver({ activityProfile: ACT_BORDERLINE_AV });
    expect(r.maintenance!.source).toBe('DRI_2023_EER_ADULT');
    expect(r.maintenance!.classificationConfidence).toBe('BORDERLINE');
    expect(r.maintenance!.lowerCategory).toBe('ACTIVE');
    expect(r.maintenance!.upperCategory).toBe('VERY_ACTIVE');
  });

  it('NO duplica campos de los motores en niveles alternativos', () => {
    const r = resolver({ activityProfile: ACT_BORDERLINE_AV }) as unknown as Record<string, unknown>;
    for (const k of ['initialMaintenance', 'classifierEngineVersion', 'category',
      'lowerCategory', 'upperCategory', 'lowerEER', 'upperEER', 'eer',
      'weeklyTrainingMinutes', 'matrixCell', 'trainingBand', 'dailyLife']) {
      expect(r[k], `${k} no debe estar al nivel superior`).toBeUndefined();
    }
  });

  it('la coherencia entre niveles no se contradice', () => {
    const r = resolver();
    expect(r.maintenance!.classifierEngineVersion).toBe(r.classification!.engineVersion);
    expect(r.maintenance!.classificationConfidence).toBe(r.classification!.classificationConfidence);
    expect(r.maintenance!.category).toBe(r.classification!.category);
  });

  it('M − déficit = raw, verificable desde los propios campos', () => {
    const r = resolver({ goal: 'Bajar grasa' });
    expect(r.maintenance!.initialMaintenance - r.appliedDeficit!)
      .toBeCloseTo(r.rawPrescribedEnergy!, 9);
  });

  it('OUTSIDE_HSC_NUTRITION_SCOPE lleva solo la versión del ensamblaje', () => {
    const r = resolver({ ageYears: 16 });
    expect(r.orchestratorVersion).toBe(1);
    expect(Object.keys(r).sort())
      .toEqual(['goal', 'orchestratorVersion', 'scopeReason', 'status']);
    const o = r as unknown as Record<string, unknown>;
    for (const k of ['engineVersion', 'classifierEngineVersion', 'maintenance',
      'classification', 'bmi', 'prescribedEnergy', 'rawPrescribedEnergy']) {
      expect(o[k], `${k} no debe existir si no corrió ningún motor`).toBeUndefined();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6 · NO RECALCULA NADA
// ═════════════════════════════════════════════════════════════════════════════
describe('Orchestrator · 6 · no recalcula nada', () => {
  it('no contiene ninguna fórmula energética', () => {
    // Coeficientes del DRI, factores legacy, el déficit, el cap, el superávit,
    // el IMC y el gate de 1200: nada de eso puede vivir aquí.
    for (const n of ['753.07', '584.90', '10.83', '7.01', '15.91', '12.34',
      '0.15', '0.85', '1.05', '500', '1200', '18.5', '1.12', '0.80']) {
      expect(CODIGO, `no debe contener ${n}`).not.toContain(n);
    }
  });

  it('no redondea: el único Math.round de la cadena es de EnergyPrescription', () => {
    expect(CODIGO).not.toMatch(/Math\.round|toFixed|Math\.floor|Math\.ceil/);
  });

  it('no declara EER, PAL, BMR ni TDEE propios', () => {
    for (const id of ['eer', 'EER', 'PAL', 'bmr', 'BMR', 'tdee', 'TDEE',
      'bmiFrom', 'goalEnergy', 'deficit', 'surplus']) {
      expect(usaIdentificador(id), `no debe declarar ${id}`).toBe(false);
    }
  });

  it('`bmi` aparece SOLO como marcador de tipo, nunca como cálculo', () => {
    // El marcador `bmi?: undefined` es necesario para que la unión estreche;
    // lo que no puede existir es una derivación del IMC aquí.
    const apariciones = CODIGO.split('\n').filter((l) => /\bbmi\b/.test(l));
    expect(apariciones).toHaveLength(1);
    expect(apariciones[0].trim()).toBe('bmi?: undefined;');
    expect(CODIGO).not.toMatch(/bmi\s*=|weightKg\s*\/|heightCm\s*\//);
  });

  it('no inventa un scoring de actividad alternativo', () => {
    for (const id of ['score', 'activityScore', 'trainingBandOf', 'activityOrdinalRank',
      'MATRIX', 'DL1', 'T0']) {
      expect(usaIdentificador(id), `no debe declarar ${id}`).toBe(false);
    }
  });

  it('el resultado de los motores es idéntico al que producen por separado', () => {
    // Prueba contractual del pass-through: el orquestador no transforma nada.
    const r = resolver({ goal: 'Bajar grasa' });
    expect(r.maintenance!.initialMaintenance).toBe(M_ACTIVE);
    expect(r.rawPrescribedEnergy).toBeCloseTo(2627.3075, 6);
    expect(r.appliedDeficit).toBeCloseTo(463.6425, 6);
    expect(r.appliedSurplus).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 7 · ERRORES DE LOS MOTORES · se propagan sin reinterpretar
// ═════════════════════════════════════════════════════════════════════════════
describe('Orchestrator · 7 · propagación de errores', () => {
  it('el error del boundary de perfil es InvalidProfileInputError', () => {
    try {
      resolver({ sex: 'Otro' });
      expect.unreachable('debió lanzar');
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidProfileInputError);
      expect((e as InvalidProfileInputError).field).toBe('sex');
    }
  });

  it('el error del clasificador NO se envuelve', () => {
    try {
      resolver({ activityProfile: ACT_ROTO });
      expect.unreachable('debió lanzar');
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidActivityProfileError);
      expect((e as InvalidActivityProfileError).field).toBe('dailyLife');
    }
  });

  it('el error del estimador NO se envuelve', () => {
    try {
      resolver({ weightKg: -1 });
      expect.unreachable('debió lanzar');
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidMaintenanceInputError);
      expect((e as InvalidMaintenanceInputError).field).toBe('weightKg');
    }
  });

  it('no hay try/catch que reinterprete los errores de los motores', () => {
    expect(CODIGO).not.toMatch(/catch/);
  });

  it('ningún input inválido devuelve un resultado', () => {
    const invalidos: Array<Partial<ProfileInput>> = [
      { sex: '' }, { goal: 'tonificar' }, { ageYears: NaN },
      { heightCm: 'x' as unknown as number }, { weightKg: 0 },
      { pregnantOrLactating: 'si' as unknown as boolean },
      { activityProfile: ACT_ROTO },
    ];
    for (const over of invalidos) {
      let r: NutritionEnergyResult | null = null;
      try { r = resolver(over); } catch { /* esperado */ }
      expect(r, JSON.stringify(over)).toBeNull();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 8 · DETERMINISMO
// ═════════════════════════════════════════════════════════════════════════════
describe('Orchestrator · 8 · determinismo', () => {
  it('mismo input → mismo resultado exacto (50 veces)', () => {
    const p = perfil({ goal: 'Bajar grasa' });
    const primero = resolveNutritionEnergy(p);
    for (let i = 0; i < 50; i++) expect(resolveNutritionEnergy(p)).toEqual(primero);
  });

  it('no muta el perfil de entrada', () => {
    const p = perfil({ goal: 'Bajar grasa' });
    const copia = structuredClone(p);
    resolveNutritionEnergy(p);
    expect(p).toEqual(copia);
  });

  it('no lee reloj, aleatoriedad ni entorno', () => {
    expect(CODIGO).not.toMatch(/Math\.random/);
    expect(CODIGO).not.toMatch(/Date\.now|new Date\(/);
    expect(CODIGO).not.toMatch(/localStorage|sessionStorage|process\.env|import\.meta\.env/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 9 · AISLAMIENTO DE AUTORIDAD
// ═════════════════════════════════════════════════════════════════════════════
describe('Orchestrator · 9 · aislamiento de autoridad', () => {
  it('importa EXACTAMENTE los cinco módulos de la cadena', () => {
    const importados = [...new Set(
      CODIGO.split('\n')
        .map((l) => l.match(/from\s+'([^']+)'/)?.[1])
        .filter((x): x is string => !!x),
    )].sort();
    expect(importados).toEqual([
      './activityClassifier', './energyPrescription', './maintenanceEstimate',
      './nutritionScopeGuard', './profileValidation',
    ]);
  });

  it('NO depende de ninguna autoridad legacy', () => {
    const PROHIBIDAS = [
      'nutritionTargets', 'computeNutritionTargets', 'parseObData', 'tdee', 'calcTDEE',
      'ACTIVITY_FACTORS', 'activityFactor', 'goalFactor', 'wellnessMode', 'sexFloor',
      'Mifflin', 'Katch', 'targetWeight', 'pesoMeta', 'bodyFat', 'grasa',
      'obData', 'actIdx', 'useAppStore', 'supabase', 'completedSessions', 'workout_log',
      'trainingFrequency', 'planGoal', 'assignPlan', 'mealCalorieSplit',
    ];
    for (const p of PROHIBIDAS) {
      expect(usaIdentificador(p), `no debe usar ${p}`).toBe(false);
    }
  });

  it('no se auto-integra: sin React, sin store, sin rutas al exterior', () => {
    expect(CODIGO).not.toMatch(/from\s+'\.\.\//);
    expect(CODIGO).not.toMatch(/react|zustand/i);
  });

  it('`targetWeight` no es input ni aparece en el resultado', () => {
    const base = resolver({ goal: 'Bajar grasa' });
    const conTarget = resolveNutritionEnergy({
      ...perfil({ goal: 'Bajar grasa' }), targetWeight: 60, pesoMeta: 60,
    } as unknown as ProfileInput);
    expect(conTarget).toEqual(base);
    const o = base as unknown as Record<string, unknown>;
    expect(o.targetWeight).toBeUndefined();
    expect(o.pesoMeta).toBeUndefined();
  });

  it('% de grasa y activity legacy adjuntos no cambian nada', () => {
    const base = resolver({ goal: 'Bajar grasa' });
    for (const extra of [{ grasa: 25 }, { bodyFat: 12 }, { activity: 'Atleta' },
      { conditions: 'renal' }, { trainingFrequency: 6 }]) {
      expect(resolveNutritionEnergy(
        { ...perfil({ goal: 'Bajar grasa' }), ...extra } as unknown as ProfileInput,
      ), JSON.stringify(extra)).toEqual(base);
    }
  });

  it('`pregnantOrLactating` llega como booleano explícito, no se lee de obData', () => {
    expect(usaIdentificador('embarazo')).toBe(false);
    expect(usaIdentificador('obData')).toBe(false);
    const r = resolver({ sex: 'Mujer', pregnantOrLactating: true });
    expect(r.status).toBe('OUTSIDE_HSC_NUTRITION_SCOPE');
  });

  it('no construye ningún mapper desde los dominios prohibidos de actividad', () => {
    for (const id of ['trainingFrequency', 'completedSessions', 'workoutHistory',
      'steps', 'wearable', 'activityLog', 'levelFromObData']) {
      expect(usaIdentificador(id), `no debe mapear desde ${id}`).toBe(false);
    }
  });
});
