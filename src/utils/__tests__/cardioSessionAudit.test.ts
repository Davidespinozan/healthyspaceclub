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
  style: 'funcional', budgetMinutes: 50, totalMinutes: 43, intenseMinutes: 16, steadyMinutes: 17, earlyEnd: false, endReason: 'AVAILABLE_TIME_FILLED',
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
  // F2C-7 · el label es ESTRUCTURAL (kinds), no una fracción diluida: un bloque intervals/power NUNCA es 'baja'.
  const mk = (intenseMinutes: number, totalMinutes: number, power = false) => ({
    intenseMinutes, totalMinutes,
    blocks: (power ? [{ kind: 'power' } as CardioBlock] : intenseMinutes > 0 ? [{ kind: 'intervals' } as CardioBlock] : []),
  });
  it('sesión sostenida (0 intenso) → baja', () => expect(sessionIntensityLabel(mk(0, 40))).toBe('baja'));
  it('un circuito (intervals, <12 min intenso) → media', () => expect(sessionIntensityLabel(mk(8, 40))).toBe('media'));
  it('carga intensa alta (≥12 min) → alta', () => expect(sessionIntensityLabel(mk(20, 40))).toBe('alta'));
  it('con bloque power → alta aunque poco tiempo', () => expect(sessionIntensityLabel(mk(2, 40, true))).toBe('alta'));
});

// ═══════════════════════════════════════════════════════════════════════════
// F2C-4 · SEMÁNTICA DE ESTACIÓN · regresión del smoke real + station-compatibility matrix.
// ═══════════════════════════════════════════════════════════════════════════
import { cardioStationCapabilities } from '../cardioMain';
import { exercises } from '../../data/exercises';
import { filterByModality } from '../workoutPlanner';

describe('F2C-4 · regresión del SMOKE REAL (plancha/escaladores steady)', () => {
  // Pool funcional CONTAMINADO como en prod: burpee(high) + escaladores(cardio, sin impact) + PLANCHA(core).
  const smokePool = [
    ex({ id: 'burpee', cardioStyle: 'funcional', impact: 'high', fallRisk: true }),
    ex({ id: 'escaladores', cardioStyle: 'funcional' }),                 // impact undefined (como prod)
    ex({ id: 'plancha', muscleGroup: 'core', type: 'activacion' }),      // core, NO cardio
  ];
  const supp = [ex({ id: 'marcha', cardioStyle: 'lowImpact', impact: 'low' }), ex({ id: 'paso', cardioStyle: 'lowImpact', impact: 'low' })];
  const smokeById = new Map<string, Exercise>([...smokePool, ...supp].map(e => [e.id, e]));

  it('OLD/BAD fixture (plancha 14 steady + escaladores 3 steady + burpee 10×40/20) → múltiples critical flags', () => {
    const bad: CardioMainPlan = {
      style: 'funcional', budgetMinutes: 30, totalMinutes: 27, intenseMinutes: 7, steadyMinutes: 17, earlyEnd: false, endReason: 'AVAILABLE_TIME_FILLED',
      blocks: [
        badBlock('intervals', 10, 'burpee', 'alta', 10),
        badBlock('steady', 14, 'plancha', 'baja'),
        badBlock('steady', 3, 'escaladores', 'baja'),
      ],
    };
    const flags = auditCardioSession(bad, smokeById).flags;
    expect(flags).toContain('nonCardioStationInCardio');       // plancha no es cardio
    expect(flags).toContain('unsupportedSteadyStation');       // plancha/escaladores no soportan steady
    expect(flags).toContain('incompatibleStationRole');
    expect(flags).toContain('intervalDoseExceededForStation'); // burpee 10 rondas (demanda alta)
    expect(flags.filter(f => CRITICAL_CARDIO_FLAGS.includes(f)).length).toBeGreaterThanOrEqual(3);
  });
  it('NUEVO motor con el MISMO perfil (pool contaminado + support) → 0 critical flags, sin plancha/escaladores en continuous', () => {
    const p = buildCardioMain({ mainBudgetMinutes: 30, style: 'funcional', level: 'intermedio', bodyGoal: 'Bajar grasa', pool: smokePool, supportPool: supp });
    expect(critical2(p, smokeById)).toEqual([]);
    for (const b of p.blocks) {
      if (b.kind === 'steady' || b.kind === 'recovery') {
        const c = cardioStationCapabilities(smokeById.get(b.stationId)!);
        expect(c.steady || c.recovery).toBe(true);              // continuous SOLO en estación compatible
      }
    }
    // plancha/escaladores NUNCA como steady/recovery
    for (const b of p.blocks.filter(b => b.kind === 'steady' || b.kind === 'recovery')) expect(['plancha', 'escaladores']).not.toContain(b.stationId);
  });
  it('SIN support (bodyweight, sin estación continua) → fail closed: circuito + earlyEnd, NUNCA plancha', () => {
    const p = buildCardioMain({ mainBudgetMinutes: 30, style: 'funcional', level: 'intermedio', bodyGoal: 'Bajar grasa', pool: smokePool, supportPool: [] });
    expect(p.blocks.every(b => !(b.kind === 'steady' || b.kind === 'recovery') || b.intensity === 'alta')).toBe(true);
    expect(critical2(p, smokeById)).toEqual([]);
  });
});
const critical2 = (p: CardioMainPlan, m: Map<string, Exercise>) => auditCardioSession(p, m).flags.filter(f => CRITICAL_CARDIO_FLAGS.includes(f));

describe('F2C-4 · station-compatibility matrix (banco REAL)', () => {
  const cardioModal = filterByModality(exercises, 'cardio');
  it('ningún ejercicio muscleGroup≠cardio adquiere steady/recovery/cooldown (fail closed)', () => {
    for (const e of cardioModal.filter(e => e.muscleGroup !== 'cardio')) {
      const c = cardioStationCapabilities(e);
      expect(c.steady || c.recovery || c.cooldown).toBe(false);   // core/fuerza colados → NUNCA continuous
    }
  });
  it('plancha/core/escaladores/burpee/kettlebell/battle-ropes NUNCA son continuous', () => {
    for (const id of ['plancha-dinamica', 'dead-bug', 'mountain-climbers', 'burpee-sprawl', 'kettlebell-swings', 'battle-ropes', 'carries', 'saltos-basicos']) {
      const e = exercises.find(x => x.id === id); if (!e) continue;
      const c = cardioStationCapabilities(e);
      expect(c.steady).toBe(false); expect(c.recovery).toBe(false); expect(c.cooldown).toBe(false);
    }
  });
  it('marcha/paso-lateral SÍ son continuous con cap finito; máquinas continuous ilimitadas', () => {
    for (const id of ['marcha-en-lugar', 'paso-lateral']) {
      const e = exercises.find(x => x.id === id); if (!e) continue;
      const c = cardioStationCapabilities(e);
      expect(c.steady).toBe(true); expect(c.maxContinuousMinutes).toBeLessThanOrEqual(45);
    }
    const maq = exercises.find(x => x.id === 'cardio-maquina');
    if (maq) expect(cardioStationCapabilities(maq).steady).toBe(true);   // bici/elíptica/cinta → continuous
  });
  it('estaciones de intervalo (funcional/explosividad) SÍ interval; demanda alta = impact high/fallRisk', () => {
    const burpee = exercises.find(x => x.id === 'burpee-sprawl')!;
    expect(cardioStationCapabilities(burpee).interval).toBe(true);
    expect(cardioStationCapabilities(burpee).demand).toBe('high');
  });
});

describe('F2C-4 · generation matrix por EQUIPMENT/support (0 critical flags; earlyEnd válido)', () => {
  const styles: CardioStyle[] = ['funcional', 'correr', 'explosividad', 'lowImpact'];
  const durs = [10, 20, 30, 60, 90, 120];
  const gymSupport = [ex({ id: 'bici', cardioStyle: 'lowImpact', impact: 'low', equipment: ['gym'] }), ex({ id: 'cinta', cardioStyle: 'correr', impact: 'low', equipment: ['gym'] })];
  const bodySupport = [ex({ id: 'marcha', cardioStyle: 'lowImpact', impact: 'low' }), ex({ id: 'paso', cardioStyle: 'lowImpact', impact: 'low' })];
  const scenarios: Array<[string, Exercise[]]> = [
    ['gym (máquinas, cap ∞)', gymSupport],
    ['bodyweight (marcha/paso, cap 45)', bodySupport],
    ['sin support (fail closed)', []],
    ['single support', [bodySupport[0]]],
  ];
  const allById = new Map<string, Exercise>([...funcPool, ...runPool, ...exploPool, ...lowPool, ...gymSupport, ...bodySupport].map(e => [e.id, e]));
  it('style × duration × support scenario → sin flags críticos', () => {
    const offenders: string[] = [];
    for (const [name, support] of scenarios) for (const style of styles) for (const L of ['principiante', 'avanzado']) for (const d of durs) {
      const p = buildCardioMain({ mainBudgetMinutes: d, style, level: L, readiness: 'normal', bodyGoal: 'Bajar grasa', pool: poolFor(style), supportPool: support });
      const f = auditCardioSession(p, allById).flags.filter(x => CRITICAL_CARDIO_FLAGS.includes(x));
      if (f.length) offenders.push(`${name}/${style}/${L}/${d}: ${f.join(',')}`);
    }
    expect(offenders).toEqual([]);
  });
  it('marcha (cap 45) en sesión 120 → fragmenta o earlyEnd; NUNCA un bloque continuo > 45', () => {
    const p = buildCardioMain({ mainBudgetMinutes: 120, style: 'lowImpact', level: 'avanzado', bodyGoal: 'Bajar grasa', pool: bodySupport, supportPool: bodySupport });
    for (const b of p.blocks) if (b.kind === 'steady' || b.kind === 'recovery') expect(b.minutes).toBeLessThanOrEqual(45);
  });
});

describe('F2C-4 · revalida F2C-3 (no romper)', () => {
  it('intense no escala con duración; long crece por steady; 2º circuito solo avanzado; total ≤ budget', () => {
    const i60 = build({ style: 'funcional', d: 60, L: 'avanzado' }).intenseMinutes;
    const i120 = build({ style: 'funcional', d: 120, L: 'avanzado' }).intenseMinutes;
    expect(i120).toBeLessThanOrEqual(i60 + 6);                       // intenso ~estable
    const p120 = build({ style: 'funcional', d: 120, L: 'avanzado' });
    expect(p120.steadyMinutes).toBeGreaterThan(p120.intenseMinutes); // crece por steady
    expect(p120.totalMinutes).toBeLessThanOrEqual(120);
    expect(build({ style: 'funcional', d: 30, L: 'intermedio' }).blocks.filter(b => b.kind === 'intervals').length).toBe(1); // no 2º circuito intermedio
  });
});
