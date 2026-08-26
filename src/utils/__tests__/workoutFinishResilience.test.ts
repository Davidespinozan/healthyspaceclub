import { describe, it, expect, beforeEach } from 'vitest';
import { clearResumeAfterCommit, resumeBlobBelongsTo } from '../workoutSession';

// ═══════════════════════════════════════════════════════════════════════════
// WORKOUT-FINISH-RESILIENCE-1 (M-2) · el breadcrumb de resume se borra SOLO tras
// una finalización local exitosa. Un fallo síncrono pre-durabilidad lo conserva →
// la sesión terminada nunca se pierde junto con su resume.
// ═══════════════════════════════════════════════════════════════════════════

const PROGRESS_KEY = 'workout-player-progress';
const YOGA_KEY = 'yoga-flow-progress';
const ownedBlob = (owner: string) =>
  JSON.stringify({ version: 2, ownerId: owner, workoutDate: '2026-08-26', planHash: 'a,b,c', currentStep: 4, loggedByExercise: [] });

describe('clearResumeAfterCommit · orden y throw-safety', () => {
  it('éxito: corre commit y LUEGO clearResume, en ese orden', () => {
    const order: string[] = [];
    clearResumeAfterCommit(() => order.push('commit'), () => order.push('clear'));
    expect(order).toEqual(['commit', 'clear']); // onComplete antes de remove-progress
  });

  it('commit lanza síncronamente → clearResume NUNCA corre y el throw se propaga', () => {
    let cleared = false;
    expect(() =>
      clearResumeAfterCommit(
        () => { throw new Error('pre-durability boom'); },
        () => { cleared = true; },
      ),
    ).toThrow('pre-durability boom');
    expect(cleared).toBe(false); // breadcrumb intacto
  });
});

describe('M-2 invariante con localStorage real · workout-player-progress', () => {
  beforeEach(() => { try { localStorage.removeItem(PROGRESS_KEY); } catch { /* noop */ } });

  it('onComplete lanza pre-durabilidad → breadcrumb SOBREVIVE con ownerId intacto', () => {
    localStorage.setItem(PROGRESS_KEY, ownedBlob('userA'));
    expect(() =>
      clearResumeAfterCommit(
        () => { throw new Error('addCompletedSession failed'); }, // simula fallo síncrono en onComplete
        () => localStorage.removeItem(PROGRESS_KEY),
      ),
    ).toThrow();
    const raw = localStorage.getItem(PROGRESS_KEY);
    expect(raw).not.toBeNull();                    // breadcrumb NO se perdió
    const d = JSON.parse(raw!);
    expect(d.ownerId).toBe('userA');               // sello de dueño intacto (ACCOUNT-ISOLATION)
    expect(resumeBlobBelongsTo(d, 'userA')).toBe(true);  // el mismo dueño puede retomar
    expect(resumeBlobBelongsTo(d, 'userB')).toBe(false); // ajeno sigue rechazado
  });

  it('onComplete exitoso → breadcrumb se elimina', () => {
    localStorage.setItem(PROGRESS_KEY, ownedBlob('userA'));
    clearResumeAfterCommit(() => { /* commit local ok */ }, () => localStorage.removeItem(PROGRESS_KEY));
    expect(localStorage.getItem(PROGRESS_KEY)).toBeNull();
  });

  it('ninguna llamada a localStorage.clear() (solo removeItem puntual)', () => {
    // Sanidad: el helper no toca prefs app-wide.
    localStorage.setItem('language', 'es');
    localStorage.setItem(PROGRESS_KEY, ownedBlob('userA'));
    clearResumeAfterCommit(() => {}, () => localStorage.removeItem(PROGRESS_KEY));
    expect(localStorage.getItem('language')).toBe('es');
  });
});

describe('M-2 invariante con localStorage real · yoga-flow-progress', () => {
  beforeEach(() => { try { localStorage.removeItem(YOGA_KEY); } catch { /* noop */ } });

  it('onComplete lanza → yoga-flow-progress SOBREVIVE', () => {
    localStorage.setItem(YOGA_KEY, JSON.stringify({ pose: 3 }));
    expect(() =>
      clearResumeAfterCommit(() => { throw new Error('boom'); }, () => localStorage.removeItem(YOGA_KEY)),
    ).toThrow();
    expect(localStorage.getItem(YOGA_KEY)).not.toBeNull();
  });

  it('onComplete exitoso → yoga-flow-progress se elimina', () => {
    localStorage.setItem(YOGA_KEY, JSON.stringify({ pose: 3 }));
    clearResumeAfterCommit(() => {}, () => localStorage.removeItem(YOGA_KEY));
    expect(localStorage.getItem(YOGA_KEY)).toBeNull();
  });
});
