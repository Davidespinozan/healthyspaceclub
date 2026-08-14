import { describe, it, expect } from 'vitest';
import { exercises } from '../../data/exercises';
import {
  resolveTrainingGoal,
  normalizeTrainingGoal,
  decideTodayWorkout,
  buildConfigHash,
} from '../workoutPlanner';
import { repRangeFor, rirFor, restFor } from '../sessionPrescription';
import { finisherShare, allocateTime, buildFinisher, type SessionInput } from '../sessionBlocks';
import { computeNutritionTargets, parseObData } from '../nutritionTargets';
import type { MuscleGroup } from '../../types';

// ─────────────────────────────────────────────────────────────────────────
// FASE 0 · SEPARACIÓN BODY GOAL / TRAINING GOAL / MODALITY.
//
// Blinda que los tres conceptos ya NO colisionan:
//  · BODY GOAL  → nutrición + dosis de cardio; JAMÁS reps/estructura de resistencia.
//  · TRAINING GOAL (hipertrofia|fuerza) → reps de resistencia + protección del main.
//  · El cut (perder grasa) NO convierte la fuerza en cardio/circuito ni infla el finisher.
// ─────────────────────────────────────────────────────────────────────────

const CATS = ['main-compound', 'secondary-compound', 'isolation'] as const;
const PHASES = ['acumulacion', 'intensificacion', 'deload'] as const;

// Tres usuarios idénticos salvo body goal / training goal (spec §11).
const A = { goal: 'Ganar músculo' };                       // bodyGoal ganar · trainingGoal hipertrofia
const B = { goal: 'Bajar grasa' };                         // bodyGoal cut    · trainingGoal hipertrofia
const C = { goal: 'Bajar grasa', trainingGoal: 'fuerza' }; // bodyGoal cut    · trainingGoal fuerza

describe('Fase 0 · resolveTrainingGoal NO deriva del body goal', () => {
  it('sin preferencia explícita → hipertrofia, sea cual sea el body goal', () => {
    expect(resolveTrainingGoal(A)).toBe('hipertrofia');
    expect(resolveTrainingGoal(B)).toBe('hipertrofia');
    expect(resolveTrainingGoal({ goal: 'perder grasa' })).toBe('hipertrofia');
    expect(resolveTrainingGoal({ goal: 'recomposición' })).toBe('hipertrofia');
    expect(resolveTrainingGoal(null)).toBe('hipertrofia');
  });
  it('preferencia explícita de fuerza → fuerza (independiente del body goal)', () => {
    expect(resolveTrainingGoal(C)).toBe('fuerza');
  });
  it('normalizeTrainingGoal: un body goal NUNCA produce fuerza', () => {
    expect(normalizeTrainingGoal('perder grasa')).toBe('hipertrofia');
    expect(normalizeTrainingGoal('ganar músculo')).toBe('hipertrofia');
    expect(normalizeTrainingGoal('condicion')).toBe('hipertrofia');
    expect(normalizeTrainingGoal('fuerza')).toBe('fuerza');
    expect(normalizeTrainingGoal('')).toBe('hipertrofia');
  });
});

describe('Fase 0 · A y B (mismo trainingGoal) → MISMA filosofía de resistencia', () => {
  it('reps idénticas para A y B en toda categoría/fase (el body goal no cambia reps)', () => {
    const tgA = resolveTrainingGoal(A), tgB = resolveTrainingGoal(B);
    for (const cat of CATS) for (const ph of PHASES) {
      expect(repRangeFor(cat, tgA, ph)).toBe(repRangeFor(cat, tgB, ph));
    }
  });
  it('A y B (ambos hipertrofia) → RIR y descanso idénticos', () => {
    const tgA = resolveTrainingGoal(A), tgB = resolveTrainingGoal(B);
    for (const cat of CATS) for (const ph of PHASES) {
      expect(rirFor(cat, tgA, ph)).toBe(rirFor(cat, tgB, ph));
      expect(restFor(cat, tgA, ph)).toBe(restFor(cat, tgB, ph));
    }
  });
});

describe('Fase 0 · C (fuerza) queda preparado para la rama de fuerza real', () => {
  it('trainingGoal fuerza → reps bajas en compuestos (distinto de hipertrofia)', () => {
    const tgC = resolveTrainingGoal(C);
    expect(repRangeFor('main-compound', tgC, 'acumulacion')).toBe('4-6');
    expect(repRangeFor('main-compound', tgC, 'intensificacion')).toBe('3-5');
    // y difiere de hipertrofia
    expect(repRangeFor('main-compound', 'hipertrofia', 'acumulacion')).toBe('6-10');
  });
});

describe('CUT · no fuerza reps altas en resistencia', () => {
  it('perder grasa → reps de hipertrofia, NO rangos de resistencia (8-12/15-20)', () => {
    const tg = normalizeTrainingGoal(B.goal); // 'hipertrofia'
    expect(repRangeFor('main-compound', tg, 'acumulacion')).toBe('6-10');
    expect(repRangeFor('secondary-compound', tg, 'acumulacion')).toBe('8-12');
    expect(repRangeFor('isolation', tg, 'acumulacion')).toBe('12-15');
    // NUNCA los rangos "condic" viejos (8-12 en main, 15-20 en isolation)
    expect(repRangeFor('main-compound', tg, 'acumulacion')).not.toBe('8-12');
    expect(repRangeFor('isolation', tg, 'acumulacion')).not.toBe('15-20');
  });
});

describe('CUT · no reemplaza resistencia por cardio (CYCLES neutral)', () => {
  const commonArgs = { workoutLog: [], exercises, completedSessions: [] };
  it('el día AUTO de un usuario en cut NUNCA es cardio (ningún día del ciclo lo es)', () => {
    // El ciclo es neutral al body goal → sin importar el día de la semana, jamás 'cardio'.
    const cut = decideTodayWorkout({ userObjective: 'Bajar grasa', ...commonArgs });
    const bulk = decideTodayWorkout({ userObjective: 'Ganar músculo', ...commonArgs });
    expect(cut.type).not.toBe('cardio');
    expect(bulk.type).not.toBe('cardio');
  });
  it('cut y bulk reciben el MISMO tipo de día (el body goal no cambia el split)', () => {
    const cut = decideTodayWorkout({ userObjective: 'Bajar grasa', ...commonArgs });
    const bulk = decideTodayWorkout({ userObjective: 'Ganar músculo', ...commonArgs });
    expect(cut.type).toBe(bulk.type);
  });
});

describe('CUT · finisher acotado (no desproporcionado) y readiness/fase lo recortan', () => {
  it('el finisher del cut ya NO es desproporcionado (share ≤ 0.22, antes 0.35)', () => {
    expect(finisherShare('perder grasa')).toBeLessThanOrEqual(0.22);
    // sigue siendo MAYOR que ganar músculo (el cut recibe más cardio, pero acotado)
    expect(finisherShare('perder grasa')).toBeGreaterThan(finisherShare('ganar músculo'));
  });
  it('en un día de cut a 60 min el MAIN domina (fuerza sigue siendo el bloque principal)', () => {
    const a = allocateTime({ totalMinutes: 60, isStrengthDay: true, objective: 'perder grasa', trainingGoal: 'hipertrofia' });
    expect(a.main).toBeGreaterThan(a.finisher);
    expect(a.main / 60).toBeGreaterThan(0.6); // el principal es la mayoría de la sesión
  });
  it('cut + FUERZA protege aún más el main (finisher menor que cut + hipertrofia)', () => {
    const hip = finisherShare('perder grasa', 'hipertrofia');
    const fue = finisherShare('perder grasa', 'fuerza');
    expect(fue).toBeLessThan(hip);
  });
  it('readiness aguda baja recorta el finisher', () => {
    expect(finisherShare('perder grasa', 'hipertrofia', true))
      .toBeLessThan(finisherShare('perder grasa', 'hipertrofia', false));
    const normal = allocateTime({ totalMinutes: 60, isStrengthDay: true, objective: 'perder grasa' });
    const low = allocateTime({ totalMinutes: 60, isStrengthDay: true, objective: 'perder grasa', readinessLow: true });
    expect(low.finisher).toBeLessThanOrEqual(normal.finisher);
  });
  it('deload recorta el finisher del cut', () => {
    const normal = allocateTime({ totalMinutes: 75, isStrengthDay: true, objective: 'perder grasa' });
    const deload = allocateTime({ totalMinutes: 75, isStrengthDay: true, objective: 'perder grasa', isDeload: true });
    expect(deload.finisher).toBeLessThan(normal.finisher);
  });
  it('30 min: el main respeta su piso y domina sobre el finisher', () => {
    const a = allocateTime({ totalMinutes: 30, isStrengthDay: true, objective: 'perder grasa' });
    expect(a.main).toBeGreaterThanOrEqual(20);
    expect(a.main).toBeGreaterThan(a.finisher);
  });
});

describe('CUT · el metcon no lo decide el body goal por sí solo (training goal gatea)', () => {
  const base = (over: Partial<SessionInput> = {}): SessionInput => ({
    totalMinutes: 60, isStrengthDay: true, objective: 'perder grasa',
    dayMuscles: ['pecho', 'triceps'] as MuscleGroup[], equipment: ['gym'], bank: exercises, ...over,
  });
  it('cut + FUERZA → jamás circuito metcon (protege el main lift)', () => {
    const f = buildFinisher(24, base({ trainingGoal: 'fuerza' }));
    expect(f?.format).not.toBe('circuit');
  });
  it('cardio SÍ coexiste: cut (hipertrofia) con tiempo aún recibe finisher de cardio', () => {
    const f = buildFinisher(20, base({ trainingGoal: 'hipertrofia' }));
    expect(f).not.toBeNull();
  });
});

describe('CUT · nutrición SÍ responde al body goal (dominio A intacto)', () => {
  const stats = { sex: 'Hombre', peso: 80, estatura: 178, edad: 30, activity: 'Moderada' };
  it('bajar grasa → déficit; ganar músculo → superávit (mismas stats)', () => {
    const cut = computeNutritionTargets(parseObData({ ...stats, goal: 'Bajar grasa' }));
    const bulk = computeNutritionTargets(parseObData({ ...stats, goal: 'Ganar músculo' }));
    expect(cut.planGoal).toBeLessThan(bulk.planGoal);
    expect(cut.planGoal).toBeLessThan(cut.tdee);      // déficit real
    expect(bulk.planGoal).toBeGreaterThan(bulk.tdee); // superávit real
  });
});

describe('CACHE · el hash keyea los TRES conceptos por separado', () => {
  const baseHash = {
    duration: 60, equipment: 'gym', goal: 'hipertrofia', dayType: 'upper',
    modality: 'fuerza', objective: 'Bajar grasa', schemaVersion: 1,
  };
  it('cambiar el TRAINING GOAL invalida una rutina de resistencia incompatible', () => {
    const hip = buildConfigHash({ ...baseHash, trainingGoal: 'hipertrofia' });
    const fue = buildConfigHash({ ...baseHash, trainingGoal: 'fuerza' });
    expect(hip).not.toBe(fue);
  });
  it('cambiar el BODY GOAL sigue invalidando (nutrición/dosis de cardio distinta)', () => {
    const cut = buildConfigHash({ ...baseHash, trainingGoal: 'hipertrofia', objective: 'Bajar grasa' });
    const bulk = buildConfigHash({ ...baseHash, trainingGoal: 'hipertrofia', objective: 'Ganar músculo' });
    expect(cut).not.toBe(bulk);
  });
  it('cambiar la MODALITY invalida', () => {
    const res = buildConfigHash({ ...baseHash, trainingGoal: 'hipertrofia', modality: 'fuerza' });
    const car = buildConfigHash({ ...baseHash, trainingGoal: 'hipertrofia', modality: 'cardio' });
    expect(res).not.toBe(car);
  });
});
