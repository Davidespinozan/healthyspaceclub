import { describe, it, expect } from 'vitest';
import { sealComposedSession, type ComposeSessionResult } from '../sessionComposer';
import type { CachedWorkout } from '../workoutCache';

// ═══════════════════════════════════════════════════════════════════════════
// F2B-1 · ciclo de vida composedCardio (data-model): persistencia/reload, done, handoff que NO
// reemplaza la fuerza, y guard anti-duplicado. Refleja las transformaciones puras que hacen
// DailyTrainer (sello + markComposedCardioDone) y WorkoutPlan (composedCardioPending).
// ═══════════════════════════════════════════════════════════════════════════
const strengthPlan = (): CachedWorkout => ({
  type: 'upper', intensity: 'media',
  exercises: [
    { id: 'press-banca', sets: 4, reps: '8', rest: 120 },
    { id: 'remo', sets: 3, reps: '10', rest: 90 },
  ],
  warmup: '', cooldown: '', note: '',
  warmupBlock: { minutes: 8, phases: [] },
  finisherBlock: { minutes: 6, cardioStyle: 'lowImpact', format: 'steady', stations: [{ name: 'x' }] },
});
const placed: Pick<ComposeSessionResult, 'composedCardio' | 'sessionEndReason' | 'suppressFinisher'> = {
  composedCardio: { minutes: 20, style: 'lowImpact', intensityCeiling: 'zona2' },
  sessionEndReason: 'HYBRID_COMPLETE', suppressFinisher: true,
};
// Espejo puro de markComposedCardioDone (DailyTrainer): done=true sobre el MISMO plan de fuerza.
const markDone = (p: CachedWorkout): CachedWorkout =>
  p.composedCardio ? { ...p, composedCardio: { ...p.composedCardio, done: true } } : p;
// Espejo de composedCardioPending (WorkoutPlan).
const pending = (p: CachedWorkout): boolean => !!p.composedCardio && p.composedCardio.done !== true;

describe('persistencia / reload', () => {
  it('composedCardio + sessionEndReason sobreviven serialize→reload (jsonb)', () => {
    const daily = sealComposedSession(strengthPlan(), placed);
    const reloaded = JSON.parse(JSON.stringify(daily)) as CachedWorkout;
    expect(reloaded.composedCardio).toEqual({ minutes: 20, style: 'lowImpact', intensityCeiling: 'zona2' });
    expect(reloaded.sessionEndReason).toBe('HYBRID_COMPLETE');
    expect(reloaded.finisherBlock).toBeUndefined();
    expect(pending(reloaded)).toBe(true);
  });
  it('plan legacy sin composedCardio → sin bloque 03 ni pending (funciona idéntico)', () => {
    const legacy = strengthPlan();
    const reloaded = JSON.parse(JSON.stringify(legacy)) as CachedWorkout;
    expect(reloaded.composedCardio).toBeUndefined();
    expect(pending(reloaded)).toBe(false);
    expect(reloaded.finisherBlock).toBeDefined(); // finisher normal intacto
  });
});

describe('done lifecycle', () => {
  it('generate → pending; finish cardio → done=true; reload → NO re-ofrece', () => {
    const daily = sealComposedSession(strengthPlan(), placed);
    expect(pending(daily)).toBe(true);
    const afterCardio = markDone(daily);
    expect(afterCardio.composedCardio!.done).toBe(true);
    const reloaded = JSON.parse(JSON.stringify(afterCardio)) as CachedWorkout;
    expect(pending(reloaded)).toBe(false); // done sobrevive reload → bloque 03 oculto
  });
  it('marcar done NO reemplaza ni muta la fuerza (handoff: el plan de fuerza sobrevive)', () => {
    const daily = sealComposedSession(strengthPlan(), placed);
    const exercisesBefore = JSON.parse(JSON.stringify(daily.exercises));
    const after = markDone(daily);
    expect(after.exercises).toEqual(exercisesBefore); // ids/sets/reps/rest intactos
    expect(after.type).toBe('upper');                 // sigue siendo la sesión de fuerza
    expect(after).not.toBe(daily);                    // nuevo objeto (setPlan inmutable), no overwrite a cardio
  });
});

describe('guard anti-duplicado (cardio manual)', () => {
  it('composed pending → oculta manual (pending=true)', () => {
    expect(pending(sealComposedSession(strengthPlan(), placed))).toBe(true);
  });
  it('done=true → manual vuelve (pending=false)', () => {
    expect(pending(markDone(sealComposedSession(strengthPlan(), placed)))).toBe(false);
  });
  it('sin composed → manual disponible (pending=false)', () => {
    expect(pending(strengthPlan())).toBe(false);
  });
});
