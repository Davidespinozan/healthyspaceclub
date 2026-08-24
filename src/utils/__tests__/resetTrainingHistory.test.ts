import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

// Mock del cliente Supabase real SOLO para las pruebas del outbox (flush). Registra upserts.
// Las pruebas del reset inyectan su propio doble por `deps.supabase`, así que este mock no las afecta.
const upsertSpy = vi.fn((..._args: unknown[]) => Promise.resolve({ error: null }));
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      upsert: (...args: unknown[]) => upsertSpy(...args),
    }),
  },
}));

import { useAppStore } from '../../store';
import {
  resetTrainingHistoryForCurrentUser,
  TRAINING_STORAGE_KEYS,
} from '../resetTrainingHistory';
import {
  flushPendingWorkouts,
  suspendWorkoutFlush,
  resumeWorkoutFlush,
  isWorkoutFlushSuspended,
} from '../workoutOutbox';
import { mergeWorkoutSessions } from '../workoutSync';
import { computeWeeklyCardio } from '../computeWeeklyCardio';
import type { CompletedSession, PendingWorkoutRow } from '../../types';

// ── Dobles de prueba ────────────────────────────────────────────────────────

/** Storage backed por Map (independiente del entorno). Satisface Pick<Storage,'removeItem'>. */
function makeStorage(seed: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    map,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
  };
}

interface SbCalls {
  deleteFrom: string[];
  deleteEq: Array<[string, string, string]>;
  updateFrom: string[];
  updatePayload: Array<Record<string, unknown>>;
  updateEq: Array<[string, string, string]>;
}

/** Doble de Supabase que registra las llamadas y permite forzar errores. */
function makeSupabase(opts: { deleteError?: unknown; updateError?: unknown } = {}) {
  const calls: SbCalls = { deleteFrom: [], deleteEq: [], updateFrom: [], updatePayload: [], updateEq: [] };
  const sb = {
    from(table: string) {
      return {
        delete() {
          calls.deleteFrom.push(table);
          return {
            eq(col: string, val: string) {
              calls.deleteEq.push([table, col, val]);
              return Promise.resolve({ error: opts.deleteError ?? null });
            },
          };
        },
        update(values: Record<string, unknown>) {
          calls.updateFrom.push(table);
          calls.updatePayload.push(values);
          return {
            eq(col: string, val: string) {
              calls.updateEq.push([table, col, val]);
              return Promise.resolve({ error: opts.updateError ?? null });
            },
          };
        },
      };
    },
  };
  return { sb, calls };
}

const USER_ID = 'user-under-test-123';
const asUser = (id: string) => ({ id } as unknown as User);

/** Siembra el store con historial de entrenamiento + datos protegidos + (opcional) sesión. */
function seedStore(withUser: boolean) {
  const cardioSession: CompletedSession = {
    sessionId: 's-cardio-1',
    date: '2026-08-19',
    completedAtIso: '2026-08-19T10:00:00.000Z',
    modality: 'cardio',
    exerciseIds: ['marcha'],
    durationSeconds: 1200,
    exercisesCompleted: 1,
    exercisesTotal: 1,
  };
  const pendingRow: PendingWorkoutRow = {
    user_id: USER_ID,
    client_session_id: 's-pending-1',
    date_local: '2026-08-19',
    completed_at: '2026-08-19T10:00:00.000Z',
    modality: 'fuerza',
    duration_minutes: 40,
    target_duration_minutes: 45,
    equipment: [],
    day_type: null,
    exercises: [],
    exercises_completed: 3,
    exercises_total: 4,
  } as unknown as PendingWorkoutRow;

  useAppStore.setState({
    user: withUser ? asUser(USER_ID) : null,
    // Historial de entrenamiento (debe borrarse)
    completedSessions: [cardioSession],
    pendingWorkoutSync: [pendingRow],
    lastExercisePerformance: { marcha: { date: '2026-08-19', sets: [{ reps: 10, kg: 0 }] } },
    workoutLog: [{ date: '2026-08-19', exercise: 'marcha', sets: [{ reps: 10, kg: 0 }] }],
    blockAnchors: [{ slot: 0 } as never],
    rirLog: [{ date: '2026-08-19', exerciseId: 'x', prescribedRir: 2, actualRir: 1, reps: 10, kg: 50 }],
    readinessLog: [{ date: '2026-08-19', state: 'normal' }],
    todayCheckin: { date: '2026-08-19', energy: 'ok' },
    activityLog: [{ id: 'a1', date: '2026-08-19', activity: 'basquet', durationMin: 60, loggedAtIso: '2026-08-19T10:00:00.000Z' }],
    dailyWorkout: { date: '2026-08-19', plan: { composedCardio: { done: false } }, generatedAt: '2026-08-19T09:00:00.000Z' },
    pendingSupplemental: true,
    pendingWorkoutModality: 'cardio',
    dailyWorkoutRegenCount: { date: '2026-08-19', countByModality: { cardio: 2 } },
    // Datos PROTEGIDOS (no deben cambiar)
    obData: { edad: 30, peso: 80, nivel: 'intermedio' },
    userPlan: 'pro',
    subscriptionStatus: 'pro',
    tdee: 2500,
    planGoal: 2200,
    weeklyPlan: null,
    streakCount: 7,
    lastActiveDate: '2026-08-19',
  });
}

beforeEach(() => {
  upsertSpy.mockClear();
  resumeWorkoutFlush(); // asegurar guard limpio entre tests
  // reset de campos usados en asserts (el store es singleton entre tests)
  useAppStore.setState({
    user: null,
    completedSessions: [],
    pendingWorkoutSync: [],
    lastExercisePerformance: {},
    workoutLog: [],
    blockAnchors: [],
    rirLog: [],
    readinessLog: [],
    todayCheckin: null,
    activityLog: [],
    dailyWorkout: null,
    pendingSupplemental: false,
    pendingWorkoutModality: null,
    dailyWorkoutRegenCount: { date: '', countByModality: {} },
  });
});

// ── A. usuario sin auth → aborta, sin DELETE remoto, sin mutación local ──────
describe('A · sin usuario autenticado', () => {
  it('aborta (throw), no llama al remoto y no muta el estado local', async () => {
    seedStore(false); // sin user
    const { sb, calls } = makeSupabase();
    const storage = makeStorage({ 'workout-player-progress': 'x' });

    await expect(
      resetTrainingHistoryForCurrentUser({ supabase: sb, storage }),
    ).rejects.toThrow(/no authenticated user/i);

    // No tocó Supabase
    expect(calls.deleteFrom).toHaveLength(0);
    expect(calls.updateFrom).toHaveLength(0);
    // No mutó local (el historial sembrado sigue intacto)
    expect(useAppStore.getState().completedSessions).toHaveLength(1);
    expect(useAppStore.getState().pendingWorkoutSync).toHaveLength(1);
    // No tocó storage
    expect(storage.getItem('workout-player-progress')).toBe('x');
  });
});

// ── B. autenticado → DELETE con user_id exacto; daily_workout remoto null ────
describe('B · borrado remoto', () => {
  it('DELETE workout_log lleva exactamente el user_id y update pone daily_workout=null', async () => {
    seedStore(true);
    const { sb, calls } = makeSupabase();
    const storage = makeStorage();

    const res = await resetTrainingHistoryForCurrentUser({ supabase: sb, storage });

    // DELETE workout_log WHERE user_id = <uid> (nunca sin filtro / neq)
    expect(calls.deleteFrom).toEqual(['workout_log']);
    expect(calls.deleteEq).toEqual([['workout_log', 'user_id', USER_ID]]);
    // UPDATE user_profiles daily_workout=null + daily_workout_regen=null, filtrado por user_id
    expect(calls.updateFrom).toEqual(['user_profiles']);
    expect(calls.updateEq).toEqual([['user_profiles', 'user_id', USER_ID]]);
    expect(calls.updatePayload[0].daily_workout).toBeNull();
    expect(calls.updatePayload[0].daily_workout_regen).toBeNull();
    expect(res.ok).toBe(true);
    expect(res.userId).toBe(USER_ID);
  });
});

// ── C. estado local vacío tras el reset ──────────────────────────────────────
describe('C · estado local tras reset', () => {
  it('deja los campos de entrenamiento en su shape inicial', async () => {
    seedStore(true);
    const { sb } = makeSupabase();
    await resetTrainingHistoryForCurrentUser({ supabase: sb, storage: makeStorage() });

    const s = useAppStore.getState();
    expect(s.completedSessions).toHaveLength(0);
    expect(s.pendingWorkoutSync).toHaveLength(0);
    expect(s.dailyWorkout).toBeNull();
    expect(s.activityLog).toHaveLength(0);
    expect(s.rirLog).toHaveLength(0);
    expect(s.readinessLog).toHaveLength(0);
    expect(s.lastExercisePerformance).toEqual({});
    expect(s.workoutLog).toHaveLength(0);
    expect(s.blockAnchors).toHaveLength(0);
    expect(s.todayCheckin).toBeNull();
    expect(s.pendingSupplemental).toBe(false);
    expect(s.pendingWorkoutModality).toBeNull();
    expect(s.dailyWorkoutRegenCount).toEqual({ date: '', countByModality: {} });
  });
});

// ── D. computeWeeklyCardio tras reset ────────────────────────────────────────
describe('D · computeWeeklyCardio', () => {
  it('con completedSessions vacío devuelve minutes7d=0 y sessions7d=0', async () => {
    seedStore(true);
    const { sb } = makeSupabase();
    await resetTrainingHistoryForCurrentUser({ supabase: sb, storage: makeStorage() });

    const now = Date.UTC(2026, 7, 20); // 2026-08-20
    const wc = computeWeeklyCardio(useAppStore.getState().completedSessions, now);
    expect(wc.minutes7d).toBe(0);
    expect(wc.sessions7d).toBe(0);
  });
});

// ── E. localStorage crudo eliminado ──────────────────────────────────────────
describe('E · localStorage de entrenamiento', () => {
  it('elimina workout-player-progress y yoga-flow-progress (y no hace clear global)', async () => {
    seedStore(true);
    const storage = makeStorage({
      'workout-player-progress': 'x',
      'yoga-flow-progress': 'y',
      'day-complete-celebrated': '2026-08-19',
      'hsc_session_min': '45',          // PROTEGIDO
      'hsc_priority_muscles': '["gluteo"]', // PROTEGIDO
    });
    const { sb } = makeSupabase();
    const res = await resetTrainingHistoryForCurrentUser({ supabase: sb, storage });

    expect(storage.getItem('workout-player-progress')).toBeNull();
    expect(storage.getItem('yoga-flow-progress')).toBeNull();
    expect(storage.getItem('day-complete-celebrated')).toBeNull();
    // Preferencias intactas (no es clear global)
    expect(storage.getItem('hsc_session_min')).toBe('45');
    expect(storage.getItem('hsc_priority_muscles')).toBe('["gluteo"]');
    expect(res.clearedStorageKeys.sort()).toEqual([...TRAINING_STORAGE_KEYS].sort());
  });
});

// ── F. datos protegidos deep-equal antes/después ─────────────────────────────
describe('F · datos protegidos', () => {
  it('obData / userPlan / subscription / streak / tdee no cambian', async () => {
    seedStore(true);
    const before = {
      obData: structuredClone(useAppStore.getState().obData),
      userPlan: useAppStore.getState().userPlan,
      subscriptionStatus: useAppStore.getState().subscriptionStatus,
      streakCount: useAppStore.getState().streakCount,
      lastActiveDate: useAppStore.getState().lastActiveDate,
      tdee: useAppStore.getState().tdee,
      planGoal: useAppStore.getState().planGoal,
    };
    const { sb } = makeSupabase();
    await resetTrainingHistoryForCurrentUser({ supabase: sb, storage: makeStorage() });

    const s = useAppStore.getState();
    expect(s.obData).toEqual(before.obData);
    expect(s.userPlan).toBe(before.userPlan);
    expect(s.subscriptionStatus).toBe(before.subscriptionStatus);
    expect(s.streakCount).toBe(before.streakCount);
    expect(s.lastActiveDate).toBe(before.lastActiveDate);
    expect(s.tdee).toBe(before.tdee);
    expect(s.planGoal).toBe(before.planGoal);
  });
});

// ── G. fallo remoto → reporta fallo, no declara RESET_OK, no muta local ──────
describe('G · fallo del borrado remoto', () => {
  it('si el DELETE remoto falla → throw y el estado local NO se toca', async () => {
    seedStore(true);
    const { sb, calls } = makeSupabase({ deleteError: { message: 'network down' } });
    const storage = makeStorage({ 'workout-player-progress': 'x' });

    await expect(
      resetTrainingHistoryForCurrentUser({ supabase: sb, storage }),
    ).rejects.toThrow(/DELETE workout_log failed/i);

    // No siguió al UPDATE
    expect(calls.updateFrom).toHaveLength(0);
    // No mutó local
    expect(useAppStore.getState().completedSessions).toHaveLength(1);
    expect(useAppStore.getState().pendingWorkoutSync).toHaveLength(1);
    expect(useAppStore.getState().dailyWorkout).not.toBeNull();
    // No tocó storage
    expect(storage.getItem('workout-player-progress')).toBe('x');
    // Guard liberado pese al throw
    expect(isWorkoutFlushSuspended()).toBe(false);
  });

  it('si el UPDATE remoto falla → throw (el DELETE ya corrió, pero no se declara OK)', async () => {
    seedStore(true);
    const { sb, calls } = makeSupabase({ updateError: { message: 'perms' } });
    await expect(
      resetTrainingHistoryForCurrentUser({ supabase: sb, storage: makeStorage() }),
    ).rejects.toThrow(/UPDATE user_profiles failed/i);
    expect(calls.deleteEq).toEqual([['workout_log', 'user_id', USER_ID]]);
    // No mutó local
    expect(useAppStore.getState().completedSessions).toHaveLength(1);
  });
});

// ── H. outbox pendiente no puede reaparecer tras el reset ────────────────────
describe('H · anti-carrera del outbox', () => {
  it('el flush está suspendido durante el reset y la cola queda vacía después', async () => {
    seedStore(true);
    const { sb } = makeSupabase();
    await resetTrainingHistoryForCurrentUser({ supabase: sb, storage: makeStorage() });

    // Cola vacía tras el reset
    expect(useAppStore.getState().pendingWorkoutSync).toHaveLength(0);
    // Un flush posterior no re-inserta nada (cola vacía → no toca Supabase)
    const r = await flushPendingWorkouts();
    expect(r.flushed).toBe(0);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('con el guard activo, flushPendingWorkouts NO reintenta aunque haya cola', async () => {
    // Cola con una fila del usuario + sesión activa
    useAppStore.setState({
      user: asUser(USER_ID),
      pendingWorkoutSync: [{ user_id: USER_ID, client_session_id: 's-x' } as unknown as PendingWorkoutRow],
    });
    suspendWorkoutFlush();
    const r = await flushPendingWorkouts();
    resumeWorkoutFlush();

    expect(r.flushed).toBe(0);
    expect(upsertSpy).not.toHaveBeenCalled();
    // La fila sigue en la cola (no se dequeó)
    expect(useAppStore.getState().pendingWorkoutSync).toHaveLength(1);
  });
});

// ── I. simulación reload/login → el merge no resucita sesiones ───────────────
describe('I · reload/login tras reset', () => {
  it('workout_log remoto vacío → merge deja completedSessions en [] y perf vacío', async () => {
    seedStore(true);
    const { sb } = makeSupabase();
    await resetTrainingHistoryForCurrentUser({ supabase: sb, storage: makeStorage() });

    // Simula la hidratación de App.tsx: remoto (workout_log borrado) = []
    const local = useAppStore.getState().completedSessions; // []
    const remoteSessions: CompletedSession[] = []; // DELETE dejó la tabla vacía para este user
    const { merged } = mergeWorkoutSessions(local, remoteSessions);

    expect(merged).toHaveLength(0);
    // lastExercisePerformance no se re-hidrata (no hay filas de las que reconstruir)
    expect(useAppStore.getState().lastExercisePerformance).toEqual({});
    // Y computeWeeklyCardio sobre el merge sigue en 0
    const wc = computeWeeklyCardio(merged, Date.UTC(2026, 7, 20));
    expect(wc.minutes7d).toBe(0);
    expect(wc.sessions7d).toBe(0);
  });
});
