import { describe, it, expect } from 'vitest';
import { exercises } from '../../data/exercises';
import { exerciseQuality, qualityScore, rankCandidates, bestCandidate, type QualityContext } from '../exerciseQuality';
import { roleOf } from '../exerciseRole';
import { HEAVY_COMPOUND } from '../exerciseOrder';

const bankById = new Map(exercises.map(e => [e.id, e]));
const EX = (id: string) => bankById.get(id)!;
const hip: QualityContext = { trainingGoal: 'hipertrofia', level: 'intermedio' };
const fue: QualityContext = { trainingGoal: 'fuerza', level: 'intermedio' };
const tier = (id: string, ctx = hip) => exerciseQuality(EX(id), ctx).tier;

// ── §22 · QUAD ──────────────────────────────────────────────────────────
describe('QUALITY · quad (§22) — leg-ext gana a jump/sissy; leg-press bien como secundario', () => {
  it('leg extension = preferred; jump squat / sissy = fallback', () => {
    expect(tier('extension-cuadriceps')).toBe('preferred');
    expect(qualityScore(EX('extension-cuadriceps'), hip)).toBeGreaterThan(qualityScore(EX('sentadilla-pliometrica'), hip));
    expect(qualityScore(EX('extension-cuadriceps'), hip)).toBeGreaterThan(qualityScore(EX('sissy-squat'), hip));
    expect(tier('sentadilla-pliometrica')).toBe('fallback');
  });
  it('leg press (máquina, secundario) es buena opción; jump squat no', () => {
    expect(qualityScore(EX('prensa-piernas'), hip)).toBeGreaterThan(qualityScore(EX('sentadilla-pliometrica'), hip));
    expect(['preferred', 'good']).toContain(tier('prensa-piernas'));
  });
  it('NO es ranking universal: leg press no aplasta a búlgara por defecto (cerca en calidad)', () => {
    const gap = qualityScore(EX('prensa-piernas'), hip) - qualityScore(EX('sentadilla-unilateral'), hip);
    expect(gap).toBeLessThanOrEqual(2); // quedan cerca → recency puede rotar
  });
});

// ── §18/§28 · PLIOMETRÍA nunca compite en slot normal ───────────────────
describe('QUALITY · pliometría/conditioning fuera del slot normal (§18)', () => {
  it('jump squat SIEMPRE por debajo de opciones convencionales de quad', () => {
    for (const alt of ['sentadilla-bilateral', 'prensa-piernas', 'extension-cuadriceps', 'sentadilla-unilateral']) {
      expect(qualityScore(EX('sentadilla-pliometrica'), hip)).toBeLessThan(qualityScore(EX(alt), hip));
    }
  });
});

// ── §24 · STRENGTH PRESS ────────────────────────────────────────────────
describe('QUALITY · strength horizontal push (§24)', () => {
  it('en fuerza, el press cargable > flexión de peso corporal; el fly nunca sustituye al press', () => {
    expect(qualityScore(EX('press-horizontal'), fue)).toBeGreaterThan(qualityScore(EX('flexiones-diamante'), fue));
    // aperturas (fly) es aislamiento → no gana un slot de empuje principal (rol distinto lo excluye antes,
    // y aquí su calidad como "press" es menor por no ser cargable-compuesto-específico)
    expect(roleOf(EX('aperturas'), HEAVY_COMPOUND)).toBe('isolation');
  });
});

// ── §25 · BODYWEIGHT/BANDS relativo al pool ─────────────────────────────
describe('QUALITY · gear limitado: mejor opción del pool, no "todo fallback" (§25)', () => {
  it('entre solo peso corporal, hay un mejor candidato (no null)', () => {
    const bwPush = ['flexiones-diamante', 'flexion-pared'].map(EX);
    expect(bestCandidate(bwPush, hip)).not.toBeNull();
  });
  it('el ranking es RELATIVO: la mejor flexión disponible se elige aunque no sea cargable', () => {
    const ranked = rankCandidates(['flexiones-diamante', 'flexion-pared'].map(EX), hip);
    expect(ranked[0]).toBeTruthy();
  });
});

// ── §14/§28 · CALIDAD PRIMERO, VARIEDAD SEGUNDO ─────────────────────────
describe('QUALITY · rankCandidates — calidad primero, recencia como desempate', () => {
  it('calidad manda: leg-ext antes que jump-squat sin importar el orden de entrada', () => {
    const ranked = rankCandidates(['sentadilla-pliometrica', 'extension-cuadriceps'].map(EX), hip);
    expect(ranked[0].id).toBe('extension-cuadriceps');
  });
  it('empate de calidad → preserva el orden previo (recencia/variedad), STABLE', () => {
    // dos curls (misma calidad) → conserva el orden de entrada (que trae la rotación por recencia)
    const a = rankCandidates(['curl-martillo', 'curl-inclinado'].map(EX), hip).map(e => e.id);
    const b = rankCandidates(['curl-inclinado', 'curl-martillo'].map(EX), hip).map(e => e.id);
    expect(a).toEqual(['curl-martillo', 'curl-inclinado']);
    expect(b).toEqual(['curl-inclinado', 'curl-martillo']); // el orden previo decide el empate
  });
});

// ── §21 · AUDITORÍA DEL BANCO ───────────────────────────────────────────
describe('QUALITY · auditoría del banco (§21)', () => {
  const RES = exercises.filter(e => !e.isYoga && e.muscleGroup !== 'cardio');
  it('ningún ejercicio pliométrico/conditioning llega a "preferred" en slot normal', () => {
    for (const e of RES) {
      const isPly = roleOf(e, HEAVY_COMPOUND) === 'conditioning' || e.impact === 'high' || e.fallRisk;
      if (isPly) expect(exerciseQuality(e, hip).tier).toBe('fallback');
    }
  });
  it('cada ejercicio produce un tier válido con razones (sin contradicción)', () => {
    for (const e of RES) {
      const q = exerciseQuality(e, hip);
      expect(['preferred', 'good', 'acceptable', 'fallback']).toContain(q.tier);
      expect(q.reasons.length).toBeGreaterThan(0);
    }
  });
  it('principiante: los movimientos técnicos (sissy/pliométrico) bajan de tier', () => {
    const pri: QualityContext = { trainingGoal: 'hipertrofia', level: 'principiante' };
    expect(qualityScore(EX('sissy-squat'), pri)).toBeLessThan(qualityScore(EX('extension-cuadriceps'), pri));
  });
});
