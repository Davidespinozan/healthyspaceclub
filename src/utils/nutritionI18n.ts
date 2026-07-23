// i18n de CONTENIDO de nutrición en tiempo de RENDER.
//
// El motor (planEngine) genera y PERSISTE el plan en español: nombres de platillo,
// ingredientes y las porciones ("2 huevos", "1 taza de arroz") se hornean como
// strings al generar. Regenerar al cambiar de idioma cambiaría los platillos (otra
// semilla) y tocaría el motor de precisión — no queremos eso. En vez de eso se
// traduce al PINTAR: instantáneo, sin reescribir el plan, sin riesgo para las macros.
//
// Clave: en mealItemFrom, `portions[i]` y `ings[i]` se empujan ALINEADOS (mismo
// índice), y scalePlan mapea cada porción 1:1, así que al render tenemos el string
// (para la cantidad/formato) y el `ing` estructurado (nv limpio + rol) para el
// nombre. tPortion combina ambos: no revierte la pluralización española del string,
// usa el nv y lo re-emite en inglés.

import type { AppLanguage } from '../store';
import { dishNamesEn, ingredientNamesEn, subrecetaNamesEn } from '../data/banco.en';

type Ing = { nv: string; g: number | null; rol: string };

// ── Nombres ────────────────────────────────────────────────────────────────
/** Nombre de platillo. Los snacks combinados vienen unidos con " + " → traduce cada parte. */
export function tDishName(name: string, lang: AppLanguage): string {
  if (lang !== 'en' || !name) return name;
  return name.split(' + ').map((p) => dishNamesEn[p.trim()] ?? p.trim()).join(' + ');
}

/** Nombre visible de un ingrediente (lista de compras, sub-recetas). */
export function tIngName(nv: string, lang: AppLanguage): string {
  if (lang !== 'en' || !nv) return nv;
  return ingredientNamesEn[nv] ?? nv;
}

/** desc del platillo = lista de nv separada por " · " → traduce cada parte. */
export function tDesc(desc: string, lang: AppLanguage): string {
  if (lang !== 'en' || !desc) return desc;
  return desc.split(' · ').map((p) => tIngName(p.trim(), lang)).join(' · ');
}

/** Nombre de una sub-receta (salsa/aderezo). */
export function tSubName(nombre: string, lang: AppLanguage): string {
  if (lang !== 'en' || !nombre) return nombre;
  return subrecetaNamesEn[nombre] ?? nombre;
}

// ── Porciones ────────────────────────────────────────────────────────────────
// Cantidades que la app usa: enteros y fracciones unicode (½ ⅓ ¾ ¼ ⅔), p. ej. "1½".
const QTY = '[\\d¼½⅓½⅔¾.,]+';
const FRAC: Record<string, number> = { '¼': 0.25, '⅓': 1 / 3, '½': 0.5, '⅔': 2 / 3, '¾': 0.75 };

/** "1½" → 1.5 · "½" → 0.5 · "2" → 2. Para decidir plural en inglés. */
function parseQty(q: string): number {
  const m = q.match(/^(\d+)?([¼⅓½⅔¾])?$/);
  if (m) return (m[1] ? parseInt(m[1], 10) : 0) + (m[2] ? FRAC[m[2]] : 0);
  const n = parseFloat(q.replace(',', '.'));
  return isNaN(n) ? 1 : n;
}

/** Pluralización inglesa mínima para nombres de pieza contable ("egg" → "eggs"). */
function pluralizeEn(name: string, qty: number): string {
  if (qty <= 1) return name;
  // Frase: pluraliza solo la primera palabra (la cabeza), respeta el resto
  // ("corn tortilla" → "corn tortillas" NO aplica aquí porque el overlay ya trae
  //  la cabeza correcta; se pluraliza la última palabra de la cabeza simple).
  const words = name.split(' ');
  const i = words.length - 1;               // pluraliza la última palabra visible
  const w = words[i];
  if (/s$/i.test(w)) { /* ya plural */ }
  else if (/(s|x|ch|sh)$/i.test(w)) words[i] = w + 'es';
  else if (/[^aeiou]y$/i.test(w)) words[i] = w.slice(0, -1) + 'ies';
  else words[i] = w + 's';
  return words.join(' ');
}

/**
 * Traduce una porción ya formateada en español usando el ingrediente alineado.
 * `ing` puede faltar en planes legacy (mealPlan.ts) → cae a devolver el string tal cual.
 */
export function tPortion(str: string, ing: Ing | undefined, lang: AppLanguage): string {
  if (lang !== 'en' || !str) return str;
  const en = ing ? tIngName(ing.nv, lang) : null;

  // condimento: el string ES el nombre del ingrediente, sin cantidad.
  if (ing?.rol === 'condimento') return en ?? str;

  // "{nombre} al gusto" (guarnición)
  if (/ al gusto$/i.test(str)) {
    const name = en ?? str.replace(/ al gusto$/i, '');
    return `${name} to taste`;
  }

  // "{qty} cda|cdas|taza|tazas|rebanada|rebanadas de {nombre}"
  const unitM = str.match(new RegExp(`^(${QTY})\\s+(cdas?|tazas?|rebanadas?)\\s+de\\s+.+$`, 'i'));
  if (unitM) {
    const qty = unitM[1];
    const u = unitM[2].toLowerCase();
    const plural = parseQty(qty) > 1;
    const enUnit = u.startsWith('cda') ? 'tbsp'
      : u.startsWith('taza') ? (plural ? 'cups' : 'cup')
      : (plural ? 'slices' : 'slice');
    const name = (en ?? '').toLowerCase();
    return `${qty} ${enUnit} of ${name}`;
  }

  // "{g} g {nombre}"  → mantiene la caja original del nombre (como el español)
  const gM = str.match(/^(\d+)\s+g\s+(.+)$/);
  if (gM) return `${gM[1]} g ${en ?? gM[2]}`;

  // "{qty} {nombre-plural}" (piezas contables: huevos, tostadas, rebanadas de pan…)
  const pieceM = str.match(new RegExp(`^(${QTY})\\s+(.+)$`));
  if (pieceM && en) {
    const qty = pieceM[1];
    return `${qty} ${pluralizeEn(en.toLowerCase(), parseQty(qty))}`;
  }

  // Sin cantidad reconocible: si el string es exactamente el nv, tradúcelo.
  return en && str.trim() === ing!.nv.trim() ? en : (en ?? str);
}
