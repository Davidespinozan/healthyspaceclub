// ─────────────────────────────────────────────────────────────────────────────
// NUTRITION-N10.1 · PESO DE TENDENCIA PARA NUTRICIÓN (estabilización de input).
//
// El target nutricional NO debe reaccionar a un pesaje crudo (agua/glucógeno/sodio de un día). Esta capa
// deriva un PESO ESTABLE por MEDIANA RODANTE de 14 días y decide si vale la pena mover el baseline
// nutricional (obData.peso). El peso CRUDO de la báscula sigue viviendo en weightLog (display intacto);
// computeNutritionTargets sigue siendo la ÚNICA autoridad — solo cambia el pesoKg que recibe.
//
// Puro / determinista / sin React·store·Supabase / timezone-safe (opera sobre claves YYYY-MM-DD locales).
// SIN plateau, SIN rate controller, SIN adherencia, SIN EMA, SIN slope — eso es N10.2, no este gate.
// ─────────────────────────────────────────────────────────────────────────────

export interface WeightPoint { date: string; kg: number }

export type WeightTrendResult =
  | { status: 'INSUFFICIENT_DATA'; stableKg: null; pointsUsed: number }
  | { status: 'READY'; stableKg: number; pointsUsed: number; windowStart: string; windowEnd: string };

/** Ventana de tendencia (días). */
export const NUTRITION_WEIGHT_WINDOW_DAYS = 14;
/** Mínimo de DÍAS válidos distintos en la ventana para considerar la tendencia usable. */
export const NUTRITION_WEIGHT_MIN_DAYS = 3;
/** Umbral de materialidad: mover el peso nutricional solo si la mediana cambió ≥ esto. Gate A: sensibilidad
 *  ≈11–19 kcal/kg → 0.5 kg ≈ 5–10 kcal de target; por debajo no vale la pena re-persistir (solo churn). */
export const NUTRITION_WEIGHT_UPDATE_KG = 0.5;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Desplaza una clave YYYY-MM-DD por N días en HORA LOCAL (evita el trap UTC de new Date("YYYY-MM-DD")). */
function shiftDateKey(dateKey: string, deltaDays: number): string | null {
  if (!DATE_RE.test(dateKey)) return null;
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);                 // fecha LOCAL (no UTC)
  if (Number.isNaN(dt.getTime())) return null;
  dt.setDate(dt.getDate() + deltaDays);
  const yy = dt.getFullYear(), mm = String(dt.getMonth() + 1).padStart(2, '0'), dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Peso estable (mediana rodante de 14 días) para nutrición. Puro; asOfDate es la clave YYYY-MM-DD de "hoy". */
export function deriveStableNutritionWeight(
  weightLog: ReadonlyArray<WeightPoint> | null | undefined,
  asOfDate: string,
): WeightTrendResult {
  const asOf = DATE_RE.test(asOfDate) ? asOfDate : '';
  if (!asOf) return { status: 'INSUFFICIENT_DATA', stableKg: null, pointsUsed: 0 };
  const cutoff = shiftDateKey(asOf, -(NUTRITION_WEIGHT_WINDOW_DAYS - 1)); // ventana inclusiva de 14 días
  // Dedup por día (último válido en orden de entrada gana, fail-safe aunque el store ya dedupea) + filtro válido/ventana.
  const byDate = new Map<string, number>();
  for (const p of weightLog ?? []) {
    if (!p || !DATE_RE.test(p.date)) continue;
    const kg = Number(p.kg);
    if (!Number.isFinite(kg) || kg <= 0) continue;
    if (cutoff && (p.date < cutoff || p.date > asOf)) continue;
    byDate.set(p.date, kg);
  }
  const days = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const pointsUsed = days.length;
  if (pointsUsed < NUTRITION_WEIGHT_MIN_DAYS) return { status: 'INSUFFICIENT_DATA', stableKg: null, pointsUsed };
  const vals = days.map((d) => d[1]).sort((a, b) => a - b);
  const n = vals.length;
  const median = n % 2 ? vals[(n - 1) / 2] : (vals[n / 2 - 1] + vals[n / 2]) / 2;
  const stableKg = Math.round(median * 100) / 100;                 // 2 decimales internos
  return { status: 'READY', stableKg, pointsUsed, windowStart: days[0][0], windowEnd: days[n - 1][0] };
}

export type NutritionWeightDecision =
  | { update: false; stableKg: number | null; reason: 'INSUFFICIENT_DATA' | 'HOLD_SUBTHRESHOLD' }
  | { update: true; stableKg: number; reason: 'UPDATE' };

/** Decisión PURA: dado el historial y el peso nutricional vigente, ¿mover el baseline y a qué valor?
 *  READY + |mediana − actual| ≥ 0.5 kg → UPDATE; si no → HOLD (insuficiente o sub-umbral). Testeable sin store. */
export function nextNutritionWeight(
  weightLog: ReadonlyArray<WeightPoint> | null | undefined,
  currentNutritionKg: number | null | undefined,
  asOfDate: string,
): NutritionWeightDecision {
  const trend = deriveStableNutritionWeight(weightLog, asOfDate);
  if (trend.status !== 'READY') return { update: false, stableKg: null, reason: 'INSUFFICIENT_DATA' };
  const cur = Number(currentNutritionKg);
  if (Number.isFinite(cur) && Math.abs(trend.stableKg - cur) < NUTRITION_WEIGHT_UPDATE_KG) {
    return { update: false, stableKg: trend.stableKg, reason: 'HOLD_SUBTHRESHOLD' };
  }
  return { update: true, stableKg: trend.stableKg, reason: 'UPDATE' };
}
