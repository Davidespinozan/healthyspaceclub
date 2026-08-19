import { describe, it, expect } from 'vitest';
import { deriveDailyCardioPlacement, DAILY_CARDIO_CALIBRATION, type DailyCardioInput } from '../dailyCardioPlacement';
import type { WeeklyCardioPolicy, CardioIntensityCeiling } from '../weeklyCardioPolicy';
import type { CardioStyle } from '../../types';

// ═══════════════════════════════════════════════════════════════════════════
// F2A · deriveDailyCardioPlacement — necesidad diaria (no reloj), fuerza intacta, gates duros.
// ═══════════════════════════════════════════════════════════════════════════
const policy = (o: Partial<{ remaining: number; dailyCap: number; base: boolean; style: CardioStyle; ceiling: CardioIntensityCeiling }> = {}): WeeklyCardioPolicy => ({
  healthReference: { moderateMinutesRange: [150, 300], vigorousMinutesRange: [75, 150], informationalOnly: true },
  structured: { prescriptionTier: 'low', targetMinutes: 40, completedMinutes: 0, remainingMinutes: o.remaining ?? 40 },
  preferredStyle: o.style ?? 'lowImpact',
  intensityCeiling: o.ceiling ?? 'zona2',
  dailyCapMinutes: o.dailyCap ?? 25,
  hasRecentCardioBase: o.base ?? true,
  interferenceNotes: [],
});
const inp = (o: Partial<DailyCardioInput> = {}): DailyCardioInput => ({
  availableMinutes: 120, preparationMinutes: 6, strengthPlannedMinutes: 78,
  weeklyPolicy: policy(), sessionEndReason: 'DOSE_COMPLETE',
  readinessLow: false, deload: false, trainingGoal: 'hipertrofia', dayType: 'upper',
  lowImpactMode: false, hasPain: false, ...o,
});
const run = (o: Partial<DailyCardioInput>) => deriveDailyCardioPlacement(inp(o));

describe('casos obligatorios A–O', () => {
  it('A · rem10 spare36 cap25 ganar/upper → 10 (NO 25)', () => {
    // ganar (sin base típico) → cap no-base 15; dailyNeed=10 (≤cap) → 10.
    const p = run({ weeklyPolicy: policy({ remaining: 10, base: false }), strengthPlannedMinutes: 78 });
    expect(p.minutes).toBe(10);
  });
  it('B · rem40 spare36 con base upper → dailyNeed 20 → 20', () => {
    const p = run({ weeklyPolicy: policy({ remaining: 40, base: true }) });
    expect(p.minutes).toBe(20);
  });
  it('C · rem90 spare50 sin base → dailyNeed 45 → cap 15 → 15', () => {
    const p = run({ weeklyPolicy: policy({ remaining: 90, base: false }), availableMinutes: 134, strengthPlannedMinutes: 78 });
    expect(p.spareMinutes).toBe(50); expect(p.minutes).toBe(15);
  });
  it('D · rem0 spare50 → 0', () => {
    const p = run({ weeklyPolicy: policy({ remaining: 0 }), availableMinutes: 134 });
    expect(p.minutes).toBe(0); expect(p.shouldPlaceCardio).toBe(false);
  });
  it('E · rem40 spare7 → 0 (spare < MIN)', () => {
    const p = run({ weeklyPolicy: policy({ remaining: 40 }), availableMinutes: 91, strengthPlannedMinutes: 78 });
    expect(p.spareMinutes).toBe(7); expect(p.minutes).toBe(0);
  });
  it('F · rem40 spare16 → 16 (no inventa 20)', () => {
    const p = run({ weeklyPolicy: policy({ remaining: 40, base: true }), availableMinutes: 100, strengthPlannedMinutes: 78 });
    expect(p.spareMinutes).toBe(16); expect(p.minutes).toBe(16);
  });
  it('G · lower + rem40 + spare30 → ≤15 + zona2', () => {
    const p = run({ weeklyPolicy: policy({ remaining: 40, base: true }), dayType: 'lower', availableMinutes: 114, strengthPlannedMinutes: 78 });
    expect(p.minutes).toBeLessThanOrEqual(15); expect(p.intensityCeiling).toBe('zona2');
  });
  it('H · full-body igual → ≤15 + zona2', () => {
    const p = run({ weeklyPolicy: policy({ remaining: 40, base: true }), dayType: 'full-body', availableMinutes: 114, strengthPlannedMinutes: 78 });
    expect(p.minutes).toBeLessThanOrEqual(15); expect(p.intensityCeiling).toBe('zona2');
  });
  it('I · fuerza → ≤15 + zona2', () => {
    const p = run({ weeklyPolicy: policy({ remaining: 40, base: true }), trainingGoal: 'fuerza' });
    expect(p.minutes).toBeLessThanOrEqual(15); expect(p.intensityCeiling).toBe('zona2');
  });
  it('J · readiness baja → 0', () => expect(run({ readinessLow: true }).minutes).toBe(0));
  it('K · deload → 0', () => expect(run({ deload: true }).minutes).toBe(0));
  it('L · TIME_LIMITED → 0', () => expect(run({ sessionEndReason: 'TIME_LIMITED' }).minutes).toBe(0));
  it('M · RECOVERY_LIMITED → 0', () => expect(run({ sessionEndReason: 'RECOVERY_LIMITED' }).minutes).toBe(0));
  it('N · AVAILABLE_TIME_UNUSED + remaining>0 → elegible', () => {
    const p = run({ sessionEndReason: 'AVAILABLE_TIME_UNUSED', weeklyPolicy: policy({ remaining: 40, base: true }) });
    expect(p.shouldPlaceCardio).toBe(true);
  });
  it('O · DOSE_COMPLETE + remaining>0 → elegible', () => {
    const p = run({ sessionEndReason: 'DOSE_COMPLETE', weeklyPolicy: policy({ remaining: 40, base: true }) });
    expect(p.shouldPlaceCardio).toBe(true);
  });
});

describe('matriz · CARDIO NEED ≠ AVAILABLE TIME', () => {
  const wp = policy({ remaining: 40, base: true }); // dailyNeed = 20
  const at = (available: number, strength: number) =>
    run({ weeklyPolicy: wp, availableMinutes: available, preparationMinutes: 6, strengthPlannedMinutes: strength }).minutes;
  it('90 con spare16 → 16', () => expect(at(90, 68)).toBe(16));   // 90-6-68=16
  it('120 con spare36 → 20', () => expect(at(120, 78)).toBe(20)); // 120-6-78=36 → dailyNeed 20
  it('120 con spare80 → sigue 20 (más tiempo NO sube cardio)', () => expect(at(160, 74)).toBe(20)); // spare 80 → 20
  it('30/45/60 con spare pequeño → 0', () => {
    expect(at(30, 24)).toBe(0);  // spare 0
    expect(at(45, 37)).toBe(0);  // spare 2 < MIN
    expect(at(60, 47)).toBe(0);  // spare 7 < MIN
  });
});

describe('invariantes', () => {
  it('1 · fuerza no es input modificable (solo strengthPlannedMinutes se LEE)', () => {
    const keys = Object.keys(inp());
    expect(keys).not.toContain('sets'); expect(keys).not.toContain('exercises');
    expect(keys).toContain('strengthPlannedMinutes');
  });
  it('2 · cardio = spare (nunca roba fuerza): minutes ≤ spareMinutes', () => {
    const p = run({ weeklyPolicy: policy({ remaining: 40, base: true }), availableMinutes: 100, strengthPlannedMinutes: 78 });
    expect(p.minutes).toBeLessThanOrEqual(p.spareMinutes);
  });
  it('7 · dailyCap respetado', () => {
    const p = run({ weeklyPolicy: policy({ remaining: 90, dailyCap: 25, base: true }), availableMinutes: 200, strengthPlannedMinutes: 78 });
    expect(p.minutes).toBeLessThanOrEqual(25);
  });
  it('8/9/10 · caps no-base / fuerza / lower a 15', () => {
    expect(run({ weeklyPolicy: policy({ remaining: 90, base: false }), availableMinutes: 200, strengthPlannedMinutes: 78 }).minutes).toBeLessThanOrEqual(15);
    expect(run({ weeklyPolicy: policy({ remaining: 90, base: true }), trainingGoal: 'fuerza', availableMinutes: 200, strengthPlannedMinutes: 78 }).minutes).toBeLessThanOrEqual(15);
    expect(run({ weeklyPolicy: policy({ remaining: 90, base: true }), dayType: 'lower', availableMinutes: 200, strengthPlannedMinutes: 78 }).minutes).toBeLessThanOrEqual(15);
  });
  it('11/12 · ceiling zona2 cuando corresponde; nunca explosividad', () => {
    const p = run({ weeklyPolicy: policy({ remaining: 40, base: true, style: 'funcional', ceiling: 'moderate' }), dayType: 'lower' });
    expect(p.intensityCeiling).toBe('zona2');
    expect(p.style).not.toBe('explosividad');
    expect(p.style).toBe('lowImpact'); // funcional degradado por zona2
  });
  it('13 · need-driven: min(spare,cap) sin necesidad NO aplica (rem40/spare36/cap25 → 20, no 25)', () => {
    expect(run({ weeklyPolicy: policy({ remaining: 40, base: true }) }).minutes).toBe(20);
  });
  it('14/15 · cardioPlaced → HYBRID_COMPLETE + suppressFinisher', () => {
    const p = run({ weeklyPolicy: policy({ remaining: 40, base: true }) });
    expect(p.reason).toBe('HYBRID_COMPLETE'); expect(p.suppressFinisher).toBe(true);
  });
  it('16/17 · no-cardio → reason original + finisher NO suprimido', () => {
    const p = run({ weeklyPolicy: policy({ remaining: 0 }), sessionEndReason: 'DOSE_COMPLETE' });
    expect(p.reason).toBe('DOSE_COMPLETE'); expect(p.suppressFinisher).toBe(false);
  });
  it('18/19 · healthReference y strengthLevel NO son inputs operativos', () => {
    const keys = Object.keys(inp());
    expect(keys).not.toContain('strengthLevel');
    expect(keys).not.toContain('healthReference');
    expect(keys).not.toContain('activityLevel');
    // remaining depende de weeklyPolicy.structured, nunca de healthReference
    const p = run({ weeklyPolicy: policy({ remaining: 0, base: true }) });
    expect(p.minutes).toBe(0); // aunque healthReference exista, no fuerza cardio
  });
  it('20 · style solo se degrada, nunca se escala', () => {
    // weeklyPolicy dice lowImpact; F2A no puede subirlo a funcional/explosividad
    const p = run({ weeklyPolicy: policy({ remaining: 40, base: true, style: 'lowImpact', ceiling: 'zona2' }) });
    expect(p.style).toBe('lowImpact');
  });
  it('calibración centralizada', () => {
    expect(DAILY_CARDIO_CALIBRATION).toEqual({ expectedRemainingExposures: 2, minCardioMinutes: 10, strengthDailyCapMinutes: 15, heavyLowerDailyCapMinutes: 15, noRecentBaseDailyCapMinutes: 15 });
  });
});
