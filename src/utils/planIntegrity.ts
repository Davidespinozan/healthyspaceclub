// ─────────────────────────────────────────────────────────────────────────────
// P0-04 · VALIDACIÓN FINAL DEL PLAN.
//
// Último eslabón de la cadena: P0-01 detecta correctamente las restricciones, P0-02
// determina cuáles aplican, P0-03 impide que el motor haga trampa cuando no encuentra
// opciones, y P0-04 revisa el plan TERMINADO antes de aceptarlo.
//
// Existe porque las garantías de los bloques anteriores viven en el momento de GENERAR, y
// un plan puede entrar al estado por puertas que no generan nada: el pull de Supabase y la
// rehidratación de localStorage. Un plan guardado antes de P0-03 puede contener cruces de
// tiempo o platillos incompatibles, y nada volvía a mirarlo.
//
// QUÉ VALIDA (y nada más):
//   A. RESTRICCIONES · ningún servicio viola las restricciones efectivas ACTUALES.
//   B. TIEMPO        · cada platillo resoluble está servido en su propio tiempo.
//   C. INTEGRIDAD    · la forma mínima para que A y B sean evaluables de forma fiable.
//
// QUÉ NO VALIDA: macros, calorías, variedad, repetición, verduras, calidad culinaria,
// antojos, medidas ni lista de compra. P0-04 es una barrera de seguridad, no una auditoría
// de calidad: un plan "mediocre" es un problema de producto; un plan que sirve un alérgeno
// o una cena de desayuno es un defecto de seguridad.
//
// NO HAY DETECTOR PARALELO. Para decidir si un platillo viola una restricción se usa el
// predicado REAL de P0-01 (`makeAvoidFilter`), que ya conoce sub-recetas, alérgenos ocultos
// y las excepciones de la Decisión 05. Este módulo solo decide QUÉ platillo mirar.
//
// Puro / determinista / sin estado. No conoce React, ni el store, ni Supabase.
// ─────────────────────────────────────────────────────────────────────────────
import { BANCO, type BancoDish } from '../data/banco';
import { makeAvoidFilter, expandAvoidCats, textMatchesAvoid } from './planEngine';

/** Tipo de defecto. Granular a propósito: la UI y los tests necesitan el motivo, no un bool. */
export type PlanViolationKind =
  | 'shape'          // el plan no tiene la forma mínima para poder validarse
  | 'restriction'    // un servicio viola una restricción efectiva
  | 'time'           // un platillo está servido en un tiempo que no es el suyo
  | 'unknown-dish';  // un nombre que no resuelve y no es una forma especial legítima

export interface PlanViolation {
  kind: PlanViolationKind;
  /** Número de día del plan (1–7) cuando aplica. */
  day?: number;
  /** Slot tal como se sirvió, ya normalizado (Desayuno/Comida/Cena/Snack). */
  slot?: string;
  /** Nombre del platillo (o la parte concreta, en un snack combinado). */
  dish?: string;
  /** Explicación legible, pensada para log y para el mensaje de un test fallido. */
  detail: string;
}

export interface PlanVerdict {
  valid: boolean;
  violations: PlanViolation[];
}

/** Error que corta el guardado de un plan inválido. Lleva el veredicto completo. */
export class InvalidPlanError extends Error {
  readonly verdict: PlanVerdict;
  constructor(verdict: PlanVerdict) {
    const n = verdict.violations.length;
    const muestra = verdict.violations.slice(0, 3)
      .map((v) => `${v.kind}${v.day ? ` d${v.day}` : ''}${v.slot ? ` ${v.slot}` : ''}: ${v.detail}`)
      .join(' · ');
    super(`Plan inválido: ${n} violación(es) de integridad. ${muestra}`);
    this.name = 'InvalidPlanError';
    this.verdict = verdict;
  }
}

// ── Formas que puede tomar un servicio ───────────────────────────────────────
// `MealItem.name` no siempre es el nombre de UN platillo del banco. Hay tres formas
// legítimas que no tienen correspondencia 1:1, y cada una se reconoce por su ESTRUCTURA,
// no por su nombre: si bastara el nombre, cualquier platillo desconocido podría disfrazarse
// de forma especial y saltarse la validación. Eso es exactamente lo que no queremos.
export type ServiceKind = 'dish' | 'combined' | 'shake' | 'bowl' | 'unknown';

/** Forma mínima de un servicio del plan que este módulo necesita leer. */
export interface ServiceLike {
  time?: unknown;
  name?: unknown;
  portions?: unknown;
  ings?: unknown;
}

const SHAKE_NAME = 'Batido de Proteína';
const SHAKE_ING = 'Proteína en polvo';

const BY_NAME = new Map<string, BancoDish>(BANCO.map((d) => [d.nombre, d]));
/** Partes de un snack combinado: `mergeItems` une los nombres con " + ". */
const partsOf = (name: string): string[] => name.split(' + ').map((s) => s.trim()).filter(Boolean);
/** Snack AM / Snack PM → Snack. Los demás tiempos se quedan como están. */
export const normalizeSlot = (time: string): string => (time.startsWith('Snack') ? 'Snack' : time);

const ingNames = (s: ServiceLike): string[] =>
  Array.isArray(s.ings)
    ? s.ings.map((i) => (i && typeof i === 'object' ? String((i as { nv?: unknown }).nv ?? '') : '')).filter(Boolean)
    : [];
const portionList = (s: ServiceLike): string[] =>
  Array.isArray(s.portions) ? s.portions.map((p) => String(p)) : [];

/**
 * ¿Qué clase de servicio es éste? Se decide por estructura:
 *
 * - `dish`     · su nombre resuelve a un platillo del banco.
 * - `combined` · varias partes unidas por " + " y TODAS resuelven (snack 2-en-1).
 * - `shake`    · el batido de proteína: nombre exacto Y su único ingrediente es la
 *                proteína en polvo. No basta el nombre: un platillo desconocido que se
 *                llame "Batido de Proteína" con otros ingredientes NO es un batido.
 * - `bowl`     · un alimento EXTERNO con macros conocidas: sin ingredientes y con una única
 *                porción que es su propio nombre, que es exactamente lo que construye
 *                `buildDayWithFixed`. Un nombre desconocido con ingredientes reales no
 *                encaja en esta firma. CAPACIDAD INACTIVA: el Bowl/Food Truck está pausado
 *                y no forma parte del producto actual. La firma se conserva para que las
 *                defensas sigan en pie; su verificabilidad es deuda previa a reactivarlo
 *                (HALLAZGO-03 en docs/nutricion/HALLAZGOS-P0.md).
 * - `unknown`  · cualquier otra cosa. NO recibe exención.
 */
export function classifyService(s: ServiceLike): ServiceKind {
  const name = typeof s.name === 'string' ? s.name.trim() : '';
  if (!name) return 'unknown';

  const ings = ingNames(s);
  const portions = portionList(s);

  if (name === SHAKE_NAME) {
    return ings.length === 1 && ings[0] === SHAKE_ING ? 'shake' : 'unknown';
  }
  if (ings.length === 0 && portions.length === 1 && portions[0].trim() === name) {
    return 'bowl';
  }

  const parts = partsOf(name);
  if (parts.every((p) => BY_NAME.has(p))) return parts.length > 1 ? 'combined' : 'dish';
  return 'unknown';
}

/**
 * VALIDA UN PLAN TERMINADO contra las restricciones efectivas ACTUALES.
 *
 * `effectiveAvoid` llega ya resuelto por la autoridad de P0-02 (quién manda), no se deduce
 * aquí ni se lee de `plan.gen`: confiar en `plan.gen.avoid` es justamente el agujero que
 * este módulo cierra, porque el perfil pudo endurecerse después de generar el plan.
 *
 * Devuelve TODAS las violaciones, no la primera: un diagnóstico parcial haría imposible
 * saber si un plan tiene un defecto o treinta.
 */
export function validatePlan(plan: unknown, effectiveAvoid: string[]): PlanVerdict {
  const violations: PlanViolation[] = [];
  const bad = (v: PlanViolation) => { violations.push(v); };

  // ── C · INTEGRIDAD ESTRUCTURAL ────────────────────────────────────────────
  // Solo lo imprescindible para poder evaluar A y B. Si esto falla, no se sigue: las
  // comprobaciones siguientes darían resultados sin sentido sobre un objeto malformado.
  if (plan == null || typeof plan !== 'object') {
    return { valid: false, violations: [{ kind: 'shape', detail: 'el plan no es un objeto' }] };
  }
  const p = plan as { days?: unknown; selectedDays?: unknown };
  if (!Array.isArray(p.days) || p.days.length === 0) {
    return { valid: false, violations: [{ kind: 'shape', detail: 'el plan no tiene días' }] };
  }
  // 7 días es la forma que producen las tres rutas de generación. Un plan con otra
  // cantidad está roto (no es "inseguro", pero tampoco se puede presentar como el plan
  // de la semana), y el render indexa por día asumiendo los 7.
  if (p.days.length !== 7) {
    bad({ kind: 'shape', detail: `el plan tiene ${p.days.length} días, se esperan 7` });
  }

  const avoid = effectiveAvoid.filter(Boolean);
  // El predicado REAL de P0-01: sub-recetas, alérgenos ocultos y Decisión 05 incluidos.
  const viola = avoid.length ? makeAvoidFilter(avoid) : null;
  // Para las formas especiales no hay BancoDish que mirar; se usa el texto que el propio
  // plan guarda (mismos primitivos compartidos, no un detector nuevo). Es una comprobación
  // más DÉBIL, y se declara como tal: cubre el nombre y las porciones, no la composición.
  const terms = avoid.length ? expandAvoidCats(avoid) : [];
  const textoViola = (txts: string[]) => terms.length > 0 && txts.some((t) => textMatchesAvoid(t, terms));

  for (const rawDay of p.days) {
    if (rawDay == null || typeof rawDay !== 'object') {
      bad({ kind: 'shape', detail: 'un día del plan no es un objeto' });
      continue;
    }
    const d = rawDay as { day?: unknown; meals?: unknown };
    const dayNum = typeof d.day === 'number' ? d.day : undefined;
    if (!Array.isArray(d.meals) || d.meals.length === 0) {
      bad({ kind: 'shape', day: dayNum, detail: 'un día del plan no tiene comidas' });
      continue;
    }

    for (const rawMeal of d.meals) {
      if (rawMeal == null || typeof rawMeal !== 'object') {
        bad({ kind: 'shape', day: dayNum, detail: 'una comida no es un objeto' });
        continue;
      }
      const m = rawMeal as ServiceLike;
      if (typeof m.time !== 'string' || !m.time || typeof m.name !== 'string' || !m.name) {
        bad({ kind: 'shape', day: dayNum, detail: 'una comida no tiene time/name utilizables' });
        continue;
      }
      const slot = normalizeSlot(m.time);
      const kind = classifyService(m);

      if (kind === 'unknown') {
        // Un nombre que no resuelve y no encaja en ninguna forma especial: no se puede
        // afirmar ni su tiempo ni su composición, así que NO se acepta. Es el punto que
        // impide que las excepciones legítimas se conviertan en un bypass genérico.
        bad({
          kind: 'unknown-dish', day: dayNum, slot, dish: m.name,
          detail: 'el nombre no resuelve en el banco ni corresponde a una forma especial',
        });
        continue;
      }

      // ── A · RESTRICCIONES ──────────────────────────────────────────────
      if (kind === 'dish' || kind === 'combined') {
        for (const part of partsOf(m.name)) {
          const dish = BY_NAME.get(part)!;
          if (viola && viola(dish)) {
            bad({ kind: 'restriction', day: dayNum, slot, dish: part, detail: `viola una restricción activa (${avoid.join(', ')})` });
          }
          // ── B · TIEMPO ──
          if (dish.tiempo !== slot) {
            bad({ kind: 'time', day: dayNum, slot, dish: part, detail: `es de ${dish.tiempo} y está servido en ${slot}` });
          }
        }
      } else {
        // shake / bowl · sin BancoDish detrás.
        if (textoViola([m.name, ...portionList(m), ...ingNames(m)])) {
          bad({ kind: 'restriction', day: dayNum, slot, dish: m.name, detail: `viola una restricción activa (${avoid.join(', ')})` });
        }
        // El BATIDO sí tiene un tiempo comprobable: reemplaza un snack, nunca una comida
        // fuerte (`applyShake` solo escribe en Snack AM/PM). No es una exención.
        if (kind === 'shake' && slot !== 'Snack') {
          bad({ kind: 'time', day: dayNum, slot, dish: m.name, detail: `el batido solo puede ocupar un snack, está en ${slot}` });
        }
        // El BOWL ocupa el tiempo que el usuario eligió al pedirlo, así que cualquier slot
        // es legítimo por construcción: es la única exención de tiempo, y es acotada.
      }
    }
  }

  return { valid: violations.length === 0, violations };
}

/**
 * Para las rutas de HIDRATACIÓN (pull de Supabase y rehidratación de localStorage).
 *
 * Devuelve el plan si es válido y `null` si no. Un plan inválido no se repara ni se
 * regenera en silencio: se descarta, y el usuario vuelve al CTA «Arma tu plan» —la misma
 * estrategia que P0-02 ya eligió para la invalidación por endurecimiento—. Así nunca llega
 * a `hasGeneratedWeeklyPlan` como plan válido.
 *
 * `null`/`undefined` entra y sale como `null`: la ausencia de plan no es un defecto.
 */
export function planIfValid<T>(plan: T | null | undefined, effectiveAvoid: string[]): T | null {
  if (plan == null) return null;
  const verdict = validatePlan(plan, effectiveAvoid);
  if (verdict.valid) return plan;
  console.warn('[planIntegrity] plan descartado al cargar:', new InvalidPlanError(verdict).message);
  return null;
}
