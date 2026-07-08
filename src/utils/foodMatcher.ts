// ─────────────────────────────────────────────────────────────────────────
// foodMatcher — resuelve un nombre de ingrediente (como venga escrito) al
// alimento del catálogo de Magaly (`foods`). Robusto a variaciones de nombre;
// NO adivina: marca lo que no puede resolver con confianza para revisión.
//
// Objetivo (David): que aunque los platillos de Magaly no traigan los nombres
// EXACTOS del catálogo, el motor los empate — y ENCUENTRE los errores (lo que
// no empata) en vez de meter basura silenciosa.
// ─────────────────────────────────────────────────────────────────────────

export interface FoodRef {
  id: string;
  name: string;      // `alimento` del catálogo
  grupo?: string;
}

export type MatchStatus = 'ok' | 'review' | 'none';

export interface MatchResult {
  foodId: string | null;
  foodName: string | null;
  confidence: number;      // 0–1
  status: MatchStatus;     // ok ≥.72 · review .48–.72 · none <.48
  reason: string;          // por qué (para depurar / revisión)
}

// ── Sinónimos semánticos que las letras NO infieren ────────────────────────
// (clave y valor normalizados). Crece conforme aparezcan casos reales.
const ALIASES: Record<string, string> = {
  'crema de cacahuate': 'mantequilla de cacahuate',
  'crema cacahuate': 'mantequilla de cacahuate',
  'crema de almendra': 'mantequilla de almendra',
  'jitomate': 'tomate',
  'jitomate bola': 'tomate',
  'elote': 'maiz',
  'ejotes': 'ejote',
  'betabel': 'remolacha',
  'chile morron': 'pimiento',
  'pimiento morron': 'pimiento',
  'camote': 'batata',
  'durazno': 'melocoton',
  'chicharo': 'guisante',
  'frijol': 'frijol',
};

// Adjetivos de preparación/estado: modifican, NO son la identidad del alimento.
const PREP_WORDS = new Set([
  'cocido', 'cocida', 'cocidos', 'cocidas', 'crudo', 'cruda', 'crudos', 'crudas',
  'asado', 'asada', 'asados', 'asadas', 'frito', 'frita', 'fritos', 'fritas',
  'horneado', 'horneada', 'horneados', 'horneadas', 'hervido', 'hervida',
  'deshebrado', 'deshebrada', 'desmenuzado', 'desmenuzada', 'molido', 'molida',
  'picado', 'picada', 'rebanado', 'rebanada', 'rallado', 'rallada',
  'salteado', 'salteada', 'tostado', 'tostada', 'fresco', 'fresca', 'frescos',
  'natural', 'naturales', 'entero', 'entera', 'enteros', 'enteras',
  'ligero', 'ligera', 'light', 'magro', 'magra', 'sin', 'piel', 'grasa',
  'al', 'a', 'la', 'de', 'del', 'con', 'en', 'y', 'o', 'su', 'gusto',
  'casero', 'casera', 'hecho', 'hecha', 'casa', 'trocitos',
  // Unidades / medidas (no son identidad del alimento)
  'g', 'gr', 'kg', 'mg', 'ml', 'l', 'pz', 'pza', 'pieza', 'piezas',
  'tz', 'taza', 'tazas', 'cda', 'cdas', 'cdita', 'cditas',
  'cucharada', 'cucharadas', 'cucharadita', 'cucharaditas',
  'reb', 'rebanada', 'rebanadas', 'lata', 'latas', 'porcion', 'porciones',
  'vaso', 'vasos', 'plato', 'taco', 'tacos',
]);

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Singulariza una palabra en español (reglas comunes + irregulares).
const IRREGULAR_SG: Record<string, string> = {
  nueces: 'nuez', peces: 'pez', lapices: 'lapiz', raices: 'raiz',
  luces: 'luz', voces: 'voz',
};
function singularize(w: string): string {
  if (IRREGULAR_SG[w]) return IRREGULAR_SG[w];
  if (w.length <= 3) return w;
  if (w.endsWith('ces')) return w.slice(0, -3) + 'z';       // nueces→nuez (por si no está en irregulares)
  if (w.endsWith('es') && !/[aeiou]es$/.test(w)) return w.slice(0, -2); // frijoles→frijol, panes→pan
  if (w.endsWith('s') && w.length > 3) return w.slice(0, -1);           // huevos→huevo
  return w;
}

// Tokens significativos, normalizados y singularizados, sin palabras de prep.
function tokenize(s: string): string[] {
  const clean = stripAccents(s.toLowerCase())
    .replace(/\([^)]*\)/g, ' ')           // quita paréntesis
    .replace(/[^a-z0-9\s]/g, ' ')         // solo letras/números
    .replace(/\s+/g, ' ')
    .trim();
  return clean.split(' ')
    .map(singularize)
    .filter(t => t.length > 1 && !PREP_WORDS.has(t) && !/^\d+$/.test(t));
}

// El sustantivo-cabeza = primer token significativo (la identidad del alimento).
function headNoun(tokens: string[]): string {
  return tokens[0] ?? '';
}

// Aplica alias si el nombre normalizado (o su cabeza) coincide.
function applyAlias(name: string): string {
  const norm = stripAccents(name.toLowerCase()).replace(/\s+/g, ' ').trim();
  if (ALIASES[norm]) return ALIASES[norm];
  return name;
}

// Puntúa qué tan bien el query empata al candidato (0–1).
function scorePair(qTokens: string[], cTokens: string[]): number {
  if (qTokens.length === 0 || cTokens.length === 0) return 0;
  const qHead = headNoun(qTokens);
  const cHead = headNoun(cTokens);
  // La cabeza debe coincidir (o una contener a la otra) — evita aguacate≠aceite.
  const headOk = qHead === cHead || qHead.includes(cHead) || cHead.includes(qHead);
  if (!headOk) return 0;

  // Jaccard de tokens.
  const qs = new Set(qTokens), cs = new Set(cTokens);
  let inter = 0;
  for (const t of qs) if (cs.has(t)) inter++;
  const union = new Set([...qTokens, ...cTokens]).size;
  const jaccard = union ? inter / union : 0;

  // Boost si la cabeza es idéntica (identidad fuerte).
  const headBoost = qHead === cHead ? 0.4 : 0.2;
  // Boost si TODO el query está contenido en el candidato (aguacate ⊂ "Aguacate Hass").
  const qInC = qTokens.every(t => cs.has(t));
  const containBoost = qInC ? 0.2 : 0;
  // Penaliza candidatos mucho más largos (ruido: "papilla de macarrones con pollo").
  const lenPenalty = Math.max(0, (cTokens.length - qTokens.length) * 0.06);

  return Math.max(0, Math.min(1, jaccard * 0.6 + headBoost + containBoost - lenPenalty));
}

const OK_THRESHOLD = 0.72;
const REVIEW_THRESHOLD = 0.48;

/** Resuelve un ingrediente al mejor alimento del catálogo, con confianza + estado. */
export function matchFood(rawName: string, foods: FoodRef[]): MatchResult {
  const aliased = applyAlias(rawName);
  const qTokens = tokenize(aliased);
  if (qTokens.length === 0) {
    return { foodId: null, foodName: null, confidence: 0, status: 'none', reason: 'sin tokens (guarnición/sazón)' };
  }

  let best: FoodRef | null = null;
  let bestScore = 0;
  for (const f of foods) {
    const s = scorePair(qTokens, tokenize(f.name));
    if (s > bestScore) { bestScore = s; best = f; }
  }

  if (!best || bestScore < REVIEW_THRESHOLD) {
    return { foodId: null, foodName: null, confidence: bestScore, status: 'none', reason: `sin match confiable (mejor ${(bestScore).toFixed(2)}${best ? ' → ' + best.name : ''})` };
  }
  const status: MatchStatus = bestScore >= OK_THRESHOLD ? 'ok' : 'review';
  return {
    foodId: best.id,
    foodName: best.name,
    confidence: bestScore,
    status,
    reason: status === 'ok' ? 'match confiable' : 'match dudoso — revisar',
  };
}

/** Reporte batch: separa lo resuelto de lo que hay que REVISAR (encuentra errores). */
export function matchReport(names: string[], foods: FoodRef[]): {
  ok: { name: string; match: MatchResult }[];
  review: { name: string; match: MatchResult }[];
  none: { name: string; match: MatchResult }[];
} {
  const ok: { name: string; match: MatchResult }[] = [];
  const review: { name: string; match: MatchResult }[] = [];
  const none: { name: string; match: MatchResult }[] = [];
  for (const name of names) {
    const m = matchFood(name, foods);
    (m.status === 'ok' ? ok : m.status === 'review' ? review : none).push({ name, match: m });
  }
  return { ok, review, none };
}
