// ─────────────────────────────────────────────────────────────────────────────
// NUTRITION-N10.2A · EVIDENCIA DE ADHERENCIA (solo evidencia — NO cambia calorías).
//
// Separa de forma ABSOLUTA tres cosas que hoy se mezclan:
//   1. intake REGISTRADO (food_log) = evidencia MEDIDA,
//   2. intake ASUMIDO por marcar ✓ una comida del plan = NO medido (prescribed≠consumed),
//   3. AUSENCIA de datos ≠ 0 kcal ≠ falta de adherencia.
//
// Produce un snapshot diario derivado + un resumen de ventana. NUNCA detecta plateau, NUNCA calcula
// rate, NUNCA toca kcal/planGoal/computeNutritionTargets/weightTrend. Puro / determinista / no-mutante.
// computeDayConsumption (UI/coach) queda intacto; esta es una autoridad PARALELA solo de evidencia.
// ─────────────────────────────────────────────────────────────────────────────

/** Clase de evidencia del día. LOGGED_* = hay intake medido; CHECK_ONLY = solo ✓ (asumido); NO_DATA = nada. */
export type EvidenceClass = 'NO_DATA' | 'CHECK_ONLY' | 'LOGGED_PARTIAL' | 'LOGGED_STRONG' | 'MIXED';
/** Elegibilidad de evidencia para una FUTURA adaptación (N10.2B). Solo describe; no acciona. */
export type AdaptationEvidence = 'NONE' | 'WEAK' | 'STRONG';

/** Cobertura de slots medidos para considerar la evidencia "fuerte" (≥60% de las franjas con log/resuelto). */
export const STRONG_COVERAGE = 0.6;
/** Retención del historial de resúmenes (días). Suficiente para una ventana futura de 14–21 d. */
export const NUTRITION_SUMMARY_RETENTION_DAYS = 35;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface DayEvidenceInput {
  date: string;
  targetKcal: number;
  totalSlots: number;
  mealChecks: Record<string, boolean>;
  mealResolvedByLog: Record<string, true>;
  foodLog: ReadonlyArray<{ date: string; kcal: number; mealIndex?: number | null }>;
}

/** Snapshot diario COMPLETO (derivado). El persistido es un subconjunto (ver toSummary). */
export interface DayEvidence {
  date: string;
  targetKcal: number;
  evidenceClass: EvidenceClass;
  loggedKcal: number;            // intake MEDIDO (suma food_log del día; 0 explícito ≠ NO_DATA)
  foodLogCount: number;          // # entradas food_log (>0 aunque kcal sea 0 → ayuno explícito)
  measuredSlots: number;         // franjas distintas con log-mapeado-a-slot O resueltas-por-log
  checkedOnlySlots: number;      // franjas ✓ pero SIN evidencia medida (asumidas)
  totalSlots: number;
  loggedCoverage: number;        // measuredSlots / totalSlots
  hasLoggedEvidence: boolean;    // hubo algún food_log ese día
  adaptationEvidence: AdaptationEvidence;
}

/** Resumen MÍNIMO persistido (snapshot derivado, no una 2ª base de comida). */
export interface NutritionDaySummary {
  date: string;
  targetKcal: number;
  loggedKcal: number;
  measuredSlots: number;
  totalSlots: number;
  evidenceClass: EvidenceClass;
}

function adaptationFrom(cls: EvidenceClass, coverage: number): AdaptationEvidence {
  if (cls === 'NO_DATA' || cls === 'CHECK_ONLY') return 'NONE';
  return coverage >= STRONG_COVERAGE ? 'STRONG' : 'WEAK';
}

/** Deriva la evidencia del día desde datos OBSERVABLES. Puro. */
export function buildDayEvidence(input: DayEvidenceInput): DayEvidence {
  const { date, targetKcal, mealChecks, mealResolvedByLog, foodLog } = input;
  const totalSlots = Math.max(0, input.totalSlots | 0);

  const measured = new Set<number>();       // franjas con evidencia MEDIDA (log en slot o resuelta)
  const checkedSlots = new Set<number>();
  for (let i = 0; i < totalSlots; i++) {
    const key = `meal-${date}-${i}`;
    if (mealChecks[key]) checkedSlots.add(i);
    if (mealResolvedByLog[key]) measured.add(i);
  }
  // food_log del día: suma kcal (medido) y cobertura por mealIndex (log SIN mealIndex → kcal pero NO slot).
  let loggedKcal = 0, foodLogCount = 0;
  for (const e of foodLog) {
    if (e.date !== date) continue;
    foodLogCount++;
    loggedKcal += Number(e.kcal) || 0;
    const mi = e.mealIndex;
    if (typeof mi === 'number' && mi >= 0 && mi < totalSlots) measured.add(mi);
  }
  const measuredSlots = measured.size;
  const checkedOnlySlots = [...checkedSlots].filter((i) => !measured.has(i)).length;
  const loggedCoverage = totalSlots > 0 ? measuredSlots / totalSlots : 0;
  const hasLoggedEvidence = foodLogCount > 0;

  let evidenceClass: EvidenceClass;
  if (!hasLoggedEvidence && checkedSlots.size === 0) evidenceClass = 'NO_DATA';
  else if (!hasLoggedEvidence) evidenceClass = 'CHECK_ONLY';           // hay ✓ pero cero intake medido
  else if (checkedOnlySlots > 0) evidenceClass = 'MIXED';             // logs + franjas ✓ sin medir
  else evidenceClass = loggedCoverage >= STRONG_COVERAGE ? 'LOGGED_STRONG' : 'LOGGED_PARTIAL';

  // adaptationEvidence: MIXED usa su cobertura medida (los ✓ asumidos NO suman).
  const coverForAdapt = evidenceClass === 'CHECK_ONLY' || evidenceClass === 'NO_DATA' ? 0 : loggedCoverage;
  const adaptationEvidence = adaptationFrom(evidenceClass, coverForAdapt);

  return {
    date, targetKcal, evidenceClass,
    loggedKcal: Math.round(loggedKcal), foodLogCount, measuredSlots, checkedOnlySlots, totalSlots,
    loggedCoverage: +loggedCoverage.toFixed(3), hasLoggedEvidence, adaptationEvidence,
  };
}

/** Proyecta el snapshot COMPLETO al resumen MÍNIMO que se persiste. */
export function toSummary(ev: DayEvidence): NutritionDaySummary {
  return { date: ev.date, targetKcal: ev.targetKcal, loggedKcal: ev.loggedKcal, measuredSlots: ev.measuredSlots, totalSlots: ev.totalSlots, evidenceClass: ev.evidenceClass };
}

/** Fusiona/actualiza el summary de una fecha en la lista, PRESERVANDO el targetKcal ya snapshoteado
 *  (nunca recalcula días viejos con el target de hoy) y podando por retención local. Puro. */
export function upsertSummary(
  list: ReadonlyArray<NutritionDaySummary>,
  next: NutritionDaySummary,
  asOfDate: string,
): NutritionDaySummary[] {
  const cutoff = shiftDateKey(asOfDate, -(NUTRITION_SUMMARY_RETENTION_DAYS - 1));
  const existing = list.find((s) => s.date === next.date);
  // §7: el targetKcal del día se congela en el PRIMER snapshot; refrescos posteriores no lo pisan.
  const merged: NutritionDaySummary = existing ? { ...next, targetKcal: existing.targetKcal } : next;
  const out = list.filter((s) => s.date !== next.date && (!cutoff || s.date >= cutoff));
  out.push(merged);
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

export interface EvidenceWindow {
  daysInWindow: number;
  evidenceDays: number;          // días con evidencia medida (algún log)
  strongEvidenceDays: number;    // días LOGGED_STRONG
  checkOnlyDays: number;
  noDataDays: number;
  consecutiveNoDataMax: number;
  windowCoverage: number;        // strongEvidenceDays / windowDays
}

/** Estadística de una ventana (para N10.2B). NO decide plateau, NO cambia kcal. Puro. */
export function nutritionEvidenceWindow(
  summaries: ReadonlyArray<NutritionDaySummary>,
  asOfDate: string,
  windowDays = 14,
): EvidenceWindow {
  const cutoff = shiftDateKey(asOfDate, -(windowDays - 1));
  const inWin = DATE_RE.test(asOfDate) && cutoff
    ? summaries.filter((s) => s.date >= cutoff && s.date <= asOfDate)
    : [];
  const evidenceDays = inWin.filter((s) => s.evidenceClass.startsWith('LOGGED') || s.evidenceClass === 'MIXED').length;
  const strongEvidenceDays = inWin.filter((s) => s.evidenceClass === 'LOGGED_STRONG').length;
  const checkOnlyDays = inWin.filter((s) => s.evidenceClass === 'CHECK_ONLY').length;
  // NO_DATA cuenta los días de la ventana SIN summary o con clase NO_DATA.
  const present = new Set(inWin.map((s) => s.date));
  let noDataDays = 0, consecutiveNoDataMax = 0, run = 0;
  for (let i = 0; i < windowDays; i++) {
    const day = shiftDateKey(asOfDate, -(windowDays - 1 - i));
    const s = day ? inWin.find((x) => x.date === day) : undefined;
    const isNoData = !s || s.evidenceClass === 'NO_DATA';
    if (isNoData) { noDataDays++; run++; consecutiveNoDataMax = Math.max(consecutiveNoDataMax, run); }
    else run = 0;
    void present;
  }
  return {
    daysInWindow: windowDays, evidenceDays, strongEvidenceDays, checkOnlyDays, noDataDays,
    consecutiveNoDataMax, windowCoverage: windowDays > 0 ? +(strongEvidenceDays / windowDays).toFixed(3) : 0,
  };
}

/** Desplaza una clave YYYY-MM-DD por N días en HORA LOCAL (sin trap UTC). */
function shiftDateKey(dateKey: string, deltaDays: number): string | null {
  if (!DATE_RE.test(dateKey)) return null;
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  dt.setDate(dt.getDate() + deltaDays);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
