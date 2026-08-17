import { describe, it, expect } from 'vitest';
import { pickByVolumeDeficit, estimatedUsefulMinutes, usefulVolumeRemaining } from '../workoutPlanner';
import type { MuscleGroup } from '../../types';

// ═══════════════════════════════════════════════════════════════════════════
// AUTO · elección del día por UTILIDAD (volumen útil pendiente), overlap = penalización SUAVE.
// Un split AGOTADO no puede ganarle a uno claramente ÚTIL solo por no solapar con ayer.
// (Target plano 14/músculo por defecto — no se pasa `target`.)
// ═══════════════════════════════════════════════════════════════════════════

// vol = series ya hechas esta semana por músculo. remaining = 14 − done.
const vol = (o: Record<string, number>) => o;

describe('estimatedUsefulMinutes — determinista, sin IA', () => {
  it('agotado → ~0; con déficit → proporcional a las series pendientes', () => {
    const push: MuscleGroup[] = ['pecho', 'hombros', 'triceps'];
    expect(estimatedUsefulMinutes(push, vol({ pecho: 14, hombros: 14, triceps: 14 }))).toBe(0);
    // 3 músculos × 14 pendientes = 42 series × 2.2 ≈ 92 min
    expect(estimatedUsefulMinutes(push, vol({}))).toBe(Math.round(42 * 2.2));
  });
  it('mismo input → mismo output (determinista) y coherente con usefulVolumeRemaining', () => {
    const legs: MuscleGroup[] = ['cuadriceps', 'isquios', 'gluteo'];
    const v = vol({ cuadriceps: 4, isquios: 2 });
    expect(estimatedUsefulMinutes(legs, v)).toBe(estimatedUsefulMinutes(legs, v));
    expect(estimatedUsefulMinutes(legs, v)).toBe(Math.round(usefulVolumeRemaining(legs, v) * 2.2));
  });
});

describe('pickByVolumeDeficit — utilidad manda, overlap penaliza suave', () => {
  // A) push AGOTADO, pull déficit, lower alto déficit; AYER = pull + legs (solapan casi todo).
  it('A) push agotado + ayer=pull+legs → NO elige push (elige el más útil: lower)', () => {
    const v = vol({ pecho: 14, hombros: 14, triceps: 14, espalda: 4, biceps: 4, cuadriceps: 2, isquios: 2, gluteo: 2, pantorrillas: 2 });
    const ayer = ['espalda', 'biceps', 'cuadriceps', 'isquios', 'gluteo'];
    const pick = pickByVolumeDeficit(['push', 'pull', 'legs', 'lower'], v, ayer as never);
    expect(pick).not.toBe('push');           // el overlap NO puede forzar el split agotado
    expect(pick).toBe('lower');               // el de mayor utilidad, pese a solapar
  });

  // B) misma utilidad relativa, sin ayer → mayor utilidad.
  it('B) sin ayer → elige el de mayor utilidad (lower)', () => {
    const v = vol({ pecho: 14, hombros: 14, triceps: 14, espalda: 4, biceps: 4, cuadriceps: 2, isquios: 2, gluteo: 2, pantorrillas: 2 });
    expect(pickByVolumeDeficit(['push', 'pull', 'legs', 'lower'], v, [])).toBe('lower');
  });

  // C) push ligeramente por delante PERO ayer=push → el overlap tiene peso → NO push.
  it('C) push mayor pero ayer=push → recuperación pesa → elige pull (no "siempre el más largo")', () => {
    const v = vol({ pecho: 6, hombros: 6, triceps: 5, espalda: 3, biceps: 2, cuadriceps: 10, isquios: 10, gluteo: 10, pantorrillas: 4 });
    // push útil≈25, pull≈23, lower≈22 · ayer=push
    const pick = pickByVolumeDeficit(['push', 'pull', 'lower'], v, ['pecho', 'hombros', 'triceps'] as never);
    expect(pick).not.toBe('push');
    expect(pick).toBe('pull');
  });

  // D) utilidades casi iguales → el overlap DESEMPATA (favorece el no-solapado).
  it('D) empate de utilidad → overlap desempata (elige el que no solapa)', () => {
    // push y pull con ~la misma utilidad; ayer=pull → gana push (no solapa).
    const v = vol({ pecho: 8, hombros: 8, triceps: 8, espalda: 4, biceps: 4 }); // push rem 18, pull rem 20
    const pick = pickByVolumeDeficit(['push', 'pull'], v, ['espalda', 'biceps'] as never);
    expect(pick).toBe('push'); // pull(20)−5=15 < push(18) → el overlap inclina la balanza
  });

  it('un déficit ENORME sobrevive la penalización (overlap no veta)', () => {
    // lower fresco (útil ~56) aunque solape ayer, le gana a push agotado (0) que no solapa.
    const v = vol({ pecho: 14, hombros: 14, triceps: 14 });
    expect(pickByVolumeDeficit(['push', 'lower'], v, ['cuadriceps'] as never)).toBe('lower');
  });
});

// E) MANUAL push: NO pasa por pickByVolumeDeficit (override de `focus` en DailyTrainer) → se
// respeta push aunque su dosis útil sea pequeña; el fix de display comunica la duración real.
// (Contrato a nivel de componente; aquí solo dejamos constancia de que la utilidad de push
//  agotado es efectivamente pequeña, que es lo que el early-end explica.)
describe('MANUAL intacto — push agotado sigue siendo push (contrato de componente)', () => {
  it('push agotado tiene utilidad ~0 → el early-end lo explica (no lo re-decide AUTO)', () => {
    expect(estimatedUsefulMinutes(['pecho', 'hombros', 'triceps'] as MuscleGroup[], vol({ pecho: 14, hombros: 14, triceps: 14 }))).toBe(0);
  });
});
