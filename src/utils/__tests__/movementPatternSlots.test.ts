import { describe, it, expect } from 'vitest';
import { exercises } from '../../data/exercises';
import { VIDEO_VARIANT_IDS } from '../../data/videoAvailability';
import { movementPatternOf, ALL_MOVEMENT_PATTERNS, regionOfPattern, type MovementPattern } from '../movementPattern';
import {
  patternCap, buildSessionSlots, requiredPatterns, redundancyReport, applySessionStructure,
} from '../sessionSlots';
import type { Exercise, MuscleGroup, TrainingGoal } from '../../types';

// ─────────────────────────────────────────────────────────────────────────
// FASE 3 · movementPattern + slots + anti-redundancia.
// ─────────────────────────────────────────────────────────────────────────

const RES = exercises.filter(e => !e.isYoga && e.muscleGroup !== 'cardio');
const bankById = new Map(exercises.map(e => [e.id, e]));
const PATTERN_SET = new Set<string>(ALL_MOVEMENT_PATTERNS);

// ── §25 · AUDITORÍA DEL BANCO ───────────────────────────────────────────
describe('BANCO · taxonomía de movementPattern (cobertura 100%)', () => {
  it('todo ejercicio de resistencia tiene un patrón VÁLIDO (sin UNKNOWN silencioso)', () => {
    const unknown = RES.filter(e => { const p = movementPatternOf(e); return !p || !PATTERN_SET.has(p); });
    expect(unknown.map(e => e.id)).toEqual([]); // si algo aparece, es un ejercicio sin clasificar
  });
  it('yoga y cardio NO se contaminan (patrón = null)', () => {
    const contaminated = exercises.filter(e => (e.isYoga || e.muscleGroup === 'cardio') && movementPatternOf(e) !== null);
    expect(contaminated.map(e => e.id)).toEqual([]);
  });
  it('metadata explícita GANA sobre la clasificación por id', () => {
    const fake = { id: 'press-horizontal', muscleGroup: 'pecho', movementPattern: 'vertical-pull' } as unknown as Exercise;
    expect(movementPatternOf(fake)).toBe('vertical-pull'); // override explícito
  });
  it('los anchors candidatos (compuestos con video) tienen patrón', () => {
    const anchorable = RES.filter(e => e.type === 'compuesto' && (e.variants ?? []).some(v => VIDEO_VARIANT_IDS.has(v.id)));
    expect(anchorable.every(e => !!movementPatternOf(e))).toBe(true);
  });
  it('regionOfPattern clasifica los patrones en push/pull/lower/core', () => {
    expect(regionOfPattern('horizontal-push')).toBe('push');
    expect(regionOfPattern('vertical-pull')).toBe('pull');
    expect(regionOfPattern('squat')).toBe('lower');
    expect(regionOfPattern('core-anti-rotation')).toBe('core');
  });
});

// ── ANTI-REDUNDANCIA (cap por patrón) ───────────────────────────────────
describe('ANTI-REDUNDANCIA · cap por patrón (fuerza estricta, hipertrofia flexible)', () => {
  it('patternCap: fuerza 1, hipertrofia 2', () => {
    expect(patternCap('fuerza')).toBe(1);
    expect(patternCap('hipertrofia')).toBe(2);
  });

  const runStruct = (ids: string[], tg: TrainingGoal, anchorIds: string[] = []) => {
    const cands = ids.map(id => bankById.get(id)!).filter(Boolean);
    return applySessionStructure({
      exercises: ids.map(id => ({ id })), anchorIds, requiredPatterns: [],
      candidates: cands, bankById, trainingGoal: tg, targetCount: ids.length,
      makeItem: (id) => ({ id }),
    });
  };

  it('§29.1 · bench + incline + declinado + press-cerrado (4× horizontal-push)', () => {
    const ids = ['press-horizontal', 'press-inclinado', 'press-declinado', 'press-cerrado'];
    const fuerza = runStruct(ids, 'fuerza');
    const hip = runStruct(ids, 'hipertrofia');
    expect(redundancyReport(fuerza.exercises.map(e => e.id), bankById).maxPerPattern).toBe(1); // fuerza: solo 1
    expect(redundancyReport(hip.exercises.map(e => e.id), bankById).maxPerPattern).toBe(2);     // hipertrofia: máx 2
  });

  it('§29.2 · squat + prensa + sentarse-pararse + sentadilla-pliometrica (4× squat)', () => {
    const ids = ['sentadilla-bilateral', 'prensa-piernas', 'sentarse-pararse', 'sentadilla-pliometrica'];
    expect(redundancyReport(runStruct(ids, 'fuerza').exercises.map(e => e.id), bankById).maxPerPattern).toBe(1);
    expect(redundancyReport(runStruct(ids, 'hipertrofia').exercises.map(e => e.id), bankById).maxPerPattern).toBe(2);
  });

  it('§29.3 · 4× vertical-pull (pulldowns/pullover)', () => {
    const ids = ['traccion-vertical-polea', 'traccion-vertical-supina', 'traccion-vertical-neutra', 'pullover'];
    expect(redundancyReport(runStruct(ids, 'hipertrofia').exercises.map(e => e.id), bankById).maxPerPattern).toBeLessThanOrEqual(2);
    expect(redundancyReport(runStruct(ids, 'fuerza').exercises.map(e => e.id), bankById).maxPerPattern).toBe(1);
  });

  it('§29.5 · anchor NO se duplica: bench anchor + otro horizontal-push en fuerza → queda solo el anchor', () => {
    const ids = ['press-horizontal', 'press-inclinado'];
    const r = runStruct(ids, 'fuerza', ['press-horizontal']);
    expect(r.exercises.map(e => e.id)).toContain('press-horizontal'); // el anchor sobrevive
    expect(redundancyReport(r.exercises.map(e => e.id), bankById).maxPerPattern).toBe(1);
  });

  it('§10 · hipertrofia SÍ permite bench + incline DB (2 del mismo patrón, no prohibición absoluta)', () => {
    const r = runStruct(['press-horizontal', 'press-inclinado'], 'hipertrofia');
    expect(r.exercises).toHaveLength(2); // ambos sobreviven
  });

  it('patrones DISTINTOS no se tocan (squat + hinge + horizontal-push conviven)', () => {
    const ids = ['sentadilla-bilateral', 'peso-muerto-rumano', 'press-horizontal'];
    const r = runStruct(ids, 'fuerza');
    expect(r.exercises).toHaveLength(3);
  });
});

// ── COBERTURA (patrón requerido injectado) ──────────────────────────────
describe('COBERTURA · patrón requerido siempre presente (§6, §18, §19)', () => {
  it('si falta un patrón requerido, el motor lo INYECTA de los candidatos', () => {
    // sesión que solo trae empujes; falta el pull requerido → se inyecta un remo/jalón
    const cands = ['press-horizontal', 'traccion-vertical-polea', 'remo-horizontal-pesado'].map(id => bankById.get(id)!);
    const r = applySessionStructure({
      exercises: [{ id: 'press-horizontal' }], anchorIds: [],
      requiredPatterns: ['horizontal-push', 'vertical-pull'] as MovementPattern[],
      candidates: cands, bankById, trainingGoal: 'hipertrofia', targetCount: 3,
      makeItem: (id) => ({ id }),
    });
    const pats = r.exercises.map(e => movementPatternOf(bankById.get(e.id)!));
    expect(pats).toContain('vertical-pull'); // cobertura garantizada
  });

  it('§29.6 · IA elige patrón incorrecto para un slot → cobertura repara', () => {
    // el usuario "necesita" un pull pero la IA solo mandó empujes → se repara con un pull válido
    const cands = ['press-horizontal', 'press-inclinado', 'remo-horizontal-pesado'].map(id => bankById.get(id)!);
    const r = applySessionStructure({
      exercises: [{ id: 'press-horizontal' }, { id: 'press-inclinado' }], anchorIds: [],
      requiredPatterns: ['horizontal-pull'] as MovementPattern[],
      candidates: cands, bankById, trainingGoal: 'hipertrofia', targetCount: 3,
      makeItem: (id) => ({ id }),
    });
    expect(r.exercises.some(e => movementPatternOf(bankById.get(e.id)!) === 'horizontal-pull')).toBe(true);
  });
});

// ── SLOTS (diseño de sesión) ────────────────────────────────────────────
describe('SLOTS · diseñar la sesión antes de llenarla', () => {
  const anchor = (id: string) => {
    const ex = bankById.get(id)!;
    return { id, muscle: ex.muscleGroup, pattern: movementPatternOf(ex), role: 'main-compound' as const };
  };

  it('§6 · el anchor SATISFACE su slot (filledBy), no se duplica el patrón', () => {
    const slots = buildSessionSlots({
      dayMuscles: ['pecho', 'espalda', 'hombros'] as MuscleGroup[], trainingGoal: 'hipertrofia',
      targetCount: 5, anchors: [anchor('press-horizontal')],
    });
    const filled = slots.find(s => s.filledBy === 'press-horizontal');
    expect(filled).toBeTruthy();
    expect(filled!.patterns).toContain('horizontal-push');
    // ningún OTRO slot pide horizontal-push (no se duplica el patrón del anchor)
    const others = slots.filter(s => !s.filledBy);
    expect(others.every(s => !s.patterns.includes('horizontal-push'))).toBe(true);
  });

  it('§7 · FUERZA: menos slots de aislamiento que hipertrofia (mismo día/tiempo)', () => {
    const args = { dayMuscles: ['pecho', 'espalda', 'hombros', 'biceps', 'triceps'] as MuscleGroup[], targetCount: 6, anchors: [anchor('press-horizontal')] };
    const iso = (tg: TrainingGoal) => buildSessionSlots({ ...args, trainingGoal: tg }).filter(s => s.role === 'isolation').length;
    expect(iso('fuerza')).toBeLessThanOrEqual(iso('hipertrofia'));
  });

  it('§14 · 30 min (targetCount bajo) → estructura compacta; 90 → más cobertura', () => {
    const args = { dayMuscles: ['pecho', 'espalda', 'hombros', 'biceps', 'triceps'] as MuscleGroup[], trainingGoal: 'hipertrofia' as TrainingGoal, anchors: [anchor('press-horizontal')] };
    const s30 = buildSessionSlots({ ...args, targetCount: 3 });
    const s90 = buildSessionSlots({ ...args, targetCount: 8 });
    expect(s30.length).toBeLessThan(s90.length);
    expect(s30.length).toBeLessThanOrEqual(3);
  });

  it('§13 · P5 prioridad: el músculo prioritario recibe slot antes', () => {
    const slots = buildSessionSlots({
      dayMuscles: ['pecho', 'espalda', 'hombros'] as MuscleGroup[], trainingGoal: 'hipertrofia',
      targetCount: 4, anchors: [], priorityMuscles: new Set(['espalda']),
    });
    const firstNonAnchor = slots.find(s => !s.filledBy);
    expect(firstNonAnchor!.muscle).toBe('espalda'); // prioridad va primero
  });

  it('requiredPatterns: extrae los patrones de los slots requeridos', () => {
    const slots = buildSessionSlots({
      dayMuscles: ['pecho', 'espalda'] as MuscleGroup[], trainingGoal: 'fuerza',
      targetCount: 3, anchors: [anchor('press-horizontal')],
    });
    const req = requiredPatterns(slots);
    expect(req).toContain('horizontal-push'); // del anchor
    expect(req.length).toBeGreaterThan(0);
  });
});

// ── LONGITUDINAL (§28) ──────────────────────────────────────────────────
describe('LONGITUDINAL · variedad controlada + redundancy rate ≈ 0', () => {
  // Simula 12 sesiones "upper hipertrofia": anchor estable + accesorios que rotan entre
  // opciones equivalentes del MISMO patrón (variedad reproducible, no random).
  const anchorId = 'press-horizontal';
  const isoPoolByWeek = (w: number) => {
    // rotación determinista de curl (elbow-flexion) por recencia/semana
    const curls = ['curl-pie', 'curl-martillo', 'curl-inclinado', 'curl-concentrado'];
    return ['traccion-vertical-polea', 'elevacion-lateral', curls[w % curls.length]];
  };

  it('anchor continuo, accesorio de bíceps ROTA entre variantes del mismo patrón, redundancy 0', () => {
    const seenCurls = new Set<string>();
    let maxRedundancy = 0;
    for (let w = 0; w < 12; w++) {
      const ids = [anchorId, ...isoPoolByWeek(w)];
      const r = applySessionStructure({
        exercises: ids.map(id => ({ id })), anchorIds: [anchorId], requiredPatterns: ['horizontal-push'] as MovementPattern[],
        candidates: ids.map(id => bankById.get(id)!), bankById, trainingGoal: 'hipertrofia', targetCount: ids.length,
        makeItem: (id) => ({ id }),
      });
      const finalIds = r.exercises.map(e => e.id);
      expect(finalIds).toContain(anchorId);                       // continuidad
      const curl = finalIds.find(id => id.startsWith('curl-'));
      if (curl) seenCurls.add(curl);
      maxRedundancy = Math.max(maxRedundancy, redundancyReport(finalIds, bankById).maxPerPattern);
    }
    expect(seenCurls.size).toBeGreaterThan(1);   // hubo VARIEDAD de accesorio (rotación real)
    expect(maxRedundancy).toBeLessThanOrEqual(2); // nunca redundancia absurda
  });
});
