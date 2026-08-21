import { describe, it, expect } from 'vitest';
import { isStrengthDomainSession } from '../trainingDomain';
import { computeWeeklyVolume } from '../workoutPlanner';
import { regionExposure } from '../regionalCoverage';
import { currentBlockId } from '../blockAnchors';
import { exercises as BANK } from '../../data/exercises';
import type { CompletedSession, Modality } from '../../types';

// ═══════════════════════════════════════════════════════════════════════════
// F2C-9B.2 · DOMAIN ISOLATION — la SESIÓN decide el strength credit, NO el Exercise.
// El test clave es ADVERSARIAL: un movimiento de FUERZA (press-horizontal, kg/reps/RIR reales)
// dentro de una sesión modality='cardio' debe producir CERO evidencia de fuerza. Ese caso vale
// más que los realistas de hoy (que se esconden tras type='cardio'/kg=0).
// ═══════════════════════════════════════════════════════════════════════════

const PRESS = 'press-horizontal';                 // fuerza: type compuesto, muscleGroup pecho
const bankPress = BANK.find(e => e.id === PRESS)!;
const D = '2026-08-19';
const set = (reps = 8, kg = 40, rir?: number) => ({ reps, kg, ...(rir != null && { rir }) });

// Sesión con exercises[] poblado (misma forma que finishWorkoutSession persiste).
const sess = (modality: Modality | undefined, exs: Array<{ id: string; nsets: number; kg?: number; reps?: number; rir?: number }>, extra: Partial<CompletedSession> = {}): CompletedSession => ({
  sessionId: extra.sessionId ?? `s-${modality}`, date: extra.date ?? D, completedAtIso: `${extra.date ?? D}T10:00:00.000Z`,
  modality: modality as Modality, exerciseIds: exs.map(e => e.id), durationSeconds: 1800,
  exercisesCompleted: exs.length, exercisesTotal: exs.length,
  exercises: exs.map(e => ({ id: e.id, sets: Array.from({ length: e.nsets }, () => set(e.reps ?? 8, e.kg ?? 40, e.rir)) })),
  ...extra,
});
const vol = (sessions: CompletedSession[]) => computeWeeklyVolume(sessions, BANK, 7, []);
const bankRegion = new Map(BANK.map(e => [e.id, e]));

// ── Helper puro (A/B/C/D/N/O) ────────────────────────────────────────────────
describe('9B.2 · isStrengthDomainSession (autoridad por modalidad)', () => {
  it('A · fuerza → strength', () => expect(isStrengthDomainSession({ modality: 'fuerza' })).toBe(true));
  it('B · cardio → NON-strength', () => expect(isStrengthDomainSession({ modality: 'cardio' })).toBe(false));
  it('C · yoga → NON-strength', () => expect(isStrengthDomainSession({ modality: 'yoga' })).toBe(false));
  it('O · auto (legacy pre-resolución) → strength conservador', () => expect(isStrengthDomainSession({ modality: 'auto' })).toBe(true));
  it('O · undefined (legacy) → strength conservador', () => expect(isStrengthDomainSession({})).toBe(true));
  it('O · null (legacy) → strength conservador', () => expect(isStrengthDomainSession({ modality: null })).toBe(true));
  it('la modalidad explícita cardio MANDA aunque el objeto traiga más campos', () => {
    expect(isStrengthDomainSession({ modality: 'cardio' } as CompletedSession)).toBe(false);
  });
});

// ── WEEKLY VOLUME · gate por sesión + defensa en profundidad ─────────────────
describe('9B.2 · computeWeeklyVolume aisla por dominio', () => {
  it('X (ADVERSARIAL) · press-horizontal kg=100 reps=10 rir=2 en modality=cardio → 0 strength volume', () => {
    const attack = sess('cardio', [{ id: PRESS, nsets: 4, kg: 100, reps: 10, rir: 2 }]);
    expect(Object.values(vol([attack])).reduce((a, b) => a + b, 0)).toBe(0);
    expect(vol([attack])['pecho'] ?? 0).toBe(0);
  });
  it('A · misma press en modality=fuerza → sí cuenta (comportamiento intacto)', () => {
    expect(vol([sess('fuerza', [{ id: PRESS, nsets: 4 }])])['pecho']).toBe(4);
  });
  it('H · MISMO exerciseId en dos dominios → solo la sesión de fuerza suma', () => {
    const strengthS = sess('fuerza', [{ id: PRESS, nsets: 4, kg: 60, reps: 8, rir: 2 }], { sessionId: 'A', date: D });
    const cardioS = sess('cardio', [{ id: PRESS, nsets: 5, kg: 100, reps: 10, rir: 2 }], { sessionId: 'B', date: '2026-08-18' });
    // fuerza sola = 4; fuerza+cardio = 4 (la de cardio no aporta nada).
    expect(vol([strengthS])['pecho']).toBe(4);
    expect(vol([strengthS, cardioS])['pecho']).toBe(4);
  });
  it('C · yoga con un id de fuerza → 0', () => {
    expect(vol([sess('yoga', [{ id: PRESS, nsets: 3 }])])['pecho'] ?? 0).toBe(0);
  });
  it('D · supplemental (fuerza) sigue contando', () => {
    expect(vol([sess('fuerza', [{ id: PRESS, nsets: 2 }], { source: 'supplemental' })])['pecho']).toBe(2);
  });
  it('M · legacy sin modality → strength preservado (no borra historial)', () => {
    const legacy = sess(undefined, [{ id: PRESS, nsets: 3 }]);
    delete (legacy as { modality?: Modality }).modality;
    expect(vol([legacy])['pecho']).toBe(3);
  });
  it('E · cardio real (mountain-climbers type=cardio) → 0 (defensa en profundidad intacta)', () => {
    expect(Object.values(vol([sess('cardio', [{ id: 'mountain-climbers', nsets: 2, kg: 0, reps: 30 }])])).reduce((a, b) => a + b, 0)).toBe(0);
  });
  it('covered · una fecha con solo cardio no re-cuenta workoutLog legacy en esa fecha', () => {
    // Sesión cardio marca la fecha como cubierta (0 volumen) → el legacy log de esa fecha no la duplica.
    const cardioDay = sess('cardio', [{ id: PRESS, nsets: 4, kg: 100 }], { date: D });
    const log = [{ date: D, exercise: PRESS, sets: [set(), set(), set()] }];
    expect(computeWeeklyVolume([cardioDay], BANK, 7, log as never)['pecho'] ?? 0).toBe(0);
  });
});

// ── REGIONAL COVERAGE (L-region) ─────────────────────────────────────────────
describe('9B.2 · regionExposure solo cuenta dominio fuerza', () => {
  const since = '2026-08-01';
  it('L · press-horizontal en cardio → NO incrementa upper-push', () => {
    const exp = regionExposure([sess('cardio', [{ id: PRESS, nsets: 4, kg: 100 }])], bankRegion, since);
    expect(exp['upper-push']).toBe(0);
  });
  it('L · press-horizontal en fuerza → sí incrementa upper-push', () => {
    const exp = regionExposure([sess('fuerza', [{ id: PRESS, nsets: 4 }])], bankRegion, since);
    expect(exp['upper-push']).toBeGreaterThan(0);
  });
  it('L · yoga con id de fuerza → NO incrementa', () => {
    expect(regionExposure([sess('yoga', [{ id: PRESS, nsets: 3 }])], bankRegion, since)['upper-push']).toBe(0);
  });
});

// ── BLOCK BOUNDARY (L-block) ─────────────────────────────────────────────────
describe('9B.2 · currentBlockId · deload non-strength no mueve la frontera', () => {
  it('L · deload en modality=cardio NO reinicia el bloque de fuerza', () => {
    const cardioDeload = sess('cardio', [{ id: PRESS, nsets: 3 }], { isDeload: true, date: D });
    expect(currentBlockId([cardioDeload])).toBe('blk-0');
  });
  it('L · deload en modality=fuerza sí mueve la frontera', () => {
    const strengthDeload = sess('fuerza', [{ id: PRESS, nsets: 3 }], { isDeload: true, date: D });
    expect(currentBlockId([strengthDeload])).toBe(`blk-${D}`);
  });
  it('L · yoga deload no mueve; fuerza deload posterior sí', () => {
    const yogaDeload = sess('yoga', [{ id: PRESS, nsets: 1 }], { isDeload: true, date: '2026-08-10', sessionId: 'y' });
    const fzDeload = sess('fuerza', [{ id: PRESS, nsets: 3 }], { isDeload: true, date: D, sessionId: 'f' });
    expect(currentBlockId([yogaDeload, fzDeload])).toBe(`blk-${D}`);
  });
});

// ── N · reclasificación imposible ────────────────────────────────────────────
describe('9B.2 · N · cardio explícito jamás reclasificado como fuerza', () => {
  it('aunque el Exercise sea 100% de fuerza (compuesto/pecho/defaultSets)', () => {
    expect(bankPress.type).not.toBe('cardio');           // el ejercicio ES de fuerza
    expect(bankPress.muscleGroup).toBe('pecho');
    expect(vol([sess('cardio', [{ id: PRESS, nsets: bankPress.defaultSets ?? 4, kg: 80 }])])['pecho'] ?? 0).toBe(0);
  });
});
