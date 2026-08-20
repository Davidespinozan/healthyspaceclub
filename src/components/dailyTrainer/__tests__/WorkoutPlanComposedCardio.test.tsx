import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

// ═══════════════════════════════════════════════════════════════════════════
// F2B-1 · WorkoutPlan · bloque 03 · CARDIO + guard anti-duplicado del CTA manual.
//  · composedCardio pending → bloque 03 "Continuar con cardio" (vía persistente, no efímera).
//  · done / sin composedCardio → sin bloque 03.
//  · pending → el WorkoutPlayer NO recibe onAddCardio (manual suprimido, item 11).
// El WorkoutPlayer se stubbea para observar la prop onAddCardio sin arrastrar el player real.
// ═══════════════════════════════════════════════════════════════════════════
vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ in: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }) },
}));
// Stub del player: expone si recibió onAddCardio (botón manual) — sin renderizar el player real.
vi.mock('../../WorkoutPlayer', () => ({
  default: (props: { onAddCardio?: () => void }) => (
    <div data-testid="player-stub">
      {props.onAddCardio ? <button data-testid="manual-add-cardio">add cardio</button> : null}
    </div>
  ),
}));

import WorkoutPlan from '../WorkoutPlan';
import { useAppStore } from '../../../store';
import type { Exercise, WorkoutDayDecision, Equipment, Modality } from '../../../types';
import type { CachedWorkout } from '../../../utils/workoutCache';

const bank = [
  { id: 'press-banca', name: 'Press Banca', desc: '', muscleGroup: 'pecho', equipment: ['gym'], goals: ['hipertrofia'], type: 'compuesto', difficulty: 'intermedio', defaultSets: 4, defaultReps: '8', defaultRest: 120, steps: [] },
  { id: 'remo', name: 'Remo', desc: '', muscleGroup: 'espalda', equipment: ['gym'], goals: ['hipertrofia'], type: 'compuesto', difficulty: 'intermedio', defaultSets: 3, defaultReps: '10', defaultRest: 90, steps: [] },
] as unknown as Exercise[];
const decision = { type: 'upper', reason: '', source: 'auto' } as unknown as WorkoutDayDecision;

const strengthPlan = (composedCardio?: CachedWorkout['composedCardio']): CachedWorkout & { razon?: string } => ({
  type: 'upper', intensity: 'media',
  exercises: [{ id: 'press-banca', sets: 4, reps: '8', rest: 120 }, { id: 'remo', sets: 3, reps: '10', rest: 90 }],
  warmup: '', cooldown: '', note: '',
  ...(composedCardio ? { composedCardio } : {}),
});
const cardioWorkout: CachedWorkout = { type: 'cardio', intensity: 'media', exercises: [{ id: 'x', sets: 1, reps: '20 min', rest: 0 }], warmup: '', cooldown: '', note: '' };

const props = (plan: CachedWorkout & { razon?: string }, buildCC = vi.fn(() => cardioWorkout)) => ({
  plan, regenBlocked: false, regensLeft: 3,
  selectedEquipment: 'gym' as Equipment, selectedModality: 'fuerza' as Modality, selectedTime: 120,
  todayDecision: decision, exerciseBank: bank,
  addCompletedSession: () => {}, markActiveDay: async () => {}, onRegenerate: () => {},
  todayDayName: 'Lunes', todayDateShort: '19 ago',
  onAddCardio: vi.fn(), buildComposedCardio: buildCC, onComposedCardioDone: vi.fn(),
});

beforeEach(() => { useAppStore.setState({ language: 'es' } as never); cleanup(); });

describe('bloque 03 · CARDIO (vía persistente)', () => {
  it('composedCardio pending → CTA "Continuar con cardio" presente; click construye el cardio sellado', () => {
    const buildCC = vi.fn(() => cardioWorkout);
    render(<WorkoutPlan {...props(strengthPlan({ minutes: 20, style: 'lowImpact', intensityCeiling: 'zona2' }), buildCC)} />);
    const cta = screen.getByText(/Continuar con cardio/i);
    expect(cta).toBeInTheDocument();
    fireEvent.click(cta);
    expect(buildCC).toHaveBeenCalledTimes(1);
    expect(buildCC).toHaveBeenCalledWith({ minutes: 20, style: 'lowImpact', intensityCeiling: 'zona2' });
  });
  it('composedCardio done=true → sin bloque 03', () => {
    render(<WorkoutPlan {...props(strengthPlan({ minutes: 20, style: 'lowImpact', intensityCeiling: 'zona2', done: true }))} />);
    expect(screen.queryByText(/Continuar con cardio/i)).not.toBeInTheDocument();
  });
  it('sin composedCardio → sin bloque 03', () => {
    render(<WorkoutPlan {...props(strengthPlan())} />);
    expect(screen.queryByText(/Continuar con cardio/i)).not.toBeInTheDocument();
  });
});

describe('guard anti-duplicado · onAddCardio (item 11)', () => {
  const openPlayer = () => fireEvent.click(screen.getByText(/comenzar entrenamiento/i));
  it('composedCardio pending → el player NO recibe onAddCardio (manual suprimido)', () => {
    render(<WorkoutPlan {...props(strengthPlan({ minutes: 20, style: 'lowImpact', intensityCeiling: 'zona2' }))} />);
    openPlayer();
    expect(screen.getByTestId('player-stub')).toBeInTheDocument();
    expect(screen.queryByTestId('manual-add-cardio')).not.toBeInTheDocument();
  });
  it('sin composedCardio (o done) → el player SÍ recibe onAddCardio (manual disponible)', () => {
    render(<WorkoutPlan {...props(strengthPlan())} />);
    openPlayer();
    expect(screen.getByTestId('manual-add-cardio')).toBeInTheDocument();
  });
});
