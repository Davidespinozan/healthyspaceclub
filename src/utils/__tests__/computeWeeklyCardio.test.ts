import { describe, it, expect } from 'vitest';
import { computeWeeklyCardio } from '../computeWeeklyCardio';
import type { CompletedSession } from '../../types';

// ═══════════════════════════════════════════════════════════════════════════
// FASE 1A · computeWeeklyCardio — cardio REALMENTE completado (minutos/sesiones reales).
// ═══════════════════════════════════════════════════════════════════════════

// nowMs fijo para determinismo: 2026-08-19 (mediodía local aproximado).
const NOW = new Date('2026-08-19T18:00:00Z').getTime();
const cardio = (date: string, sec: number, extra: Partial<CompletedSession> = {}): CompletedSession => ({
  sessionId: extra.sessionId ?? `c-${date}-${sec}`, date, completedAtIso: `${date}T10:00:00.000Z`,
  modality: 'cardio', exerciseIds: [], durationSeconds: sec, exercisesCompleted: 1, exercisesTotal: 1, ...extra,
});
const strength = (date: string, sec: number, extra: Partial<CompletedSession> = {}): CompletedSession => ({
  sessionId: extra.sessionId ?? `s-${date}`, date, completedAtIso: `${date}T10:00:00.000Z`,
  modality: 'fuerza', exerciseIds: ['press-horizontal'], durationSeconds: sec, exercisesCompleted: 1, exercisesTotal: 1, ...extra,
});

describe('computeWeeklyCardio', () => {
  it('1 · 30 min cardio hoy → 30 / 1', () => {
    const r = computeWeeklyCardio([cardio('2026-08-19', 1800)], NOW);
    expect(r.minutes7d).toBe(30); expect(r.sessions7d).toBe(1);
  });
  it('2 · dos sesiones 20+30 → 50 / 2', () => {
    const r = computeWeeklyCardio([cardio('2026-08-17', 1200), cardio('2026-08-19', 1800)], NOW);
    expect(r.minutes7d).toBe(50); expect(r.sessions7d).toBe(2);
  });
  it('3 · sesión de fuerza → 0', () => {
    const r = computeWeeklyCardio([strength('2026-08-19', 3000)], NOW);
    expect(r.minutes7d).toBe(0); expect(r.sessions7d).toBe(0);
  });
  it('4 · supplemental fuerza (modality fuerza) → 0', () => {
    const r = computeWeeklyCardio([strength('2026-08-19', 900, { source: 'supplemental' })], NOW);
    expect(r.minutes7d).toBe(0); expect(r.sessions7d).toBe(0);
  });
  it('5 · dos sesiones mismo día → ambas cuentan', () => {
    const r = computeWeeklyCardio([cardio('2026-08-19', 1200, { sessionId: 'a' }), cardio('2026-08-19', 1200, { sessionId: 'b' })], NOW);
    expect(r.sessions7d).toBe(2); expect(r.minutes7d).toBe(40);
  });
  it('6 · >7d → excluida de 7d (pero cuenta en 14d)', () => {
    const r = computeWeeklyCardio([cardio('2026-08-10', 1800)], NOW); // 9 días atrás
    expect(r.minutes7d).toBe(0); expect(r.sessions7d).toBe(0);
    expect(r.minutes14d).toBe(30); expect(r.sessions14d).toBe(1);
  });
  it('7 · durationSeconds parcial (menos de lo prescrito) → usa el real', () => {
    const r = computeWeeklyCardio([cardio('2026-08-19', 900)], NOW); // 15 min reales
    expect(r.minutes7d).toBe(15);
  });
  it('8 · sessionId duplicado → no doble conteo', () => {
    const dup = cardio('2026-08-19', 1800, { sessionId: 'same' });
    const r = computeWeeklyCardio([dup, { ...dup }], NOW);
    expect(r.sessions7d).toBe(1); expect(r.minutes7d).toBe(30);
  });
  it('9 · datos vacíos / corruptos → seguro (0, no inventa)', () => {
    expect(computeWeeklyCardio([], NOW)).toEqual({ minutes7d: 0, sessions7d: 0, minutes14d: 0, sessions14d: 0 });
    const bad = computeWeeklyCardio([cardio('2026-08-19', NaN as unknown as number), cardio('2026-08-19', -100, { sessionId: 'x' })], NOW);
    expect(bad.minutes7d).toBe(0); expect(bad.sessions7d).toBe(2); // sesiones cuentan, minutos corruptos → 0
  });
  it('10 · frontera de fecha local: 7 días exactos incluido, 8 excluido', () => {
    const in7 = computeWeeklyCardio([cardio('2026-08-13', 1800)], NOW); // exactamente 7d (since=08-13)
    expect(in7.sessions7d).toBe(1);
    const out7 = computeWeeklyCardio([cardio('2026-08-12', 1800)], NOW); // 8d → fuera
    expect(out7.sessions7d).toBe(0);
  });
});
