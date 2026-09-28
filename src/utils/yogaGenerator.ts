// ════════════════════════════════════════════════════════════════
// GENERADOR DE PRÁCTICAS DE YOGA — determinista, sin IA, sin Math.random
//
// Recibe {durationMin, focus, seed} y compone una práctica a partir del
// vocabulario de `yogaCatalog`. Función PURA: no toca red, reloj ni estado.
// La misma semilla produce siempre la misma práctica (reproducible, testeable,
// cacheable); cambiar la semilla produce otra composición válida.
//
// Principio rector: DURACIÓN DEL VÍDEO ≠ DURACIÓN PRESCRITA. Un clip de 12 s
// puede representar 45 s de trabajo. Por eso 20 min de metraje bastan para
// construir prácticas de 45 min sin relleno artificial.
//
// Reglas de composición (aprobadas tras simular 75 prácticas — sin ellas el
// motor cumplía el reloj y producía prácticas malas):
//   R1 · ningún contenido se sigue a sí mismo. Regla dura.
//   R2 · hueco mínimo antes de repetir: 4 piezas, 5 en sesiones de 30/45.
//   R3 · el focus contrario PENALIZA en negativo, no solo prioriza menos.
// ════════════════════════════════════════════════════════════════
import type { YogaContent, YogaFocus, YogaPhase, YogaPlan, YogaPose } from '../types';
import type { AppLanguage } from '../store';
import { YOGA_SELECTABLE, YOGA_FAMILY_POLICY, FAMILY_MIN_GAP, FAMILY_MAX_MEMBERS } from '../data/yogaCatalog';

const PHASE_ORDER: YogaPhase[] = ['centering', 'warmup', 'standing', 'peak', 'cooldown'];

/** Duraciones ofrecidas por el producto. */
export type YogaDuration = 10 | 15 | 20 | 30 | 45;

/** Reparto base por duración, antes del sesgo de enfoque. */
const BASE_BUDGET: Record<YogaDuration, Record<YogaPhase, number>> = {
  10: { centering: .10, warmup: .35, standing: .30, peak: .00, cooldown: .25 },
  15: { centering: .08, warmup: .30, standing: .34, peak: .08, cooldown: .20 },
  20: { centering: .07, warmup: .25, standing: .38, peak: .11, cooldown: .19 },
  30: { centering: .06, warmup: .22, standing: .42, peak: .12, cooldown: .18 },
  45: { centering: .05, warmup: .20, standing: .46, peak: .13, cooldown: .16 },
};

/** El enfoque reescala las fases; el resultado se renormaliza al total. */
const FOCUS_BIAS: Record<YogaFocus, Record<YogaPhase, number>> = {
  movilidad:  { centering: 1.2, warmup: 1.4, standing: 0.85, peak: 0.6, cooldown: 1.3 },
  flow:       { centering: 0.7, warmup: 0.9, standing: 1.35, peak: 1.1, cooldown: 0.8 },
  // Relajación NO reserva `standing` ni `peak`: no existe contenido afín en esas fases,
  // y un presupuesto obligatorio forzaba al motor a llenarlas con guerreros. Lo liberado
  // se reparte por renormalización, sobre todo hacia `cooldown` (el trabajo de suelo es
  // el cuerpo de la práctica) y algo hacia entrada y preparación suave.
  relajacion: { centering: 1.6, warmup: 0.85, standing: 0.0, peak: 0.0, cooldown: 2.4 },
};

/** Tolerancia de duración: ±8 % con suelo de 45 s. Mejor 19:20 honesto que forzar 20:00. */
/** Shortlist ponderada · ver el bucle de selección.
 *  BAND  — cuánto peor que el mejor puede ser un candidato y seguir entrando.
 *  MAX   — tope de candidatos, para que un pool grande no se vuelva plano.
 *  T     — temperatura: más baja favorece al mejor, más alta iguala. */
export const SHORTLIST_BAND = 1.8;
export const SHORTLIST_MAX = 5;
export const SHORTLIST_T = 1.0;

export const DURATION_TOLERANCE = 0.08;
export const DURATION_TOLERANCE_FLOOR = 45;

export function toleranceFor(targetSec: number): number {
  return Math.max(DURATION_TOLERANCE_FLOOR, targetSec * DURATION_TOLERANCE);
}

/** Presupuesto en segundos por fase. En 10 min `centering` y `warmup` se fusionan. */
export function budgetFor(min: YogaDuration, focus: YogaFocus): Record<YogaPhase, number> {
  const base = BASE_BUDGET[min], bias = FOCUS_BIAS[focus];
  const scaled = {} as Record<YogaPhase, number>;
  let sum = 0;
  for (const p of PHASE_ORDER) { scaled[p] = base[p] * bias[p]; sum += scaled[p]; }
  const out = {} as Record<YogaPhase, number>;
  for (const p of PHASE_ORDER) out[p] = Math.round((min * 60 * scaled[p]) / sum);
  return out;
}

/**
 * Duraciones ofrecidas por enfoque. TEMPORAL y medido, no opinión.
 *
 * Relajación llega hasta 20 min. Al retirar el presupuesto obligatorio de `standing`
 * —que era lo único que estiraba la práctica, y lo hacía con guerreros— el techo real
 * lo marca el contenido restaurativo disponible: 30 min se queda en ~24:40 (17,8 % de
 * desvío) y 45 min ni se acerca. Solo 4 de los 10 contenidos de `cooldown` son
 * repetibles y, con R1/R2 activas, el pozo se agota.
 *
 * Se reabrirán 30 y 45 al incorporar savasana, piernas en la pared y mariposa
 * reclinada. Preferimos no ofrecer una duración antes que prometerla y no cumplirla.
 */
export const YOGA_DURATIONS_BY_FOCUS: Record<YogaFocus, YogaDuration[]> = {
  movilidad:  [10, 15, 20, 30, 45],
  flow:       [10, 15, 20, 30, 45],
  relajacion: [10, 15, 20],
};

export function durationsFor(focus: YogaFocus): YogaDuration[] {
  return YOGA_DURATIONS_BY_FOCUS[focus];
}

/** Todas las duraciones que ofrece yoga, en orden. NO reutilizar TIME_OPTIONS (fuerza). */
export const YOGA_TIME_OPTIONS: YogaDuration[] = [10, 15, 20, 30, 45];

/**
 * Ajusta una duración cualquiera a la más cercana que el enfoque ofrece, sin pasarse.
 * Fuente ÚNICA para el asistente y el generador: si divergieran, la UI marcaría una
 * duración y se generaría otra.
 */
export function clampYogaDuration(minutes: number, focus: YogaFocus): YogaDuration {
  const allowed = durationsFor(focus);
  if ((allowed as number[]).includes(minutes)) return minutes as YogaDuration;
  const below = allowed.filter(d => d <= minutes);
  return below.length ? below[below.length - 1] : allowed[0];
}

/**
 * Contenidos que el generador puede usar AHORA: los seleccionables de V1 cuyo
 * vídeo está realmente disponible.
 *
 * Recibe el predicado en lugar de importarlo para que el generador siga siendo
 * puro y para que el test pueda ejercitar EXACTAMENTE el mismo cableado que
 * producción en vez de inyectar una lista a mano.
 *
 * El predicado FILTRA, no aporta ids: el conjunto de partida es el catálogo, así
 * que un id con `hasVideo` true que no esté en el catálogo —los obsoletos que el
 * snapshot compilado aún declara— no puede colarse. `A.filter(p) ⊆ A`.
 */
export function yogaAvailableIds(hasVideo: (id: string) => boolean): ReadonlySet<string> {
  return new Set(YOGA_SELECTABLE.filter(c => hasVideo(c.id)).map(c => c.id));
}

// ── Semilla determinista (sin Math.random) ──────────────────────
function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a: number): () => number {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface YogaSeedContext {
  userId?: string | null;
  date: string;      // YYYY-MM-DD local
  variant?: number;  // «Crear otra práctica» incrementa esto
}

export function yogaSeed(ctx: YogaSeedContext, focus: YogaFocus, min: YogaDuration): string {
  return `${yogaSeedBase(ctx, focus, min)}|${ctx.variant ?? 0}`;
}

/**
 * La parte de la semilla que NO depende de la variante. Sirve para rotar la
 * apertura: con ella, v0, v1 y v2 reciben openers DISTINTOS por construcción en
 * vez de tres sorteos independientes que pueden caer en el mismo. No introduce
 * estado — sigue siendo una función pura de usuario, fecha, enfoque y duración.
 */
export function yogaSeedBase(ctx: YogaSeedContext, focus: YogaFocus, min: YogaDuration): string {
  return `${ctx.userId ?? 'anon'}|${ctx.date}|${focus}|${min}`;
}

// ── Resolución de prescripción ──────────────────────────────────
interface Placed { sec: number; rounds?: number; sides?: 'both'; }

/**
 * Traduce un contenido a tiempo real de trabajo dentro del presupuesto que queda.
 * `unilateral` duplica (hay que hacer el otro lado); `contained` NUNCA duplica —
 * el vídeo ya trae los dos lados.
 */
function place(c: YogaContent, budgetLeft: number, allowShrink: boolean): Placed {
  const factor = c.laterality === 'unilateral' ? 2 : 1;
  const sides = c.laterality === 'unilateral' ? ('both' as const) : undefined;

  if (c.mode === 'rounds') {
    const [lo, hi] = c.rounds ?? [1, 1];
    let r = lo;
    while (r < hi && (r + 1) * c.defaultPrescription * factor <= budgetLeft) r++;
    return { sec: Math.round(r * c.defaultPrescription * factor), rounds: r, sides };
  }

  if (c.mode === 'reps') {
    return { sec: Math.round(c.defaultPrescription * factor), sides };
  }

  // timer: se estira hasta maxSec si sobra presupuesto, y se encoge hasta minSec si falta
  const min = c.minSec ?? c.defaultPrescription;
  const max = c.maxSec ?? c.defaultPrescription;
  const perSide = budgetLeft / factor;
  let sec = c.defaultPrescription;
  if (perSide > max) sec = max;
  else if (perSide < c.defaultPrescription && allowShrink) sec = Math.max(min, Math.floor(perSide));
  // El redondeo a segundos enteros se hace HACIA DENTRO del rango: con límites
  // fraccionarios (p. ej. maxSec 60.8), Math.round daría 61 y saldría del catálogo.
  let out = Math.round(sec * factor);
  if (out / factor > max) out = Math.floor(max * factor);
  if (out / factor < min) out = Math.ceil(min * factor);
  return { sec: out, sides };
}

function toPose(c: YogaContent, p: Placed, locale: AppLanguage): YogaPose {
  const name = locale === 'en' ? c.nameEn : c.name;
  const pose: YogaPose = { id: c.id, duration: p.sec, name };
  if (p.sides) pose.sides = p.sides;
  if (c.mode === 'rounds') {
    pose.isFlow = true;
    pose.roundSec = Math.round(c.realSec);
    if (p.rounds && p.rounds > 1) pose.repetitions = p.rounds;
    if (c.segments) {
      pose.segments = c.segments.map(s => ({ label: locale === 'en' ? s.labelEn : s.label, atSec: s.atSec }));
    }
  }
  return pose;
}

// ── Generación ──────────────────────────────────────────────────
export interface GenerateYogaInput {
  /** Clave estable sin variante (`yogaSeedBase`). Solo se usa para rotar la
   *  apertura; si falta, la rotación cae a la semilla completa y sigue siendo
   *  determinista, pero deja de garantizar openers distintos entre variantes. */
  rotationKey?: string;
  /** Variante pedida. `yogaSeed` ya la lleva dentro; aquí se necesita aparte
   *  porque la rotación tiene que ser una progresión, no un sorteo. */
  variant?: number;
  durationMin: YogaDuration;
  focus: YogaFocus;
  seed: string;
  locale?: AppLanguage;
  /** Ids con vídeo realmente disponible. Si se omite, no se filtra por disponibilidad. */
  availableIds?: ReadonlySet<string>;
  /** Catálogo alternativo (tests). Por defecto, los seleccionables de V1. */
  catalog?: YogaContent[];
}

const FOCUS_LABEL: Record<YogaFocus, { es: string; en: string }> = {
  movilidad:  { es: 'Movilidad', en: 'Mobility' },
  flow:       { es: 'Flow', en: 'Flow' },
  relajacion: { es: 'Relajación', en: 'Relaxation' },
};

export function generateYogaSession(input: GenerateYogaInput): YogaPlan {
  const { durationMin, focus, seed, locale = 'es', rotationKey, variant = 0 } = input;
  const rnd = mulberry32(fnv1a(seed));
  const budget = budgetFor(durationMin, focus);
  const short = durationMin <= 10;

  // Ajustes de sesión corta: residual más fino y `centering` fundido en `warmup`.
  const residualFloor = short ? 12 : 18;
  const gap = durationMin >= 30 ? 5 : 4;
  const maxUses = durationMin >= 30 ? 3 : 2;

  let pool = (input.catalog ?? YOGA_SELECTABLE);
  if (input.availableIds) pool = pool.filter(c => input.availableIds!.has(c.id));

  const phases: YogaPhase[] = short
    ? ['warmup', 'standing', 'peak', 'cooldown']   // centering fundido en warmup
    : PHASE_ORDER;

  const used = new Map<string, number>();
  /** Miembros DISTINTOS de cada familia ya colocados. */
  const famMembers = new Map<string, Set<string>>();
  /** Miembros distintos por familia Y fase (`familia|fase`). */
  const famPerPhase = new Map<string, Set<string>>();
  /** Índice e id de la ÚLTIMA pieza colocada de cada familia. */
  const famLastIdx = new Map<string, number>();
  const famLastId = new Map<string, string>();

  /**
   * APERTURA · la primera pieza sale de un pool curado por modalidad, no de la
   * fase `centering`. Rota con la variante para que v0, v1 y v2 no abran igual.
   * Sale del MISMO pool que el resto: respeta `input.catalog` y la disponibilidad
   * real de vídeo. Si nadie declara apertura para esta modalidad, se cae al
   * comportamiento de siempre y la primera pieza la elige el scoring.
   */
  const openerPool = pool.filter(c => c.openerFor?.includes(focus));
  let opener: YogaContent | null = openerPool.length
    ? openerPool[(fnv1a(rotationKey ?? seed) + variant) % openerPool.length]
    : null;

  /**
   * ¿Puede entrar este contenido sin romper la política de su familia?
   * Se evalúa SIEMPRE, también cuando el contenido ya se usó: la separación
   * mínima habla de dos miembros DISTINTOS, y repetir uno de ellos también mueve
   * la última posición de la familia.
   */
  const familiaAdmite = (c: YogaContent, phase: YogaPhase, idx: number): boolean => {
    if (!c.family) return true;
    const miembros = famMembers.get(c.family);
    if (!miembros || miembros.size === 0) return true;

    const esOtroMiembro = !miembros.has(c.id);
    // `strict` · solo se admite repetir el MISMO miembro, nunca traer otro.
    if ((YOGA_FAMILY_POLICY[c.family] ?? 'strict') === 'strict') return !esOtroMiembro;

    // `perPhase` · un miembro distinto por fase y tope por práctica.
    if (esOtroMiembro) {
      if (miembros.size >= FAMILY_MAX_MEMBERS) return false;
      if ((famPerPhase.get(`${c.family}|${phase}`)?.size ?? 0) >= 1) return false;
    }
    // Separación: si la última pieza de la familia fue OTRO miembro, hay que dejar hueco.
    if (famLastId.get(c.family) !== c.id
        && idx - (famLastIdx.get(c.family) ?? -99) < FAMILY_MIN_GAP) return false;
    return true;
  };

  const registrar = (c: YogaContent, phase: YogaPhase, idx: number) => {
    used.set(c.id, (used.get(c.id) ?? 0) + 1);
    if (!c.family) return;
    if (!famMembers.has(c.family)) famMembers.set(c.family, new Set());
    famMembers.get(c.family)!.add(c.id);
    const k = `${c.family}|${phase}`;
    if (!famPerPhase.has(k)) famPerPhase.set(k, new Set());
    famPerPhase.get(k)!.add(c.id);
    famLastIdx.set(c.family, idx);
    famLastId.set(c.family, c.id);
  };

  const chosen: Array<{ c: YogaContent; pose: YogaPose; phase: YogaPhase }> = [];

  for (const phase of phases) {
    let left = budget[phase];
    if (short && phase === 'warmup') left += budget.centering;
    if (left <= 0) continue;

    const phasePool = pool.filter(c =>
      c.phases.includes(phase) || (short && phase === 'warmup' && c.phases.includes('centering')));
    if (!phasePool.length) continue;

    let guard = 0;
    while (left > residualFloor && guard++ < 16) {
      // ── APERTURA · la primera pieza la pone el pool curado, no el scoring.
      if (opener && !chosen.length) {
        const placed = place(opener, left, true);
        chosen.push({ c: opener, pose: toPose(opener, placed, locale), phase });
        registrar(opener, phase, 0);
        left -= placed.sec;
        opener = null;
        continue;
      }

      const lastId = chosen.length ? chosen[chosen.length - 1].c.id : null;
      const lastIdx = new Map<string, number>();
      chosen.forEach((x, i) => lastIdx.set(x.c.id, i));

      const candidates = phasePool.filter(c => {
        const n = used.get(c.id) ?? 0;
        // Familia · filtro estructural, no penalización. La política depende de la
        // familia: ver YOGA_FAMILY_POLICY. Va ANTES del atajo de abajo para que
        // también alcance a un contenido que todavía no se ha usado.
        if (!familiaAdmite(c, phase, chosen.length)) return false;
        if (n === 0) return true;
        if (!c.repeatable) return false;
        if (c.id === lastId) return false;                              // R1
        if (chosen.length - (lastIdx.get(c.id) ?? -99) < gap) return false; // R2
        return n < maxUses;
      })
      // Que quepa es una condición para SER candidato, no un motivo para abandonar
      // la fase. Antes se elegía primero y, si la pieza desbordaba, se rompía el
      // bucle dejando el presupuesto sin gastar aunque hubiera otras que sí cabían:
      // 54 de 8736 prácticas salían cortas por eso. Ahora las que no caben
      // simplemente no compiten.
      .filter(c => place(c, left, true).sec <= left * 1.6);
      if (!candidates.length) break;

      const scored = candidates.map(c => {
        let s = c.focus.includes(focus) ? 3 : -1.5;                     // R3
        if (c.focus[0] === focus) s += 1.5;
        s -= (used.get(c.id) ?? 0) * 2.2;                               // anti-redundancia
        const prev = chosen[chosen.length - 1];
        if (prev && prev.c.posEnd === c.posStart) s += 0.8;             // transición barata
        return { c, s };
      }).sort((a, b) => b.s - a.s);

      // ── SHORTLIST PONDERADA ─────────────────────────────────────
      // Antes se tomaba el máximo con un jitter de 0,9, más pequeño que el salto
      // de 1,5 entre niveles de enfoque: el azar nunca podía cambiar la elección
      // y la semilla era decorativa. Ahora se recorta una lista de candidatos ya
      // razonables y se sortea DENTRO de ella con peso exp(Δscore/T). El enfoque
      // sigue mandando —una pieza fuera de banda no entra nunca— pero dos piezas
      // igual de válidas se reparten el hueco según la semilla.
      const best = scored[0].s;
      const shortlist = scored.filter(x => x.s >= best - SHORTLIST_BAND).slice(0, SHORTLIST_MAX);
      const weights = shortlist.map(x => Math.exp((x.s - best) / SHORTLIST_T));
      const total = weights.reduce((a, b) => a + b, 0);
      let r = rnd() * total;
      let k = 0;
      while (k < weights.length - 1 && r > weights[k]) { r -= weights[k]; k++; }
      const pick = shortlist[k].c;

      const placed = place(pick, left, true);

      chosen.push({ c: pick, pose: toPose(pick, placed, locale), phase });
      registrar(pick, phase, chosen.length - 1);
      left -= placed.sec;
    }
  }

  // ── Ajuste fino dentro de los límites del catálogo ──────────────
  // No es relleno: no añade contenido. Reparte el desvío entre las prescripciones
  // de TIMER que todavía tienen margen [minSec, maxSec] declarado por el catálogo.
  // Los flows no se tocan — una ronda no se parte por cuadrar el reloj.
  {
    const targetSec = durationMin * 60;
    // `timer` y `reps` comparten el mismo contrato de rango: el catálogo declara
    // [minSec, maxSec] para ambos. Dejar fuera a `reps` desperdiciaba margen ya
    // aprobado — en relajación 20 eran 53 s repartidos entre dos piezas mientras
    // la práctica salía corta. Los `rounds` siguen fuera: una ronda no se parte.
    const ajustables = chosen.filter(x => x.c.mode === 'timer' || x.c.mode === 'reps');
    let delta = targetSec - chosen.reduce((s, x) => s + x.pose.duration, 0);

    // reparte de uno en uno, en pasadas, para no cargar todo en la primera pose
    for (let pass = 0; pass < 6 && Math.abs(delta) > 1 && ajustables.length; pass++) {
      const step = Math.sign(delta);
      let moved = 0;
      for (const x of ajustables) {
        if (Math.abs(delta) <= 1) break;
        const f = x.c.laterality === 'unilateral' ? 2 : 1;
        const cur = x.pose.duration / f;
        const lo = x.c.minSec ?? x.c.defaultPrescription;
        const hi = x.c.maxSec ?? x.c.defaultPrescription;
        const room = step > 0 ? hi - cur : cur - lo;
        // D5 · el margen se trunca a segundos ENTEROS. Si no cabe al menos 1 s dentro
        // del rango declarado, este contenido no absorbe más delta — nunca se fuerza
        // un incremento que saldría de [minSec, maxSec].
        const usable = Math.floor(room);
        if (usable < 1) continue;
        const bite = Math.min(Math.max(1, Math.ceil(Math.abs(delta) / f / 2)), usable);
        const applied = bite * step * f;
        x.pose.duration = Math.round(x.pose.duration + applied);
        delta -= applied;
        moved++;
      }
      if (!moved) break;   // nadie tiene margen: se queda como está y lo dirá el validador
    }

    // Segunda palanca: RONDAS completas, dentro del [lo, hi] que declara el catálogo.
    // Nunca se parte una ronda por cuadrar el reloj — se añade o se quita entera, y
    // solo si el resultado sigue dentro de tolerancia.
    const tol = toleranceFor(targetSec);
    for (let pass = 0; pass < 4 && Math.abs(delta) > tol; pass++) {
      let moved = 0;
      for (const x of chosen) {
        if (x.c.mode !== 'rounds') continue;
        if (Math.abs(delta) <= tol) break;
        const [lo, hi] = x.c.rounds ?? [1, 1];
        const f = x.c.laterality === 'unilateral' ? 2 : 1;
        const unit = x.c.defaultPrescription * f;
        const cur = Math.round(x.pose.duration / unit);
        const step = delta > 0 ? 1 : -1;
        const next = cur + step;
        if (next < lo || next > hi) continue;
        if (Math.abs(delta - step * unit) >= Math.abs(delta)) continue;   // solo si acerca
        x.pose.duration = next * unit;
        if (next > 1) x.pose.repetitions = next; else delete x.pose.repetitions;
        delta -= step * unit;
        moved++;
      }
      if (!moved) break;
    }
  }

  const poses = chosen.map(x => x.pose);
  const total = poses.reduce((s, p) => s + p.duration, 0);
  const label = FOCUS_LABEL[focus][locale === 'en' ? 'en' : 'es'];

  return {
    type: `${label} ${durationMin} min`,
    totalDuration: total,
    intensity: focus === 'flow' ? 'alta' : focus === 'movilidad' ? 'media' : 'baja',
    opening: locale === 'en'
      ? 'Arrive on your mat and take three deep breaths to center.'
      : 'Llega a tu tapete y toma tres respiraciones profundas para centrarte.',
    poses,
    closing: locale === 'en'
      ? 'Slowly return, keep the calm you built.'
      : 'Regresa despacio, conserva la calma que construiste.',
  };
}
