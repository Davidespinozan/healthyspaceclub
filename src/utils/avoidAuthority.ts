// ─────────────────────────────────────────────────────────────────────────────
// P0-02 · AUTORIDAD DE RESTRICCIONES ALIMENTARIAS.
//
// HSC distingue DOS conceptos que antes se confundían en uno:
//
//   A) RESTRICCIONES PERMANENTES DEL PERFIL (`permanentAvoid`)
//      Categorías que el usuario declara que HSC debe excluir SIEMPRE. No
//      distinguimos técnicamente si la razón es alergia, intolerancia, condición
//      personal o elección: para el motor significan lo mismo — NUNCA servir esa
//      categoría mientras siga seleccionada en el perfil.
//      Fuente: `obData.avoid` (CSV), escrita en onboarding y en Ajustes.
//
//   B) PREFERENCIAS TEMPORALES DE LA SEMANA (`weeklyAvoid`)
//      Lo que responde el usuario a «¿Algo que prefieras evitar?». Son categorías
//      ADICIONALES para ESA generación. No eliminan ni reemplazan las permanentes.
//      Fuente: la respuesta del cuestionario semanal.
//
//   effectiveAvoid = UNION(permanentAvoid, weeklyAvoid)     ·     NUNCA resta.
//
// Este módulo decide QUÉ categorías llegan al detector; el detector (P0-01,
// makeAvoidFilter) decide si un platillo CONTIENE esa categoría. Son capas
// distintas y no se mezclan.
//
// Puro / determinista / sin estado. No conoce React ni el store.
// ─────────────────────────────────────────────────────────────────────────────
import { canonicalizeAvoidTerm } from './allergenSafety';
import { expandAvoidCats, textMatchesAvoid } from './planEngine';

/**
 * Las 10 restricciones que el producto ofrece hoy, para el PERFIL (permanentes).
 * Es la única fuente de verdad del catálogo: onboarding, Ajustes y el cuestionario
 * semanal la importan para que no vuelvan a divergir (antes el perfil ofrecía 8 y
 * el cuestionario 13).
 *
 * `vegetariano` y `vegano` NO están: la Decisión 01 establece que HSC no los
 * ofrece en la versión actual. Los perfiles que ya los tengan guardados se siguen
 * respetando (ver `permanentAvoidFrom`): retirarlos haría el plan más permisivo.
 */
export const PERMANENT_AVOID_CATALOG = [
  'gluten', 'lacteos', 'huevo', 'frutos-secos', 'cacahuate',
  'soya', 'ajonjoli', 'pescado', 'mariscos', 'carne-roja',
] as const;
export type AvoidCategory = typeof PERMANENT_AVOID_CATALOG[number];

/** Catálogo del cuestionario semanal: las mismas 10 + la opción «nada más». */
export const WEEKLY_AVOID_CATALOG = [...PERMANENT_AVOID_CATALOG, 'nada'] as const;

/** Valores centinela que significan «ninguna restricción» y no son categorías. */
const SENTINELS = new Set(['nada', 'ninguno', 'ninguna', 'todas', 'todo', 'todos']);

/** CSV/lista laxa → categorías en minúscula, sin vacíos ni duplicados. Puro. */
export function parseAvoidCsv(v: unknown): string[] {
  if (v == null) return [];
  const raw = Array.isArray(v) ? v.map(String) : String(v).split(/[,;]+/);
  const out: string[] = [];
  for (const s of raw) {
    const t = s.trim().toLowerCase();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/** Canoniza (maní→cacahuate, sésamo→ajonjolí) y descarta centinelas. Puro. */
function normalizeCats(cats: string[]): string[] {
  const out: string[] = [];
  for (const c of cats) {
    const k = canonicalizeAvoidTerm(c);
    if (!k || SENTINELS.has(k) || out.includes(k)) continue;
    out.push(k);
  }
  return out;
}

/**
 * RESTRICCIONES PERMANENTES del perfil. Lee `obData.avoid`.
 *
 * Se respeta TODO lo que haya guardado, incluidas categorías que la UI ya no
 * ofrece (`vegetariano`/`vegano` de perfiles anteriores a la Decisión 01):
 * ignorarlas volvería el plan MÁS permisivo, y el contrato es que nunca se resta.
 */
export function permanentAvoidFrom(obData: Record<string, unknown> | null | undefined): string[] {
  return normalizeCats(parseAvoidCsv(obData?.avoid));
}

/**
 * PREFERENCIAS TEMPORALES de la semana. Lee la respuesta del cuestionario, que
 * puede venir como CSV ("gluten, lacteos"), como array, o como centinela
 * ('nada' cuando el usuario dice «nada más», 'todas' cuando no marca nada —
 * valor legacy de la pregunta de cocinas que se reusó en este paso).
 */
export function weeklyAvoidFrom(answer: unknown): string[] {
  return normalizeCats(parseAvoidCsv(answer));
}

/**
 * LA REGLA FUNDAMENTAL: unión, nunca resta.
 *
 * El orden es estable y auditable: primero las permanentes en su orden, después
 * las semanales que aporten algo nuevo. Así `effectiveAvoid` siempre es un
 * superconjunto de `permanentAvoid`.
 */
export function effectiveAvoid(permanent: string[], weekly: string[]): string[] {
  const out = [...normalizeCats(permanent)];
  for (const c of normalizeCats(weekly)) if (!out.includes(c)) out.push(c);
  return out;
}

/** Forma mínima del bloque `gen` de un plan guardado que necesita la autoridad. */
export interface SavedGenAvoid {
  avoid?: string[];
  avoidWeekly?: string[];
  avoidPermanent?: string[];
}

/**
 * Restricciones con las que REGENERAR un plan guardado.
 *
 * Toma la parte SEMANAL del plan guardado y la une con las permanentes del perfil
 * ACTUAL — no con las que había cuando se generó. Si el usuario añadió una
 * restricción permanente entretanto, la regeneración ya la respeta; si la quitó,
 * la parte semanal del plan sigue intacta. Nunca resta.
 *
 * Planes anteriores a P0-02 no traen `avoidWeekly`: su `avoid` era exactamente la
 * respuesta semanal, así que se usa tal cual. Planes aún más viejos no traen `gen`
 * y solo dejaron el texto de `preferences`, del que se extraen las categorías
 * reconocibles (errar hacia MÁS restricción es seguro).
 */
export function avoidForRegen(
  gen: SavedGenAvoid | null | undefined,
  preferences: string | null | undefined,
  obData: Record<string, unknown> | null | undefined,
): string[] {
  const weekly = gen?.avoidWeekly
    ?? gen?.avoid
    ?? PERMANENT_AVOID_CATALOG.filter((k) => (preferences || '').toLowerCase().includes(k));
  return effectiveAvoid(permanentAvoidFrom(obData), weeklyAvoidFrom(weekly));
}

/** Forma mínima de un plan guardado para comprobar compatibilidad. */
interface PlanLike {
  days?: Array<{ meals?: Array<{ name?: string; portions?: string[]; ings?: Array<{ nv?: string }> }> }>;
}

/**
 * ¿Este plan ya generado sirve alguna de las categorías indicadas?
 *
 * Se usa cuando el usuario ENDURECE sus restricciones permanentes: un plan que ya
 * está en pantalla no puede seguir presentándose como válido si contiene lo que el
 * usuario acaba de declarar que no consume. Inspecciona el nombre de cada comida,
 * sus ingredientes y sus porciones con el MISMO expandAvoidCats del motor.
 *
 * Sin plan, sin días o sin categorías → false (nada que invalidar).
 */
export function planViolatesAvoid(plan: PlanLike | null | undefined, cats: string[]): boolean {
  const terms = expandAvoidCats(normalizeCats(cats));
  if (!terms.length || !plan?.days?.length) return false;
  for (const d of plan.days) {
    for (const m of d.meals ?? []) {
      if (textMatchesAvoid(m.name ?? '', terms)) return true;
      for (const ing of m.ings ?? []) if (textMatchesAvoid(ing.nv ?? '', terms)) return true;
      for (const p of m.portions ?? []) if (textMatchesAvoid(p, terms)) return true;
    }
  }
  return false;
}

/**
 * ¿Un cambio de las restricciones permanentes deja inválido el plan vigente?
 *
 * Solo el ENDURECIMIENTO puede invalidar: se mira únicamente lo que se AÑADIÓ. Así,
 *   · quitar una restricción         → el plan queda más permisivo, sigue siendo seguro;
 *   · cambiar peso, altura, objetivo → no hay categorías nuevas, no se toca el plan;
 *   · añadir una que el plan NO sirve → tampoco hace falta descartarlo.
 *
 * Devuelve también `added` para que la UI pueda explicar el motivo. Puro.
 */
export function planInvalidatedByAvoidChange(
  prevAvoid: unknown,
  nextAvoid: unknown,
  plan: PlanLike | null | undefined,
): { invalidated: boolean; added: string[] } {
  const antes = permanentAvoidFrom({ avoid: prevAvoid });
  const despues = permanentAvoidFrom({ avoid: nextAvoid });
  const added = despues.filter((c) => !antes.includes(c));
  return { invalidated: added.length > 0 && planViolatesAvoid(plan, added), added };
}
