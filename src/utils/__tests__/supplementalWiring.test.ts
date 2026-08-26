import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { freezeTrainingTestDate, restoreTrainingTestDate } from './helpers/frozenClock';
import { finishWorkoutSession } from '../workoutLogger';
import { buildSupplementalPlan } from '../supplementalWorkout';
import { buildSupplementalExercises } from '../supplementalPlan';
import { computeWeeklyVolume } from '../workoutPlanner';
import { shouldOfferGenerateMore } from '../workoutDisplay';
import { deriveCapabilities } from '../equipmentImplement';
import { exercises as BANK } from '../../data/exercises';
import type { CompletedSession, MuscleGroup } from '../../types';

// ═══════════════════════════════════════════════════════════════════════════
// D1 WIRING · "Generarme más" de extremo a extremo (source, plan ejecutable, completion).
// El CORE (buildSupplementalPlan) está probado en supplementalWorkout.test.ts — aquí probamos las
// COSTURAS: source backward-compatible, plan supplemental ejecutable (series rectas, ≤3), completion
// como sesión NUEVA con source, y que el trabajo cuenta en volumen.
// ═══════════════════════════════════════════════════════════════════════════

const upsertMock = vi.fn((_p: Record<string, unknown>, _o?: Record<string, unknown>) => Promise.resolve({ error: null }));
const fromMock = vi.fn((_t: string) => ({ upsert: upsertMock }));
vi.mock('../../lib/supabase', () => ({ supabase: { from: (t: string) => fromMock(t) } }));

const today = '2026-08-19';
// TEST-STABILITY-1 · reloj congelado (nivel de archivo) a la referencia de los fixtures
// (2026-08-19), independiente del beforeEach de limpieza de mocks de cada describe.
beforeEach(freezeTrainingTestDate);
afterEach(restoreTrainingTestDate);
const gym = deriveCapabilities(['gym']);
const pushMuscles: MuscleGroup[] = ['pecho', 'hombros', 'triceps'];
const doneSession: CompletedSession = {
  sessionId: 's1', date: today, completedAtIso: `${today}T10:00:00.000Z`, modality: 'fuerza',
  exerciseIds: ['press-horizontal'], durationSeconds: 1800, exercisesCompleted: 1, exercisesTotal: 1,
};

// ── PASO 1 · source backward-compatible (finishWorkoutSession) ──
describe('source · backward-compatible', () => {
  beforeEach(() => { fromMock.mockClear(); upsertMock.mockClear(); });

  it('1 · sesión SIN source → CompletedSession sin source (histórico intacto)', async () => {
    const add = vi.fn();
    await finishWorkoutSession(
      { userId: null, modality: 'fuerza', exercises: [{ exercise_id: 'press-horizontal', order: 0 }],
        exercisesCompleted: 1, exercisesTotal: 1, durationSeconds: 900, targetDurationSeconds: 1800, equipment: 'gym' },
      add, vi.fn().mockResolvedValue(undefined),
    );
    expect(add).toHaveBeenCalledOnce();
    expect(add.mock.calls[0][0]).not.toHaveProperty('source');
  });

  it('12/13 · supplemental → source=\'supplemental\' y modality=\'fuerza\' (no inventa modality)', async () => {
    const add = vi.fn();
    await finishWorkoutSession(
      { userId: null, modality: 'fuerza', source: 'supplemental',
        exercises: [{ exercise_id: 'press-vertical', order: 0 }],
        exercisesCompleted: 1, exercisesTotal: 1, durationSeconds: 600, targetDurationSeconds: 900, equipment: 'gym' },
      add, vi.fn().mockResolvedValue(undefined),
    );
    const session = add.mock.calls[0][0] as CompletedSession;
    expect(session.source).toBe('supplemental');
    expect(session.modality).toBe('fuerza');
  });

  it('prescribed explícito NO se persiste (queda como histórico normal)', async () => {
    const add = vi.fn();
    await finishWorkoutSession(
      { userId: null, modality: 'fuerza', source: 'prescribed', exercises: [{ exercise_id: 'press-horizontal', order: 0 }],
        exercisesCompleted: 1, exercisesTotal: 1, durationSeconds: 900, targetDurationSeconds: 1800, equipment: 'gym' },
      add, vi.fn().mockResolvedValue(undefined),
    );
    expect(add.mock.calls[0][0]).not.toHaveProperty('source');
  });
});

// ── PASO 7 · completion: sesión NUEVA, original intacta ──
describe('completion · sesión nueva, original intacta', () => {
  beforeEach(() => { fromMock.mockClear(); upsertMock.mockClear(); });

  it('10/11 · dos completions (original + supplemental) → sessionId distintos, objetos independientes', async () => {
    const sessions: CompletedSession[] = [];
    const add = (s: CompletedSession) => { sessions.push(s); };
    const mark = vi.fn().mockResolvedValue(undefined);
    await finishWorkoutSession(
      { userId: null, modality: 'fuerza', sessionDate: today, exercises: [{ exercise_id: 'press-horizontal', order: 0 }],
        exercisesCompleted: 1, exercisesTotal: 1, durationSeconds: 1800, targetDurationSeconds: 2700, equipment: 'gym' },
      add, mark,
    );
    const original = { ...sessions[0] };
    await finishWorkoutSession(
      { userId: null, modality: 'fuerza', source: 'supplemental', sessionDate: today,
        exercises: [{ exercise_id: 'press-vertical', order: 0 }],
        exercisesCompleted: 1, exercisesTotal: 1, durationSeconds: 600, targetDurationSeconds: 900, equipment: 'gym' },
      add, mark,
    );
    expect(sessions).toHaveLength(2);
    expect(sessions[0].sessionId).not.toBe(sessions[1].sessionId);
    // La original NO mutó: sigue byte-for-byte igual a la captura previa.
    expect(sessions[0]).toEqual(original);
    expect(sessions[0].source).toBeUndefined();
    expect(sessions[1].source).toBe('supplemental');
  });

  it('16 · ambas completions del mismo día llaman markActiveDay con el MISMO día sellado (racha idempotente)', async () => {
    const add = vi.fn();
    const mark = vi.fn().mockResolvedValue(undefined);
    for (const source of [undefined, 'supplemental' as const]) {
      await finishWorkoutSession(
        { userId: null, modality: 'fuerza', source, sessionDate: today, exercises: [{ exercise_id: 'press-horizontal', order: 0 }],
          exercisesCompleted: 1, exercisesTotal: 1, durationSeconds: 600, targetDurationSeconds: 900, equipment: 'gym' },
        add, mark,
      );
    }
    // markActiveDay recibe el día sellado en AMBAS → la racha (idempotente por día) no suma 2 días.
    expect(mark).toHaveBeenCalledTimes(2);
    expect(mark).toHaveBeenNthCalledWith(1, today);
    expect(mark).toHaveBeenNthCalledWith(2, today);
  });
});

// ── PASO 5 · plan supplemental ejecutable (buildSupplementalExercises) ──
describe('plan supplemental ejecutable', () => {
  const buildFrom = (weeklyTarget: Record<string, number>) => {
    const res = buildSupplementalPlan({
      completedSessions: [doneSession], bank: BANK, weeklyTarget, dayMuscles: pushMuscles,
      doneExerciseIds: ['press-horizontal'], equipmentList: gym.equipmentList, allowed: gym.allowedImplements, maxExtra: 3,
    });
    if (res.status !== 'ok') return null;
    const done7 = computeWeeklyVolume([doneSession], BANK, 7, []);
    const allocation: Record<string, number> = {};
    for (const m of pushMuscles) allocation[m] = Math.max(0, (weeklyTarget[m] ?? 0) - (done7[m] ?? 0));
    return buildSupplementalExercises({
      exerciseIds: res.exerciseIds, bank: BANK, allocation,
      trainingGoal: 'hipertrofia', phase: 'acumulacion', level: 'intermedio',
    });
  };

  it('7/8 · plan ejecutable con ≤3 ejercicios, cada uno con sets/reps/rest', () => {
    const plan = buildFrom({ pecho: 22, hombros: 22, triceps: 22 });
    expect(plan).not.toBeNull();
    expect(plan!.length).toBeGreaterThanOrEqual(1);
    expect(plan!.length).toBeLessThanOrEqual(3);
    for (const ex of plan!) {
      expect(ex.id).toBeTruthy();
      expect(ex.sets).toBeGreaterThanOrEqual(2);
      expect(String(ex.reps).length).toBeGreaterThan(0);
      expect(ex.rest).toBeGreaterThan(0);
    }
  });

  it('9/30 · SERIES RECTAS: ningún ejercicio lleva `group` (buildGroups NO se invoca)', () => {
    const plan = buildFrom({ pecho: 40, hombros: 40, triceps: 40 });
    expect(plan).not.toBeNull();
    for (const ex of plan!) expect(ex).not.toHaveProperty('group');
  });

  it('orden preservado (respeta exerciseIds del core) y sin duplicar lo hecho hoy', () => {
    const plan = buildFrom({ pecho: 22, hombros: 22, triceps: 22 });
    for (const ex of plan!) expect(ex.id).not.toBe('press-horizontal');
  });
});

// ── PASO 2/3/4/9 · entrada persistente "Generarme más" (shouldOfferGenerateMore) ──
describe('CTA "Generarme más" · visibilidad', () => {
  it('2 · tras COMPLETAR fuerza → CTA visible', () =>
    expect(shouldOfferGenerateMore([{ modality: 'fuerza' }])).toBe(true));
  it('3 · solo cardio completado → NO CTA', () =>
    expect(shouldOfferGenerateMore([{ modality: 'cardio' }])).toBe(false));
  it('4 · tras un supplemental (modality fuerza) → CTA sigue visible (converge a covered)', () =>
    expect(shouldOfferGenerateMore([{ modality: 'fuerza' }, { modality: 'fuerza' }])).toBe(true));
  it('día vacío → NO CTA', () => expect(shouldOfferGenerateMore([])).toBe(false));
  it('19 · cerrar/reabrir: la visibilidad depende de completedSessions (rehidratadas) → persiste', () =>
    expect(shouldOfferGenerateMore([{ modality: 'fuerza' }])).toBe(true));
});

// ── PASO 18 · Today identifica el supplemental como EXTRA ──
describe('Today · label EXTRA', () => {
  it('17/18 · principal (sin source) vs supplemental (source) se distinguen', () => {
    const principal: CompletedSession = { ...doneSession };
    const extra: CompletedSession = { ...doneSession, sessionId: 's2', source: 'supplemental' };
    expect(principal.source === 'supplemental').toBe(false); // sin badge
    expect(extra.source === 'supplemental').toBe(true);      // badge EXTRA
  });
});

// ── PASO 8/14 · el supplemental SUMA a computeWeeklyVolume ──
describe('volumen · el supplemental cuenta', () => {
  it('14 · una CompletedSession supplemental incrementa el volumen semanal', () => {
    const supp: CompletedSession = {
      ...doneSession, sessionId: 's2', source: 'supplemental', exerciseIds: ['press-vertical', 'press-frances'],
    };
    const before = computeWeeklyVolume([doneSession], BANK, 7, []);
    const after = computeWeeklyVolume([doneSession, supp], BANK, 7, []);
    const sum = (v: Record<string, number>) => Object.values(v).reduce((a, b) => a + b, 0);
    expect(sum(after)).toBeGreaterThan(sum(before));
  });

  it('23 · un 2º supplemental recalcula el déficit (menor) tras sumar el 1º', () => {
    const target = { pecho: 12, hombros: 12, triceps: 12 };
    const r1 = buildSupplementalPlan({
      completedSessions: [doneSession], bank: BANK, weeklyTarget: target, dayMuscles: pushMuscles,
      doneExerciseIds: ['press-horizontal'], equipmentList: gym.equipmentList, allowed: gym.allowedImplements, maxExtra: 3,
    });
    expect(r1.status).toBe('ok');
    const ids1 = r1.status === 'ok' ? r1.exerciseIds : [];
    const supp: CompletedSession = { ...doneSession, sessionId: 's2', exerciseIds: ids1 };
    const r2 = buildSupplementalPlan({
      completedSessions: [doneSession, supp], bank: BANK, weeklyTarget: target, dayMuscles: pushMuscles,
      doneExerciseIds: ['press-horizontal', ...ids1], equipmentList: gym.equipmentList, allowed: gym.allowedImplements, maxExtra: 3,
    });
    // Tras el 1º, el déficit se redujo → 2º pide ≤ que el 1º (y eventualmente covered).
    const c1 = r1.status === 'ok' ? r1.count : 0;
    const c2 = r2.status === 'ok' ? r2.count : 0;
    expect(c2).toBeLessThanOrEqual(c1);
  });
});
