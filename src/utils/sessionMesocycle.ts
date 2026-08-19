// ─────────────────────────────────────────────────────────────────────────
// sessionMesocycle — derivación del ESTADO DE MESOCICLO de una sesión (P1/P6).
//
// Es una EXTRACCIÓN VERBATIM del IIFE que vivía dentro de DailyTrainer.handleGenerate: la MISMA
// cadena (deloadCheck → volumen 7/14d → tendencia de fuerza e1RM/volumen → readiness crónica por
// RIR+estado → deriveMesocycleState). No cambia la semántica de P1–P6; solo la encapsula para que la
// generación NORMAL y "Generarme más" (D1) consulten EXACTAMENTE la misma lógica (una sola fuente).
// ─────────────────────────────────────────────────────────────────────────
import { dayKey } from './localDate';
import type { CompletedSession, WorkoutEntry, Exercise } from '../types';
import {
  deloadCheck, inDeloadWeek, computeWeeklyVolume, trainingFrequency,
} from './workoutPlanner';
import { e1RMTrend } from './loadEngine';
import {
  deriveMesocycleState, recoveryFromCheckin, adherenceFrom, volumeTrend,
  type MesocycleState,
} from './mesocycle';
import { chronicRecoveryTrend, chronicToRecovery, type ReadinessState } from './readiness';
import { rirError } from './rirFeedback';

export function deriveSessionMesocycle(input: {
  completedSessions: CompletedSession[];
  workoutLog: WorkoutEntry[];
  exerciseBank: Exercise[];
  rirLog: Array<{ date: string; prescribedRir: number; actualRir: number }>;
  readinessLog: Array<{ date: string; state: ReadinessState }>;
  /** Fallback de recuperación cuando aún no hay evidencia longitudinal (onboarding energy/sleep). */
  fallbackEnergy?: string;
  fallbackSleep?: string;
}): { meso: MesocycleState; chronicTrend: 'declining' | 'stable' | 'improving' } {
  const { completedSessions, workoutLog, exerciseBank, rirLog, readinessLog } = input;
  let chronicTrend: 'declining' | 'stable' | 'improving' = 'stable';

  const { weeksAccumulated } = deloadCheck(completedSessions, workoutLog || []);
  const inDeload = inDeloadWeek(completedSessions); // P1 · seguimos en la semana de descarga
  const sum = (v: Record<string, number>) => Object.values(v).reduce((a, b) => a + b, 0);
  const setsLast7 = sum(computeWeeklyVolume(completedSessions, exerciseBank, 7, workoutLog || []));
  const setsPrev7 = sum(computeWeeklyVolume(completedSessions, exerciseBank, 14, workoutLog || [])) - setsLast7;
  const since = (d: number) => dayKey(new Date(Date.now() - d * 86400000));
  const last7Days = new Set<string>();
  for (const s of completedSessions) if (s.date >= since(7)) last7Days.add(s.date);
  for (const w of (workoutLog || [])) if (w.date >= since(7)) last7Days.add(w.date);
  const freq = trainingFrequency(completedSessions, workoutLog || []);
  // Rendimiento REAL (P2): tendencia de FUERZA (e1RM del mismo ejercicio, 14d vs 14-28d).
  const strengthEntries = (loDays: number, hiDays: number) => completedSessions
    .filter(s => !s.isDeload && s.date >= since(hiDays) && (loDays === 0 || s.date < since(loDays)))
    .flatMap(s => (s.exercises ?? []).map(e => ({ exercise: e.id, sets: e.sets })));
  const strengthTrend = e1RMTrend(strengthEntries(0, 14), strengthEntries(14, 28));
  const performance = strengthTrend ?? volumeTrend(setsLast7, setsPrev7);

  // P6 · recovery del MESOCICLO = tendencia CRÓNICA (no un día): error de RIR por sesión (media) +
  // estados de readiness recientes + performance. Fallback: check-in previo (comportamiento P1).
  const rirBySession = new Map<string, number[]>();
  for (const o of rirLog) {
    if (!rirBySession.has(o.date)) rirBySession.set(o.date, []);
    rirBySession.get(o.date)!.push(rirError(o));
  }
  const rirErrors = [...rirBySession.entries()].sort((a, b) => b[0].localeCompare(a[0]))
    .map(([, errs]) => errs.reduce((a, b) => a + b, 0) / errs.length);
  const chronic = chronicRecoveryTrend({
    recentReadiness: [...readinessLog].sort((a, b) => b.date.localeCompare(a.date)).map(r => r.state),
    rirErrors, performance,
  });
  chronicTrend = chronic;
  const fallbackRecovery = recoveryFromCheckin(String(input.fallbackEnergy ?? ''), String(input.fallbackSleep ?? ''));
  const meso = deriveMesocycleState({
    weeksAccumulated,
    recovery: chronicToRecovery(chronic, fallbackRecovery),
    adherence: adherenceFrom(last7Days.size, freq),
    performance,
    inDeloadWeek: inDeload,
  });
  return { meso, chronicTrend };
}
