// ─────────────────────────────────────────────────────────────────────────
// sessionComposer — ORQUESTADOR PURO del Session Composer (F2B-1). Encadena los 4 helpers ya
// cerrados para producir la decisión de composición de UNA sesión (fuerza + cardio estructurado
// opcional). NO prescribe fuerza, NO toca ejercicios/P4, NO construye cardio, NO persiste, NO
// modifica ningún helper cerrado. Solo coordina:
//
//   computeWeeklyCardio → deriveWeeklyCardioPolicy → deriveSessionEndReason → deriveDailyCardioPlacement
//
// selectedTime = availableMinutes (CAP, no cuota). La fuerza YA está prescrita: el composer solo LEE
// strengthPlannedMinutes y usa el SOBRANTE. timeFitTrimmed viene EXACTO de prescribeSession (F2B-0),
// nunca inferido de planned≈budget. Puro y determinista (nowMs inyectable para tests).
// ─────────────────────────────────────────────────────────────────────────
import type { CardioStyle, TrainingGoal, CompletedSession } from '../types';
import { computeWeeklyCardio } from './computeWeeklyCardio';
import { deriveWeeklyCardioPolicy, type CardioIntensityCeiling } from './weeklyCardioPolicy';
import { deriveSessionEndReason, type SessionEndReason } from './sessionEndReason';
import { deriveDailyCardioPlacement, type DailyCardioPlacement } from './dailyCardioPlacement';
import type { CachedWorkout } from './workoutCache';

export interface ComposeSessionInput {
  // Autoridades de minutos (todas REALES del plan final, no del budget de allocateTime).
  availableMinutes: number;       // selectedTime — CAP
  preparationMinutes: number;     // warmupBlock.minutes FINAL (no budget.warmup)
  strengthPlannedMinutes: number; // planPlannedMinutes de la fuerza FINAL (excluye warmup/finisher/cardio)
  // Señales del fin de la fuerza.
  strengthWeeklyRemaining: number;// sets de fuerza restantes esta semana (≥0) — señal P4, NUNCA cardio
  timeFitTrimmed: boolean;        // diagnostics.timeFitTrimmed EXACTO de prescribeSession (F2B-0)
  headroomEndedEarly: boolean;    // señal INDEPENDIENTE de headroom (solo hipertrofia)
  readinessLow: boolean;
  deload: boolean;
  // Cardio semanal (datos REALES del miembro).
  completedSessions: CompletedSession[];
  nowMs: number;
  bodyGoal: string;               // obData.goal
  trainingGoal: TrainingGoal;
  lowImpactMode: boolean;
  hasPain: boolean;
  dayType: string;                // split final (guardedSplit/anchorDayType), normalizado aquí
}

export interface ComposeSessionResult {
  sessionEndReason: SessionEndReason;
  placement: DailyCardioPlacement;
  // Solo presente si se coloca cardio — este es el spec que se SELLA en el plan (autoridad tras reload).
  composedCardio?: { minutes: number; style: CardioStyle; intensityCeiling: CardioIntensityCeiling };
  suppressFinisher: boolean;
  spareMinutes: number;
  structuredCardioRemaining: number;
}

/** Normalización mínima del split para el placement (item 8): legs → lower. No re-clasifica por músculos. */
function normalizeDayType(dayType: string): string {
  return dayType === 'legs' ? 'lower' : dayType;
}

// ── CEILING como HARD CEILING (F2B-1 · fix a/b) ──────────────────────────────
// `intensityCeiling` es un TECHO REAL, no solo un label. buildCardioMain no conoce el ceiling: modela
// intensidad por style+level+readiness. Como NO tocamos el motor, adaptamos sus INPUTS para que el
// contenido construido respete zona2. Estos clamps son deterministas y NO cambian nada aguas arriba
// (defaultCardioStyle/weeklyCardioPolicy/dailyCardioPlacement intactos); solo el spec/inputs de construcción.

/**
 * FIX (a) · style seguro para el ceiling. Bajo zona2, cualquier style que el motor sabe convertir en
 * Z3/Z4/Z5 (correr → bloque tempo 'alta'; funcional → circuitos; explosividad → potencia) se degrada a
 * 'lowImpact' (sostenible). moderate NO degrada (control positivo: la policy decide hasta moderate).
 */
export function ceilingSafeCardioStyle(ceiling: CardioIntensityCeiling, style: CardioStyle): CardioStyle {
  if (ceiling !== 'zona2') return style;
  return style === 'correr' || style === 'funcional' || style === 'explosividad' ? 'lowImpact' : style;
}

/**
 * FIX (b) · level EFECTIVO de construcción para el ceiling. Bajo zona2, 'avanzado' hace que el motor
 * inyecte un segundo bloque 'media'/Z3 (gated por nivel, no por readiness/deload) incluso en lowImpact →
 * lo acotamos a 'intermedio'. NO cambia el nivel real del miembro, NO se persiste, NO toca obData.
 */
export function ceilingSafeCardioLevel(ceiling: CardioIntensityCeiling, level: string): string {
  if (ceiling !== 'zona2') return level;
  return level === 'avanzado' ? 'intermedio' : level;
}

export function composeSession(input: ComposeSessionInput): ComposeSessionResult {
  // 1) POR QUÉ terminó la fuerza (señales fisiológicas, NO duración sola). weeklyRemaining = FUERZA.
  const end = deriveSessionEndReason({
    availableMinutes: input.availableMinutes,
    plannedMinutes: input.strengthPlannedMinutes,
    weeklyRemaining: input.strengthWeeklyRemaining,
    timeFitTrimmed: input.timeFitTrimmed,
    headroomEndedEarly: input.headroomEndedEarly,
    readinessLow: input.readinessLow,
    deload: input.deload,
  });

  // 2) Política semanal de cardio estructurado (datos reales; remaining ≠ remaining de fuerza).
  const completedCardio = computeWeeklyCardio(input.completedSessions, input.nowMs);
  const weeklyPolicy = deriveWeeklyCardioPolicy({
    bodyGoal: input.bodyGoal,
    trainingGoal: input.trainingGoal,
    lowImpactMode: input.lowImpactMode,
    hasPain: input.hasPain,
    completedCardio,
  });

  // 3) ¿Colocar HOY parte del cardio restante? Necesidad diaria (no reloj); usa el SOBRANTE, no roba fuerza.
  const placement = deriveDailyCardioPlacement({
    availableMinutes: input.availableMinutes,
    preparationMinutes: input.preparationMinutes,
    strengthPlannedMinutes: input.strengthPlannedMinutes,
    weeklyPolicy,
    sessionEndReason: end.reason,
    readinessLow: input.readinessLow,
    deload: input.deload,
    trainingGoal: input.trainingGoal,
    dayType: normalizeDayType(input.dayType),
    lowImpactMode: input.lowImpactMode,
    hasPain: input.hasPain,
  });

  // FIX (a) · el style SELLADO respeta el ceiling: bajo zona2 nunca llega un style que produzca Z3+.
  const composedCardio = placement.shouldPlaceCardio
    ? {
        minutes: placement.minutes,
        style: ceilingSafeCardioStyle(placement.intensityCeiling, placement.style),
        intensityCeiling: placement.intensityCeiling,
      }
    : undefined;

  return {
    // Si se coloca cardio, el motivo del día es HYBRID_COMPLETE (lo sella el placement); si no, el real de fuerza.
    sessionEndReason: placement.reason,
    placement,
    composedCardio,
    suppressFinisher: placement.suppressFinisher,
    spareMinutes: placement.spareMinutes,
    structuredCardioRemaining: weeklyPolicy.structured.remainingMinutes,
  };
}

/**
 * Sella las decisiones del Composer SOBRE el plan del día (mutación in-memory, NO persiste, NO hace I/O).
 * DEBE llamarse DESPUÉS de guardar el workout genérico en la caché COMPARTIDA (saveWorkoutToCache) — así
 * la caché nunca recibe composedCardio/sessionEndReason (per-usuario) ni pierde el finisher genérico:
 *  · agrega composedCardio (si hay) y sessionEndReason SOLO al objeto del día;
 *  · elimina finisherBlock del plan del día cuando el cardio ocupa su lugar (nunca finisher + cardio juntos).
 * El snapshot que la caché tomó por spread (síncrono, antes de este sello) queda intacto.
 */
export function sealComposedSession(
  daily: CachedWorkout,
  result: Pick<ComposeSessionResult, 'composedCardio' | 'sessionEndReason' | 'suppressFinisher'>,
): CachedWorkout {
  daily.sessionEndReason = result.sessionEndReason;
  if (result.composedCardio) daily.composedCardio = { ...result.composedCardio };
  if (result.suppressFinisher) delete daily.finisherBlock;
  return daily;
}
