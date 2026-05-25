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
