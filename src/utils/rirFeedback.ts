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


/** rirError = real − prescrito. Negativo = más agresivo de lo planeado (más cerca del
 *  fallo); positivo = quedó fácil (capacidad de sobra). */
export function rirError(o: { prescribedRir: number; actualRir: number }): number {
  return o.actualRir - o.prescribedRir;
}

// BLOQUE 2 · loadCalibration/aggregateRirError ELIMINADOS: eran un SEGUNDO mecanismo que
// corregía la carga por RIR además de la e1RM. Ahora el RIR corrige la carga por UN SOLO canal
// —la e1RM RIR-aware (loadEngine.prescribeLoad)— así que la calibración era redundante
// (double-dipping). El error de RIR sigue disponible (rirError) para la tendencia crónica (P6).

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
