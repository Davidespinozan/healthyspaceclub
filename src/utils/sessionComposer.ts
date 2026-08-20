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

/**
 * F2C-1 MUST FIX 2 · RECONCILIACIÓN (read-only). Minutos de cardio estructurado que AÚN faltan esta semana
 * según el estado REAL de completedSessions (solo cardio HSC, modality='cardio'). Reutiliza los helpers
 * cerrados SIN modificarlos. NO recomputa el spec sellado; sirve para decidir si un composedCardio pending
 * SIGUE siendo necesario (remaining>0) o ya quedó cubierto por otro cardio HSC (remaining===0 → satisfecho).
 * lowImpact/hasPain NO afectan el remaining (solo el ceiling/style), por eso no se piden aquí.
 */
/**
 * F2C-1 MUST FIX 1 · preserva la decisión de cardio del día al construir un plan supplemental de fuerza (D1).
 * D1 sigue siendo SOLO fuerza: copia composedCardio (pending o done) TAL CUAL, sin recomputar/marcar/duplicar.
 * Si el día no tenía cardio, no agrega nada. Puro; no toca ledger, structuredCardioRemaining ni workout_cache.
 */
export function carrySealedCardio<T extends Record<string, unknown>>(
  supPlan: T,
  dayPlan: { composedCardio?: unknown } | null | undefined,
): T {
  const cc = dayPlan?.composedCardio;
  return cc == null ? supPlan : { ...supPlan, composedCardio: cc };
}

export function structuredCardioRemainingNow(input: {
  completedSessions: CompletedSession[];
  nowMs: number;
  bodyGoal: string;
  trainingGoal: TrainingGoal;
}): number {
  const completedCardio = computeWeeklyCardio(input.completedSessions, input.nowMs);
  return deriveWeeklyCardioPolicy({
    bodyGoal: input.bodyGoal,
    trainingGoal: input.trainingGoal,
    lowImpactMode: false,
    hasPain: false,
    completedCardio,
  }).structured.remainingMinutes;
}

// F2C-2 · estado derivado (una sola autoridad, sin persistir) del composedCardio del día.
export type ComposedCardioState = 'none' | 'pending' | 'satisfied' | 'done';

/**
 * F2C-2 · Estado VIVO del composedCardio: none (no hay) / done (ejecuté ESTE bloque) / satisfied (otro
 * cardio HSC ya cubrió la necesidad semanal → no ofrecer, ≠ done) / pending (sigue vigente). Deriva de
 * completedSessions (read-only, reutiliza structuredCardioRemainingNow). Es la ÚNICA autoridad que
 * consumen WorkoutPlan (oferta) y Today (label/CTA) → sin duplicar policy ni recomputar el spec sellado.
 */
export function composedCardioLiveState(input: {
  composedCardio: { done?: boolean } | null | undefined;
  completedSessions: CompletedSession[];
  nowMs: number;
  bodyGoal: string;
  trainingGoal: TrainingGoal;
}): ComposedCardioState {
  const cc = input.composedCardio;
  if (!cc) return 'none';
  if (cc.done === true) return 'done';
  const remaining = structuredCardioRemainingNow({
    completedSessions: input.completedSessions, nowMs: input.nowMs,
    bodyGoal: input.bodyGoal, trainingGoal: input.trainingGoal,
  });
  return remaining === 0 ? 'satisfied' : 'pending';
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
