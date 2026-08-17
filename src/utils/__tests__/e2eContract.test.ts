import { describe, it, expect } from 'vitest';
import { computeProgression } from '../progression';
import { prescribeLoad, estimate1RM, bestE1RMByMuscle, e1RMTrend } from '../loadEngine';
import { mapWorkoutLogRowToSession, mergeWorkoutSessions, type WorkoutLogRow } from '../workoutSync';
import type { CompletedSession, LoggedSet } from '../../types';

// ═══════════════════════════════════════════════════════════════════════════
// E2E CONTRACT · PRESCRITO ≠ EJECUTADO ≠ GUARDADO. Verifica de extremo a extremo
// que una serie sin confirmar no contamina progresión, carga, e1RM ni historial,
// que el flag sobrevive el round-trip, y que no hay duplicación de sesiones.
// ═══════════════════════════════════════════════════════════════════════════

// ── 1. e1RM / analytics ignoran reps unconfirmed ────────────────────────────
describe('e1RM ignora reps unconfirmed (analytics/strength/weak-point)', () => {
  it('estimate1RM excluye series sin confirmar', () => {
    expect(estimate1RM([{ reps: 10, kg: 100, repsUnconfirmed: true }])).toBeNull();
    expect(estimate1RM([{ reps: 10, kg: 100 }])).toBeCloseTo(133.3, 0);
    // mezcla: solo la confirmada cuenta
    expect(estimate1RM([{ reps: 12, kg: 120, repsUnconfirmed: true }, { reps: 8, kg: 100 }])).toBeCloseTo(126.7, 0);
  });
  it('bestE1RMByMuscle no usa la sugerencia como fuerza real', () => {
    const muscleOf = () => 'pecho';
    const out = bestE1RMByMuscle([{ exercise: 'press', sets: [{ reps: 12, kg: 100, repsUnconfirmed: true }] }], muscleOf);
    expect(out.pecho).toBeUndefined(); // sin evidencia real → sin señal de fuerza
  });
  it('e1RMTrend no marca "sube" por reps inventadas', () => {
    const older = [{ exercise: 'press', sets: [{ reps: 8, kg: 100 }] }];
    const recentUnconf = [{ exercise: 'press', sets: [{ reps: 12, kg: 100, repsUnconfirmed: true }] }];
    expect(e1RMTrend(recentUnconf, older)).toBeNull(); // reciente sin evidencia → no comparable
  });
});

// ── 2. Fidelidad de historial: round-trip preserva repsUnconfirmed ──────────
describe('historial fiel: round-trip Supabase preserva repsUnconfirmed', () => {
  const row = (sets: LoggedSet[]): WorkoutLogRow => ({
    date_local: '2026-08-15', completed_at: '2026-08-15T10:00:00.000Z', modality: 'fuerza',
    duration_minutes: 60, exercises_completed: 1, exercises_total: 1,
    exercises: [{ exercise_id: 'press', order: 0, planned: { sets: 3, reps: '8-10' }, performed: { sets, skipped: false } }],
  });
  it('mapWorkoutLogRowToSession conserva el flag en exercises[].sets', () => {
    const s = mapWorkoutLogRowToSession(row([{ reps: 10, kg: 40, repsUnconfirmed: true }]));
    expect(s.exercises?.[0].sets[0].repsUnconfirmed).toBe(true);
  });
  it('serie confirmada no lleva flag', () => {
    const s = mapWorkoutLogRowToSession(row([{ reps: 8, kg: 40 }]));
    expect(s.exercises?.[0].sets[0].repsUnconfirmed).toBeUndefined();
  });
});

// ── 3. Sin duplicación: dedup por completedAtIso (fix completed_at) ─────────
describe('sin duplicación de sesiones (mergeWorkoutSessions)', () => {
  const mk = (iso: string): CompletedSession => ({
    date: '2026-08-15', completedAtIso: iso, modality: 'fuerza', exerciseIds: ['press'],
    durationSeconds: 3600, exercisesCompleted: 1, exercisesTotal: 1,
  });
  it('mismo completedAtIso local↔remote → 1 sola sesión', () => {
    const { merged } = mergeWorkoutSessions([mk('2026-08-15T10:00:00.000Z')], [mk('2026-08-15T10:00:00.000Z')]);
    expect(merged.length).toBe(1);
  });
  it('distinto completedAtIso → 2 (son sesiones distintas)', () => {
    const { merged } = mergeWorkoutSessions([mk('2026-08-15T10:00:00.000Z')], [mk('2026-08-15T11:00:00.000Z')]);
    expect(merged.length).toBe(2);
  });
});

// ── 4. Transición-fuzz E2E: 1200 secuencias sobre el pipeline real ──────────
describe('transition-fuzz E2E (1200 secuencias) — invariantes de estado', () => {
  // PRNG sembrado (reproducible; sin Math.random para que un fallo sea replicable).
  function mulberry32(seed: number) {
    return () => {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  it('ninguna secuencia produce NaN, runaway sin evidencia, ni pierde el flag', () => {
    let checked = 0, holdWhenNoEvidence = 0, timeExact = 0;
    for (let seq = 0; seq < 1200; seq++) {
      const rnd = mulberry32(seq + 1);
      const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
      const range = pick(['6-8', '8-10', '8-12', '10-15', '12-15']);
      const hi = parseInt(range.split('-')[1], 10);
      const baseKg = pick([0, 20, 40, 60, 100]); // 0 = corporal/tiempo
      const isTime = baseKg === 0 && rnd() < 0.5;
      const nSets = 1 + Math.floor(rnd() * 4);

      // Simula la ejecución del player: cada serie es confirmada, unconfirmed, skip o tiempo.
      const sets: Array<LoggedSet | null> = [];
      for (let i = 0; i < nSets; i++) {
        const action = pick(['confirm', 'unconfirm', 'unconfirm', 'skip', isTime ? 'time' : 'confirm']);
        if (action === 'skip') { sets.push(null); continue; }
        if (action === 'time') { sets.push({ reps: Math.floor(rnd() * 60), kg: 0 }); continue; } // segundos reales
        const reps = action === 'unconfirm' ? hi : 1 + Math.floor(rnd() * hi); // unconfirm = tope prescrito
        const set: LoggedSet = { reps, kg: baseKg };
        if (action === 'unconfirm') set.repsUnconfirmed = true;
        sets.push(set);
      }

      // Camino real: filtro reps>0||kg>0 (como perfRecords) preservando el flag.
      const logged = sets.filter((s): s is LoggedSet => !!s && (s.reps > 0 || s.kg > 0));
      if (logged.length === 0) { checked++; continue; }

      const prog = computeProgression(logged, range, 2.5, false);
      const load = prescribeLoad(logged, range, 'equilibrio');

      // INVARIANTES
      expect(prog.kg == null || Number.isFinite(prog.kg)).toBe(true);
      expect(['first-time', 'add-weight', 'add-reps', 'add-tension', 'add-difficulty', 'hold']).toContain(prog.action);
      if (load) {
        expect(Number.isFinite(load.topKg) && load.topKg > 0).toBe(true);
        expect(Number.isFinite(load.backoffKg)).toBe(true);
      }
      // flag preservado (no se pierde en el filtro)
      for (let i = 0; i < logged.length; i++) {
        if ((sets.filter(Boolean) as LoggedSet[]).some(s => s.repsUnconfirmed)) {
          expect(logged.some(s => s.repsUnconfirmed)).toBe(true);
          break;
        }
      }
      // sin evidencia confirmada al peso top con carga → progresión NO sube (hold/add-reps, nunca add-weight)
      if (baseKg > 0) {
        const refKg = Math.max(...logged.map(s => s.kg));
        const confirmedAtRef = logged.filter(s => s.kg === refKg && !s.repsUnconfirmed);
        if (confirmedAtRef.length === 0) {
          expect(prog.action).not.toBe('add-weight');
          if (load) expect(load.topKg).toBe(Math.round(refKg / 2.5) * 2.5); // mantiene el peso
          holdWhenNoEvidence++;
        }
      }
      // tiempo: los "segundos" (guardados como reps) son enteros ≥0, nunca NaN
      if (isTime) { expect(logged.every(s => Number.isInteger(s.reps) && s.reps >= 0)).toBe(true); timeExact++; }
      checked++;
    }
    expect(checked).toBe(1200);
    expect(holdWhenNoEvidence).toBeGreaterThan(50); // el caso "sin evidencia" se ejerció de verdad
    expect(timeExact).toBeGreaterThan(10);
  });
});

// ── 5. Mutación de historial: datos corruptos → safe, nunca crash ni progreso inventado ──
describe('mutación de historial persistido — degrada seguro', () => {
  const cases: Array<{ name: string; sets: unknown[] }> = [
    { name: 'reps null', sets: [{ reps: null, kg: 40 }] },
    { name: 'kg null', sets: [{ reps: 8, kg: null }] },
    { name: 'reps NaN', sets: [{ reps: NaN, kg: 40 }] },
    { name: 'kg NaN', sets: [{ reps: 8, kg: NaN }] },
    { name: 'reps negativo', sets: [{ reps: -5, kg: 40 }] },
    { name: 'kg negativo', sets: [{ reps: 8, kg: -40 }] },
    { name: 'repsUnconfirmed sin reps', sets: [{ kg: 40, repsUnconfirmed: true }] },
    { name: 'objeto vacío', sets: [{}] },
    { name: 'todo undefined', sets: [{ reps: undefined, kg: undefined }] },
  ];
  for (const c of cases) {
    it(`${c.name} → sin crash, sin add-weight inventado`, () => {
      const sets = c.sets as { reps: number; kg: number; repsUnconfirmed?: boolean }[];
      expect(() => {
        const prog = computeProgression(sets, '8-10', 2.5, false);
        const load = prescribeLoad(sets, '8-10', 'equilibrio');
        const e = estimate1RM(sets);
        // nunca NaN, nunca inventa carga
        expect(prog.kg == null || Number.isFinite(prog.kg)).toBe(true);
        expect(load == null || (Number.isFinite(load.topKg) && load.topKg > 0)).toBe(true);
        expect(e == null || Number.isFinite(e)).toBe(true);
      }).not.toThrow();
    });
  }
  it('mezcla de una serie válida confirmada + basura → usa solo la válida', () => {
    const sets = [{ reps: 10, kg: 40 }, { reps: NaN, kg: 40 }, { reps: 8, kg: null as unknown as number }];
    const prog = computeProgression(sets, '8-10', 2.5, false);
    expect(prog.action).toBe('add-weight'); // la serie válida (10@40) manda; la basura se filtra
    expect(prog.kg).toBe(42.5);
  });
});
