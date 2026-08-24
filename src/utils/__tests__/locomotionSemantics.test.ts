import { describe, it, expect } from 'vitest';
import { buildCardioMain } from '../cardioMain';
import { resolveMovementCapabilities } from '../movementCapabilities';
import { exercises } from '../../data/exercises';
import type { Exercise } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// F2C-9D.1 · LOCOMOTION SEMANTICS / GAIT-ONLY RUNNING.
// El estilo UX `correr` SELECCIONA el template; la CAPABILITY 'locomotion' (autoridad = movementCapabilities,
// 9B) decide qué estación puede cumplir su trabajo CONTINUO. Una bici/elíptica/remo son cardio continuo
// válido (lowImpact) pero NO locomoción → jamás rellenan un rodaje pedido como correr. Cambio SUBTRACTIVO:
// solo restringe el continuo de `correr`; lowImpact/funcional/explosividad quedan idénticos.
// ─────────────────────────────────────────────────────────────────────────────

// Fixtures mínimos de estación (mismos campos que leen las capabilities).
function station(over: Partial<Exercise> & { id: string }): Exercise {
  return {
    name: over.id, type: 'cardio', muscleGroup: 'cardio', equipment: ['cuerpo'],
    cardioStyle: 'funcional', impact: 'low', fallRisk: false, variants: [],
    ...over,
  } as unknown as Exercise;
}
const treadmill = station({ id: 'treadmill', cardioStyle: 'correr', impact: 'low', equipment: ['gym'] });
const bike = station({ id: 'bike', cardioStyle: 'lowImpact', impact: 'low', equipment: ['gym'] });
const elliptical = station({ id: 'elliptical', cardioStyle: 'lowImpact', impact: 'low', equipment: ['gym'] });
const rower = station({ id: 'rower', cardioStyle: 'lowImpact', impact: 'low', equipment: ['gym'] });
const drills = station({ id: 'drills', cardioStyle: 'correr', impact: 'high', fallRisk: true });      // high-knees-like
const jacks = station({ id: 'jacks', cardioStyle: 'funcional', impact: 'high', fallRisk: true });     // jumping-jacks-like

const isLoco = (ex: Exercise, variant?: Parameters<typeof resolveMovementCapabilities>[1]) => {
  const mc = resolveMovementCapabilities(ex, variant);
  return mc.roles.includes('locomotion') && mc.workModes.includes('continuous');
};
const CONT = new Set(['steady', 'recovery', 'cooldown']);
const continuousBlocks = (blocks: { kind: string; stationId: string }[]) => blocks.filter(b => CONT.has(b.kind));

// ── CAPABILITY LEVEL (autoridad = resolveMovementCapabilities) ───────────────
describe('9D.1 · capability de locomotion (gait) por estación', () => {
  it('A · treadmill: locomotion=true, continuous=true', () => {
    const mc = resolveMovementCapabilities(treadmill);
    expect(mc.roles).toContain('locomotion');
    expect(mc.workModes).toContain('continuous');
  });
  it('B · bike: continuous=true, locomotion=false', () => {
    const mc = resolveMovementCapabilities(bike);
    expect(mc.workModes).toContain('continuous');
    expect(mc.roles).not.toContain('locomotion');
  });
  it('C · elliptical: locomotion=false', () => { expect(isLoco(elliptical)).toBe(false); });
  it('D · rower: locomotion=false', () => { expect(isLoco(rower)).toBe(false); });
  it('E · marcha-en-lugar (banco real): locomotion=true (fallback gait válido)', () => {
    const marcha = exercises.find(e => e.id === 'marcha-en-lugar')!;
    expect(marcha).toBeTruthy();
    expect(isLoco(marcha)).toBe(true);
  });
  it('F · paso-lateral (banco real): locomotion=false tras el override de metadata', () => {
    const paso = exercises.find(e => e.id === 'paso-lateral')!;
    expect(paso).toBeTruthy();
    const mc = resolveMovementCapabilities(paso);
    expect(mc.roles).not.toContain('locomotion');
    expect(mc.workModes).toContain('continuous');   // sigue siendo cardio continuo válido para lowImpact
  });
  it('G · running-drills/high-knees (banco real): locomotion=false, continuous=false (drill/interval sí)', () => {
    const rd = exercises.find(e => e.id === 'running-drills')!;
    const mc = resolveMovementCapabilities(rd);
    expect(mc.roles).not.toContain('locomotion');
    expect(mc.workModes).not.toContain('continuous');
  });
  it('H · jumping-jacks (banco real): jamás locomotion', () => {
    const jj = exercises.find(e => e.id === 'saltos-basicos')!;
    expect(resolveMovementCapabilities(jj).roles).not.toContain('locomotion');
  });
  it('I · un movimiento de conditioning nunca es locomotion', () => {
    expect(isLoco(jacks)).toBe(false);
  });
  it('P · video NO otorga ni retira locomotion (fixtures sin video ya la derivan)', () => {
    expect(isLoco(treadmill)).toBe(true);   // sin ningún video registrado
    expect(isLoco(bike)).toBe(false);
  });
});

// ── ENGINE LEVEL (buildCardioMain) ───────────────────────────────────────────
describe('9D.1 · correr = gait-only en el trabajo continuo', () => {
  it('J · correr + treadmill: el continuo usa treadmill (locomoción)', () => {
    const plan = buildCardioMain({ mainBudgetMinutes: 40, style: 'correr', level: 'intermedio', pool: [treadmill], supportPool: [treadmill] });
    const cont = continuousBlocks(plan.blocks);
    expect(cont.length).toBeGreaterThan(0);
    expect(cont.every(b => b.stationId === 'treadmill')).toBe(true);
    expect(plan.endReason).not.toBe('CONTENT_LIMITED');
  });
  it('K · correr + treadmill + bike: el rodaje NO rota a la bici', () => {
    const plan = buildCardioMain({ mainBudgetMinutes: 60, style: 'correr', level: 'intermedio', pool: [treadmill], supportPool: [treadmill, bike] });
    expect(continuousBlocks(plan.blocks).some(b => b.stationId === 'bike')).toBe(false);
  });
  it('L · correr + solo bici: la bici NO satisface el rodaje de correr → sin continuo, CONTENT_LIMITED', () => {
    const plan = buildCardioMain({ mainBudgetMinutes: 45, style: 'correr', level: 'intermedio', pool: [bike], supportPool: [bike] });
    expect(continuousBlocks(plan.blocks).some(b => b.stationId === 'bike')).toBe(false);
    expect(plan.endReason).toBe('CONTENT_LIMITED');
  });
  it('M · correr + solo drills (high-impact): puede haber drills/intervals, pero el continuo queda vacío → CONTENT_LIMITED', () => {
    const plan = buildCardioMain({ mainBudgetMinutes: 45, style: 'correr', level: 'avanzado', pool: [drills], supportPool: [] });
    expect(continuousBlocks(plan.blocks).length).toBe(0);   // nada continuo
    expect(plan.earlyEnd).toBe(true);
    expect(plan.endReason).toBe('CONTENT_LIMITED');
  });
});

describe('9D.1 · lowImpact NO se restringe (equivalencia; degradación de seguridad segura)', () => {
  it('N · style lowImpact + bici: la bici SIGUE siendo estación continua válida', () => {
    const plan = buildCardioMain({ mainBudgetMinutes: 30, style: 'lowImpact', level: 'intermedio', pool: [bike], supportPool: [bike] });
    const cont = continuousBlocks(plan.blocks);
    expect(cont.length).toBeGreaterThan(0);
    expect(cont.some(b => b.stationId === 'bike')).toBe(true);
    expect(plan.endReason).not.toBe('CONTENT_LIMITED');
  });
  it('O · correr degradado upstream a lowImpact (style efectivo=lowImpact) + bici: válido (no es fallback escondido)', () => {
    // La degradación de seguridad ocurre ARRIBA (ceilingSafeCardioStyle/dailyCardioPlacement): buildCardioMain
    // recibe style='lowImpact' y la bici es continua válida — distinto de ejecutar correr puro.
    const plan = buildCardioMain({ mainBudgetMinutes: 45, style: 'lowImpact', level: 'intermedio', pool: [bike], supportPool: [bike] });
    expect(continuousBlocks(plan.blocks).some(b => b.stationId === 'bike')).toBe(true);
  });
  it('funcional + bici (soporte) sigue construyendo continuo (equivalencia intacta)', () => {
    const burpee = station({ id: 'burpee', cardioStyle: 'funcional', impact: 'high', fallRisk: true });
    const plan = buildCardioMain({ mainBudgetMinutes: 40, style: 'funcional', level: 'intermedio', pool: [burpee], supportPool: [bike] });
    expect(plan.endReason).not.toBe('CONTENT_LIMITED');
    expect(continuousBlocks(plan.blocks).length).toBeGreaterThan(0);
  });
});

describe('9D.1 · invariantes', () => {
  it('Q · selectedTime sigue siendo CAP (totalMinutes ≤ budget)', () => {
    const plan = buildCardioMain({ mainBudgetMinutes: 40, style: 'correr', level: 'intermedio', pool: [treadmill], supportPool: [treadmill] });
    expect(plan.totalMinutes).toBeLessThanOrEqual(40);
  });
  it('R · sin filler: correr solo-bici no fabrica bloques (0 bloques, no loops)', () => {
    const plan = buildCardioMain({ mainBudgetMinutes: 45, style: 'correr', level: 'intermedio', pool: [bike], supportPool: [bike] });
    expect(plan.blocks.length).toBe(0);
  });
});
