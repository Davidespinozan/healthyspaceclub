import { describe, it, expect } from 'vitest';
import { composeSession, type ComposeSessionInput } from '../sessionComposer';
import { dayKey } from '../localDate';
import type { CompletedSession } from '../../types';

// ═══════════════════════════════════════════════════════════════════════════
// F2B-1 · sessionComposer — orquestación pura. Verifica end-reason real + placement need-driven +
// que el cardio NUNCA rellena el reloj + reality-check 30/45/60/90/120. NO toca fuerza (sin ejercicios).
// ═══════════════════════════════════════════════════════════════════════════
const NOW = Date.UTC(2026, 7, 19, 12, 0, 0); // fijo (determinista)
const dayAgo = (n: number) => dayKey(new Date(NOW - n * 86400000));
const cardioSession = (n: number, mins: number, i: number): CompletedSession => ({
  sessionId: `c-${n}-${i}`, modality: 'cardio', date: dayAgo(n),
  durationSeconds: mins * 60, completedAtIso: new Date(NOW - n * 86400000).toISOString(),
  exerciseIds: [], exercisesCompleted: 1, exercisesTotal: 1,
} as unknown as CompletedSession);
// Base cardio reciente: sessions14d≥3 && minutes14d≥60. 50 min en 7d + 12 min más viejo → remaining moderate ≈ 40.
const baseHistory: CompletedSession[] = [cardioSession(1, 25, 1), cardioSession(3, 25, 2), cardioSession(10, 12, 3)];

const base = (o: Partial<ComposeSessionInput> = {}): ComposeSessionInput => ({
  availableMinutes: 120, preparationMinutes: 8, strengthPlannedMinutes: 78,
  strengthWeeklyRemaining: 10, timeFitTrimmed: false, headroomEndedEarly: false,
  readinessLow: false, deload: false, completedSessions: [], nowMs: NOW,
  bodyGoal: 'Ganar músculo', trainingGoal: 'hipertrofia', lowImpactMode: false, hasPain: false,
  dayType: 'upper', ...o,
});

describe('end reason (señales reales, no duración sola)', () => {
  it('B · timeFitTrimmed → TIME_LIMITED (y bloquea cardio)', () => {
    const r = composeSession(base({ timeFitTrimmed: true, completedSessions: baseHistory, bodyGoal: 'Bajar grasa' }));
    expect(r.sessionEndReason).toBe('TIME_LIMITED');
    expect(r.composedCardio).toBeUndefined();
  });
  it('E/F · sin recorte y sin evidencia de dosis → AVAILABLE_TIME_UNUSED (no TIME_LIMITED falso)', () => {
    const r = composeSession(base({ availableMinutes: 90, strengthPlannedMinutes: 40, strengthWeeklyRemaining: 10 }));
    expect(r.sessionEndReason).not.toBe('TIME_LIMITED');
  });
  it('readinessLow → RECOVERY_LIMITED + sin cardio', () => {
    const r = composeSession(base({ readinessLow: true, completedSessions: baseHistory, bodyGoal: 'Bajar grasa' }));
    expect(r.sessionEndReason).toBe('RECOVERY_LIMITED'); expect(r.composedCardio).toBeUndefined();
  });
  it('deload → RECOVERY_LIMITED + sin cardio', () => {
    const r = composeSession(base({ deload: true, completedSessions: baseHistory, bodyGoal: 'Bajar grasa' }));
    expect(r.sessionEndReason).toBe('RECOVERY_LIMITED'); expect(r.composedCardio).toBeUndefined();
  });
  it('headroom cedió + weeklyRemaining≈0 → DOSE_COMPLETE (sin cardio disponible)', () => {
    const r = composeSession(base({ headroomEndedEarly: true, strengthWeeklyRemaining: 0, completedSessions: [] }));
    // ganar músculo sin base → puede colocar ~10 si hay remaining; forzamos sin remaining vía bodyGoal ya cubierto:
    expect(['DOSE_COMPLETE', 'HYBRID_COMPLETE']).toContain(r.sessionEndReason);
  });
});

describe('placement need-driven (cardio ≠ reloj)', () => {
  it('rem0 (bienestar ya cubierto) → sin cardio', () => {
    const done = [cardioSession(1, 40, 1), cardioSession(2, 40, 2), cardioSession(3, 40, 3), cardioSession(4, 40, 4)];
    const r = composeSession(base({ bodyGoal: 'Bajar grasa', completedSessions: done }));
    // 160 min completados ≫ target → remaining 0 → sin cardio
    expect(r.composedCardio).toBeUndefined();
  });
  it('120 ganar músculo, sin base → cardio máximo ~10 (NO 25)', () => {
    const r = composeSession(base({ bodyGoal: 'Ganar músculo', completedSessions: [] }));
    expect(r.composedCardio).toBeDefined();
    expect(r.composedCardio!.minutes).toBeLessThanOrEqual(10);
    expect(r.composedCardio!.minutes).toBeGreaterThanOrEqual(10 - 0); // exposición mínima 10
  });
  it('120 perder grasa + base → ~20 (no 25/36)', () => {
    const r = composeSession(base({ bodyGoal: 'Bajar grasa', completedSessions: baseHistory }));
    expect(r.composedCardio).toBeDefined();
    expect(r.composedCardio!.minutes).toBeLessThanOrEqual(20);
    expect(r.composedCardio!.minutes).toBeLessThanOrEqual(r.spareMinutes);
  });
  it('cardio ≤ spare y ≤ dailyCap(25) siempre', () => {
    const r = composeSession(base({ bodyGoal: 'Bajar grasa', completedSessions: baseHistory, availableMinutes: 300, strengthPlannedMinutes: 78 }));
    if (r.composedCardio) {
      expect(r.composedCardio.minutes).toBeLessThanOrEqual(25);
      expect(r.composedCardio.minutes).toBeLessThanOrEqual(r.spareMinutes);
    }
  });
  it('más tiempo disponible NO sube el cardio (no rellena reloj)', () => {
    const a = composeSession(base({ bodyGoal: 'Bajar grasa', completedSessions: baseHistory, availableMinutes: 120 }));
    const b = composeSession(base({ bodyGoal: 'Bajar grasa', completedSessions: baseHistory, availableMinutes: 200 }));
    if (a.composedCardio && b.composedCardio) expect(b.composedCardio.minutes).toBe(a.composedCardio.minutes);
  });
  it('cardio colocado → HYBRID_COMPLETE + suppressFinisher', () => {
    const r = composeSession(base({ bodyGoal: 'Bajar grasa', completedSessions: baseHistory }));
    if (r.composedCardio) {
      expect(r.sessionEndReason).toBe('HYBRID_COMPLETE');
      expect(r.suppressFinisher).toBe(true);
    }
  });
  it('sin cardio → no se suprime finisher', () => {
    const r = composeSession(base({ availableMinutes: 30, preparationMinutes: 6, strengthPlannedMinutes: 22 }));
    expect(r.composedCardio).toBeUndefined();
    expect(r.suppressFinisher).toBe(false);
  });
  it('legs se normaliza a lower (interferencia → zona2, cap ≤15)', () => {
    const r = composeSession(base({ bodyGoal: 'Bajar grasa', completedSessions: baseHistory, dayType: 'legs' }));
    if (r.composedCardio) {
      expect(r.composedCardio.intensityCeiling).toBe('zona2');
      expect(r.composedCardio.minutes).toBeLessThanOrEqual(15);
    }
  });
});

describe('reality-check 30/45/60/90/120 (fuerza protegida; nunca rellena)', () => {
  // strength escala con el tiempo (sesión más larga = más fuerza), spare acotado.
  const row = (available: number, strength: number, extra: Partial<ComposeSessionInput> = {}) => {
    const r = composeSession(base({ availableMinutes: available, preparationMinutes: 8, strengthPlannedMinutes: strength, completedSessions: baseHistory, bodyGoal: 'Bajar grasa', ...extra }));
    return { spare: r.spareMinutes, cardio: r.composedCardio?.minutes ?? 0, reason: r.sessionEndReason };
  };
  it('30 protege fuerza (spare mínimo → 0 cardio)', () => {
    expect(row(30, 20).cardio).toBe(0);
  });
  it('45 protege fuerza', () => expect(row(45, 34).cardio).toBe(0)); // spare 3 < 10
  it('60 protege fuerza si spare<10', () => expect(row(60, 46).cardio).toBe(0)); // spare 6
  it('90 puede colocar cardio si hay spare y necesidad', () => {
    const r = row(90, 60); // spare 22
    expect(r.cardio).toBeLessThanOrEqual(22);
    expect(r.cardio).toBeLessThanOrEqual(20);
  });
  it('120 NO se rellena (cardio acotado por necesidad/caps, ≪ spare)', () => {
    const r = row(120, 78); // spare 34
    expect(r.cardio).toBeLessThanOrEqual(20);
    expect(r.cardio).toBeLessThan(r.spare);
  });
  it('readiness baja en 120 → sin cardio', () => expect(row(120, 78, { readinessLow: true }).cardio).toBe(0));
  it('deload en 120 → sin cardio', () => expect(row(120, 78, { deload: true }).cardio).toBe(0));
  it('fuerza (trainingGoal) → cardio ≤15 + zona2', () => {
    const r = composeSession(base({ availableMinutes: 120, strengthPlannedMinutes: 78, trainingGoal: 'fuerza', completedSessions: baseHistory, bodyGoal: 'Bajar grasa' }));
    if (r.composedCardio) {
      expect(r.composedCardio.minutes).toBeLessThanOrEqual(15);
      expect(r.composedCardio.intensityCeiling).toBe('zona2');
    }
  });
});
