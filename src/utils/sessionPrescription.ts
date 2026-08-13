// ─────────────────────────────────────────────────────────────────────────
// sessionPrescription — P4: PRESCRIPCIÓN ESTRUCTURADA POR SESIÓN (determinista).
//
// Series, reps, descansos y REPARTO de volumen dejan de depender del free-hand de la
// IA. La cadena, integrando P1+P2+P3:
//
//   mesociclo (P1) → target semanal por músculo (P3) → déficit semanal →
//   dosis de HOY (allocateSessionVolume) → esquema series/reps/carga/descanso.
//
// La IA solo ELIGE candidatos, explica y da cues. La lógica crítica es determinista.
// ─────────────────────────────────────────────────────────────────────────
import type { Exercise } from '../types';
import { HEAVY_COMPOUND } from './exerciseOrder';
import { prescribeLoad, roundToIncrement } from './loadEngine';
import type { Recovery } from './mesocycle';

export type Category = 'main-compound' | 'secondary-compound' | 'isolation';
export type SetScheme = 'top-backoff' | 'straight';
export type Phase = 'acumulacion' | 'intensificacion' | 'deload';

export interface ExercisePrescription {
  sets: number;
  reps: string;
  rest: number;       // segundos
  rir: number;
  scheme: SetScheme;
  topKg?: number;     // top-backoff con historial de carga (P2); o carga recta reducida en deload
  backoffKg?: number;
  schemeNote?: string; // ej. "1 top set + 2 backoffs"
  isDeloadLoad?: boolean; // P1 · topKg es una carga de descarga reducida (todas las series igual)
}

// DELOAD: factor de reducción de la carga de trabajo (guardrail/default, ~12.5% menos → ~87.5%
// de la carga normal). No es ley universal; reduce fatiga manteniendo práctica técnica.
export const DELOAD_LOAD_FACTOR = 0.875;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ── Categoría (rol) desde la taxonomía existente del banco ───────────────────
export function categorize(ex: Pick<Exercise, 'id' | 'name' | 'type'>): Category {
  if (ex.type === 'aislamiento') return 'isolation';
  if (ex.type === 'compuesto' || ex.type === 'funcional') {
    return (HEAVY_COMPOUND.test(ex.id) || HEAVY_COMPOUND.test(ex.name)) ? 'main-compound' : 'secondary-compound';
  }
  return 'isolation'; // activación/otros → se tratan como aislamiento (bajo desgaste)
}

// ── REPARTO DE VOLUMEN (el corazón de P4) ────────────────────────────────────
/**
 * Series que recibe HOY cada músculo del día. Reparte el DÉFICIT semanal (target P3 −
 * hecho) entre las sesiones que razonablemente quedan que entrenen ese músculo.
 * Evita los dos errores: (1) meter todo el faltante hoy → divide por las veces que se
 * volverá a entrenar; (2) quedarse corto → piso por sesión y, en la ÚLTIMA sesión de la
 * semana, alcanza lo que falta (acotado por el límite de sesión).
 */
export function allocateSessionVolume(input: {
  weeklyTarget: Record<string, number>;      // P3
  doneThisWeek: Record<string, number>;      // computeWeeklyVolume 7d
  dayMuscles: string[];
  primaryMuscles?: string[];                 // los que llevan el trabajo directo hoy
  freqTarget: number;
  sessionsThisWeekDone: number;
  muscleWeeklyFreq: Record<string, number>;  // veces/sem que se entrena cada músculo (del split)
  recovery?: Recovery;
  isDeload?: boolean;
  maxSetsPerMuscle?: number;                 // límite por sesión
}): Record<string, number> {
  const cap = input.maxSetsPerMuscle ?? 10;
  const freqWk = Math.max(1, Math.round(input.freqTarget));
  const sessionsLeft = Math.max(1, freqWk - input.sessionsThisWeekDone); // incl hoy
  const weekFraction = sessionsLeft / freqWk;
  const primary = input.primaryMuscles ? new Set(input.primaryMuscles) : null;
  const out: Record<string, number> = {};
  for (const m of input.dayMuscles) {
    const remaining = Math.max(0, (input.weeklyTarget[m] ?? 0) - (input.doneThisWeek[m] ?? 0));
    if (remaining <= 0) { out[m] = primary && !primary.has(m) ? 0 : (input.isDeload ? 0 : 2); continue; } // en target → mínimo mantenimiento
    const freq = Math.max(1, input.muscleWeeklyFreq[m] ?? 2);
    const expectedRemainingHits = Math.max(1, Math.round(freq * weekFraction));
    let dose = remaining / expectedRemainingHits;
    const isSecondary = primary ? !primary.has(m) : false;
    if (isSecondary) dose *= 0.6;                     // el secundario recibe mucho INDIRECTO de compuestos
    if ((input.recovery ?? 'media') === 'mala') dose *= 0.85;
    if (input.isDeload) dose *= 0.6;                   // deload: recorte claro
    const floor = input.isDeload ? 0 : (isSecondary ? 1 : 2);
    out[m] = clamp(Math.round(dose), floor, cap);
  }
  return out;
}

// ── Reps / RIR / descanso por categoría × objetivo × fase ────────────────────
/** Rango de reps. Objetivo marca la base; la fase la desplaza (intensificación baja el
 *  rango en movimientos apropiados; acumulación lo sube). Anclado a lo que usa el banco. */
export function repRangeFor(cat: Category, objective: string, phase: Phase): string {
  const o = (objective || '').toLowerCase();
  const fuerza = /fuerza/.test(o), condic = /condic|resist|grasa|perder/.test(o);
  if (cat === 'main-compound') {
    if (fuerza) return phase === 'intensificacion' ? '3-5' : '4-6';
    if (condic) return '8-12';
    return phase === 'intensificacion' ? '5-7' : '6-10';   // hipertrofia
  }
  if (cat === 'secondary-compound') {
    if (fuerza) return '5-8';
    if (condic) return '10-15';
    return phase === 'intensificacion' ? '7-10' : '8-12';
  }
  // isolation
  if (condic) return '15-20';
  return phase === 'intensificacion' ? '10-12' : '12-15';
}

export function restFor(cat: Category, phase: Phase): number {
  if (cat === 'main-compound') return phase === 'deload' ? 120 : phase === 'intensificacion' ? 180 : 150;
  if (cat === 'secondary-compound') return 90;
  return 60; // isolation
}

export function rirFor(cat: Category, phase: Phase): number {
  if (phase === 'deload') return 4;                       // lejos del fallo
  if (phase === 'intensificacion') return cat === 'isolation' ? 1 : 2;
  return cat === 'main-compound' ? 3 : 2;                 // acumulación conservadora
}

// ── Esquema + prescripción por ejercicio ─────────────────────────────────────
/**
 * top-backoff SOLO donde tiene sentido: compuesto principal CON historial de carga
 * (P2) fuera de deload. Peso corporal, bandas, secundarios y aislamiento → series
 * rectas (su progresión es por reps/dificultad/tensión, no por %1RM).
 */
export function schemeFor(cat: Category, hasLoadedHistory: boolean, phase: Phase): SetScheme {
  return cat === 'main-compound' && hasLoadedHistory && phase !== 'deload' ? 'top-backoff' : 'straight';
}

export function prescribeExercise(input: {
  category: Category;
  sets: number;              // series asignadas por el reparto (ya distribuidas)
  objective: string;
  phase: Phase;
  lastSets?: { reps: number; kg: number; rir?: number }[]; // P2 — historial CON RIR real (canal único)
}): ExercisePrescription {
  const { category, objective, phase } = input;
  const sets = Math.max(2, input.sets);
  const reps = repRangeFor(category, objective, phase);
  const rest = restFor(category, phase);
  const rir = rirFor(category, phase);
  const hasLoad = (input.lastSets ?? []).some(s => s.kg > 0);
  const scheme = schemeFor(category, hasLoad, phase);

  if (scheme === 'top-backoff') {
    const bias = phase === 'intensificacion' ? 'intensidad' : 'equilibrio';
    const load = prescribeLoad(input.lastSets, reps, bias); // RIR-aware, sin calibración (canal único)
    const backoffs = clamp(sets - 1, 1, 3);
    return {
      sets, reps, rest, rir, scheme,
      topKg: load?.topKg, backoffKg: load?.backoffKg,
      schemeNote: `1 serie tope + ${backoffs} backoff${backoffs > 1 ? 's' : ''}`,
    };
  }
  // DELOAD con carga comparable: reduce EXPLÍCITAMENTE la carga de trabajo (~87.5% de la
  // normal) en series rectas. MISMA fuente de carga (prescribeLoad RIR-aware) que el resto → el
  // deload y el trabajo normal no divergen. Sin carga comparable (bandas/corporal) → recto sin kg.
  if (phase === 'deload' && hasLoad) {
    const normal = prescribeLoad(input.lastSets, reps, 'equilibrio');
    if (normal) {
      const deloadKg = roundToIncrement(normal.topKg * DELOAD_LOAD_FACTOR, 2.5);
      return {
        sets, reps, rest, rir, scheme: 'straight',
        topKg: deloadKg, isDeloadLoad: true,
        schemeNote: 'descarga: carga reducida (~12% menos), mismas series',
      };
    }
  }
  return { sets, reps, rest, rir, scheme: 'straight' };
}

// ── Orquestación: reparte, prescribe y RESPETA EL TIEMPO ─────────────────────
export interface PrescribedItem<T> { ex: T; category: Category; prescription: ExercisePrescription; }

/** Minutos estimados de una prescripción (trabajo por serie + descanso). */
function minutesOf(p: ExercisePrescription): number {
  return p.sets * (0.7 + p.rest / 60);
}

/**
 * Aplica el reparto de volumen a los ejercicios YA elegidos (agrupados por músculo),
 * les asigna esquema/reps/descanso, y RECORTA para caber en el presupuesto del bloque
 * principal — quitando series de accesorios/aislamiento antes que de compuestos.
 */
export function prescribeSession<T extends { id: string; muscleGroup: string }>(input: {
  exercises: T[];                                  // con id + muscleGroup (del banco)
  bankById: Map<string, Pick<Exercise, 'id' | 'name' | 'type'>>;
  allocation: Record<string, number>;             // series por músculo (allocateSessionVolume)
  objective: string;
  phase: Phase;
  mainMinutes: number;                             // presupuesto del bloque principal
  lastPerf?: Record<string, { sets: { reps: number; kg: number; rir?: number }[] }>;
}): PrescribedItem<T>[] {
  const CAT_WEIGHT: Record<Category, number> = { 'main-compound': 1.6, 'secondary-compound': 1.2, isolation: 1.0 };
  const items: PrescribedItem<T>[] = [];

  // 1) Series por ejercicio: repartir la dosis del músculo entre sus ejercicios por peso
  //    de categoría (el compuesto principal se lleva más).
  const byMuscle = new Map<string, T[]>();
  for (const ex of input.exercises) {
    if (!byMuscle.has(ex.muscleGroup)) byMuscle.set(ex.muscleGroup, []);
    byMuscle.get(ex.muscleGroup)!.push(ex);
  }
  const setsByEx = new Map<string, number>();
  const catByEx = new Map<string, Category>();
  for (const [muscle, exs] of byMuscle) {
    const budget = input.allocation[muscle] ?? exs.length * 3; // sin target → 3/ej
    const cats = exs.map(e => categorize(input.bankById.get(e.id) ?? { id: e.id, name: e.id, type: 'compuesto' }));
    exs.forEach((e, i) => catByEx.set(e.id, cats[i]));
    const totalW = cats.reduce((a, c) => a + CAT_WEIGHT[c], 0);
    exs.forEach((e, i) => {
      const raw = totalW > 0 ? budget * (CAT_WEIGHT[cats[i]] / totalW) : budget / exs.length;
      setsByEx.set(e.id, clamp(Math.round(raw), 2, 6));
    });
  }

  // 2) Prescripción por ejercicio.
  for (const ex of input.exercises) {
    const cat = catByEx.get(ex.id) ?? 'isolation';
    const prescription = prescribeExercise({
      category: cat,
      sets: setsByEx.get(ex.id) ?? 3,
      objective: input.objective,
      phase: input.phase,
      lastSets: input.lastPerf?.[ex.id]?.sets,
    });
    items.push({ ex, category: cat, prescription });
  }

  // 3) TIEMPO: si no cabe, recorta series de menor prioridad (aislamiento → secundario),
  //    nunca por debajo de 2 series; jamás toca compuestos principales primero.
  const PRIORITY: Record<Category, number> = { isolation: 0, 'secondary-compound': 1, 'main-compound': 2 };
  let total = items.reduce((a, it) => a + minutesOf(it.prescription), 0);
  let guard = 200;
  while (total > input.mainMinutes && guard-- > 0) {
    // candidato a recortar: menor prioridad, con más series
    const cand = items
      .filter(it => it.prescription.sets > 2)
      .sort((a, b) => PRIORITY[a.category] - PRIORITY[b.category] || b.prescription.sets - a.prescription.sets)[0];
    if (!cand) break;
    cand.prescription.sets -= 1;
    total = items.reduce((a, it) => a + minutesOf(it.prescription), 0);
  }
  return items;
}
