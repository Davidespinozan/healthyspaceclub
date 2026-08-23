// Lógica pura del food estimator — Lote Food-1.
//
// parseFoodEstimate:    raw IA response → FoodEstimate | null
// sanitizeFoodEntry:    estimate + desc + source → entry para addFoodLog
//
// Función pura, sin dependencias React/Supabase — testeada con vitest
// en __tests__/foodEstimate.test.ts.
//
// Filosofía: ante CUALQUIER duda, parseFoodEstimate devuelve null.
// Mejor abortar el registro que ensuciar foodLog con NaN o números
// negativos — el coach hace `.reduce((s, e) => s + e.kcal, 0)` sobre
// estos campos y un solo NaN propaga al prompt entero.

export interface FoodEstimate {
  kcal: number;
  prot: number;
  carbs: number;
  fat: number;
}

export interface FoodLogEntryInput {
  desc: string;
  kcal: number;
  prot: number;
  carbs: number;
  fat: number;
  source: 'manual' | 'ai';
}

/**
 * Parsea la respuesta cruda de la IA → FoodEstimate validada o null.
 *
 * Tolerante a:
 * - Fences ```json ... ``` o ``` ... ```
 * - Espacios alrededor
 *
 * Rechaza (devuelve null):
 * - JSON inválido (parse error)
 * - Campos faltantes
 * - NaN, Infinity, valores no numéricos
 * - kcal negativo o > 10000 (clamp duro)
 * - prot/carbs/fat negativos
 */
export function parseFoodEstimate(raw: string): FoodEstimate | null {
  if (typeof raw !== 'string') return null;

  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  if (!cleaned) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;

  const kcal = obj.kcal;
  const prot = obj.prot;
  const carbs = obj.carbs;
  const fat = obj.fat;

  if (!isValidNumber(kcal) || !isValidNumber(prot) || !isValidNumber(carbs) || !isValidNumber(fat)) {
    return null;
  }

  if (kcal < 0 || kcal > 10000) return null;
  if (prot < 0 || carbs < 0 || fat < 0) return null;

  return { kcal, prot, carbs, fat };
}

function isValidNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Construye el shape que addFoodLog espera (sin id/date — los pone el store).
 *
 * - Clamp kcal a [0, 10000] como red de seguridad (parseFoodEstimate ya
 *   filtra, pero llamadores manuales podrían pasar números fuera de rango).
 * - kcal redondeado a integer (la columna SQL es integer).
 * - prot/carbs/fat redondeados a 1 decimal (la columna SQL es numeric(6,1)).
 */
export function sanitizeFoodEntry(
  estimate: FoodEstimate,
  desc: string,
  source: 'manual' | 'ai',
): FoodLogEntryInput {
  return {
    desc,
    kcal: Math.max(0, Math.min(10000, Math.round(estimate.kcal))),
    prot: roundTo1(Math.max(0, estimate.prot)),
    carbs: roundTo1(Math.max(0, estimate.carbs)),
    fat: roundTo1(Math.max(0, estimate.fat)),
    source,
  };
}

function roundTo1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ─────────────────────────────────────────────────────────────────────────────
// NUTRITION-N4 · INTEGRIDAD ATWATER de un estimate de IA (autoridad ÚNICA de coherencia).
//
// El estimate ya pasó parseFoodEstimate (shape/finite/rango). Esta capa decide si además es COHERENTE.
// NO modifica ningún valor: sólo emite un veredicto. Filosofía: aceptar comida REAL aunque 4/4/9 no sea
// exacto (fibra, polioles, almidón resistente, alcohol, etiquetado), y rechazar SOLO lo físicamente
// imposible. `source:'ai'` se endurece; `source:'manual'` (determinista desde nutritionDB) NO.
// ─────────────────────────────────────────────────────────────────────────────
export type FoodEstimateVerdict =
  | { status: 'PASS' }
  | { status: 'WARN'; reason: string }
  | { status: 'REJECT'; reason: string };

/**
 * Veredicto de integridad de un FoodEstimate. Puro, determinista, NO muta el input.
 *  · manual → PASS (ya es determinista; no se endurece).
 *  · 0/0/0/0 → PASS (ayuno / agua / café negro / bebidas sin calorías).
 *  · REJECT sólo por IMPOSIBILIDAD: kcal por debajo de la energía MÍNIMA de los macros, calculada con un
 *    piso conservador de 2 kcal/g en carbohidratos (tolera fibra/polioles/almidón resistente); grasa (9) y
 *    proteína (4) no se pueden abaratar. Nunca se rechaza por kcal ALTAS (el alcohol las eleva legítimamente).
 *  · WARN (se guarda igual) por incoherencia alta hacia arriba o porción única enorme.
 */
export function validateFoodEstimateIntegrity(est: FoodEstimate, source: 'manual' | 'ai'): FoodEstimateVerdict {
  const { kcal: K, prot: P, carbs: C, fat: F } = est;
  if (source === 'manual') return { status: 'PASS' };
  const macroKcal = 4 * P + 4 * C + 9 * F;
  if (macroKcal === 0 && K === 0) return { status: 'PASS' };
  const minKcal = 4 * P + 2 * C + 9 * F;                     // energía mínima plausible (carbos = fibra 2 kcal/g)
  const tol = Math.max(20, 0.15 * minKcal);
  if (K < minKcal - tol) {
    return { status: 'REJECT', reason: 'kcal por debajo de la energía mínima de los macros (imposible)' };
  }
  if (K > macroKcal + Math.max(250, 0.5 * macroKcal) || K > 4000) {
    return { status: 'WARN', reason: 'kcal muy por encima de los macros o porción única muy grande' };
  }
  return { status: 'PASS' };
}
