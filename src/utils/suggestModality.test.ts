import { describe, it, expect } from 'vitest';
import { suggestModality } from './workoutPlanner';
import { dayKey } from './localDate';
import type { Exercise, CompletedSession } from '../types';

const EX = [{ id: 'press', name: 'Press banca', muscleGroup: 'pecho', type: 'compuesto' }] as unknown as Exercise[];
const day = (n: number) => dayKey(new Date(Date.now() - n * 86400000));
const sess = (d: string, modality: string): CompletedSession =>
  ({ date: d, modality, exerciseIds: ['press'] } as unknown as CompletedSession);

describe('suggestModality — nudge de recuperación', () => {
  it('4 días de fuerza seguidos (ayer→hace 4, desde completedSessions) → yoga', () => {
    const cs = [day(1), day(2), day(3), day(4)].map((d) => sess(d, 'fuerza'));
    const r = suggestModality({ workoutLog: [], exercises: EX, completedSessions: cs });
    expect(r.modality).toBe('yoga');
    expect(r.reasonKey).toBe('wizard.reasonRecovery');
  });

  it('NO dispara si uno de los últimos 4 días fue yoga', () => {
    const cs = [sess(day(1), 'fuerza'), sess(day(2), 'yoga'), sess(day(3), 'fuerza'), sess(day(4), 'fuerza')];
    const r = suggestModality({ workoutLog: [], exercises: EX, completedSessions: cs });
    expect(r.reasonKey).not.toBe('wizard.reasonRecovery');
  });

  it('NO exige entrenar HOY (hoy aún no logueado al planear)', () => {
    // solo ayer→hace 4, sin hoy → debe disparar igual
    const cs = [day(1), day(2), day(3), day(4)].map((d) => sess(d, 'fuerza'));
    const r = suggestModality({ workoutLog: [], exercises: EX, completedSessions: cs, dailyEnergy: 'normal' });
    expect(r.modality).toBe('yoga');
  });
});
