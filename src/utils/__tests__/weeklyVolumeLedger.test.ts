import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { freezeTrainingTestDate, restoreTrainingTestDate } from './helpers/frozenClock';
import { computeWeeklyVolume } from '../workoutPlanner';
import { buildSupplementalPlan } from '../supplementalWorkout';
import { deriveCapabilities } from '../equipmentImplement';
import { exercises as BANK } from '../../data/exercises';
import type { CompletedSession, MuscleGroup } from '../../types';

// ═══════════════════════════════════════════════════════════════════════════
// LEDGER DE VOLUMEN REAL · computeWeeklyVolume cuenta SETS EJECUTADOS (exercises[].sets.length)
// en sesiones modernas; defaultSets solo en fallback legacy. Atribución muscular SIN cambios.
// ═══════════════════════════════════════════════════════════════════════════

const today = '2026-08-19';
// press-horizontal: pecho, main-compound, defaultSets 4. Sin secondaryMuscles relevantes para el conteo base.
const PRESS = 'press-horizontal';
const bankPress = BANK.find(e => e.id === PRESS)!;

const set = (reps = 8, kg = 40) => ({ reps, kg });
const modern = (exs: Array<{ id: string; nsets: number }>, extra: Partial<CompletedSession> = {}): CompletedSession => ({
  sessionId: extra.sessionId ?? 's1', date: today, completedAtIso: `${today}T10:00:00.000Z`, modality: 'fuerza',
  exerciseIds: exs.map(e => e.id), durationSeconds: 1800, exercisesCompleted: exs.length, exercisesTotal: exs.length,
  exercises: exs.map(e => ({ id: e.id, sets: Array.from({ length: e.nsets }, () => set()) })),
  ...extra,
});
const vol = (sessions: CompletedSession[]) => computeWeeklyVolume(sessions, BANK, 7, []);

// TEST-STABILITY-1 · reloj congelado a la referencia de los fixtures (2026-08-19) para
// que la ventana de 7 días de computeWeeklyVolume los incluya en cualquier fecha/TZ.
beforeEach(freezeTrainingTestDate);
afterEach(restoreTrainingTestDate);

describe('ledger · sesión moderna cuenta ejecutados (no defaultSets)', () => {
  it('executed 5 > defaultSets 4 → cuenta 5', () => {
    expect(vol([modern([{ id: PRESS, nsets: 5 }])])['pecho']).toBe(5);
  });
  it('executed 2 < defaultSets 4 → cuenta 2 (no infla a 4)', () => {
    expect(vol([modern([{ id: PRESS, nsets: 2 }])])['pecho']).toBe(2);
  });
  it('prescrito 4 / ejecutado 3 → 3', () => {
    expect(vol([modern([{ id: PRESS, nsets: 3 }])])['pecho']).toBe(3);
  });
  it('prescrito 4 / ejecutado 2 → 2', () => {
    expect(vol([modern([{ id: PRESS, nsets: 2 }])])['pecho']).toBe(2);
  });
  it('ejecutado 0 → 0 (ejercicio con sets vacíos no cuenta)', () => {
    const s = modern([{ id: PRESS, nsets: 0 }]);
    expect(vol([s])['pecho'] ?? 0).toBe(0);
  });
  it('skipped no cuentan (solo los ejecutados aparecen en exercises[])', () => {
    // press con 2 ejecutados; el 3º/4º fueron skipped → escritura ya los excluyó → 2.
    expect(vol([modern([{ id: PRESS, nsets: 2 }])])['pecho']).toBe(2);
  });
});

describe('ledger · fallback legacy', () => {
  it('sin exercises[] → defaultSets por exerciseId', () => {
    const legacy: CompletedSession = {
      sessionId: 'L1', date: today, completedAtIso: `${today}T10:00:00.000Z`, modality: 'fuerza',
      exerciseIds: [PRESS], durationSeconds: 1800, exercisesCompleted: 1, exercisesTotal: 1,
    };
    expect(vol([legacy])['pecho']).toBe(bankPress.defaultSets); // 4
  });
  it('moderna NO re-suma exerciseIds (no mezcla ramas)', () => {
    // Añadir un id NO ejecutado a exerciseIds no cambia NADA (solo cuenta exercises[]). Delta-based
    // para ser robusto a secondaryMuscles (press-horizontal aporta 0.5 a triceps/hombros).
    const base = vol([modern([{ id: PRESS, nsets: 3 }])]);
    const s = modern([{ id: PRESS, nsets: 3 }]);
    s.exerciseIds = [PRESS, 'press-vertical']; // ruido: press-vertical NO está en exercises[]
    expect(vol([s])).toEqual(base);
  });
});

describe('ledger · cardio / supplemental / swaps / suma', () => {
  it('cardio → 0 hacia strength volume (excluido por ex.type==="cardio")', () => {
    const cardio: CompletedSession = {
      sessionId: 'C1', date: today, completedAtIso: `${today}T10:00:00.000Z`, modality: 'cardio',
      exerciseIds: ['mountain-climbers'], durationSeconds: 600, exercisesCompleted: 1, exercisesTotal: 1,
      exercises: [{ id: 'mountain-climbers', sets: [set(30, 0), set(30, 0)] }],
    };
    expect(Object.values(vol([cardio])).reduce((a, b) => a + b, 0)).toBe(0);
  });
  it('supplemental (source) cuenta sus sets reales', () => {
    const supp = modern([{ id: PRESS, nsets: 2 }], { sessionId: 's2', source: 'supplemental' });
    expect(vol([supp])['pecho']).toBe(2);
  });
  it('swap A→B: volumen al ejecutado B (exercises[].id)', () => {
    // el plan tenía press-horizontal; el usuario lo cambió a press-inclinado (pecho). exercises[].id=B.
    const swapped = modern([{ id: 'press-inclinado', nsets: 3 }], { sessionId: 's3' });
    swapped.exerciseIds = ['press-inclinado']; // source-of-truth ya reescribió al ejecutado
    const v = vol([swapped]);
    expect(v['pecho']).toBe(3);
  });
  it('dos sesiones mismo día → suman', () => {
    const a = modern([{ id: PRESS, nsets: 3 }], { sessionId: 'a' });
    const b = modern([{ id: PRESS, nsets: 2 }], { sessionId: 'b' });
    expect(vol([a, b])['pecho']).toBe(5);
  });
  it('sesión parcial NO infla: moderno (executed) < legacy (defaultSets) para los MISMOS ejercicios', () => {
    const exs = [{ id: PRESS, nsets: 2 }, { id: 'press-vertical', nsets: 2 }, { id: 'remo-horizontal-pesado', nsets: 2 }];
    const modernS = modern(exs); // 2+2+2 = 6 sets primarios ejecutados
    const legacyS: CompletedSession = { ...modernS, sessionId: 'leg', exercises: undefined }; // → defaultSets (4+4+4)
    const sum = (v: Record<string, number>) => Object.values(v).reduce((a, b) => a + b, 0);
    expect(sum(vol([modernS]))).toBeLessThan(sum(vol([legacyS]))); // executed 6 << defaultSets 12 (+ secundarios)
  });
});

describe('ledger · no doble conteo con workoutLog legacy', () => {
  it('workoutLog en fecha cubierta por completedSession NO se re-suma', () => {
    const s = modern([{ id: PRESS, nsets: 3 }]);
    const withLog = computeWeeklyVolume([s], BANK, 7, [{ date: today, exercise: PRESS, sets: [set(), set()] } as never]);
    expect(withLog['pecho']).toBe(3); // solo la sesión moderna; el log del mismo día se ignora
  });
});

describe('ledger · downstream (D1 covered según volumen real)', () => {
  const gym = deriveCapabilities(['gym']);
  const pushMuscles: MuscleGroup[] = ['pecho', 'hombros', 'triceps'];
  it('D1 usa el ledger corregido: sesión de 2 sets deja más déficit que una de defaultSets', () => {
    const twoSet = modern([{ id: PRESS, nsets: 2 }]);
    const target = { pecho: 12, hombros: 12, triceps: 12 };
    const r = buildSupplementalPlan({
      completedSessions: [twoSet], bank: BANK, weeklyTarget: target, dayMuscles: pushMuscles,
      doneExerciseIds: [PRESS], equipmentList: gym.equipmentList, allowed: gym.allowedImplements, maxExtra: 3,
    });
    // con solo 2 sets contados (no 4), queda déficit legítimo → NO 'covered'
    expect(r.status).toBe('ok');
  });
});
