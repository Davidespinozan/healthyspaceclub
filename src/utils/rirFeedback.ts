// ─────────────────────────────────────────────────────────────────────────
// rirFeedback — P6: cierra el loop PRESCRIBE → PERFORM → OBSERVE → ADAPT.
//
// Compara el RIR PRESCRITO (P4) con el RIR REAL reportado y calibra el motor de carga
// (P2) para la próxima vez. El RIR es percepción subjetiva CON ERROR → cambios pequeños,
// varias observaciones pesan más, usuarios nuevos reciben menos confianza, un outlier
// aislado no mueve la carga. Nunca saltos absurdos. Sin RIR → todo cae al método actual.
// ─────────────────────────────────────────────────────────────────────────
import { roundToIncrement } from './loadEngine';

export interface RirObservation {
  prescribedRir: number;   // lo que P4 pidió dejar en reserva
  actualRir: number;       // lo que el usuario percibió (0..4, 4 = "4+")
  reps?: number;
  kg?: number;
  date?: string;           // reciente pesa más
}

export type Confidence = 'baja' | 'media' | 'alta';

/** rirError = real − prescrito. Negativo = más agresivo de lo planeado (más cerca del
 *  fallo); positivo = quedó fácil (capacidad de sobra). */
export function rirError(o: { prescribedRir: number; actualRir: number }): number {
  return o.actualRir - o.prescribedRir;
}

/**
 * Error de RIR AGREGADO — media ponderada por recencia con protección de outliers: cada
 * error se acota a [−3,3] (una percepción rara no domina) y las observaciones recientes
 * pesan más (decay geométrico). Confianza por nº de observaciones (y penaliza usuario nuevo).
 */
export function aggregateRirError(
  observations: RirObservation[],
  opts: { isNewUser?: boolean } = {},
): { meanError: number; n: number; confidence: Confidence } {
  const obs = observations.filter(o => Number.isFinite(o.actualRir) && Number.isFinite(o.prescribedRir));
  const n = obs.length;
  if (n === 0) return { meanError: 0, n: 0, confidence: 'baja' };

  // recientes primero (si hay fecha); decay 0.85 por posición.
  const ordered = [...obs].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  let wsum = 0, acc = 0;
  ordered.forEach((o, i) => {
    const w = Math.pow(0.85, i);
    const e = Math.max(-3, Math.min(3, rirError(o))); // clamp outlier
    acc += e * w; wsum += w;
  });
  const meanError = wsum > 0 ? acc / wsum : 0;

  let confidence: Confidence = n >= 4 ? 'alta' : n >= 2 ? 'media' : 'baja';
  if (opts.isNewUser) confidence = confidence === 'alta' ? 'media' : 'baja'; // usuario nuevo → menos confianza
  return { meanError: Math.round(meanError * 100) / 100, n, confidence };
}

const CONF_WEIGHT: Record<Confidence, number> = { baja: 0.3, media: 0.7, alta: 1.0 };

/**
 * Calibración del motor de carga desde el RIR real → multiplicador ACOTADO para la próxima
 * prescripción. error>0 (quedó fácil) → sube; error<0 (muy cerca del fallo) → baja. Escalado
 * por confianza; tope ±5% (nunca saltos grandes); usuario nuevo / pocas obs → ajuste mínimo.
 * Sin observaciones → factor 1.0 (no cambia nada, fallback puro).
 */
export function loadCalibration(input: {
  observations: RirObservation[];
  isNewUser?: boolean;
}): { factor: number; confidence: Confidence; meanError: number } {
  const { meanError, n, confidence } = aggregateRirError(input.observations, { isNewUser: input.isNewUser });
  if (n === 0) return { factor: 1, confidence, meanError: 0 };
  // 2% por unidad de RIR, escalado por confianza, acotado a ±5%.
  const raw = meanError * 0.02 * CONF_WEIGHT[confidence];
  const factor = 1 + Math.max(-0.05, Math.min(0.05, raw));
  return { factor: Math.round(factor * 1000) / 1000, confidence, meanError };
}

/**
 * Autoajuste ENTRE series: tras una serie claramente fuera del RIR objetivo, sugiere un
 * ajuste PEQUEÑO para la siguiente. Umbral |error|≥2 (una desviación de 1 es ruido). Nunca
 * cambia la sesión entera: solo propone delta de carga o mantener. Sin carga comparable
 * (topKg ausente) → sugiere ajustar por esfuerzo/reps, no por kg.
 */
export function nextSetSuggestion(input: {
  prescribedRir: number;
  actualRir: number;
  topKg?: number;
  inc?: number;
}): { action: 'reduce' | 'increase' | 'hold'; deltaKg?: number; nextKg?: number; reason: 'harder' | 'easier' | 'on-target' } {
  const err = rirError(input);
  if (Math.abs(err) < 2) return { action: 'hold', reason: 'on-target' };
  const action = err < 0 ? 'reduce' : 'increase';
  const reason = err < 0 ? 'harder' : 'easier';
  if (input.topKg == null || input.topKg <= 0) return { action, reason }; // sin kg comparable
  const inc = input.inc ?? 2.5;
  // ~5% por el exceso de error más allá del umbral, acotado; redondeado al incremento real.
  const pct = Math.min(0.075, 0.05 * (Math.abs(err) - 1));
  const delta = roundToIncrement(input.topKg * pct, inc);
  const signed = action === 'reduce' ? -delta : delta;
  return { action, reason, deltaKg: signed, nextKg: Math.max(0, roundToIncrement(input.topKg + signed, inc)) };
}
