import { describe, it, expect } from 'vitest';
import { e1RMTrend, bestE1RMByMuscle } from '../loadEngine';
import { possibleWeakPoint } from '../musclePriority';
import { mapWorkoutLogRowToSession } from '../workoutSync';
import type { CompletedSession } from '../../types';

// BLOQUE 3 (D5/F5) · las rutas que dependían de workoutLog (vacío en producción) ahora leen el
// historial REAL por-ejercicio de completedSessions[].exercises. Sin segunda fuente de verdad:
// exercises es la vista por-ejercicio del MISMO evento que escribe loggedSets.

// Reconstrucción de entradas {exercise, sets} desde completedSessions (igual que DailyTrainer/harness).
const entriesIn = (sessions: CompletedSession[], pred: (s: CompletedSession) => boolean) =>
  sessions.filter(s => !s.isDeload && pred(s)).flatMap(s => (s.exercises ?? []).map(e => ({ exercise: e.id, sets: e.sets })));

const sess = (date: string, exercises: CompletedSession['exercises'], isDeload = false): CompletedSession => ({
  date, completedAtIso: `${date}T12:00:00Z`, modality: 'fuerza', exerciseIds: (exercises ?? []).map(e => e.id),
  durationSeconds: 3000, exercisesCompleted: 1, exercisesTotal: 1, exercises, isDeload,
});

describe('D5 · hidratación conserva el historial por-ejercicio (Supabase → completedSessions.exercises)', () => {
  it('mapWorkoutLogRowToSession puebla exercises (con RIR) desde el jsonb', () => {
    const row = {
      date_local: '2026-08-01', completed_at: '2026-08-01T12:00:00Z', modality: 'fuerza',
      duration_minutes: 50, exercises_completed: 1, exercises_total: 1,
      exercises: [{ exercise_id: 'press-banca', performed: { sets: [{ reps: 5, kg: 100, rir: 2 }, { reps: 5, kg: 100 }] } }],
    };
    const s = mapWorkoutLogRowToSession(row as never);
    expect(s.exercises).toBeDefined();
    expect(s.exercises![0].id).toBe('press-banca');
    expect(s.exercises![0].sets[0].rir).toBe(2); // conserva RIR (para e1RM RIR-aware)
  });
});

describe('D5 · e1RMTrend (P1) se ACTIVA con historial real de completedSessions', () => {
  it('tendencia POSITIVA detectable (mismo ejercicio, más peso reciente)', () => {
    const sessions = [
      sess('2026-08-20', [{ id: 'sentadilla', sets: [{ reps: 5, kg: 110 }] }]),  // reciente
      sess('2026-08-05', [{ id: 'sentadilla', sets: [{ reps: 5, kg: 100 }] }]),  // 14-28d
    ];
    // recientes (0-14d) vs viejos: aquí simplificado por fecha de corte
    const recent = entriesIn(sessions, s => s.date >= '2026-08-14');
    const older = entriesIn(sessions, s => s.date < '2026-08-14');
    expect(e1RMTrend(recent, older)).toBe('sube');
  });
  it('tendencia NEGATIVA detectable', () => {
    const sessions = [
      sess('2026-08-20', [{ id: 'sentadilla', sets: [{ reps: 5, kg: 90 }] }]),
      sess('2026-08-05', [{ id: 'sentadilla', sets: [{ reps: 5, kg: 100 }] }]),
    ];
    expect(e1RMTrend(entriesIn(sessions, s => s.date >= '2026-08-14'), entriesIn(sessions, s => s.date < '2026-08-14'))).toBe('baja');
  });
  it('sesiones de DELOAD (carga ligera) se EXCLUYEN → no fingen una caída', () => {
    const sessions = [
      sess('2026-08-20', [{ id: 'sentadilla', sets: [{ reps: 8, kg: 80 }] }], true), // deload ligero
      sess('2026-08-05', [{ id: 'sentadilla', sets: [{ reps: 5, kg: 100 }] }]),
    ];
    // el deload reciente se excluye → recent queda vacío → null (no 'baja')
    expect(e1RMTrend(entriesIn(sessions, s => s.date >= '2026-08-14'), entriesIn(sessions, s => s.date < '2026-08-14'))).toBeNull();
  });
  it('usuario NUEVO (sin historial) → null (cae a volumen); VETERANO → señal real', () => {
    expect(e1RMTrend([], [])).toBeNull(); // nuevo: sin datos
    const vet = [sess('2026-08-20', [{ id: 'x', sets: [{ reps: 5, kg: 105 }] }]), sess('2026-08-05', [{ id: 'x', sets: [{ reps: 5, kg: 100 }] }])];
    expect(e1RMTrend(entriesIn(vet, s => s.date >= '2026-08-14'), entriesIn(vet, s => s.date < '2026-08-14'))).not.toBeNull();
  });
});

describe('D5 · possibleWeakPoint (P5) puede DISPARAR con evidencia real', () => {
  const muscleOf = (id: string) => ({ 'press-banca': 'pecho', 'remo': 'espalda' } as Record<string, string>)[id];
  const weeks4 = [{ pecho: 12, espalda: 12 }, { pecho: 12, espalda: 12 }, { pecho: 12, espalda: 12 }, { pecho: 12, espalda: 12 }];

  it('e1RM por músculo por semana desde completedSessions → weak-point infiere pecho estancado', () => {
    // pecho plano (100,100,100,100), espalda sube (85→100) durante 4 semanas → pecho rezagado.
    const muscleE1RM: Record<string, number[]> = { pecho: [], espalda: [] };
    const chestKg = [100, 100, 100, 100], backKg = [100, 95, 90, 85]; // reciente→viejo
    for (let wk = 0; wk < 4; wk++) {
      const entries = [{ exercise: 'press-banca', sets: [{ reps: 5, kg: chestKg[wk] }] }, { exercise: 'remo', sets: [{ reps: 5, kg: backKg[wk] }] }];
      const byM = bestE1RMByMuscle(entries, muscleOf);
      for (const m of Object.keys(byM)) muscleE1RM[m].push(byM[m]);
    }
    const wp = possibleWeakPoint({ series: weeks4, targets: { pecho: 12, espalda: 12 }, muscleE1RM, adherence: 'alta' });
    expect(wp).toContain('pecho');
  });

  it('evidencia insuficiente (poco historial) → NO dispara', () => {
    const wp = possibleWeakPoint({ series: [{ pecho: 12 }], targets: { pecho: 12 }, muscleE1RM: { pecho: [100, 100] }, adherence: 'alta' });
    expect(wp).toEqual([]);
  });
});
