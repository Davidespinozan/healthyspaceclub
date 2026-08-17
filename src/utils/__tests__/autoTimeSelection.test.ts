import { describe, it, expect } from 'vitest';
import { pickSplitByUtilityTime, decideTodayWorkout } from '../workoutPlanner';
import { estimatedSessionMinutes } from '../sessionPrescription';
import type { MuscleGroup, Exercise } from '../../types';

// ═══════════════════════════════════════════════════════════════════════════
// AUTO × TIEMPO · regla jerárquica: GATE de volumen → TIME-FIT → recuperación.
// El tiempo refina entre candidatos válidos; NUNCA sube un split agotado.
// (target plano 14; estMinutes = minutos útiles estimados por split, se pasan explícitos.)
// ═══════════════════════════════════════════════════════════════════════════
const push: MuscleGroup[] = ['pecho', 'hombros', 'triceps'];
const fresh = {}; // nada hecho → todos frescos
const exhaustedPush = { pecho: 14, hombros: 14, triceps: 14 }; // push en target

describe('pickSplitByUtilityTime — casos A–G', () => {
  it('A) time=30, all fresh, push=35/pull=60/lower=90 → push (mejor ajuste a 30)', () => {
    const r = pickSplitByUtilityTime(['push', 'pull', 'lower'], fresh, [], undefined, { push: 35, pull: 60, lower: 90 }, 30);
    expect(r.type).toBe('push');
  });
  it('B) time=120 → lower (llena la ventana con más trabajo útil)', () => {
    const r = pickSplitByUtilityTime(['push', 'pull', 'lower'], fresh, [], undefined, { push: 35, pull: 60, lower: 90 }, 120);
    expect(r.type).toBe('lower');
  });
  it('C) time=60, push=55/pull=60/lower=90 → pull (cabe y llena mejor 60)', () => {
    const r = pickSplitByUtilityTime(['push', 'pull', 'lower'], fresh, [], undefined, { push: 55, pull: 60, lower: 90 }, 60);
    expect(r.type).toBe('pull');
  });
  it('D) time=30, push AGOTADO (est 13), pull=50, lower=80 → NO push (gate de volumen); pull', () => {
    const r = pickSplitByUtilityTime(['push', 'pull', 'lower'], exhaustedPush, [], undefined, { push: 13, pull: 50, lower: 80 }, 30);
    expect(r.type).not.toBe('push');
    expect(r.type).toBe('pull');
  });
  it('E) time=120, push agotado → NO push; lower (más profundo cabe)', () => {
    const r = pickSplitByUtilityTime(['push', 'pull', 'lower'], exhaustedPush, [], undefined, { push: 13, pull: 50, lower: 80 }, 120);
    expect(r.type).not.toBe('push');
    expect(r.type).toBe('lower');
  });
  it('F) time=30, push=35 pero AYER=push, pull=45 fresco → pull (recuperación desempata)', () => {
    const r = pickSplitByUtilityTime(['push', 'pull'], fresh, push, undefined, { push: 35, pull: 45 }, 30);
    expect(r.type).toBe('pull');
  });
  it('G) time=120, push=80 (overlap) vs pull=20 fresco → push (volumen+ajuste ganan al overlap único)', () => {
    const r = pickSplitByUtilityTime(['push', 'pull'], fresh, push, undefined, { push: 80, pull: 20 }, 120);
    expect(r.type).toBe('push');
  });
});

describe('pickSplitByUtilityTime — gate de volumen y "todos cubiertos"', () => {
  it('un split agotado NO se elige solo porque cabe en el tiempo', () => {
    // push agotado (est 20, cabe perfecto en 20) vs lower útil (est 80). time=20 → NO push.
    const r = pickSplitByUtilityTime(['push', 'lower'], exhaustedPush, [], undefined, { push: 20, lower: 80 }, 20);
    expect(r.type).toBe('lower');
    expect(r.allCovered).toBe(false);
  });
  it('TODOS cubiertos → allCovered=true + el de más utilidad residual', () => {
    const allDone = { pecho: 14, hombros: 14, triceps: 14, espalda: 14, biceps: 14, cuadriceps: 14, isquios: 14, gluteo: 14, pantorrillas: 14 };
    const r = pickSplitByUtilityTime(['push', 'pull', 'lower'], allDone, [], undefined, { push: 12, pull: 10, lower: 14 }, 60);
    expect(r.allCovered).toBe(true);
  });
  it('recuperación sigue con peso: elegido fresco frente a overlap con ajuste comparable', () => {
    const r = pickSplitByUtilityTime(['push', 'pull'], fresh, push, undefined, { push: 50, pull: 55 }, 60);
    expect(r.type).toBe('pull'); // ambos caben ~60; push solapa → pull fresco comparable gana
  });
});

describe('estimatedSessionMinutes — estimador fiel (prescribeSession) y goal-aware', () => {
  const ex = (id: string, muscleGroup: MuscleGroup, type: 'compuesto' | 'aislamiento'): Pick<Exercise, 'id' | 'name' | 'type' | 'muscleGroup'> => ({ id, name: id, type, muscleGroup });
  const bank = [ex('press', 'pecho', 'compuesto'), ex('apertura', 'pecho', 'aislamiento'), ex('press-h', 'hombros', 'compuesto'), ex('ext-tri', 'triceps', 'aislamiento')];
  const common = { dayMuscles: ['pecho', 'hombros', 'triceps'], bank, weeklyTarget: { pecho: 14, hombros: 14, triceps: 14 }, doneThisWeek: {}, freqTarget: 5 };

  it('FUERZA estima MÁS minutos que HIPERTROFIA (descansos reales más largos)', () => {
    const fuerza = estimatedSessionMinutes({ ...common, trainingGoal: 'fuerza', phase: 'acumulacion', level: 'intermedio' });
    const hyper = estimatedSessionMinutes({ ...common, trainingGoal: 'hipertrofia', phase: 'acumulacion', level: 'intermedio' });
    expect(fuerza).toBeGreaterThan(hyper); // fuerza: descansos 210s vs 150s → más minutos por misma dosis
    expect(hyper).toBeGreaterThan(10);     // sesión real, no 0
  });
  it('determinista (mismo input → mismo output) — clave para HIT≡MISS del caché', () => {
    const a = estimatedSessionMinutes({ ...common, trainingGoal: 'hipertrofia', phase: 'acumulacion' });
    const b = estimatedSessionMinutes({ ...common, trainingGoal: 'hipertrofia', phase: 'acumulacion' });
    expect(a).toBe(b);
  });
  it('músculo agotado → ~mantenimiento (pocos minutos)', () => {
    const covered = estimatedSessionMinutes({ ...common, doneThisWeek: { pecho: 14, hombros: 14, triceps: 14 }, trainingGoal: 'hipertrofia', phase: 'acumulacion' });
    const fresh2 = estimatedSessionMinutes({ ...common, trainingGoal: 'hipertrofia', phase: 'acumulacion' });
    expect(covered).toBeLessThan(fresh2);
  });
});

describe('decideTodayWorkout — DETERMINISTA con tiempo (HIT≡MISS · misma config → misma decisión)', () => {
  const bank: Exercise[] = [
    { id: 'press', name: 'Press', type: 'compuesto', muscleGroup: 'pecho', equipment: ['gym'], goals: ['hipertrofia'], difficulty: 'intermedio', defaultSets: 3, defaultReps: '8-12', defaultRest: 90, desc: '', steps: [] },
    { id: 'remo', name: 'Remo', type: 'compuesto', muscleGroup: 'espalda', equipment: ['gym'], goals: ['hipertrofia'], difficulty: 'intermedio', defaultSets: 3, defaultReps: '8-12', defaultRest: 90, desc: '', steps: [] },
  ];
  const base = { userObjective: 'ganar músculo', workoutLog: [], exercises: bank, completedSessions: [], level: 'intermedio' as const, trainingGoal: 'hipertrofia' as const };
  it('misma entrada + mismo selectedTime → misma decisión (el caché no cambia la decisión del día)', () => {
    const d1 = decideTodayWorkout({ ...base, selectedTime: 60 });
    const d2 = decideTodayWorkout({ ...base, selectedTime: 60 });
    expect(d1.type).toBe(d2.type);
  });
  it('backward-compatible: sin selectedTime NO rompe (comportamiento previo por deficit)', () => {
    expect(() => decideTodayWorkout(base)).not.toThrow();
  });
});
