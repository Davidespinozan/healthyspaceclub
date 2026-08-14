import { describe, it, expect } from 'vitest';
import { exercises } from '../../data/exercises';
import { allocateSessionVolume, prescribeSession, categorize } from '../sessionPrescription';
import { allocateTime } from '../sessionBlocks';
import { normalizeTrainingGoal } from '../workoutPlanner';
import type { MuscleGroup, Equipment, Exercise } from '../../types';

// BLOQUE 5 (D2/F2) · sesiones ≤35′: "MENOS COSAS, NO TODO HECHO PEOR". prescribeSession elimina
// ejercicios (aislamiento → secundario → compuesto de menos series) antes que recortar descanso
// crítico. Invariante: tiempo estimado ≤ presupuesto del main + tolerancia pequeña (2′).

const bankById = new Map(exercises.map(e => [e.id, { id: e.id, name: e.name, type: e.type }]));
const minutesOf = (sets: number, rest: number) => sets * (0.7 + rest / 60);
const TIME_TOL = 2;

// Ejercicios reales para un split (varios por músculo → fuerza al recorte).
const forMuscles = (muscles: MuscleGroup[], eq: Equipment): { id: string; muscleGroup: string }[] => {
  const out: { id: string; muscleGroup: string }[] = [];
  for (const m of muscles) {
    const pool = exercises.filter((e: Exercise) => e.muscleGroup === m && !e.isYoga && e.muscleGroup !== 'cardio'
      && (e.variants ?? []).some(v => v.equipment.includes(eq)));
    for (const e of pool.slice(0, 3)) out.push({ id: e.id, muscleGroup: m });
  }
  return out;
};

function runSession(input: {
  muscles: MuscleGroup[]; minutes: number; eq: Equipment; goal: string;
  isDeload?: boolean; priority?: MuscleGroup;
}) {
  const time = allocateTime({ totalMinutes: input.minutes, isStrengthDay: true, objective: input.goal, isDeload: input.isDeload });
  const exs = forMuscles(input.muscles, input.eq);
  const dayMuscles = [...new Set(exs.map(e => e.muscleGroup))];
  const weeklyTarget: Record<string, number> = {}; for (const m of dayMuscles) weeklyTarget[m] = 14;
  const muscleWeeklyFreq: Record<string, number> = {}; for (const m of dayMuscles) muscleWeeklyFreq[m] = 2;
  const primaryMuscles = [...new Set([
    ...exs.filter(e => categorize(bankById.get(e.id)!) === 'main-compound').map(e => e.muscleGroup),
    ...(input.priority ? [input.priority] : []),
  ])];
  const allocation = allocateSessionVolume({
    weeklyTarget, doneThisWeek: {}, dayMuscles, primaryMuscles,
    freqTarget: 4, sessionsThisWeekDone: 0, muscleWeeklyFreq, isDeload: input.isDeload,
  });
  const items = prescribeSession({
    exercises: exs, bankById, allocation, trainingGoal: normalizeTrainingGoal(input.goal), phase: input.isDeload ? 'deload' : 'acumulacion',
    mainMinutes: time.main, lastPerf: Object.fromEntries(exs.map(e => [e.id, { sets: [{ reps: 6, kg: 100, rir: 2 }] }])),
  });
  const estMain = items.reduce((a, it) => a + minutesOf(it.prescription.sets, it.prescription.rest), 0);
  return { time, items, estMain, offered: exs.length };
}

const SPLITS: [string, MuscleGroup[]][] = [
  ['upper', ['pecho', 'espalda', 'hombros', 'biceps', 'triceps']],
  ['lower', ['cuadriceps', 'isquios', 'gluteo']],
  ['full-body', ['pecho', 'espalda', 'cuadriceps', 'gluteo']],
];
const EQ: Equipment[] = ['gym', 'cuerpo', 'ligas'];

describe('BLOQUE 5 · 30 min cabe de verdad (invariante de tiempo)', () => {
  for (const [name, muscles] of SPLITS) for (const eq of EQ) for (const goal of ['hipertrofia', 'fuerza']) {
    it(`30′ ${name}/${eq}/${goal}: estMain ≤ presupuesto+2′ y ≥1 ejercicio`, () => {
      const r = runSession({ muscles, minutes: 30, eq, goal });
      expect(r.estMain, `${name}/${eq}/${goal}: ${r.estMain.toFixed(1)}′ > ${r.time.main}+${TIME_TOL}`).toBeLessThanOrEqual(r.time.main + TIME_TOL);
      expect(r.items.length).toBeGreaterThanOrEqual(1);
    });
  }

  it('30′ elimina ejercicios (menos que lo ofrecido) — no comprime todo', () => {
    const r = runSession({ muscles: SPLITS[0][1], minutes: 30, eq: 'gym', goal: 'hipertrofia' });
    expect(r.items.length).toBeLessThan(r.offered); // se quitaron cosas, no se metieron todas
  });

  it('30′ preserva el COMPUESTO principal (recorta aislamiento/secundario primero)', () => {
    const r = runSession({ muscles: ['cuadriceps', 'isquios', 'gluteo'], minutes: 30, eq: 'gym', goal: 'fuerza' });
    const hasMain = r.items.some(it => it.category === 'main-compound');
    expect(hasMain).toBe(true); // el trabajo importante sobrevive
  });

  it('30′ NUNCA recorta el descanso crítico del compuesto (rest de compuesto intacto)', () => {
    const r = runSession({ muscles: ['cuadriceps'], minutes: 30, eq: 'gym', goal: 'fuerza' });
    const main = r.items.find(it => it.category === 'main-compound');
    if (main) expect(main.prescription.rest).toBeGreaterThanOrEqual(120); // descanso de compuesto respetado
  });
});

describe('BLOQUE 5 · prioridad y deload en 30 min', () => {
  it('prioridad muscular: su trabajo NO se elimina antes que accesorios no prioritarios', () => {
    const r = runSession({ muscles: ['gluteo', 'pecho', 'biceps'], minutes: 30, eq: 'gym', goal: 'hipertrofia', priority: 'gluteo' });
    expect(r.items.some(it => it.ex.muscleGroup === 'gluteo')).toBe(true); // el prioritario sobrevive
    expect(r.estMain).toBeLessThanOrEqual(r.time.main + TIME_TOL);
  });

  it('deload 30′: cabe, con carga reducida, sin re-inflar el tiempo liberado', () => {
    const r = runSession({ muscles: ['pecho', 'espalda'], minutes: 30, eq: 'gym', goal: 'hipertrofia', isDeload: true });
    expect(r.estMain).toBeLessThanOrEqual(r.time.main + TIME_TOL);
    // deload → carga reducida (isDeloadLoad) donde hay compuesto con carga
    const anyDeloadLoad = r.items.some(it => it.prescription.isDeloadLoad);
    if (r.items.some(it => it.category === 'main-compound')) expect(anyDeloadLoad).toBe(true);
  });
});

describe('BLOQUE 5 · boundary 35′ y 45′ no degradado', () => {
  it('35′ cabe (boundary)', () => {
    const r = runSession({ muscles: SPLITS[0][1], minutes: 35, eq: 'gym', goal: 'hipertrofia' });
    expect(r.estMain).toBeLessThanOrEqual(r.time.main + TIME_TOL);
  });
  it('45′ conserva MÁS trabajo que 30′ (no se degrada por reglas de sesión corta)', () => {
    const r30 = runSession({ muscles: SPLITS[0][1], minutes: 30, eq: 'gym', goal: 'hipertrofia' });
    const r45 = runSession({ muscles: SPLITS[0][1], minutes: 45, eq: 'gym', goal: 'hipertrofia' });
    const sets30 = r30.items.reduce((a, it) => a + it.prescription.sets, 0);
    const sets45 = r45.items.reduce((a, it) => a + it.prescription.sets, 0);
    expect(sets45).toBeGreaterThan(sets30);
    expect(r45.estMain).toBeLessThanOrEqual(r45.time.main + TIME_TOL);
  });
});
