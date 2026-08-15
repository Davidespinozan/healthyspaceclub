import { describe, it, expect } from 'vitest';
import { validateWorkout, type CachedWorkout } from '../workoutCache';

// MUTATION / ADVERSARIAL · validateWorkout debe rechazar números inválidos que entran desde la IA.
// `typeof x === 'number'` es LAX (NaN/Infinity/negativos lo pasan) → se endureció el campo `sets`.
const validIds = new Set(['press-horizontal', 'curl-pie']);
const wk = (sets: unknown, reps: unknown = '8-10', id = 'press-horizontal'): CachedWorkout =>
  ({ exercises: [{ id, sets, reps }] }) as unknown as CachedWorkout;

describe('validateWorkout · hardening numérico de sets', () => {
  it('sets válido (3) → accept', () => expect(validateWorkout(wk(3), validIds)).toBe(true));
  it('sets NaN → reject', () => expect(validateWorkout(wk(NaN), validIds)).toBe(false));
  it('sets Infinity → reject', () => expect(validateWorkout(wk(Infinity), validIds)).toBe(false));
  it('sets -Infinity → reject', () => expect(validateWorkout(wk(-Infinity), validIds)).toBe(false));
  it('sets -3 (negativo) → reject', () => expect(validateWorkout(wk(-3), validIds)).toBe(false));
  it('sets 0 → reject', () => expect(validateWorkout(wk(0), validIds)).toBe(false));
  it('sets "3" (string) → reject', () => expect(validateWorkout(wk('3'), validIds)).toBe(false));

  it('reps vacío "" → reject (no es una prescripción real)', () => expect(validateWorkout(wk(3, ''), validIds)).toBe(false));
  it('reps "   " (solo espacios) → reject', () => expect(validateWorkout(wk(3, '   '), validIds)).toBe(false));
  it('reps número → reject', () => expect(validateWorkout(wk(3, 10), validIds)).toBe(false));

  it('id fuera del banco con sets válido → reject', () => expect(validateWorkout(wk(3, '8-10', 'no-existe'), validIds)).toBe(false));
  it('exercises no-array → reject', () => expect(validateWorkout({ exercises: 'x' } as unknown as CachedWorkout, validIds)).toBe(false));
  it('exercises vacío → reject', () => expect(validateWorkout({ exercises: [] } as unknown as CachedWorkout, validIds)).toBe(false));
  it('un ejercicio válido + uno con sets NaN → reject (every)', () => {
    const w = { exercises: [{ id: 'press-horizontal', sets: 3, reps: '8-10' }, { id: 'curl-pie', sets: NaN, reps: '8-10' }] } as unknown as CachedWorkout;
    expect(validateWorkout(w, validIds)).toBe(false);
  });
});
