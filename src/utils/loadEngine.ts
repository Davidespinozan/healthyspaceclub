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
  if (withRir.length >= 1) {
    // Mediana (par → promedio de los dos centrales; 1 dato → ese valor) → RIR-aware, robusta al
    // outlier. Basta 1 set con RIR (el top set): la robustez ante un dato aislado la da el PASO
    // ACOTADO de prescribeLoad (±1 incremento), no el exigir ≥2 sets aquí (eso perdía el RIR real).
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
 * Prescribe el PESO de trabajo desde el historial — ÚNICA autoridad de carga (bloque 2).
 *
 * CAPACIDAD (e1RM) RIR-AWARE, canal ÚNICO: la e1RM se estima con reps + RIR real
 * (robustE1RM) porque el atleta deja reps en reserva; Epley sobre reps-sin-RIR subestimaba y
 * hacía DECAER el peso sesión tras sesión (F4). Con RIR-aware la carga es ESTABLE: si hiciste
 * `kg × reps @ RIR` y hoy el objetivo es el mismo (reps@RIR), el peso de trabajo vuelve al
 * mismo kg (no decae); si mejoras (más reps o más RIR al mismo peso) → sube. NO hay segundo
 * multiplicador de calibración: el RIR corrige la carga SOLO vía la e1RM (sin double-dipping).
 * null si no hay carga comparable (peso corporal/banda → progresión por dificultad/tensión).
 */
export function prescribeLoad(
  lastSets: { reps: number; kg: number; rir?: number; repsUnconfirmed?: boolean }[] | undefined,
  repRange: string,
  bias: IntensityBias,
  inc = 2.5,
): LoadPrescription | null {
  // TOP SET de referencia: el más pesado (a ese kg, el de menos reps = el más duro).
  const work = (lastSets ?? []).filter(s => s.kg > 0 && s.reps > 0);
  if (work.length === 0) return null; // sin carga comparable → progresión por dificultad/tensión
  const refKg = Math.max(...work.map(s => s.kg));
  const reps = targetRepsForPhase(repRange, bias);
  const rir = rirForBias(bias);
  // PRESCRIPCIÓN ≠ DESEMPEÑO: una serie marcada SIN confirmar guarda reps = tope prescrito con
  // rir 0 (suposición máximamente inflada). Si la serie de referencia (al peso top) NO tiene reps
  // confirmadas por el usuario, NO hay evidencia real para estimar e1RM → mantenemos el MISMO peso
  // de trabajo (no inflar la carga con la prescripción). El usuario progresa al confirmar sus reps.
  // Legacy sin flag = confirmado (comportamiento intacto).
  const confirmedAtRef = work.filter(s => s.kg === refKg && !s.repsUnconfirmed);
  if (confirmedAtRef.length === 0) {
    const topKg = roundToIncrement(refKg, inc);
    const e1RM = Math.round(refKg * (1 + (reps + rir) / 30) * 10) / 10; // informativo (target-based, no inventado)
    return { e1RM, reps, rir, topKg, backoffKg: roundToIncrement(topKg * 0.9, inc) };
  }
  const ref = confirmedAtRef.reduce((a, b) => (b.reps < a.reps ? b : a));
  // PESO = último top set ESCALADO por el ratio de esfuerzo (RIR-aware). El "potencial" de una
  // serie = reps + RIR (reps que quedaban): si hoy el objetivo pide el MISMO esfuerzo que la vez
  // pasada, el peso vuelve al mismo kg (NO decae — arregla F4); si el objetivo pide menos reps
  // (intensificación) sube, más reps (acumulación) baja; y como el RIR real va 0-4, un RIR aislado
  // mueve la carga solo ~±5% (no dispara saltos). Sin RIR en el set → se asume al fallo (RIR 0),
  // conservador. Canal ÚNICO: el RIR corrige la carga aquí, sin calibración aparte.
  const performedPotential = ref.reps + Math.max(0, ref.rir ?? 0);
  const targetPotential = reps + rir;
  const raw = refKg * (1 + performedPotential / 30) / (1 + targetPotential / 30);
  // GUARDRAIL de ±10%/sesión: ni un RIR aislado (falso o no) ni un cambio de fase disparan la
  // carga de golpe; las transiciones de fase se completan en ~2 sesiones (gradual) y varias
  // observaciones coherentes de RIR refinan acumulando. En estado estable (mismo esfuerzo) el
  // ratio es 1 → no toca la cota → sin decay.
  const workingKg = Math.max(refKg * 0.90, Math.min(refKg * 1.10, raw));
  const topKg = roundToIncrement(workingKg, inc);
  const backoffKg = roundToIncrement(topKg * 0.9, inc);
  const e1RM = refKg * (1 + performedPotential / 30); // e1RM RIR-aware (informativo, trace/IA)
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
