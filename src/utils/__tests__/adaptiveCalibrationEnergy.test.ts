import { describe, it, expect } from 'vitest';
import {
  calibratedEnergy, rawCalibratedEnergy, energyOutcomeForDecision,
  CALIBRATION_STEP_PERCENT, CALIBRATION_SAFETY_FLOOR_KCAL, CALIBRATION_ENERGY_VERSION,
} from '../adaptiveCalibrationEnergy';
import { resolveEffectiveNutritionEnergy } from '../adaptiveEnergyAuthority';
import { HSC_FAT_LOSS_SCOPE_MIN_ENERGY, ENERGY_PRESCRIPTION_VERSION } from '../energyPrescription';
import { CALIBRATION_STEP_MIN, CALIBRATION_STEP_MAX, type AdaptiveDecision } from '../adaptiveNutritionDecision';
import { ENERGY_CALIBRATION_VERSION, type NutritionCalibration } from '../adaptiveCalibrationCore';
import { resolveNutritionEnergyState } from '../nutritionEnergyState';
import { prescribeMacros, resolveMacroPrescription, MACRO_PRESCRIPTION_VERSION } from '../macroPrescription';
import { CHECKIN_REQUEST_FIELDS, START_REQUEST_FIELDS } from '../adaptiveCheckinPlanner';
import { PLAN_ENGINE_VERSION } from '../planEngine';
import { TRAINING_BANDS } from '../activityClassifier';
import { avoidPolicy } from '../avoidAuthority';
import ENTRY_SRC from '../nutritionEngineEntry.ts?raw';

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE NUTRITION · BLOQUE 5 · capa de ENERGÍA CALIBRADA (pura, todavía sin consumidores productivos).
//   calibrada = BASE congelada (cruda) × (1 + 0.05 × STEP), STEP ∈ −2…+2, sin compounding,
//   suelo T1 al bajar sobre el CRUDO, redondeo una sola vez, adopción solo con evidencia verificable.
// ─────────────────────────────────────────────────────────────────────────────

// BLOQUE 9 · la adopción la decide la autoridad de energía efectiva (Bloque 6), que además verifica la
// cadena de check-ins. `resolveCalibratedEnergy` (Bloque 5, adoptaba el paso DECIDIDO) quedó retirado.
const OBX = { sex: 'Hombre', edad: 35, estatura: 178, peso: 82, embarazo: 0, requiresTherapeuticDiet: 0,
  dailyLife: 'DL2', trainsHabitually: 1, trainingDaysPerWeek: 5, trainingSessionMinutes: 60, trainingModalities: 'strength' };
const adopt = (cal: NutritionCalibration | null, goal = 'Bajar grasa', peso = 82) => {
  const o = { ...OBX, goal, peso };
  return resolveEffectiveNutritionEnergy({ state: resolveNutritionEnergyState(o as never), obData: o, calibration: cal, checkins: [], today: '2026-10-30' });
};
const ok = (base: number, step: number) => {
  const r = calibratedEnergy(base, step);
  if (r.status !== 'CALIBRATED') throw new Error(`esperaba CALIBRATED: ${JSON.stringify(r)}`);
  return r;
};
const decision = (over: Partial<AdaptiveDecision>): AdaptiveDecision => ({
  action: 'MAINTAIN', reason: 'ON_TARGET', objective: 'FAT_LOSS', cycleIndex: 1, currentStep: 0, proposedStep: 0, blocked: null, ...over,
});
const CAL = (over: Partial<NutritionCalibration> = {}): NutritionCalibration => ({
  id: 'c1', objective: 'FAT_LOSS', status: 'ACTIVE', baselineDate: '2026-10-01', cycleStart: '2026-10-04', baselineWeightKg: 82,
  baselineWaistCm: null, currentStep: 0, baseEnergyKcal: null, baseEnergyRaw: null, lastCheckinId: null, lastAppliedAction: null, lastAppliedAt: null,
  calibrationVersion: ENERGY_CALIBRATION_VERSION, createdAt: '2026-10-01T00:00:00Z', closedAt: null, ...over,
});

describe('A–E · FÓRMULA · base 2000', () => {
  it.each([[0, 2000], [-1, 1900], [-2, 1800], [1, 2100], [2, 2200]])('step %i → %i', (step, kcal) => {
    const r = ok(2000, step);
    expect(r.rawCalibratedEnergy).toBe(kcal);
    expect(r.calibratedEnergy).toBe(kcal);
  });
  it('cada paso vale 5 % de la base y el rango es −2…+2 (los mismos límites que MB3)', () => {
    expect(CALIBRATION_STEP_PERCENT).toBe(5);
    expect([CALIBRATION_STEP_MIN, CALIBRATION_STEP_MAX]).toEqual([-2, 2]);
  });
});

describe('F · SIN COMPOUNDING', () => {
  it('base 2000: +1 y después +1 otra vez → 2200 (2000 × 1.10), NO 2205 (2100 × 1.05)', () => {
    const tras1 = energyOutcomeForDecision({ baseRawEnergy: 2000, step: 0 }, decision({ action: 'STEP_UP', reason: 'BELOW_TARGET', objective: 'MUSCLE_GAIN', currentStep: 0, proposedStep: 1 }));
    expect(tras1).toMatchObject({ kind: 'ADOPT', step: 1, calibratedEnergy: 2100 });
    const tras2 = energyOutcomeForDecision({ baseRawEnergy: 2000, step: 1 }, decision({ action: 'STEP_UP', reason: 'BELOW_TARGET', objective: 'MUSCLE_GAIN', currentStep: 1, proposedStep: 2 }));
    expect(tras2).toMatchObject({ kind: 'ADOPT', step: 2, rawCalibratedEnergy: 2200, calibratedEnergy: 2200 });
    expect(2100 * 1.05).toBeCloseTo(2205);
  });
  it('la energía de un paso depende solo de (base, paso), nunca del camino recorrido', () => {
    const base = 2473.37;
    for (const s of [-2, -1, 0, 1, 2]) expect(ok(base, s).rawCalibratedEnergy).toBe(rawCalibratedEnergy(base, s));
    expect(ok(base, 2).rawCalibratedEnergy).toBeCloseTo(base * 1.1, 9);
  });
});

describe('G · BASE CONGELADA · el progreso de peso no la mueve', () => {
  it('con la misma base congelada, cambiar el peso del perfil no cambia la energía calibrada', () => {
    const ob = (peso: number) => ({ sex: 'Hombre', goal: 'Bajar grasa', edad: 35, estatura: 178, peso, embarazo: 0, requiresTherapeuticDiet: 0,
      dailyLife: 'DL2', trainsHabitually: 1, trainingDaysPerWeek: 5, trainingSessionMinutes: 60, trainingModalities: 'strength' });
    const s82 = resolveNutritionEnergyState(ob(82) as never), s78 = resolveNutritionEnergyState(ob(78) as never);
    expect(s82.rawPrescribedEnergy).not.toBe(s78.rawPrescribedEnergy);               // CAPA 1 sí cambia con el peso
    const frozen = s82.rawPrescribedEnergy!;                                          // base congelada al abrir
    const a = adopt(CAL({ baseEnergyRaw: frozen }), 'Bajar grasa', 78), b = adopt(CAL({ baseEnergyRaw: frozen }), 'Bajar grasa', 82);
    expect(a.source).toBe('CALIBRATED');
    expect(a.effective).toEqual(b.effective);
  });
});

describe('H · PASO fuera de ±2 → REVIEW, no se adopta', () => {
  it.each([-3, 3, 1.5, Number.NaN])('step %s', (s) => {
    expect(calibratedEnergy(2000, s)).toMatchObject({ status: 'REVIEW', reason: 'STEP_OUT_OF_RANGE' });
    // un paso así nunca sale de una cadena válida: la autoridad lo rechaza (CAPA 1, sin adopción)
    expect(adopt(CAL({ currentStep: s, baseEnergyRaw: 2000 }))).toMatchObject({ source: 'BASE', status: 'NOT_ADOPTED' });
  });
  it('base no válida → REVIEW · INVALID_BASE', () => {
    for (const b of [0, -1, Number.NaN, Infinity]) expect(calibratedEnergy(b, 0)).toMatchObject({ status: 'REVIEW', reason: 'INVALID_BASE' });
  });
});

describe('I / J · SUELO T1 · al bajar, sobre el CRUDO', () => {
  it('la constante es la de CAPA 1 (1200)', () => expect(CALIBRATION_SAFETY_FLOOR_KCAL).toBe(HSC_FAT_LOSS_SCOPE_MIN_ENERGY));
  it('I · base 1263 · step −1 da 1199.85 ≤ 1200 → REVIEW · SAFETY_FLOOR_REACHED; se conservan paso y kcal anteriores', () => {
    expect(calibratedEnergy(1263, -1)).toMatchObject({ status: 'REVIEW', reason: 'SAFETY_FLOOR_REACHED', rawCalibratedEnergy: 1199.85 });
    const out = energyOutcomeForDecision({ baseRawEnergy: 1263, step: 0 }, decision({ action: 'STEP_DOWN', reason: 'VERY_SLOW', currentStep: 0, proposedStep: -1 }));
    expect(out).toEqual({ kind: 'KEEP', action: 'REVIEW', reason: 'SAFETY_FLOOR_REACHED', step: 0, calibratedEnergy: 1263,
      blocked: { action: 'STEP_DOWN', reason: 'VERY_SLOW', rawCalibratedEnergy: 1199.85 } });
  });
  it('desde −1 hacia −2 también conserva −1 y su energía (no se aplica parcialmente)', () => {
    // base 1320: −1 → 1254 (vigente), −2 → 1188 ≤ 1200
    const out = energyOutcomeForDecision({ baseRawEnergy: 1320, step: -1 }, decision({ action: 'STEP_DOWN', reason: 'BORDERLINE_SLOW_CONFIRMED', currentStep: -1, proposedStep: -2 }));
    expect(out).toMatchObject({ kind: 'KEEP', action: 'REVIEW', reason: 'SAFETY_FLOOR_REACHED', step: -1, calibratedEnergy: 1254,
      blocked: { action: 'STEP_DOWN', reason: 'BORDERLINE_SLOW_CONFIRMED', rawCalibratedEnergy: 1188 } });
  });
  it('J · se evalúa el CRUDO: 1200.002 se adopta aunque redondee a 1200; 1200 exacto (base 1500 · −4 % no existe) → ver propiedad', () => {
    const r = ok(1263.16, -1);                                                               // 1263.16 × 0.95 = 1200.002
    expect(r.rawCalibratedEnergy).toBeGreaterThan(1200);
    expect(r.calibratedEnergy).toBe(1200);                                                   // redondea a 1200 y aun así se adopta
    expect(calibratedEnergy(1263.15, -1)).toMatchObject({ status: 'REVIEW', reason: 'SAFETY_FLOOR_REACHED' });   // 1199.99… crudo
    expect(calibratedEnergy(1600, -2)).toMatchObject({ status: 'CALIBRATED', calibratedEnergy: 1440 });
  });
  it('J · propiedad: REVIEW ⇔ crudo ≤ 1200 (nunca el redondeado), para muchas bases y los dos pasos hacia abajo', () => {
    for (let b = 1250; b <= 1400; b += 0.37) for (const step of [-1, -2]) {
      const raw = rawCalibratedEnergy(b, step);
      const r = calibratedEnergy(b, step);
      expect(r.status === 'REVIEW', `${b} · ${step}`).toBe(raw <= 1200);
      if (r.status === 'REVIEW') expect(r.reason).toBe('SAFETY_FLOOR_REACHED');
    }
  });
  it('subir nunca dispara el suelo; step 0 no lo evalúa (su seguridad es el gate de CAPA 1)', () => {
    expect(ok(1100, 1).calibratedEnergy).toBe(1155);
    expect(ok(1100, 0).calibratedEnergy).toBe(1100);
  });
});

describe('K · STEP 0 = salida exacta de CAPA 1', () => {
  it('para perfiles reales, step 0 sobre el crudo reproduce prescribedEnergy (mismo redondeo, una vez)', () => {
    const perfiles = [
      { sex: 'Hombre', goal: 'Bajar grasa', edad: 35, estatura: 178, peso: 82 },
      { sex: 'Mujer', goal: 'Bajar grasa', edad: 30, estatura: 165, peso: 68 },
      { sex: 'Hombre', goal: 'Ganar músculo', edad: 25, estatura: 180, peso: 75 },
      { sex: 'Mujer', goal: 'Bienestar integral', edad: 45, estatura: 160, peso: 60 },
      { sex: 'Hombre', goal: 'Recomposición', edad: 28, estatura: 175, peso: 78 },
    ].map((p) => ({ ...p, embarazo: 0, requiresTherapeuticDiet: 0, dailyLife: 'DL2', trainsHabitually: 1, trainingDaysPerWeek: 4, trainingSessionMinutes: 60, trainingModalities: 'strength' }));
    for (const p of perfiles) {
      const s = resolveNutritionEnergyState(p as never);
      if (s.status !== 'PRESCRIBED') continue;
      expect(ok(s.rawPrescribedEnergy!, 0).calibratedEnergy, p.goal).toBe(s.prescribedEnergy);
    }
  });
});

describe('MB3 · la capa de energía respeta su resultado (no duplica los guards)', () => {
  it('MAINTAIN / NO_ADJUSTMENT / REVIEW de MB3 → KEEP con la energía del paso vigente', () => {
    for (const d of [decision({ action: 'MAINTAIN', reason: 'ON_TARGET', currentStep: 1, proposedStep: 1 }),
      decision({ action: 'NO_ADJUSTMENT', reason: 'ADHERENCE_NOT_HIGH', currentStep: 1, proposedStep: 1 }),
      decision({ action: 'REVIEW', reason: 'DIRECTION_REVERSAL_BLOCKED', currentStep: 1, proposedStep: 1, blocked: { action: 'STEP_DOWN', reason: 'VERY_SLOW' } }),
      decision({ action: 'REVIEW', reason: 'CALIBRATION_LIMIT_REACHED', currentStep: 1, proposedStep: 1, blocked: { action: 'STEP_UP', reason: 'BELOW_TARGET' } })]) {
      expect(energyOutcomeForDecision({ baseRawEnergy: 2000, step: 1 }, d)).toMatchObject({ kind: 'KEEP', action: d.action, reason: d.reason, step: 1, calibratedEnergy: 2100 });
    }
  });
  it('STEP_DOWN válido se adopta desde la base y el paso absoluto', () => {
    expect(energyOutcomeForDecision({ baseRawEnergy: 2000, step: 0 }, decision({ action: 'STEP_DOWN', reason: 'VERY_SLOW', currentStep: 0, proposedStep: -1 })))
      .toEqual({ kind: 'ADOPT', action: 'STEP_DOWN', reason: 'VERY_SLOW', previousStep: 0, step: -1, rawCalibratedEnergy: 1900, calibratedEnergy: 1900 });
  });
  it('si la decisión no cuadra con la posición, no se adopta nada', () => {
    expect(energyOutcomeForDecision({ baseRawEnergy: 2000, step: 1 }, decision({ action: 'STEP_UP', currentStep: 0, proposedStep: 1 }))).toEqual({ kind: 'UNVERIFIABLE', reason: 'STEP_MISMATCH' });
    expect(energyOutcomeForDecision({ baseRawEnergy: 2000, step: 0 }, decision({ action: 'STEP_UP', currentStep: 0, proposedStep: 2 }))).toEqual({ kind: 'UNVERIFIABLE', reason: 'DECISION_INCOHERENT' });
    expect(energyOutcomeForDecision({ baseRawEnergy: 2000, step: 0 }, decision({ action: 'MAINTAIN', currentStep: 0, proposedStep: 1 }))).toEqual({ kind: 'UNVERIFIABLE', reason: 'DECISION_INCOHERENT' });
    expect(energyOutcomeForDecision({ baseRawEnergy: 2000, step: 3 }, decision({ currentStep: 3, proposedStep: 3 }))).toEqual({ kind: 'UNVERIFIABLE', reason: 'POSITION_INVALID' });
  });
});

describe('M · ADOPCIÓN solo con evidencia verificable (autoridad de energía efectiva)', () => {
  it('todo verificado (paso 0, cadena vacía coherente) → se adopta la base congelada', () => {
    expect(adopt(CAL({ baseEnergyRaw: 2000 }))).toMatchObject({ source: 'CALIBRATED', status: 'ADOPTED', effective: { rawEnergy: 2000, energy: 2000 } });
  });
  it('sin calibración → CAPA 1', () => expect(adopt(null)).toMatchObject({ source: 'BASE', status: 'NO_CALIBRATION' }));
  it.each([
    ['calibración cerrada', CAL({ status: 'CLOSED', baseEnergyRaw: 2000 }), 'Bajar grasa', 'CALIBRATION_CLOSED'],
    ['versión de calibración no soportada', CAL({ calibrationVersion: 1, baseEnergyRaw: 2000 }), 'Bajar grasa', 'UNSUPPORTED_CALIBRATION_VERSION'],
    ['sin base cruda registrada', CAL({ baseEnergyRaw: null }), 'Bajar grasa', 'BASE_NOT_FROZEN'],
    ['objetivo del perfil cambió', CAL({ baseEnergyRaw: 2000 }), 'Bienestar integral', 'OBJECTIVE_CHANGED'],
    ['base inválida (no positiva: el mapeo de filas ya la descarta)', CAL({ baseEnergyRaw: -5 }), 'Bajar grasa', 'INVALID_BASE'],
    ['paso decidido sin la cadena que lo justifique', CAL({ currentStep: -1, baseEnergyRaw: 2000 }), 'Bajar grasa', 'CURRENT_STEP_MISMATCH'],
  ] as const)('%s → no se adopta (%s)', (_l, cal, goal, reason) => {
    expect(adopt(cal, goal)).toMatchObject({ source: 'BASE', status: 'NOT_ADOPTED', notAdoptedReason: reason });
  });
  it('el entero base_energy_kcal NO se usa como base: sin base cruda no hay adopción', () => {
    expect(adopt(CAL({ baseEnergyKcal: 2000, baseEnergyRaw: null }))).toMatchObject({ source: 'BASE', notAdoptedReason: 'BASE_NOT_FROZEN' });
  });
});

describe('L · MACROS · mismas fórmulas y versión; solo cambiaría la entrada de energía', () => {
  it('prescribeMacros con la energía calibrada usa la misma versión y la misma regla de grasa 25 %', () => {
    const inp = { goal: 'FAT_LOSS' as const, weightKg: 82, heightCm: 178, activityClass: 'STRENGTH' as const, trainingBand: TRAINING_BANDS[0] };
    const base = prescribeMacros({ ...inp, energyKcal: 2000 });
    const cal = prescribeMacros({ ...inp, energyKcal: ok(2000, -1).calibratedEnergy });
    expect(cal.version).toBe(MACRO_PRESCRIPTION_VERSION);
    expect(cal.energyKcal).toBe(1900);
    if ('fatG' in base && 'fatG' in cal) expect(cal.fatG).toBe(Math.round((1900 * 0.25) / 9));
    if ('proteinG' in base && 'proteinG' in cal) expect(cal.proteinG).toBe(base.proteinG);   // la proteína depende del peso, no de la energía
  });
  it('sin energía efectiva distinta, la resolución de macros usa la energía de CAPA 1 (comportamiento de siempre)', () => {
    const ob = { sex: 'Hombre', goal: 'Bajar grasa', edad: 35, estatura: 178, peso: 82, embarazo: 0, requiresTherapeuticDiet: 0, dailyLife: 'DL2', trainsHabitually: 1, trainingDaysPerWeek: 5, trainingSessionMinutes: 60, trainingModalities: 'strength' };
    const s = resolveNutritionEnergyState(ob as never);
    const r = resolveMacroPrescription(s, ob as never);
    expect(r.kind === 'RESOLVED' && r.prescription.energyKcal).toBe(s.prescribedEnergy);
  });
});

describe('N · SERVIDOR · el cliente no puede declarar base, paso ni kcal calibradas', () => {
  it('los únicos campos aceptados por la Edge Function no incluyen nada de energía ni de paso', () => {
    // `energy` del check-in es la ENERGÍA PERCIBIDA (respuesta subjetiva), no kcal: se permite.
    const prohibidos = ['baseEnergyKcal', 'baseEnergy', 'base_energy_kcal', 'frozenBaseRawEnergy', 'step', 'currentStep', 'proposedStep',
      'current_step', 'calibratedEnergy', 'calibratedKcal', 'kcal', 'energyKcal', 'prescribedEnergy', 'rawPrescribedEnergy'];
    for (const f of [...START_REQUEST_FIELDS, ...CHECKIN_REQUEST_FIELDS]) expect(prohibidos, f).not.toContain(f);
    for (const f of [...START_REQUEST_FIELDS, ...CHECKIN_REQUEST_FIELDS]) expect(f, f).not.toMatch(/kcal|step|calibrat|base/i);
    expect([...START_REQUEST_FIELDS]).toEqual(['requestId', 'localDate', 'weightKg', 'waistCm']);
  });
  it('la capa vive en el motor compartido del servidor (mismas reglas en Edge y cliente)', () => {
    expect(ENTRY_SRC).toMatch(/export \* from '\.\/adaptiveCalibrationEnergy';/);
  });
});

describe('O / P · SIN EFECTO hoy en perfiles ni en el plan', () => {
  it('O · sin calibración / sin base congelada → no se adopta; la energía sigue siendo la de CAPA 1', () => {
    expect(adopt(null).source).toBe('BASE');
    expect(adopt(CAL()).source).toBe('BASE');   // CAL() no trae base cruda
  });
  it('la capa la consumen el planificador del servidor y la autoridad de energía efectiva (compartida), nadie más', () => {
    const files = import.meta.glob('../../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const users = Object.entries(files)
      .filter(([p]) => !p.includes('__tests__') && !/\.(test|spec)\.tsx?$/.test(p) && !p.endsWith('adaptiveCalibrationEnergy.ts') && !p.endsWith('nutritionEngineEntry.ts'))
      .filter(([, src]) => /adaptiveCalibrationEnergy|energyOutcomeForDecision/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')))
      .map(([p]) => p);
    expect(users).toEqual(['../adaptiveCheckinPlanner.ts', '../adaptiveEnergyAuthority.ts']);
    // BLOQUE 9 · `resolveCalibratedEnergy` (adoptaba el paso decidido) ya no existe en ningún módulo
    const sinComentarios = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(Object.keys(files).filter((p) => /resolveCalibratedEnergy|CalibrationEnergyEvidence/.test(sinComentarios(files[p])) && !p.includes('__tests__') && !/\.(test|spec)\.tsx?$/.test(p))).toEqual([]);
  });
  it('versiones intactas (sin bump automático; PLAN_ENGINE 35 lo subió MENÚ V1 · CAPA 4, no Adaptive)', () => {
    expect([ENERGY_PRESCRIPTION_VERSION, MACRO_PRESCRIPTION_VERSION, PLAN_ENGINE_VERSION, ENERGY_CALIBRATION_VERSION, CALIBRATION_ENERGY_VERSION]).toEqual([2, 4, 35, 2, 1]);
  });
  it('P · Weekly Preferences Split intacto', () => {
    expect(avoidPolicy(['huevo'], ['huevo', 'lacteos'])).toEqual({ strict: ['huevo'], soft: ['lacteos'] });
  });
});
