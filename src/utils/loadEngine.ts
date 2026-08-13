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

/**
 * P6 · 1RM estimado APROVECHANDO el RIR real. Epley asume que la serie fue AL FALLO;
 * si el usuario dejó RIR reps en reserva, su capacidad real corresponde a
 * repsPotential = repsCompletadas + RIR. Sin `rir` cae al Epley normal (fallo asumido).
 * null si no hay peso (corporal/banda). NO reemplaza el e1RM medido — se COMBINA (blendE1RM).
 */
export function estimate1RMFromSet(s: { reps: number; kg: number; rir?: number }): number | null {
  if (s.kg <= 0 || s.reps <= 0) return null;
  const repsPotential = s.reps + Math.max(0, s.rir ?? 0);
  return s.kg * (1 + repsPotential / 30); // Epley sobre reps potenciales
}

/**
 * P6 · e1RM ROBUSTO desde varias series (RIR-aware, con protección de outliers). Toma la
 * MEDIANA de las estimaciones por serie con RIR — menos sensible a una serie rara que el
 * máx. Con <2 estimaciones con RIR, o ninguna, cae a `estimate1RM` (fallback Epley sin RIR).
 * Devuelve además cuántas exposiciones con RIR respaldan el número (para modular confianza).
 */
export function robustE1RM(sets?: { reps: number; kg: number; rir?: number }[]): { e1RM: number; ridCount: number } | null {
  const list = sets ?? [];
  const withRir = list
    .filter(s => s.kg > 0 && s.reps > 0 && s.rir != null)
    .map(s => estimate1RMFromSet(s)!)
    .sort((a, b) => a - b);
  if (withRir.length >= 2) {
    // mediana (par → promedio de los dos centrales) → robusta al outlier
    const mid = Math.floor(withRir.length / 2);
    const median = withRir.length % 2 ? withRir[mid] : (withRir[mid - 1] + withRir[mid]) / 2;
    return { e1RM: Math.round(median * 10) / 10, ridCount: withRir.length };
  }
  const plain = estimate1RM(list); // fallback: Epley sin RIR (fallo asumido)
  return plain == null ? null : { e1RM: Math.round(plain * 10) / 10, ridCount: 0 };
}

/**
 * P6 · Combina el e1RM MEDIDO (histórico, sin RIR) con el estimado por RIR, ponderando por
 * evidencia: sin exposiciones con RIR → 100% medido (fallback); más exposiciones con RIR →
 * más peso al RIR, tope 0.5 (nunca lo dominan). Protege de saltos por una sola percepción.
 */
export function blendE1RM(measured: number | null, rirBased: { e1RM: number; ridCount: number } | null): number | null {
  if (rirBased == null) return measured;
  if (measured == null) return rirBased.ridCount > 0 ? rirBased.e1RM : null;
  if (rirBased.ridCount === 0) return measured;                 // no hay RIR → confía en lo medido
  const w = Math.min(0.5, 0.2 + 0.1 * rirBased.ridCount);       // 1 exp→0.3, 2→0.4, ≥3→0.5
  return Math.round((measured * (1 - w) + rirBased.e1RM * w) * 10) / 10;
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
  lastSets: { reps: number; kg: number; rir?: number }[] | undefined,
  repRange: string,
  bias: IntensityBias,
  inc = 2.5,
  calibration = 1,   // P6 · factor de calibración por RIR real (acotado ±5% aguas arriba)
): LoadPrescription | null {
  // e1RM MEDIDO (Epley del mejor set) escalado por la calibración de RIR (P6). El RIR real
  // corrige la carga por UN SOLO canal — la calibración— para no doble-contar: NO se vuelve a
  // meter el RIR en el propio e1RM aquí (blendE1RM/robustE1RM quedan para métrica de capacidad,
  // fuera de la prescripción de carga). Sin calibración (=1) → idéntico al comportamiento base.
  const e1RM0 = estimate1RM(lastSets);
  if (e1RM0 == null) return null;
  const e1RM = e1RM0 * calibration;
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
