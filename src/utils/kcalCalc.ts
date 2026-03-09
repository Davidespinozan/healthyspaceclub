import { nutritionDB } from '../data/nutritionDB';
import { smeNutritionDB, stripAccents } from './smeCalc';

// ── Conversión de fracciones ───────────────────────────────────────────────
const FRACTIONS: Record<string, number> = {
  '½': 1 / 2, '⅓': 1 / 3, '¼': 1 / 4, '¾': 3 / 4,
  '⅔': 2 / 3, '⅙': 1 / 6, '⅜': 3 / 8,
};

function parseAmount(s: string): number {
  s = s.trim();
  // Número entero + fracción unicode: "1 ½"
  const mixed = s.match(/^(\d+)\s*([½⅓¼¾⅔⅙⅜])$/);
  if (mixed) return parseInt(mixed[1]) + (FRACTIONS[mixed[2]] ?? 0);
  // Solo fracción unicode
  if (FRACTIONS[s] !== undefined) return FRACTIONS[s];
  // Fracción con barra: "1/3"
  const slash = s.match(/^(\d+)\/(\d+)$/);
  if (slash) return parseInt(slash[1]) / parseInt(slash[2]);
  // Decimal o entero
  return parseFloat(s) || 0;
}

// ── Normalización del string de porción ───────────────────────────────────
function normalize(raw: string): string {
  return raw
    .toLowerCase()
    // Unifica fracciones unicode con espaciado
    .replace(/([½⅓¼¾⅔⅙⅜])/g, ' $1 ')
    // Quita paréntesis y su contenido (notas de preparación)
    .replace(/\(.*?\)/g, '')
    // Strip prefijos de instrucción
    .replace(/^(acompa[ñn]a(?: con)?|mezcla|empaniza(?: con)?|una vez (?:cocida?|listo?).*?(?:agrega|sírvete)|salpimentar?(?: al gusto)?(?:.*?)?)\s+/i, '')
    // Normaliza unidades a su forma corta
    .replace(/\btazas?\b/g, 'tz')
    .replace(/\brebanadas?\b/g, 'reb')
    .replace(/\blatas?\b(?!\w)/g, 'lata')
    .replace(/\bpiezas?\b/g, 'pz')
    .replace(/\bcucharaditas?\b/g, 'cdita')
    .replace(/\bcucharadas?\b/g, 'cda')
    .replace(/\bcdtas?\b/g, 'cdita')
    .replace(/\bcdas\b/g, 'cda')
    .replace(/\bcditas\b/g, 'cdita')
    .replace(/\brollitos?\b/g, 'reb')
    .replace(/\bgr\b/g, 'g')
    // Quita "de" suelto entre unidad e ingrediente
    .replace(/\b(g|tz|pz|cda|cdita|reb|lata)\s+de\s+/g, '$1 ')
    // Strip frases de preparación que no forman parte del nombre del alimento
    .replace(/\b(?:hech[ao]s? en casa|hech[ao]s? en el momento|al gusto|sin az[uú]car|baj[ao] en grasa|sin grasa|desgranado)\b/g, '')
    // Normaliza variantes de "aderezo de tu preferencia / del recetario" a la clave canónica
    .replace(/aderezo\s+(?:de\s+(?:tu\s+)?preferencia|del\s+recetario|elige.*recetario.*|tu\s+favorit[oa].*)\b.*/g, 'aderezo del recetario')
    // Normaliza "porción(es) de fruta" (con o sin acento) para que haga match en DB
    .replace(/porci\u00f3?n(?:es)?\s+de\s+fruta/g, 'porciones de fruta')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Limpia el nombre del ingrediente de sufijos de preparación ────────────
// p.ej. "salmón a la plancha con salsa teriyaki" → "salmón"
function cleanIngredient(ing: string): string {
  return ing
    // Quita " con ..." (salsa, aderezos, guarnición que sigue al ingrediente principal)
    .replace(/\s+con\s+.*$/, '')
    // Quita " a la ...", " al ..." (métodos de cocción)
    .replace(/\s+a\s+la\s+\S+.*$/, '')
    .replace(/\s+al\s+(?:vapor|horno|sart[eé]n|saz[oó]n|limón|gusto).*$/, '')
    // Quita descriptores de textura/presentación al final
    .replace(/\s+(?:salteado[as]?|cocido[as]?|horneado[as]?|tostado[as]?|deshebrado[as]?|desmenuzado[as]?|salpimentado[as]?|rallado[as]?|picado[as]?|en\s+(?:cubos|tiras|rodajas|l[aá]minas|mitades)|magro[as]?)\s*$/, '')
    .trim();
}

// ── Busca el ingrediente en la DB (mayor coincidencia primero) ─────────────
// 1. Sistema Mexicano de Equivalentes 4ª Ed. (fuente primaria — cooked/ready to eat)
// 2. nutritionDB (fallback para alimentos no cubiertos por el SME)
// Solo fusiona las unidades cuando AMBAS fuentes coincidieron con el MISMO
// ingrediente (una clave es sub-cadena de la otra). Si coincidieron con
// ingredientes distintos, se usa la clave más específica (más larga).
function findEntry(text: string) {
  const noAccent = stripAccents(text);

  let smeEntry: (typeof smeNutritionDB)[string] | null = null;
  let smeMatchKey = '';
  for (const key of Object.keys(smeNutritionDB).sort((a, b) => b.length - a.length)) {
    if (noAccent.includes(key)) { smeEntry = smeNutritionDB[key]; smeMatchKey = key; break; }
  }

  let dbEntry: (typeof nutritionDB)[string] | null = null;
  let dbMatchKey = '';
  for (const key of Object.keys(nutritionDB).sort((a, b) => b.length - a.length)) {
    if (text.includes(key)) { dbEntry = nutritionDB[key]; dbMatchKey = key; break; }
  }

  if (smeEntry && dbEntry) {
    // Fusionar solo si las claves son compatibles (hacen referencia al mismo alimento).
    // Requiere: (a) una clave es sub-cadena de la otra, Y (b) la clave más corta es al
    // menos 60 % de la larga — evita que "soya" (4) subsuma "salsa soya" (9) o que
    // "arroz" (5) subsuma "arroz cocido" (12), etc.
    const shorter = Math.min(smeMatchKey.length, dbMatchKey.length);
    const longer  = Math.max(smeMatchKey.length, dbMatchKey.length);
    const compatible =
      (smeMatchKey.includes(dbMatchKey) || dbMatchKey.includes(smeMatchKey)) &&
      shorter / longer >= 0.6;
    if (compatible) {
      return { kcal: smeEntry.kcal, units: { ...dbEntry.units, ...smeEntry.units } };
    }
    // Claves incompatibles → la más específica (más larga) gana
    return smeMatchKey.length >= dbMatchKey.length ? smeEntry : dbEntry;
  }
  return smeEntry ?? dbEntry ?? null;
}

// ── Gramos por defecto para cucharada / cucharadita ──────────────────────
const DEFAULT_UNIT_G: Record<string, number> = {
  cda:   15,
  cdita: 5,
  g:     1,
};

// Patrón de cantidad: "2", "½", "1 ½", "1/3", "0.5"
const AMT_PAT = '((?:\\d+\\s*)?[½⅓¼¾⅔⅙⅜]|\\d+(?:\\.\\d+)?(?:/\\d+)?)';
const UNIT_PAT = '(g|tz|pz|cda|cdita|reb|lata)';
const RE_AMT_UNIT_ING = new RegExp(`^${AMT_PAT}\\s+${UNIT_PAT}\\s+(.+)$`);
const RE_AMT_ING      = new RegExp(`^${AMT_PAT}\\s+(.+)$`);

// ── Porción por defecto cuando no hay cantidad (bare ingredient) ──────────
// Para condimentos/salsas (tienen cda) usa 3 cda (45 g).
// Para verduras/frutas (tienen tz) usa ½ tz.
// Para piezas usa 1 pz. Para el resto, 2 cda (30 g).
function calcBareIngredient(text: string): number {
  const cleaned = cleanIngredient(text);
  const entry = findEntry(cleaned) ?? findEntry(text);
  if (!entry) return 0;
  if (entry.units?.cda) return Math.round((entry.kcal * entry.units.cda * 3) / 100); // 3 cda = porción típica de salsa/aderezo
  if (entry.units?.tz)  return Math.round((entry.kcal * entry.units.tz * 0.5) / 100);
  if (entry.units?.pz)  return Math.round((entry.kcal * entry.units.pz) / 100);
  return Math.round((entry.kcal * 30) / 100); // ~2 cda default
}

// ── Calcula kcal de un string de porción ─────────────────────────────────
export function calcPortionKcal(raw: string): number {
  const s = normalize(raw);

  // ── Nivel 1a: {cantidad} {unidad} {ingrediente} ──────────────────────────
  const m = s.match(RE_AMT_UNIT_ING);
  if (m) {
    const rawIng = m[3];
    // Si rawIng tiene coma es una lista ("½ tz yogurt, 1 cdita almendras…");
    // pasar directamente a nivel 4 para que cada ítem se calcule por separado.
    if (!rawIng.includes(',')) {
      const amount = parseAmount(m[1]);
      const unit   = m[2] as 'g' | 'tz' | 'pz' | 'cda' | 'cdita' | 'reb' | 'lata';
      const ingredient = cleanIngredient(rawIng);
      const entry = findEntry(ingredient) ?? findEntry(rawIng);
      if (entry) {
        let grams: number;
        if (unit === 'g') {
          grams = amount;
        } else if (entry.units?.[unit] !== undefined) {
          grams = amount * entry.units[unit]!;
        } else if (DEFAULT_UNIT_G[unit] !== undefined) {
          grams = amount * DEFAULT_UNIT_G[unit];
        } else {
          grams = 0;
        }
        if (grams > 0) return Math.round((entry.kcal * grams) / 100);
      }
    }
  }

  // ── Nivel 1b: {cantidad} {ingrediente} (unidad implícita pz) ─────────────
  const m2 = s.match(RE_AMT_ING);
  if (m2) {
    const amount = parseAmount(m2[1]);
    const rawIng = m2[2];

    // Nivel 2: "A o B" con cantidad → intentar cada opción
    const oIdx = rawIng.search(/\s+o\s+/);
    if (oIdx >= 0) {
      const a = calcPortionKcal(`${m2[1]} ${rawIng.slice(0, oIdx)}`);
      const b = calcPortionKcal(`${m2[1]} ${rawIng.slice(oIdx).replace(/^\s+o\s+/, '')}`);
      return a || b;
    }

    // Si rawIng tiene coma, es una lista — dejar que nivel 4 lo maneje
    if (!rawIng.includes(',')) {
      const ingredient = cleanIngredient(rawIng);
      const entry = findEntry(ingredient) ?? findEntry(rawIng);
      if (entry?.units?.pz) {
        return Math.round((entry.kcal * amount * entry.units.pz) / 100);
      }
      // Si tiene tz pero no pz (ej. "2 frutos rojos") → tratar como pz genérico de ~20g
      if (entry?.units?.tz) {
        return Math.round((entry.kcal * amount * 20) / 100);
      }
      if (!/\s+y\s+/.test(rawIng)) return 0;
    }
  }

  // ── Nivel 3: "A o B" sin cantidad → intentar cada opción ─────────────────
  // También cubre "2 pz tortillas o ½ tz arroz" que no matcheó nivel 1 por el " o "
  const oPattern = /^(.+?)\s+o\s+(.+)$/;
  const oMatch = s.match(oPattern);
  if (oMatch) {
    const a = calcPortionKcal(oMatch[1]);
    const b = calcPortionKcal(oMatch[2]);
    return a || b;
  }

  // ── Nivel 4: lista de ingredientes separada por comas/" y " (guarniciones) ─
  if (s.includes(',') || /\s+y\s+/.test(s)) {
    const parts = s.split(/[,]\s*|\s+y\s+/).map(p => p.trim()).filter(p => p.length > 2);
    // Usa calcPortionKcal para cada parte (así se parsean cantidades como "2 reb jamón")
    // Guard: si la parte contiene coma no la reprocesamos para evitar bucles
    const vals = parts.map(p => p.includes(',') ? calcBareIngredient(p) : calcPortionKcal(p));
    const total = vals.reduce((a, b) => a + b, 0);
    if (total > 0) return total;
  }

  // ── Nivel 5: ingrediente solo sin cantidad ───────────────────────────────
  return calcBareIngredient(s);
}

// ── Calcula kcal total de una comida (array de porciones) ─────────────────
// Los snacks vienen como un solo string con " + " como separador,
// p.ej. "2 reb pan + 1 cda crema de cacahuate + 2 tz mango"
// También puede haber un prefijo tipo "Sandwich: ..." — se descarta.
export function calcMealKcal(portions: string[]): number {
  return portions.reduce((sum, p) => {
    // Quitar prefijo de etiqueta: "Sandwich: ..." → "..."
    const cleaned = p.replace(/^[^:]+:\s*/, '');
    // Dividir por " + " para snacks con múltiples sub-items
    const subItems = cleaned.split(/\s+\+\s+/);
    return sum + subItems.reduce((s, sub) => s + calcPortionKcal(sub), 0);
  }, 0);
}

// ── Calcula kcal del día completo ─────────────────────────────────────────
export function calcDayKcal(meals: { portions: string[] }[]): number {
  return meals.reduce((sum, m) => sum + calcMealKcal(m.portions), 0);
}

// ── Formatea porciones para display (expande abreviaciones, corrige plurales) ─
const _AMT = '((?:\\d+(?:\\.\\d+)?|[½⅓¼¾⅔⅙⅜])(?:\\s+[½⅓¼¾⅔⅙⅜])?)';
const _pl = (n: string, sg: string, pl: string) => parseAmount(n) === 1 ? sg : pl;

export function formatPortion(raw: string): string {
  return raw
    // tz / taza / tazas → taza(s)
    .replace(new RegExp(`${_AMT}\\s+(?:tz|tazas?)\\b`, 'g'),        (_, n) => `${n} ${_pl(n, 'taza', 'tazas')}`)
    // pz / pieza / piezas → pieza(s)
    .replace(new RegExp(`${_AMT}\\s+(?:pz|piezas?)\\b`, 'g'),       (_, n) => `${n} ${_pl(n, 'pieza', 'piezas')}`)
    // reb / rebanada / rebanadas → rebanada(s)
    .replace(new RegExp(`${_AMT}\\s+(?:reb|rebanadas?)\\b`, 'g'),   (_, n) => `${n} ${_pl(n, 'rebanada', 'rebanadas')}`)
    // cdas? / cucharadas? → cucharada(s)  [before cdita to avoid partial match]
    .replace(new RegExp(`${_AMT}\\s+(?:cdas?|cucharadas?)\\b`, 'g'),(_, n) => `${n} ${_pl(n, 'cucharada', 'cucharadas')}`)
    // cditas? / cucharaditas? → cucharadita(s)
    .replace(new RegExp(`${_AMT}\\s+(?:cditas?|cucharaditas?)\\b`, 'g'), (_, n) => `${n} ${_pl(n, 'cucharadita', 'cucharaditas')}`)
    // lata / latas → lata(s)
    .replace(new RegExp(`${_AMT}\\s+latas?\\b`, 'g'),               (_, n) => `${n} ${_pl(n, 'lata', 'latas')}`);
}
