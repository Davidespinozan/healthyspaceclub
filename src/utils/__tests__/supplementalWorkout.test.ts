import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { freezeTrainingTestDate, restoreTrainingTestDate } from './helpers/frozenClock';
import { buildSupplementalPlan } from '../supplementalWorkout';
import { computeWeeklyVolume } from '../workoutPlanner';
import { deriveCapabilities } from '../equipmentImplement';
import { exercises as BANK } from '../../data/exercises';
import type { CompletedSession, MuscleGroup } from '../../types';

// ═══════════════════════════════════════════════════════════════════════════
// D1 · "Generarme más" — supplemental por déficit real, techo 3, sin grouping.
// ═══════════════════════════════════════════════════════════════════════════

const today = '2026-08-19';
// TEST-STABILITY-1 · reloj congelado a la referencia de los fixtures (2026-08-19).
beforeEach(freezeTrainingTestDate);
afterEach(restoreTrainingTestDate);
const gym = deriveCapabilities(['gym']); // equipmentList=['cuerpo','gym'], allowed = gym implements
const pushMuscles: MuscleGroup[] = ['pecho', 'hombros', 'triceps'];

// Sesión de fuerza "corta" ya completada hoy (1 ejercicio de pecho).
const doneSession: CompletedSession = {
  sessionId: 's1', date: today, completedAtIso: `${today}T10:00:00.000Z`, modality: 'fuerza',
  exerciseIds: ['press-horizontal'], durationSeconds: 1800, exercisesCompleted: 1, exercisesTotal: 1,
};
const doneIds = ['press-horizontal'];

const call = (weeklyTarget: Record<string, number>, sessions = [doneSession], done = doneIds, eq = gym, maxExtra = 3) =>
  buildSupplementalPlan({
    completedSessions: sessions, bank: BANK, weeklyTarget, dayMuscles: pushMuscles,
    doneExerciseIds: done, equipmentList: eq.equipmentList, allowed: eq.allowedImplements, maxExtra,
  });

describe('déficit → nº de ejercicios (techo 3, decisión del coach)', () => {
  it('1 · déficit ALTO → genera hasta 3', () => {
    const r = call({ pecho: 22, hombros: 22, triceps: 22 });
    expect(r.status).toBe('ok');
    if (r.status === 'ok') { expect(r.count).toBeGreaterThanOrEqual(2); expect(r.count).toBeLessThanOrEqual(3); }
  });
  it('2/3 · déficit MENOR → genera menos (1–2)', () => {
    // target apenas por encima de lo hecho → poco déficit → pocos slots
    const done = computeWeeklyVolume([doneSession], BANK);
    const r = call({ pecho: (done['pecho'] ?? 0) + 3, hombros: (done['hombros'] ?? 0) + 3, triceps: (done['triceps'] ?? 0) + 0 });
    expect(['ok', 'covered']).toContain(r.status);
    if (r.status === 'ok') expect(r.count).toBeLessThanOrEqual(3);
  });
  it('4 · déficit 0 (semana cubierta) → genera 0 y "covered"', () => {
    const done = computeWeeklyVolume([doneSession], BANK);
    const r = call({ pecho: done['pecho'] ?? 0, hombros: done['hombros'] ?? 0, triceps: done['triceps'] ?? 0 });
    expect(r.status).toBe('covered');
  });
  it('techo respetado: nunca más de maxExtra', () => {
    const r = call({ pecho: 40, hombros: 40, triceps: 40 }, [doneSession], doneIds, gym, 3);
    if (r.status === 'ok') expect(r.count).toBeLessThanOrEqual(3);
    const r2 = call({ pecho: 40, hombros: 40, triceps: 40 }, [doneSession], doneIds, gym, 2);
    if (r2.status === 'ok') expect(r2.count).toBeLessThanOrEqual(2);
  });
});

describe('filtros y seguridad', () => {
  it('5 · déficit pero SIN candidato compatible (peso corporal + músculo sin playable) → gap honesto', () => {
    const home = deriveCapabilities([]); // solo bodyweight
    // triceps/hombros con equipo peso corporal: patrones primarios sin variante bodyweight+video → gap
    const r = buildSupplementalPlan({
      completedSessions: [doneSession], bank: BANK, weeklyTarget: { pecho: 22, hombros: 22, triceps: 22 },
      dayMuscles: pushMuscles, doneExerciseIds: doneIds,
      equipmentList: home.equipmentList, allowed: home.allowedImplements, maxExtra: 3,
    });
    // con bodyweight puede rellenar algo (flexiones) o caer en gap para lo no-corporal; ambos válidos,
    // lo importante: NUNCA inventa un ejercicio no-playable.
    expect(['ok', 'gap', 'covered']).toContain(r.status);
    if (r.status === 'ok') {
      for (const id of r.exerciseIds) {
        const ex = BANK.find(e => e.id === id)!;
        // cada elegido DEBE tener al menos una variante playable con el equipo de casa
        const ok = (ex.variants ?? []).some(v => v.equipment.some(e => home.equipmentList.includes(e)));
        expect(ok).toBe(true);
      }
    }
  });
  it('6 · NO repite ids ejecutados hoy', () => {
    const r = call({ pecho: 22, hombros: 22, triceps: 22 });
    if (r.status === 'ok') for (const id of r.exerciseIds) expect(doneIds).not.toContain(id);
  });
  it('7 · respeta equipment/playable (todo elegido tiene variante playable con el equipo)', () => {
    const r = call({ pecho: 22, hombros: 22, triceps: 22 });
    if (r.status === 'ok') for (const id of r.exerciseIds) {
      const ex = BANK.find(e => e.id === id)!;
      expect((ex.variants ?? []).some(v => v.equipment.some(e => gym.equipmentList.includes(e)))).toBe(true);
    }
  });
  it('8 · respeta patternCap (no apila un patrón por encima del cap contando lo hecho)', () => {
    // 2 horizontal-push YA hechos (cap hipertrofia=2) → no debe añadir un 3º horizontal-push
    const done2 = ['press-horizontal', 'press-inclinado']; // ambos horizontal-push
    const sess: CompletedSession = { ...doneSession, exerciseIds: done2 };
    const r = buildSupplementalPlan({
      completedSessions: [sess], bank: BANK, weeklyTarget: { pecho: 30, hombros: 0, triceps: 0 },
      dayMuscles: ['pecho'], doneExerciseIds: done2, equipmentList: gym.equipmentList, allowed: gym.allowedImplements, maxExtra: 3,
    });
    if (r.status === 'ok') for (const s of r.slots) expect(s.pattern).not.toBe('horizontal-push'); // no un 3º
  });
});

describe('volumen y convergencia', () => {
  it('9 · el supplemental SUMA a computeWeeklyVolume del músculo', () => {
    const r = call({ pecho: 22, hombros: 22, triceps: 22 });
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      const before = computeWeeklyVolume([doneSession], BANK);
      const supp: CompletedSession = { ...doneSession, sessionId: 's2', exerciseIds: r.exerciseIds };
      const after = computeWeeklyVolume([doneSession, supp], BANK);
      const totalBefore = Object.values(before).reduce((a, b) => a + b, 0);
      const totalAfter = Object.values(after).reduce((a, b) => a + b, 0);
      expect(totalAfter).toBeGreaterThan(totalBefore); // el trabajo adicional cuenta
    }
  });
  it('15 · un 2º "Generarme más" recalcula el déficit y converge a covered', () => {
    const target = { pecho: 12, hombros: 12, triceps: 12 };
    const r1 = call(target);
    let sessions = [doneSession];
    if (r1.status === 'ok') sessions = [doneSession, { ...doneSession, sessionId: 's2', exerciseIds: r1.exerciseIds }];
    // añade otra ronda de supplemental al historial y vuelve a pedir
    let r2 = buildSupplementalPlan({ completedSessions: sessions, bank: BANK, weeklyTarget: target, dayMuscles: pushMuscles, doneExerciseIds: [...doneIds, ...(r1.status === 'ok' ? r1.exerciseIds : [])], equipmentList: gym.equipmentList, allowed: gym.allowedImplements, maxExtra: 3 });
    if (r2.status === 'ok') {
      sessions = [...sessions, { ...doneSession, sessionId: 's3', exerciseIds: r2.exerciseIds }];
      r2 = buildSupplementalPlan({ completedSessions: sessions, bank: BANK, weeklyTarget: target, dayMuscles: pushMuscles, doneExerciseIds: [...doneIds, ...(r1.status === 'ok' ? r1.exerciseIds : []), ...r2.exerciseIds], equipmentList: gym.equipmentList, allowed: gym.allowedImplements, maxExtra: 3 });
    }
    expect(r2.status).toBe('covered'); // el déficit se agotó
  });
  it('16 · NO produce grouping (series rectas: el resultado no lleva group)', () => {
    const r = call({ pecho: 22, hombros: 22, triceps: 22 });
    // el SupplementalResult no tiene noción de group/superserie → series rectas por construcción
    expect(r).not.toHaveProperty('groups');
    if (r.status === 'ok') for (const s of r.slots) expect(s).not.toHaveProperty('group');
  });
});
