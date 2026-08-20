import { describe, it, expect } from 'vitest';
import { carrySealedCardio, structuredCardioRemainingNow } from '../sessionComposer';
import { dayKey } from '../localDate';
import type { CompletedSession } from '../../types';

// ═══════════════════════════════════════════════════════════════════════════
// F2C-1 · MUST FIX 1 (supplemental preserva composedCardio) + MUST FIX 2 (reconciliación en vivo).
// ═══════════════════════════════════════════════════════════════════════════

describe('MUST FIX 1 · carrySealedCardio (supplemental preserva composedCardio)', () => {
  const supBase: Record<string, unknown> = { type: 'extra-supplemental', exercises: [{ id: 'x', sets: 3 }], source: 'supplemental' };
  const pending = { minutes: 20, style: 'lowImpact', intensityCeiling: 'zona2' };
  const done = { ...pending, done: true };
  it('pending sobrevive Generarme más', () => {
    const r = carrySealedCardio(supBase, { composedCardio: pending });
    expect(r.composedCardio).toEqual(pending);
    expect(r.composedCardio).toBe(pending); // copia por referencia, NO recomputa
  });
  it('done sobrevive Generarme más', () => {
    expect(carrySealedCardio(supBase, { composedCardio: done }).composedCardio).toEqual(done);
  });
  it('ausencia de composedCardio → sigue ausente (mismo objeto, sin campo espurio)', () => {
    expect(carrySealedCardio(supBase, {}).composedCardio).toBeUndefined();
    expect(carrySealedCardio(supBase, null)).toBe(supBase);
    expect(carrySealedCardio(supBase, undefined)).toBe(supBase);
  });
  it('D1 fuerza intacto: exercises/source/type del supplemental no se tocan', () => {
    const r = carrySealedCardio(supBase, { composedCardio: pending });
    expect(r.exercises).toBe(supBase.exercises);
    expect(r.source).toBe('supplemental');
    expect(r.type).toBe('extra-supplemental');
  });
});

describe('MUST FIX 2 · structuredCardioRemainingNow (reconciliación read-only)', () => {
  const NOW = Date.UTC(2026, 7, 19, 12, 0, 0);
  const cs = (n: number, m: number, i: number): CompletedSession => ({
    sessionId: `c${n}${i}`, modality: 'cardio', date: dayKey(new Date(NOW - n * 86400000)),
    durationSeconds: m * 60, completedAtIso: new Date(NOW - n * 86400000).toISOString(), exerciseIds: [],
  } as unknown as CompletedSession);
  const remaining = (hist: CompletedSession[], bodyGoal = 'Bajar grasa') =>
    structuredCardioRemainingNow({ completedSessions: hist, nowMs: NOW, bodyGoal, trainingGoal: 'hipertrofia' });

  it('0 cardio hecho → remaining = target (sin base, perder grasa → low 40)', () => {
    expect(remaining([])).toBe(40);
  });
  it('cardio parcial con base → remaining baja pero >0', () => {
    // base (3 sesiones 14d, ≥60min) → moderate target 90; 40 min en 7d → remaining 50
    const hist = [cs(1, 20, 1), cs(2, 20, 2), cs(10, 25, 3)];
    const r = remaining(hist);
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(90);
  });
  it('cardio semanal CUBIERTO → remaining 0 (satisfecho)', () => {
    // base + ≥90 min en 7d → remaining 0
    const hist = [cs(1, 30, 1), cs(2, 30, 2), cs(3, 30, 3), cs(10, 20, 4)];
    expect(remaining(hist)).toBe(0);
  });
  it('SOLO cuenta cardio HSC (modality=cardio); fuerza/yoga no reducen', () => {
    const noise = [
      { sessionId: 'f1', modality: 'fuerza', date: dayKey(new Date(NOW)), durationSeconds: 3600, exerciseIds: [] },
      { sessionId: 'y1', modality: 'yoga', date: dayKey(new Date(NOW)), durationSeconds: 3600, exerciseIds: [] },
    ] as unknown as CompletedSession[];
    expect(remaining(noise)).toBe(40); // sin cardio real → sigue el target completo
  });
  it('cardio viejo fuera de la ventana 7d no reduce (week rollover)', () => {
    const old = [cs(9, 60, 1)]; // 9 días atrás → fuera de 7d
    expect(remaining(old)).toBe(40);
  });
});
