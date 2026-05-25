import { describe, it, expect } from 'vitest';
import { shouldUseRemotePlan } from '../planSync';

// Cualquier objeto truthy sirve como "plan" — la función no inspecciona shape.
const PLAN = { generatedAt: '2026-05-26T12:00:00Z', mealPlanKey: 'planA' };
const T1 = '2026-05-26T10:00:00Z';
const T2 = '2026-05-26T11:00:00Z';

describe('shouldUseRemotePlan', () => {
  it('ambos null → noop', () => {
    expect(shouldUseRemotePlan(null, null, null, null)).toBe('noop');
  });

  it('local existe, remote null → use_local (backfill push)', () => {
    expect(shouldUseRemotePlan(PLAN, T1, null, null)).toBe('use_local');
  });

  it('remote existe, local null → use_remote (pull)', () => {
    expect(shouldUseRemotePlan(null, null, PLAN, T1)).toBe('use_remote');
  });

  it('ambos existen, remote más nuevo → use_remote', () => {
    expect(shouldUseRemotePlan(PLAN, T1, PLAN, T2)).toBe('use_remote');
  });

  it('ambos existen, local más nuevo → use_local (re-push para sincronizar)', () => {
    expect(shouldUseRemotePlan(PLAN, T2, PLAN, T1)).toBe('use_local');
  });

  it('ambos existen con mismo timestamp → noop', () => {
    expect(shouldUseRemotePlan(PLAN, T1, PLAN, T1)).toBe('noop');
  });

  it('ambos existen, timestamps null → noop (ambos = 0, iguales)', () => {
    expect(shouldUseRemotePlan(PLAN, null, PLAN, null)).toBe('noop');
  });

  it('ambos existen, solo remote tiene timestamp → use_remote (local = 0)', () => {
    expect(shouldUseRemotePlan(PLAN, null, PLAN, T1)).toBe('use_remote');
  });

  it('ambos existen, solo local tiene timestamp → use_local (remote = 0)', () => {
    expect(shouldUseRemotePlan(PLAN, T1, PLAN, null)).toBe('use_local');
  });

  it('timestamp inválido → tratado como 0 (NaN-safe)', () => {
    expect(shouldUseRemotePlan(PLAN, 'no-es-fecha', PLAN, T1)).toBe('use_remote');
  });
});
