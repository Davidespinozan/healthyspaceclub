import { describe, it, expect } from 'vitest';
import { deriveWeeklyCardioPolicy, hasRecentCardioBase, STRUCTURED_CARDIO_CALIBRATION, type WeeklyCardioInput } from '../weeklyCardioPolicy';
import type { WeeklyCardio } from '../computeWeeklyCardio';

// ═══════════════════════════════════════════════════════════════════════════
// GAP-C · weeklyCardioPolicy — structured (PRODUCT_CALIBRATION) separado de health reference (informativo).
// ═══════════════════════════════════════════════════════════════════════════
const noCardio: WeeklyCardio = { minutes7d: 0, sessions7d: 0, minutes14d: 0, sessions14d: 0 };
const oneSession: WeeklyCardio = { minutes7d: 20, sessions7d: 1, minutes14d: 20, sessions14d: 1 };
const consistent: WeeklyCardio = { minutes7d: 60, sessions7d: 2, minutes14d: 120, sessions14d: 4 };
const inp = (o: Partial<WeeklyCardioInput>): WeeklyCardioInput => ({
  bodyGoal: 'Ganar músculo', trainingGoal: 'hipertrofia', lowImpactMode: false, hasPain: false, completedCardio: noCardio, ...o,
});
const A = STRUCTURED_CARDIO_CALIBRATION.tiers;

describe('hasRecentCardioBase (14d, >1 sesión)', () => {
  it('0 cardio → false', () => expect(hasRecentCardioBase(noCardio)).toBe(false));
  it('UNA sola sesión → false (no basta)', () => expect(hasRecentCardioBase(oneSession)).toBe(false));
  it('varias exposiciones 14d (4 sesiones, 120 min) → true', () => expect(hasRecentCardioBase(consistent)).toBe(true));
});

describe('reality-check (calibración final)', () => {
  it('A · hiper·ganar·0 cardio → minimal / target 10 / rem 10 / zona2', () => {
    const p = deriveWeeklyCardioPolicy(inp({ bodyGoal: 'Ganar músculo' }));
    expect(p.structured.prescriptionTier).toBe('minimal');
    expect(p.structured.targetMinutes).toBe(A.minimal.anchor);
    expect(p.structured.remainingMinutes).toBe(10);
    expect(p.intensityCeiling).toBe('zona2');
  });
  it('B · hiper·perder grasa·0 cardio → SIN base cap a low / zona2 (no moderate)', () => {
    const p = deriveWeeklyCardioPolicy(inp({ bodyGoal: 'Bajar grasa' }));
    expect(p.structured.prescriptionTier).toBe('low');   // moderate → low por sin base
    expect(p.intensityCeiling).toBe('zona2');
  });
  it('C · perder grasa + UNA sola sesión → NO desbloquea moderate (sigue low/zona2)', () => {
    const p = deriveWeeklyCardioPolicy(inp({ bodyGoal: 'Bajar grasa', completedCardio: oneSession }));
    expect(p.structured.prescriptionTier).toBe('low');
    expect(p.intensityCeiling).toBe('zona2');
  });
  it('D · perder grasa + historial consistente 14d → moderate / ceiling moderate', () => {
    const p = deriveWeeklyCardioPolicy(inp({ bodyGoal: 'Bajar grasa', completedCardio: consistent }));
    expect(p.structured.prescriptionTier).toBe('moderate');
    expect(p.structured.targetMinutes).toBe(A.moderate.anchor);
    expect(p.structured.remainingMinutes).toBe(Math.max(0, 90 - 60)); // 30
    expect(p.intensityCeiling).toBe('moderate');
  });
  it('E · fuerza·ganar → minimal / zona2 / nota proteger-fuerza', () => {
    const p = deriveWeeklyCardioPolicy(inp({ bodyGoal: 'Ganar músculo', trainingGoal: 'fuerza' }));
    expect(p.structured.prescriptionTier).toBe('minimal');
    expect(p.intensityCeiling).toBe('zona2');
    expect(p.interferenceNotes.some(n => n.includes('proteger-fuerza'))).toBe(true);
  });
  it('F · activityLevel Alta NO existe como input → NO reduce el target (mismo que sin ella)', () => {
    // el helper no acepta activityLevel; el target sale solo de bodyGoal/trainingGoal/base.
    const p = deriveWeeklyCardioPolicy(inp({ bodyGoal: 'Ganar músculo' }));
    expect(p.structured.targetMinutes).toBe(A.minimal.anchor); // sin reducción arbitraria
  });
  it('G · >60 sano SIN lowImpact → NO forzado a zona2 por edad (edad no es input)', () => {
    // perder grasa + base + sin lowImpact/pain → moderate (la edad NO lo bloquea).
    const p = deriveWeeklyCardioPolicy(inp({ bodyGoal: 'Bajar grasa', completedCardio: consistent, lowImpactMode: false, hasPain: false }));
    expect(p.intensityCeiling).toBe('moderate');
  });
  it('H · lowImpactMode true → ceiling zona2 forzado', () => {
    const p = deriveWeeklyCardioPolicy(inp({ bodyGoal: 'Bajar grasa', completedCardio: consistent, lowImpactMode: true }));
    expect(p.intensityCeiling).toBe('zona2');
  });
  it('H2 · hasPain true → ceiling zona2 forzado', () => {
    const p = deriveWeeklyCardioPolicy(inp({ bodyGoal: 'Bajar grasa', completedCardio: consistent, hasPain: true }));
    expect(p.intensityCeiling).toBe('zona2');
  });
  it('I · completed ≥ structuredTarget → remaining 0 (sin relleno)', () => {
    const done: WeeklyCardio = { minutes7d: 50, sessions7d: 2, minutes14d: 120, sessions14d: 4 };
    const p = deriveWeeklyCardioPolicy(inp({ bodyGoal: 'Recomposición', completedCardio: done })); // low target 40
    expect(p.structured.remainingMinutes).toBe(0);
  });
});

describe('separación health vs structured', () => {
  it('healthReference es informativo y NO entra en remaining', () => {
    const p = deriveWeeklyCardioPolicy(inp({}));
    expect(p.healthReference.informationalOnly).toBe(true);
    expect(p.healthReference.moderateMinutesRange).toEqual([150, 300]);
    // remaining depende SOLO de structured.target − completed, nunca de healthReference.
    expect(p.structured.remainingMinutes).toBe(Math.max(0, p.structured.targetMinutes - p.structured.completedMinutes));
  });
  it('remaining nunca usa healthReference − completed', () => {
    const done: WeeklyCardio = { minutes7d: 200, sessions7d: 5, minutes14d: 400, sessions14d: 10 };
    const p = deriveWeeklyCardioPolicy(inp({ bodyGoal: 'Bajar grasa', completedCardio: done }));
    expect(p.structured.remainingMinutes).toBe(0); // 200 ≥ target → 0 (NO 150-200 ni 300-200)
  });
  it('nunca prescribe HIIT/intervals (ceiling ∈ zona2|moderate)', () => {
    for (const g of ['Ganar músculo', 'Bajar grasa', 'Recomposición', 'Bienestar integral']) {
      const p = deriveWeeklyCardioPolicy(inp({ bodyGoal: g, completedCardio: consistent }));
      expect(['zona2', 'moderate']).toContain(p.intensityCeiling);
      expect(p.preferredStyle).not.toBe('explosividad');
      expect(p.interferenceNotes).toContain('no-HIIT-auto-v1');
    }
  });
  it('números centralizados en STRUCTURED_CARDIO_CALIBRATION (recalibrable)', () => {
    expect(STRUCTURED_CARDIO_CALIBRATION.tiers.moderate.anchor).toBe(90);
    expect(STRUCTURED_CARDIO_CALIBRATION.dailyCapMinutes).toBe(25);
    expect(STRUCTURED_CARDIO_CALIBRATION.recentCardioBase).toEqual({ minSessions14d: 3, minMinutes14d: 60 });
  });
});
