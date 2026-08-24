// MINDSET-1 · Migración idempotente de reflexiones legacy (localStorage) → DB.
// - mapea título localizado → dimensionId estable
// - matchea texto de pregunta → questionIndex (si existe en el banco), si no -1
// - preserva el texto original (snapshot) y la respuesta tal cual (trim)
// - clasifica seguridad al migrar
// - inserta con "remoto gana" (ignoreDuplicates) → sin duplicados, sin pérdida
// Re-ejecutar es no-op (marker + ON CONFLICT DO NOTHING).
import { getHSMBank } from '../data/hsmBank';
import {
  dimensionIdFromLegacyTitle, dimensionIndexFromId, questionKeyFor,
  normalizeTitle, type HSMDimensionKey,
} from '../data/hsmDimensions';
import { classifySafety } from './hsmSafety';
import { insertReflectionIfAbsent, type HSMReflection } from './hsmRepository';

export interface LegacyReflection { date: string; dimension: string; question: string; response: string }

// Banks (referencia estable). Se buscan ambos idiomas para el match de pregunta.
const BANK_ES = getHSMBank('es');
const BANK_EN = getHSMBank('en');

function findQuestionIndex(dimensionId: HSMDimensionKey, questionText: string): number {
  const idx = dimensionIndexFromId(dimensionId);
  if (idx < 0) return -1;
  const target = normalizeTitle(questionText);
  for (const bank of [BANK_ES, BANK_EN]) {
    const qi = bank[idx]?.questions.findIndex(q => normalizeTitle(q) === target);
    if (qi !== undefined && qi >= 0) return qi;
  }
  return -1;
}

/** Mapea una reflexión legacy a la forma estable. PURO. */
export function legacyToReflection(legacy: LegacyReflection): HSMReflection {
  const dimensionId = dimensionIdFromLegacyTitle(legacy.dimension);
  const questionIndex = findQuestionIndex(dimensionId, legacy.question);
  const questionKey = questionKeyFor(dimensionId, questionIndex, legacy.question);
  return {
    date: legacy.date,
    dimensionId,
    questionIndex,
    questionKey,
    question: legacy.question ?? '',
    response: (legacy.response ?? '').trim(),
    safetyLevel: classifySafety(legacy.response ?? ''),
  };
}

/** Dedup por (date, questionKey) dentro del lote — la primera gana. */
export function dedupeLegacy(rs: HSMReflection[]): HSMReflection[] {
  const seen = new Set<string>();
  const out: HSMReflection[] = [];
  for (const r of rs) {
    const k = `${r.date}|${r.questionKey}`;
    if (seen.has(k)) continue;
    seen.add(k); out.push(r);
  }
  return out;
}

/**
 * Corre la migración. Devuelve { ok, migrated, total }. `ok=false` si algún
 * insert requerido falló (el caller NO marca la migración completa → reintenta).
 * `insertFn` inyectable para tests.
 */
export async function runHSMMigration(
  legacy: LegacyReflection[],
  insertFn: (r: HSMReflection) => Promise<boolean> = insertReflectionIfAbsent,
): Promise<{ ok: boolean; migrated: number; total: number }> {
  const mapped = dedupeLegacy((legacy ?? []).filter(l => l && l.response && l.response.trim()).map(legacyToReflection));
  let migrated = 0, allOk = true;
  for (const r of mapped) {
    let ok = false;
    try { ok = await insertFn(r); } catch { ok = false; }
    if (ok) migrated++; else allOk = false;
  }
  return { ok: allOk, migrated, total: mapped.length };
}
