import { describe, it, expect } from 'vitest';
import { buildCardioMain, sessionIntensityLabel, cardioPlayableMinutes, type CardioMainPlan, type CardioBlock } from '../cardioMain';
import { auditCardioQuality, auditCardioSession, CRITICAL_CARDIO_FLAGS } from '../cardioSessionAudit';
import { buildCardioSupportPool } from '../cardioPlayability';
import { exercises } from '../../data/exercises';
import { hasPlayableVariant, cardioEquipmentFor } from '../workoutPlanner';
import type { Exercise } from '../../types';

const cardio = exercises.filter(e => e.type === 'cardio' || e.muscleGroup === 'cardio');
const byId = new Map(exercises.map(e => [e.id, e]));
const bwPool = (style?: unknown) => { void style; return cardio.filter(e => hasPlayableVariant(e, cardioEquipmentFor(['cuerpo']))); };
const bwSupport = () => buildCardioSupportPool(exercises, cardioEquipmentFor(['cuerpo']));
const critical = (p: CardioMainPlan) => auditCardioSession(p, byId).flags.filter(f => CRITICAL_CARDIO_FLAGS.includes(f));

// ── AFTER del smoke real: funcional 60 avanzado bodyweight ───────────────────
describe('F2C-7 · AFTER del smoke (funcional 60 avanzado bodyweight)', () => {
  const p = buildCardioMain({ mainBudgetMinutes: 54, style: 'funcional', level: 'avanzado', readiness: 'normal', pool: bwPool(), supportPool: bwSupport() });
  const label = sessionIntensityLabel(p);
  it('es una sesión PROGRAMADA, no minute-filler', () => {
    // circuitos primarios (estímulo material)
    expect(p.blocks.filter(b => b.kind === 'intervals').length).toBeGreaterThanOrEqual(1);
    // soporte aeróbico ROTADO (no un bloque residual gigante) + cooldown explícito
    expect(p.blocks.some(b => b.kind === 'cooldown')).toBe(true);
    for (const b of p.blocks) expect(b.minutes).toBeLessThanOrEqual(35);
    // el steady NO domina la sesión de acondicionamiento
    const steadyFrac = p.steadyMinutes / p.totalMinutes;
    expect(steadyFrac).toBeLessThan(0.75);
  });
  it('label representativo (no "baja" con 2 circuitos) y razón honesta', () => {
    expect(label).not.toBe('baja');
    expect(p.endReason).not.toBe('CONTENT_LIMITED');   // hay contenido continuo (marcha/paso)
  });
  it('0 flags críticos y 0 quality warnings', () => {
    expect(critical(p)).toEqual([]);
    expect(auditCardioQuality(p, label).flags).toEqual([]);
  });
  it('displayed (player) = suma de bloques', () => {
    expect(cardioPlayableMinutes(p)).toBe(p.totalMinutes);
  });
});

// ── Propiedad: cualquier sesión con intervals/power NO es 'baja' ─────────────
describe('F2C-7 · intensity label semántico', () => {
  it('ninguna sesión con trabajo intenso se etiqueta baja', () => {
    for (const style of ['funcional', 'correr'] as const) for (const level of ['principiante', 'intermedio', 'avanzado'] as const) for (const d of [30, 45, 60]) {
      const p = buildCardioMain({ mainBudgetMinutes: d, style, level, readiness: 'normal', pool: bwPool(), supportPool: bwSupport() });
      if (p.blocks.some(b => b.kind === 'intervals' || b.kind === 'power')) {
        expect(sessionIntensityLabel(p)).not.toBe('baja');
      }
    }
  });
});

// ── COOLDOWN es una fase real (kind propio) ──────────────────────────────────
describe('F2C-7 · cooldown como fase explícita', () => {
  it('sesión con trabajo intenso ≥20min incluye un bloque kind=cooldown', () => {
    const p = buildCardioMain({ mainBudgetMinutes: 54, style: 'funcional', level: 'avanzado', readiness: 'normal', pool: bwPool(), supportPool: bwSupport() });
    expect(p.blocks.some(b => b.kind === 'cooldown')).toBe(true);
    // el cooldown es continuo de baja intensidad
    const cd = p.blocks.find(b => b.kind === 'cooldown')!;
    expect(cd.intensity).toBe('baja');
  });
});

// ── COMPOSED Zona 2 20 bodyweight (§18) · respeta el intent sellado ──────────
describe('F2C-7 · composed Zona 2 20 bodyweight (spec sellado)', () => {
  // Reproduce el path composed: budget = spec.minutes, lowImpact, nivel acotado, lowImpactMode.
  const p = buildCardioMain({ mainBudgetMinutes: 20, style: 'lowImpact', level: 'intermedio', readiness: 'normal', lowImpactMode: true, pool: bwPool(), supportPool: bwSupport() });
  it('nunca excede spec.minutes (20) en el main', () => {
    expect(p.totalMinutes).toBeLessThanOrEqual(20);
  });
  it('sigue siendo Zona 2 sostenible: sin HIIT introducido', () => {
    expect(p.blocks.some(b => b.kind === 'intervals' || b.kind === 'power')).toBe(false);
    expect(p.intenseMinutes).toBe(0);
    expect(p.blocks.some(b => b.kind === 'steady' || b.kind === 'cooldown')).toBe(true);
    expect(p.style).toBe('lowImpact');
  });
});

// ── QUALITY AUDITOR · flags por propiedades ──────────────────────────────────
describe('F2C-7 · auditCardioQuality (por propiedades, no IDs)', () => {
  const blk = (kind: CardioBlock['kind'], minutes: number, stationId = 's', intensity: CardioBlock['intensity'] = 'baja', rounds?: number): CardioBlock =>
    ({ kind, minutes, stationId, intensity, labelKey: 'x', ...(rounds ? { rounds, workSec: 40, restSec: 20 } : {}) });
  const plan = (blocks: CardioBlock[], style: CardioMainPlan['style'] = 'funcional'): CardioMainPlan => ({
    style, budgetMinutes: 60, totalMinutes: blocks.reduce((a, b) => a + b.minutes, 0),
    intenseMinutes: blocks.filter(b => b.kind === 'intervals' || b.kind === 'power').reduce((a, b) => a + Math.round((b.rounds ?? 0) * (b.workSec ?? 0) / 60), 0),
    steadyMinutes: blocks.filter(b => b.kind === 'steady' || b.kind === 'recovery' || b.kind === 'cooldown').reduce((a, b) => a + b.minutes, 0),
    earlyEnd: false, endReason: 'AVAILABLE_TIME_FILLED', blocks,
  });

  it('residualSteadyDominatesSession: circuito + steady gigante (funcional, intenso ≥5)', () => {
    const p = plan([blk('intervals', 8, 'burpee', 'alta', 8), blk('steady', 40, 'marcha')]);  // intenso=round(8*40/60)=5
    expect(auditCardioQuality(p, 'media').flags).toContain('residualSteadyDominatesSession');
  });
  it('excessiveSingleStationDuration: bloque continuo funcional > 30', () => {
    const p = plan([blk('steady', 38, 'marcha')]);
    expect(auditCardioQuality(p, 'baja').flags).toContain('excessiveSingleStationDuration');
  });
  it('lowImpact tolera tramos más largos (≤40 no dispara excessiveSingleStationDuration)', () => {
    const p = plan([blk('steady', 38, 'bici')], 'lowImpact');
    expect(auditCardioQuality(p, 'baja').flags).not.toContain('excessiveSingleStationDuration');
  });
  it('redundantContinuousBlocks: 2 continuos adyacentes de la MISMA estación', () => {
    const p = plan([blk('steady', 20, 'bici'), blk('steady', 20, 'bici')], 'lowImpact');
    expect(auditCardioQuality(p, 'baja').flags).toContain('redundantContinuousBlocks');
  });
  it('missingCooldownSemantics: intenso ≥20min sin cooldown', () => {
    const p = plan([blk('intervals', 8, 'burpee', 'alta', 8), blk('steady', 15, 'marcha')]);
    expect(auditCardioQuality(p, 'media').flags).toContain('missingCooldownSemantics');
  });
  it('intensityLabelMismatch: label baja con intervalos', () => {
    const p = plan([blk('intervals', 6, 'burpee', 'alta', 6), blk('steady', 10, 'marcha'), blk('cooldown', 4, 'paso')]);
    expect(auditCardioQuality(p, 'baja').flags).toContain('intensityLabelMismatch');
  });
  it('una sesión bien programada → 0 quality flags', () => {
    const p = plan([blk('intervals', 6, 'burpee', 'alta', 6), blk('recovery', 2, 'marcha'), blk('intervals', 6, 'boxer', 'alta', 6), blk('steady', 12, 'marcha'), blk('steady', 11, 'paso'), blk('cooldown', 4, 'marcha')]);
    expect(auditCardioQuality(p, 'media').flags).toEqual([]);
  });
});

// ── MICRO-AJUSTE COOLDOWN (F2C-7) · reutiliza la última estación continua si la variedad se agotó ──
describe('F2C-7 · cooldown fallback (pool continuo de 1 estación)', () => {
  // Estación única continuous (simula gym cardio-maquina: 1 estación lógica).
  const single = ({ id: 'machine', name: 'Máquina', type: 'cardio', muscleGroup: 'cardio', cardioStyle: 'lowImpact',
    impact: 'low', fallRisk: false, equipment: ['gym'], variants: [] } as unknown as Exercise);
  const burpeeOnly = ({ id: 'burpee', name: 'Burpee', type: 'cardio', muscleGroup: 'cardio', cardioStyle: 'funcional',
    impact: 'high', fallRisk: true, equipment: ['cuerpo'], variants: [] } as unknown as Exercise);

  it('A/B · gym single-station: recovery+steady+cooldown se construyen reutilizando la máquina; sin missingCooldown', () => {
    const p = buildCardioMain({ mainBudgetMinutes: 54, style: 'funcional', level: 'avanzado', readiness: 'normal', pool: [burpeeOnly], supportPool: [single] });
    const cds = p.blocks.filter(b => b.kind === 'cooldown');
    expect(cds.length).toBe(1);                                   // cooldown SÍ existe (reutiliza la máquina)
    expect(cds[0].stationId).toBe('machine');
    expect(auditCardioQuality(p, sessionIntensityLabel(p)).flags).not.toContain('missingCooldownSemantics');
    expect(critical(p)).toEqual([]);
  });
  it('D · cooldown reutilizado respeta programming cap y safety', () => {
    const p = buildCardioMain({ mainBudgetMinutes: 54, style: 'funcional', level: 'avanzado', readiness: 'normal', pool: [burpeeOnly], supportPool: [single] });
    const cd = p.blocks.find(b => b.kind === 'cooldown')!;
    expect(cd.minutes).toBeLessThanOrEqual(12);                  // ≤ progCap funcional (12) ∧ ≤ safety
  });
  it('E/F · estación SIN capability.cooldown (burpee) jamás se reutiliza para cooldown', () => {
    // solo burpee (no continua): no hay cooldown posible → se omite (fail closed), nunca burpee de cooldown.
    const p = buildCardioMain({ mainBudgetMinutes: 54, style: 'funcional', level: 'avanzado', readiness: 'normal', pool: [burpeeOnly], supportPool: [] });
    expect(p.blocks.some(b => b.kind === 'cooldown')).toBe(false);
    for (const b of p.blocks) if (b.kind === 'cooldown') expect(b.stationId).not.toBe('burpee');
    expect(critical(p)).toEqual([]);
  });
  it('C · bodyweight (marcha+paso) sigue ROTANDO; el fallback no destruye variedad', () => {
    const p = buildCardioMain({ mainBudgetMinutes: 54, style: 'funcional', level: 'avanzado', readiness: 'normal', pool: bwPool(), supportPool: bwSupport() });
    const cont = p.blocks.filter(b => b.kind === 'steady' || b.kind === 'recovery' || b.kind === 'cooldown');
    expect(new Set(cont.map(b => b.stationId)).size).toBeGreaterThanOrEqual(2);   // rota entre estaciones
    expect(auditCardioQuality(p, sessionIntensityLabel(p)).flags).toEqual([]);
  });
});

// ── Ningún non-cardio en cardio main/support (F2C-4 intacto) ────────────────
describe('F2C-7 · F2C-4 preservado', () => {
  it('todos los bloques continuos usan estación cardio no-high-impact', () => {
    for (const style of ['funcional', 'lowImpact', 'correr'] as const) for (const d of [30, 60, 90]) {
      const p = buildCardioMain({ mainBudgetMinutes: d, style, level: 'avanzado', readiness: 'normal', pool: bwPool(), supportPool: bwSupport() });
      for (const b of p.blocks) {
        if (b.kind === 'steady' || b.kind === 'recovery' || b.kind === 'cooldown') {
          const ex = byId.get(b.stationId) as Exercise | undefined;
          expect(ex?.muscleGroup).toBe('cardio');
          expect(ex?.impact).not.toBe('high');
        }
      }
    }
  });
});
