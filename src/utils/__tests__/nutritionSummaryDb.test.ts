import { describe, it, expect } from 'vitest';
import { summaryInsertRow, summaryEvidencePatch, summaryFromDbRow } from '../nutritionSummaryDb';
import type { NutritionDaySummary } from '../nutritionEvidence';

// NUTRITION-N10.2A.2 · mapeo DB (inmutabilidad de target por construcción del payload).
const s = (over: Partial<NutritionDaySummary> = {}): NutritionDaySummary =>
  ({ date: '2026-08-24', targetKcal: 2000, loggedKcal: 1800, measuredSlots: 3, totalSlots: 5, evidenceClass: 'LOGGED_STRONG', ...over });

describe('N10.2A.2 · immutable-target payloads', () => {
  it('A/B · el UPDATE patch NUNCA incluye target_kcal (device stale no puede pisar target)', () => {
    const patch = summaryEvidencePatch(s({ targetKcal: 1950 }));
    expect(Object.keys(patch).sort()).toEqual(['evidence_class', 'logged_kcal', 'measured_slots', 'total_slots', 'updated_at']);
    expect('target_kcal' in patch).toBe(false);
  });
  it('el INSERT row SÍ fija target_kcal (first-write) redondeado', () => {
    const row = summaryInsertRow('u1', s({ targetKcal: 1999.6 }));
    expect(row.target_kcal).toBe(2000);
    expect(row.user_id).toBe('u1');
    expect(row.evidence_class).toBe('LOGGED_STRONG');
  });
  it('C/D · el patch de evidencia SÍ refleja upgrade/downgrade de evidencia', () => {
    expect(summaryEvidencePatch(s({ loggedKcal: 400, measuredSlots: 1, evidenceClass: 'LOGGED_PARTIAL' })).evidence_class).toBe('LOGGED_PARTIAL');
    expect(summaryEvidencePatch(s({ measuredSlots: 4, evidenceClass: 'LOGGED_STRONG' })).measured_slots).toBe(4);
  });
  it('round-trip DB row → summary', () => {
    const row = { date: '2026-08-24', target_kcal: 2000, logged_kcal: 1800, measured_slots: 3, total_slots: 5, evidence_class: 'LOGGED_STRONG' };
    expect(summaryFromDbRow(row)).toEqual(s());
  });
  it('summaryFromDbRow coacciona strings numéricos (Postgres numeric)', () => {
    const row = { date: '2026-08-24', target_kcal: '2000', logged_kcal: '1800', measured_slots: '3', total_slots: '5', evidence_class: 'LOGGED_STRONG' };
    expect(summaryFromDbRow(row as any).targetKcal).toBe(2000);
  });
});
