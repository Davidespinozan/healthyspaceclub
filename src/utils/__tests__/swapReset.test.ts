import { describe, it, expect } from 'vitest';
import {
  applySwapReset, setLogAt, setsDoneForExercise, initLoggedByExercise,
  buildExecutionSequence, type LoggedByExercise,
} from '../workoutSession';
import type { WorkoutExercise } from '../workoutSession';

// ═══════════════════════════════════════════════════════════════════════════
// BUG C · "Cambiar ejercicio" congela el player.
// Root cause: swapCurrentExercise reseteaba loggedByExercise[idx] = [] (array vacío).
// setLogAt mapea sobre el array → [].map() = [] → la serie NUNCA se escribe →
// currentSetMarked = false permanente → el bloque no completa → FREEZE.
// Fix: applySwapReset reinicia a new Array(sets).fill(null) y reposiciona currentStep de forma
// segura (bloque suelto → 1ª serie; super/triserie → preserva step y co-miembro).
// ═══════════════════════════════════════════════════════════════════════════

const ex = (id: string, sets: number, group?: string): WorkoutExercise =>
  ({ id, sets, reps: '10', rest: 60, ...(group ? { group } : {}) } as WorkoutExercise);
const S = (reps = 10, kg = 20) => ({ reps, kg });

// helpers que replican EXACTO lo que computa el componente para pasar a applySwapReset
const memberCount = (exs: WorkoutExercise[], i: number) =>
  exs[i].group ? exs.filter(e => e.group === exs[i].group).length : 1;
const blockFirstStep = (seq: ReturnType<typeof buildExecutionSequence>, exs: WorkoutExercise[], i: number) => {
  const bId = (k: number) => exs[k]?.group || `__solo_${k}`;
  return seq.findIndex(s => bId(s.exIndex) === bId(i));
};
const doSwap = (log: LoggedByExercise, exs: WorkoutExercise[], step: number, i: number, newSets: number) => {
  const seq = buildExecutionSequence(exs);
  return applySwapReset({
    logged: log, currentStep: step, exIndex: i, newSets,
    blockMemberCount: memberCount(exs, i), blockFirstStep: blockFirstStep(seq, exs, i),
  });
};

// ── ROOT CAUSE (reproducción del bug exacto) ──
describe('BUG C · root cause', () => {
  it('el reset viejo ([]) hace setLogAt no-op → serie nunca se registra (freeze)', () => {
    const broken: LoggedByExercise = [[]]; // lo que hacía swapCurrentExercise
    const afterMark = setLogAt(broken, 0, 0, S());
    expect(afterMark[0].length).toBe(0);          // [].map() = []
    expect(setsDoneForExercise(afterMark, 0)).toBe(0); // ← nunca sube → currentSetMarked=false → freeze
  });
  it('applySwapReset produce longitud real → setLogAt SÍ escribe (no freeze)', () => {
    const { logged } = doSwap([[]], [ex('a', 4)], 0, 0, 4);
    expect(logged[0].length).toBe(4);
    const marked = setLogAt(logged, 0, 0, S());
    expect(setsDoneForExercise(marked, 0)).toBe(1); // ✓ se registra
  });
});

// ── Escenarios 1-10 ──
describe('BUG C · escenarios de swap', () => {
  it('1 · swap standalone ANTES de empezar sets', () => {
    const exs = [ex('a', 4), ex('b', 3)];
    const log = initLoggedByExercise(exs); // [[null×4],[null×3]]
    const r = doSwap(log, exs, 0, 0, 4);
    expect(r.logged[0].length).toBe(4);
    expect(r.logged[0].every(x => x === null)).toBe(true);
    expect(r.currentStep).toBe(0); // bloque suelto → 1ª serie
    expect(setsDoneForExercise(setLogAt(r.logged, 0, 0, S()), 0)).toBe(1); // se puede marcar
  });

  it('2 · swap DESPUÉS de completar algunas series (no pierde otros ejercicios)', () => {
    const exs = [ex('a', 4), ex('b', 3)];
    let log = initLoggedByExercise(exs);
    log = setLogAt(log, 0, 0, S()); log = setLogAt(log, 0, 1, S()); // 2 series de 'a'
    log = setLogAt(log, 1, 0, S());                                  // 1 serie de 'b'
    const r = doSwap(log, exs, 2, 0, 4); // estaba en serie 3 de 'a'
    expect(r.logged[0].length).toBe(4);
    expect(setsDoneForExercise(r.logged, 0)).toBe(0);       // 'a' reiniciado
    expect(setsDoneForExercise(r.logged, 1)).toBe(1);       // 'b' INTACTO (otro ejercicio)
    expect(r.currentStep).toBe(0);                          // vuelve a serie 1
  });

  it('3 · swap en la ÚLTIMA serie (no se queda trabado)', () => {
    const exs = [ex('a', 4)];
    let log = initLoggedByExercise(exs);
    log = setLogAt(log, 0, 0, S()); log = setLogAt(log, 0, 1, S()); log = setLogAt(log, 0, 2, S());
    const seq = buildExecutionSequence(exs);
    const r = doSwap(log, exs, seq.length - 1, 0, 4); // última serie
    expect(r.currentStep).toBe(0);                    // reinicia desde serie 1
    // puede completar las 4 series y el bloque completa
    let m = r.logged;
    for (let s = 0; s < 4; s++) m = setLogAt(m, 0, s, S());
    expect(setsDoneForExercise(m, 0)).toBe(4);
  });

  it('4 · swap dentro de BISERIE — solo el miembro swappeado, co-miembro intacto, step preservado', () => {
    const exs = [ex('a', 3, 'A'), ex('b', 3, 'A')];
    let log = initLoggedByExercise(exs);
    log = setLogAt(log, 0, 0, S()); log = setLogAt(log, 1, 0, S()); // vuelta 1 de ambos
    const r = doSwap(log, exs, 2, 0, 3); // swap miembro 'a' a media biserie (step 2)
    expect(setsDoneForExercise(r.logged, 0)).toBe(0);  // 'a' reiniciado
    expect(setsDoneForExercise(r.logged, 1)).toBe(1);  // 'b' (co-miembro) INTACTO
    expect(r.currentStep).toBe(2);                     // step NO se reinicia (preserva interleave)
    expect(memberCount(exs, 0)).toBe(2);               // group membership intacto
  });

  it('5 · swap dentro de TRISERIE — solo el swappeado, los otros dos intactos', () => {
    const exs = [ex('a', 3, 'B'), ex('b', 3, 'B'), ex('c', 3, 'B')];
    let log = initLoggedByExercise(exs);
    log = setLogAt(log, 0, 0, S()); log = setLogAt(log, 1, 0, S()); log = setLogAt(log, 2, 0, S());
    const r = doSwap(log, exs, 3, 1, 3); // swap miembro del medio
    expect(setsDoneForExercise(r.logged, 0)).toBe(1);  // intacto
    expect(setsDoneForExercise(r.logged, 1)).toBe(0);  // reiniciado
    expect(setsDoneForExercise(r.logged, 2)).toBe(1);  // intacto
    expect(r.currentStep).toBe(3);                     // preservado (super/triserie)
  });

  it('6 · MÚLTIPLES swaps consecutivos', () => {
    const exs = [ex('a', 4), ex('b', 3)];
    let log = initLoggedByExercise(exs);
    log = setLogAt(log, 0, 0, S());
    let r = doSwap(log, exs, 1, 0, 4);           // swap 1
    r = doSwap(r.logged, exs, r.currentStep, 0, 4); // swap 2
    r = doSwap(r.logged, exs, r.currentStep, 0, 4); // swap 3
    expect(r.logged[0].length).toBe(4);
    expect(setsDoneForExercise(r.logged, 0)).toBe(0);
    expect(setsDoneForExercise(r.logged, 1)).toBe(0); // 'b' nunca tocado
    expect(setLogAt(r.logged, 0, 0, S())[0][0]).not.toBeNull(); // sigue funcionando
  });

  it('7 · ejercicio nuevo con DISTINTO número de sets → reinit a la longitud nueva', () => {
    // (en el player los sets se preservan del bloque; el helper igual respeta newSets)
    const exs = [ex('a', 4)];
    const log = initLoggedByExercise(exs);
    const r = doSwap(log, exs, 0, 0, 2); // newSets=2
    expect(r.logged[0].length).toBe(2);
    const r1 = doSwap(log, exs, 0, 0, 5); // newSets=5
    expect(r1.logged[0].length).toBe(5);
    const r0 = doSwap(log, exs, 0, 0, 0); // guard: 0 → mínimo 1
    expect(r0.logged[0].length).toBe(1);
  });

  it('8 · RESUME tras swap: el estado (log + step) sobrevive JSON', () => {
    const exs = [ex('a', 4), ex('b', 3)];
    const r = doSwap(initLoggedByExercise(exs), exs, 2, 0, 4);
    const persisted = { currentStep: r.currentStep, loggedByExercise: r.logged, swaps: { 0: { ...ex('newid', 4), variantId: undefined } } };
    const round = JSON.parse(JSON.stringify(persisted));
    expect(round.loggedByExercise[0].length).toBe(4);       // longitud válida tras resume
    expect(round.currentStep).toBe(0);
    expect(setsDoneForExercise(round.loggedByExercise, 0)).toBe(0);
    // tras resume se puede seguir marcando (no congelado)
    expect(setsDoneForExercise(setLogAt(round.loggedByExercise, 0, 0, S()), 0)).toBe(1);
  });

  it('9 · COMPLETAR la sesión tras swap (todas las series marcables)', () => {
    const exs = [ex('a', 4), ex('b', 3)];
    let log = initLoggedByExercise(exs);
    log = setLogAt(log, 0, 0, S()); // empieza 'a'
    const r = doSwap(log, exs, 1, 0, 4); // swap 'a'
    let m = r.logged;
    for (let s = 0; s < 4; s++) m = setLogAt(m, 0, s, S(12, 30)); // completa 'a' nuevo
    for (let s = 0; s < 3; s++) m = setLogAt(m, 1, s, S());       // completa 'b'
    expect(setsDoneForExercise(m, 0)).toBe(4); // bloque 'a' completa (currentSetMarked=true posible)
    expect(setsDoneForExercise(m, 1)).toBe(3);
  });

  it('10 · logging final refleja el ejercicio NUEVO y sus series reales', () => {
    const exs = [ex('a', 4)];
    const newEx = { ...ex('a', 4), id: 'nueva-variante' } as WorkoutExercise;
    const swapped = [newEx]; // lo que ve el player (swaps aplicados)
    const r = doSwap(initLoggedByExercise(exs), exs, 0, 0, 4);
    let m = r.logged;
    m = setLogAt(m, 0, 0, S(10, 40)); m = setLogAt(m, 0, 1, S(10, 40));
    expect(swapped[0].id).toBe('nueva-variante');       // id nuevo
    expect(setsDoneForExercise(m, 0)).toBe(2);          // series reales registradas (no las viejas)
    expect(m[0].filter(x => x !== null).every(x => x!.kg === 40)).toBe(true); // datos del nuevo
  });
});
