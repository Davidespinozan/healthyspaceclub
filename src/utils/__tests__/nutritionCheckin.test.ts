import { describe, it, expect } from 'vitest';
import CODE from '../nutritionCheckin.ts?raw';
import {
  validateNutritionCheckin,
  adherenceBandOf,
  ADHERENCE_ANSWERS,
  ADHERENCE_ANSWER_BAND,
  ADHERENCE_ANSWER_COPY_RANGE_PCT,
  NUTRITION_HUNGER_VALUES,
  NUTRITION_ENERGY_VALUES,
  NUTRITION_PERFORMANCE_VALUES,
  STRENGTH_EXPERIENCE_VALUES,
  RECENT_STRENGTH_CONTINUITY_VALUES,
  type NutritionCheckinInput,
  type NutritionCheckinValidation,
} from '../nutritionCheckin';
import { MUSCLE_GAIN_EXPERIENCE_LEVELS } from '../nutritionTrajectory';

// ─────────────────────────────────────────────────────────────────────────────
// Adaptive Nutrition · Microbloque 2 · tipos de dominio del check-in (puro)
// ─────────────────────────────────────────────────────────────────────────────

const BASE: NutritionCheckinInput = {
  objective: 'FAT_LOSS', weightKg: 70, adherenceAnswer: 'MOST_DAYS',
  hunger: 'NORMAL', energy: 'NORMAL', performance: 'SAME', checkinDate: '2026-10-18',
};
const v = (over: Partial<NutritionCheckinInput> = {}) => validateNutritionCheckin({ ...BASE, ...over });
function valid(r: NutritionCheckinValidation) {
  if (r.status !== 'VALID') throw new Error(`no VALID: ${JSON.stringify(r)}`);
  return r.checkin;
}

describe('ADHERENCIA · declarada, respuesta + banda, sin % puntual', () => {
  it('cinco códigos estables', () => {
    expect(ADHERENCE_ANSWERS).toEqual(['PRACTICALLY_ALL', 'ALMOST_ALWAYS', 'MOST_DAYS', 'SOMETIMES', 'VERY_LITTLE']);
  });
  it.each([
    ['PRACTICALLY_ALL', 'HIGH'], ['ALMOST_ALWAYS', 'HIGH'], ['MOST_DAYS', 'MEDIUM'], ['SOMETIMES', 'LOW'], ['VERY_LITTLE', 'LOW'],
  ])('%s → %s', (answer, band) => {
    expect(adherenceBandOf(answer)).toBe(band);
    expect(valid(v({ adherenceAnswer: answer })).adherence).toEqual({ answer, band });
  });
  it('cada rango del copy cae entero en su banda (HIGH ≥ 80 · MEDIUM 60–79 · LOW < 60) y no hay huecos ni solapes', () => {
    const bandOfPct = (p: number) => (p >= 80 ? 'HIGH' : p >= 60 ? 'MEDIUM' : 'LOW');
    for (const a of ADHERENCE_ANSWERS) {
      const { min, max } = ADHERENCE_ANSWER_COPY_RANGE_PCT[a];
      expect(bandOfPct(min), a).toBe(ADHERENCE_ANSWER_BAND[a]);
      expect(bandOfPct(max ?? 100), a).toBe(ADHERENCE_ANSWER_BAND[a]);
    }
    const sorted = ADHERENCE_ANSWERS.map((a) => ADHERENCE_ANSWER_COPY_RANGE_PCT[a]).sort((x, y) => x.min - y.min);
    expect(sorted[0].min).toBe(0);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i].min).toBe((sorted[i - 1].max as number) + 1);
    expect(sorted[sorted.length - 1].max).toBeNull();
  });
  it('el check-in guarda respuesta y banda, nunca un porcentaje', () => {
    const c = valid(v({ adherenceAnswer: 'MOST_DAYS' }));
    expect(Object.keys(c.adherence).sort()).toEqual(['answer', 'band']);
    expect(JSON.stringify(c.adherence)).not.toMatch(/\d|percent|pct/i);
    expect(Object.keys(c).filter((k) => /percent|pct/i.test(k))).toEqual([]);
  });
  it('valor desconocido → INVALID; banda null', () => {
    for (const bad of ['la mayoría', 'most_days', 'HIGH', 72, '']) {
      expect(adherenceBandOf(bad)).toBeNull();
      expect(v({ adherenceAnswer: bad })).toEqual({ status: 'INVALID', invalid: ['adherenceAnswer'] });
    }
  });
});

describe('HAMBRE / ENERGÍA / RENDIMIENTO · enums propios de Nutrición', () => {
  it.each(NUTRITION_HUNGER_VALUES.map((x) => [x]))('hambre %s válida', (h) => expect(valid(v({ hunger: h })).hunger).toBe(h));
  it('hambre: LOW / NORMAL / HIGH; inválida', () => {
    expect(NUTRITION_HUNGER_VALUES).toEqual(['LOW', 'NORMAL', 'HIGH']);
    expect(v({ hunger: 'MUCHA' })).toEqual({ status: 'INVALID', invalid: ['hunger'] });
  });
  it.each(NUTRITION_ENERGY_VALUES.map((x) => [x]))('energía %s válida', (e) => expect(valid(v({ energy: e })).energy).toBe(e));
  it('energía: LOW / NORMAL / GOOD; inválida (incluida la escala numérica de Training)', () => {
    expect(NUTRITION_ENERGY_VALUES).toEqual(['LOW', 'NORMAL', 'GOOD']);
    for (const bad of ['HIGH', 3, 'low']) expect(v({ energy: bad })).toEqual({ status: 'INVALID', invalid: ['energy'] });
  });
  it.each(NUTRITION_PERFORMANCE_VALUES.map((x) => [x]))('rendimiento %s válido', (p) => expect(valid(v({ performance: p })).performance).toBe(p));
  it('rendimiento: WORSE / SAME / BETTER / NOT_APPLICABLE; inválido', () => {
    expect(NUTRITION_PERFORMANCE_VALUES).toEqual(['WORSE', 'SAME', 'BETTER', 'NOT_APPLICABLE']);
    expect(v({ performance: 'PEOR' })).toEqual({ status: 'INVALID', invalid: ['performance'] });
  });
  it('rendimiento siempre requerido como respuesta → ausente = INCOMPLETE', () => {
    expect(v({ performance: undefined })).toEqual({ status: 'INCOMPLETE', missing: ['performance'] });
  });
  it('NOT_APPLICABLE vale para cualquier objetivo, con o sin fuerza', () => {
    for (const objective of ['FAT_LOSS', 'MAINTENANCE', 'RECOMPOSITION', 'MUSCLE_GAIN']) {
      const r = v({ objective, performance: 'NOT_APPLICABLE', waistCm: 85, strengthExperience: 'BEGINNER', trainsStrength: true });
      expect(r.status, objective).toBe('VALID');
    }
  });
  it('hambre y energía son requeridas', () => {
    expect(v({ hunger: null, energy: undefined })).toEqual({ status: 'INCOMPLETE', missing: ['hunger', 'energy'] });
  });
});

describe('EXPERIENCIA ≠ CONTINUIDAD', () => {
  it('experiencia: BEGINNER / INTERMEDIATE / ADVANCED, mismos códigos que la trayectoria', () => {
    expect(STRENGTH_EXPERIENCE_VALUES).toEqual(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']);
    expect(STRENGTH_EXPERIENCE_VALUES).toBe(MUSCLE_GAIN_EXPERIENCE_LEVELS);
    for (const e of STRENGTH_EXPERIENCE_VALUES) expect(valid(v({ objective: 'MUSCLE_GAIN', strengthExperience: e })).strengthExperience).toBe(e);
  });
  it('experiencia inválida (etiquetas legacy de Training incluidas) → INVALID', () => {
    for (const bad of ['principiante', 'intermedio', 'beginner', 2]) {
      expect(v({ objective: 'MUSCLE_GAIN', strengthExperience: bad })).toEqual({ status: 'INVALID', invalid: ['strengthExperience'] });
    }
  });
  it('continuidad: YES / NO; inválida', () => {
    expect(RECENT_STRENGTH_CONTINUITY_VALUES).toEqual(['YES', 'NO']);
    for (const c of ['YES', 'NO']) expect(valid(v({ recentStrengthContinuity: c })).recentStrengthContinuity).toBe(c);
    for (const bad of [true, 'SI', 'yes', 1]) expect(v({ recentStrengthContinuity: bad })).toEqual({ status: 'INVALID', invalid: ['recentStrengthContinuity'] });
  });
  it('la continuidad no cambia la experiencia (ni la baja de nivel)', () => {
    for (const e of STRENGTH_EXPERIENCE_VALUES) for (const c of ['YES', 'NO']) {
      const k = valid(v({ objective: 'MUSCLE_GAIN', strengthExperience: e, recentStrengthContinuity: c }));
      expect(k.strengthExperience).toBe(e);
      expect(k.recentStrengthContinuity).toBe(c);
    }
  });
  it('la continuidad es opcional y no sustituye a la experiencia', () => {
    expect(valid(v()).recentStrengthContinuity).toBeNull();
    expect(v({ objective: 'MUSCLE_GAIN', recentStrengthContinuity: 'YES' })).toEqual({ status: 'INCOMPLETE', missing: ['strengthExperience'] });
  });
});

describe('OBJETIVOS · requisitos de cintura y experiencia', () => {
  it('fat loss sin cintura = VALID', () => expect(valid(v({ objective: 'FAT_LOSS' })).waistCm).toBeNull());
  it('maintenance sin cintura = VALID', () => expect(v({ objective: 'MAINTENANCE' }).status).toBe('VALID'));
  it('muscle gain sin cintura = VALID (con experiencia)', () => expect(v({ objective: 'MUSCLE_GAIN', strengthExperience: 'INTERMEDIATE' }).status).toBe('VALID'));
  it('recomp sin cintura = INCOMPLETE', () => expect(v({ objective: 'RECOMPOSITION' })).toEqual({ status: 'INCOMPLETE', missing: ['waistCm'] }));
  it('recomp con cintura = VALID', () => expect(valid(v({ objective: 'RECOMPOSITION', waistCm: 84.5 })).waistCm).toBe(84.5));
  it('muscle gain sin experiencia = INCOMPLETE', () => expect(v({ objective: 'MUSCLE_GAIN' })).toEqual({ status: 'INCOMPLETE', missing: ['strengthExperience'] }));
  it('la experiencia es opcional fuera de MUSCLE_GAIN, pero si viene se valida', () => {
    expect(valid(v({ objective: 'FAT_LOSS', strengthExperience: 'ADVANCED' })).strengthExperience).toBe('ADVANCED');
    expect(v({ objective: 'FAT_LOSS', strengthExperience: 'x' })).toEqual({ status: 'INVALID', invalid: ['strengthExperience'] });
  });
  it('cintura ≤ 0 o no numérica → INVALID en cualquier objetivo', () => {
    for (const objective of ['FAT_LOSS', 'RECOMPOSITION']) for (const bad of [0, -80, NaN, '85']) {
      expect(v({ objective, waistCm: bad }), `${objective} ${String(bad)}`).toEqual({ status: 'INVALID', invalid: ['waistCm'] });
    }
  });
  it('trainsStrength: booleano opcional ya resuelto; otro tipo → INVALID', () => {
    expect(valid(v()).trainsStrength).toBeNull();
    expect(valid(v({ trainsStrength: false })).trainsStrength).toBe(false);
    for (const bad of ['MIXED', 'strength', 1]) expect(v({ trainsStrength: bad })).toEqual({ status: 'INVALID', invalid: ['trainsStrength'] });
  });
});

describe('GENERAL', () => {
  it('check-in completo y tipado', () => {
    expect(validateNutritionCheckin({
      objective: 'RECOMPOSITION', weightKg: 82.4, waistCm: 90, adherenceAnswer: 'ALMOST_ALWAYS', hunger: 'HIGH',
      energy: 'LOW', performance: 'WORSE', trainsStrength: true, strengthExperience: 'INTERMEDIATE',
      recentStrengthContinuity: 'NO', checkinDate: '2026-10-18', cycleNumber: 3,
    })).toEqual({
      status: 'VALID',
      checkin: {
        objective: 'RECOMPOSITION', weightKg: 82.4, waistCm: 90, adherence: { answer: 'ALMOST_ALWAYS', band: 'HIGH' },
        hunger: 'HIGH', energy: 'LOW', performance: 'WORSE', trainsStrength: true, strengthExperience: 'INTERMEDIATE',
        recentStrengthContinuity: 'NO', checkinDate: '2026-10-18', cycleNumber: 3,
      },
    });
  });
  it('peso faltante → INCOMPLETE; peso ≤ 0 / NaN / texto → INVALID', () => {
    expect(v({ weightKg: undefined })).toEqual({ status: 'INCOMPLETE', missing: ['weightKg'] });
    for (const bad of [0, -70, NaN, Infinity, '70']) expect(v({ weightKg: bad })).toEqual({ status: 'INVALID', invalid: ['weightKg'] });
  });
  it('fecha inválida → INVALID; ausente → INCOMPLETE', () => {
    for (const bad of ['2026-02-30', '2026/10/18', '18-10-2026', '', 20261018]) expect(v({ checkinDate: bad })).toEqual({ status: 'INVALID', invalid: ['checkinDate'] });
    expect(v({ checkinDate: null })).toEqual({ status: 'INCOMPLETE', missing: ['checkinDate'] });
  });
  it('objetivo inválido → INVALID; ausente → INCOMPLETE', () => {
    for (const bad of ['BULK', 'Bajar grasa', 'fat_loss']) expect(v({ objective: bad })).toEqual({ status: 'INVALID', invalid: ['objective'] });
    expect(v({ objective: undefined })).toEqual({ status: 'INCOMPLETE', missing: ['objective'] });
  });
  it('objetivo inválido: no se exige cintura ni experiencia, pero sí se valida su dominio', () => {
    expect(v({ objective: 'BULK', waistCm: -1 })).toEqual({ status: 'INVALID', invalid: ['objective', 'waistCm'] });
  });
  it('cycleNumber opcional: entero ≥ 1', () => {
    expect(valid(v()).cycleNumber).toBeNull();
    expect(valid(v({ cycleNumber: 1 })).cycleNumber).toBe(1);
    for (const bad of [0, -1, 1.5, '2']) expect(v({ cycleNumber: bad })).toEqual({ status: 'INVALID', invalid: ['cycleNumber'] });
  });
  it('INVALID tiene prioridad sobre INCOMPLETE y nombra todos los campos inválidos', () => {
    expect(v({ objective: 'RECOMPOSITION', hunger: 'X', energy: 'Y', performance: undefined })).toEqual({ status: 'INVALID', invalid: ['hunger', 'energy'] });
  });
  it('INCOMPLETE nombra todos los campos faltantes', () => {
    expect(validateNutritionCheckin({} as NutritionCheckinInput)).toEqual({
      status: 'INCOMPLETE',
      missing: ['objective', 'weightKg', 'adherenceAnswer', 'hunger', 'energy', 'performance', 'checkinDate'],
    });
  });
  it('sin fallback silencioso: no recorta espacios ni cambia mayúsculas', () => {
    expect(v({ hunger: ' HIGH' })).toEqual({ status: 'INVALID', invalid: ['hunger'] });
    expect(v({ objective: 'fat_loss' }).status).toBe('INVALID');
  });
  it('determinista y sin mutar la entrada', () => {
    const input = Object.freeze({ ...BASE });
    expect(validateNutritionCheckin(input)).toEqual(validateNutritionCheckin(input));
  });
});

describe('PUREZA · sin store, DB, UI, Training, energía ni decisión', () => {
  const BODY = CODE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const imports = [...CODE.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
  it('solo importa objetivos canónicos (tipo/lista) y el nivel de la trayectoria', () => {
    expect(imports).toEqual(['./energyPrescription', './nutritionTrajectory']);
    expect(CODE).toMatch(/^import \{ CANONICAL_GOALS, type CanonicalGoal \} from '\.\/energyPrescription';$/m);
    expect(CODE).toMatch(/^import \{ MUSCLE_GAIN_EXPERIENCE_LEVELS, type MuscleGainExperienceLevel \} from '\.\/nutritionTrajectory';$/m);
  });
  it('no toca store, Supabase, React, storage, red, reloj ni Training', () => {
    for (const banned of ['store', 'supabase', 'react', 'localStorage', 'fetch(', 'Date.now', 'new Date()', 'todayCheckin',
      'obData', 'nivel', 'activity', 'mesocycle', 'readiness', 'mealChecks', 'workoutLog', 'completedSessions']) {
      expect(BODY.includes(banned), banned).toBe(false);
    }
  });
  it('no decide kcal, REVIEW ni trayectoria', () => {
    for (const banned of ['kcal', 'REVIEW', 'assessTrajectory', 'prescribeEnergy', 'planGoal', 'deficit']) {
      expect(BODY.includes(banned), banned).toBe(false);
    }
  });
});
