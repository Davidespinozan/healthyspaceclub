// ════════════════════════════════════════════════════════════════
// partnerView — identidad A/B y prescripción POR PERSONA en modo pareja.
//
// El workout se GENERA en el dispositivo de A (owner) y se ENTREGA a B. En el JSON:
//   · A (owner)   → reps / tip_personalizado / topKg / deloadKg / backoffKg
//   · B (partner) → repsB / tipB  (+ SHARED-1: topKgB / deloadKgB / backoffKgB)
//
// SHARED-1 · Gate B-1: antes B heredaba la CARGA prescrita de A (topKg). Ahora la
// carga de B se deriva de SU PROPIO historial (lookup, NO fórmula P2) en el
// dispositivo de B, se estampa como topKgB, y este view la mapea → cada quien ve
// su peso sugerido. El peso REGISTRADO sigue siendo individual por dispositivo.
// ════════════════════════════════════════════════════════════════

/** ¿El dispositivo actual es el COMPAÑERO (B), no el generador (A)? Estable por id. */
export function isPartnerBDevice(myId: string | null, ownerId: string | null | undefined, partnerMode: boolean): boolean {
  return !!(partnerMode && myId && ownerId && myId !== ownerId);
}

// ════════════════════════════════════════════════════════════════
// SHARED-1 B-2 · Envío EXPLÍCITO (generar ≠ enviar). Máquina de estados pura del
// CTA "Enviar rutina a X" — testeable sin renderizar el componente.
// ════════════════════════════════════════════════════════════════

export type PartnerSendState = 'idle' | 'sending' | 'sent' | 'conflict' | 'blocked' | 'error';

/** Mapea el resultado del RPC de entrega → estado del CTA. `delivered`→sent (éxito),
 *  `has-own`→conflict, `blocked`→blocked, cualquier otro→error (reintentable). */
export function nextPartnerSendState(
  result: 'delivered' | 'has-own' | 'not-connected' | 'blocked' | 'error',
): PartnerSendState {
  return result === 'delivered' ? 'sent'
    : result === 'has-own' ? 'conflict'
    : result === 'blocked' ? 'blocked'
    : 'error';
}

/** Guard idempotente del envío: NO se puede volver a enviar mientras 'sending' ni
 *  cuando ya está 'sent' (previene el doble-tap). Desde 'error'/'conflict'/'idle' sí. */
export function canSendToPartner(state: PartnerSendState): boolean {
  return state !== 'sending' && state !== 'sent';
}

/** ¿El usuario actual es el RECEPTOR de esta rutina de pareja? (mismo criterio que
 *  isPartnerBDevice: partnerMode && mi id ≠ ownerId=iniciador). Independiente de
 *  quién creó originalmente la partnership (requester/addressee). */
export function isWorkoutRecipient(myId: string | null, ownerId: string | null | undefined, partnerMode: boolean): boolean {
  return isPartnerBDevice(myId, ownerId, partnerMode);
}

export interface PartnerExercise {
  reps: string;
  repsB?: string;
  tip_personalizado?: string;
  tipB?: string;
  // Carga prescrita (número) — A-authored; *B son la variante por-persona (SHARED-1).
  topKg?: number;
  deloadKg?: number;
  backoffKg?: number;
  topKgB?: number;
  deloadKgB?: number;
  backoffKgB?: number;
}

/**
 * Devuelve el ejercicio con la prescripción que corresponde a ESTE dispositivo.
 * Para B (con repsB) mueve repsB→reps, tipB→tip y, si existen, las cargas *B→carga.
 * Fallback seguro: si falta una carga B, se conserva la de A (comportamiento previo).
 * Para A / sin repsB / single-device: sin cambios.
 */
export function partnerExerciseView<T extends PartnerExercise>(ex: T, iAmPartnerB: boolean): T {
  if (!iAmPartnerB || !ex.repsB) return ex;
  return {
    ...ex,
    reps: ex.repsB,
    tip_personalizado: ex.tipB ?? ex.tip_personalizado,
    topKg: ex.topKgB ?? ex.topKg,
    deloadKg: ex.deloadKgB ?? ex.deloadKg,
    backoffKg: ex.backoffKgB ?? ex.backoffKg,
  };
}

/**
 * Deriva la carga prescrita de B desde SU PROPIO historial (lookup, no fórmula).
 * `lastTopKgFor(ex)` devuelve el mayor kg que B registró la última vez en ese
 * ejercicio (o null si no hay historial). Estampa `topKgB` (y escala deloadKgB/
 * backoffKgB proporcionalmente si A los traía, para mantener la relación deload/
 * backoff sin recomputar la fórmula). Puro y testeable. NO toca la carga real.
 */
export function deriveBLoads<T extends PartnerExercise>(
  exercises: T[],
  lastTopKgFor: (ex: T) => number | null,
): T[] {
  return exercises.map((ex) => {
    const bTop = lastTopKgFor(ex);
    if (bTop == null || !(bTop > 0)) return ex; // sin historial → hereda la de A (fallback)
    const extra: Pick<PartnerExercise, 'topKgB' | 'deloadKgB' | 'backoffKgB'> = { topKgB: bTop };
    // Mantener la proporción deload/backoff que la fórmula de A ya calculó,
    // aplicada al top de B (regla de tres simple, no recomputo de P2).
    if (ex.topKg && ex.topKg > 0) {
      const ratio = bTop / ex.topKg;
      if (ex.deloadKg && ex.deloadKg > 0) extra.deloadKgB = Math.round((ex.deloadKg * ratio) / 2.5) * 2.5;
      if (ex.backoffKg && ex.backoffKg > 0) extra.backoffKgB = Math.round((ex.backoffKg * ratio) / 2.5) * 2.5;
    }
    return { ...ex, ...extra };
  });
}
