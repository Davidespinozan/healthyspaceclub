import { describe, it, expect } from 'vitest';
import { shouldUseRemoteWorkout } from '../dailyWorkoutSync';

// Cualquier objeto truthy sirve — la función no inspecciona shape.
const W = { date: '2026-06-02', plan: {}, generatedAt: '2026-06-02T12:00:00Z' };
const T1 = '2026-06-02T10:00:00Z';
const T2 = '2026-06-02T11:00:00Z';

describe('shouldUseRemoteWorkout', () => {
  it('ambos null → noop', () => {
    expect(shouldUseRemoteWorkout(null, null, null, null)).toBe('noop');
  });

  it('local existe, remote null → use_local', () => {
    expect(shouldUseRemoteWorkout(W, T1, null, null)).toBe('use_local');
  });

  it('remote existe, local null → use_remote (pull)', () => {
    expect(shouldUseRemoteWorkout(null, null, W, T1)).toBe('use_remote');
  });

  it('ambos existen, remote más nuevo → use_remote', () => {
    expect(shouldUseRemoteWorkout(W, T1, W, T2)).toBe('use_remote');
  });

  it('ambos existen, local más nuevo → use_local', () => {
    expect(shouldUseRemoteWorkout(W, T2, W, T1)).toBe('use_local');
  });

  it('ambos existen con mismo timestamp → noop', () => {
    expect(shouldUseRemoteWorkout(W, T1, W, T1)).toBe('noop');
  });

  it('ambos existen, timestamps null → noop (ambos = 0)', () => {
    expect(shouldUseRemoteWorkout(W, null, W, null)).toBe('noop');
  });

  it('ambos existen, solo remote tiene timestamp → use_remote', () => {
    expect(shouldUseRemoteWorkout(W, null, W, T1)).toBe('use_remote');
  });

  it('ambos existen, solo local tiene timestamp → use_local', () => {
    expect(shouldUseRemoteWorkout(W, T1, W, null)).toBe('use_local');
  });

  it('timestamp inválido → tratado como 0 (NaN-safe)', () => {
    expect(shouldUseRemoteWorkout(W, 'no-es-fecha', W, T1)).toBe('use_remote');
  });
});
