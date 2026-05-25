// Lógica pura del sync de meal_progress — Lote Sync-2.
//
// El estado de progreso del día vive en DOS Records paralelos:
// - mealChecks:        Record<key, boolean>   (los ✓ del plan)
// - mealResolvedByLog: Record<key, true>      (los dot ámbar)
// donde key = `meal-${YYYY-MM-DD}-${meal_index}`.
//
// Supabase persiste en tabla meal_progress (una fila por user_id+date+meal_index
// con AMBOS flags). Este módulo tiene 3 funciones puras testeadas:
//
// 1. extractDateAndIndex(key): parser del key del Record → { date, index }
// 2. mergeMealProgress(local, remote): merge "true wins" al login.
//    Un check hecho en cualquier device NUNCA se pierde por sync.
// 3. pruneMealProgressFromDate(records, fromDate): limpiar hoy+futuro
//    cuando se regenera el plan (los índices del plan v1 no aplican
//    al plan v2, la historia pasada sí queda intacta).

export interface MealProgressRow {
  date: string;       // YYYY-MM-DD
  meal_index: number; // 0..9
  checked: boolean;
  resolved_by_log: boolean;
}

export interface MealProgressRecords {
  mealChecks: Record<string, boolean>;
  mealResolvedByLog: Record<string, true>;
}

/**
 * Extrae fecha + índice de un key `meal-${date}-${index}`.
 * date puede contener guiones (YYYY-MM-DD tiene 2), así que parseamos
 * desde el final: el último '-' separa el índice del resto.
 *
 * Devuelve null si el key no matchea el patrón esperado (ej. legacy
 * `shop-${i}` que también usa mealChecks).
 */
export function extractDateAndIndex(key: string): { date: string; index: number } | null {
  if (!key.startsWith('meal-')) return null;
  const rest = key.slice(5); // remove 'meal-' prefix
  const lastDash = rest.lastIndexOf('-');
  if (lastDash <= 0 || lastDash >= rest.length - 1) return null;
  const date = rest.slice(0, lastDash);
  const indexStr = rest.slice(lastDash + 1);
  const index = parseInt(indexStr, 10);
  if (!Number.isFinite(index) || index < 0) return null;
  // Validación leve del shape de la fecha (10 chars con guiones en pos 4 y 7)
  if (date.length !== 10 || date[4] !== '-' || date[7] !== '-') return null;
  return { date, index };
}

/**
 * Mergea progreso local con remote — política "true wins".
 *
 * Para cada (date, meal_index) que aparece en local O en remote:
 * - merged.checked = local.checked OR remote.checked
 * - merged.resolved_by_log = local.resolved_by_log OR remote.resolved_by_log
 *
 * Razón: un gesto explícito del user (marcar ✓ o registrar comida) NO
 * debería desaparecer porque otro device venga con un valor stale.
 * Costo: una uncheck operation puede ser revertida por sync — aceptable,
 * el user puede volver a destildar.
 *
 * Devuelve tanto los Records merged (para setState local) como las filas
 * que necesitan push a Supabase (las que difieren del remote actual).
 */
export function mergeMealProgress(
  local: MealProgressRecords,
  remote: MealProgressRow[],
): {
  merged: MealProgressRecords;
  toPush: MealProgressRow[];
} {
  const mealChecks: Record<string, boolean> = {};
  const mealResolvedByLog: Record<string, true> = {};
  const toPush: MealProgressRow[] = [];

  // Index remote por key para lookup O(1)
  const remoteByKey = new Map<string, MealProgressRow>();
  for (const row of remote) {
    remoteByKey.set(`meal-${row.date}-${row.meal_index}`, row);
  }

  // Conjunto de keys: unión de local + remote
  const allKeys = new Set<string>([
    ...Object.keys(local.mealChecks),
    ...Object.keys(local.mealResolvedByLog),
    ...remoteByKey.keys(),
  ]);

  for (const key of allKeys) {
    const parsed = extractDateAndIndex(key);
    if (!parsed) continue; // ignorar keys que no son de meal_progress (ej. shop-)

    const remoteRow = remoteByKey.get(key);
    const localChecked = !!local.mealChecks[key];
    const localResolved = !!local.mealResolvedByLog[key];
    const remoteChecked = remoteRow?.checked ?? false;
    const remoteResolved = remoteRow?.resolved_by_log ?? false;

    const mergedChecked = localChecked || remoteChecked;
    const mergedResolved = localResolved || remoteResolved;

    if (mergedChecked) mealChecks[key] = true;
    if (mergedResolved) mealResolvedByLog[key] = true;

    // Push a remote si el remote no tiene esta fila O si el merged
    // difiere del remote (ej. local tenía un check que remote no sabía)
    const needsPush =
      !remoteRow ||
      mergedChecked !== remoteChecked ||
      mergedResolved !== remoteResolved;

    if (needsPush && (mergedChecked || mergedResolved)) {
      toPush.push({
        date: parsed.date,
        meal_index: parsed.index,
        checked: mergedChecked,
        resolved_by_log: mergedResolved,
      });
    }
  }

  return { merged: { mealChecks, mealResolvedByLog }, toPush };
}

/**
 * Filtra los Records dejando SOLO entradas con fecha < fromDate.
 * Usado al regenerar el plan: los índices del plan viejo no aplican al
 * plan nuevo, así que limpiamos hoy+futuro. La historia pasada queda
 * intacta (era válida contra el plan que estaba vigente entonces).
 */
export function pruneMealProgressFromDate(
  records: MealProgressRecords,
  fromDate: string,
): MealProgressRecords {
  const mealChecks: Record<string, boolean> = {};
  const mealResolvedByLog: Record<string, true> = {};

  for (const [key, value] of Object.entries(records.mealChecks)) {
    const parsed = extractDateAndIndex(key);
    if (!parsed || parsed.date < fromDate) {
      mealChecks[key] = value;
    }
  }

  for (const [key, value] of Object.entries(records.mealResolvedByLog)) {
    const parsed = extractDateAndIndex(key);
    if (!parsed || parsed.date < fromDate) {
      mealResolvedByLog[key] = value;
    }
  }

  return { mealChecks, mealResolvedByLog };
}
