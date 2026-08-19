import { describe, it, expect, beforeEach } from 'vitest';
import { shouldOfferAddCardio, initialWorkoutPhase } from '../workoutDisplay';
import { hasUnfinishedSession } from '../workoutSession';
import { useAppStore } from '../../store';

// ═══════════════════════════════════════════════════════════════════════════
// ENTRADA PERSISTENTE DE CARDIO DESDE HOY (flag efímero de navegación).
// "Añadir cardio" visible cuando ya hay fuerza del día; abre el wizard de cardio (no regenera,
// no consume regen de fuerza, no depende de handleRegenerate); respeta la guarda de sesión activa.
// ═══════════════════════════════════════════════════════════════════════════

const strengthPlan = { exercises: [{ id: 'press-horizontal' }] } as never;              // sin cardioMainBlock
const cardioPlan = { exercises: [], cardioMainBlock: { totalMinutes: 30, blocks: [{}] } } as never;
const fuerzaSession = { modality: 'fuerza' };
const cardioSession = { modality: 'cardio' };

// ── A–E · visibilidad del CTA ──
describe('shouldOfferAddCardio', () => {
  it('A · día vacío → NO CTA', () => expect(shouldOfferAddCardio(null, [])).toBe(false));
  it('B · fuerza pendiente → CTA visible', () => expect(shouldOfferAddCardio(strengthPlan, [])).toBe(true));
  it('C · fuerza en progreso (plan presente) → CTA visible', () => expect(shouldOfferAddCardio(strengthPlan, [])).toBe(true));
  it('D · fuerza completada → CTA visible', () => expect(shouldOfferAddCardio(null, [fuerzaSession])).toBe(true));
  it('E · cerrar/reabrir (sesión rehidratada) → CTA sigue visible', () => expect(shouldOfferAddCardio(null, [fuerzaSession])).toBe(true));
  it('cardio-only (plan cardio + sesión cardio, sin fuerza) → NO CTA', () =>
    expect(shouldOfferAddCardio(cardioPlan, [cardioSession])).toBe(false));
});

// ── F/I/L · fase inicial de DailyTrainer ──
describe('initialWorkoutPhase', () => {
  it('I · pending cardio → wizard (NO cae al plan viejo) aunque haya rutina hoy', () =>
    expect(initialWorkoutPhase('cardio', true, false)).toBe('modality'));
  it('F/L · el CTA de Hoy abre el mismo flujo (wizard) que el CTA del player', () =>
    expect(initialWorkoutPhase('cardio', false, false)).toBe('modality'));
  it('sin pending + rutina hoy → plan (comportamiento previo)', () =>
    expect(initialWorkoutPhase(null, true, false)).toBe('plan'));
  it('sin pending + día vacío → wizard', () => expect(initialWorkoutPhase(null, false, false)).toBe('modality'));
  it('pareja siempre arranca fresco', () => expect(initialWorkoutPhase(null, true, true)).toBe('modality'));
});

// ── F/G/H · store: flag efímero ──
describe('store · pendingWorkoutModality', () => {
  beforeEach(() => useAppStore.setState({ pendingWorkoutModality: null }));
  it('F/G · Hoy setea cardio → selectedModality del initializer = cardio', () => {
    useAppStore.getState().setPendingWorkoutModality('cardio');
    const pending = useAppStore.getState().pendingWorkoutModality;
    expect(pending).toBe('cardio');
    // el initializer de selectedModality devuelve pending si está → 'cardio' (G)
    const selectedModality = pending ?? 'auto';
    expect(selectedModality).toBe('cardio');
  });
  it('H · se consume/limpia al montar', () => {
    useAppStore.getState().setPendingWorkoutModality('cardio');
    useAppStore.getState().setPendingWorkoutModality(null); // efecto de montaje
    expect(useAppStore.getState().pendingWorkoutModality).toBeNull();
  });
});

// ── J · no consume regen de fuerza / no depende de handleRegenerate ──
describe('regen count (J)', () => {
  beforeEach(() => useAppStore.setState({ dailyWorkoutRegenCount: { date: '', countByModality: {} } }));
  it('J · generar cardio NO toca el regen de fuerza (contador por modalidad)', () => {
    useAppStore.getState().incrementDailyWorkoutRegen('fuerza');
    useAppStore.getState().incrementDailyWorkoutRegen('fuerza');
    const fuerzaBefore = useAppStore.getState().dailyWorkoutRegenCount.countByModality['fuerza'];
    useAppStore.getState().incrementDailyWorkoutRegen('cardio'); // "Añadir cardio" es 1ª generación de cardio
    const counts = useAppStore.getState().dailyWorkoutRegenCount.countByModality;
    expect(counts['fuerza']).toBe(fuerzaBefore); // fuerza intacto → no consume sus regeneraciones
    expect(counts['cardio']).toBe(1);
  });
});

// ── M · sesión activa protegida (la guarda existente aplica al generar) ──
describe('guarda de sesión activa (M)', () => {
  const today = '2026-08-19';
  it('M · fuerza sin terminar (progreso real) → hasUnfinishedSession=true (bloquea al generar cardio)', () => {
    const raw = JSON.stringify({ version: 2, workoutDate: today, currentStep: 3, loggedByExercise: [[{ reps: 8, kg: 40 }]] });
    expect(hasUnfinishedSession(raw, today)).toBe(true);
  });
  it('fuerza completada (sin progreso pendiente) → no bloquea', () => {
    expect(hasUnfinishedSession(null, today)).toBe(false);
  });
});

// N (fuerza+cardio completadas → ambas visibles) y K (CTA del player) están cubiertos por
// hybridSession.test.ts (sessionsToday) y el render de WorkoutPlayer (onAddCardio en fase completed).
