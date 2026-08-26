import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { freezeTrainingTestDate, restoreTrainingTestDate } from './helpers/frozenClock';
import { roleOf, isWorkingSet, type ExecutionRole } from '../executionRole';
import { computeWeeklyVolume } from '../workoutPlanner';
import { regionExposure } from '../regionalCoverage';
import { bestE1RMByMuscle } from '../loadEngine';
import { finishWorkoutSession, type ExerciseLogItem } from '../workoutLogger';
import { mapWorkoutLogRowToSession, type WorkoutLogRow } from '../workoutSync';
import { exercises as BANK } from '../../data/exercises';
import type { CompletedSession, LoggedSet } from '../../types';

const PRESS = 'press-horizontal';                 // pecho, compuesto
const D = '2026-08-19';
type S = { reps: number; kg: number; rir?: number; role?: ExecutionRole };
const set = (reps: number, kg: number, role?: ExecutionRole, rir?: number): S =>
  ({ reps, kg, ...(role && { role }), ...(rir != null && { rir }) });

const sess = (modality: CompletedSession['modality'], sets: S[], extra: Partial<CompletedSession> = {}): CompletedSession => ({
  sessionId: extra.sessionId ?? `s-${modality}`, date: D, completedAtIso: `${D}T10:00:00.000Z`,
  modality, exerciseIds: [PRESS], durationSeconds: 1800, exercisesCompleted: 1, exercisesTotal: 1,
  exercises: [{ id: PRESS, sets }], ...extra,
});
const vol = (s: CompletedSession[]) => computeWeeklyVolume(s, BANK, 7, []);
// TEST-STABILITY-1 · reloj congelado a la referencia de los fixtures (2026-08-19).
beforeEach(freezeTrainingTestDate);
afterEach(restoreTrainingTestDate);
const bankRegion = new Map(BANK.map(e => [e.id, e]));
// espejo de la entrada a e1RM (sessionMesocycle/DailyTrainer): solo working sets alimentan e1RM.
const e1rmWorking = (s: CompletedSession) =>
  bestE1RMByMuscle(s.exercises!.map(e => ({ exercise: e.id, sets: e.sets.filter(isWorkingSet) })), (id) => BANK.find(x => x.id === id)?.muscleGroup ?? '');

// ── helpers ──────────────────────────────────────────────────────────────────
describe('9C.1 · executionRole helpers', () => {
  it('A · legacy (sin role) → working', () => { expect(roleOf({})).toBe('working'); expect(isWorkingSet({})).toBe(true); });
  it('B · working explícito', () => expect(isWorkingSet({ role: 'working' })).toBe(true));
  it('warmup/cooldown → no working', () => {
    expect(isWorkingSet({ role: 'warmup' })).toBe(false);
    expect(isWorkingSet({ role: 'cooldown' })).toBe(false);
  });
  it('null → working (conservador)', () => expect(isWorkingSet({ role: null })).toBe(true));
});

// ── weekly volume ──────────────────────────────────────────────────────────────
describe('9C.1 · weekly volume por rol', () => {
  it('M/mixed · 3 warmup + 2 working (misma entrada) → 2 sets', () => {
    const s = sess('fuerza', [set(8, 0, 'warmup'), set(5, 40, 'warmup'), set(3, 60, 'warmup'), set(8, 80, 'working', 2), set(8, 80, 'working', 2)]);
    expect(vol([s])['pecho']).toBe(2);
  });
  it('C · warmup-only → 0 volume', () => {
    expect(vol([sess('fuerza', [set(8, 0, 'warmup'), set(5, 40, 'warmup')])])['pecho'] ?? 0).toBe(0);
  });
  it('D · cooldown-only → 0 volume', () => {
    expect(vol([sess('fuerza', [set(8, 0, 'cooldown')])])['pecho'] ?? 0).toBe(0);
  });
  it('A/legacy equivalence · sets SIN role → cuentan todos (working)', () => {
    expect(vol([sess('fuerza', [set(8, 80), set(8, 80), set(8, 80)])])['pecho']).toBe(3);
  });
  it('O · 9B.2 manda: cardio + working → 0 strength volume', () => {
    expect(Object.values(vol([sess('cardio', [set(10, 100, 'working', 2)])])).reduce((a, b) => a + b, 0)).toBe(0);
  });
  it('P/Q · supplemental: working cuenta, warmup no', () => {
    expect(vol([sess('fuerza', [set(8, 80, 'working')], { source: 'supplemental', sessionId: 'sup' })])['pecho']).toBe(1);
    expect(vol([sess('fuerza', [set(8, 0, 'warmup')], { source: 'supplemental', sessionId: 'sup2' })])['pecho'] ?? 0).toBe(0);
  });
});

// ── e1RM ───────────────────────────────────────────────────────────────────────
describe('9C.1 · e1RM solo desde working (espejo de sessionMesocycle/muscleE1RM)', () => {
  it('E/N · warmup kg altos NO entran a e1RM; solo working', () => {
    const s = sess('fuerza', [set(8, 200, 'warmup'), set(8, 80, 'working', 2)]);
    const e = e1rmWorking(s);
    // el e1RM del pecho refleja SOLO el working 80kg, jamás el warmup 200kg
    expect(e['pecho']).toBeGreaterThan(0);
    expect(e['pecho']).toBeLessThan(150);   // 80×~1.27 ≈ 101, nunca ~250 del warmup
  });
  it('F · cooldown-only → sin e1RM', () => {
    expect(e1rmWorking(sess('fuerza', [set(8, 100, 'cooldown')]))['pecho'] ?? 0).toBe(0);
  });
});

// ── regional coverage ────────────────────────────────────────────────────────────
describe('9C.1 · regional coverage', () => {
  const since = '2026-08-01';
  it('T · entrada pure-warmup → 0 exposición', () => {
    const s = sess('fuerza', [set(8, 0, 'warmup')]);
    expect(regionExposure([s], bankRegion, since)['upper-push']).toBe(0);
  });
  it('mixed (≥1 working) → sí exposición', () => {
    const s = sess('fuerza', [set(8, 0, 'warmup'), set(8, 80, 'working')]);
    expect(regionExposure([s], bankRegion, since)['upper-push']).toBeGreaterThan(0);
  });
  it('legacy equivalence · sin exercises[] (solo exerciseIds) → cuenta como hoy', () => {
    const legacy: CompletedSession = { sessionId: 'L', date: D, completedAtIso: `${D}T10:00:00.000Z`, modality: 'fuerza', exerciseIds: [PRESS], durationSeconds: 1800, exercisesCompleted: 1, exercisesTotal: 1 };
    expect(regionExposure([legacy], bankRegion, since)['upper-push']).toBeGreaterThan(0);
  });
  it('skipped (en exerciseIds, no en exercises[]) sigue contando (equivalencia)', () => {
    const withSkip = sess('fuerza', [set(8, 80, 'working')]); withSkip.exerciseIds = [PRESS, 'press-vertical'];
    const noSkip = sess('fuerza', [set(8, 80, 'working')]); noSkip.exerciseIds = [PRESS];
    const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
    // el id skipped (en exerciseIds, sin entrada en exercises[]) aporta su exposición como hoy.
    expect(sum(regionExposure([withSkip], bankRegion, since))).toBeGreaterThan(sum(regionExposure([noSkip], bankRegion, since)));
  });
});

// ── round-trip ────────────────────────────────────────────────────────────────
describe('9C.1 · round-trip preserva role', () => {
  it('Y-local · finishWorkoutSession conserva role en CompletedSession.exercises', async () => {
    let captured: CompletedSession | null = null;
    const exercises: ExerciseLogItem[] = [{
      exercise_id: PRESS, order: 0, planned: { sets: 4 },
      performed: { sets: [set(8, 40, 'warmup'), set(8, 80, 'working', 2)] as unknown as Array<LoggedSet | null>, skipped: false, completed_at: `${D}T10:00:00.000Z` },
    }];
    await finishWorkoutSession(
      { userId: null, modality: 'fuerza', exercises, exercisesCompleted: 1, exercisesTotal: 1, durationSeconds: 1800, targetDurationSeconds: 1800, equipment: 'gym', sessionDate: D },
      (s) => { captured = s; }, async () => {},
    );
    const roles = captured!.exercises![0].sets.map(x => roleOf(x));
    expect(roles).toEqual(['warmup', 'working']);
  });
  it('Y-remote · mapWorkoutLogRowToSession conserva role; legacy sin role → intacto', () => {
    const row = {
      client_session_id: 'r1', date_local: D, completed_at: `${D}T10:00:00.000Z`, modality: 'fuerza',
      duration_minutes: 30, exercises_completed: 1, exercises_total: 1,
      exercises: [{ exercise_id: PRESS, order: 0, planned: { sets: 2 }, performed: { sets: [{ reps: 8, kg: 40, role: 'warmup' }, { reps: 8, kg: 80, rir: 2, role: 'working' }] } }],
    } as unknown as WorkoutLogRow;
    const mapped = mapWorkoutLogRowToSession(row);
    expect(mapped.exercises![0].sets.map(roleOf)).toEqual(['warmup', 'working']);
    // volumen del round-trip: solo 1 working
    expect(computeWeeklyVolume([mapped], BANK, 7, [])['pecho']).toBe(1);
  });
});
