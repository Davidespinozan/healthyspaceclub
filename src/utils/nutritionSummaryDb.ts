// ─────────────────────────────────────────────────────────────────────────────
// NUTRITION-N10.2A.2 · mapeo PURO entre NutritionDaySummary y la fila de nutrition_day_summary.
//
// La inmutabilidad de target_kcal se expresa por el CLIENTE en DOS pasos (Supabase JS no puede
// "update evidence pero no target" en un solo upsert):
//   1) INSERT … ON CONFLICT DO NOTHING con la fila COMPLETA (fija target_kcal la 1ª vez; no-op si existe),
//   2) UPDATE solo con `summaryEvidencePatch` (NUNCA incluye target_kcal → el target histórico no se pisa).
// Sin trigger/RPC. Este módulo hace los mapeos testeables; NO toca calorías.
// ─────────────────────────────────────────────────────────────────────────────

import type { NutritionDaySummary, EvidenceClass } from './nutritionEvidence';

export interface NutritionSummaryRow {
  user_id: string;
  date: string;
  target_kcal: number;
  logged_kcal: number;
  measured_slots: number;
  total_slots: number;
  evidence_class: EvidenceClass;
}

/** Fila COMPLETA para INSERT … ON CONFLICT DO NOTHING (fija el target inmutable en la 1ª escritura). */
export function summaryInsertRow(userId: string, s: NutritionDaySummary): NutritionSummaryRow {
  return {
    user_id: userId,
    date: s.date,
    target_kcal: Math.round(s.targetKcal),
    logged_kcal: Math.round(s.loggedKcal),
    measured_slots: s.measuredSlots | 0,
    total_slots: s.totalSlots | 0,
    evidence_class: s.evidenceClass,
  };
}

/** Patch de EVIDENCIA para UPDATE. INVARIANTE: NUNCA incluye target_kcal (inmutabilidad histórica). */
export function summaryEvidencePatch(s: NutritionDaySummary): {
  logged_kcal: number; measured_slots: number; total_slots: number; evidence_class: EvidenceClass; updated_at: string;
} {
  return {
    logged_kcal: Math.round(s.loggedKcal),
    measured_slots: s.measuredSlots | 0,
    total_slots: s.totalSlots | 0,
    evidence_class: s.evidenceClass,
    updated_at: new Date().toISOString(),
  };
}

/** Mapea una fila remota → NutritionDaySummary (hidratación). */
export function summaryFromDbRow(row: {
  date: string; target_kcal: number | string; logged_kcal: number | string;
  measured_slots: number | string; total_slots: number | string; evidence_class: string;
}): NutritionDaySummary {
  return {
    date: row.date,
    targetKcal: Number(row.target_kcal),
    loggedKcal: Number(row.logged_kcal),
    measuredSlots: Number(row.measured_slots),
    totalSlots: Number(row.total_slots),
    evidenceClass: row.evidence_class as EvidenceClass,
  };
}
