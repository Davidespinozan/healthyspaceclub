import { describe, it, expect } from 'vitest';
import { exercises } from '../../data/exercises';
import { VIDEO_VARIANT_IDS } from '../../data/videoAvailability';
import { movementPatternOf } from '../movementPattern';
import { categorize } from '../sessionPrescription';
import { buildSessionSlots } from '../sessionSlots';
import {
  regionsOfPattern, regionsOfExercise, requiredRegions, selectFullBodyAnchors,
  regionExposure, MAJOR_REGIONS, type Region,
} from '../regionalCoverage';
import type { MovementPattern } from '../movementPattern';
import type { Exercise, MuscleGroup } from '../../types';

const bankById = new Map(exercises.map(e => [e.id, e]));
const EX = (id: string) => bankById.get(id)!;
const hasVideo = (e: Exercise) => (e.variants ?? []).some(v => VIDEO_VARIANT_IDS.has(v.id));
const FB_MUSCLES: MuscleGroup[] = ['pecho', 'espalda', 'cuadriceps', 'gluteo', 'core', 'hombros', 'triceps', 'biceps', 'isquios', 'pantorrillas'];
const poolFor = (bucket: string) =>
  exercises.filter(e => !e.isYoga && e.muscleGroup !== 'cardio' && FB_MUSCLES.includes(e.muscleGroup) && (e.equipment ?? []).includes(bucket as never) && hasVideo(e));

const anchorsMetaFor = (ids: string[]) => ids.map(id => {
  const ex = EX(id);
  return { id, muscle: ex.muscleGroup, pattern: movementPatternOf(ex), role: categorize(ex) };
});
// Regiones MAYORES cubiertas por un conjunto de slots (vía sus patrones).
const majorsOfSlots = (slots: { muscle: MuscleGroup; patterns: string[] }[]): Region[] =>
  MAJOR_REGIONS.filter(r => slots.some(s => s.patterns.some(p => regionsOfPattern(p as MovementPattern).includes(r))));

// ── §1 · TAXONOMÍA DE REGIONES ──────────────────────────────────────────
describe('REGIONAL · patrones → regiones (§1)', () => {
  it('mapea las cuatro funciones mayores + accesorios', () => {
    expect(regionsOfPattern('horizontal-push')).toEqual(['upper-push']);
    expect(regionsOfPattern('vertical-pull')).toEqual(['upper-pull']);
    expect(regionsOfPattern('squat')).toEqual(['lower-knee']);
    expect(regionsOfPattern('hinge')).toEqual(['lower-hinge']);
    expect(regionsOfPattern('elbow-flexion')).toEqual(['arms']);
    expect(regionsOfPattern('calf-raise')).toEqual(['calves']);
    expect(regionsOfPattern('rear-delt')).toEqual(['delts']);
    expect(regionsOfPattern('full-body')).toEqual(['upper-push', 'lower-knee']); // cluster
    expect(regionsOfPattern(null)).toEqual([]);
  });
});

// ── §2/§3/§4 · COBERTURA MÍNIMA DINÁMICA ────────────────────────────────
describe('REGIONAL · requiredRegions (§2/§3/§4)', () => {
  it('SIEMPRE ≥1 upper mayor + ≥1 lower mayor', () => {
    for (const t of [30, 45, 60, 90]) {
      const r = requiredRegions({ timeMinutes: t, trainingGoal: 'hipertrofia' });
      expect(r.some(x => x === 'upper-push' || x === 'upper-pull')).toBe(true);
      expect(r.some(x => x === 'lower-knee' || x === 'lower-hinge')).toBe(true);
    }
  });
  it('30 min: compacto (3 patrones) — 1 lower + 2 upper por defecto (no dos lower pesados) (§3)', () => {
    const r = requiredRegions({ timeMinutes: 30, trainingGoal: 'hipertrofia' });
    expect(r).toHaveLength(3);
    expect(r.filter(x => x === 'upper-push' || x === 'upper-pull')).toHaveLength(2);
    expect(r.filter(x => x === 'lower-knee' || x === 'lower-hinge')).toHaveLength(1);
  });
  it('60 min: cobertura completa (las cuatro mayores) (§4)', () => {
    const r = requiredRegions({ timeMinutes: 60, trainingGoal: 'hipertrofia' });
    expect([...r].sort()).toEqual([...MAJOR_REGIONS].sort());
  });
  it('énfasis rota por DÉFICIT, no random (§8): una región hambrienta entra primero', () => {
    const r = requiredRegions({ timeMinutes: 30, trainingGoal: 'hipertrofia',
      exposure: { 'upper-push': 12, 'lower-knee': 12, 'upper-pull': 0, 'lower-hinge': 0 } });
    // pull y hinge están rezagados → deben ser el upper y el lower elegidos
    expect(r).toContain('upper-pull');
    expect(r).toContain('lower-hinge');
  });
});

// ── §7/§23/§28 · ANCHORS COMPLEMENTARIOS ────────────────────────────────
describe('REGIONAL · selectFullBodyAnchors (§7/§23/§28)', () => {
  const gym = poolFor('gym');
  // pool ARTIFICIALMENTE sesgado a upper (todos los push/pull primero) — §28.A
  const upperBias = [...gym].sort((a, b) => {
    const ra = regionsOfExercise(a), rb = regionsOfExercise(b);
    const key = (r: Region[]) => (r.includes('upper-push') ? 0 : r.includes('upper-pull') ? 1 : 5);
    return key(ra) - key(rb);
  });
  it('con pool sesgado a upper pero lower válidos, los 3 anchors NO son todos de la misma región (§28.A)', () => {
    const regs = requiredRegions({ timeMinutes: 30, trainingGoal: 'hipertrofia' });
    const ids = selectFullBodyAnchors(upperBias, 'hipertrofia', 3, regs);
    const regions = new Set(ids.flatMap(id => regionsOfExercise(EX(id))));
    // cubre al menos un upper y un lower (no 3 upper)
    expect([...regions].some(r => r === 'upper-push' || r === 'upper-pull')).toBe(true);
    expect([...regions].some(r => r === 'lower-knee' || r === 'lower-hinge')).toBe(true);
  });
  it('pool sesgado a LOWER pero upper válidos → garantiza upper (§28.B)', () => {
    const lowerBias = [...gym].sort((a, b) => {
      const key = (e: Exercise) => (regionsOfExercise(e).some(r => r === 'lower-knee' || r === 'lower-hinge') ? 0 : 5);
      return key(a) - key(b);
    });
    const regs = requiredRegions({ timeMinutes: 60, trainingGoal: 'hipertrofia' });
    const ids = selectFullBodyAnchors(lowerBias, 'hipertrofia', 3, regs);
    const regions = new Set(ids.flatMap(id => regionsOfExercise(EX(id))));
    expect([...regions].some(r => r === 'upper-push' || r === 'upper-pull')).toBe(true);
  });
  it('prefiere main-compound como ancla de región', () => {
    const regs = requiredRegions({ timeMinutes: 30, trainingGoal: 'fuerza' });
    const ids = selectFullBodyAnchors(gym, 'fuerza', 3, regs);
    // al menos una es main-compound
    expect(ids.some(id => categorize(EX(id)) === 'main-compound')).toBe(true);
  });
});

// ── §16/§20/§24/§25 · COBERTURA EN SLOTS ────────────────────────────────
describe('REGIONAL · buildSessionSlots cubre todo el cuerpo (§20/§24/§25)', () => {
  it('E — 30 min full-body: cubre upper Y lower (antes: sesgo upper, sin hinge) (§24)', () => {
    const gym = poolFor('gym');
    const regs = requiredRegions({ timeMinutes: 30, trainingGoal: 'hipertrofia' });
    const anchorIds = selectFullBodyAnchors(gym, 'hipertrofia', 3, regs);
    const slots = buildSessionSlots({
      dayMuscles: ['pecho', 'espalda', 'cuadriceps', 'gluteo', 'core'], trainingGoal: 'hipertrofia',
      allocation: { pecho: 6, espalda: 6, cuadriceps: 6, gluteo: 5, core: 3 },
      anchors: anchorsMetaFor(anchorIds), timeCap: 5, requiredRegions: regs,
    });
    const majors = majorsOfSlots(slots);
    expect(majors.some(r => r === 'upper-push' || r === 'upper-pull')).toBe(true);
    expect(majors.some(r => r === 'lower-knee' || r === 'lower-hinge')).toBe(true);
  });
  it('H — 60 min bodyweight: cubre trabajo REAL de piernas (antes: sin piernas) (§25)', () => {
    const bw = poolFor('cuerpo');
    const regs = requiredRegions({ timeMinutes: 60, trainingGoal: 'hipertrofia' });
    const anchorIds = selectFullBodyAnchors(bw, 'hipertrofia', 3, regs);
    const slots = buildSessionSlots({
      dayMuscles: ['pecho', 'espalda', 'cuadriceps', 'gluteo', 'core'], trainingGoal: 'hipertrofia',
      allocation: { pecho: 6, espalda: 6, cuadriceps: 6, gluteo: 6, core: 3 },
      anchors: anchorsMetaFor(anchorIds), timeCap: 9, requiredRegions: regs,
    });
    const majors = majorsOfSlots(slots);
    // el banco bodyweight SÍ tiene knee+hinge → la sesión debe entrenar piernas
    expect(majors.some(r => r === 'lower-knee' || r === 'lower-hinge')).toBe(true);
  });
});

// ── §6/§21 · ANCHORS CUENTAN COMO COBERTURA / SIN REDUNDANCIA ────────────
describe('REGIONAL · anchors cuentan como cobertura; sin duplicar (§6/§21)', () => {
  it('un anchor de squat cubre lower-knee → no se inyecta OTRO slot de knee', () => {
    const anchors = anchorsMetaFor(['sentadilla-bilateral', 'press-horizontal', 'remo-horizontal-pesado']);
    const regs: Region[] = ['lower-knee', 'upper-push', 'upper-pull'];
    const slots = buildSessionSlots({
      dayMuscles: ['pecho', 'espalda', 'cuadriceps', 'gluteo', 'core'], trainingGoal: 'hipertrofia',
      allocation: { pecho: 5, espalda: 5, cuadriceps: 5, gluteo: 4, core: 2 },
      anchors, timeCap: 5, requiredRegions: regs,
    });
    // squat aparece una sola vez (el anchor); no hay un segundo slot de patrón squat
    const squatSlots = slots.filter(s => s.patterns.includes('squat'));
    expect(squatSlots).toHaveLength(1);
    expect(squatSlots[0].filledBy).toBe('sentadilla-bilateral');
  });
});

// ── §11 · EXPOSICIÓN / DÉFICIT ──────────────────────────────────────────
describe('REGIONAL · regionExposure (§11)', () => {
  it('cuenta exposiciones por región desde sesiones recientes', () => {
    const sessions = [
      { date: '2026-08-10', exerciseIds: ['press-horizontal', 'remo-horizontal-pesado', 'sentadilla-bilateral'] },
      { date: '2026-08-01', exerciseIds: ['press-inclinado'] }, // fuera de rango
    ];
    const exp = regionExposure(sessions, bankById, '2026-08-05');
    expect(exp['upper-push']).toBe(1);
    expect(exp['upper-pull']).toBe(1);
    expect(exp['lower-knee']).toBe(1);
    expect(exp['lower-hinge']).toBe(0);
  });
});

// ── §15 · AUDITORÍA DE CONTENIDO (bodyweight) ───────────────────────────
describe('REGIONAL · content audit bodyweight (§15)', () => {
  it('el banco bodyweight tiene candidatos con video para knee, hinge y push (no hay content-gap de piernas)', () => {
    const bw = poolFor('cuerpo');
    const byRegion = new Map<Region, string[]>();
    for (const e of bw) for (const r of regionsOfExercise(e)) byRegion.set(r, [...(byRegion.get(r) ?? []), e.id]);
    expect((byRegion.get('lower-knee') ?? []).length).toBeGreaterThan(0);
    expect((byRegion.get('lower-hinge') ?? []).length).toBeGreaterThan(0);
    expect((byRegion.get('upper-push') ?? []).length).toBeGreaterThan(0);
  });
});
