// ─────────────────────────────────────────────────────────────────────────
// harness — SIMULACIÓN / STRESS TEST del coach P1–P6 (herramienta de validación).
//
// Compone las FUNCIONES REALES del coach (mismos motores que llegan al usuario) sobre
// un atleta sintético con "capacidad real oculta" que el coach NO ve. Simula semanas,
// genera reps/RIR plausibles, retroalimenta con el MISMO formato de la app y audita las
// decisiones longitudinales. No es un modelo fisiológico: es un test de comportamiento
// del software. Objetivo: intentar ROMPER el coach.
//
// Fidelidad: replica la composición determinista de DailyTrainer.handleGenerate. El
// `workoutLog` del store NUNCA se escribe en producción (addWorkoutEntry no tiene callers)
// → aquí también va vacío, para reproducir el comportamiento REAL (e1RMTrend/weak-point/
// isNewUser dependen de él). El volumen se mide como en la app: exerciseIds × defaultSets.
// ─────────────────────────────────────────────────────────────────────────
import type { CompletedSession, Exercise, LoggedSet } from '../../../types';
import { dayKey } from '../../localDate';
import {
  computeWeeklyVolume, weeklyVolumeSeries, trainingFrequency,
  splitTypesForFrequency, DAY_TYPE_CONFIG, deloadCheck, inDeloadWeek, exerciseCountForDuration,
  levelFromObData as _lvl, normalizeTrainingGoal,
} from '../../workoutPlanner';
import {
  deriveMesocycleState, recoveryFromCheckin, adherenceFrom, volumeTrend,
} from '../../mesocycle';
import { computeVolumeTargets, targetsToMap, type Level } from '../../volumeLandmarks';
import { resolvePriorities, applyMusclePriority, possibleWeakPoint } from '../../musclePriority';
import { computeReadiness, readinessToRecovery, chronicRecoveryTrend, chronicToRecovery, type ReadinessState } from '../../readiness';
import { allocateSessionVolume, prescribeSession, categorize } from '../../sessionPrescription';
import { allocateTime } from '../../sessionBlocks';
import { rirError, type RirObservation } from '../../rirFeedback';
import { e1RMTrend, bestE1RMByMuscle } from '../../loadEngine';
void _lvl;
type MatRir = RirObservation & { exerciseId: string };

// ── PRNG determinista (mulberry32) — reproducible por seed ────────────────────
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// ANCLA al reloj REAL (capturada una vez): los motores del coach usan Date.now()/dayKey
// internamente (deloadCheck, computeWeeklyVolume, inDeloadWeek…), así que el harness DEBE
// datar su historial relativo a ese mismo reloj o las ventanas se desalinean. La
// reproducibilidad la da el PRNG por seed, no una fecha fija. Se usa el MISMO dayKey que los
// motores para que las comparaciones de strings de fecha coincidan exactamente.
const REAL_NOW = Date.now();
const dayKeyOffset = (daysAgo: number): string => dayKey(new Date(REAL_NOW - daysAgo * 86400000));

// ── Banco sintético mínimo (1 compuesto + 1 accesorio por músculo) ────────────
const ex = (id: string, type: string, muscleGroup: string, defaultSets = 3): Exercise =>
  ({ id, name: id, type, muscleGroup, defaultSets, equipment: [], secondaryMuscles: [] } as unknown as Exercise);

export const SIM_BANK: Exercise[] = [
  ex('press-banca-barra', 'compuesto', 'pecho'), ex('aperturas-mancuerna', 'aislamiento', 'pecho'),
  ex('remo-barra', 'compuesto', 'espalda'), ex('jalon-polea', 'aislamiento', 'espalda'),
  ex('press-militar-barra', 'compuesto', 'hombros'), ex('elevacion-lateral', 'aislamiento', 'hombros'),
  ex('sentadilla-barra', 'compuesto', 'cuadriceps'), ex('extension-cuadriceps', 'aislamiento', 'cuadriceps'),
  ex('peso-muerto-rumano', 'compuesto', 'isquios'), ex('curl-femoral', 'aislamiento', 'isquios'),
  ex('hip-thrust', 'compuesto', 'gluteo'), ex('patada-gluteo', 'aislamiento', 'gluteo'),
  ex('curl-barra', 'aislamiento', 'biceps'), ex('press-frances', 'aislamiento', 'triceps'),
  ex('elevacion-talones', 'aislamiento', 'pantorrillas'), ex('plancha', 'core', 'core'),
];
const BY_MUSCLE = new Map<string, Exercise[]>();
for (const e of SIM_BANK) { (BY_MUSCLE.get(e.muscleGroup) ?? BY_MUSCLE.set(e.muscleGroup, []).get(e.muscleGroup)!).push(e); }
const bankById = new Map(SIM_BANK.map(e => [e.id, { id: e.id, name: e.name, type: e.type }]));
const MAIN_COMPOUNDS = SIM_BANK.filter(e => categorize({ id: e.id, name: e.name, type: e.type }) === 'main-compound').map(e => e.id);
const isMainCompound = (id: string) => MAIN_COMPOUNDS.includes(id);

// ── Perfil y atleta sintético ─────────────────────────────────────────────────
export interface Profile {
  name: string; level: Level; goal: string; daysPerWeek: number; minutes: number;
  equipment: 'gym' | 'casa' | 'bandas';
  priorities?: string[];
  adherence: number;          // prob de completar una sesión planeada (0..1)
  adaptRate: number;          // ganancia de fuerza por sesión efectiva
  recoveryQuality: number;    // 0..1 (disipa fatiga)
}
interface Hidden {
  trueE1RM: Record<string, number>;  // capacidad real por compuesto (kg)
  fatigue: number;                    // 0..1
}
export interface SimEvent { badNight?: boolean; greatRecovery?: boolean; forceSkip?: boolean; rirAnomaly?: number; stagnate?: boolean; }

const hasKg = (p: Profile) => p.equipment === 'gym';

function newAthlete(p: Profile, r: () => number): Hidden {
  const base = p.level === 'avanzado' ? 130 : p.level === 'intermedio' ? 90 : 55;
  const trueE1RM: Record<string, number> = {};
  for (const id of MAIN_COMPOUNDS) trueE1RM[id] = base * (0.85 + 0.3 * r());
  return { trueE1RM, fatigue: 0.1 + 0.1 * r() };
}

// ── Estado persistente (mismas formas que la app) ─────────────────────────────
interface SimSession { simDay: number; exerciseIds: string[]; loggedSets: (LoggedSet | null)[]; durationSeconds: number; isDeload: boolean; exercises: { id: string; sets: LoggedSet[] }[]; }
export interface SimState {
  sessions: SimSession[];
  lastPerf: Record<string, { simDay: number; sets: LoggedSet[] }>;
  rirLog: { simDay: number; exerciseId: string; prescribedRir: number; actualRir: number; reps: number; kg: number }[];
  readinessLog: { simDay: number; state: ReadinessState }[];
}
const freshState = (): SimState => ({ sessions: [], lastPerf: {}, rirLog: [], readinessLog: [] });

// Materializa el estado con FECHAS relativas al día actual (el coach lee el reloj real).
function materialize(state: SimState, today: number, bank: Exercise[]) {
  const completedSessions: CompletedSession[] = state.sessions.map(s => ({
    date: dayKeyOffset(today - s.simDay), completedAtIso: new Date(REAL_NOW - (today - s.simDay) * 86400000).toISOString(),
    modality: 'fuerza' as const, exerciseIds: s.exerciseIds, durationSeconds: s.durationSeconds,
    exercisesCompleted: s.exerciseIds.length, exercisesTotal: s.exerciseIds.length, loggedSets: s.loggedSets,
    isDeload: s.isDeload, // P1 · fuente de verdad del inicio de bloque
    exercises: s.exercises, // D5 · historial por-ejercicio (P1·e1RMTrend / P5·weak-point)
  }));
  const lastPerf: Record<string, { sets: { reps: number; kg: number; rir?: number }[] }> = {};
  for (const [id, v] of Object.entries(state.lastPerf)) lastPerf[id] = { sets: v.sets };
  const rirLog: MatRir[] = state.rirLog.map(o => ({ date: dayKeyOffset(today - o.simDay), exerciseId: o.exerciseId, prescribedRir: o.prescribedRir, actualRir: o.actualRir, reps: o.reps, kg: o.kg }));
  const readinessLog = state.readinessLog.map(r => ({ date: dayKeyOffset(today - r.simDay), state: r.state }));
  void bank;
  return { completedSessions, lastPerf, rirLog, readinessLog };
}

// ── Un día de coach: replica handleGenerate (parte determinista) ──────────────
export interface DayResult {
  meso: ReturnType<typeof deriveMesocycleState>;
  readiness: ReturnType<typeof computeReadiness>;
  chronic: 'declining' | 'stable' | 'improving';
  targets: ReturnType<typeof computeVolumeTargets>;
  priorities: Record<string, 'none' | 'moderate' | 'high'>;
  allocation: Record<string, number>;
  time: { warmup: number; main: number; finisher: number };
  items: ReturnType<typeof prescribeSession>;
  dayMuscles: string[];
  dosingRecovery: string;
}

export function coachDay(p: Profile, state: SimState, today: number, dayMuscles: string[], checkin: { energy?: string; sleep?: string; soreness?: string }): DayResult {
  const { completedSessions, lastPerf, rirLog, readinessLog } = materialize(state, today, SIM_BANK);
  const workoutLog: [] = []; // vacío en producción (fiel)
  const obData = { nivel: p.level } as Record<string, string | number>;

  // Readiness aguda
  const readiness = computeReadiness({ energy: checkin.energy as never, sleep: checkin.sleep as never, soreness: checkin.soreness as never });
  const todayRecovery = readinessToRecovery(readiness.state);

  // Mesociclo (crónico) — weeksAccumulated ya resetea tras un deload; inDeloadWeek mantiene
  // la descarga durante su semana.
  const { weeksAccumulated } = deloadCheck(completedSessions, workoutLog);
  const inDeload = inDeloadWeek(completedSessions);
  const sum = (v: Record<string, number>) => Object.values(v).reduce((a, b) => a + b, 0);
  const setsLast7 = sum(computeWeeklyVolume(completedSessions, SIM_BANK, 7, workoutLog));
  const setsPrev7 = sum(computeWeeklyVolume(completedSessions, SIM_BANK, 14, workoutLog)) - setsLast7;
  const last7 = new Set(completedSessions.filter(s => s.date > dayKeyOffset(7)).map(s => s.date));
  const freq = trainingFrequency(completedSessions, workoutLog);
  // D5 · tendencia de FUERZA real desde completedSessions[].exercises (excluye deload), como en
  // producción; cae a volumen si no hay carga comparable.
  const strengthEntries = (loDays: number, hiDays: number) => completedSessions
    .filter(s => !s.isDeload && s.date >= dayKeyOffset(hiDays) && (loDays === 0 || s.date < dayKeyOffset(loDays)))
    .flatMap(s => (s.exercises ?? []).map(e => ({ exercise: e.id, sets: e.sets })));
  const performance = e1RMTrend(strengthEntries(0, 14), strengthEntries(14, 28)) ?? volumeTrend(setsLast7, setsPrev7);
  const rirBySession = new Map<string, number[]>();
  for (const o of rirLog) { const k = (o as { date: string }).date; (rirBySession.get(k) ?? rirBySession.set(k, []).get(k)!).push(rirError(o)); }
  const rirErrors = [...rirBySession.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([, e]) => e.reduce((a, b) => a + b, 0) / e.length);
  const chronic = chronicRecoveryTrend({ recentReadiness: [...readinessLog].sort((a, b) => b.date.localeCompare(a.date)).map(r => r.state), rirErrors, performance });
  const meso = deriveMesocycleState({
    weeksAccumulated, recovery: chronicToRecovery(chronic, recoveryFromCheckin('', '')),
    adherence: adherenceFrom(last7.size, freq), performance, inDeloadWeek: inDeload,
  });
  const mesoDeload = meso.deload;

  // P3 target + P5 prioridad
  const series = weeklyVolumeSeries(completedSessions, SIM_BANK, workoutLog, 4);
  const p3 = computeVolumeTargets({
    weeklyVolumes: series, level: p.level, weeksOfHistory: series.filter(w => Object.keys(w).length > 0).length,
    recovery: meso.signals.recovery, performance: meso.signals.performance, adherence: meso.signals.adherence,
    volumeMultiplier: meso.volumeMultiplier, isDeload: mesoDeload,
  });
  // D5 · e1RM por músculo por semana desde el historial real (completedSessions[].exercises).
  const muscleOfId = (id: string) => SIM_BANK.find(e => e.id === id)?.muscleGroup;
  const muscleE1RM: Record<string, number[]> = {};
  for (let wk = 1; wk <= 4; wk++) {
    const hi = dayKeyOffset(wk * 7 - 7), lo = dayKeyOffset(wk * 7);
    const entries = completedSessions.filter(s => !s.isDeload && s.date > lo && s.date <= hi)
      .flatMap(s => (s.exercises ?? []).map(e => ({ exercise: e.id, sets: e.sets })));
    const byM = bestE1RMByMuscle(entries, muscleOfId);
    for (const m of Object.keys(byM)) (muscleE1RM[m] ??= []).push(byM[m]);
  }
  const inferred = possibleWeakPoint({ series, targets: targetsToMap(p3), muscleE1RM, adherence: meso.signals.adherence });
  const priorities = resolvePriorities({ explicit: p.priorities ?? [], inferred, recovery: meso.signals.recovery, isDeload: mesoDeload, shortSession: p.minutes <= 35 });
  const targets = applyMusclePriority(p3, priorities);
  const priorityMuscles = new Set(Object.keys(priorities));

  // Tiempo
  const time = allocateTime({ totalMinutes: p.minutes, isStrengthDay: true, objective: p.goal, isDeload: mesoDeload });

  // Ejercicios del día: compuestos primero, luego accesorios; CAP por tiempo igual que la
  // app (targetCount = exerciseCountForDuration(main) × volumeMultiplier, mín 3). Sin este
  // tope el harness sobrellenaría la sesión (la app lo aplica antes de prescribir).
  const compounds: { id: string; muscleGroup: string }[] = [];
  const accessories: { id: string; muscleGroup: string }[] = [];
  for (const m of dayMuscles) for (const e of (BY_MUSCLE.get(m) ?? [])) {
    (isMainCompound(e.id) || e.type === 'compuesto' ? compounds : accessories).push({ id: e.id, muscleGroup: m });
  }
  const mainCount = exerciseCountForDuration(time.main);
  const targetCount = Math.max(3, Math.min(Math.round(mainCount * meso.volumeMultiplier), compounds.length + accessories.length));
  const exsWithMuscle = [...compounds, ...accessories].slice(0, targetCount);

  // P4 dosis + P2 carga
  const done7 = computeWeeklyVolume(completedSessions, SIM_BANK, 7, workoutLog);
  const muscleWeeklyFreq: Record<string, number> = {};
  for (const dt of splitTypesForFrequency(freq)) for (const m of (DAY_TYPE_CONFIG[dt]?.muscleGroups ?? [])) muscleWeeklyFreq[m] = (muscleWeeklyFreq[m] ?? 0) + 1;
  const sessionsThisWeekDone = new Set(completedSessions.filter(s => s.date >= dayKeyOffset(6)).map(s => s.date)).size;
  const primaryMuscles = [...new Set([
    ...exsWithMuscle.filter(e => isMainCompound(e.id)).map(e => e.muscleGroup),
    ...[...priorityMuscles].filter(m => exsWithMuscle.some(e => e.muscleGroup === m)),
  ])];
  const rank: Record<string, number> = { mala: 0, media: 1, buena: 2 };
  const dosingRecovery = rank[todayRecovery] <= rank[meso.signals.recovery] ? todayRecovery : meso.signals.recovery;
  const allocation = allocateSessionVolume({
    weeklyTarget: targetsToMap(targets), doneThisWeek: done7, dayMuscles, primaryMuscles,
    freqTarget: freq, sessionsThisWeekDone, muscleWeeklyFreq, recovery: dosingRecovery as never, isDeload: mesoDeload,
  });
  // BLOQUE 2 · carga = una sola autoridad (prescribeLoad RIR-aware); ya no hay calibración aparte.
  const items = prescribeSession({
    exercises: exsWithMuscle, bankById, allocation, trainingGoal: normalizeTrainingGoal(p.goal), phase: meso.phase,
    mainMinutes: time.main, lastPerf,
  });
  void obData;
  return { meso, readiness, chronic, targets, priorities, allocation, time, items, dayMuscles, dosingRecovery };
}

// ── Ejecución sintética de la sesión (reps/RIR plausibles desde capacidad oculta) ──
export function performAndFeedback(p: Profile, hidden: Hidden, state: SimState, today: number, day: DayResult, r: () => number, ev: SimEvent): { totalSets: number; rirErrorsAbs: number[]; skipped: boolean } {
  const loggedSets: (LoggedSet | null)[] = [];
  const exerciseIds: string[] = [];
  const rirErrorsAbs: number[] = [];
  const isDeload = day.meso.deload;
  let totalSets = 0;

  for (const it of day.items) {
    const id = it.ex.id;
    exerciseIds.push(id);
    const sets = it.prescription.sets;
    const repsMid = parseInt(it.prescription.reps) || 8;
    const prescribedRir = it.prescription.rir;
    const kg = it.prescription.topKg; // presente solo en main-compound top-backoff o deload
    // rirRelevant: se deriva igual que en DailyTrainer (no está en la prescription).
    const rirRelevant = it.category === 'main-compound' && it.prescription.scheme === 'top-backoff';
    const perfSets: LoggedSet[] = [];

    for (let s = 0; s < sets; s++) {
      totalSets++;
      if (hasKg(p) && kg && kg > 0 && isMainCompound(id)) {
        const capacity = hidden.trueE1RM[id] * (1 - 0.12 * hidden.fatigue) * (0.97 + 0.06 * r());
        const repsToFailure = Math.max(0, 30 * (capacity / kg - 1));
        let actualReps = Math.min(repsMid, Math.round(repsToFailure));
        if (actualReps < 1) actualReps = Math.max(1, Math.round(repsToFailure));
        let actualRir = Math.max(0, Math.min(4, Math.round(repsToFailure - actualReps)));
        if (ev.rirAnomaly != null && s === 0) actualRir = ev.rirAnomaly; // observación extrema inyectada
        const captureRir = rirRelevant && s === 0; // solo la serie relevante (top set)
        perfSets.push({ reps: actualReps, kg, rir: captureRir ? actualRir : undefined, prescribedRir: captureRir ? prescribedRir : undefined });
        if (captureRir) rirErrorsAbs.push(Math.abs(actualRir - prescribedRir));
      } else {
        // sin kg comparable (casa/bandas/accesorio): reps con ruido, sin RIR de calibración
        const actualReps = Math.max(1, repsMid + Math.round((r() - 0.5) * 4));
        const proxyKg = hasKg(p) && isMainCompound(id) ? Math.round((hidden.trueE1RM[id] * 0.6) / 2.5) * 2.5 : 0;
        perfSets.push({ reps: actualReps, kg: proxyKg });
      }
    }
    loggedSets.push(...perfSets);
  }

  // Vista por-ejercicio de la sesión (D5 · misma fuente que loggedSets) — se guarda SIEMPRE
  // (el consumidor P1/P5 filtra deload). lastPerf/rirLog sí se gatean (deload no contamina).
  const sessionExercises: { id: string; sets: LoggedSet[] }[] = [];
  let cursor = 0;
  for (const it of day.items) {
    const n = it.prescription.sets;
    const slice = loggedSets.slice(cursor, cursor + n).filter((x): x is LoggedSet => !!x && (x.reps > 0 || x.kg > 0));
    cursor += n;
    if (slice.length) sessionExercises.push({ id: it.ex.id, sets: slice });
    if (!isDeload) {
      if (slice.length) state.lastPerf[it.ex.id] = { simDay: today, sets: slice };
      for (const st of slice) if (st.rir != null) state.rirLog.push({ simDay: today, exerciseId: it.ex.id, prescribedRir: st.prescribedRir ?? it.prescription.rir, actualRir: st.rir, reps: st.reps, kg: st.kg });
    }
  }
  state.sessions.push({ simDay: today, exerciseIds, loggedSets, durationSeconds: day.time.main * 60, isDeload, exercises: sessionExercises });
  state.readinessLog.push({ simDay: today, state: day.readiness.state });
  state.rirLog = state.rirLog.slice(-100);
  state.readinessLog = state.readinessLog.slice(-30);

  // Actualiza capacidad oculta (adaptación) + fatiga
  const stim = isDeload ? 0.2 : 1;
  const overreached = hidden.fatigue > 0.85;
  for (const id of MAIN_COMPOUNDS) {
    if (!exerciseIds.includes(id)) continue;
    if (ev.stagnate) continue;
    const delta = overreached ? -0.006 : p.adaptRate * stim * (1 - 0.4 * hidden.fatigue);
    hidden.trueE1RM[id] = Math.max(20, hidden.trueE1RM[id] * (1 + delta));
  }
  hidden.fatigue = Math.min(1, hidden.fatigue + (isDeload ? -0.25 : 0.05 * (totalSets / 12) + 0.02));
  if (ev.greatRecovery) hidden.fatigue = Math.max(0, hidden.fatigue - 0.3);
  if (ev.badNight) hidden.fatigue = Math.min(1, hidden.fatigue + 0.1);
  return { totalSets, rirErrorsAbs, skipped: false };
}

// Disipación de fatiga en días de descanso.
export function restDay(hidden: Hidden, p: Profile) { hidden.fatigue = Math.max(0, hidden.fatigue - 0.25 * p.recoveryQuality); }

// ── Generación de check-in sintético desde fatiga + eventos ───────────────────
export function synthCheckin(hidden: Hidden, ev: SimEvent, r: () => number): { energy?: string; sleep?: string; soreness?: string } {
  if (ev.badNight) return { energy: 'baja', sleep: 'malo', soreness: hidden.fatigue > 0.6 ? 'alta' : 'leve' };
  if (ev.greatRecovery) return { energy: 'alta', sleep: 'bueno', soreness: 'ninguna' };
  // fatiga alta → más probable readiness baja
  const f = hidden.fatigue;
  const roll = r();
  if (f > 0.7 && roll < 0.6) return { energy: 'baja', sleep: roll < 0.3 ? 'malo' : 'normal', soreness: 'alta' };
  if (f < 0.3 && roll < 0.4) return { energy: 'alta', sleep: 'bueno', soreness: 'ninguna' };
  return { energy: 'normal', sleep: 'normal', soreness: f > 0.5 ? 'leve' : 'ninguna' };
}

export { newAthlete, freshState, MAIN_COMPOUNDS, isMainCompound, hasKg };
export type { Hidden };
