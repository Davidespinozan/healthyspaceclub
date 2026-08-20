import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// ═══════════════════════════════════════════════════════════════════════════
// F2C-2 · WorkoutPlayer UX cardio-nativa (solo presentación): título humano del bloque, sin
// reps/kg/"series". Logging/timer/completion no se testean aquí (no se tocaron); valida el RENDER
// de la fase 'exercise' de un cardio.
// ═══════════════════════════════════════════════════════════════════════════
vi.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ in: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }) },
}));

import WorkoutPlayer from '../WorkoutPlayer';
import { cardioBlocksToExercises } from '../../utils/cardioMain';
import { useAppStore } from '../../store';
import type { Exercise } from '../../types';
import type { CachedWorkout } from '../../utils/workoutCache';

const bank = [
  { id: 'bici', name: 'Bicicleta Estática', desc: '', muscleGroup: 'cardio', equipment: ['gym'], goals: ['resistencia'], type: 'cardio', difficulty: 'intermedio', defaultSets: 1, defaultReps: '20 min', defaultRest: 0, steps: [] },
] as unknown as Exercise[];

const cardioPlan = {
  style: 'lowImpact', budgetMinutes: 20, totalMinutes: 20, intenseMinutes: 0, steadyMinutes: 20, earlyEnd: false,
  blocks: [{ kind: 'steady', minutes: 20, stationId: 'bici', intensity: 'baja', labelKey: 'cardio.steady', zone: 'Zona 2', rpe: 3, cue: '' }],
} as never;
const cardioWorkout = {
  type: 'cardio', intensity: 'media', exercises: cardioBlocksToExercises(cardioPlan), warmup: '', cooldown: '', note: '',
  cardioMainBlock: { style: 'lowImpact', totalMinutes: 20, intenseMinutes: 0, earlyEnd: false, blocks: [{ kind: 'steady', minutes: 20, stationId: 'bici', stationName: 'Bicicleta Estática', intensity: 'baja', labelKey: 'cardio.steady', zone: 'Zona 2', rpe: 3 }] },
} as unknown as CachedWorkout;

const noop = () => {};
beforeEach(() => {
  useAppStore.setState({ language: 'es', user: null, lastExercisePerformance: {} } as never);
  try { localStorage.clear(); } catch { /* noop */ }
  cleanup();
});

describe('WorkoutPlayer · fase exercise de un cardio', () => {
  const renderCardio = () => render(
    <WorkoutPlayer workout={cardioWorkout} exerciseBank={bank} userEquipment={['gym']} onComplete={noop} onClose={noop} />,
  );
  it('título HUMANO del bloque (no el stationId técnico)', () => {
    renderCardio();
    const h2 = document.querySelector('.wp-ex-name') as HTMLElement;
    expect(h2.textContent).toBe('Cardio sostenible');       // cardioBlockTitleKey(lowImpact steady)
    expect(h2.textContent).not.toContain('Bicicleta');       // NO el nombre del station
  });
  it('duración del bloque visible (no "Series · N × …")', () => {
    renderCardio();
    expect(screen.getAllByText(/20 min/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Series ·/)).not.toBeInTheDocument();
  });
  it('sin nomenclatura de carga: no "kg" en la vista de ejercicio', () => {
    renderCardio();
    const view = document.querySelector('.wp-ex-info')?.parentElement as HTMLElement;
    expect(view.textContent ?? '').not.toMatch(/kg/i);
  });
});
