// ─────────────────────────────────────────────────────────────────────────
// weeklyCardioPolicy — POLÍTICA de cardio ESTRUCTURADO semanal (GAP-C, helper puro/inerte de Fase 1).
//
// Distingue dos capas que NO se mezclan:
//   · healthReference: referencia poblacional de actividad aeróbica TOTAL (OMS/ACSM) — INFORMATIVA. HSC
//     no la genera ni la usa para calcular `remaining` (no medimos la actividad externa del usuario).
//   · structured: lo que HSC prescribe EXPLÍCITAMENTE, conservador y MEDIBLE (contra computeWeeklyCardio).
//
// Números centralizados en STRUCTURED_CARDIO_CALIBRATION (PRODUCT_CALIBRATION, recalibrable). NO usa
// strengthLevel, selectedTime, activityLevel→minutos, VO2/HR/pasos. NO prescribe HIIT automático. NO
// toca computeWeeklyCardio/cardioMain/motores. Aún SIN consumers (tree-shakeable).
// ─────────────────────────────────────────────────────────────────────────
import type { CardioStyle, TrainingGoal } from '../types';
import { defaultCardioStyle } from './workoutPlanner';
import type { WeeklyCardio } from './computeWeeklyCardio';

export type CardioTier = 'minimal' | 'low' | 'moderate';
export type CardioIntensityCeiling = 'zona2' | 'moderate';

/**
 * CALIBRACIÓN CENTRAL. Todo aquí es PRODUCT_CALIBRATION (decisión de producto HSC, recalibrable) EXCEPTO
 * healthReference, que es EVIDENCE-ANCHORED (OMS/ACSM) y solo informativo. NO son guías médicas universales.
 */
export const STRUCTURED_CARDIO_CALIBRATION = {
  tiers: {
    minimal: { range: [0, 20] as [number, number], anchor: 10 },
    low: { range: [20, 60] as [number, number], anchor: 40 },
    moderate: { range: [60, 120] as [number, number], anchor: 90 },
  },
  dailyCapMinutes: 25,
  // "Base cardio reciente" conductual (14d): varias exposiciones, no una sesión aislada. NO infiere VO2.
  recentCardioBase: { minSessions14d: 3, minMinutes14d: 60 },
  // EVIDENCE-ANCHORED (OMS/ACSM) · INFORMATIVO · NO entra en structured.remaining.
  healthReference: { moderateMinutesRange: [150, 300] as [number, number], vigorousMinutesRange: [75, 150] as [number, number] },
} as const;

export interface WeeklyCardioInput {
  bodyGoal: string;              // obData.goal (Ganar músculo/Bajar grasa/Recomposición/Bienestar)
  trainingGoal: TrainingGoal;    // hipertrofia | fuerza (interferencia)
  lowImpactMode: boolean;        // restricción EXPLÍCITA (edad/movilidad ya resuelta por el caller)
  hasPain: boolean;              // painArea declarado
  completedCardio: WeeklyCardio; // de computeWeeklyCardio (minutes7d/14d, sessions7d/14d)
  // NO se aceptan: activityLevel (cualitativo, no reduce target), age (no gatea por sí sola),
  // strengthLevel (proxy incorrecto), selectedTime (no es target).
}

export interface WeeklyCardioPolicy {
  healthReference: { moderateMinutesRange: [number, number]; vigorousMinutesRange: [number, number]; informationalOnly: true };
  structured: { prescriptionTier: CardioTier; targetMinutes: number; completedMinutes: number; remainingMinutes: number };
  preferredStyle: CardioStyle;
  intensityCeiling: CardioIntensityCeiling;
  dailyCapMinutes: number;
  hasRecentCardioBase: boolean;
  interferenceNotes: string[];
}

const TIER_ORDER: CardioTier[] = ['minimal', 'low', 'moderate'];
const minTier = (a: CardioTier, b: CardioTier): CardioTier =>
  TIER_ORDER.indexOf(a) <= TIER_ORDER.indexOf(b) ? a : b;

function baseTier(bodyGoal: string): CardioTier {
  const o = (bodyGoal || '').toLowerCase();
  if (/grasa|perder|adelgaz|quemar|definir/.test(o)) return 'moderate';   // perder grasa (acotado)
  if (/recomp/.test(o)) return 'low';
  if (/bienestar|salud|general/.test(o)) return 'low';
  if (/m[uú]sculo|ganar|hipertrof/.test(o)) return 'minimal';             // ganar músculo (mínimo estructurado)
  return 'low';                                                            // default conservador
}

export function hasRecentCardioBase(c: WeeklyCardio): boolean {
  const { minSessions14d, minMinutes14d } = STRUCTURED_CARDIO_CALIBRATION.recentCardioBase;
  return c.sessions14d >= minSessions14d && c.minutes14d >= minMinutes14d;
}

export function deriveWeeklyCardioPolicy(input: WeeklyCardioInput): WeeklyCardioPolicy {
  const { tiers, dailyCapMinutes, healthReference } = STRUCTURED_CARDIO_CALIBRATION;
  const base = hasRecentCardioBase(input.completedCardio);

  // ── TIER (volumen estructurado) ─────────────────────────────────────────
  let tier = baseTier(input.bodyGoal);
  if (input.trainingGoal === 'fuerza') tier = minTier(tier, 'low');   // protege el lift
  if (!base) tier = minTier(tier, 'low');                             // sin base → entrada conservadora (NO strengthLevel)
  // activityLevel NO modifica el tier v1 (cualitativo; sin equivalencia a minutos).

  const targetMinutes = tiers[tier].anchor;
  const completedMinutes = input.completedCardio.minutes7d;
  const remainingMinutes = Math.max(0, targetMinutes - completedMinutes);

  // ── INTENSITY CEILING (PRODUCT_CALIBRATION informed by evidence) ─────────
  // Default 'zona2' (baja interferencia). 'moderate' SOLO para perder grasa, sin fuerza, con base cardio y
  // sin restricción de impacto. lowImpactMode/hasPain fuerzan 'zona2' (NUNCA la edad por sí sola). HIIT: nunca v1.
  let intensityCeiling: CardioIntensityCeiling = 'zona2';
  if (/grasa|perder|adelgaz|quemar|definir/.test((input.bodyGoal || '').toLowerCase())
      && input.trainingGoal !== 'fuerza' && base && !input.lowImpactMode && !input.hasPain) {
    intensityCeiling = 'moderate';
  }
  if (input.lowImpactMode || input.hasPain) intensityCeiling = 'zona2';

  // ── STYLE (MODALIDAD, no volumen) — reutiliza defaultCardioStyle, clamp a v1 (nunca explosividad auto). ──
  let preferredStyle = defaultCardioStyle(input.bodyGoal, input.lowImpactMode);
  if (preferredStyle === 'explosividad') preferredStyle = 'funcional';
  if (intensityCeiling === 'zona2' && preferredStyle === 'funcional') preferredStyle = 'lowImpact';

  // ── NOTAS de interferencia (advisory para el Composer diario; no obligan nada aquí) ──
  const interferenceNotes: string[] = ['no-HIIT-auto-v1'];
  if (input.trainingGoal === 'fuerza') interferenceNotes.push('proteger-fuerza: cardio de baja interferencia, separar de días pesados');
  if (!base) interferenceNotes.push('sin-base-cardio: empezar suave y progresar con historial real');

  return {
    healthReference: { moderateMinutesRange: healthReference.moderateMinutesRange, vigorousMinutesRange: healthReference.vigorousMinutesRange, informationalOnly: true },
    structured: { prescriptionTier: tier, targetMinutes, completedMinutes, remainingMinutes },
    preferredStyle,
    intensityCeiling,
    dailyCapMinutes,
    hasRecentCardioBase: base,
    interferenceNotes,
  };
}
