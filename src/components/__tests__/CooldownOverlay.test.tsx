import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';

// supabase mockeado (sin red): el resolver de video cae a placeholder → no bloquea.
vi.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ in: () => ({ order: () => Promise.resolve({ data: [] }) }) }) }) },
}));

import CooldownOverlay from '../CooldownOverlay';
import type { Exercise } from '../../types';

const BANK = [
  { id: 'child-pose', name: "Child's Pose", muscleGroup: 'cuerpo-completo', type: 'movilidad', equipment: ['cuerpo'], goals: ['movilidad'], isYoga: true } as unknown as Exercise,
  { id: 'pigeon-pose', name: 'Pigeon', muscleGroup: 'cuerpo-completo', type: 'movilidad', equipment: ['cuerpo'], goals: ['movilidad'], isYoga: true } as unknown as Exercise,
];
const block = {
  minutes: 4,
  movements: [
    { exerciseId: 'child-pose', name: "Child's Pose", note: 'hold', prescription: { kind: 'time' as const, seconds: 3 } },
    { exerciseId: 'pigeon-pose', name: 'Pigeon', note: 'hold', prescription: { kind: 'time' as const, seconds: 3 } },
  ],
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); cleanup(); });

describe('9C.2B.2 · CooldownOverlay', () => {
  it('intro reasegura que ya quedó guardado; Empezar → primer movimiento; Omitir → onClose', () => {
    const onClose = vi.fn();
    render(<CooldownOverlay block={block} exerciseBank={BANK} equipment={['cuerpo']} onClose={onClose} />);
    // intro: copy de "ya guardado"
    expect(screen.getByText(/ya quedó guardado/)).toBeTruthy();
    // Omitir desde la intro cierra sin ejecutar
    act(() => { fireEvent.click(screen.getByText('Omitir')); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Empezar muestra el movimiento guiado (nombre real); skip-all cierra', () => {
    const onClose = vi.fn();
    render(<CooldownOverlay block={block} exerciseBank={BANK} equipment={['cuerpo']} onClose={onClose} />);
    act(() => { fireEvent.click(screen.getByText(/Empezar vuelta/)); });
    expect(screen.getByText("Child's Pose")).toBeTruthy();       // GuidedPhaseMovement reusado
    // skip-all (X) cierra sin re-sellar (el overlay NO tiene onComplete/finishWorkoutSession)
    const skipAll = screen.getAllByText('Omitir')[0].closest('button')!;
    act(() => { fireEvent.click(skipAll); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('done del último movimiento → onClose (una sola vez); nunca hay callback de completion', () => {
    const onClose = vi.fn();
    // un solo movimiento → done cierra
    const single = { minutes: 4, movements: [block.movements[0]] };
    render(<CooldownOverlay block={single} exerciseBank={BANK} equipment={['cuerpo']} onClose={onClose} />);
    act(() => { fireEvent.click(screen.getByText(/Empezar vuelta/)); });
    act(() => { fireEvent.click(screen.getByText('Listo').closest('button')!); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('sin movimientos prescribibles → no renderiza (guard)', () => {
    const preview = { minutes: 4, movements: [{ exerciseId: 'child-pose', name: 'X' }] };   // sin prescription
    const { container } = render(<CooldownOverlay block={preview} exerciseBank={BANK} equipment={['cuerpo']} onClose={vi.fn()} />);
    expect(container.querySelector('.dt2-cooldown')).toBeNull();
  });
});
