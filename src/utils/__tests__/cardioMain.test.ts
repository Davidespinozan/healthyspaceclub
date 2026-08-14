import { describe, it, expect } from 'vitest';
import { exercises } from '../../data/exercises';
import { VIDEO_VARIANT_IDS } from '../../data/videoAvailability';
import { cardioEquipmentFor, matchesCardioStyle } from '../workoutPlanner';
import { allocateTime } from '../sessionBlocks';
import { buildCardioMain, intensityBudget } from '../cardioMain';
import type { CardioStyle, Equipment, Exercise } from '../../types';

const hv = (e: Exercise, eq: Equipment[]) => (e.variants ?? []).some(v => VIDEO_VARIANT_IDS.has(v.id) && (v.equipment ?? []).some(x => eq.includes(x)));
function pool(style: CardioStyle, gear: Equipment[], lowImpact = false) {
  const eq = cardioEquipmentFor(gear);
  const p = exercises.filter(e => e.muscleGroup === 'cardio' && hv(e, eq) && !(lowImpact && (e.impact === 'high' || e.fallRisk)));
  const styled = p.filter(e => matchesCardioStyle(e, style));
  return styled.length >= 1 ? styled : p;
}
const mainBudget = (t: number) => allocateTime({ totalMinutes: t, isStrengthDay: false, objective: 'condicion', trainingGoal: 'hipertrofia' }).main;
const STYLES: CardioStyle[] = ['lowImpact', 'correr', 'funcional', 'explosividad'];
const TIMES = [30, 45, 60, 75, 90, 120];
const LEVELS = ['principiante', 'intermedio', 'avanzado'];
const plan = (style: CardioStyle, t: number, level: string, extra = {}) =>
  buildCardioMain({ mainBudgetMinutes: mainBudget(t), style, level, pool: pool(style, ['gym']), ...extra });

// ── §24 · INVARIANTES GLOBALES ──────────────────────────────────────────
describe('CARDIO-MAIN · invariantes globales (§24)', () => {
  it('plannedMinutes ≤ mainBudget, sin NaN/negativos, en toda la matriz', () => {
    for (const s of STYLES) for (const t of TIMES) for (const l of LEVELS) {
      const p = plan(s, t, l);
      expect(p.totalMinutes).toBeLessThanOrEqual(p.budgetMinutes + 0.5);
      expect(p.totalMinutes).toBeGreaterThan(0);
      expect(Number.isFinite(p.totalMinutes)).toBe(true);
      expect(p.intenseMinutes).toBeGreaterThanOrEqual(0);
      for (const b of p.blocks) { expect(b.minutes).toBeGreaterThan(0); expect(b.stationId).toBeTruthy(); }
    }
  });
  it('intensityMinutes ≤ techo de la modalidad (nunca explota)', () => {
    for (const s of STYLES) for (const t of TIMES) for (const l of LEVELS) {
      const cap = intensityBudget(s, l);
      // el techo se computa con work-time; toleramos redondeo de ±3 min por bloque
      expect(plan(s, t, l).intenseMinutes).toBeLessThanOrEqual(cap + 6);
    }
  });
  it('MÁS duración NO aumenta linealmente el trabajo intenso (queda ~plano)', () => {
    for (const s of STYLES) for (const l of LEVELS) {
      const i60 = plan(s, 60, l).intenseMinutes;
      const i120 = plan(s, 120, l).intenseMinutes;
      // el intenso a 120 no debe ser mucho mayor que a 60 (a lo sumo +6 min); el steady sí crece
      expect(i120).toBeLessThanOrEqual(i60 + 6);
    }
  });
  it('el trabajo STEADY sí crece con la duración (lowImpact/running/funcional)', () => {
    for (const s of ['lowImpact', 'funcional'] as CardioStyle[]) {
      expect(plan(s, 120, 'intermedio').steadyMinutes).toBeGreaterThan(plan(s, 60, 'intermedio').steadyMinutes);
    }
  });
});

// ── §4/§20 · LOW IMPACT llena la ventana con steady ─────────────────────
describe('CARDIO-MAIN · lowImpact (§4/§20)', () => {
  it('lowImpact 120 usa casi toda la ventana, TODO sostenible (0 intenso)', () => {
    const p = plan('lowImpact', 120, 'intermedio');
    expect(p.intenseMinutes).toBe(0);
    expect(p.totalMinutes).toBeGreaterThanOrEqual(p.budgetMinutes * 0.9);
    expect(p.earlyEnd).toBe(false);
  });
  it('lowImpactMode fuerza estaciones sin alto impacto', () => {
    const p = buildCardioMain({ mainBudgetMinutes: mainBudget(120), style: 'lowImpact', level: 'intermedio', lowImpactMode: true, pool: pool('lowImpact', ['gym'], true) });
    for (const b of p.blocks) { const ex = exercises.find(e => e.id === b.stationId); expect(ex?.impact === 'high').toBeFalsy(); }
  });
});

// ── §6/§19 · EXPLOSIVIDAD tiene techo y termina antes ───────────────────
describe('CARDIO-MAIN · explosividad (§6/§19)', () => {
  it('explosividad 120 NO llena la ventana (early end) y el intenso es mínimo', () => {
    for (const l of LEVELS) {
      const p = plan('explosividad', 120, l);
      expect(p.earlyEnd).toBe(true);
      expect(p.totalMinutes).toBeLessThan(p.budgetMinutes * 0.7); // muy por debajo de 112
      expect(p.intenseMinutes).toBeLessThanOrEqual(5);            // contactos breves, no volumen
    }
  });
  it('el total explosividad NO crece linealmente 60→120 (mismo techo)', () => {
    expect(plan('explosividad', 120, 'avanzado').totalMinutes).toBe(plan('explosividad', 60, 'avanzado').totalMinutes);
  });
});

// ── §5/§21 · RUNNING: easy dominante, intenso acotado, escala por nivel ─
describe('CARDIO-MAIN · running (§5/§21)', () => {
  it('running 120: el steady (easy) domina sobre el intenso', () => {
    for (const l of ['intermedio', 'avanzado']) {
      const p = plan('correr', 120, l);
      expect(p.steadyMinutes).toBeGreaterThan(p.intenseMinutes * 2);
    }
  });
  it('principiante running acotado (no 120 min de carrera)', () => {
    const p = plan('correr', 120, 'principiante');
    expect(p.earlyEnd).toBe(true);
    expect(p.totalMinutes).toBeLessThanOrEqual(65);
  });
  it('intenso escala por nivel: principiante < avanzado', () => {
    expect(plan('correr', 120, 'principiante').intenseMinutes).toBeLessThan(plan('correr', 120, 'avanzado').intenseMinutes);
  });
});

// ── §7/§22 · FUNCIONAL: bloques con recuperación, densidad controlada ───
describe('CARDIO-MAIN · funcional (§7/§22)', () => {
  it('funcional 120 no es 112 min de circuito: intenso acotado, hay recuperación/steady', () => {
    const p = plan('funcional', 120, 'intermedio');
    expect(p.intenseMinutes).toBeLessThan(p.totalMinutes * 0.35);
    expect(p.blocks.some(b => b.kind === 'recovery' || (b.kind === 'steady' && b.intensity !== 'alta'))).toBe(true);
  });
});

// ── §9/§10/§11 · INTENSITY BUDGET (nivel × modalidad × readiness) ───────
describe('CARDIO-MAIN · intensity budget (§9/§10/§11)', () => {
  it('beginner < advanced; LOW ≤ NORMAL; deload = 0', () => {
    expect(intensityBudget('funcional', 'principiante')).toBeLessThan(intensityBudget('funcional', 'avanzado'));
    expect(intensityBudget('correr', 'intermedio', 'low')).toBeLessThanOrEqual(intensityBudget('correr', 'intermedio', 'normal'));
    expect(intensityBudget('funcional', 'avanzado', 'normal', true)).toBe(0);
    expect(intensityBudget('lowImpact', 'avanzado')).toBe(0);
  });
  it('readiness LOW reduce el trabajo intenso de la sesión', () => {
    const norm = plan('funcional', 90, 'intermedio');
    const low = plan('funcional', 90, 'intermedio', { readiness: 'low' });
    expect(low.intenseMinutes).toBeLessThan(norm.intenseMinutes);
  });
  it('deload: cardio suave, 0 intenso', () => {
    expect(plan('funcional', 120, 'intermedio', { isDeload: true }).intenseMinutes).toBe(0);
  });
});

// ── §13 · GEAR: content gap declarado, no estación rota ─────────────────
describe('CARDIO-MAIN · gear (§13)', () => {
  it('pool vacío → plan vacío con earlyEnd explicable (content gap), sin crash', () => {
    const p = buildCardioMain({ mainBudgetMinutes: 100, style: 'correr', level: 'intermedio', pool: [] });
    expect(p.blocks.length).toBe(0);
    expect(p.earlyEnd).toBe(true);
    expect(p.earlyEndReason).toMatch(/content gap|sin estaciones/);
  });
  it('bodyweight lowImpact 120 sigue produciendo sesión sostenible', () => {
    const p = buildCardioMain({ mainBudgetMinutes: mainBudget(120), style: 'lowImpact', level: 'intermedio', pool: pool('lowImpact', ['cuerpo']) });
    expect(p.totalMinutes).toBeGreaterThan(60);
    expect(p.intenseMinutes).toBe(0);
  });
});
