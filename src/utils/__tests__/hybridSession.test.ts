import { describe, it, expect } from 'vitest';
import { hasUnfinishedSession } from '../workoutSession';
import { isCardioPlan } from '../workoutDisplay';
import { computeWeeklyVolume } from '../workoutPlanner';
import { computeStreak } from '../streak';
import { mergeWorkoutSessions } from '../workoutSync';
import { exercises as BANK } from '../../data/exercises';
import { dayKey } from '../localDate';
import type { CompletedSession } from '../../types';

// ═══════════════════════════════════════════════════════════════════════════
// SESIÓN HÍBRIDA (mínima, secuencial): Fuerza completada → Añadir cardio → completar.
// Ambas quedan como CompletedSessions independientes; guarda de "una sesión a la vez".
// ═══════════════════════════════════════════════════════════════════════════

const today = dayKey(new Date());

// ── Guarda de sesión activa (N, CASO C) ──
describe('guard · hasUnfinishedSession', () => {
  const mk = (o: object) => JSON.stringify({ version: 2, workoutDate: today, ...o });
  it('null → false', () => expect(hasUnfinishedSession(null, today)).toBe(false));
  it('N/CasoC · progreso real (currentStep>0) → true (bloquea)', () =>
    expect(hasUnfinishedSession(mk({ currentStep: 2, loggedByExercise: [[null]] }), today)).toBe(true));
  it('serie logueada → true', () =>
    expect(hasUnfinishedSession(mk({ currentStep: 0, loggedByExercise: [[{ reps: 10, kg: 20 }]] }), today)).toBe(true));
  it('abierto SIN progreso (step 0, log vacío) → false (no bloquea)', () =>
    expect(hasUnfinishedSession(mk({ currentStep: 0, loggedByExercise: [[null, null]] }), today)).toBe(false));
  it('sesión de OTRO día → false', () =>
    expect(hasUnfinishedSession(JSON.stringify({ version: 2, workoutDate: '2000-01-01', currentStep: 5 }), today)).toBe(false));
  it('JSON malformado → false', () => expect(hasUnfinishedSession('{bad', today)).toBe(false));
});

// ── CTA "Añadir cardio": aparece tras fuerza (K), no tras cardio (L) ──
describe('CTA "Añadir cardio" · gating', () => {
  it('K · plan de FUERZA → CTA disponible (isCardioPlan=false)', () => {
    expect(isCardioPlan({ type: 'fuerza', exercises: [{ id: 'press-horizontal' }] } as never)).toBe(false);
  });
  it('L · plan de CARDIO → CTA oculto (isCardioPlan=true)', () => {
    expect(isCardioPlan({ type: 'cardio', cardioMainBlock: { blocks: [{ kind: 'steady' }] } } as never)).toBe(true);
  });
});

// ── Flujo de datos (A,B,C,D,E,F,G,H,I,J,M) ──
describe('flujo híbrido secuencial · datos', () => {
  const strength: CompletedSession = {
    sessionId: 's1', date: today, completedAtIso: `${today}T10:00:00.000Z`, modality: 'fuerza',
    exerciseIds: ['press-horizontal'], durationSeconds: 5400, exercisesCompleted: 1, exercisesTotal: 1,
  };
  const cardio: CompletedSession = {
    sessionId: 'c1', date: today, completedAtIso: `${today}T11:00:00.000Z`, modality: 'cardio',
    exerciseIds: ['cardio-maquina'], durationSeconds: 1800, exercisesCompleted: 1, exercisesTotal: 1,
  };
  const sessionsToday = (all: CompletedSession[]) => all.filter(s => s.date === today);

  it('A+C+J · dos sessionsToday tras fuerza+cardio (Hoy muestra ambas)', () => {
    expect(sessionsToday([strength, cardio]).length).toBe(2);
  });
  it('B+M · generar/añadir cardio NO elimina la fuerza (append; cerrar/reabrir la conserva)', () => {
    const after = [strength, cardio];
    expect(after.find(s => s.sessionId === 's1')).toBeTruthy();
    expect(after.length).toBe(2);
  });
  it('D · modalities = fuerza + cardio', () => {
    expect([strength.modality, cardio.modality].sort()).toEqual(['cardio', 'fuerza']);
  });
  it('E · sessionIds distintos', () => {
    expect(strength.sessionId).not.toBe(cardio.sessionId);
  });
  it('F · streak: mismo día cuenta 1 (idempotente)', () => {
    const s1 = computeStreak(3, null, today);              // fuerza: primer activo del día
    expect(s1.changed).toBe(true);
    const s2 = computeStreak(s1.newStreak, today, today);  // cardio: mismo día
    expect(s2.changed).toBe(false);
    expect(s2.newStreak).toBe(s1.newStreak);
  });
  it('G · computeWeeklyVolume: el cardio NO aporta al músculo de fuerza', () => {
    const volStrength = computeWeeklyVolume([strength], BANK);
    const volBoth = computeWeeklyVolume([strength, cardio], BANK);
    expect(volStrength['pecho']).toBeGreaterThan(0);       // la fuerza sí cuenta
    expect(volBoth['pecho']).toBe(volStrength['pecho']);   // añadir cardio no cambia el volumen de pecho
  });
  it('H · minutos de cardio = su durationSeconds propio', () => {
    expect(Math.round(cardio.durationSeconds / 60)).toBe(30);
  });
  it('I · outbox: reintento del mismo sessionId NO duplica', () => {
    const { merged } = mergeWorkoutSessions([strength, cardio], [strength]); // remoto reenvía s1
    expect(merged.filter(s => s.sessionId === 's1').length).toBe(1);
    expect(merged.length).toBe(2);
  });
});
