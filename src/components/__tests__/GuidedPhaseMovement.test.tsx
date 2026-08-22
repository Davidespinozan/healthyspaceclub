import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import GuidedPhaseMovement from '../GuidedPhaseMovement';
import type { PhaseMovementPrescription } from '../../utils/warmupSelection';

// t stub: interpola {n}; devuelve la key para el resto (suficiente para aserciones).
const t = ((k: string, vars?: Record<string, string | number>) =>
  vars && 'n' in vars ? `${k}:${vars.n}` : k) as unknown as Parameters<typeof GuidedPhaseMovement>[0]['t'];

const base = {
  phaseLabel: 'Eleva', name: 'Bici', note: 'suave',
  videoUrl: null as string | null, index: 0, total: 2, t,
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); cleanup(); });

describe('9C.2B.1 · GuidedPhaseMovement timer', () => {
  it('countdown llega a 0 y dispara onDone UNA sola vez', () => {
    const onDone = vi.fn();
    const pres: PhaseMovementPrescription = { kind: 'time', seconds: 2 };
    render(<GuidedPhaseMovement {...base} prescription={pres} onDone={onDone} onSkip={vi.fn()} />);
    expect(screen.getByRole('timer').textContent).toBe('2s');
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByRole('timer').textContent).toBe('1s');
    act(() => { vi.advanceTimersByTime(1000); });   // → 0
    act(() => { vi.advanceTimersByTime(1000); });   // efecto de "remaining<=0" corre
    expect(onDone).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(5000); });   // no vuelve a disparar
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('unmount ANTES de 0 → NO dispara onDone (cleanup del timeout)', () => {
    const onDone = vi.fn();
    const { unmount } = render(<GuidedPhaseMovement {...base} prescription={{ kind: 'time', seconds: 5 }} onDone={onDone} onSkip={vi.fn()} />);
    act(() => { vi.advanceTimersByTime(2000); });
    unmount();
    act(() => { vi.advanceTimersByTime(10000); });
    expect(onDone).not.toHaveBeenCalled();
  });

  it('skip → onSkip (no onDone); el timer del item ya no importa tras remount del padre', () => {
    const onDone = vi.fn(); const onSkip = vi.fn();
    render(<GuidedPhaseMovement {...base} prescription={{ kind: 'time', seconds: 5 }} onDone={onDone} onSkip={onSkip} />);
    act(() => { screen.getByText('workout.phase.skip').closest('button')!.click(); });
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('remount (nuevo item, key distinto) arranca en los segundos del nuevo, sin arrastrar elapsed', () => {
    const { unmount } = render(<GuidedPhaseMovement {...base} prescription={{ kind: 'time', seconds: 3 }} onDone={vi.fn()} onSkip={vi.fn()} />);
    act(() => { vi.advanceTimersByTime(1000); });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByRole('timer').textContent).toBe('1s');
    unmount();   // el padre cambia key → esta instancia se desmonta y la nueva monta fresca
    render(<GuidedPhaseMovement {...base} name="Cat-cow" prescription={{ kind: 'time', seconds: 30 }} onDone={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByRole('timer').textContent).toBe('30s');   // fresh, sin arrastrar el elapsed anterior
  });

  it('reps: muestra reps (interpola {n}) y NO renderiza timer/kg/RIR', () => {
    render(<GuidedPhaseMovement {...base} prescription={{ kind: 'reps', reps: 12 }} onDone={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.queryByRole('timer')).toBeNull();
    expect(screen.getByText('workout.phase.reps:12')).toBeTruthy();
    expect(screen.queryByText(/kg|RIR/i)).toBeNull();
  });

  it('perSide usa la key repsPerSide', () => {
    render(<GuidedPhaseMovement {...base} prescription={{ kind: 'reps', reps: 8, perSide: true }} onDone={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByText('workout.phase.repsPerSide:8')).toBeTruthy();
  });
});
