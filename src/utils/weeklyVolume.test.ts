import { describe, it, expect } from 'vitest';
import { computeWeeklyVolume, pickByVolumeDeficit } from './workoutPlanner';
import { dayKey } from './localDate';
import type { Exercise, CompletedSession } from '../types';

const today = dayKey(new Date());
const old = dayKey(new Date(Date.now() - 10 * 86400000));

const EX = [
  { id: 'press', muscleGroup: 'pecho', secondaryMuscles: ['triceps', 'hombros'], type: 'compuesto', defaultSets: 4 },
  { id: 'remo', muscleGroup: 'espalda', secondaryMuscles: ['biceps'], type: 'compuesto', defaultSets: 4 },
  { id: 'sent', muscleGroup: 'cuadriceps', secondaryMuscles: ['gluteo'], type: 'compuesto', defaultSets: 4 },
] as unknown as Exercise[];

const sess = (date: string, ids: string[]): CompletedSession =>
  ({ date, exerciseIds: ids } as unknown as CompletedSession);

describe('volumen semanal', () => {
  it('cuenta series primario (completo) + secundario (mitad), últimos 7 días', () => {
    const vol = computeWeeklyVolume([sess(today, ['press'])], EX);
    expect(vol['pecho']).toBe(4);
    expect(vol['triceps']).toBe(2);   // secundario = media serie
    expect(vol['hombros']).toBe(2);
  });

  it('ignora sesiones de hace más de 7 días', () => {
    const vol = computeWeeklyVolume([sess(old, ['press'])], EX);
    expect(vol['pecho'] ?? 0).toBe(0);
  });

  it('prioriza el split con más déficit (mucho empuje → elige jalón)', () => {
    // pecho/hombros/triceps ya saturados; espalda/biceps en cero
    const vol = { pecho: 16, hombros: 16, triceps: 16, cuadriceps: 16, isquios: 16, gluteo: 16 };
    const pick = pickByVolumeDeficit(['push', 'pull', 'legs'], vol, []);
    expect(pick).toBe('pull');
  });

  it('evita repetir los músculos de ayer', () => {
    const vol = {}; // todo en déficit → decide por "no repetir ayer"
    // ayer entrené pull (espalda) → hoy prefiere push o legs, no pull
    const pick = pickByVolumeDeficit(['push', 'pull', 'legs'], vol, ['espalda', 'biceps']);
    expect(pick).not.toBe('pull');
  });
});
