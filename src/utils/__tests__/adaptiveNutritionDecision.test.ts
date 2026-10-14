import { describe, it, expect } from 'vitest';
import CODE from '../adaptiveNutritionDecision.ts?raw';
import {
  decideAdaptiveNutrition,
  classifyWaistChange,
  type AdaptiveDecisionInput,
  type AdaptiveDecisionResult,
  type PreviousCheckinContext,
} from '../adaptiveNutritionDecision';
import { assessTrajectory, type MuscleGainExperienceLevel, type TrajectoryClassification } from '../nutritionTrajectory';
import { validateNutritionCheckin, type NutritionCheckinInput } from '../nutritionCheckin';
import type { CanonicalGoal } from '../energyPrescription';

// ─────────────────────────────────────────────────────────────────────────────
// Adaptive Nutrition · Microbloque 3 · motor puro de decisión (pasos, no kcal).
// Las entradas se construyen con los módulos REALES de MB1 (trayectoria) y MB2
// (check-in): la matriz prueba también el contrato entre los tres.
// ─────────────────────────────────────────────────────────────────────────────

const BASE_WEIGHT: Record<CanonicalGoal, number> = { FAT_LOSS: 70, MUSCLE_GAIN: 75, RECOMPOSITION: 80, MAINTENANCE: 70 };
const DAYS: Record<CanonicalGoal, number> = { FAT_LOSS: 14, MUSCLE_GAIN: 28, RECOMPOSITION: 28, MAINTENANCE: 28 };

interface Case {
  objective: CanonicalGoal;
  /** Peso actual (el anterior es BASE_WEIGHT del objetivo). */
  weight: number;
  days?: number;
  level?: MuscleGainExperienceLevel;
  checkin?: Partial<NutritionCheckinInput>;
  step?: number;
  cycle?: number;
  previous?: PreviousCheckinContext | null;
}

function input(k: Case): AdaptiveDecisionInput {
  const level = k.level ?? (k.objective === 'MUSCLE_GAIN' ? 'BEGINNER' : undefined);
  return {
    objective: k.objective,
    trajectory: assessTrajectory({
      objective: k.objective, previousWeightKg: BASE_WEIGHT[k.objective], currentWeightKg: k.weight,
      elapsed: { elapsedDays: k.days ?? DAYS[k.objective] }, experienceLevel: level,
    }),
    checkin: validateNutritionCheckin({
      objective: k.objective, weightKg: k.weight, adherenceAnswer: 'PRACTICALLY_ALL',
      hunger: 'NORMAL', energy: 'NORMAL', performance: 'SAME', checkinDate: '2026-10-18',
      strengthExperience: level, waistCm: k.objective === 'RECOMPOSITION' ? 90 : undefined,
      ...k.checkin,
    }),
    currentStep: k.step ?? 0,
    cycleIndex: k.cycle ?? 2,
    previous: k.previous === undefined ? null : k.previous,
  };
}
const decide = (k: Case) => decideAdaptiveNutrition(input(k));
function d(r: AdaptiveDecisionResult) {
  if (r.status !== 'DECIDED') throw new Error(`no DECIDED: ${JSON.stringify(r)}`);
  return r.decision;
}
const act = (k: Case) => { const x = d(decide(k)); return [x.action, x.reason]; };

/** Clasificación real de una lectura previa (para reglas de dos lecturas). */
function clsOf(objective: CanonicalGoal, weight: number): TrajectoryClassification {
  const r = assessTrajectory({ objective, previousWeightKg: BASE_WEIGHT[objective], currentWeightKg: weight, elapsed: { elapsedDays: DAYS[objective] }, experienceLevel: 'BEGINNER' });
  if (r.status !== 'ASSESSED' || r.sufficiency !== 'SUFFICIENT_FOR_DECISION') throw new Error('previa no evaluable');
  return r.classification;
}
const prev = (over: Partial<PreviousCheckinContext> = {}): PreviousCheckinContext => ({
  action: 'MAINTAIN', classification: null, hunger: 'NORMAL', energy: 'NORMAL', performance: 'SAME', waistCm: null, ...over,
});

// Pesos de referencia (ver matriz de MB1)
const FL = { VERY_SLOW: 69.8, BORDERLINE: 69.65, ON: 69.3, FAST: 68.4 };
const MG = { BELOW: 75.3, ON: 75.6, ABOVE: 75.9 }; // BEGINNER, 28 días
const RC = { STABLE: 80, DOWN: 79, UP: 81 }; // 28 días → ±1.09 kg/mes
const MT = { WITHIN: 70.5, BELOW: 69, ABOVE: 71 };
const SYMPTOMS: Partial<NutritionCheckinInput>[] = [{ hunger: 'HIGH' }, { energy: 'LOW' }, { performance: 'WORSE' }];

describe('PÉRDIDA DE GRASA', () => {
  it('VERY_SLOW + HIGH → STEP_DOWN', () => {
    expect(d(decide({ objective: 'FAT_LOSS', weight: FL.VERY_SLOW }))).toMatchObject({ action: 'STEP_DOWN', reason: 'VERY_SLOW', currentStep: 0, proposedStep: -1 });
  });
  it.each(SYMPTOMS)('VERY_SLOW + HIGH + síntoma %o → REVIEW', (s) => {
    expect(act({ objective: 'FAT_LOSS', weight: FL.VERY_SLOW, checkin: s })).toEqual(['REVIEW', 'CONTRADICTORY_SIGNALS']);
  });
  it('VERY_SLOW + MEDIUM / LOW → NO_ADJUSTMENT', () => {
    for (const a of ['MOST_DAYS', 'SOMETIMES', 'VERY_LITTLE']) {
      expect(act({ objective: 'FAT_LOSS', weight: FL.VERY_SLOW, checkin: { adherenceAnswer: a } })).toEqual(['NO_ADJUSTMENT', 'ADHERENCE_NOT_HIGH']);
    }
  });
  it('BORDERLINE primera lectura → MAINTAIN, sin ajuste', () => {
    expect(d(decide({ objective: 'FAT_LOSS', weight: FL.BORDERLINE }))).toMatchObject({ action: 'MAINTAIN', reason: 'BORDERLINE_SLOW_FIRST', proposedStep: 0 });
  });
  it.each(SYMPTOMS)('BORDERLINE primera lectura + síntoma %o → REVIEW sin esperar segunda', (s) => {
    expect(act({ objective: 'FAT_LOSS', weight: FL.BORDERLINE, checkin: s })).toEqual(['REVIEW', 'CONTRADICTORY_SIGNALS']);
  });
  it('BORDERLINE segunda lectura consecutiva → STEP_DOWN', () => {
    const previous = prev({ classification: clsOf('FAT_LOSS', FL.BORDERLINE), action: 'MAINTAIN' });
    expect(act({ objective: 'FAT_LOSS', weight: FL.BORDERLINE, previous })).toEqual(['STEP_DOWN', 'BORDERLINE_SLOW_CONFIRMED']);
  });
  it('BORDERLINE segunda lectura con síntoma en la ACTUAL o en la PREVIA → REVIEW', () => {
    const c = clsOf('FAT_LOSS', FL.BORDERLINE);
    expect(act({ objective: 'FAT_LOSS', weight: FL.BORDERLINE, checkin: { energy: 'LOW' }, previous: prev({ classification: c }) })).toEqual(['REVIEW', 'CONTRADICTORY_SIGNALS']);
    expect(act({ objective: 'FAT_LOSS', weight: FL.BORDERLINE, previous: prev({ classification: c, action: 'REVIEW', hunger: 'HIGH' }) })).toEqual(['REVIEW', 'CONTRADICTORY_SIGNALS']);
  });
  it('BORDERLINE tras un STEP_DOWN aplicado: el conteo se reinicia → primera lectura otra vez', () => {
    const previous = prev({ classification: clsOf('FAT_LOSS', FL.BORDERLINE), action: 'STEP_DOWN' });
    expect(act({ objective: 'FAT_LOSS', weight: FL.BORDERLINE, step: -1, previous })).toEqual(['MAINTAIN', 'BORDERLINE_SLOW_FIRST']);
  });
  it('una lectura previa de otro tipo no hace consecutiva a la actual', () => {
    const previous = prev({ classification: clsOf('FAT_LOSS', FL.ON) });
    expect(act({ objective: 'FAT_LOSS', weight: FL.BORDERLINE, previous })).toEqual(['MAINTAIN', 'BORDERLINE_SLOW_FIRST']);
  });
  it('ON_TARGET → MAINTAIN', () => expect(act({ objective: 'FAT_LOSS', weight: FL.ON })).toEqual(['MAINTAIN', 'ON_TARGET']));
  it.each(SYMPTOMS)('ON_TARGET + síntoma %o → STEP_UP', (s) => {
    expect(d(decide({ objective: 'FAT_LOSS', weight: FL.ON, checkin: s }))).toMatchObject({ action: 'STEP_UP', reason: 'DEFICIT_SYMPTOMS', proposedStep: 1 });
  });
  it('FAST primera lectura sin síntomas → MAINTAIN', () => expect(act({ objective: 'FAT_LOSS', weight: FL.FAST })).toEqual(['MAINTAIN', 'FAST_FIRST']));
  it.each(SYMPTOMS)('FAST primera lectura + síntoma %o → STEP_UP inmediato', (s) => {
    expect(act({ objective: 'FAT_LOSS', weight: FL.FAST, checkin: s })).toEqual(['STEP_UP', 'FAST_WITH_SYMPTOMS']);
  });
  it('FAST segunda lectura consecutiva → STEP_UP aunque no haya síntomas', () => {
    expect(act({ objective: 'FAT_LOSS', weight: FL.FAST, previous: prev({ classification: clsOf('FAT_LOSS', FL.FAST) }) })).toEqual(['STEP_UP', 'FAST_CONFIRMED']);
  });
  it('FAST tras un STEP_UP aplicado: el conteo se reinicia → primera lectura', () => {
    const previous = prev({ classification: clsOf('FAT_LOSS', FL.FAST), action: 'STEP_UP' });
    expect(act({ objective: 'FAT_LOSS', weight: FL.FAST, step: 1, previous })).toEqual(['MAINTAIN', 'FAST_FIRST']);
  });
});

describe('GANANCIA MUSCULAR', () => {
  it('BELOW + BETTER → MAINTAIN', () => expect(act({ objective: 'MUSCLE_GAIN', weight: MG.BELOW, checkin: { performance: 'BETTER' } })).toEqual(['MAINTAIN', 'PERFORMANCE_IMPROVING']));
  it('BELOW + SAME → STEP_UP', () => expect(act({ objective: 'MUSCLE_GAIN', weight: MG.BELOW })).toEqual(['STEP_UP', 'BELOW_TARGET']));
  it('BELOW + WORSE → STEP_UP', () => expect(act({ objective: 'MUSCLE_GAIN', weight: MG.BELOW, checkin: { performance: 'WORSE' } })).toEqual(['STEP_UP', 'BELOW_TARGET']));
  it('BELOW + N/A → REVIEW', () => expect(act({ objective: 'MUSCLE_GAIN', weight: MG.BELOW, checkin: { performance: 'NOT_APPLICABLE' } })).toEqual(['REVIEW', 'NO_TRAINING_SIGNAL']));
  it('ON + SAME / BETTER → MAINTAIN', () => {
    for (const p of ['SAME', 'BETTER']) expect(act({ objective: 'MUSCLE_GAIN', weight: MG.ON, checkin: { performance: p } })).toEqual(['MAINTAIN', 'ON_TARGET']);
  });
  it('ON + WORSE → REVIEW', () => expect(act({ objective: 'MUSCLE_GAIN', weight: MG.ON, checkin: { performance: 'WORSE' } })).toEqual(['REVIEW', 'PERFORMANCE_WORSE']));
  it('ON + N/A → REVIEW', () => expect(act({ objective: 'MUSCLE_GAIN', weight: MG.ON, checkin: { performance: 'NOT_APPLICABLE' } })).toEqual(['REVIEW', 'NO_TRAINING_SIGNAL']));
  it('ON + cintura HIGHER (> 0.5 cm) → REVIEW, nunca STEP_DOWN', () => {
    expect(act({ objective: 'MUSCLE_GAIN', weight: MG.ON, checkin: { waistCm: 86 }, previous: prev({ waistCm: 85 }) })).toEqual(['REVIEW', 'WAIST_WORSENING']);
  });
  it('ON + cintura SAME (≤ 0.5 cm, frontera) / LOWER → MAINTAIN', () => {
    for (const w of [85.5, 84.5, 84]) expect(act({ objective: 'MUSCLE_GAIN', weight: MG.ON, checkin: { waistCm: w }, previous: prev({ waistCm: 85 }) }), String(w)).toEqual(['MAINTAIN', 'ON_TARGET']);
  });
  it('ON sin dos medidas de cintura → se decide sin cintura (MAINTAIN)', () => {
    expect(act({ objective: 'MUSCLE_GAIN', weight: MG.ON, checkin: { waistCm: 90 } })).toEqual(['MAINTAIN', 'ON_TARGET']);
    expect(act({ objective: 'MUSCLE_GAIN', weight: MG.ON, previous: prev({ waistCm: 85 }) })).toEqual(['MAINTAIN', 'ON_TARGET']);
  });
  it('ABOVE → STEP_DOWN, con cualquier rendimiento (incluido N/A) y cintura', () => {
    for (const p of ['SAME', 'BETTER', 'WORSE', 'NOT_APPLICABLE']) {
      expect(act({ objective: 'MUSCLE_GAIN', weight: MG.ABOVE, checkin: { performance: p, waistCm: 84 }, previous: prev({ waistCm: 85 }) }), p).toEqual(['STEP_DOWN', 'ABOVE_TARGET']);
    }
  });
  it('continuidad YES ↔ NO no cambia la decisión, en ningún caso', () => {
    for (const weight of Object.values(MG)) for (const p of ['SAME', 'BETTER', 'WORSE', 'NOT_APPLICABLE']) for (const level of ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const) {
      const [yes, no, none] = (['YES', 'NO', undefined] as const).map((rc) =>
        decide({ objective: 'MUSCLE_GAIN', weight, level, checkin: { performance: p, recentStrengthContinuity: rc } }));
      expect(yes, `${weight} ${p} ${level}`).toEqual(no);
      expect(yes).toEqual(none);
    }
  });
  it('ventana insuficiente → NO_ADJUSTMENT', () => {
    expect(act({ objective: 'MUSCLE_GAIN', weight: MG.ABOVE, days: 21 })).toEqual(['NO_ADJUSTMENT', 'INSUFFICIENT_WINDOW']);
  });
});

describe('RECOMPOSICIÓN · cintura actual vs previa (±0.5 cm = SAME)', () => {
  const rc = (weight: number, waist: number, performance = 'SAME', prevWaist: number | null = 90) =>
    act({ objective: 'RECOMPOSITION', weight, checkin: { waistCm: waist, performance }, previous: prev({ waistCm: prevWaist }) });

  it('stable + waist down + SAME → MAINTAIN', () => expect(rc(RC.STABLE, 89)).toEqual(['MAINTAIN', 'WAIST_IMPROVING']));
  it('stable + waist down + BETTER → MAINTAIN', () => expect(rc(RC.STABLE, 89, 'BETTER')).toEqual(['MAINTAIN', 'WAIST_IMPROVING']));
  it('stable + waist same + BETTER → MAINTAIN', () => expect(rc(RC.STABLE, 90.3, 'BETTER')).toEqual(['MAINTAIN', 'PERFORMANCE_IMPROVING']));
  it('stable + waist same + SAME → REVIEW', () => expect(rc(RC.STABLE, 90)).toEqual(['REVIEW', 'NO_CLEAR_PROGRESS']));
  it('stable + waist up + SAME → STEP_DOWN', () => expect(rc(RC.STABLE, 91)).toEqual(['STEP_DOWN', 'WAIST_WORSENING']));
  it('stable + waist up + WORSE → REVIEW (la caída de rendimiento impide recortar)', () => expect(rc(RC.STABLE, 91, 'WORSE')).toEqual(['REVIEW', 'PERFORMANCE_WORSE']));
  it('stable + WORSE con cualquier cintura → REVIEW', () => {
    for (const w of [89, 90, 91]) expect(rc(RC.STABLE, w, 'WORSE')).toEqual(['REVIEW', 'PERFORMANCE_WORSE']);
  });
  it('stable + waist up + BETTER (no definido) → REVIEW', () => expect(rc(RC.STABLE, 91, 'BETTER')).toEqual(['REVIEW', 'CONTRADICTORY_SIGNALS']));
  it('down + WORSE → STEP_UP', () => expect(rc(RC.DOWN, 89, 'WORSE')).toEqual(['STEP_UP', 'PERFORMANCE_WORSE']));
  it('down + waist down + SAME / BETTER → MAINTAIN', () => {
    expect(rc(RC.DOWN, 89)).toEqual(['MAINTAIN', 'WAIST_IMPROVING']);
    expect(rc(RC.DOWN, 89, 'BETTER')).toEqual(['MAINTAIN', 'WAIST_IMPROVING']);
  });
  it('down + waist same / up (no definido) → REVIEW', () => {
    expect(rc(RC.DOWN, 90)).toEqual(['REVIEW', 'CONTRADICTORY_SIGNALS']);
    expect(rc(RC.DOWN, 91, 'BETTER')).toEqual(['REVIEW', 'CONTRADICTORY_SIGNALS']);
  });
  it('up + waist up → STEP_DOWN', () => expect(rc(RC.UP, 91)).toEqual(['STEP_DOWN', 'WAIST_WORSENING']));
  it('up + waist up + WORSE → REVIEW (misma prioridad del rendimiento)', () => expect(rc(RC.UP, 91, 'WORSE')).toEqual(['REVIEW', 'PERFORMANCE_WORSE']));
  it('up + waist same / down + BETTER → MAINTAIN', () => {
    expect(rc(RC.UP, 90, 'BETTER')).toEqual(['MAINTAIN', 'PERFORMANCE_IMPROVING']);
    expect(rc(RC.UP, 89, 'BETTER')).toEqual(['MAINTAIN', 'PERFORMANCE_IMPROVING']);
  });
  it('up + waist same + SAME (faltan señales) → REVIEW', () => expect(rc(RC.UP, 90)).toEqual(['REVIEW', 'CONTRADICTORY_SIGNALS']));
  it('performance N/A → REVIEW', () => {
    for (const w of Object.values(RC)) expect(rc(w, 89, 'NOT_APPLICABLE')).toEqual(['REVIEW', 'NO_TRAINING_SIGNAL']);
  });
  it('sin cintura previa (sin contexto o sin medida) → NO_ADJUSTMENT', () => {
    expect(act({ objective: 'RECOMPOSITION', weight: RC.DOWN, checkin: { waistCm: 89 } })).toEqual(['NO_ADJUSTMENT', 'INSUFFICIENT_DATA']);
    expect(rc(RC.DOWN, 89, 'SAME', null)).toEqual(['NO_ADJUSTMENT', 'INSUFFICIENT_DATA']);
  });
  it('ventana insuficiente → NO_ADJUSTMENT', () => {
    expect(act({ objective: 'RECOMPOSITION', weight: RC.UP, days: 14, checkin: { waistCm: 91 }, previous: prev({ waistCm: 90 }) })).toEqual(['NO_ADJUSTMENT', 'INSUFFICIENT_WINDOW']);
  });
});

describe('MANTENIMIENTO', () => {
  it('within → MAINTAIN', () => expect(act({ objective: 'MAINTENANCE', weight: MT.WITHIN })).toEqual(['MAINTAIN', 'WITHIN_MAINTENANCE_BAND']));
  it('below → STEP_UP', () => expect(act({ objective: 'MAINTENANCE', weight: MT.BELOW })).toEqual(['STEP_UP', 'BELOW_MAINTENANCE_BAND']));
  it('above → STEP_DOWN', () => expect(act({ objective: 'MAINTENANCE', weight: MT.ABOVE })).toEqual(['STEP_DOWN', 'ABOVE_MAINTENANCE_BAND']));
  it.each(SYMPTOMS)('within + señal %o → REVIEW (los síntomas solos no mueven kcal)', (s) => {
    expect(act({ objective: 'MAINTENANCE', weight: MT.WITHIN, checkin: s })).toEqual(['REVIEW', 'NEGATIVE_SIGNALS']);
  });
});

describe('ANTI-OSCILACIÓN', () => {
  it('paso +2 y se pide STEP_UP → REVIEW (límite)', () => {
    expect(d(decide({ objective: 'MAINTENANCE', weight: MT.BELOW, step: 2 }))).toEqual({
      action: 'REVIEW', reason: 'CALIBRATION_LIMIT_REACHED', objective: 'MAINTENANCE', cycleIndex: 2,
      currentStep: 2, proposedStep: 2, blocked: { action: 'STEP_UP', reason: 'BELOW_MAINTENANCE_BAND' },
    });
  });
  it('paso −2 y se pide STEP_DOWN → REVIEW (límite)', () => {
    expect(d(decide({ objective: 'FAT_LOSS', weight: FL.VERY_SLOW, step: -2 }))).toMatchObject({ action: 'REVIEW', reason: 'CALIBRATION_LIMIT_REACHED', proposedStep: -2 });
  });
  it('dentro del límite: +1 → +2 y −1 → −2 permitidos', () => {
    expect(d(decide({ objective: 'MAINTENANCE', weight: MT.BELOW, step: 1 }))).toMatchObject({ action: 'STEP_UP', proposedStep: 2 });
    expect(d(decide({ objective: 'MAINTENANCE', weight: MT.ABOVE, step: -1 }))).toMatchObject({ action: 'STEP_DOWN', proposedStep: -2 });
  });
  it('STEP_DOWN previo y ahora tocaría STEP_UP → REVIEW', () => {
    expect(d(decide({ objective: 'MAINTENANCE', weight: MT.BELOW, step: -1, previous: prev({ action: 'STEP_DOWN' }) }))).toMatchObject({
      action: 'REVIEW', reason: 'DIRECTION_REVERSAL_BLOCKED', proposedStep: -1, blocked: { action: 'STEP_UP', reason: 'BELOW_MAINTENANCE_BAND' },
    });
  });
  it('STEP_UP previo y ahora tocaría STEP_DOWN → REVIEW', () => {
    expect(act({ objective: 'MAINTENANCE', weight: MT.ABOVE, step: 1, previous: prev({ action: 'STEP_UP' }) })).toEqual(['REVIEW', 'DIRECTION_REVERSAL_BLOCKED']);
  });
  it('MAINTAIN / REVIEW / NO_ADJUSTMENT previos no bloquean una dirección nueva', () => {
    for (const action of ['MAINTAIN', 'REVIEW', 'NO_ADJUSTMENT'] as const) {
      expect(act({ objective: 'MAINTENANCE', weight: MT.BELOW, previous: prev({ action }) }), action).toEqual(['STEP_UP', 'BELOW_MAINTENANCE_BAND']);
    }
  });
  it('mismo sentido que el paso previo no es reversión', () => {
    expect(act({ objective: 'MAINTENANCE', weight: MT.BELOW, step: 1, previous: prev({ action: 'STEP_UP' }) })).toEqual(['STEP_UP', 'BELOW_MAINTENANCE_BAND']);
  });
  it('límite y reversión a la vez → gana CALIBRATION_LIMIT_REACHED', () => {
    expect(act({ objective: 'MAINTENANCE', weight: MT.BELOW, step: 2, previous: prev({ action: 'STEP_DOWN' }) })).toEqual(['REVIEW', 'CALIBRATION_LIMIT_REACHED']);
  });
  it('las acciones que no son paso no pasan por anti-oscilación', () => {
    expect(d(decide({ objective: 'MAINTENANCE', weight: MT.WITHIN, step: 2, previous: prev({ action: 'STEP_DOWN' }) }))).toMatchObject({ action: 'MAINTAIN', blocked: null, proposedStep: 2 });
  });
});

describe('GENERAL · orden, adherencia e inválidos', () => {
  const ok = input({ objective: 'MAINTENANCE', weight: MT.BELOW });
  const inv = (over: Partial<AdaptiveDecisionInput>) => decideAdaptiveNutrition({ ...ok, ...over });

  it('adherencia MEDIUM / LOW → NO_ADJUSTMENT en todos los objetivos', () => {
    const cases: Case[] = [
      { objective: 'FAT_LOSS', weight: FL.FAST }, { objective: 'MUSCLE_GAIN', weight: MG.ABOVE },
      { objective: 'RECOMPOSITION', weight: RC.UP, previous: prev({ waistCm: 85 }) }, { objective: 'MAINTENANCE', weight: MT.BELOW },
    ];
    for (const k of cases) for (const a of ['MOST_DAYS', 'VERY_LITTLE']) {
      expect(d(decide({ ...k, checkin: { ...k.checkin, adherenceAnswer: a } })), `${k.objective} ${a}`).toMatchObject({ action: 'NO_ADJUSTMENT', reason: 'ADHERENCE_NOT_HIGH', proposedStep: 0 });
    }
  });
  it('trayectoria insuficiente va antes que la adherencia', () => {
    expect(act({ objective: 'MAINTENANCE', weight: MT.BELOW, days: 14, checkin: { adherenceAnswer: 'VERY_LITTLE' } })).toEqual(['NO_ADJUSTMENT', 'INSUFFICIENT_WINDOW']);
  });
  it('trayectoria con datos insuficientes → NO_ADJUSTMENT / INSUFFICIENT_DATA', () => {
    const trajectory = assessTrajectory({ objective: 'MAINTENANCE', previousWeightKg: null, currentWeightKg: MT.BELOW, elapsed: { elapsedDays: 28 } });
    expect(d(inv({ trajectory }))).toMatchObject({ action: 'NO_ADJUSTMENT', reason: 'INSUFFICIENT_DATA' });
  });
  it('check-in INVALID o INCOMPLETE → INVALID_INPUT', () => {
    expect(inv({ checkin: validateNutritionCheckin({ ...BASE_CK, hunger: 'X' }) })).toEqual({ status: 'INVALID_INPUT', reason: 'CHECKIN_NOT_VALID' });
    expect(inv({ checkin: validateNutritionCheckin({ ...BASE_CK, hunger: undefined }) })).toEqual({ status: 'INVALID_INPUT', reason: 'CHECKIN_NOT_VALID' });
  });
  it('trayectoria INVALID_INPUT → INVALID_INPUT', () => {
    const trajectory = assessTrajectory({ objective: 'MAINTENANCE', previousWeightKg: -1, currentWeightKg: 70, elapsed: { elapsedDays: 28 } });
    expect(inv({ trajectory })).toEqual({ status: 'INVALID_INPUT', reason: 'TRAJECTORY_INVALID' });
  });
  it('objetivo distinto entre input, trayectoria y check-in → OBJECTIVE_MISMATCH', () => {
    expect(inv({ objective: 'FAT_LOSS' })).toEqual({ status: 'INVALID_INPUT', reason: 'OBJECTIVE_MISMATCH' });
    expect(inv({ checkin: validateNutritionCheckin({ ...BASE_CK, objective: 'FAT_LOSS' }) })).toEqual({ status: 'INVALID_INPUT', reason: 'OBJECTIVE_MISMATCH' });
    expect(inv({ objective: 'BULK' as never })).toEqual({ status: 'INVALID_INPUT', reason: 'UNKNOWN_OBJECTIVE' });
  });
  it('paso inválido → INVALID_STEP', () => {
    for (const s of [3, -3, 1.5, NaN, '1' as never]) expect(inv({ currentStep: s })).toEqual({ status: 'INVALID_INPUT', reason: 'INVALID_STEP' });
  });
  it('cycleIndex inválido o distinto del ciclo del check-in', () => {
    for (const c of [0, -1, 2.5]) expect(inv({ cycleIndex: c })).toEqual({ status: 'INVALID_INPUT', reason: 'INVALID_CYCLE_INDEX' });
    expect(inv({ checkin: validateNutritionCheckin({ ...BASE_CK, cycleNumber: 5 }) })).toEqual({ status: 'INVALID_INPUT', reason: 'CYCLE_MISMATCH' });
  });
  it('peso del check-in ≠ peso actual de la trayectoria → WEIGHT_MISMATCH', () => {
    expect(inv({ checkin: validateNutritionCheckin({ ...BASE_CK, weightKg: 68 }) })).toEqual({ status: 'INVALID_INPUT', reason: 'WEIGHT_MISMATCH' });
  });
  it('contexto previo mal formado → INVALID_PREVIOUS_CONTEXT; null = primera lectura', () => {
    for (const bad of [{}, prev({ action: 'BAJAR' as never }), prev({ hunger: 'X' as never }), prev({ waistCm: 0 }), prev({ classification: { objective: 'X' } as never })]) {
      expect(inv({ previous: bad as PreviousCheckinContext })).toEqual({ status: 'INVALID_INPUT', reason: 'INVALID_PREVIOUS_CONTEXT' });
    }
    expect(d(inv({ previous: null })).action).toBe('STEP_UP');
  });
  it('determinista y sin mutar la entrada', () => {
    const frozen = Object.freeze({ ...ok });
    expect(decideAdaptiveNutrition(frozen)).toEqual(decideAdaptiveNutrition(frozen));
  });
});

const BASE_CK: NutritionCheckinInput = {
  objective: 'MAINTENANCE', weightKg: MT.BELOW, adherenceAnswer: 'PRACTICALLY_ALL',
  hunger: 'NORMAL', energy: 'NORMAL', performance: 'SAME', checkinDate: '2026-10-18',
};

describe('CINTURA · tolerancia ±0.5 cm', () => {
  it('|Δ| ≤ 0.5 → SAME (fronteras incluidas, sin ruido de coma flotante)', () => {
    for (const [a, b] of [[85, 85], [85, 85.5], [85, 84.5], [85.2, 84.7], [90.1, 90.6]]) expect(classifyWaistChange(a, b), `${a}→${b}`).toBe('SAME');
  });
  it('> 0.5 → HIGHER; < −0.5 → LOWER', () => {
    expect(classifyWaistChange(85, 85.6)).toBe('HIGHER');
    expect(classifyWaistChange(85, 84.4)).toBe('LOWER');
  });
});

describe('PUREZA · sin store, DB, UI, Training, logs ni kcal', () => {
  const BODY = CODE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const imports = [...CODE.matchAll(/^import [\s\S]*? from '([^']+)';$/gm)].map((m) => m[1]);
  it('solo importa los módulos puros de Nutrición (MB1, MB2 y objetivos canónicos)', () => {
    expect(imports).toEqual(['./energyPrescription', './nutritionTrajectory', './nutritionCheckin']);
  });
  it('no toca store, Supabase, React, storage, red, reloj, Training ni logs', () => {
    for (const banned of ['store', 'supabase', 'react', 'localStorage', 'fetch(', 'Date', 'todayCheckin', 'readiness',
      'mesocycle', 'workoutLog', 'completedSessions', 'foodLog', 'mealChecks', 'obData']) {
      expect(BODY.includes(banned), banned).toBe(false);
    }
  });
  it('no calcula kcal ni llama a la cadena energética', () => {
    for (const banned of ['kcal', 'prescribeEnergy', 'prescribeMacros', 'planGoal', 'estimateMaintenance', '0.05']) {
      expect(BODY.includes(banned), banned).toBe(false);
    }
  });
});
