import { describe, it, expect } from 'vitest';
import { composeSession, ceilingSafeCardioStyle, ceilingSafeCardioLevel, type ComposeSessionInput } from '../sessionComposer';
import { buildCardioMain } from '../cardioMain';
import { dayKey } from '../localDate';
import type { CardioStyle, CompletedSession, Exercise } from '../../types';

// ═══════════════════════════════════════════════════════════════════════════
// F2B-1 · intensityCeiling = HARD CEILING. zona2 ⇒ el cardio CONSTRUIDO no puede contener Z3/Z4/Z5,
// intervalos/tempo agresivos ni explosividad — no basta con el label. Se adapta INPUT del motor
// (fix a: style; fix b: level) sin tocar cardioMain. moderate NO degrada (control positivo).
// ═══════════════════════════════════════════════════════════════════════════

// Pool sintético fiel a los predicados del motor (matchesStyle por cardioStyle; lowImpact = impact≠high).
const pool = [
  { id: 'bici', name: 'Bici', cardioStyle: 'lowImpact', impact: 'low', type: 'cardio', muscleGroup: 'cardio' },
  { id: 'eliptica', name: 'Elíptica', cardioStyle: 'lowImpact', impact: 'low', type: 'cardio', muscleGroup: 'cardio' },
  { id: 'cinta', name: 'Cinta', cardioStyle: 'correr', impact: 'medium', type: 'cardio', muscleGroup: 'cardio' },
  { id: 'kb', name: 'KB swing', cardioStyle: 'funcional', impact: 'medium', type: 'cardio', muscleGroup: 'cardio' },
  { id: 'box', name: 'Box jump', cardioStyle: 'explosividad', impact: 'high', type: 'cardio', muscleGroup: 'cardio' },
] as unknown as Exercise[];

// Construye el cardio EXACTAMENTE como buildComposedCardio bajo el ceiling (fix a ya selló style; fix b acota level).
const buildUnderCeiling = (originalStyle: CardioStyle, ceiling: 'zona2' | 'moderate', level: string, minutes: number) =>
  buildCardioMain({
    mainBudgetMinutes: minutes,
    style: ceilingSafeCardioStyle(ceiling, originalStyle),
    level: ceilingSafeCardioLevel(ceiling, level),
    readiness: 'normal', bodyGoal: 'Bienestar', lowImpactMode: ceiling === 'zona2', isDeload: false, pool,
  });
const AGGRESSIVE = new Set(['intervals', 'power']);

describe('helpers de ceiling (fix a / fix b)', () => {
  it('a · zona2 degrada correr/funcional/explosividad → lowImpact; lowImpact intacto', () => {
    for (const s of ['correr', 'funcional', 'explosividad'] as CardioStyle[])
      expect(ceilingSafeCardioStyle('zona2', s)).toBe('lowImpact');
    expect(ceilingSafeCardioStyle('zona2', 'lowImpact')).toBe('lowImpact');
  });
  it('a · moderate NO degrada (control positivo)', () => {
    for (const s of ['correr', 'funcional', 'explosividad', 'lowImpact'] as CardioStyle[])
      expect(ceilingSafeCardioStyle('moderate', s)).toBe(s);
  });
  it('b · zona2 acota avanzado→intermedio; otros intactos; moderate intacto', () => {
    expect(ceilingSafeCardioLevel('zona2', 'avanzado')).toBe('intermedio');
    expect(ceilingSafeCardioLevel('zona2', 'intermedio')).toBe('intermedio');
    expect(ceilingSafeCardioLevel('zona2', 'principiante')).toBe('principiante');
    expect(ceilingSafeCardioLevel('moderate', 'avanzado')).toBe('avanzado');
  });
});

describe('CONTENIDO CONSTRUIDO bajo zona2 (avanzado) — todos los styles', () => {
  const styles: CardioStyle[] = ['correr', 'funcional', 'explosividad', 'lowImpact'];
  for (const style of styles) {
    for (const minutes of [20, 60]) {
      it(`${style} · ${minutes}min · avanzado · zona2 → solo Zona 2, sin agresividad`, () => {
        const plan = buildUnderCeiling(style, 'zona2', 'avanzado', minutes);
        expect(plan.blocks.length).toBeGreaterThan(0);
        for (const b of plan.blocks) {
          expect(b.intensity).toBe('baja');            // nunca media (Z3) ni alta (Z4-5)
          expect(b.zone === undefined || b.zone === 'Zona 2').toBe(true);
          expect(AGGRESSIVE.has(b.kind)).toBe(false);  // sin intervals/power (tempo/potencia agresivos)
          expect(b.workSec).toBeUndefined();           // sin work/rest de intervalo
        }
        expect(plan.totalMinutes).toBeLessThanOrEqual(minutes); // duración ≤ spec.minutes
      });
    }
  }
});

describe('CONTROL POSITIVO · moderate NO se degrada a lowImpact', () => {
  it('correr · avanzado · moderate → conserva contenido de mayor intensidad (no colapsa a Z2)', () => {
    const plan = buildUnderCeiling('correr', 'moderate', 'avanzado', 40);
    // El style permitido se conserva; el contenido de correr incluye trabajo por encima de Z2 (drills/tempo/intervals).
    const hasHigherIntensity = plan.blocks.some(b => b.intensity !== 'baja' || AGGRESSIVE.has(b.kind) || b.kind === 'drills');
    expect(hasHigherIntensity).toBe(true);
    expect(ceilingSafeCardioStyle('moderate', 'correr')).toBe('correr');
  });
});

describe('determinismo de los clamps + build', () => {
  it('mismo (style, ceiling, level, minutes) → bloques idénticos (resume estable)', () => {
    const a = buildUnderCeiling('correr', 'zona2', 'avanzado', 30);
    const b = buildUnderCeiling('correr', 'zona2', 'avanzado', 30);
    expect(a.blocks).toEqual(b.blocks);
    expect(a.blocks.map(x => x.stationId).join(',')).toBe(b.blocks.map(x => x.stationId).join(','));
  });
});

describe('composeSession SELLA style seguro bajo zona2 (fix a end-to-end)', () => {
  const NOW = Date.UTC(2026, 7, 19, 12, 0, 0);
  const cs = (n: number, m: number, i: number): CompletedSession => ({
    sessionId: `c${n}${i}`, modality: 'cardio', date: dayKey(new Date(NOW - n * 86400000)),
    durationSeconds: m * 60, completedAtIso: new Date(NOW - n * 86400000).toISOString(), exerciseIds: [],
  } as unknown as CompletedSession);
  // Base (sessions14d≥3, minutes14d≥60) pero <target en 7d → remaining>0 para bienestar (target low=40).
  const hist = [cs(1, 15, 1), cs(3, 15, 2), cs(10, 35, 3)];
  const base = (o: Partial<ComposeSessionInput> = {}): ComposeSessionInput => ({
    availableMinutes: 120, preparationMinutes: 8, strengthPlannedMinutes: 78, strengthWeeklyRemaining: 10,
    timeFitTrimmed: false, headroomEndedEarly: false, readinessLow: false, deload: false,
    completedSessions: hist, nowMs: NOW, bodyGoal: 'Bienestar integral', trainingGoal: 'hipertrofia',
    lowImpactMode: false, hasPain: false, dayType: 'upper', ...o,
  });
  it('bienestar (preferredStyle=correr) + zona2 → composedCardio.style=lowImpact (nunca correr)', () => {
    const r = composeSession(base());
    expect(r.composedCardio).toBeDefined();
    expect(r.composedCardio!.intensityCeiling).toBe('zona2');
    expect(r.composedCardio!.style).toBe('lowImpact');            // degradado (fix a)
    expect(['correr', 'funcional', 'explosividad']).not.toContain(r.composedCardio!.style);
  });
  it('INVARIANTE: cualquier composedCardio con ceiling zona2 nunca sella un style agresivo', () => {
    for (const bg of ['Bienestar integral', 'Ganar músculo', 'Bajar grasa', 'Recomposición'])
      for (const tg of ['hipertrofia', 'fuerza'] as const) {
        const r = composeSession(base({ bodyGoal: bg, trainingGoal: tg }));
        if (r.composedCardio && r.composedCardio.intensityCeiling === 'zona2')
          expect(['correr', 'funcional', 'explosividad']).not.toContain(r.composedCardio.style);
      }
  });
});
