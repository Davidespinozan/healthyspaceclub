// ════════════════════════════════════════════════════════════════
// partnerView — identidad A/B y selección de prescripción por persona en modo pareja.
//
// El workout se GENERA en el dispositivo de A (owner) y se ENTREGA tal cual a B. En el JSON:
//   · A (owner)   → reps / tip_personalizado
//   · B (partner) → repsB / tipB
//   · format      → coordinación por ejercicio (juntos/alternado/asistido)
//
// Antes: repsB solo se mostraba en modo un-dispositivo → en dos dispositivos B veía las reps
// de A. Fix: se estampa `ownerId` (id del generador) en el workout; cada dispositivo sabe si es
// el owner (A) o el compañero (B) comparando su propio id, y B ve su propia prescripción.
// ════════════════════════════════════════════════════════════════

/** ¿El dispositivo actual es el COMPAÑERO (B), no el generador (A)? Fuente de verdad estable
 *  (sobrevive recargas): comparación de ids, no orden de conexión ni heurística de render. */
export function isPartnerBDevice(myId: string | null, ownerId: string | null | undefined, partnerMode: boolean): boolean {
  return !!(partnerMode && myId && ownerId && myId !== ownerId);
}

export interface PartnerExercise {
  reps: string;
  repsB?: string;
  tip_personalizado?: string;
  tipB?: string;
}

/**
 * Devuelve el ejercicio con la prescripción que corresponde a ESTE dispositivo. Para el
 * compañero (B) con repsB definido, mueve repsB→reps y tipB→tip para que TODO el player
 * (display, timer, logging, swap) use la prescripción de B de forma transparente. Para A
 * (o sin repsB, o single-device) devuelve el ejercicio sin cambios.
 */
export function partnerExerciseView<T extends PartnerExercise>(ex: T, iAmPartnerB: boolean): T {
  if (!iAmPartnerB || !ex.repsB) return ex;
  return { ...ex, reps: ex.repsB, tip_personalizado: ex.tipB ?? ex.tip_personalizado };
}
