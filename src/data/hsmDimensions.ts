// MINDSET-1 · Autoridad ÚNICA de identidad de dimensión HSM (estable, neutral al
// idioma). Antes la "clave" de una dimensión era su TÍTULO localizado (Identidad
// / Identity), lo que rompía el historial al cambiar ES↔EN o al renombrar. Aquí
// se fijan IDs estables + el mapeo desde títulos legacy, y una identidad estable
// de pregunta (question_key). Módulo PURO: sin dependencias de React ni del banco
// (hsmBank importa solo el TIPO de aquí) → sin ciclos, testeable.

export const HSM_DIMENSION_IDS = [
  'identity', 'calling', 'purpose', 'goals', 'discipline',
  'body', 'environment', 'emotional_control', 'resilience', 'growth',
] as const;

export type HSMDimensionId = typeof HSM_DIMENSION_IDS[number];
export type HSMDimensionKey = HSMDimensionId | 'unknown';

// Título localizado (ES y EN, en el ORDEN de HSM_DIMENSION_IDS) → id estable.
// El orden coincide con ES_BANK/EN_BANK en hsmBank.ts.
const ES_TITLES = ['Identidad', 'Vocación', 'Propósito', 'Metas', 'Disciplina', 'Cuerpo', 'Entorno y Relaciones', 'Control Emocional', 'Resiliencia', 'Evolución'] as const;
const EN_TITLES = ['Identity', 'Calling', 'Purpose', 'Goals', 'Discipline', 'Body', 'Environment & Relationships', 'Emotional Control', 'Resilience', 'Growth'] as const;

/** Normaliza para matching robusto: minúsculas, sin acentos, colapsa espacios. */
export function normalizeTitle(s: string): string {
  return (s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

const TITLE_TO_ID: Record<string, HSMDimensionId> = (() => {
  const m: Record<string, HSMDimensionId> = {};
  HSM_DIMENSION_IDS.forEach((id, i) => {
    m[normalizeTitle(ES_TITLES[i])] = id;
    m[normalizeTitle(EN_TITLES[i])] = id;
  });
  return m;
})();

/** Título legacy (ES/EN, cualquier caso/acentos) → id estable, o 'unknown'. */
export function dimensionIdFromLegacyTitle(title: string): HSMDimensionKey {
  return TITLE_TO_ID[normalizeTitle(title)] ?? 'unknown';
}

/** Índice 0..9 del id en el banco, o -1 para 'unknown'. */
export function dimensionIndexFromId(id: HSMDimensionKey): number {
  return (HSM_DIMENSION_IDS as readonly string[]).indexOf(id);
}

/** ¿Es un id estable conocido (no 'unknown')? */
export function isKnownDimensionId(id: string): id is HSMDimensionId {
  return (HSM_DIMENSION_IDS as readonly string[]).includes(id);
}

/** Hash determinista corto (djb2) para claves de preguntas legacy sin índice. */
export function stableHash(s: string): string {
  let h = 5381;
  const str = normalizeTitle(s);
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) & 0xffffffff;
  return (h >>> 0).toString(36);
}

/**
 * Identidad ESTABLE de pregunta para la unicidad en DB
 * (user_id, reflection_date, question_key):
 *   - pregunta conocida del banco → "<dimId>#<index>"
 *   - pregunta legacy/desconocida → "<dimKey>#u<hash(texto)>"  (evita colisión
 *     entre varias desconocidas del mismo día/dimensión)
 */
export function questionKeyFor(dimensionId: HSMDimensionKey, questionIndex: number, questionText: string): string {
  if (dimensionId !== 'unknown' && Number.isInteger(questionIndex) && questionIndex >= 0) {
    return `${dimensionId}#${questionIndex}`;
  }
  return `${dimensionId}#u${stableHash(questionText)}`;
}
