import { describe, it, expect, beforeEach } from 'vitest';
import {
  USER_SCOPED_STANDALONE_KEYS,
  purgeUserScopedStandaloneKeys,
} from '../accountIsolation';
import {
  enqueueReflection,
  flushHSMOutbox,
  readOutbox,
  isFlushableFor,
  type QueuedReflection,
} from '../hsmOutbox';
import { resumeBlobBelongsTo } from '../workoutSession';
import { useAppStore } from '../../store';
import type { HSMReflection } from '../hsmRepository';

// ═══════════════════════════════════════════════════════════════════════════
// ACCOUNT-ISOLATION-1 · una cuenta B en el mismo dispositivo nunca hereda estado
// standalone de A: purga de llaves, sello de dueño en outbox HSM, resume del player.
// ═══════════════════════════════════════════════════════════════════════════

const OUTBOX_KEY = 'hsc-hsm-outbox';
const mk = (over: Partial<HSMReflection> = {}): HSMReflection => ({
  date: '2026-08-01', dimensionId: 'body', questionIndex: 1, questionKey: 'body#1',
  question: 'q', response: 'texto privado de journal', safetyLevel: 'NORMAL', ...over,
});
const okUpsert = async () => true;

// ── §2 · purga de llaves standalone ──────────────────────────────────────────
describe('purgeUserScopedStandaloneKeys', () => {
  it('remueve TODAS las llaves standalone per-usuario', () => {
    const removed: string[] = [];
    const storage = { removeItem: (k: string) => { removed.push(k); } };
    const out = purgeUserScopedStandaloneKeys(storage);
    expect(out).toEqual([...USER_SCOPED_STANDALONE_KEYS]);
    expect(removed).toEqual([...USER_SCOPED_STANDALONE_KEYS]);
  });

  it('incluye el outbox HSM y las llaves de sesión de entreno', () => {
    for (const k of ['hsc-hsm-outbox', 'workout-player-progress', 'yoga-flow-progress',
      'day-complete-celebrated', 'hsc_session_min', 'hsc_priority_muscles']) {
      expect(USER_SCOPED_STANDALONE_KEYS as readonly string[]).toContain(k);
    }
  });

  it('NUNCA toca pendingWorkoutSync (particionado por user_id, sobrevive al logout)', () => {
    expect(USER_SCOPED_STANDALONE_KEYS as readonly string[]).not.toContain('pendingWorkoutSync');
    const removed: string[] = [];
    purgeUserScopedStandaloneKeys({ removeItem: (k: string) => { removed.push(k); } });
    expect(removed).not.toContain('pendingWorkoutSync');
  });

  it('no toca prefs app-wide (idioma) ni el blob persistido', () => {
    const removed: string[] = [];
    purgeUserScopedStandaloneKeys({ removeItem: (k: string) => { removed.push(k); } });
    expect(removed).not.toContain('hsc-store');
    expect(removed.some(k => k.includes('language'))).toBe(false);
  });

  it('es tolerante: un removeItem que lanza no rompe la purga', () => {
    const storage = { removeItem: (k: string) => { if (k === 'workout-player-progress') throw new Error('denied'); } };
    expect(() => purgeUserScopedStandaloneKeys(storage)).not.toThrow();
  });

  it('storage null (entorno sin localStorage) → no-op', () => {
    expect(purgeUserScopedStandaloneKeys(null)).toEqual([]);
  });
});

// ── §3 · HSM outbox: sello de dueño + invariante A→B ─────────────────────────
describe('HSM outbox ownership (isFlushableFor)', () => {
  it('con ownerId definido: solo ítems del mismo dueño', () => {
    expect(isFlushableFor({ ...mk(), ownerId: 'A' } as QueuedReflection, 'A')).toBe(true);
    expect(isFlushableFor({ ...mk(), ownerId: 'A' } as QueuedReflection, 'B')).toBe(false);
  });
  it('con ownerId definido: ítem legacy (sin sello) NO se flushea', () => {
    expect(isFlushableFor(mk() as QueuedReflection, 'B')).toBe(false);
  });
  it('sin ownerId (undefined): solo ítems legacy (compat)', () => {
    expect(isFlushableFor(mk() as QueuedReflection, undefined)).toBe(true);
    expect(isFlushableFor({ ...mk(), ownerId: 'A' } as QueuedReflection, undefined)).toBe(false);
  });
});

describe('HSM outbox flush por dueño (localStorage real)', () => {
  beforeEach(() => { try { localStorage.removeItem(OUTBOX_KEY); } catch { /* noop */ } });

  it('INVARIANTE: reflexión pendiente de A NUNCA se escribe como B', async () => {
    // A encola offline; el flush falla (queda pendiente sellado con A).
    enqueueReflection(mk({ response: 'journal de A' }), 'userA');
    expect(readOutbox()[0].ownerId).toBe('userA');

    // B inicia sesión en el MISMO dispositivo y flushea como B.
    const written: string[] = [];
    const res = await flushHSMOutbox(async (r) => { written.push(r.response); return true; }, 'userB');

    // Cero escrituras: el ítem de A no se tocó, se conserva intacto.
    expect(written).toEqual([]);
    expect(res.flushed).toBe(0);
    expect(readOutbox()).toHaveLength(1);
    expect(readOutbox()[0].ownerId).toBe('userA');
  });

  it('mismo dueño: SÍ flushea y vacía', async () => {
    enqueueReflection(mk(), 'userA');
    const res = await flushHSMOutbox(okUpsert, 'userA');
    expect(res.flushed).toBe(1);
    expect(readOutbox()).toHaveLength(0);
  });

  it('cola mixta: flushea solo lo de B, conserva lo de A', async () => {
    enqueueReflection(mk({ questionKey: 'a#1', response: 'de A' }), 'userA');
    enqueueReflection(mk({ questionKey: 'b#1', response: 'de B' }), 'userB');
    const written: string[] = [];
    const res = await flushHSMOutbox(async (r) => { written.push(r.response); return true; }, 'userB');
    expect(written).toEqual(['de B']);
    expect(res.flushed).toBe(1);
    const rest = readOutbox();
    expect(rest).toHaveLength(1);
    expect(rest[0].ownerId).toBe('userA');
  });

  it('legacy sin sello + llamada sin dueño (compat): se flushea', async () => {
    enqueueReflection(mk()); // sin ownerId
    const res = await flushHSMOutbox(okUpsert); // sin ownerId
    expect(res.flushed).toBe(1);
    expect(readOutbox()).toHaveLength(0);
  });

  it('fallo de red conserva el ítem (sellado) para reintento del mismo dueño', async () => {
    enqueueReflection(mk(), 'userA');
    const res = await flushHSMOutbox(async () => false, 'userA');
    expect(res.flushed).toBe(0);
    expect(readOutbox()).toHaveLength(1);
    expect(readOutbox()[0].ownerId).toBe('userA');
  });
});

// ── §2b · resetUserScopedData purga de verdad (integración con el store) ─────
describe('resetUserScopedData · frontera de cuenta (integración store)', () => {
  it('purga llaves standalone (incl. outbox HSM y resume del player), preserva pendingWorkoutSync', () => {
    // Seed: estado de la cuenta A en el dispositivo.
    for (const k of USER_SCOPED_STANDALONE_KEYS) localStorage.setItem(k, 'de-A');
    localStorage.setItem('pendingWorkoutSync', JSON.stringify([{ client_session_id: 's1', user_id: 'A' }]));
    localStorage.setItem('language', 'es'); // pref app-wide

    // Frontera de cuenta: reset per-usuario (lo que corre en SIGNED_OUT y SIGNED_IN mismatch).
    useAppStore.getState().resetUserScopedData();

    // Todas las standalone per-usuario desaparecen.
    for (const k of USER_SCOPED_STANDALONE_KEYS) expect(localStorage.getItem(k)).toBeNull();
    // El outbox de entrenos (particionado por user_id) SOBREVIVE para entrega futura.
    expect(localStorage.getItem('pendingWorkoutSync')).not.toBeNull();
    // Pref app-wide intacta.
    expect(localStorage.getItem('language')).toBe('es');
    // Estado en memoria del usuario se limpió.
    expect(useAppStore.getState().dailyHSMResponses).toEqual([]);
  });
});

// ── §4 · WorkoutPlayer resume ownership ──────────────────────────────────────
describe('resumeBlobBelongsTo (resume del player fail-closed)', () => {
  const blob = (ownerId: unknown) => ({ version: 2, ownerId, currentStep: 3, loggedByExercise: [] });

  it('mismo dueño → resume', () => {
    expect(resumeBlobBelongsTo(blob('userA'), 'userA')).toBe(true);
  });
  it('dueño distinto → NO resume', () => {
    expect(resumeBlobBelongsTo(blob('userA'), 'userB')).toBe(false);
  });
  it('legacy sin ownerId → NO resume (fail-closed)', () => {
    expect(resumeBlobBelongsTo(blob(undefined), 'userB')).toBe(false);
    expect(resumeBlobBelongsTo({ version: 2, currentStep: 1 }, 'userB')).toBe(false);
  });
  it('usuario actual null (sin sesión) → nunca resume', () => {
    expect(resumeBlobBelongsTo(blob('userA'), null)).toBe(false);
    expect(resumeBlobBelongsTo(blob(null), null)).toBe(false);
  });
  it('malformado → NO resume', () => {
    expect(resumeBlobBelongsTo(null, 'userA')).toBe(false);
    expect(resumeBlobBelongsTo('nope', 'userA')).toBe(false);
    expect(resumeBlobBelongsTo({ ownerId: 123 }, 'userA')).toBe(false);
    expect(resumeBlobBelongsTo({ ownerId: '' }, '')).toBe(false); // string vacío nunca hace match
  });
});
