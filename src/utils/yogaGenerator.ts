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
import { YOGA_SELECTABLE } from '../data/yogaCatalog';

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
  return `${ctx.userId ?? 'anon'}|${ctx.date}|${focus}|${min}|${ctx.variant ?? 0}`;
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
  const { durationMin, focus, seed, locale = 'es' } = input;
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
      const lastId = chosen.length ? chosen[chosen.length - 1].c.id : null;
      const lastIdx = new Map<string, number>();
      chosen.forEach((x, i) => lastIdx.set(x.c.id, i));

      const candidates = phasePool.filter(c => {
        const n = used.get(c.id) ?? 0;
        if (n === 0) return true;
        if (!c.repeatable) return false;
        if (c.id === lastId) return false;                              // R1
        if (chosen.length - (lastIdx.get(c.id) ?? -99) < gap) return false; // R2
        return n < maxUses;
      });
      if (!candidates.length) break;

      const scored = candidates.map(c => {
        let s = c.focus.includes(focus) ? 3 : -1.5;                     // R3
        if (c.focus[0] === focus) s += 1.5;
        s -= (used.get(c.id) ?? 0) * 2.2;                               // anti-redundancia
        const prev = chosen[chosen.length - 1];
        if (prev && prev.c.posEnd === c.posStart) s += 0.8;             // transición barata
        return { c, s: s + rnd() * 0.9 };
      }).sort((a, b) => b.s - a.s);

      const pick = scored[0].c;
      const placed = place(pick, left, true);
      if (placed.sec > left * 1.6) break;   // no desbordar la fase

      chosen.push({ c: pick, pose: toPose(pick, placed, locale), phase });
      used.set(pick.id, (used.get(pick.id) ?? 0) + 1);
      left -= placed.sec;
    }
  }

  // ── Ajuste fino dentro de los límites del catálogo ──────────────
  // No es relleno: no añade contenido. Reparte el desvío entre las prescripciones
  // de TIMER que todavía tienen margen [minSec, maxSec] declarado por el catálogo.
  // Los flows no se tocan — una ronda no se parte por cuadrar el reloj.
  {
    const targetSec = durationMin * 60;
    const timers = chosen.filter(x => x.c.mode === 'timer');
    let delta = targetSec - chosen.reduce((s, x) => s + x.pose.duration, 0);

    // reparte de uno en uno, en pasadas, para no cargar todo en la primera pose
    for (let pass = 0; pass < 6 && Math.abs(delta) > 1 && timers.length; pass++) {
      const step = Math.sign(delta);
      let moved = 0;
      for (const x of timers) {
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
