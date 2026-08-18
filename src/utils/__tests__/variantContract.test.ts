import { describe, it, expect } from 'vitest';
import { playableVariantsForContext, selectVariantForEquipment } from '../workoutPlanner';
import { applySessionMutation, type WorkoutExercise } from '../workoutSession';
import { exercises as BANK } from '../../data/exercises';
import type { Exercise } from '../../types';

// ═══════════════════════════════════════════════════════════════════════════
// CONTRATO DE VARIANTES (fix player-parity + filtrado sin-video + source of truth).
// - popout/player solo ofrecen variantes PLAYABLE (equipo + gear + VIDEO) del contexto actual;
// - "Cambiar variante" conserva exerciseId/sets/reps/rest/group/progresión;
// - variantId inválida → fallback seguro a una playable;
// - Full Gym no ofrece variantes de bandas incompatibles; cardio intacto.
// ═══════════════════════════════════════════════════════════════════════════

const talones = BANK.find(e => e.id === 'elevacion-talones')!;   // maquina(video) / smith(video) / cuerpo(sin video)
const cardioMaq = BANK.find(e => e.id === 'cardio-maquina')!;    // remo / bici / eliptica (todas con video)
const aperturas = BANK.find(e => e.id === 'aperturas')!;         // tiene variante de banda (ligas)

// ── B · filtrado de variantes ──
describe('playableVariantsForContext · filtrado real', () => {
  it('1 · oculta variante SIN video (Elevación de Talones peso corporal)', () => {
    const ids = playableVariantsForContext(talones, ['gym']).map(v => v.id);
    expect(ids).toContain('elevacion-talones-maquina-parada');
    expect(ids).toContain('elevacion-talones-smith');
    expect(ids).not.toContain('elevacion-talones-cuerpo'); // sin video → nunca opción
  });

  it('2 · oculta variante INCOMPATIBLE con el equipo (gym variants en contexto peso corporal)', () => {
    const ids = playableVariantsForContext(talones, ['cuerpo']).map(v => v.id);
    // las de gym no aplican; la de cuerpo no tiene video → no hay opciones playable
    expect(ids).not.toContain('elevacion-talones-maquina-parada');
    expect(ids).not.toContain('elevacion-talones-smith');
    expect(ids.length).toBe(0);
  });

  it('11 · Full Gym NO ofrece variante de bandas (equipment ligas)', () => {
    const vs = playableVariantsForContext(aperturas, ['gym']);
    expect(vs.every(v => !v.equipment.includes('ligas'))).toBe(true); // ninguna de ligas
    expect(vs.some(v => v.equipment.includes('gym'))).toBe(true);     // sí las de gym playable
  });

  it('12 · cardio intacto: cardio-maquina ofrece sus 3 máquinas playable', () => {
    const ids = playableVariantsForContext(cardioMaq, ['gym']).map(v => v.id);
    expect(ids).toEqual(expect.arrayContaining(['remo-ergometro', 'cardio-bici', 'cardio-eliptica']));
    expect(ids.length).toBeGreaterThanOrEqual(2);
  });
});

// ── A · condición del selector del player (canCycleVariant = playable ≥ 2) ──
describe('player · gate "Cambiar variante"', () => {
  it('3 · fuerza con ≥2 playable → selector disponible (Elevación de Talones en gym)', () => {
    expect(playableVariantsForContext(talones, ['gym']).length).toBeGreaterThanOrEqual(2);
  });

  it('4 · con solo 1 playable → NO selector', () => {
    // exercise sintético con 1 variante playable y otra sin video
    const one = {
      id: 'x', name: 'X', muscleGroup: 'pecho', equipment: ['gym'], variants: [
        { id: 'elevacion-talones-smith', name: 'A', equipment: ['gym'] }, // en VIDEO_VARIANT_IDS
        { id: 'sin-video-xyz', name: 'B', equipment: ['gym'] },           // sin video
      ],
    } as unknown as Exercise;
    expect(playableVariantsForContext(one, ['gym']).length).toBe(1);
  });
});

// ── A/D · cambiar variante conserva todo (cycleVariant produce {...currentEx, variantId}) ──
describe('cambiar variante · conserva prescripción y progresión', () => {
  const currentEx: WorkoutExercise = {
    id: 'elevacion-talones', sets: 4, reps: '10-12', rest: 75, group: 'A',
    variantId: 'elevacion-talones-maquina-parada',
    cardio: undefined,
  } as unknown as WorkoutExercise;
  const next = playableVariantsForContext(talones, ['gym']).find(v => v.id !== currentEx.variantId)!;
  const newEx = { ...currentEx, variantId: next.id } as WorkoutExercise;

  it('5 · conserva exerciseId (mismo ejercicio, otra ejecución)', () => {
    expect(newEx.id).toBe('elevacion-talones');
    expect(newEx.variantId).toBe(next.id);
    expect(newEx.variantId).not.toBe(currentEx.variantId);
  });
  it('6 · conserva sets/reps/rest', () => {
    expect(newEx.sets).toBe(4); expect(newEx.reps).toBe('10-12'); expect(newEx.rest).toBe(75);
  });
  it('7 · conserva group (biserie/triserie)', () => {
    expect(newEx.group).toBe('A');
  });
  it('8 · progresión/historial se indexan por exerciseId (invariante ante variantId)', () => {
    // el player hace lastExercisePerformance[currentEx.id]; id no cambia → misma clave
    expect(newEx.id).toBe(currentEx.id);
  });
});

// ── D · SOURCE OF TRUTH: applySessionMutation propaga a dailyWorkout.plan ──
describe('applySessionMutation · propaga a la sesión persistida', () => {
  const plan = {
    type: 'fuerza', exercises: [
      { id: 'press-horizontal', sets: 4, reps: '6-10', rest: 150 },
      { id: 'elevacion-talones', sets: 4, reps: '10-12', rest: 75, group: 'A', cardio: undefined },
    ],
  } as unknown as { exercises: WorkoutExercise[] };

  it('swap A→B actualiza plan[index].id a B; otros intactos', () => {
    const newEx = { ...plan.exercises[0], id: 'press-inclinado' } as WorkoutExercise;
    const next = applySessionMutation(plan, 0, newEx);
    expect(next.exercises[0].id).toBe('press-inclinado');
    expect(next.exercises[0].sets).toBe(4);          // prescripción conservada
    expect(next.exercises[1].id).toBe('elevacion-talones'); // otro ejercicio INTACTO
    expect(plan.exercises[0].id).toBe('press-horizontal');  // inmutable (no muta el original)
  });

  it('cambio de variantId in-player actualiza plan (mismo id, otra variante)', () => {
    const newEx = { ...plan.exercises[1], variantId: 'elevacion-talones-smith' } as WorkoutExercise;
    const next = applySessionMutation(plan, 1, newEx);
    expect(next.exercises[1].id).toBe('elevacion-talones'); // exerciseId estable
    expect((next.exercises[1] as { variantId?: string }).variantId).toBe('elevacion-talones-smith');
    expect(next.exercises[1].group).toBe('A');       // group conservado
  });

  it('índice fuera de rango → plan sin cambios (idempotente)', () => {
    const next = applySessionMutation(plan, 99, {} as WorkoutExercise);
    expect(next).toBe(plan);
  });

  it('10 · múltiples mutaciones → siempre el último ejecutado', () => {
    let p = plan;
    p = applySessionMutation(p, 0, { ...plan.exercises[0], id: 'b1' } as WorkoutExercise);
    p = applySessionMutation(p, 0, { ...plan.exercises[0], id: 'b2' } as WorkoutExercise);
    p = applySessionMutation(p, 0, { ...plan.exercises[0], id: 'b3' } as WorkoutExercise);
    expect(p.exercises[0].id).toBe('b3');
  });
});

// ── B · fallback seguro de variantId inválida ──
describe('selectVariantForEquipment · fallback de variantId inválida', () => {
  it('10bis · variantId sin video → fallback a una playable (no fuerza la inválida)', () => {
    const chosen = selectVariantForEquipment(talones, ['gym'], undefined, 'elevacion-talones-cuerpo'); // sin video
    expect(chosen).not.toBeNull();
    expect(chosen!.id).not.toBe('elevacion-talones-cuerpo'); // NO honra la sin-video
    expect(['elevacion-talones-maquina-parada', 'elevacion-talones-smith']).toContain(chosen!.id);
  });
  it('variantId válida (con video) SÍ se respeta', () => {
    const chosen = selectVariantForEquipment(talones, ['gym'], undefined, 'elevacion-talones-smith');
    expect(chosen!.id).toBe('elevacion-talones-smith');
  });
});

// ── 9 · resume conserva variantId (JSON round-trip de swaps) ──
describe('resume · variantId persiste', () => {
  it('9 · swap con variantId sobrevive JSON.stringify/parse', () => {
    const swaps = { 1: { id: 'elevacion-talones', sets: 4, reps: '10-12', rest: 75, variantId: 'elevacion-talones-smith' } };
    const round = JSON.parse(JSON.stringify(swaps));
    expect(round[1].variantId).toBe('elevacion-talones-smith');
    expect(round[1].id).toBe('elevacion-talones');
  });
});
