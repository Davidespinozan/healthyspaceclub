import { describe, it, expect } from 'vitest';
import { buildCardioMain, type CardioMainPlan, type CardioBlock } from '../cardioMain';
import { auditCardioSession, CRITICAL_CARDIO_FLAGS } from '../cardioSessionAudit';
import type { Exercise, CardioStyle } from '../../types';

// ═══════════════════════════════════════════════════════════════════════════
// F2C-3 · CARDIO PRESCRIPTION QUALITY · harness + regresión del caso real + invariantes + matriz.
// ═══════════════════════════════════════════════════════════════════════════
const ex = (o: Partial<Exercise> & { id: string }): Exercise => ({
  name: o.id, desc: '', muscleGroup: 'cardio', type: 'cardio', difficulty: 'intermedio',
  defaultSets: 1, defaultReps: '1 min', defaultRest: 0, steps: [], equipment: ['cuerpo'], goals: [], ...o,
} as Exercise);
// Pools realistas: funcional/explosividad = ALTO impacto (saltos/burpees); lowImpact = sostenible (bici/marcha).
const funcPool = [ex({ id: 'burpee', cardioStyle: 'funcional', impact: 'high', fallRisk: true }), ex({ id: 'mountain', cardioStyle: 'funcional', impact: 'high', fallRisk: true }), ex({ id: 'saltos', cardioStyle: 'funcional', impact: 'high', fallRisk: true })];
const runPool = [ex({ id: 'cinta', cardioStyle: 'correr', impact: 'low' }), ex({ id: 'run-drills', cardioStyle: 'correr', impact: 'low' })];
const exploPool = [ex({ id: 'box-jump', cardioStyle: 'explosividad', impact: 'high', fallRisk: true }), ex({ id: 'skater', cardioStyle: 'explosividad', impact: 'high', fallRisk: true })];
const lowPool = [ex({ id: 'bici', cardioStyle: 'lowImpact', impact: 'low' }), ex({ id: 'eliptica', cardioStyle: 'lowImpact', impact: 'low' }), ex({ id: 'marcha', cardioStyle: 'lowImpact', impact: 'low' })];
const poolFor = (s: CardioStyle) => s === 'funcional' ? funcPool : s === 'correr' ? runPool : s === 'explosividad' ? exploPool : lowPool;
const byId = new Map<string, Exercise>([...funcPool, ...runPool, ...exploPool, ...lowPool].map(e => [e.id, e]));
const build = (o: { style: CardioStyle; d: number; L?: string; bg?: string; readiness?: 'low' | 'normal' | 'high'; isDeload?: boolean; support?: boolean }) =>
  buildCardioMain({ mainBudgetMinutes: o.d, style: o.style, level: o.L ?? 'intermedio', readiness: o.readiness ?? 'normal', bodyGoal: o.bg ?? 'Bajar grasa', isDeload: o.isDeload, pool: poolFor(o.style), supportPool: o.support === false ? [] : lowPool });
const critical = (p: CardioMainPlan) => auditCardioSession(p, byId).flags.filter(f => CRITICAL_CARDIO_FLAGS.includes(f));

// ── El bloque malo de referencia (construido a mano) para probar que el HARNESS lo detecta ──
const badBlock = (kind: CardioBlock['kind'], minutes: number, stationId: string, intensity: CardioBlock['intensity'], rounds?: number): CardioBlock =>
  ({ kind, minutes, stationId, intensity, labelKey: 'x', ...(rounds ? { rounds, workSec: 40, restSec: 20 } : {}) });
const badSession: CardioMainPlan = {
  style: 'funcional', budgetMinutes: 50, totalMinutes: 43, intenseMinutes: 16, steadyMinutes: 17, earlyEnd: false,
  blocks: [
    badBlock('intervals', 12, 'burpee', 'alta', 12),
    badBlock('recovery', 7, 'saltos', 'baja'),
    badBlock('intervals', 12, 'saltos', 'alta', 12),
    badBlock('steady', 11, 'saltos', 'baja'),
  ],
};

describe('harness · detecta el CASO REAL malo por PROPIEDADES (no por nombres)', () => {
  it('la sesión 12×40/20 → recovery saltos → 12×40/20 → steady saltos falla por múltiples razones', () => {
    const flags = auditCardioSession(badSession, byId).flags;
    // interval density excesiva (dos circuitos de 12 = 24 rondas acumuladas)
    expect(flags).toContain('excessiveRounds');
    // recovery/steady sobre estación NO sostenible (saltos = impact high)
    expect(flags).toContain('incompatibleStationRole');
    expect(flags).toContain('unsupportedContinuousStation');
    expect(flags).toContain('unsafeFallback');
    // repetición absurda (saltos en 3 bloques)
    expect(flags).toContain('repeatedStation');
  });
});

describe('regresión · el MISMO perfil que produjo el bug ahora PASA el audit', () => {
  it('J · funcional / intermedio / 50 / perder grasa / bodyweight+support → 0 flags críticos', () => {
    const p = build({ style: 'funcional', d: 50, L: 'intermedio', bg: 'Bajar grasa' });
    expect(critical(p)).toEqual([]);
    // arquitectura: 1 circuito acotado + sostenible dominante
    expect(p.blocks.filter(b => b.kind === 'intervals').length).toBe(1);
    expect(Math.max(0, ...p.blocks.map(b => b.rounds ?? 0))).toBeLessThanOrEqual(8);
    // recovery/steady sobre estación SOSTENIBLE (no saltos)
    for (const b of p.blocks.filter(b => b.kind === 'steady' || b.kind === 'recovery')) {
      expect(byId.get(b.stationId)!.impact).not.toBe('high');
    }
  });
});

describe('matriz · 0 flags críticos en toda la grilla', () => {
  const styles: CardioStyle[] = ['funcional', 'correr', 'explosividad', 'lowImpact'];
  const levels = ['principiante', 'intermedio', 'avanzado'];
  const durs = [10, 15, 20, 30, 40, 50, 60, 75, 90, 120];
  const goals = ['Bajar grasa', 'Ganar músculo', 'Bienestar integral'];
  it('style × level × duration × goal → sin flags críticos (con support pool)', () => {
    const offenders: string[] = [];
    for (const style of styles) for (const L of levels) for (const d of durs) for (const bg of goals) {
      const flags = critical(build({ style, d, L, bg }));
      if (flags.length) offenders.push(`${bg}/${style}/${L}/${d}: ${flags.join(',')}`);
    }
    expect(offenders).toEqual([]);
  });
  it('contextos readiness baja / deload → sin flags críticos y sin trabajo intenso indebido', () => {
    for (const style of styles) for (const d of [30, 60, 90]) {
      expect(critical(build({ style, d, readiness: 'low' }))).toEqual([]);
      const dl = build({ style, d, isDeload: true });
      expect(critical(dl)).toEqual([]);
      expect(dl.intenseMinutes).toBe(0);   // deload: 0 intenso
    }
  });
});

describe('invariantes de calidad', () => {
  it('1 · totalMinutes ≤ budget', () => { for (const d of [10, 50, 120]) expect(build({ style: 'funcional', d }).totalMinutes).toBeLessThanOrEqual(d); });
  it('2-4 · steady/recovery/cooldown NUNCA sobre estación de alto impacto (sin fallback inseguro)', () => {
    for (const style of ['funcional', 'explosividad'] as CardioStyle[]) for (const d of [30, 60, 120]) {
      for (const b of build({ style, d }).blocks) {
        if ((b.kind === 'steady' || b.kind === 'recovery') && b.intensity !== 'alta') {
          expect(byId.get(b.stationId)!.impact).not.toBe('high');
        }
      }
    }
  });
  it('5 · rondas acotadas por nivel (nunca 12+12 en funcional)', () => {
    for (const L of ['principiante', 'intermedio', 'avanzado']) {
      const p = build({ style: 'funcional', d: 60, L });
      expect(Math.max(0, ...p.blocks.map(b => b.rounds ?? 0))).toBeLessThanOrEqual(10);
    }
  });
  it('6 · sesión larga NO escala HIIT: 120 tiene ≤ intenso que su fracción cap; steady domina', () => {
    const p = build({ style: 'funcional', d: 120, L: 'avanzado' });
    expect(p.intenseMinutes).toBeLessThan(p.totalMinutes * 0.4);
    expect(p.steadyMinutes).toBeGreaterThan(p.intenseMinutes);
  });
  it('7 · sin repetición absurda: ninguna estación en ≥3 bloques', () => {
    for (const style of ['funcional', 'correr'] as CardioStyle[]) for (const d of [40, 60, 90]) {
      const c = new Map<string, number>();
      for (const b of build({ style, d }).blocks) c.set(b.stationId, (c.get(b.stationId) ?? 0) + 1);
      for (const [, n] of c) expect(n).toBeLessThan(3);
    }
  });
  it('15-16 · sin estación sostenible → NO rellena con saltos: acorta/earlyEnd (funcional bodyweight sin support)', () => {
    const p = buildCardioMain({ mainBudgetMinutes: 50, style: 'funcional', level: 'intermedio', bodyGoal: 'Bajar grasa', pool: funcPool, supportPool: [] });
    // sin support ni estación funcional sostenible → solo circuito (o vacío), NUNCA steady/recovery de saltos
    for (const b of p.blocks) {
      if ((b.kind === 'steady' || b.kind === 'recovery') && b.intensity !== 'alta') expect(byId.get(b.stationId)!.impact).not.toBe('high');
    }
    expect(critical(p)).toEqual([]);
  });
});

describe('composed (zona2) sigue siendo lowImpact/sostenible (hard ceiling intacto)', () => {
  it('style lowImpact + intermedio (lo que sella el ceiling zona2) → 0 intenso, todo sostenible', () => {
    const p = buildCardioMain({ mainBudgetMinutes: 20, style: 'lowImpact', level: 'intermedio', bodyGoal: 'Ganar músculo', pool: lowPool, supportPool: lowPool });
    expect(p.intenseMinutes).toBe(0);
    expect(p.blocks.every(b => b.intensity !== 'alta')).toBe(true);
    expect(critical(p)).toEqual([]);
  });
});

import { sessionIntensityLabel } from '../cardioMain';
describe('sessionIntensityLabel · derivada de la carga real', () => {
  const mk = (intenseMinutes: number, totalMinutes: number, power = false) => ({ intenseMinutes, totalMinutes, blocks: (power ? [{ kind: 'power' } as CardioBlock] : []) });
  it('sesión sostenida (0 intenso) → baja', () => expect(sessionIntensityLabel(mk(0, 40))).toBe('baja'));
  it('fracción media → media', () => expect(sessionIntensityLabel(mk(8, 40))).toBe('media'));   // 20%
  it('fracción alta → alta', () => expect(sessionIntensityLabel(mk(20, 40))).toBe('alta'));      // 50%
  it('con bloque power → alta aunque poco tiempo', () => expect(sessionIntensityLabel(mk(2, 40, true))).toBe('alta'));
});
