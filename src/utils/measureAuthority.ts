// ─────────────────────────────────────────────────────────────────────────────
// MENÚ HSC V1 · BLOQUE 4 · AUTORIDAD DE MEDIDAS CASERAS (D1/D2).
//
// ¿Cuántos gramos pesa 1 taza / cda / cdita / pieza / rebanada de ESTE ingrediente? Fuentes, en orden:
//   1 · CLOSED   — decisiones ya cerradas (pasta cocida 120 g/taza, arroz cocido 188 g/taza, aceite 5 g/cdita,
//                  miel 7 g/cdita y 21 g/cda, jamón de pavo 21.33 g/rebanada). Mandan siempre.
//   2 · CATALOG  — `food_measures.csv` (SMAE), que gen_banco ahora conserva completo en `ing.m` (antes solo
//                  pieza/rebanada).
//   3 · SMAE_APP — la tabla de equivalentes SMAE que la app ya muestra (`foodEquivalents.ts`), para el mismo
//                  alimento (mapa explícito por id del catálogo, nunca por parecido de nombre).
// Si CATALOG y SMAE_APP chocan más allá de la tolerancia, NO se decide: la unidad queda en CONFLICTO, no se usa
// (el ingrediente cae a gramos) y el conflicto se reporta. Un valor físicamente implausible del catálogo (p. ej.
// «1 cda de chía = 1.71 g») tampoco se usa. 1 cda = 3 cditas es definición de la unidad, no una equivalencia nueva.
// Puro, sin estado. NO decide cómo se muestra una porción (eso es portionDisplay); solo cuánto pesa una unidad.
// ─────────────────────────────────────────────────────────────────────────────
import { BANCO, type BancoIng } from '../data/banco';
import { smeGroups } from '../data/foodEquivalents';

export type MeasureUnit = 'taza' | 'cda' | 'cdita' | 'pieza' | 'rebanada';
export type MeasureSource = 'CLOSED' | 'CATALOG' | 'SMAE_APP' | 'LEGACY_PIECE';
export interface Measure { g: number; source: MeasureSource }
export interface MeasureConflict {
  nv: string; fid: string; unit: MeasureUnit;
  kind: 'CATALOG_VS_SMAE' | 'IMPLAUSIBLE' | 'KNOWN_DEFECT';
  catalog?: number; smae?: number; diffPct?: number;
}

const UNITS: MeasureUnit[] = ['taza', 'cda', 'cdita', 'pieza', 'rebanada'];
/** Tolerancia entre fuentes. Una pieza varía con el tamaño (chica/mediana/grande) → más holgada. */
const TOL: Record<MeasureUnit, number> = { taza: 0.15, cda: 0.15, cdita: 0.15, rebanada: 0.15, pieza: 0.25 };
/** Rango físico de una cuchara llena (g). Fuera de él el dato del catálogo no es confiable. */
const PLAUSIBLE: Partial<Record<MeasureUnit, [number, number]>> = { cda: [3, 25], cdita: [1, 9] };

// ── 1 · decisiones cerradas ──────────────────────────────────────────────────
const NOT_SLICE_RE = /cuadrit|picad|molid|deshebrad|cubos|trozos/i;
const CUP_EXCLUDE_RE = /galleta|inflad|harina|tortita|crema de|leche de|congelad/i;
function closedOf(ing: Pick<BancoIng, 'nv' | 'fid'>): Partial<Record<MeasureUnit, number>> | null {
  const nv = ing.nv, fid = ing.fid;
  if (/aceite/i.test(nv)) return { cdita: 5, cda: 15 };
  if (/^miel\b/i.test(nv)) return { cdita: 7, cda: 21 };
  if (fid === 'pechuga-de-pavo' || (!fid && /jam[oó]n de (pechuga de )?pavo|pavo en rebanadas/i.test(nv))) {
    return NOT_SLICE_RE.test(nv) ? {} : { rebanada: 21.33 };
  }
  if (fid === 'pasta-cocida' || (!fid && /pasta|coditos/i.test(nv) && !/de codito|cruda/i.test(nv) && !CUP_EXCLUDE_RE.test(nv))) return { taza: 120 };
  if (fid === 'arroz-cocido' || (!fid && /arroz/i.test(nv) && !CUP_EXCLUDE_RE.test(nv))) return { taza: 188 };
  return null;
}

// Defectos conocidos del catálogo, ya cerrados en bloques anteriores (no se usan, se reportan).
const KNOWN_DEFECTS: Record<string, MeasureUnit[]> = {
  'pasta-de-codito': ['taza'],   // CAPA 4 · D1: «40 g/taza» no es una taza de pasta.
};

// ── 3 · tabla SMAE de la app, por id del catálogo (mapa explícito: mismo alimento) ────────────────────
const SME_NAME_FOR_FID: Record<string, string> = {
  'fresa-rebanada': 'Fresa', 'fresa-entera': 'Fresa', 'durazno-amarillo': 'Durazno', guayaba: 'Guayaba', kiwi: 'Kiwi',
  mandarina: 'Mandarina', 'mango-picado': 'Mango', manzana: 'Manzana', melon: 'Melón', naranja: 'Naranja',
  'papaya-picada': 'Papaya', pera: 'Pera', 'pina-picada': 'Piña', platano: 'Plátano', 'sandia-picada': 'Sandía',
  uva: 'Uvas', 'ciruela-negra': 'Ciruela',
  'arroz-cocido': 'Arroz cocido', 'avena-cocida': 'Avena cocida', 'avena-en-hojuelas': 'Avena cruda',
  'pan-integral': 'Pan integral', 'pan-de-caja-integral': 'Pan integral', 'papa-cocida': 'Papa cocida',
  'pasta-cocida': 'Pasta cocida', 'tortilla-de-maiz': 'Tortilla de maíz', 'tostada-de-maiz-horneada': 'Tostada horneada',
  'elote-amarillo-desgranado-cocido': 'Elote en grano', 'palomitas-naturales': 'Palomitas sin aceite', 'camote-cocido': 'Camote cocido',
  edamame: 'Edamame cocido', 'frijol-promedio-cocido': 'Frijoles cocidos', 'garbanzo-cocido': 'Garbanzos cocidos',
  'lenteja-cocida': 'Lentejas cocidas',
  'huevo-entero-fresco': 'Huevo entero', 'huevo-entero-cocido': 'Huevo entero', tocino: 'Tocino', 'camaron-cocido': 'Camarón cocido',
  'yoghurt-oikos-estilo-griego-sabor-natural-sin-azucar-y-sin-endulzar': 'Yogur griego bajo en grasa',
  'aguacate-hass': 'Aguacate', almendra: 'Almendras', cacahuate: 'Cacahuate', 'mantequilla-de-cacahuate': 'Crema de cacahuate natural',
  pistache: 'Pistache', 'semilla-de-girasol': 'Semillas de girasol', ajonjoli: 'Ajonjolí',
  'aceituna-negra-sin-hueso': 'Aceitunas', 'aceituna-verde-sin-hueso': 'Aceitunas',
  miel: 'Miel de abeja', 'granola-estandar': 'Granola', 'granola-con-almendras': 'Granola', 'mayonesa-light': 'Mayonesa',
  'queso-cottage': 'Queso cottage light',
};
const QTY: Record<string, number> = { '½': 0.5, '⅓': 1 / 3, '¼': 0.25, '¾': 0.75, '⅔': 2 / 3 };
const SME_UNIT: Array<[RegExp, MeasureUnit]> = [
  [/^(tz|tazas?)$/i, 'taza'], [/^(pz|piezas?)$/i, 'pieza'], [/^(cdas?|cucharadas?)$/i, 'cda'], [/^(cditas?|cucharaditas?)$/i, 'cdita'], [/^rebanadas?$/i, 'rebanada'],
];
/** «½ tz picado (85g)» → { taza: 170 }. Solo gramos (los «ml» no se convierten). Puro. */
export function parseSmeAmount(amount: string): Partial<Record<MeasureUnit, number>> {
  const m = amount.match(/^\s*(\d+(?:\.\d+)?|[½⅓¼¾⅔])\s+(\S+).*\((\d+(?:\.\d+)?)\s*g\)\s*$/);
  if (!m) return {};
  const q = QTY[m[1]] ?? Number(m[1]);
  const u = SME_UNIT.find(([re]) => re.test(m[2]))?.[1];
  return u && q > 0 ? { [u]: Number(m[3]) / q } : {};
}
const SME_BY_NAME = new Map(smeGroups.flatMap((g) => g.subgroups.flatMap((s) => s.foods)).map((f) => [f.name, parseSmeAmount(f.amount)] as const));
function smeOf(fid: string | undefined): Partial<Record<MeasureUnit, number>> {
  const name = fid ? SME_NAME_FOR_FID[fid] : undefined;
  return (name && SME_BY_NAME.get(name)) || {};
}

/** Completa cda ↔ cdita por definición (1 cda = 3 cditas). */
function withSpoons(x: Partial<Record<MeasureUnit, number>>): Partial<Record<MeasureUnit, number>> {
  const o = { ...x };
  if (o.cda == null && o.cdita != null) o.cda = o.cdita * 3;
  if (o.cdita == null && o.cda != null) o.cdita = o.cda / 3;
  return o;
}

type Resolved = { m?: Measure; conflict?: MeasureConflict };
function resolve(ing: Pick<BancoIng, 'nv' | 'fid' | 'm' | 'pu'>, unit: MeasureUnit): Resolved {
  const closed = closedOf(ing);
  if (closed) { const c = withSpoons(closed)[unit]; return c != null ? { m: { g: c, source: 'CLOSED' } } : {}; }
  const fid = ing.fid ?? '';
  if (KNOWN_DEFECTS[fid]?.includes(unit)) return { conflict: { nv: ing.nv, fid, unit, kind: 'KNOWN_DEFECT', catalog: ing.m?.[unit] } };
  const rawCat = ing.m ?? {};
  const cat = withSpoons(rawCat)[unit];
  const sme = withSpoons(smeOf(ing.fid))[unit];
  const band = PLAUSIBLE[unit];
  if (cat != null && band && (cat < band[0] || cat > band[1])) {
    return { conflict: { nv: ing.nv, fid, unit, kind: 'IMPLAUSIBLE', catalog: cat } };
  }
  if (cat != null && sme != null) {
    const diff = Math.abs(cat - sme) / Math.min(cat, sme);
    if (diff > TOL[unit]) return { conflict: { nv: ing.nv, fid, unit, kind: 'CATALOG_VS_SMAE', catalog: cat, smae: Math.round(sme * 100) / 100, diffPct: Math.round(diff * 100) } };
    return { m: { g: cat, source: 'CATALOG' } };
  }
  if (cat != null) return { m: { g: cat, source: 'CATALOG' } };
  if (sme != null) return { m: { g: sme, source: 'SMAE_APP' } };
  // Ingrediente sin id de catálogo (p. ej. construido a mano): su pieza contable ya validada por gen_banco.
  if (!ing.fid && unit === 'pieza' && ing.pu) return { m: { g: ing.pu, source: 'LEGACY_PIECE' } };
  return {};
}

/** Gramos por unidad con su fuente, o null si no hay medida confiable (o está en conflicto). Puro. */
export function measureOf(ing: Pick<BancoIng, 'nv' | 'fid' | 'm' | 'pu'>, unit: MeasureUnit): Measure | null {
  return resolve(ing, unit).m ?? null;
}

/** Todos los conflictos de medida del banco (para el reporte y los tests). Puro, determinista. */
export function measureConflicts(): MeasureConflict[] {
  const out = new Map<string, MeasureConflict>();
  for (const d of BANCO) for (const i of d.ings) {
    if (i.rol !== 'principal' && i.rol !== 'fijo') continue;
    for (const u of UNITS) {
      const c = resolve(i, u).conflict;
      if (c) out.set(`${c.fid}|${c.unit}`, { ...c, nv: out.get(`${c.fid}|${c.unit}`)?.nv ?? c.nv });
    }
  }
  return [...out.values()].sort((a, b) => a.fid.localeCompare(b.fid) || a.unit.localeCompare(b.unit));
}
