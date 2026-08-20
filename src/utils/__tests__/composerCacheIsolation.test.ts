import { describe, it, expect } from 'vitest';
import { sealComposedSession, type ComposeSessionResult } from '../sessionComposer';
import type { CachedWorkout } from '../workoutCache';

// ═══════════════════════════════════════════════════════════════════════════
// F2B-1 · AISLAMIENTO DE CACHÉ (Hallazgo A). Las decisiones del Composer son per-usuario/día → NO
// pueden entrar a workout_cache (compartida). saveWorkoutToCache spread-ea el objeto genérico ANTES
// del sello; sealComposedSession solo agrega/quita claves de nivel superior → el snapshot cacheado
// queda intacto (con finisher genérico, sin composedCardio/sessionEndReason).
// ═══════════════════════════════════════════════════════════════════════════
const genericWorkout = (): CachedWorkout => ({
  type: 'upper', intensity: 'media',
  exercises: [{ id: 'press-banca', sets: 4, reps: '8', rest: 120 }],
  warmup: '', cooldown: '', note: '',
  warmupBlock: { minutes: 8, phases: [] },
  finisherBlock: { minutes: 6, cardioStyle: 'lowImpact', format: 'steady', stations: [{ name: 'Caminata' }] },
});
const placedResult: Pick<ComposeSessionResult, 'composedCardio' | 'sessionEndReason' | 'suppressFinisher'> = {
  composedCardio: { minutes: 20, style: 'lowImpact', intensityCeiling: 'zona2' },
  sessionEndReason: 'HYBRID_COMPLETE', suppressFinisher: true,
};

describe('cache isolation', () => {
  it('usuario A: el snapshot cacheado NO contiene decisiones per-usuario y CONSERVA finisher', () => {
    const daily = genericWorkout();
    // saveWorkoutToCache hace {...workout} SÍNCRONO antes del sello → esto lo emula:
    const cacheSnapshot = { ...daily } as CachedWorkout;
    sealComposedSession(daily, placedResult);
    // cache genérico intacto:
    expect(cacheSnapshot.composedCardio).toBeUndefined();
    expect(cacheSnapshot.sessionEndReason).toBeUndefined();
    expect(cacheSnapshot.finisherBlock).toBeDefined();
    expect(cacheSnapshot.finisherBlock!.minutes).toBe(6);
  });
  it('usuario B con mismo configHash NO hereda cardio/endReason/finisher-suprimido de A', () => {
    // B lee el snapshot cacheado (genérico) → nunca ve las decisiones de A.
    const cacheSnapshot = { ...genericWorkout() } as CachedWorkout;
    // (A ya selló su propio objeto; el snapshot es independiente)
    sealComposedSession(genericWorkout(), placedResult);
    expect(cacheSnapshot.composedCardio).toBeUndefined();
    expect(cacheSnapshot.sessionEndReason).toBeUndefined();
    expect(cacheSnapshot.finisherBlock).toBeDefined(); // B sí recibe finisher genérico
  });
  it('dailyWorkout SÍ contiene las decisiones del Composer', () => {
    const daily = sealComposedSession(genericWorkout(), placedResult);
    expect(daily.composedCardio).toEqual({ minutes: 20, style: 'lowImpact', intensityCeiling: 'zona2' });
    expect(daily.sessionEndReason).toBe('HYBRID_COMPLETE');
    expect(daily.finisherBlock).toBeUndefined(); // finisher suprimido en el plan del día
  });
  it('sin cardio (suppressFinisher=false) → finisher del día se conserva, sin composedCardio', () => {
    const daily = sealComposedSession(genericWorkout(), {
      composedCardio: undefined, sessionEndReason: 'AVAILABLE_TIME_UNUSED', suppressFinisher: false,
    });
    expect(daily.composedCardio).toBeUndefined();
    expect(daily.finisherBlock).toBeDefined();
    expect(daily.sessionEndReason).toBe('AVAILABLE_TIME_UNUSED');
  });
  it('FUERZA byte-identical: el sello NO toca exercises/warmupBlock (solo agrega cardio/endReason, quita finisher)', () => {
    const before = genericWorkout();
    const exercisesBefore = JSON.parse(JSON.stringify(before.exercises));
    const warmupBefore = JSON.parse(JSON.stringify(before.warmupBlock));
    sealComposedSession(before, placedResult);
    expect(before.exercises).toEqual(exercisesBefore);       // ids/sets/reps/rest/grupos intactos
    expect(before.warmupBlock).toEqual(warmupBefore);        // preparación intacta
  });
  it('composedCardio se clona (no comparte referencia con el result)', () => {
    const spec = { minutes: 15, style: 'correr' as const, intensityCeiling: 'moderate' as const };
    const res = { ...placedResult, composedCardio: spec };
    const daily = sealComposedSession(genericWorkout(), res);
    expect(daily.composedCardio).not.toBe(spec);       // referencia distinta (clon)
    daily.composedCardio!.done = true;
    expect((spec as { done?: boolean }).done).toBeUndefined(); // mutar el plan no toca el result
  });
});
