// ─────────────────────────────────────────────────────────────────────────
// sessionEndReason — clasifica POR QUÉ una sesión de fuerza no necesariamente usa todo el tiempo
// disponible (Fase 1 del Session Composer). Puro. Deriva de SEÑALES FISIOLÓGICAS existentes, NO de la
// duración sola (ese fue el error de CASE F: `planned < selectedTime*0.75` NO demuestra volumen cubierto).
//
// availableMinutes/plannedMinutes son CONTEXTO (spareMinutes) y NO deciden el motivo → cambiar solo el
// tiempo disponible nunca altera arbitrariamente la clasificación. NO toca P4/prescribeSession/headroom.
// ─────────────────────────────────────────────────────────────────────────

export type SessionEndReason =
  | 'TIME_LIMITED'          // el time-fit recortó trabajo legítimo: cabía más con más tiempo
  | 'DOSE_COMPLETE'         // dosis útil de fuerza cubierta (headroom cedió + weekly remaining ≈ 0)
  | 'RECOVERY_LIMITED'      // readiness baja / deload: se contiene por recuperación, no por tiempo
  | 'AVAILABLE_TIME_UNUSED' // hay disponibilidad sin usar pero sin evidencia de las anteriores (fallback seguro)
  | 'HYBRID_COMPLETE';      // RESERVADO Fase 2 (fuerza + cardio compuesto) — NUNCA se deriva en Fase 1

export interface SessionEndInput {
  availableMinutes: number;      // selectedTime (CAP), solo contexto
  plannedMinutes: number;        // planPlannedMinutes de la fuerza, solo contexto
  weeklyRemaining: number;       // sets de fuerza restantes esta semana (≥0)
  timeFitTrimmed: boolean;       // prescribeSession recortó dosis por no caber en el tiempo (ver GAP F2)
  headroomEndedEarly?: boolean;  // headroom: sobró budget y NO había volumen útil que añadir (solo hipertrofia)
  readinessLow: boolean;
  deload: boolean;
}

export interface SessionEndResult {
  reason: SessionEndReason;
  spareMinutes: number;          // max(0, disponible − planeado) — contexto, no decide el motivo
}

// ≤1 set restante ≈ semana de fuerza cubierta (evita falsos por redondeo de dosis).
const REMAINING_EPS = 1;

/**
 * PRECEDENCIA (razonada, no por orden accidental):
 *  1) RECUPERACIÓN manda (deload || readinessLow): en un día de descarga/mal día NO queremos empujar al
 *     usuario a "buscar tiempo para hacer más" — la contención es deliberada y fisiológica. Domina incluso
 *     si el tiempo también fue corto (el mensaje accionable correcto es recuperación, no "haz más").
 *  2) TIME_LIMITED: el time-fit recortó trabajo legítimo → con más tiempo se haría más. Evidencia concreta.
 *  3) DOSE_COMPLETE: SOLO con evidencia real (headroom cedió por falta de volumen útil + weekly remaining
 *     ≈ 0). La duración corta por sí sola NUNCA basta (anti-CASE-F).
 *  4) AVAILABLE_TIME_UNUSED: fallback seguro y no comprometido — no afirma dosis cubierta sin evidencia.
 */
export function deriveSessionEndReason(input: SessionEndInput): SessionEndResult {
  const spareMinutes = Math.max(0, Math.round(input.availableMinutes - input.plannedMinutes));
  let reason: SessionEndReason;
  if (input.deload || input.readinessLow) {
    reason = 'RECOVERY_LIMITED';
  } else if (input.timeFitTrimmed) {
    reason = 'TIME_LIMITED';
  } else if (input.headroomEndedEarly === true && input.weeklyRemaining <= REMAINING_EPS) {
    reason = 'DOSE_COMPLETE';
  } else {
    reason = 'AVAILABLE_TIME_UNUSED';
  }
  return { reason, spareMinutes };
}
