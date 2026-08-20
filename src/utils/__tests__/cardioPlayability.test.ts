import { describe, it, expect } from 'vitest';
import { isPlayableForCardioPhase, isCardioSupportStation, buildCardioSupportPool } from '../cardioPlayability';
import { buildCardioMain, cardioPlayableMinutes } from '../cardioMain';
import { auditCardioSession, CRITICAL_CARDIO_FLAGS } from '../cardioSessionAudit';
import { exercises } from '../../data/exercises';
import { hasPlayableVariant, cardioEquipmentFor } from '../workoutPlanner';
import type { Exercise, Equipment } from '../../types';

// ── Fixtures (variantId en VIDEO_VARIANT_IDS = tiene clip real) ───────────────
function st(over: Partial<Exercise> & { id: string }): Exercise {
  return {
    name: over.id, type: 'cardio', muscleGroup: 'cardio', equipment: ['cuerpo'],
    cardioStyle: 'funcional', impact: 'low', fallRisk: false, variants: [], ...over,
  } as unknown as Exercise;
}
const marcha = st({ id: 'marcha-en-lugar', cardioStyle: 'lowImpact', impact: 'low', equipment: ['cuerpo'],
  variants: [{ id: 'marcha-basico', equipment: ['cuerpo'] }] as never });           // sin clip
const paso = st({ id: 'paso-lateral', cardioStyle: 'lowImpact', impact: 'low', equipment: ['cuerpo', 'ligas'],
  variants: [{ id: 'paso-basico', equipment: ['cuerpo'] }] as never });              // sin clip
const planchaVideo = st({ id: 'plancha', muscleGroup: 'core', cardioStyle: undefined as never, impact: 'low',
  variants: [{ id: 'core-mountain-climbers', equipment: ['cuerpo'] }] as never });   // CON clip pero no-cardio
const mcVideo = st({ id: 'mountain-climbers', cardioStyle: 'funcional', impact: 'low',
  variants: [{ id: 'core-mountain-climbers', equipment: ['cuerpo'] }] as never });   // CON clip, funcional
const burpeeVideo = st({ id: 'burpee', cardioStyle: 'funcional', impact: 'high', fallRisk: true,
  variants: [{ id: 'burpee-con-flexion', equipment: ['cuerpo'] }] as never });       // CON clip, high
const biciGym = st({ id: 'cardio-bici', cardioStyle: 'lowImpact', impact: 'low', equipment: ['gym'],
  variants: [{ id: 'cardio-bici', equipment: ['gym'] }] as never });                 // CON clip, gym
const strengthVideo = st({ id: 'remo', muscleGroup: 'espalda', cardioStyle: undefined as never,
  variants: [{ id: 'remo-t-bar', equipment: ['gym'] }] as never });                  // fuerza CON clip

const BW: Equipment[] = ['cuerpo'];
const GYM: Equipment[] = ['gym', 'cuerpo'];

// ── A/B · marcha/paso videoless → playable en fases continuas ────────────────
describe('A/B · marcha y paso videoless', () => {
  it('marcha playable en steady/recovery/cooldown (bodyweight), sin video', () => {
    expect(hasPlayableVariant(marcha, BW)).toBe(false);
    for (const p of ['steady', 'recovery', 'cooldown'] as const)
      expect(isPlayableForCardioPhase(marcha, BW, p)).toBe(true);
    // pero NO en interval/power/drill (esos exigen video)
    for (const p of ['interval', 'power', 'drill'] as const)
      expect(isPlayableForCardioPhase(marcha, BW, p)).toBe(false);
  });
  it('paso lateral idem', () => {
    expect(isCardioSupportStation(paso, BW)).toBe(true);
  });
});

// ── C · plancha sin/con video → jamás cardio continuo ────────────────────────
describe('C · plancha (no-cardio)', () => {
  it('jamás playable steady/recovery/cooldown, aunque su variante tenga clip', () => {
    for (const p of ['steady', 'recovery', 'cooldown'] as const)
      expect(isPlayableForCardioPhase(planchaVideo, BW, p)).toBe(false);
    expect(isCardioSupportStation(planchaVideo, BW)).toBe(false);
  });
});

// ── D · mountain climbers CON video → jamás continuo ─────────────────────────
describe('D · mountain climbers con video', () => {
  it('interval sí, steady/recovery/cooldown no', () => {
    expect(hasPlayableVariant(mcVideo, BW)).toBe(true);
    expect(isPlayableForCardioPhase(mcVideo, BW, 'interval')).toBe(true);
    for (const p of ['steady', 'recovery', 'cooldown'] as const)
      expect(isPlayableForCardioPhase(mcVideo, BW, p)).toBe(false);
  });
});

// ── E · burpee CON video → interval sí, continuo no ──────────────────────────
describe('E · burpee con video', () => {
  it('interval sí; steady/recovery/cooldown no', () => {
    expect(isPlayableForCardioPhase(burpeeVideo, BW, 'interval')).toBe(true);
    expect(isCardioSupportStation(burpeeVideo, BW)).toBe(false);
  });
});

// ── F/G · bici gym con video ─────────────────────────────────────────────────
describe('F/G · bici gym', () => {
  it('F · continuo sí con equipo gym', () => {
    expect(isPlayableForCardioPhase(biciGym, GYM, 'steady')).toBe(true);
    expect(isCardioSupportStation(biciGym, GYM)).toBe(true);
  });
  it('G · no disponible con equipo bodyweight', () => {
    expect(isPlayableForCardioPhase(biciGym, BW, 'steady')).toBe(false);
    expect(isCardioSupportStation(biciGym, BW)).toBe(false);
  });
});

// ── K · ningún non-cardio entra al support pool ──────────────────────────────
describe('K · non-cardio fuera', () => {
  it('estación de fuerza con video no entra al support pool', () => {
    expect(isCardioSupportStation(strengthVideo, GYM)).toBe(false);
    const pool = buildCardioSupportPool([strengthVideo, biciGym], GYM);
    expect(pool.map(e => e.id)).toEqual(['cardio-bici']);
  });
});

// ── N · gym byte-identical: video manda, marcha NO entra si hay bici ─────────
describe('N · sin regresión gym (preferencia video)', () => {
  it('con bici(video)+marcha(videoless) en gym → support pool solo bici', () => {
    const pool = buildCardioSupportPool([biciGym, marcha, paso], GYM);
    expect(pool.map(e => e.id)).toEqual(['cardio-bici']); // marcha/paso son fallback, no entran
  });
  it('bodyweight sin video → fallback marcha/paso entra', () => {
    const pool = buildCardioSupportPool([burpeeVideo, marcha, paso], BW);
    expect(pool.map(e => e.id).sort()).toEqual(['marcha-en-lugar', 'paso-lateral']);
  });
});

// ── H/I · funcional 60 avanzado bodyweight → no colapsa, no CONTENT_LIMITED ──
describe('H/I · funcional 60 bodyweight AFTER', () => {
  const support = buildCardioSupportPool([burpeeVideo, marcha, paso], BW);
  const plan = buildCardioMain({
    mainBudgetMinutes: 54, style: 'funcional', level: 'avanzado', readiness: 'normal',
    pool: [burpeeVideo], supportPool: support,
  });
  it('H · no colapsa: hay steady y total >> 12', () => {
    expect(plan.steadyMinutes).toBeGreaterThan(0);
    expect(plan.totalMinutes).toBeGreaterThan(20);
    expect(plan.blocks.some(b => b.kind === 'steady' || b.kind === 'recovery')).toBe(true);
  });
  it('I · endReason ya no es CONTENT_LIMITED', () => {
    expect(plan.endReason).not.toBe('CONTENT_LIMITED');
  });
  it('P · duración cronológica del player = suma de bloques = totalMinutes', () => {
    expect(cardioPlayableMinutes(plan)).toBe(plan.totalMinutes);
  });
});

// ── J · sin marcha/paso/videos/máquinas → CONTENT_LIMITED honesto ────────────
describe('J · fail-closed real', () => {
  it('solo burpee, sin estación continua → CONTENT_LIMITED', () => {
    const plan = buildCardioMain({
      mainBudgetMinutes: 54, style: 'funcional', level: 'avanzado', readiness: 'normal',
      pool: [burpeeVideo], supportPool: buildCardioSupportPool([burpeeVideo], BW),
    });
    expect(plan.endReason).toBe('CONTENT_LIMITED');
    expect(plan.steadyMinutes).toBe(0);
  });
});

// ── L · composed Zona 2 bodyweight usa marcha/paso videoless ─────────────────
describe('L · composed Zona 2 bodyweight', () => {
  it('lowImpact intermedio bodyweight construye steady con marcha/paso', () => {
    const support = buildCardioSupportPool([burpeeVideo, marcha, paso], BW);
    const plan = buildCardioMain({
      mainBudgetMinutes: 18, style: 'lowImpact', level: 'intermedio', readiness: 'normal',
      lowImpactMode: true, pool: [burpeeVideo], supportPool: support,
    });
    expect(plan.blocks.length).toBeGreaterThan(0);
    expect(plan.steadyMinutes).toBeGreaterThan(0);
    expect(plan.endReason).not.toBe('CONTENT_LIMITED');
  });
});

// ── 9 · maxContinuousMinutes: 90 min NO es "marcha 84 min" ───────────────────
describe('§9 · fragmentación de continuo (cap 45 marcha/paso)', () => {
  it('funcional 90 bodyweight → ningún bloque continuo supera 45 min', () => {
    const support = buildCardioSupportPool([burpeeVideo, marcha, paso], BW);
    const plan = buildCardioMain({
      mainBudgetMinutes: 84, style: 'funcional', level: 'avanzado', readiness: 'normal',
      pool: [burpeeVideo], supportPool: support,
    });
    for (const b of plan.blocks)
      if (b.kind === 'steady' || b.kind === 'recovery') expect(b.minutes).toBeLessThanOrEqual(45);
  });
});

// ── MATRIX · agregados + outliers (banco REAL) ───────────────────────────────
describe('MATRIX · equipment × style × level × duration (banco real)', () => {
  const STYLES = ['funcional', 'lowImpact', 'correr', 'explosividad'] as const;
  const LEVELS = ['principiante', 'intermedio', 'avanzado'] as const;
  const DUR = [10, 20, 30, 45, 60, 90];
  const cardio = exercises.filter(e => e.type === 'cardio' || e.muscleGroup === 'cardio');
  const byId = new Map(exercises.map(e => [e.id, e]));

  type Row = { eq: string; style: string; level: string; dur: number; total: number;
    endReason: string; earlyEnd: boolean; intense: number; steady: number; maxRounds: number; flags: number };
  const rows: Row[] = [];

  for (const eq of ['bodyweight', 'gym'] as const) {
    const cardioEq = cardioEquipmentFor(eq === 'gym' ? ['gym'] : ['cuerpo']);
    const pool = cardio.filter(e => hasPlayableVariant(e, cardioEq));
    const support = buildCardioSupportPool(exercises, cardioEq);
    for (const style of STYLES) for (const level of LEVELS) for (const dur of DUR) {
      const warm = Math.max(3, Math.min(8, Math.round(dur * 0.1)));
      const plan = buildCardioMain({ mainBudgetMinutes: dur - warm, style, level, readiness: 'normal', pool, supportPool: support });
      const flags = auditCardioSession(plan, byId).flags.filter(f => CRITICAL_CARDIO_FLAGS.includes(f));
      rows.push({ eq, style, level, dur, total: plan.totalMinutes, endReason: plan.endReason, earlyEnd: plan.earlyEnd,
        intense: plan.intenseMinutes, steady: plan.steadyMinutes, maxRounds: plan.blocks.reduce((m, b) => Math.max(m, b.rounds ?? 0), 0),
        flags: flags.length });
    }
  }

  it('imprime agregados + outliers', () => {
    const bw = rows.filter(r => r.eq === 'bodyweight');
    const contentLimited = rows.filter(r => r.endReason === 'CONTENT_LIMITED');
    const withFlags = rows.filter(r => r.flags > 0);
    const bwFuncSteady = bw.filter(r => r.style === 'funcional' && r.dur >= 45 && r.steady > 0).length;
    // eslint-disable-next-line no-console
    console.info('[MATRIX]', JSON.stringify({
      total: rows.length,
      bodyweight_CONTENT_LIMITED: contentLimited.filter(r => r.eq === 'bodyweight').map(r => `${r.style}/${r.level}/${r.dur}`),
      gym_CONTENT_LIMITED: contentLimited.filter(r => r.eq === 'gym').length,
      criticalFlags_rows: withFlags.map(r => `${r.eq}/${r.style}/${r.level}/${r.dur}:${r.flags}`),
      bw_funcional_45plus_with_steady: bwFuncSteady,
      maxRounds_overall: Math.max(...rows.map(r => r.maxRounds)),
      maxSteadyBlock_over45: 'checked-in-§9-test',
    }, null, 0));
    // INVARIANTES:
    // 1. ningún flag crítico en toda la matriz
    expect(withFlags).toHaveLength(0);
    // 2. maxRounds sano (≤14) en toda la matriz
    expect(Math.max(...rows.map(r => r.maxRounds))).toBeLessThanOrEqual(14);
    // 3. bodyweight funcional ≥45 min ya NO colapsa: tiene steady
    expect(bw.filter(r => r.style === 'funcional' && r.dur >= 45).every(r => r.steady > 0)).toBe(true);
    // 4. bodyweight lowImpact ≥30 min → steady presente (marcha/paso)
    expect(bw.filter(r => r.style === 'lowImpact' && r.dur >= 30).every(r => r.steady > 0)).toBe(true);
  });
});
