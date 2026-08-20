import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';

// ═══════════════════════════════════════════════════════════════════════════
// F2B-1 UX · WorkoutPlan · bloque 03 CARDIO dentro de la RUTINA (no footer), transición Fuerza→Cardio,
// estado done y guard anti-duplicado del CTA manual. El WorkoutPlayer se stubbea (no se modifica) para
// observar props (onAddCardio) y disparar onComplete sin arrastrar el player real.
// ═══════════════════════════════════════════════════════════════════════════
vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ in: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }) },
}));
// Stub: expone onAddCardio (botón manual) y un "finish" que dispara props.onComplete.
vi.mock('../../WorkoutPlayer', () => ({
  default: (props: { onAddCardio?: () => void; onComplete: (d: unknown) => void }) => (
    <div data-testid="player-stub">
      {props.onAddCardio ? <button data-testid="manual-add-cardio">add cardio</button> : null}
      <button data-testid="finish-player" onClick={() => props.onComplete({ loggedSets: [], exercisesCompleted: 2, exercisesTotal: 2, durationSeconds: 100 })}>finish</button>
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
const spec = { minutes: 20, style: 'lowImpact' as const, intensityCeiling: 'zona2' as const };

const strengthPlan = (composedCardio?: CachedWorkout['composedCardio']): CachedWorkout & { razon?: string } => ({
  type: 'upper', intensity: 'media',
  exercises: [{ id: 'press-banca', sets: 4, reps: '8', rest: 120 }, { id: 'remo', sets: 3, reps: '10', rest: 90 }],
  warmup: '', cooldown: '', note: '',
  ...(composedCardio ? { composedCardio } : {}),
});
const cardioWorkout: CachedWorkout = { type: 'cardio', intensity: 'media', exercises: [{ id: 'x', sets: 1, reps: '20 min', rest: 0 }], warmup: '', cooldown: '', note: '' };

const props = (plan: CachedWorkout & { razon?: string }, extra: Record<string, unknown> = {}) => ({
  plan, regenBlocked: false, regensLeft: 3,
  selectedEquipment: 'gym' as Equipment, selectedModality: 'fuerza' as Modality, selectedTime: 120,
  todayDecision: decision, exerciseBank: bank,
  addCompletedSession: () => {}, markActiveDay: async () => {}, onRegenerate: () => {},
  todayDayName: 'Lunes', todayDateShort: '19 ago',
  onAddCardio: vi.fn(), buildComposedCardio: vi.fn(() => cardioWorkout), onComposedCardioDone: vi.fn(),
  ...extra,
});

beforeEach(() => { useAppStore.setState({ language: 'es' } as never); cleanup(); });

describe('bloque 03 · CARDIO dentro de la rutina', () => {
  it('pending → CTA "Continuar con cardio" presente; click construye el cardio sellado', () => {
    const buildCC = vi.fn(() => cardioWorkout);
    render(<WorkoutPlan {...props(strengthPlan(spec), { buildComposedCardio: buildCC })} />);
    const cta = screen.getByText(/Continuar con cardio/i);
    expect(cta).toBeInTheDocument();
    fireEvent.click(cta);
    expect(buildCC).toHaveBeenCalledWith(spec);
  });
  it('item 1 · el bloque 03 aparece ANTES de "¿Hiciste otra actividad?" (dentro de la rutina, no footer)', () => {
    render(<WorkoutPlan {...props(strengthPlan(spec))} />);
    const cardio = screen.getByText('03 · Cardio estructurado');
    const otra = screen.getByText(/Hiciste otra actividad/i);
    // DOM: cardio precede a "otra actividad"
    expect(cardio.compareDocumentPosition(otra) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it('done → indicador "Cardio completado" colapsado, sin CTA', () => {
    render(<WorkoutPlan {...props(strengthPlan({ ...spec, done: true }))} />);
    expect(screen.getByText(/Cardio completado/i)).toBeInTheDocument();
    expect(screen.queryByText(/Continuar con cardio/i)).not.toBeInTheDocument();
  });
  it('sin composedCardio → sin bloque 03', () => {
    render(<WorkoutPlan {...props(strengthPlan())} />);
    expect(screen.queryByText(/Continuar con cardio/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cardio completado/i)).not.toBeInTheDocument();
  });
});

describe('transición Fuerza→Cardio (items 2/3/5)', () => {
  const openStrength = () => fireEvent.click(screen.getAllByText(/comenzar entrenamiento/i)[0]);
  const handoff = () => screen.getByText(/Fuerza completada/i).closest('.dt2-handoff-card') as HTMLElement;
  it('completar fuerza con cardio pending → aparece handoff (no vuelve al plan a buscarlo)', () => {
    render(<WorkoutPlan {...props(strengthPlan(spec))} />);
    openStrength();
    fireEvent.click(screen.getByTestId('finish-player'));
    expect(screen.getByText(/Fuerza completada/i)).toBeInTheDocument();
    expect(within(handoff()).getByText(/Continuar con cardio/i)).toBeInTheDocument();
  });
  it('item 3 · el handoff NO marca done (onComposedCardioDone no se llama al mostrar/posponer)', () => {
    const onDone = vi.fn();
    render(<WorkoutPlan {...props(strengthPlan(spec), { onComposedCardioDone: onDone })} />);
    openStrength();
    fireEvent.click(screen.getByTestId('finish-player'));
    expect(onDone).not.toHaveBeenCalled();               // handoff visible, done NO marcado
    fireEvent.click(within(handoff()).getByText(/Ahora no/i)); // posponer
    expect(onDone).not.toHaveBeenCalled();
    // pospuesto → el bloque 03 sigue pending (CTA disponible), no done
    expect(screen.getByText('03 · Cardio estructurado')).toBeInTheDocument();
  });
  it('Continuar → lanza el cardio (buildComposedCardio) como sesión separada', () => {
    const buildCC = vi.fn(() => cardioWorkout);
    render(<WorkoutPlan {...props(strengthPlan(spec), { buildComposedCardio: buildCC })} />);
    openStrength();
    fireEvent.click(screen.getByTestId('finish-player'));
    fireEvent.click(within(handoff()).getByText(/Continuar con cardio/i));
    expect(buildCC).toHaveBeenCalledWith(spec);
  });
  it('item 5 · completar el cardio → onComposedCardioDone (marca done=true en el plan de fuerza)', () => {
    const onDone = vi.fn();
    render(<WorkoutPlan {...props(strengthPlan(spec), { onComposedCardioDone: onDone })} />);
    openStrength();
    fireEvent.click(screen.getByTestId('finish-player'));         // fuerza done → handoff
    fireEvent.click(within(handoff()).getByText(/Continuar con cardio/i)); // lanza cardio player
    fireEvent.click(screen.getByTestId('finish-player'));         // completa cardio
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('guard anti-duplicado · onAddCardio (item 11)', () => {
  it('pending → el player NO recibe onAddCardio (manual suprimido)', () => {
    render(<WorkoutPlan {...props(strengthPlan(spec))} />);
    fireEvent.click(screen.getAllByText(/comenzar entrenamiento/i)[0]);
    expect(screen.queryByTestId('manual-add-cardio')).not.toBeInTheDocument();
  });
  it('sin composedCardio → el player SÍ recibe onAddCardio', () => {
    render(<WorkoutPlan {...props(strengthPlan())} />);
    fireEvent.click(screen.getAllByText(/comenzar entrenamiento/i)[0]);
    expect(screen.getByTestId('manual-add-cardio')).toBeInTheDocument();
  });
});
