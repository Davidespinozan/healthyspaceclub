import { describe, it, expect } from 'vitest';
import { deriveMesocycleState } from '../mesocycle';
import { computeVolumeTargets, targetsToMap, type Level } from '../volumeLandmarks';
import { resolvePriorities, applyMusclePriority } from '../musclePriority';
import { computeReadiness, readinessToRecovery } from '../readiness';
import { allocateSessionVolume, prescribeSession, type PrescribedItem } from '../sessionPrescription';
import { allocateTime } from '../sessionBlocks';
import { normalizeTrainingGoal } from '../workoutPlanner';
import type { Exercise } from '../../types';

// ── Banco mínimo determinista (compuestos principales + accesorios por músculo) ──
const ex = (id: string, type: string, muscleGroup: string, name = id): Exercise =>
  ({ id, name, type, muscleGroup } as unknown as Exercise);
const BANK: Exercise[] = [
  ex('sentadilla-barra', 'compuesto', 'cuadriceps', 'Sentadilla con Barra'),
  ex('prensa', 'compuesto', 'cuadriceps', 'Prensa'),
  ex('extension-cuad', 'aislamiento', 'cuadriceps', 'Extensión'),
  ex('hip-thrust', 'compuesto', 'gluteo', 'Hip Thrust'),
  ex('press-banca', 'compuesto', 'pecho', 'Press de Banca'),
  ex('aperturas', 'aislamiento', 'pecho', 'Aperturas'),
  ex('press-militar', 'compuesto', 'hombros', 'Press Militar'),
  ex('elevaciones', 'aislamiento', 'hombros', 'Elevaciones Laterales'),
  ex('remo-barra', 'compuesto', 'espalda', 'Remo con Barra'),
  ex('curl-biceps', 'aislamiento', 'biceps', 'Curl'),
];
const bankById = new Map(BANK.map(e => [e.id, { id: e.id, name: e.name, type: e.type }]));
const muscleOf = (id: string) => BANK.find(e => e.id === id)?.muscleGroup ?? 'core';

interface Scenario {
  name: string;
  level: Level;
  objective: string;
  daysPerWeek: number;
  weeksAccumulated: number;
  recovery: 'buena' | 'media' | 'mala';
  adherence: 'alta' | 'media' | 'baja';
  performance: 'sube' | 'estable' | 'baja';
  minutes: number;
  hasLoad: boolean;             // gym (kg) vs bandas/peso corporal
  dayExercises: string[];
  priorities?: string[];
  readiness?: { energy?: 'baja' | 'normal' | 'alta'; sleep?: 'malo' | 'normal' | 'bueno' };
  sessionsThisWeekDone: number;
  weeklyVolumes?: Record<string, number>[]; // historial (reciente→viejo)
  weeksOfHistory?: number;
  rirObs?: { prescribedRir: number; actualRir: number }[];
}

interface SimResult {
  meso: ReturnType<typeof deriveMesocycleState>;
  time: { warmup: number; main: number; finisher: number };
  targets: Record<string, { target: number; min: number; max: number }>;
  allocation: Record<string, number>;
  items: PrescribedItem<{ id: string; muscleGroup: string }>[];
  readinessState: string;
}

function simulate(s: Scenario): SimResult {
  const meso = deriveMesocycleState({ weeksAccumulated: s.weeksAccumulated, recovery: s.recovery, adherence: s.adherence, performance: s.performance });
  const readiness = computeReadiness(s.readiness ?? {});
  const todayRecovery = readinessToRecovery(readiness.state);
  const rank: Record<string, number> = { mala: 0, media: 1, buena: 2 };
  const dosingRecovery = rank[todayRecovery] <= rank[meso.signals.recovery] ? todayRecovery : meso.signals.recovery;

  const p3 = computeVolumeTargets({
    weeklyVolumes: s.weeklyVolumes ?? [], level: s.level, weeksOfHistory: s.weeksOfHistory ?? 0,
    recovery: meso.signals.recovery, performance: meso.signals.performance, adherence: meso.signals.adherence,
    volumeMultiplier: meso.volumeMultiplier, isDeload: meso.deload,
  });
  const priorities = resolvePriorities({ explicit: s.priorities ?? [], recovery: meso.signals.recovery, isDeload: meso.deload });
  const targets = applyMusclePriority(p3, priorities);

  const time = allocateTime({ totalMinutes: s.minutes, isStrengthDay: true, objective: s.objective, isDeload: meso.deload });

  const exsWithMuscle = s.dayExercises.map(id => ({ id, muscleGroup: muscleOf(id) }));
  const dayMuscles = [...new Set(exsWithMuscle.map(e => e.muscleGroup))];
  const muscleWeeklyFreq: Record<string, number> = {};
  for (const m of dayMuscles) muscleWeeklyFreq[m] = 2;
  const primaryMuscles = [...new Set([
    ...exsWithMuscle.filter(e => e.id.match(/barra|thrust|militar|prensa/)).map(e => e.muscleGroup),
    ...Object.keys(priorities).filter(m => (dayMuscles as string[]).includes(m)),
  ])];
  const allocation = allocateSessionVolume({
    weeklyTarget: targetsToMap(targets), doneThisWeek: {}, dayMuscles, primaryMuscles,
    freqTarget: s.daysPerWeek, sessionsThisWeekDone: s.sessionsThisWeekDone, muscleWeeklyFreq,
    recovery: dosingRecovery, isDeload: meso.deload,
  });

  // BLOQUE 2 · el RIR real entra por el HISTORIAL (lastPerf), no por una calibración aparte:
  // la e1RM RIR-aware lo consume. lastPerf solo con carga comparable (gym); bandas/corporal sin kg.
  const avgActualRir = s.rirObs && s.rirObs.length ? s.rirObs.reduce((a, o) => a + o.actualRir, 0) / s.rirObs.length : undefined;
  const lastPerf: Record<string, { sets: { reps: number; kg: number; rir?: number }[] }> = {};
  if (s.hasLoad) for (const e of exsWithMuscle) lastPerf[e.id] = { sets: [{ reps: 6, kg: 100, ...(avgActualRir != null && { rir: avgActualRir }) }] };

  const items = prescribeSession({
    exercises: exsWithMuscle, bankById, allocation, trainingGoal: normalizeTrainingGoal(s.objective),
    phase: meso.phase, mainMinutes: time.main, lastPerf,
  });
  return { meso, time, targets, allocation, items, readinessState: readiness.state };
}

const perExerciseSetsOk = (r: SimResult) => r.items.every(it => it.prescription.sets >= 2 && it.prescription.sets <= 6);
const perMuscleCapOk = (r: SimResult) => Object.values(r.allocation).every(v => v <= 10);
const timeFits = (r: SimResult, total: number) => {
  const mainMin = r.items.reduce((a, it) => a + it.prescription.sets * (0.7 + it.prescription.rest / 60), 0);
  return r.time.warmup + r.time.main + r.time.finisher <= total + 1 && mainMin <= r.time.main + 3;
};

describe('SIMULACIONES end-to-end P1–P6 (¿tiene sentido como coach?)', () => {
  it('A · Principiante, perder grasa, 3 días, casa (sin carga)', () => {
    const r = simulate({ name: 'A', level: 'principiante', objective: 'perder grasa', daysPerWeek: 3, weeksAccumulated: 0, recovery: 'media', adherence: 'media', performance: 'estable', minutes: 45, hasLoad: false, dayExercises: ['sentadilla-barra', 'press-banca', 'remo-barra'], sessionsThisWeekDone: 0 });
    expect(perExerciseSetsOk(r)).toBe(true);
    expect(perMuscleCapOk(r)).toBe(true);
    // cold start conservador: target ≤ techo principiante (14) y baseline mitad-baja
    for (const m of Object.keys(r.targets)) expect(r.targets[m].target).toBeLessThanOrEqual(14);
    // sin carga → ningún top-set con kg
    expect(r.items.every(it => it.prescription.topKg == null)).toBe(true);
    // F2C-9C.2B.3 · finisher deprecado (0); el tiempo va al main, el conditioning es composedCardio
    expect(r.time.finisher).toBe(0);
    expect(timeFits(r, 45)).toBe(true);
  });

  it('B · Intermedio, hipertrofia, 5 días, gym', () => {
    const r = simulate({ name: 'B', level: 'intermedio', objective: 'hipertrofia', daysPerWeek: 5, weeksAccumulated: 2, recovery: 'buena', adherence: 'alta', performance: 'sube', minutes: 60, hasLoad: true, dayExercises: ['press-banca', 'aperturas', 'press-militar', 'elevaciones'], sessionsThisWeekDone: 1, weeklyVolumes: [{ pecho: 12, hombros: 10 }, { pecho: 12, hombros: 10 }], weeksOfHistory: 2 });
    expect(perExerciseSetsOk(r)).toBe(true);
    expect(perMuscleCapOk(r)).toBe(true);
    // compuesto principal con carga → top-backoff con kg
    const press = r.items.find(i => i.ex.id === 'press-banca')!;
    expect(press.prescription.topKg).toBeGreaterThan(0);
    expect(timeFits(r, 60)).toBe(true);
  });

  it('C · Avanzado, fuerza, 4 días, gym, con historial → MÁS personalizado que un novato', () => {
    const avanzado = simulate({ name: 'C', level: 'avanzado', objective: 'fuerza', daysPerWeek: 4, weeksAccumulated: 3, recovery: 'buena', adherence: 'alta', performance: 'sube', minutes: 75, hasLoad: true, dayExercises: ['sentadilla-barra', 'prensa', 'extension-cuad'], sessionsThisWeekDone: 0, weeklyVolumes: [{ cuadriceps: 18 }, { cuadriceps: 17 }, { cuadriceps: 18 }], weeksOfHistory: 3 });
    const novato = simulate({ name: 'C0', level: 'principiante', objective: 'fuerza', daysPerWeek: 4, weeksAccumulated: 0, recovery: 'media', adherence: 'media', performance: 'estable', minutes: 75, hasLoad: false, dayExercises: ['sentadilla-barra', 'prensa', 'extension-cuad'], sessionsThisWeekDone: 0 });
    // el avanzado con historial tolera y recibe MÁS volumen objetivo que el novato cold-start
    expect(avanzado.targets.cuadriceps.target).toBeGreaterThan(novato.targets.cuadriceps.target);
    // fuerza → reps bajas en el compuesto principal
    const sent = avanzado.items.find(i => i.ex.id === 'sentadilla-barra')!;
    expect(parseInt(sent.prescription.reps)).toBeLessThanOrEqual(6);
    expect(timeFits(avanzado, 75)).toBe(true);
  });

  it('D · Cansado en intensificación: baja la dosis de HOY pero sigue en intensificación', () => {
    const r = simulate({ name: 'D', level: 'intermedio', objective: 'hipertrofia', daysPerWeek: 4, weeksAccumulated: 3, recovery: 'buena', adherence: 'alta', performance: 'sube', minutes: 60, hasLoad: true, dayExercises: ['press-banca', 'aperturas'], sessionsThisWeekDone: 0, readiness: { energy: 'baja', sleep: 'malo' }, weeklyVolumes: [{ pecho: 14 }, { pecho: 14 }], weeksOfHistory: 2 });
    expect(r.meso.phase).toBe('intensificacion'); // el plan NO cambia
    expect(r.readinessState).toBe('low');          // hoy sí baja
  });

  it('E · Deload: menos volumen, RIR alto, sin top-set agresivo, finisher recortado', () => {
    const normal = simulate({ name: 'Enorm', level: 'intermedio', objective: 'hipertrofia', daysPerWeek: 4, weeksAccumulated: 2, recovery: 'buena', adherence: 'alta', performance: 'sube', minutes: 60, hasLoad: true, dayExercises: ['press-banca', 'aperturas'], sessionsThisWeekDone: 0, weeklyVolumes: [{ pecho: 14 }, { pecho: 14 }], weeksOfHistory: 2 });
    const deload = simulate({ name: 'E', level: 'intermedio', objective: 'perder grasa', daysPerWeek: 4, weeksAccumulated: 4, recovery: 'media', adherence: 'alta', performance: 'baja', minutes: 60, hasLoad: true, dayExercises: ['press-banca', 'aperturas'], sessionsThisWeekDone: 0, weeklyVolumes: [{ pecho: 14 }, { pecho: 14 }], weeksOfHistory: 4 });
    expect(deload.meso.deload).toBe(true);
    // volumen de hoy recortado vs una semana normal
    const sum = (a: Record<string, number>) => Object.values(a).reduce((x, y) => x + y, 0);
    expect(sum(deload.allocation)).toBeLessThan(sum(normal.allocation));
    // RIR alto y sin top-backoff (carga no agresiva)
    expect(deload.items.every(it => it.prescription.rir >= 3)).toBe(true);
    expect(deload.items.every(it => it.prescription.scheme === 'straight')).toBe(true);
    // carga EXPLÍCITAMENTE reducida en el compuesto con carga (deloadKg), más ligera que lo normal
    const dPress = deload.items.find(i => i.ex.id === 'press-banca')!;
    const nPress = normal.items.find(i => i.ex.id === 'press-banca')!;
    expect(dPress.prescription.isDeloadLoad).toBe(true);
    expect(dPress.prescription.topKg!).toBeLessThan(nPress.prescription.topKg!);
    // finisher recortado pese a objetivo "perder grasa" (share alto) — la descarga manda
    expect(deload.time.finisher).toBeLessThanOrEqual(10);
  });

  it('F · Prioridad glúteos/hombros: sesga sin volumen absurdo', () => {
    const r = simulate({ name: 'F', level: 'intermedio', objective: 'hipertrofia', daysPerWeek: 4, weeksAccumulated: 1, recovery: 'buena', adherence: 'alta', performance: 'estable', minutes: 60, hasLoad: true, dayExercises: ['hip-thrust', 'press-militar', 'elevaciones'], sessionsThisWeekDone: 0, priorities: ['gluteo', 'hombros'], weeklyVolumes: [{ gluteo: 12, hombros: 12 }], weeksOfHistory: 1 });
    // priorizado sube el target pero NO supera el techo operativo
    expect(r.targets.gluteo.target).toBeLessThanOrEqual(r.targets.gluteo.max);
    expect(r.targets.hombros.target).toBeLessThanOrEqual(r.targets.hombros.max);
    expect(perMuscleCapOk(r)).toBe(true); // sin dosis absurda
  });

  it('G · Sesión de 30 min: cabe de verdad (warm-up + fuerza + finisher)', () => {
    const r = simulate({ name: 'G', level: 'intermedio', objective: 'hipertrofia', daysPerWeek: 4, weeksAccumulated: 2, recovery: 'buena', adherence: 'alta', performance: 'sube', minutes: 30, hasLoad: true, dayExercises: ['sentadilla-barra', 'prensa', 'extension-cuad', 'curl-biceps'], sessionsThisWeekDone: 0, weeklyVolumes: [{ cuadriceps: 14 }], weeksOfHistory: 2 });
    expect(timeFits(r, 30)).toBe(true);
    expect(r.time.main).toBeGreaterThanOrEqual(20); // el piso del main se respeta
  });

  it('H · Bandas (sin kg): coach útil, sin top-set ni carga inventada', () => {
    const r = simulate({ name: 'H', level: 'intermedio', objective: 'hipertrofia', daysPerWeek: 3, weeksAccumulated: 1, recovery: 'media', adherence: 'media', performance: 'estable', minutes: 45, hasLoad: false, dayExercises: ['press-banca', 'remo-barra', 'curl-biceps'], sessionsThisWeekDone: 0 });
    expect(r.items.every(it => it.prescription.scheme === 'straight')).toBe(true);
    expect(r.items.every(it => it.prescription.topKg == null)).toBe(true);
    expect(perExerciseSetsOk(r)).toBe(true); // aún así prescribe series/reps coherentes
  });

  it('I · Varias sesiones perdidas: dosis sana, sin volcar toda la semana en una sesión', () => {
    const r = simulate({ name: 'I', level: 'intermedio', objective: 'hipertrofia', daysPerWeek: 5, weeksAccumulated: 1, recovery: 'media', adherence: 'baja', performance: 'estable', minutes: 60, hasLoad: true, dayExercises: ['press-banca', 'aperturas'], sessionsThisWeekDone: 0, weeklyVolumes: [{ pecho: 12 }], weeksOfHistory: 1 });
    // aunque falten muchas sesiones, la dosis de hoy respeta el cap por músculo/sesión
    expect(perMuscleCapOk(r)).toBe(true);
    expect(r.allocation.pecho).toBeLessThanOrEqual(10);
  });

  it('J · RIR real muy distinto al prescrito: la carga se corrige poco (sin saltos)', () => {
    const facil = simulate({ name: 'J', level: 'avanzado', objective: 'fuerza', daysPerWeek: 4, weeksAccumulated: 3, recovery: 'buena', adherence: 'alta', performance: 'sube', minutes: 75, hasLoad: true, dayExercises: ['sentadilla-barra'], sessionsThisWeekDone: 0, weeklyVolumes: [{ cuadriceps: 16 }], weeksOfHistory: 3, rirObs: [{ prescribedRir: 2, actualRir: 4 }, { prescribedRir: 2, actualRir: 4 }, { prescribedRir: 2, actualRir: 4 }, { prescribedRir: 2, actualRir: 4 }] });
    const base = simulate({ name: 'Jbase', level: 'avanzado', objective: 'fuerza', daysPerWeek: 4, weeksAccumulated: 3, recovery: 'buena', adherence: 'alta', performance: 'sube', minutes: 75, hasLoad: true, dayExercises: ['sentadilla-barra'], sessionsThisWeekDone: 0, weeklyVolumes: [{ cuadriceps: 16 }], weeksOfHistory: 3 });
    const jTop = facil.items[0].prescription.topKg!;
    const bTop = base.items[0].prescription.topKg!;
    // BLOQUE 2 · el RIR fácil sube la capacidad estimada (RIR-aware) → carga ≥ base; el
    // guardrail de ±10%/sesión evita un salto grande de una sola observación.
    expect(jTop).toBeGreaterThanOrEqual(bTop);
    expect(jTop - bTop).toBeLessThanOrEqual(bTop * 0.11); // acotado (~≤10% + redondeo)
  });
});
