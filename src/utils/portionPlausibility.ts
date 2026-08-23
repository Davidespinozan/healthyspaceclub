// ─────────────────────────────────────────────────────────────────────────────
// NUTRITION-N1 · HUMAN PORTION PLAUSIBILITY BOUNDS.
//
// El solver de nutrición (planEngine.solve) sube la porción de un ingrediente `principal` para cuadrar
// macros. Hoy `ingBounds` acota bien ALMIDONES (GRAM_MAX) y CONTABLES (PIECE_MAX), pero FRUTA / ACEITES /
// NUECES / LÁCTEOS / GRANOLA quedan sin techo humano absoluto (fruta cae al default hi ≈ g0×3) → el solver
// podía cerrar carbohidrato con "2–3 tazas de fresas". Matemáticamente válido, humanamente absurdo.
//
// Esta capa instala un TECHO HUMANO por FAMILIA de alimento (no 200 ids): un `hardMaxG` que el solver
// JAMÁS puede exceder, y un `preferredMaxG` (aún dormido; N2 lo usará para reseleccionar plato antes de
// deformarlo). PURA / determinista / sin estado. No conoce metas calóricas, macros, ni el solver — solo
// responde "¿cuánto de este alimento comería de verdad una persona?".
//
// PRIORIDAD DE AUTORIDAD (N1): plausibilidad humana > ajuste exacto de calorías. Preferimos 1980 kcal con
// comida normal sobre 2000 kcal con 2.5 tazas de fresas.
//
// FUENTE de los valores (sin números mágicos):
//   · SME (foodEquivalents.ts) = "1 equivalente/porción" de cada alimento.
//   · cupGrams/sauce de planEngine = gramos por taza/cda ya usados para el DISPLAY.
//   · Regla: hardMax ≈ 1.5–1.8× una porción estándar (grande-pero-aceptable); preferredMax ≈ 1.2–1.4×.
// Composición en ingBounds: hi = min(hi_actual, hardMaxG) ANTES del guard `max(hi, g0)` → nunca afloja un
// tope existente y nunca encoge por debajo de la receta base de Magaly (g0). Proteínas (pollo/res/pescado/
// huevo/atún/tofu) NO se listan: ya están acotadas por `ing.max`/PIECE_MAX (N1 no las toca).
// ─────────────────────────────────────────────────────────────────────────────

export interface PortionBounds {
  family: string;
  preferredMaxG: number;   // porción grande pero normal; > esto = "grande" (N2 decidirá reseleccionar)
  hardMaxG: number;        // techo absoluto; el solver nunca lo cruza
  source: string;          // de dónde sale el número (SME / cupGrams / default de ingeniería)
}

// Familias en ORDEN de especificidad (la primera que matchea gana): las más específicas primero
// (crema de cacahuate antes que "cacahuate"; frutas concretas antes que genéricas).
interface Family { key: string; rx: RegExp; preferredMaxG: number; hardMaxG: number; source: string }
const FAMILIES: Family[] = [
  // ── Leche PRIMERO: "leche de almendra/coco" es una BEBIDA, no nueces — captúrala como líquido antes de
  //    que /almendra/ la mande a nutsSeeds. hard por encima de las recetas base grandes del banco (~336 g).
  { key: 'milk', rx: /\bleche\b/i,
    preferredMaxG: 240, hardMaxG: 360, source: 'cupGrams leche 1 tz=240g; hard ≈ 1.5 taza (cubre bases del banco)' },
  // ── Grasas / energía densa (error simétrico: poco gramaje = muchas kcal) ──
  { key: 'nutButter', rx: /crema de (cacahuate|man[ií]|almendra|avellana)|mantequilla de (man[ií]|cacahuate|almendra)/i,
    preferredMaxG: 24, hardMaxG: 40, source: 'SME ~1 cda(16g); hard ≈ 2.5 cda' },
  { key: 'nutsSeeds', rx: /cacahuate|almendra|nuez|nueces|pistache|avellana|maran[ñn][oó]n|semilla|pepita|ch[ií]a|linaza|girasol|aj[oó]njol[ií]/i,
    preferredMaxG: 30, hardMaxG: 45, source: 'SME nuez ~1 porción(28g); hard ≈ 1.6 porción' },
  { key: 'oil', rx: /\baceite\b|\bmantequilla\b(?! de)|manteca|ghee/i,
    preferredMaxG: 12, hardMaxG: 22, source: 'SME 1 cdita(5g)/cocina 1 cda(15g); hard ≈ 1.5 cda' },
  { key: 'sweetener', rx: /\bmiel\b|mermelada|jarabe|cajeta|\bmelaza\b|azúcar|azucar/i,
    preferredMaxG: 20, hardMaxG: 35, source: '1 cda miel≈21g; hard ≈ 1.7 cda' },
  { key: 'granola', rx: /granola/i,
    preferredMaxG: 50, hardMaxG: 80, source: 'cupGrams granola tz≈122g; hard ≈ ⅔ taza' },
  // ── Fruta (el caso bandera: "2–3 tazas de fresas") ──
  { key: 'berries', rx: /fresa|frambuesa|zarzamora|\bmora\b|ar[aá]ndano|cereza|blueberr|strawberr/i,
    preferredMaxG: 195, hardMaxG: 255, source: 'SME/cupGrams 1 tz=150g; hard ≈ 1.7 taza' },
  { key: 'grapes', rx: /\buva\b|\buvas\b/i,
    preferredMaxG: 150, hardMaxG: 210, source: 'cupGrams uva 1 tz=150g (azúcar densa); hard ≈ 1.4 taza' },
  { key: 'cutFruit', rx: /mango|pi[nñ]a|papaya|sand[ií]a|mel[oó]n/i,
    preferredMaxG: 210, hardMaxG: 290, source: 'cupGrams 1 tz=160g; hard ≈ 1.8 taza' },
  { key: 'wholeFruit', rx: /pl[aá]tano(?! macho)|banana|manzana|naranja|\bpera\b|durazno|kiwi|guayaba|mandarina|toronja|ciruela|higo/i,
    preferredMaxG: 160, hardMaxG: 260, source: '~1 pieza 120–150g; hard ≈ 2 piezas' },
  // ── Lácteos ──
  { key: 'yogurt', rx: /yogur|yoghur|yogh?urt/i,
    preferredMaxG: 245, hardMaxG: 380, source: 'cupGrams yogur 1 tz=245g; hard ≈ 1.55 taza (cubre bowls base)' },
  { key: 'cheese', rx: /queso|panela|reques[oó]n|cottage/i,
    preferredMaxG: 60, hardMaxG: 160, source: 'AOA SME; hard cubre la base máx de queso del banco' },
];

/**
 * Techo humano de un ingrediente por su NOMBRE (`nv`). Devuelve null si el alimento no pertenece a una
 * familia acotada aquí (proteínas/almidones/verduras/condimentos → los rige la lógica existente). Puro.
 */
export function portionBoundsFor(nv: string): PortionBounds | null {
  const name = (nv || '').toLowerCase();
  for (const f of FAMILIES) {
    if (f.rx.test(name)) return { family: f.key, preferredMaxG: f.preferredMaxG, hardMaxG: f.hardMaxG, source: f.source };
  }
  return null;
}

/**
 * NUTRITION-N2 · límite de gramos PREFERIDO (rango humano normal) de un ingrediente, o null si no
 * pertenece a una familia acotada. Es una señal de SELECCIÓN (capacidad plausible del platillo), NUNCA
 * un techo del solver — el solver sigue usando hardMaxG (N1). Puro.
 */
export function preferredGramLimit(nv: string): number | null {
  return portionBoundsFor(nv)?.preferredMaxG ?? null;
}

export type PortionVerdict = 'PASS' | 'LARGE' | 'HARD_FAIL';

/**
 * Diagnóstico de una porción final (para tests / auditoría; NO alerta en runtime/UI). PASS ≤ preferred,
 * LARGE ≤ hard, HARD_FAIL > hard. Alimentos sin familia acotada → PASS (no es competencia de N1).
 */
export function validatePortionPlausibility(nv: string, grams: number): PortionVerdict {
  const b = portionBoundsFor(nv);
  if (!b) return 'PASS';
  if (grams > b.hardMaxG + 0.5) return 'HARD_FAIL';   // +0.5 tolera el redondeo del solver
  if (grams > b.preferredMaxG) return 'LARGE';
  return 'PASS';
}
