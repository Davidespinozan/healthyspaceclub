import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// WORKOUT-OUTBOX-RESILIENCE-1 (M-3) · reintento acotado + cuarentena del outbox.
// Mock de supabase con error+CÓDIGO controlable; spy de analytics para el evento.
// ═══════════════════════════════════════════════════════════════════════════
let upsertError: { code?: string; message?: string } | null = null;
const upsertCalls: Array<Record<string, unknown>> = [];
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      upsert: (row: Record<string, unknown>) => { upsertCalls.push(row); return Promise.resolve({ error: upsertError }); },
    }),
  },
}));
const trackSpy = vi.fn();
vi.mock('../analytics', () => ({ track: (...a: unknown[]) => trackSpy(...a), identify: () => {} }));

import {
  upsertWorkoutRow, flushPendingWorkouts, isPermanentSyncError,
  WORKOUT_SYNC_MAX_ATTEMPTS, PERMANENT_SYNC_CODES,
} from '../workoutOutbox';
import { useAppStore } from '../../store';

const A = 'user-A';
const B = 'user-B';
const row = (user: string, id: string) => ({ user_id: user, client_session_id: id, date_local: '2026-08-26' });
const meta = (id: string) => useAppStore.getState().pendingWorkoutMeta[id];
const queueLen = () => useAppStore.getState().pendingWorkoutSync.length;

beforeEach(() => {
  upsertError = null; upsertCalls.length = 0; trackSpy.mockClear();
  useAppStore.setState({ user: { id: A } as never, pendingWorkoutSync: [], pendingWorkoutMeta: {}, completedSessions: [] });
});

// ── clasificación pura ───────────────────────────────────────────────────────
describe('isPermanentSyncError (conservador)', () => {
  it('permanentes: 23503, 23502, PGRST204', () => {
    for (const c of ['23503', '23502', 'PGRST204']) expect(isPermanentSyncError(c)).toBe(true);
    expect([...PERMANENT_SYNC_CODES].sort()).toEqual(['23502', '23503', 'PGRST204']);
  });
  it('42501 (RLS/sesión) NO es permanente; undefined/red tampoco', () => {
    expect(isPermanentSyncError('42501')).toBe(false);
    expect(isPermanentSyncError(undefined)).toBe(false);
    expect(isPermanentSyncError('08006')).toBe(false);
  });
});

describe('upsertWorkoutRow result', () => {
  it('éxito → {ok:true}; error con code → {ok:false, code}', async () => {
    upsertError = null;
    expect(await upsertWorkoutRow(row(A, 'x'))).toEqual({ ok: true });
    upsertError = { code: '23503', message: 'fk' };
    expect(await upsertWorkoutRow(row(A, 'x'))).toEqual({ ok: false, code: '23503' });
  });
});

// ── política de reintento / cuarentena ───────────────────────────────────────
describe('flush · política acotada', () => {
  const seed = (id = 'c1', user = A) => useAppStore.getState().enqueuePendingWorkout(row(user, id));

  it('A · falla transitoria una vez → fila retenida, attempts=1, no cuarentena', async () => {
    seed(); upsertError = { message: 'net' }; // sin code → retryable
    await flushPendingWorkouts();
    expect(queueLen()).toBe(1);
    expect(meta('c1')).toMatchObject({ attempts: 1, quarantined: false });
  });

  it('B · transitoria luego éxito → desencolada y meta removida', async () => {
    seed(); upsertError = { message: 'net' }; await flushPendingWorkouts();
    upsertError = null; await flushPendingWorkouts();
    expect(queueLen()).toBe(0);
    expect(meta('c1')).toBeUndefined();
  });

  it('C · 23503 (FK) → cuarentena inmediata, fila retenida', async () => {
    seed(); upsertError = { code: '23503' }; await flushPendingWorkouts();
    expect(queueLen()).toBe(1);
    expect(meta('c1')).toMatchObject({ attempts: 1, quarantined: true, lastCode: '23503' });
  });
  it('D · 23502 (NOT NULL) → cuarentena inmediata', async () => {
    seed(); upsertError = { code: '23502' }; await flushPendingWorkouts();
    expect(meta('c1')?.quarantined).toBe(true);
  });
  it('E · PGRST204 (columna desconocida) → cuarentena inmediata', async () => {
    seed(); upsertError = { code: 'PGRST204' }; await flushPendingWorkouts();
    expect(meta('c1')?.quarantined).toBe(true);
  });
  it('F · 42501 → NO permanente, sigue el camino acotado (attempts=1, no cuarentena)', async () => {
    seed(); upsertError = { code: '42501' }; await flushPendingWorkouts();
    expect(meta('c1')).toMatchObject({ attempts: 1, quarantined: false, lastCode: '42501' });
  });
  it('G · fallo sin code → retryable', async () => {
    seed(); upsertError = { message: 'boom' }; await flushPendingWorkouts();
    expect(meta('c1')?.quarantined).toBe(false);
  });

  it('H/I · MAX-1 fallas no cuarentena; la MAX-ésima sí', async () => {
    seed(); upsertError = { message: 'net' };
    for (let i = 0; i < WORKOUT_SYNC_MAX_ATTEMPTS - 1; i++) await flushPendingWorkouts();
    expect(meta('c1')).toMatchObject({ attempts: WORKOUT_SYNC_MAX_ATTEMPTS - 1, quarantined: false });
    await flushPendingWorkouts(); // la MAX-ésima
    expect(meta('c1')).toMatchObject({ attempts: WORKOUT_SYNC_MAX_ATTEMPTS, quarantined: true });
  });

  it('J · fila en cuarentena → el siguiente flush hace CERO upserts', async () => {
    seed(); upsertError = { code: '23503' }; await flushPendingWorkouts();
    const callsAfterQuarantine = upsertCalls.length;
    await flushPendingWorkouts();
    await flushPendingWorkouts();
    expect(upsertCalls.length).toBe(callsAfterQuarantine); // no crecieron
    expect(queueLen()).toBe(1); // fila sigue retenida (recuperable)
  });

  it('K · la cuarentena SOBREVIVE un reload (meta en partialize) → sigue skippeada', async () => {
    seed(); upsertError = { code: '23503' }; await flushPendingWorkouts();
    // simula reload: reinyecta SOLO lo persistido (cola + meta), limpia lo demás.
    const persisted = { pendingWorkoutSync: useAppStore.getState().pendingWorkoutSync, pendingWorkoutMeta: useAppStore.getState().pendingWorkoutMeta };
    useAppStore.setState({ ...persisted, user: { id: A } as never });
    upsertCalls.length = 0; upsertError = null;
    await flushPendingWorkouts();
    expect(upsertCalls.length).toBe(0); // sigue en cuarentena tras "reload"
    expect(meta('c1')?.quarantined).toBe(true);
  });

  it('L · fila legacy sin meta → attempts=0/no cuarentena → se intenta normal', async () => {
    seed(); // sin meta previa
    expect(meta('c1')).toBeUndefined();
    upsertError = null; await flushPendingWorkouts();
    expect(queueLen()).toBe(0); // se sincronizó como siempre
  });

  it('P · éxito eventual → sin duplicado, cola y meta limpias', async () => {
    seed(); upsertError = { message: 'net' }; await flushPendingWorkouts();
    upsertError = null; await flushPendingWorkouts();
    expect(queueLen()).toBe(0); expect(meta('c1')).toBeUndefined();
    expect(upsertCalls.filter(r => r.client_session_id === 'c1').length).toBe(2); // 1 falla + 1 éxito, sin más
  });

  it('Q · lost-ACK (fila ya en backend → upsert sin error) → desencola seguro', async () => {
    seed(); upsertError = null; await flushPendingWorkouts(); // ON CONFLICT DO NOTHING → ok
    expect(queueLen()).toBe(0);
  });

  it('T · la cuarentena NO toca completedSessions', async () => {
    useAppStore.setState({ completedSessions: [{ sessionId: 's1', date: '2026-08-26', modality: 'fuerza', exerciseIds: [] } as never] });
    seed(); upsertError = { code: '23503' }; await flushPendingWorkouts();
    expect(useAppStore.getState().completedSessions).toHaveLength(1);
  });
});

// ── observabilidad segura ────────────────────────────────────────────────────
describe('S · evento workout_sync_stuck una sola vez y sin PII', () => {
  it('se emite exactamente una vez al entrar en cuarentena, con solo {attempts, code}', async () => {
    useAppStore.getState().enqueuePendingWorkout(row(A, 'c1'));
    upsertError = { code: '23503' };
    await flushPendingWorkouts(); // cuarentena
    await flushPendingWorkouts(); // skip
    await flushPendingWorkouts(); // skip
    const stuck = trackSpy.mock.calls.filter(([e]) => e === 'workout_sync_stuck');
    expect(stuck).toHaveLength(1);
    expect(stuck[0][1]).toEqual({ attempts: 1, code: '23503' });
    // sin PII: ni user_id ni client_session_id ni payload
    expect(JSON.stringify(stuck[0][1])).not.toContain('user');
    expect(JSON.stringify(stuck[0][1])).not.toContain('c1');
  });
});

// ── ACCOUNT-ISOLATION ────────────────────────────────────────────────────────
describe('M/N/O · aislamiento cross-cuenta del sidecar', () => {
  it('poison row de A + B logueado → cero intentos contra la fila de A; meta de A intacta', async () => {
    // A deja una fila en cuarentena
    useAppStore.setState({ user: { id: A } as never });
    useAppStore.getState().enqueuePendingWorkout(row(A, 'cA'));
    upsertError = { code: '23503' }; await flushPendingWorkouts();
    expect(meta('cA')?.quarantined).toBe(true);
    const aMetaBefore = JSON.stringify(meta('cA'));

    // B inicia sesión (la fila de A sobrevive, particionada por user_id)
    useAppStore.setState({ user: { id: B } as never });
    useAppStore.getState().enqueuePendingWorkout(row(B, 'cB'));
    upsertCalls.length = 0; upsertError = null;
    await flushPendingWorkouts();
    // solo se intentó la fila de B; la de A jamás
    expect(upsertCalls.every(r => r.client_session_id === 'cB')).toBe(true);
    expect(upsertCalls.some(r => r.client_session_id === 'cA')).toBe(false);
    // meta de A intacta; la de B es independiente
    expect(JSON.stringify(meta('cA'))).toBe(aMetaBefore);
    expect(meta('cB')).toBeUndefined(); // se sincronizó (éxito) → sin meta

    // A vuelve → su cuarentena sigue coherente
    useAppStore.setState({ user: { id: A } as never });
    expect(meta('cA')?.quarantined).toBe(true);
  });
});

// ── concurrencia (single-flight) ─────────────────────────────────────────────
describe('R · flushes solapados', () => {
  it('tres flush simultáneos → sin estado corrupto, un solo camino, cola vacía', async () => {
    useAppStore.getState().enqueuePendingWorkout(row(A, 'c1'));
    upsertError = null; upsertCalls.length = 0;
    await Promise.all([flushPendingWorkouts(), flushPendingWorkouts(), flushPendingWorkouts()]);
    expect(queueLen()).toBe(0);
    // single-flight: la fila se intentó una sola vez (no 3)
    expect(upsertCalls.filter(r => r.client_session_id === 'c1')).toHaveLength(1);
  });
});
