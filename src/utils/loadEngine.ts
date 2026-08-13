// ─────────────────────────────────────────────────────────────────────────
// loadEngine — P2 del rediseño del coach: INTELIGENCIA DE CARGA.
//
// El sistema ya registra peso×reps por serie. Lo que faltaba: estimar el 1RM desde
// ese historial y traducirlo en un PESO DE TRABAJO sugerido (serie tope + backoff),
// modulado por la fase del mesociclo (P1) y dejando reps en reserva (RIR).
//
// Se apoya en lo que ya existe: parseRepRange (progression.ts) y el sesgo de
// intensidad del mesociclo. NO persiste nada — el e1RM se estima al vuelo del log.
// ─────────────────────────────────────────────────────────────────────────
import { parseRepRange } from './progression';
import type { IntensityBias } from './mesocycle';

export interface LoadPrescription {
  e1RM: number;       // 1RM estimado (kg)
  reps: number;       // reps objetivo de la serie tope
  rir: number;        // reps en reserva
  topKg: number;      // peso de la serie más pesada
  backoffKg: number;  // peso de las series de respaldo (~10% menos)
}

/** 1RM estimado (Epley) desde las series registradas: el MEJOR set manda. null si no
 *  hay series con peso (peso corporal / banda / sin dato). */
export function estimate1RM(sets?: { reps: number; kg: number }[]): number | null {
  const w = (sets ?? []).filter((s) => s.kg > 0 && s.reps > 0);
  if (w.length === 0) return null;
  return Math.max(...w.map((s) => s.kg * (1 + s.reps / 30))); // Epley
}

/** Peso al que llegarías a `reps` AL FALLO, dado un e1RM (inverso de Epley). */
export function loadForReps(e1RM: number, reps: number): number {
  return e1RM / (1 + reps / 30);
}

/** Redondea al incremento real del gym (placas). Tren inferior/compuestos → 5;
 *  el resto → 2.5. */
export function roundToIncrement(kg: number, inc = 2.5): number {
  return Math.round(kg / inc) * inc;
}

/** Reps objetivo según la fase del mesociclo: intensificación → extremo bajo del rango
 *  (más pesado); acumulación → extremo alto (más volumen); equilibrio → medio. */
export function targetRepsForPhase(repRange: string, bias: IntensityBias): number {
  const [lo, hi] = parseRepRange(repRange);
  if (bias === 'intensidad') return lo;
  if (bias === 'volumen') return hi;
  return Math.round((lo + hi) / 2);
}

/** RIR por fase: más cerca del fallo en intensificación, más margen en acumulación/descarga. */
export function rirForBias(bias: IntensityBias): number {
  if (bias === 'intensidad') return 1;
  if (bias === 'descarga') return 4;
  if (bias === 'volumen') return 3;
  return 2;
}

/**
 * Prescribe el PESO de trabajo desde el historial. La serie tope se calcula para llegar
 * a (reps + RIR) al fallo → deja el RIR de la fase; los backoffs van ~10% más ligeros.
 * null si no hay e1RM (peso corporal/banda → la progresión va por dificultad/tensión).
 */
export function prescribeLoad(
  lastSets: { reps: number; kg: number }[] | undefined,
  repRange: string,
  bias: IntensityBias,
  inc = 2.5,
): LoadPrescription | null {
  const e1RM = estimate1RM(lastSets);
  if (e1RM == null) return null;
  const reps = targetRepsForPhase(repRange, bias);
  const rir = rirForBias(bias);
  const topKg = roundToIncrement(loadForReps(e1RM, reps + rir), inc);
  const backoffKg = roundToIncrement(topKg * 0.9, inc);
  return { e1RM: Math.round(e1RM * 10) / 10, reps, rir, topKg, backoffKg };
}

/** Mejor e1RM por ejercicio en un conjunto de entradas (ignora ejercicios sin peso). */
export function bestE1RMByExercise(entries: { exercise: string; sets: { reps: number; kg: number }[] }[]): Map<string, number> {
  const best = new Map<string, number>();
  for (const e of entries) {
    const est = estimate1RM(e.sets);
    if (est == null) continue;
    best.set(e.exercise, Math.max(best.get(e.exercise) ?? 0, est));
  }
  return best;
}

/** Mejor e1RM por MÚSCULO (máx e1RM entre sus ejercicios). Para la señal de fuerza por
 *  grupo que usa la inferencia de punto débil (P5). Ignora músculos sin carga. */
export function bestE1RMByMuscle(
  entries: { exercise: string; sets: { reps: number; kg: number }[] }[],
  muscleOf: (exerciseId: string) => string | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) {
    const est = estimate1RM(e.sets);
    const m = muscleOf(e.exercise);
    if (est == null || !m) continue;
    out[m] = Math.max(out[m] ?? 0, est);
  }
  return out;
}

/** Suma del mejor e1RM por ejercicio — señal AGREGADA de fuerza. */
export function aggregateE1RM(entries: { exercise: string; sets: { reps: number; kg: number }[] }[]): number {
  let sum = 0;
  for (const v of bestE1RMByExercise(entries).values()) sum += v;
  return sum;
}

/**
 * Tendencia de FUERZA comparando el MISMO ejercicio entre dos periodos (reciente vs
 * previo) — evita el sesgo de que cambie la selección. Es el rendimiento REAL para el
 * mesociclo (mejor que la tendencia de volumen). null si no hay ejercicios comparables
 * → el llamador cae a la señal de volumen.
 */
export function e1RMTrend(
  recent: { exercise: string; sets: { reps: number; kg: number }[] }[],
  older: { exercise: string; sets: { reps: number; kg: number }[] }[],
): 'sube' | 'estable' | 'baja' | null {
  const r = bestE1RMByExercise(recent), o = bestE1RMByExercise(older);
  let up = 0, down = 0, n = 0;
  for (const [ex, ov] of o) {
    const rv = r.get(ex);
    if (rv == null || ov <= 0) continue;
    n++;
    if (rv >= ov * 1.02) up++;
    else if (rv <= ov * 0.98) down++;
  }
  if (n === 0) return null;
  if (up > down) return 'sube';
  if (down > up) return 'baja';
  return 'estable';
}
