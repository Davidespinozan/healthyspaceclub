import { describe, it, expect } from 'vitest';
import { buildSessionSlots } from '../sessionSlots';
import { movementPatternOf } from '../movementPattern';
import type { MuscleGroup } from '../../types';

// ─────────────────────────────────────────────────────────────────────────
// FASE 5A.1 · el nº de ejercicios = slots.length, DOSE-DRIVEN desde UNA sola allocation P4.
// El tiempo es TOPE; readiness/deload (menos dosis) → menos slots; fuerza concentra.
// ─────────────────────────────────────────────────────────────────────────

const UPPER = ['pecho', 'espalda', 'hombros', 'biceps', 'triceps'] as MuscleGroup[];
const slots = (allocation: Record<string, number>, over: Partial<Parameters<typeof buildSessionSlots>[0]> = {}) =>
  buildSessionSlots({ dayMuscles: UPPER, trainingGoal: 'hipertrofia', allocation, anchors: [], timeCap: 12, ...over });
const count = (allocation: Record<string, number>, over = {}) => slots(allocation, over).length;

describe('slots dose-driven · el volumen dirige el nº de ejercicios (hipertrofia)', () => {
  it('6 series de un músculo → 2 slots (~3 c/u), NO 1×6 ni 3×2', () => {
    const s = slots({ pecho: 6 });
    const pechoSlots = s.filter(x => x.muscle === 'pecho');
    expect(pechoSlots.length).toBe(2);
  });

  it('dosis alta abre un patrón COMPLEMENTARIO (no otro igual)', () => {
    const s = slots({ pecho: 6 });
    const pats = s.filter(x => x.muscle === 'pecho').flatMap(x => x.patterns);
    expect(new Set(pats).size).toBe(pats.length); // patrones distintos (horizontal-push + chest-fly)
    expect(pats).toContain('chest-fly');
  });

  it('baja dosis (2) → 1 solo slot (sin slots basura)', () => {
    expect(slots({ pecho: 2 }).filter(x => x.muscle === 'pecho').length).toBe(1);
  });

  it('más volumen total → más slots; menos → menos', () => {
    const alto = count({ pecho: 6, espalda: 6, hombros: 6, biceps: 4, triceps: 4 });
    const bajo = count({ pecho: 3, espalda: 3, hombros: 2 });
    expect(alto).toBeGreaterThan(bajo);
  });

  it('el TIEMPO es TOPE: mucho volumen no supera la capacidad de tiempo', () => {
    const n = count({ pecho: 9, espalda: 9, hombros: 9, biceps: 6, triceps: 6 }, { timeCap: 5 });
    expect(n).toBeLessThanOrEqual(5);
  });

  it('readiness/deload (menos dosis) → menos slots', () => {
    const normal = count({ pecho: 6, espalda: 6, hombros: 6 });
    const bajo = count({ pecho: 3, espalda: 3, hombros: 2 });
    expect(bajo).toBeLessThanOrEqual(normal);
  });

  it('un músculo con MUCHA dosis se fragmenta (hasta tope 3 / patrones disponibles), no 1×8', () => {
    // espalda tiene ≥3 patrones (vertical-pull, horizontal-pull, rear-delt/shrug) → 3 slots
    expect(slots({ espalda: 9 }).filter(x => x.muscle === 'espalda').length).toBe(3);
    // pecho solo tiene 2 patrones (horizontal-push + chest-fly) → máx 2 (respeta diversidad, no apila)
    expect(slots({ pecho: 9 }).filter(x => x.muscle === 'pecho').length).toBe(2);
  });
});

describe('slots dose-driven · FUERZA concentra (Fase 1 compacta)', () => {
  it('fuerza abre menos slots por músculo (concentra en el main)', () => {
    const hip = buildSessionSlots({ dayMuscles: ['pecho'] as MuscleGroup[], trainingGoal: 'hipertrofia', allocation: { pecho: 6 }, anchors: [], timeCap: 9 }).filter(x => x.muscle === 'pecho').length;
    const fue = buildSessionSlots({ dayMuscles: ['pecho'] as MuscleGroup[], trainingGoal: 'fuerza', allocation: { pecho: 6 }, anchors: [], timeCap: 9 }).filter(x => x.muscle === 'pecho').length;
    expect(fue).toBeLessThanOrEqual(hip);
  });
  it('fuerza total compacto (≤6) aunque haya mucho volumen', () => {
    const n = buildSessionSlots({ dayMuscles: UPPER, trainingGoal: 'fuerza', allocation: { pecho: 8, espalda: 8, hombros: 6, biceps: 4, triceps: 4 }, anchors: [], timeCap: 9 }).length;
    expect(n).toBeLessThanOrEqual(6);
  });
});

describe('slots dose-driven · anchor consume dosis del músculo', () => {
  it('el anchor cubre 1 ejercicio del músculo; el 2º sale de la dosis restante', () => {
    const s = buildSessionSlots({
      dayMuscles: ['pecho'] as MuscleGroup[], trainingGoal: 'hipertrofia', allocation: { pecho: 6 },
      anchors: [{ id: 'press-horizontal', muscle: 'pecho', pattern: movementPatternOf({ id: 'press-horizontal', muscleGroup: 'pecho' } as never), role: 'main-compound' }],
      timeCap: 9,
    });
    const pecho = s.filter(x => x.muscle === 'pecho');
    expect(pecho.length).toBe(2);                          // anchor + 1 complementario
    expect(pecho.find(x => x.filledBy === 'press-horizontal')).toBeTruthy();
  });
});
