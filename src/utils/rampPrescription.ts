// ─────────────────────────────────────────────────────────────────────────────
// F2C-9C.2C · MOTOR PURO de SERIES DE APROXIMACIÓN (potentiate / ramp) — Option W.
//
// Las series de aproximación son PREPARACIÓN ESPECÍFICA del primer compuesto principal, NO evidencia de
// entrenamiento. Por eso viven en el WARM-UP GUIADO (fase potentiate), NUNCA en workout.exercises[], nunca
// como LoggedSet / CompletedSession / historial / training credit. 9C.1 (ExecutionRole) no participa:
// aquí no se persiste ninguna serie.
//
// Este motor es PURO / determinista / no-mutante / runtime-derived: recibe el topKg de trabajo YA
// prescrito (autoridad única = loadEngine.prescribeLoad, per-usuario) y deriva la escalera DEL RESULTADO
// FINAL — sin recalcular e1RM, sin re-aplicar readiness/deload, sin recomputar backoff. Así se evita el
// double-adjustment: la carga ya trae toda la adaptación; la escalera solo la escala hacia abajo.
//
// Reutiliza roundToIncrement (misma autoridad de redondeo que el working load, que prescribeLoad llama con
// inc=2.5). NO crea un modelo de placas paralelo: si una aproximación redondeada degenera (≤0, ≥ topKg, o
// duplica otra), se ELIMINA — el resultado puede tener menos series. Calidad > llenar la escalera.
// ─────────────────────────────────────────────────────────────────────────────
import { roundToIncrement } from './loadEngine';

/** Una serie de aproximación EJECUTABLE (guiada): carga ligera + reps conservadoras + descanso corto.
 *  NO lleva rir/topKg/backoff/scheme — no es un strength set y no se loguea. */
export type RampStep = { kg: number; reps: number; restSec?: number };

/** Prescripción de aproximación sellada en la fase potentiate del warm-up (additive; discriminada por kind). */
export type RampPrescription = { kind: 'ramp'; steps: RampStep[] };

/**
 * DOSIS por MAGNITUD de la carga de trabajo (regla monotónica: más carga → más aproximación). Los cortes
 * calibran contra la realidad del gym: ~40 kg ≈ una barra cargada ligera (1 aprox basta); ~100 kg ≈ carga
 * intermedia-pesada (2); >100 kg ≈ pesado real donde la potenciación paga (3). La carga MANDA; el tiempo
 * solo recorta (nunca amplía) esta base. Ver timeCap.
 */
function baseCountForLoad(topKg: number): number {
  if (topKg <= 40) return 1;
  if (topKg <= 100) return 2;
  return 3;
}

/** CAP por tiempo disponible: sesiones cortas recortan la escalera (el warm-up sigue capado fisiológicamente).
 *  Nunca AMPLÍA — una sesión larga no vuelve el warm-up largo (máximo fisiológico sigue 3). */
function timeCap(minutes: number): number {
  if (minutes <= 20) return 1;   // 20 min → 0-1 (la carga baja + el redondeo pueden dejarlo en 0)
  if (minutes <= 45) return 2;   // 45 min → máx 1-2
  return 3;                      // 60+ → hasta 2-3 si la carga lo pide
}

// PORCENTAJES del topKg por número de aproximaciones (ascendentes, todos < 1 → siempre por debajo del
// working). Escalonado para no apilar aproximaciones redundantes demasiado cercanas.
const RAMP_PERCENTS: Record<number, number[]> = {
  1: [0.50],
  2: [0.40, 0.65],
  3: [0.30, 0.55, 0.78],
};

/** Reps por intensidad relativa: más ligero → algunas más (pero SIEMPRE pocas, sin fallo/AMRAP/RIR). */
function repsForPct(pct: number): number {
  if (pct <= 0.50) return 5;
  if (pct <= 0.70) return 3;
  return 2;
}

/** Descanso por aproximación: corto en las ligeras, algo más antes de la más pesada. Sin heredar los
 *  ~180 s del working lift; regla simple y defendible. */
function restForPct(pct: number): number {
  return pct >= 0.72 ? 90 : 60;
}

/**
 * Construye la escalera de aproximación desde el topKg de trabajo (ya prescrito, per-usuario). Devuelve []
 * (sin escalera) cuando NO hay carga externa interpretable:
 *   · topKg ausente / no finito / ≤ 0 → arranque en frío, peso corporal, bandas (no se inventa carga);
 *   · toda aproximación redondeada degenera (≤0 / ≥ topKg / duplicada) → 0 series honestas.
 * Puro y determinista: mismos inputs → mismo output; no muta el input.
 */
export function buildRampPrescription(input: {
  topKg?: number | null;
  availableMinutes: number;
  inc?: number;
}): RampStep[] {
  const { topKg, availableMinutes } = input;
  const inc = input.inc ?? 2.5; // misma granularidad que el working load (prescribeLoad usa inc=2.5)
  if (topKg == null || !Number.isFinite(topKg) || topKg <= 0) return [];

  const count = Math.min(baseCountForLoad(topKg), timeCap(availableMinutes));
  if (count <= 0) return [];

  const pcts = RAMP_PERCENTS[count] ?? [];
  const steps: RampStep[] = [];
  let prevKg = 0;
  for (const pct of pcts) {
    const kg = roundToIncrement(topKg * pct, inc);
    if (kg <= 0) continue;         // demasiado ligero para representar una carga real
    if (kg >= topKg) continue;     // nunca aproximar con la carga de trabajo (o más)
    if (kg <= prevKg) continue;    // dedup + garantía de ascenso monotónico
    steps.push({ kg, reps: repsForPct(pct), restSec: restForPct(pct) });
    prevKg = kg;
  }
  return steps;
}
