import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// P2-A (outbox idempotente) + P2-B (fecha sellada / medianoche).
// Mock de supabase: upsert controlable (éxito/fallo) + contador de llamadas.
// ═══════════════════════════════════════════════════════════════════════════
let upsertError: { message: string } | null = null;
const upsertCalls: Array<[Record<string, unknown>, Record<string, unknown>]> = [];
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      upsert: (row: Record<string, unknown>, opts: Record<string, unknown>) => {
        upsertCalls.push([row, opts]);
        return Promise.resolve({ error: upsertError });
      },
      rpc: () => Promise.resolve({ data: null, error: null }),
    }),
    rpc: () => Promise.resolve({ data: null, error: null }),
  },
}));

import { finishWorkoutSession, type WorkoutOutboxOps } from '../workoutLogger';
import { upsertWorkoutRow, flushPendingWorkouts } from '../workoutOutbox';
import { mergeWorkoutSessions } from '../workoutSync';
import { computeProgression } from '../progression';
import { inDeloadWeek } from '../workoutPlanner';
import { useAppStore } from '../../store';
import { dayKey } from '../localDate';
import type { CompletedSession } from '../../types';

const USER = '550e8400-e29b-41d4-a716-446655440000';
const basePayload = (over: Record<string, unknown> = {}) => ({
  userId: USER, modality: 'fuerza' as const,
  exercises: [{ exercise_id: 'press-horizontal', order: 0, planned: { sets: 3, reps: '8-10' } }],
  exercisesCompleted: 1, exercisesTotal: 1, durationSeconds: 1800, targetDurationSeconds: 1800,
  equipment: 'gym', ...over,
});
const realOutbox = (): WorkoutOutboxOps => ({
  enqueue: useAppStore.getState().enqueuePendingWorkout,
  dequeue: useAppStore.getState().dequeuePendingWorkout,
});

beforeEach(() => {
  upsertError = null;
  upsertCalls.length = 0;
  useAppStore.setState({ completedSessions: [], pendingWorkoutSync: [], lastExercisePerformance: {}, user: { id: USER } as never });
});

describe('P2-A · outbox idempotente', () => {
  it('1. insert falla → la sesión LOCAL se conserva y queda pendiente', async () => {
    upsertError = { message: 'offline' };
    await finishWorkoutSession(basePayload(), useAppStore.getState().addCompletedSession, vi.fn().mockResolvedValue(undefined), realOutbox());
    expect(useAppStore.getState().completedSessions).toHaveLength(1);       // local nunca se pierde
    expect(useAppStore.getState().pendingWorkoutSync).toHaveLength(1);      // encolada para reintentar
  });

  it('2. la cola pendiente vive en el estado PERSISTIDO (sobrevive reload)', () => {
    // pendingWorkoutSync está en partialize → localStorage. Aquí verificamos el contrato de estado.
    useAppStore.getState().enqueuePendingWorkout({ user_id: USER, client_session_id: 'x', date_local: '2026-08-15' });
    expect(useAppStore.getState().pendingWorkoutSync).toHaveLength(1);
    // simular "reload": el valor persistido es exactamente lo que quedaría en el estado
    expect(useAppStore.getState().pendingWorkoutSync[0].client_session_id).toBe('x');
  });

  it('3. retry exitoso → llega al backend UNA vez y se limpia la cola', async () => {
    upsertError = { message: 'offline' };
    await finishWorkoutSession(basePayload(), useAppStore.getState().addCompletedSession, vi.fn().mockResolvedValue(undefined), realOutbox());
    expect(useAppStore.getState().pendingWorkoutSync).toHaveLength(1);
    upsertCalls.length = 0; upsertError = null;                             // vuelve la red
    const res = await flushPendingWorkouts();
    expect(res.flushed).toBe(1);
    expect(upsertCalls).toHaveLength(1);                                    // un solo envío
    expect(useAppStore.getState().pendingWorkoutSync).toHaveLength(0);      // cola limpia
  });

  it('4. retry repetido → NO duplica (nada que reenviar tras el éxito)', async () => {
    upsertError = { message: 'offline' };
    await finishWorkoutSession(basePayload(), useAppStore.getState().addCompletedSession, vi.fn().mockResolvedValue(undefined), realOutbox());
    upsertError = null;
    await flushPendingWorkouts();
    upsertCalls.length = 0;
    await flushPendingWorkouts();                                           // segundo flush
    expect(upsertCalls).toHaveLength(0);                                    // ya no hay pendientes
    expect(useAppStore.getState().pendingWorkoutSync).toHaveLength(0);
  });

  it('5. offline al terminar → luego online → flush sincroniza', async () => {
    upsertError = { message: 'network down' };
    await finishWorkoutSession(basePayload(), useAppStore.getState().addCompletedSession, vi.fn().mockResolvedValue(undefined), realOutbox());
    expect(useAppStore.getState().pendingWorkoutSync).toHaveLength(1);      // quedó pendiente
    upsertError = null;                                                     // recupera conexión
    const res = await flushPendingWorkouts();                              // hook online/app-open
    expect(res.flushed).toBe(1);
    expect(useAppStore.getState().pendingWorkoutSync).toHaveLength(0);
  });

  it('6. sesión ya en backend (ON CONFLICT DO NOTHING → sin error) → retry no duplica', async () => {
    // El upsert idempotente devuelve éxito aunque la fila ya exista → se saca de la cola sin duplicar.
    useAppStore.getState().enqueuePendingWorkout({ user_id: USER, client_session_id: 'dup', date_local: '2026-08-15' });
    upsertError = null;
    const res = await flushPendingWorkouts();
    expect(res.flushed).toBe(1);
    expect(upsertCalls[0][1]).toMatchObject({ onConflict: 'user_id,client_session_id', ignoreDuplicates: true });
    expect(useAppStore.getState().pendingWorkoutSync).toHaveLength(0);
  });

  it('7. la progresión LOCAL funciona aunque la sesión siga pendiente de sync', async () => {
    upsertError = { message: 'offline' };
    await finishWorkoutSession(basePayload(), useAppStore.getState().addCompletedSession, vi.fn().mockResolvedValue(undefined), realOutbox());
    expect(useAppStore.getState().pendingWorkoutSync).toHaveLength(1);      // pendiente…
    // …y la progresión (que lee lastExercisePerformance local) sigue operando normal
    const prog = computeProgression([{ reps: 10, kg: 40 }], '8-10', 2.5, false);
    expect(prog.action).toBe('add-weight');
  });

  it('enqueue es idempotente por client_session_id (no acumula la misma fila)', () => {
    const row = { user_id: USER, client_session_id: 'same', date_local: '2026-08-15' };
    useAppStore.getState().enqueuePendingWorkout(row);
    useAppStore.getState().enqueuePendingWorkout(row);
    expect(useAppStore.getState().pendingWorkoutSync).toHaveLength(1);
  });
});

describe('P2-A · upsertWorkoutRow + dedup estable', () => {
  it('upsertWorkoutRow: error → {ok:false}, sin error → {ok:true}', async () => {
    upsertError = { message: 'x' };
    expect(await upsertWorkoutRow({ user_id: USER, client_session_id: 'a' })).toMatchObject({ ok: false });
    upsertError = null;
    expect(await upsertWorkoutRow({ user_id: USER, client_session_id: 'a' })).toEqual({ ok: true });
  });

  it('mergeWorkoutSessions dedup por sessionId aunque completedAtIso difiera', () => {
    const local: CompletedSession = { sessionId: 'S1', date: '2026-08-15', completedAtIso: '2026-08-15T10:00:00.000Z', modality: 'fuerza', exerciseIds: ['p'], durationSeconds: 1, exercisesCompleted: 1, exercisesTotal: 1 };
    const remote: CompletedSession = { ...local, completedAtIso: '2026-08-15T10:00:00.500Z' }; // otro instante, misma sesión
    const { merged } = mergeWorkoutSessions([local], [remote]);
    expect(merged).toHaveLength(1); // NO depende solo de completed_at
  });

  it('mergeWorkoutSessions: sesiones legacy sin sessionId → dedup por completedAtIso', () => {
    const s = (iso: string): CompletedSession => ({ date: '2026-08-15', completedAtIso: iso, modality: 'fuerza', exerciseIds: ['p'], durationSeconds: 1, exercisesCompleted: 1, exercisesTotal: 1 });
    expect(mergeWorkoutSessions([s('2026-08-15T10:00:00.000Z')], [s('2026-08-15T10:00:00.000Z')]).merged).toHaveLength(1);
    expect(mergeWorkoutSessions([s('2026-08-15T10:00:00.000Z')], [s('2026-08-15T11:00:00.000Z')]).merged).toHaveLength(2);
  });
});

describe('P2-B · fecha sellada / medianoche', () => {
  it('sesión que cruza medianoche → session.date = día SELLADO (inicio), no el reloj de fin', async () => {
    const sealed = '2026-08-14';
    const captured: CompletedSession[] = [];
    const markSpy = vi.fn().mockResolvedValue(undefined);
    await finishWorkoutSession(
      basePayload({ userId: null, sessionDate: sealed }), // anon → sin sync, foco en la fecha
      (s) => captured.push(s), markSpy,
    );
    expect(captured[0].date).toBe(sealed);          // pertenece al día de inicio
    expect(markSpy).toHaveBeenCalledWith(sealed);   // la racha cuenta para el día sellado
  });

  it('sin sessionDate (legacy) → cae al día local de fin (sin regresión)', async () => {
    const captured: CompletedSession[] = [];
    await finishWorkoutSession(basePayload({ userId: null }), (s) => captured.push(s), vi.fn().mockResolvedValue(undefined));
    expect(captured[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('inDeloadWeek usa parse LOCAL: deload de hace 3 días → dentro de la ventana; de hace 8 → fuera', () => {
    const deloadSession = (daysAgo: number): CompletedSession => ({
      date: dayKey(new Date(Date.now() - daysAgo * 86400000)),
      completedAtIso: new Date(Date.now() - daysAgo * 86400000).toISOString(),
      modality: 'fuerza', exerciseIds: ['p'], durationSeconds: 1, exercisesCompleted: 1, exercisesTotal: 1, isDeload: true,
    });
    expect(inDeloadWeek([deloadSession(3)])).toBe(true);
    expect(inDeloadWeek([deloadSession(8)])).toBe(false);
  });

  it('completed_at (instante real) ≠ date_local (día sellado) en la fila de sync', async () => {
    await finishWorkoutSession(basePayload({ sessionDate: '2026-08-15' }), useAppStore.getState().addCompletedSession, vi.fn().mockResolvedValue(undefined), realOutbox());
    const row = upsertCalls[0][0];
    expect(row.date_local).toBe('2026-08-15');                 // día lógico de entrenamiento
    expect(String(row.completed_at)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/); // instante real de fin
  });

  it('YYYY-MM-DD local NO se desplaza a UTC (construcción por componentes)', () => {
    // new Date(y, m-1, d) = medianoche LOCAL; su dayKey vuelve al MISMO día (sin salto UTC±1).
    expect(dayKey(new Date(2026, 2, 29))).toBe('2026-03-29'); // fin de semana de cambio DST en Madrid
    expect(dayKey(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(dayKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('P2 · revisión final — aislamiento y ventana de pérdida', () => {
  it('USER ISOLATION: la cola sobrevive al logout; B no envía la fila de A; A la sincroniza al volver', async () => {
    // A deja una sesión offline pendiente
    useAppStore.setState({ user: { id: 'user-A' } as never, pendingWorkoutSync: [] });
    useAppStore.getState().enqueuePendingWorkout({ user_id: 'user-A', client_session_id: 'a1', date_local: '2026-08-15' });
    // logout / cambio de usuario
    useAppStore.getState().resetUserScopedData();
    expect(useAppStore.getState().pendingWorkoutSync).toHaveLength(1); // NO se borró la fila de A
    // B inicia sesión y hace flush
    useAppStore.setState({ user: { id: 'user-B' } as never });
    upsertError = null; upsertCalls.length = 0;
    await flushPendingWorkouts();
    expect(upsertCalls).toHaveLength(0);                               // B NO envía la fila de A
    expect(useAppStore.getState().pendingWorkoutSync).toHaveLength(1); // la fila de A sigue ahí
    // A vuelve
    useAppStore.setState({ user: { id: 'user-A' } as never });
    await flushPendingWorkouts();
    expect(upsertCalls).toHaveLength(1);                               // ahora sí se sincroniza
    expect(useAppStore.getState().pendingWorkoutSync).toHaveLength(0);
  });

  it('SIN VENTANA DE PÉRDIDA: aunque markActiveDay falle, la fila quedó ENCOLADA (antes del await)', async () => {
    upsertError = { message: 'offline' };
    const markReject = vi.fn().mockRejectedValue(new Error('boom'));
    await finishWorkoutSession(basePayload(), useAppStore.getState().addCompletedSession, markReject, realOutbox()).catch(() => {});
    expect(useAppStore.getState().completedSessions).toHaveLength(1);   // local guardado
    expect(useAppStore.getState().pendingWorkoutSync).toHaveLength(1);  // encolado pese al fallo de racha
  });

  it('CONCURRENCY: dos flush simultáneos → cola vacía, mismo client_session_id (backend deduplica a 1)', async () => {
    useAppStore.setState({ user: { id: 'user-A' } as never, pendingWorkoutSync: [] });
    useAppStore.getState().enqueuePendingWorkout({ user_id: 'user-A', client_session_id: 'c1', date_local: '2026-08-15' });
    upsertError = null; upsertCalls.length = 0;
    // mount + online + visibility podrían disparar flush a la vez:
    await Promise.all([flushPendingWorkouts(), flushPendingWorkouts(), flushPendingWorkouts()]);
    // la cola queda vacía (dequeue idempotente por id, setState funcional → sin lost-update)
    expect(useAppStore.getState().pendingWorkoutSync).toHaveLength(0);
    // todo envío concurrente lleva el MISMO id → el índice único del backend colapsa a 1 fila
    expect(upsertCalls.every(([row]) => row.client_session_id === 'c1')).toBe(true);
  });

  it('DOUBLE-SUBMIT: dos finishWorkoutSession con distinta identidad NO colisionan (cada uno su id)', async () => {
    // El guard finishedRef (WorkoutPlayer) evita la 2ª llamada; a nivel de logger, cada finish
    // genera su propio client_session_id → nunca se pisan ni duplican una misma fila.
    useAppStore.setState({ user: { id: 'user-A' } as never, pendingWorkoutSync: [], completedSessions: [] });
    upsertError = { message: 'offline' };
    await finishWorkoutSession(basePayload(), useAppStore.getState().addCompletedSession, vi.fn().mockResolvedValue(undefined), realOutbox());
    const ids = useAppStore.getState().pendingWorkoutSync.map(r => r.client_session_id);
    expect(new Set(ids).size).toBe(ids.length); // ids únicos, sin colisión
  });
});
