// ─────────────────────────────────────────────────────────────────────────
// dailyCardioPlacement — POLÍTICA DIARIA del Session Composer (F2A, helper puro/inerte, sin consumers).
//
// Responde "¿conviene colocar HOY parte del cardio estructurado restante?" SIN tocar la dosis de fuerza.
// La fuerza ya está prescrita (P4); este helper solo la LEE (strengthPlannedMinutes) y usa el SOBRANTE
// de tiempo. El número de cardio sale de la NECESIDAD semanal repartida (weeklyPolicy.remaining), NO del
// reloj: se acota por caps de interferencia/recuperación y por el spare. availableMinutes = CAP, no cuota.
//
// F2A es AGNÓSTICO al motor: recibe `sessionEndReason` YA derivado (la obtención correcta — GAP-A
// timeFitTrimmed / GAP-B headroomEndedEarly — es trabajo de F2B). NO llama prescribeSession/P4, NO toca
// cardioMain/allocateTime/finisher. Números en DAILY_CARDIO_CALIBRATION (PRODUCT_CALIBRATION, recalibrable).
// ─────────────────────────────────────────────────────────────────────────
import type { CardioStyle, TrainingGoal } from '../types';
import type { WeeklyCardioPolicy, CardioIntensityCeiling } from './weeklyCardioPolicy';
import type { SessionEndReason } from './sessionEndReason';

/** PRODUCT_CALIBRATION (decisión de producto HSC, recalibrable) — NO guías médicas. */
export const DAILY_CARDIO_CALIBRATION = {
  expectedRemainingExposures: 2,       // no volcar todo el remaining hoy (≈ repartir en 2 exposiciones)
  minCardioMinutes: 10,                // exposición mínima útil; por debajo → 0 (nunca redondear ARRIBA para alcanzarla)
  strengthDailyCapMinutes: 15,         // trainingGoal='fuerza' → proteger el lift
  heavyLowerDailyCapMinutes: 15,       // lower / full-body → menor interferencia con piernas
  noRecentBaseDailyCapMinutes: 15,     // sin base cardio reciente → conservador
  // HEURÍSTICA v1 (PRODUCT_CALIBRATION): remaining <= dailyCap → puede resolverse en UNA exposición hoy.
} as const;

export interface DailyCardioInput {
  availableMinutes: number;            // selectedTime — CAP, no target
  preparationMinutes: number;          // warm-up planeado (fijo)
  strengthPlannedMinutes: number;      // planPlannedMinutes de la fuerza (output P4, NO modificable)
  weeklyPolicy: WeeklyCardioPolicy;    // deriveWeeklyCardioPolicy
  sessionEndReason: SessionEndReason;  // deriveSessionEndReason (ya derivado — F2A agnóstico al motor)
  readinessLow: boolean;
  deload: boolean;
  trainingGoal: TrainingGoal;
  dayType: string;                     // 'upper' | 'lower' | 'full-body' | 'push' | 'pull' | ...
  lowImpactMode: boolean;
  hasPain: boolean;
}

export interface DailyCardioPlacement {
  shouldPlaceCardio: boolean;
  minutes: number;                     // 0 o ≥ minCardioMinutes
  style: CardioStyle;                  // para buildCardioMain (F2B) — solo se DEGRADA, nunca se escala
  intensityCeiling: CardioIntensityCeiling;
  reason: SessionEndReason;            // 'HYBRID_COMPLETE' si se coloca cardio; si no, el reason original
  suppressFinisher: boolean;
  spareMinutes: number;
}

const isHeavyLowerDay = (dayType: string) => dayType === 'lower' || dayType === 'full-body';

export function deriveDailyCardioPlacement(input: DailyCardioInput): DailyCardioPlacement {
  const K = DAILY_CARDIO_CALIBRATION;
  const spareMinutes = Math.max(0, input.availableMinutes - input.preparationMinutes - input.strengthPlannedMinutes);
  const remaining = input.weeklyPolicy.structured.remainingMinutes;

  // Salida "sin colocar": conserva el reason ORIGINAL y NO suprime finisher.
  const noPlacement = (): DailyCardioPlacement => ({
    shouldPlaceCardio: false, minutes: 0,
    style: input.weeklyPolicy.preferredStyle, intensityCeiling: input.weeklyPolicy.intensityCeiling,
    reason: input.sessionEndReason, suppressFinisher: false, spareMinutes,
  });

  // ── HARD GATES → cardio 0 ──
  if (remaining <= 0 || input.readinessLow || input.deload
      || input.sessionEndReason === 'TIME_LIMITED' || input.sessionEndReason === 'RECOVERY_LIMITED'
      || spareMinutes < K.minCardioMinutes) {
    return noPlacement();
  }

  // ── NECESIDAD diaria (NO min(spare, cap)) ──
  const dailyNeed = remaining <= input.weeklyPolicy.dailyCapMinutes
    ? remaining
    : Math.max(K.minCardioMinutes, Math.round(remaining / K.expectedRemainingExposures));

  // ── CAPS (interferencia / recuperación / base) ──
  let cap = input.weeklyPolicy.dailyCapMinutes;
  if (input.trainingGoal === 'fuerza') cap = Math.min(cap, K.strengthDailyCapMinutes);
  if (isHeavyLowerDay(input.dayType)) cap = Math.min(cap, K.heavyLowerDailyCapMinutes);
  if (!input.weeklyPolicy.hasRecentCardioBase) cap = Math.min(cap, K.noRecentBaseDailyCapMinutes);

  const minutes = Math.min(dailyNeed, cap, spareMinutes);
  if (minutes < K.minCardioMinutes) return noPlacement();   // no colocar migajas (nunca redondear arriba)

  // ── INTENSIDAD (interferencia): lower/full-body/fuerza/lowImpact/pain → zona2 hoy ──
  let intensityCeiling: CardioIntensityCeiling = input.weeklyPolicy.intensityCeiling;
  if (isHeavyLowerDay(input.dayType) || input.trainingGoal === 'fuerza' || input.lowImpactMode || input.hasPain) {
    intensityCeiling = 'zona2';
  }

  // ── STYLE: solo DEGRADAR para respetar ceiling/lowImpact/pain (nunca escalar a algo más agresivo) ──
  let style: CardioStyle = input.weeklyPolicy.preferredStyle;
  if (intensityCeiling === 'zona2' && (style === 'funcional' || style === 'explosividad')) style = 'lowImpact';
  if (input.lowImpactMode || input.hasPain) style = 'lowImpact';

  return {
    shouldPlaceCardio: true, minutes, style, intensityCeiling,
    reason: 'HYBRID_COMPLETE', suppressFinisher: true, spareMinutes,
  };
}
