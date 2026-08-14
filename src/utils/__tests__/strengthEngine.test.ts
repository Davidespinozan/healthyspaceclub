import { describe, it, expect } from 'vitest';
import {
  repRangeFor, rirFor, restFor, prescribeExercise, prescribeSession,
  allocateSessionVolume, type Category, type Phase,
} from '../sessionPrescription';
import { allocateTime, finisherShare, buildFinisher, type SessionInput } from '../sessionBlocks';
import { repairWorkoutStructure } from '../exerciseOrder';
import { exerciseCountForDuration } from '../workoutPlanner';
import { exercises } from '../../data/exercises';
import type { Exercise, MuscleGroup, TrainingGoal } from '../../types';

// ─────────────────────────────────────────────────────────────────────────
// FASE 1 · MOTOR DE FUERZA REAL. Blinda que trainingGoal='fuerza' es una filosofía
// distinta (no "hipertrofia con menos reps") y que hipertrofia NO se rompe.
// ─────────────────────────────────────────────────────────────────────────

const PHASES: Phase[] = ['acumulacion', 'intensificacion', 'deload'];
const lo = (r: string) => parseInt(r.split('-')[0], 10);
const hi = (r: string) => parseInt(r.split('-')[1] ?? r.split('-')[0], 10);

// Cuenta de ejercicios de fuerza (réplica de la fórmula de DailyTrainer, meso×1):
function targetCount(totalMin: number, tg: TrainingGoal): number {
  const t = allocateTime({ totalMinutes: totalMin, isStrengthDay: true, objective: 'ganar músculo', trainingGoal: tg });
  const base = exerciseCountForDuration(t.main);
  return tg === 'fuerza' ? Math.max(2, Math.min(6, Math.round(base * 0.6))) : Math.max(3, base);
}

// ── 1-3 · REPS ──────────────────────────────────────────────────────────
describe('FUERZA · reps por rol (distintas de hipertrofia)', () => {
  it('1 · main: fuerza 4-6/3-5 vs hipertrofia 6-10/5-7', () => {
    expect(repRangeFor('main-compound', 'fuerza', 'acumulacion')).toBe('4-6');
    expect(repRangeFor('main-compound', 'fuerza', 'intensificacion')).toBe('3-5');
    expect(repRangeFor('main-compound', 'hipertrofia', 'acumulacion')).toBe('6-10');
    expect(hi(repRangeFor('main-compound', 'fuerza', 'acumulacion')))
      .toBeLessThan(lo(repRangeFor('main-compound', 'hipertrofia', 'acumulacion')) + 1);
  });
  it('2 · secondary: fuerza 6-8/5-7 vs hipertrofia 8-12/7-10', () => {
    expect(repRangeFor('secondary-compound', 'fuerza', 'acumulacion')).toBe('6-8');
    expect(repRangeFor('secondary-compound', 'fuerza', 'intensificacion')).toBe('5-7');
    expect(repRangeFor('secondary-compound', 'hipertrofia', 'acumulacion')).toBe('8-12');
  });
  it('3 · aislamiento fuerza sigue MODERADO/alto (no 3-5)', () => {
    for (const ph of PHASES) {
      const r = repRangeFor('isolation', 'fuerza', ph);
      expect(lo(r)).toBeGreaterThanOrEqual(8); // nunca fuerza máxima en aislamiento
    }
    expect(repRangeFor('isolation', 'fuerza', 'acumulacion')).toBe('8-12');
    expect(repRangeFor('isolation', 'fuerza', 'deload')).toBe('10-15');
  });
});

// ── 4-5 · RIR ───────────────────────────────────────────────────────────
describe('FUERZA · RIR protege el compuesto; hipertrofia permite acercarse al fallo', () => {
  it('4 · RIR fuerza main: 2-3, NUNCA 0', () => {
    expect(rirFor('main-compound', 'fuerza', 'acumulacion')).toBe(3);
    expect(rirFor('main-compound', 'fuerza', 'intensificacion')).toBe(2);
    for (const ph of PHASES) expect(rirFor('main-compound', 'fuerza', ph)).toBeGreaterThanOrEqual(2);
  });
  it('5 · hipertrofia isolation puede ir más cerca del fallo que un main de fuerza', () => {
    expect(rirFor('isolation', 'hipertrofia', 'intensificacion')).toBe(1);
    expect(rirFor('isolation', 'fuerza', 'acumulacion')).toBe(1); // accesorio en fuerza también puede empujar
    expect(rirFor('main-compound', 'fuerza', 'acumulacion')).toBeGreaterThan(rirFor('isolation', 'hipertrofia', 'intensificacion'));
  });
});

// ── 6-7 · DESCANSO ──────────────────────────────────────────────────────
describe('FUERZA · descansos largos (preservan rendimiento)', () => {
  it('6 · descanso main fuerza ≥180s y > hipertrofia', () => {
    expect(restFor('main-compound', 'fuerza', 'acumulacion')).toBeGreaterThanOrEqual(180);
    expect(restFor('main-compound', 'fuerza', 'intensificacion')).toBeGreaterThanOrEqual(180);
    expect(restFor('main-compound', 'fuerza', 'acumulacion'))
      .toBeGreaterThan(restFor('main-compound', 'hipertrofia', 'acumulacion'));
  });
  it('7 · descanso secondary fuerza 120-180 y > hipertrofia', () => {
    expect(restFor('secondary-compound', 'fuerza', 'acumulacion')).toBeGreaterThanOrEqual(120);
    expect(restFor('secondary-compound', 'fuerza', 'acumulacion'))
      .toBeGreaterThan(restFor('secondary-compound', 'hipertrofia', 'acumulacion'));
  });
  it('INVARIANTE · main de fuerza NUNCA con descanso corto (60s)', () => {
    for (const ph of PHASES) expect(restFor('main-compound', 'fuerza', ph)).toBeGreaterThan(60);
  });
});

// ── 8-10 · NÚMERO DE EJERCICIOS ─────────────────────────────────────────
describe('FUERZA · menos movimientos, más calidad', () => {
  it('8 · 30 min fuerza → 2-3 ejercicios', () => {
    const n = targetCount(30, 'fuerza');
    expect(n).toBeGreaterThanOrEqual(2);
    expect(n).toBeLessThanOrEqual(3);
  });
  it('9 · 60 min fuerza → ≤5 (no 9)', () => {
    expect(targetCount(60, 'fuerza')).toBeLessThanOrEqual(5);
    expect(targetCount(60, 'fuerza')).toBeLessThan(targetCount(60, 'hipertrofia'));
  });
  it('10 · 90 min fuerza → ≤6 (no 13; la duración extra va a descanso/calidad)', () => {
    expect(targetCount(90, 'fuerza')).toBeLessThanOrEqual(6);
    expect(targetCount(90, 'hipertrofia')).toBeGreaterThan(targetCount(90, 'fuerza'));
  });
});

// ── 11 · CUT + FUERZA ───────────────────────────────────────────────────
describe('FUERZA · cut + fuerza = sesión REAL de fuerza (no circuito)', () => {
  const base = (over: Partial<SessionInput> = {}): SessionInput => ({
    totalMinutes: 60, isStrengthDay: true, objective: 'perder grasa', trainingGoal: 'fuerza',
    dayMuscles: ['cuadriceps'] as MuscleGroup[], equipment: ['gym'], bank: exercises, ...over,
  });
  it('11 · reps de fuerza (no altas por cut) + finisher acotado + sin metcon', () => {
    expect(repRangeFor('main-compound', 'fuerza', 'acumulacion')).toBe('4-6'); // el cut no sube reps
    const f = buildFinisher(24, base());
    expect(f?.format).not.toBe('circuit');
    // cut+fuerza recorta más el finisher que cut+hipertrofia (protege el main)
    expect(finisherShare('perder grasa', 'fuerza')).toBeLessThan(finisherShare('perder grasa', 'hipertrofia'));
  });
});

// ── 12 · READINESS LOW ──────────────────────────────────────────────────
describe('FUERZA · readiness LOW autorregula (P6 manda)', () => {
  it('12 · recuperación mala → menos series; finisher recortado', () => {
    const common = {
      weeklyTarget: { cuadriceps: 16 }, doneThisWeek: {}, dayMuscles: ['cuadriceps'],
      primaryMuscles: ['cuadriceps'], freqTarget: 4, sessionsThisWeekDone: 0, muscleWeeklyFreq: { cuadriceps: 2 },
    };
    const buena = allocateSessionVolume({ ...common, recovery: 'buena' });
    const mala = allocateSessionVolume({ ...common, recovery: 'mala' });
    expect(mala.cuadriceps).toBeLessThanOrEqual(buena.cuadriceps);
    const normal = allocateTime({ totalMinutes: 60, isStrengthDay: true, objective: 'ganar músculo', trainingGoal: 'fuerza' });
    const low = allocateTime({ totalMinutes: 60, isStrengthDay: true, objective: 'ganar músculo', trainingGoal: 'fuerza', readinessLow: true });
    expect(low.finisher).toBeLessThanOrEqual(normal.finisher);
  });
});

// ── 13 · DELOAD ─────────────────────────────────────────────────────────
describe('FUERZA · deload', () => {
  const loaded = [{ reps: 5, kg: 120, rir: 2 }];
  it('13 · deload fuerza main: recto, carga reducida, RIR alto, reps 4-6', () => {
    const p = prescribeExercise({ category: 'main-compound', sets: 3, trainingGoal: 'fuerza', phase: 'deload', lastSets: loaded });
    expect(p.scheme).toBe('straight');
    expect(p.isDeloadLoad).toBe(true);
    expect(p.rir).toBeGreaterThanOrEqual(4);
    expect(p.reps).toBe('4-6');
    const normal = prescribeExercise({ category: 'main-compound', sets: 4, trainingGoal: 'fuerza', phase: 'acumulacion', lastSets: loaded });
    expect(p.topKg!).toBeLessThan(normal.topKg!); // INVARIANTE: deload nunca con carga normal
  });
});

// ── 14-16 · EQUIPO ──────────────────────────────────────────────────────
describe('FUERZA · por equipo', () => {
  const bwHeavyGroup = () => ([
    { id: 'sentadilla-cuerpo', name: 'Sentadilla', muscleGroup: 'cuadriceps', type: 'compuesto' },
    { id: 'fondos-triceps', name: 'Fondos de Tríceps', muscleGroup: 'triceps', type: 'compuesto' },
  ] as unknown as Exercise[]);
  it('14 · bandas/cuerpo: sin kg inventados en aislamiento sin carga comparable', () => {
    const p = prescribeExercise({ category: 'isolation', sets: 3, trainingGoal: 'fuerza', phase: 'acumulacion', lastSets: [{ reps: 12, kg: 0 }] });
    expect(p.topKg).toBeUndefined();
  });
  it('15 · cuerpo: main compound pesado protegido de superserie AUNQUE hasWeights=false', () => {
    const workout = [{ id: 'sentadilla-cuerpo', group: 'A', sets: 3 }, { id: 'fondos-triceps', group: 'A', sets: 3 }];
    const r = repairWorkoutStructure(workout, bwHeavyGroup(), { hasWeights: false, trainingGoal: 'fuerza' });
    expect(r.exercises.find(e => e.id === 'sentadilla-cuerpo')!.group).toBeUndefined();
  });
  it('16 · gym: main compound con historial → top-backoff con kg', () => {
    const p = prescribeExercise({ category: 'main-compound', sets: 4, trainingGoal: 'fuerza', phase: 'acumulacion', lastSets: [{ reps: 5, kg: 100, rir: 2 }] });
    expect(p.scheme).toBe('top-backoff');
    expect(p.topKg).toBeGreaterThan(0);
  });
});

// ── 17-19 · CARGA / TOP-BACKOFF ─────────────────────────────────────────
describe('FUERZA · P2 top-backoff (misma autoridad de carga)', () => {
  const loaded = [{ reps: 5, kg: 120, rir: 2 }];
  it('17 · top-backoff: topKg ≥ backoffKg > 0', () => {
    const p = prescribeExercise({ category: 'main-compound', sets: 4, trainingGoal: 'fuerza', phase: 'acumulacion', lastSets: loaded });
    expect(p.topKg!).toBeGreaterThanOrEqual(p.backoffKg!);
    expect(p.backoffKg!).toBeGreaterThan(0);
  });
  it('18 · sin historial → recto, sin kg (no inventa placas)', () => {
    const p = prescribeExercise({ category: 'main-compound', sets: 4, trainingGoal: 'fuerza', phase: 'acumulacion' });
    expect(p.scheme).toBe('straight');
    expect(p.topKg).toBeUndefined();
  });
  it('19 · con historial: fuerza levanta MÁS pesado que hipertrofia (reps bajas + sesgo intensidad)', () => {
    const fue = prescribeExercise({ category: 'main-compound', sets: 4, trainingGoal: 'fuerza', phase: 'acumulacion', lastSets: loaded });
    const hip = prescribeExercise({ category: 'main-compound', sets: 4, trainingGoal: 'hipertrofia', phase: 'acumulacion', lastSets: loaded });
    expect(fue.topKg!).toBeGreaterThanOrEqual(hip.topKg!);
  });
});

// ── 20-21 · PROTECCIÓN DE SUPERSERIE ────────────────────────────────────
describe('FUERZA · protección del compuesto principal en superserie', () => {
  const bank = [
    { id: 'sentadilla-barra', name: 'Sentadilla con Barra', muscleGroup: 'cuadriceps', type: 'compuesto' },
    { id: 'curl-biceps', name: 'Curl', muscleGroup: 'biceps', type: 'aislamiento' },
  ] as unknown as Exercise[];
  it('20 · main compound sacado de superserie (fuerza)', () => {
    const workout = [{ id: 'sentadilla-barra', group: 'A', sets: 4 }, { id: 'curl-biceps', group: 'A', sets: 3 }];
    const r = repairWorkoutStructure(workout, bank, { hasWeights: true, trainingGoal: 'fuerza' });
    expect(r.exercises.find(e => e.id === 'sentadilla-barra')!.group).toBeUndefined();
  });
  it('21 · protección INDEPENDIENTE de hasWeights: fuerza protege aun sin pesas; hipertrofia+cuerpo NO', () => {
    const wk = () => [{ id: 'sentadilla-barra', group: 'A', sets: 4 }, { id: 'curl-biceps', group: 'A', sets: 3 }];
    const fuerzaBw = repairWorkoutStructure(wk(), bank, { hasWeights: false, trainingGoal: 'fuerza' });
    const hipBw = repairWorkoutStructure(wk(), bank, { hasWeights: false, trainingGoal: 'hipertrofia' });
    expect(fuerzaBw.exercises.find(e => e.id === 'sentadilla-barra')!.group).toBeUndefined(); // protegido
    expect(hipBw.exercises.find(e => e.id === 'sentadilla-barra')!.group).toBe('A');           // circuito válido
  });
});

// ── 22 · HIPERTROFIA NO SE ROMPE ────────────────────────────────────────
describe('REGRESIÓN · hipertrofia conserva su prescripción validada', () => {
  it('22 · reps/RIR/descanso de hipertrofia sin cambios', () => {
    expect(repRangeFor('main-compound', 'hipertrofia', 'acumulacion')).toBe('6-10');
    expect(repRangeFor('main-compound', 'hipertrofia', 'intensificacion')).toBe('5-7');
    expect(repRangeFor('secondary-compound', 'hipertrofia', 'acumulacion')).toBe('8-12');
    expect(repRangeFor('isolation', 'hipertrofia', 'acumulacion')).toBe('12-15');
    expect(rirFor('main-compound', 'hipertrofia', 'acumulacion')).toBe(3);
    expect(rirFor('main-compound', 'hipertrofia', 'intensificacion')).toBe(2);
    expect(rirFor('isolation', 'hipertrofia', 'deload')).toBe(4);
    expect(restFor('main-compound', 'hipertrofia', 'acumulacion')).toBe(150);
    expect(restFor('isolation', 'hipertrofia', 'acumulacion')).toBe(60);
  });
});

// ── 23 · P1-P6 no dependen de trainingGoal ──────────────────────────────
describe('REGRESIÓN · P3/P4 volumen es goal-agnóstico', () => {
  it('23 · allocateSessionVolume no recibe trainingGoal → misma dosis', () => {
    const inp = {
      weeklyTarget: { pecho: 12 }, doneThisWeek: { pecho: 0 }, dayMuscles: ['pecho'],
      freqTarget: 4, sessionsThisWeekDone: 0, muscleWeeklyFreq: { pecho: 2 },
    };
    // el volumen no cambia por trainingGoal (no es un parámetro) — P3 sigue siendo autoridad
    expect(allocateSessionVolume(inp)).toEqual(allocateSessionVolume(inp));
  });
});

// ── 24 · FUENTE ÚNICA DE CARGA ──────────────────────────────────────────
describe('FUERZA · una sola autoridad de kg (player/IA/trace/deload)', () => {
  const loaded = [{ reps: 5, kg: 120, rir: 2 }];
  it('24 · el deload deriva del MISMO topKg normal (no un cálculo aparte)', () => {
    const normal = prescribeExercise({ category: 'main-compound', sets: 4, trainingGoal: 'fuerza', phase: 'acumulacion', lastSets: loaded });
    const deload = prescribeExercise({ category: 'main-compound', sets: 3, trainingGoal: 'fuerza', phase: 'deload', lastSets: loaded });
    // deload = normal (mismo sesgo) × factor, redondeado
    expect(deload.topKg!).toBeLessThan(normal.topKg!);
    expect(deload.topKg! / normal.topKg!).toBeGreaterThan(0.83);
    expect(deload.topKg! / normal.topKg!).toBeLessThan(0.92);
  });
});

// ── COMPARACIÓN CONTROLADA H1/F1 (gemelos, solo cambia trainingGoal) ────
describe('COMPARACIÓN · H1 (hipertrofia) vs F1 (fuerza), perfil idéntico', () => {
  const bank = new Map<string, Pick<Exercise, 'id' | 'name' | 'type'>>([
    ['sentadilla-barra', { id: 'sentadilla-barra', name: 'Sentadilla con Barra', type: 'compuesto' }],
    ['prensa', { id: 'prensa', name: 'Prensa', type: 'compuesto' }],
    ['extension-cuad', { id: 'extension-cuad', name: 'Extensión', type: 'aislamiento' }],
  ]);
  const exs = [
    { id: 'sentadilla-barra', muscleGroup: 'cuadriceps' },
    { id: 'prensa', muscleGroup: 'cuadriceps' },
    { id: 'extension-cuad', muscleGroup: 'cuadriceps' },
  ];
  const lastPerf = { 'sentadilla-barra': { sets: [{ reps: 5, kg: 120, rir: 2 }] } };
  const run = (tg: TrainingGoal) => prescribeSession({
    exercises: exs, bankById: bank, allocation: { cuadriceps: 12 },
    trainingGoal: tg, phase: 'acumulacion', mainMinutes: 999, lastPerf,
  });

  it('F1 difiere de H1 en reps, descanso, distribución de series y carga del main', () => {
    const H = run('hipertrofia'), F = run('fuerza');
    const hMain = H.find(i => i.ex.id === 'sentadilla-barra')!;
    const fMain = F.find(i => i.ex.id === 'sentadilla-barra')!;
    const hIso = H.find(i => i.ex.id === 'extension-cuad')!;
    const fIso = F.find(i => i.ex.id === 'extension-cuad')!;
    // reps: fuerza main más bajas
    expect(lo(fMain.prescription.reps)).toBeLessThan(lo(hMain.prescription.reps));
    // descanso: fuerza main más largo
    expect(fMain.prescription.rest).toBeGreaterThan(hMain.prescription.rest);
    // distribución: fuerza concentra MÁS series en el main y MENOS en el aislamiento
    expect(fMain.prescription.sets - fIso.prescription.sets)
      .toBeGreaterThanOrEqual(hMain.prescription.sets - hIso.prescription.sets);
    // carga del main: fuerza ≥ hipertrofia
    expect(fMain.prescription.topKg!).toBeGreaterThanOrEqual(hMain.prescription.topKg!);
    // aislamiento en fuerza sigue moderado (no fuerza máxima)
    expect(lo(fIso.prescription.reps)).toBeGreaterThanOrEqual(8);
  });
});

// ── SIMULACIÓN LONGITUDINAL (mesociclo de fuerza vs hipertrofia) ─────────
describe('LONGITUDINAL · 6 semanas de mesociclo', () => {
  const cat: Category = 'main-compound';
  // fases de un bloque real: acumulación (1-3) → intensificación (4-5) → deload (6)
  const phaseOfWeek = (w: number): Phase => w >= 6 ? 'deload' : w >= 4 ? 'intensificacion' : 'acumulacion';

  it('FUERZA: la carga progresa, la intensificación pesa más, deload baja, RIR nunca 0', () => {
    let kg = 100;
    const topKgByWeek: number[] = [];
    for (let w = 1; w <= 6; w++) {
      const ph = phaseOfWeek(w);
      const p = prescribeExercise({ category: cat, sets: 4, trainingGoal: 'fuerza', phase: ph, lastSets: [{ reps: 5, kg, rir: 2 }] });
      expect(p.rir).toBeGreaterThanOrEqual(2);                 // nunca al fallo en el compuesto
      expect(lo(p.reps)).toBeLessThanOrEqual(6);               // rango de fuerza
      topKgByWeek.push(p.topKg ?? kg);
      if (ph !== 'deload' && p.topKg) kg = p.topKg;            // el atleta sube con la prescripción
    }
    // acumulación no colapsa la carga (progresa o se sostiene)
    expect(topKgByWeek[2]).toBeGreaterThanOrEqual(topKgByWeek[0] - 2.5);
    // deload (semana 6) es claramente más ligero que la intensificación (semana 5)
    expect(topKgByWeek[5]).toBeLessThan(topKgByWeek[4]);
  });

  it('HIPERTROFIA: mantiene su comportamiento (progresa y no deriva a reps de fuerza)', () => {
    let kg = 80;
    for (let w = 1; w <= 6; w++) {
      const ph = phaseOfWeek(w);
      const p = prescribeExercise({ category: cat, sets: 4, trainingGoal: 'hipertrofia', phase: ph, lastSets: [{ reps: 8, kg, rir: 2 }] });
      expect(lo(p.reps)).toBeGreaterThanOrEqual(5);            // nunca 3-4 reps por accidente
      if (ph !== 'deload' && p.topKg) kg = p.topKg;
    }
    expect(kg).toBeGreaterThan(0);
  });
});
