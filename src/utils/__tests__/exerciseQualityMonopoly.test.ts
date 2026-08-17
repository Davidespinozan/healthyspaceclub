import { describe, it, expect } from 'vitest';
import { exercises } from '../../data/exercises';
import { exerciseQuality, qualityScore, rankCandidates } from '../exerciseQuality';
import { deriveCapabilities } from '../equipmentImplement';
import {
  filterWithProgressiveRelaxation, orderCandidatesForVariety, orderByChallenge,
  capByMovementFamily, hasPlayableVariant, DAY_TYPE_CONFIG,
} from '../workoutPlanner';
import { allocateSessionVolume } from '../sessionPrescription';
import type { Exercise } from '../../types';

// ════════════════════════════════════════════════════════════════════════════
// FIX DEL MONOPOLIO DE RANKING (exerciseQuality) — protección contra sobrecorrección.
// Un aislamiento cargable NO debe tener ventaja estructural sobre un compuesto cargable, y
// "cargable" debe depender del EQUIPO REAL del usuario, no de la unión del patrón. Sin cuotas,
// sin random, sin forzar ejercicios. La DOSIS (sets/volumen) permanece intacta.
// ════════════════════════════════════════════════════════════════════════════
const bank = exercises as Exercise[];
const byId = (id: string) => bank.find(e => e.id === id)!;
const GYM = { trainingGoal: 'hipertrofia' as const, level: 'intermedio', equipment: ['cuerpo', 'gym'] as any };
const BODY = { trainingGoal: 'hipertrofia' as const, level: 'intermedio', equipment: ['cuerpo'] as any };

function gymPool(split: keyof typeof DAY_TYPE_CONFIG): Exercise[] {
  const caps = deriveCapabilities(['gym']);
  const fr = filterWithProgressiveRelaxation({
    exercises: bank, equipment: caps.equipmentList, muscleGroups: DAY_TYPE_CONFIG[split].muscleGroups,
    goal: 'hipertrofia' as any, excludeMuscles: [], minCandidates: 3, primaryOnly: false,
    difficulty: 'intermedio', lowImpactMode: false, allowedImplements: caps.allowedImplements,
  });
  let c = fr.exercises;
  c = orderCandidatesForVariety(c, new Set());
  c = orderByChallenge(c, 'intermedio', caps.equipmentList, caps.allowedImplements);
  c = capByMovementFamily(c, 2);
  c = c.filter(ex => hasPlayableVariant(ex, caps.equipmentList, caps.allowedImplements));
  c = rankCandidates(c, { trainingGoal: 'hipertrofia', level: 'intermedio', equipment: caps.equipmentList } as any);
  return c.filter(e => !e.isYoga);
}

describe('exerciseQuality · monopolio de ranking', () => {
  it('1. aislamiento cargable NO supera a compuesto cargable (mismo contexto gym)', () => {
    const compound = qualityScore(byId('press-horizontal') as any, GYM);   // main compuesto
    const secondary = qualityScore(byId('remo-invertido') as any, GYM);    // secondary compuesto
    const isolation = qualityScore(byId('hiperextensiones') as any, GYM);  // aislamiento cargable
    expect(compound).toBeGreaterThanOrEqual(isolation);
    expect(secondary).toBeGreaterThanOrEqual(isolation);
  });

  it('2. un compuesto apropiado rankea sobre un aislamiento accesorio', () => {
    const ranked = rankCandidates([byId('hiperextensiones'), byId('press-horizontal')] as any, GYM);
    expect(ranked[0].id).toBe('press-horizontal');
  });

  it('3. el aislamiento sigue siendo seleccionable (no queda descartado)', () => {
    const q = exerciseQuality(byId('hiperextensiones') as any, GYM);
    expect(q.score).toBeGreaterThanOrEqual(0);          // no cae a fallback negativo
    const ranked = rankCandidates(gymPool('legs') as any, GYM);
    expect(ranked.some(e => e.id === 'hiperextensiones')).toBe(true);
  });

  it('4. NO todo el top-15 son compuestos — el aislamiento sigue llegando arriba', () => {
    const top15 = gymPool('legs').slice(0, 15);
    expect(top15.some(e => e.type === 'aislamiento')).toBe(true);   // aislamientos presentes
    expect(top15.some(e => e.type === 'compuesto')).toBe(true);     // compuestos también
  });

  it('5. contexto BODYWEIGHT no hereda puntos gym (menor que en gym)', () => {
    const gym = qualityScore(byId('hiperextensiones') as any, GYM);
    const body = qualityScore(byId('hiperextensiones') as any, BODY);
    expect(body).toBeLessThan(gym);
  });

  it('6. contexto GYM sí reconoce carga válida (compuesto cargable puntúa alto)', () => {
    expect(qualityScore(byId('press-horizontal') as any, GYM)).toBeGreaterThanOrEqual(4);
  });

  it('7. remo-invertido entra al top-15 de una ruta válida (pull) tras el fix', () => {
    const top15 = gymPool('pull').slice(0, 15).map(e => e.id);
    expect(top15).toContain('remo-invertido');
  });

  it('8. RDL gym sigue NO disponible (solo tiene video en la variante de banda)', () => {
    const caps = deriveCapabilities(['gym']);
    expect(hasPlayableVariant(byId('peso-muerto-rumano'), caps.equipmentList, caps.allowedImplements)).toBe(false);
  });

  it('9. curl-muñeca y cluster-barra NO se fuerzan (fuera del top-3; cluster excluido de hipertrofia)', () => {
    const anchorsUpper = gymPool('upper').slice(0, 3).map(e => e.id);
    expect(anchorsUpper).not.toContain('curl-muneca');
    const legsIds = gymPool('legs').map(e => e.id);
    expect(legsIds).not.toContain('cluster-barra');   // goals=['condicion','fuerza'], sin hipertrofia
  });

  it('10. DOSIS intacta: allocateSessionVolume no depende de exerciseQuality (dose estable)', () => {
    const dose = allocateSessionVolume({
      weeklyTarget: { pecho: 12, hombros: 10, triceps: 8 },
      doneThisWeek: { pecho: 0, hombros: 0, triceps: 0 },
      dayMuscles: ['pecho', 'hombros', 'triceps'],
      freqTarget: 4, sessionsThisWeekDone: 0,
      muscleWeeklyFreq: { pecho: 2, hombros: 2, triceps: 2 },
    });
    expect(dose).toEqual({ pecho: 6, hombros: 5, triceps: 4 });   // 15 sets, invariante al ranking
  });
});
