// ─────────────────────────────────────────────────────────────────────────
// readiness — P6: separa READINESS AGUDA (hoy) de RECUPERACIÓN CRÓNICA (tendencia).
//
//  · AGUDA: check-in mínimo pre-sesión (energía/sueño/soreness). Modifica SOLO la sesión
//    de HOY (dosis/intensidad). Un mal día NO reescribe el plan.
//  · CRÓNICA: varias sesiones seguidas con readiness baja + RIR real peor de lo esperado
//    + performance cayendo → señal para P1/P3 (frenar progresión, bajar volumen, adelantar
//    deload). Esta es la única que toca la PLANIFICACIÓN.
//
// No es un score falso "83.7": estados interpretables LOW/NORMAL/HIGH. Reutiliza los tipos
// Recovery/Trend del mesociclo — no crea un segundo sistema de autorregulación. Soreness ≠
// DOLOR (el dolor/limitación va por la infra de pain/discomfort existente).
// ─────────────────────────────────────────────────────────────────────────
import type { Recovery, Trend } from './mesocycle';

export type EnergyLevel = 'baja' | 'normal' | 'alta';
export type SleepLevel = 'malo' | 'normal' | 'bueno';
export type SorenessLevel = 'ninguna' | 'leve' | 'alta';
export type ReadinessState = 'low' | 'normal' | 'high';

export interface Checkin {
  energy?: EnergyLevel;
  sleep?: SleepLevel;
  soreness?: SorenessLevel;
  sorenessMuscles?: string[]; // opcional, por zona/músculo (no obligatorio)
}

/**
 * Readiness AGUDA de hoy desde el check-in. Suma señales (cada una neutra si falta) →
 * estado interpretable. Todo ausente (cold start / check-in omitido) → NORMAL: nunca
 * bloquea entrenar. Devuelve también los factores que lo explican (para la nota de la IA).
 */
export function computeReadiness(c: Checkin): { state: ReadinessState; score: number; factors: string[] } {
  let score = 0;
  const factors: string[] = [];
  if (c.energy === 'baja') { score -= 1; factors.push('energía baja'); }
  else if (c.energy === 'alta') { score += 1; factors.push('energía alta'); }
  if (c.sleep === 'malo') { score -= 1; factors.push('durmió mal'); }
  else if (c.sleep === 'bueno') { score += 1; factors.push('durmió bien'); }
  if (c.soreness === 'alta') { score -= 1; factors.push('con agujetas fuertes'); }
  else if (c.soreness === 'leve') { score -= 0.5; factors.push('agujetas leves'); }

  const state: ReadinessState = score <= -1.5 ? 'low' : score >= 1.5 ? 'high' : 'normal';
  return { state, score, factors };
}

/**
 * Mapea la readiness aguda al tipo Recovery que ya consumen allocateSessionVolume /
 * determineIntensity — así HOY se dosifica sin un camino nuevo. SOLO para la sesión de hoy;
 * NO es la recovery que decide fase/deload del mesociclo (esa es la crónica).
 */
export function readinessToRecovery(state: ReadinessState): Recovery {
  return state === 'low' ? 'mala' : state === 'high' ? 'buena' : 'media';
}

/**
 * Tendencia de recuperación CRÓNICA — la que SÍ puede tocar la planificación (P1/P3). Exige
 * evidencia longitudinal (≥minSessions): 'declining' solo si la MAYORÍA de sesiones recientes
 * vienen con readiness baja Y (el RIR real quedó peor de lo esperado —errores negativos— o la
 * performance cae). 'improving' con readiness alta sostenida + performance al alza. Sin datos
 * suficientes → 'stable' (una mala noche no basta).
 */
export function chronicRecoveryTrend(input: {
  recentReadiness: ReadinessState[];   // por sesión, reciente→viejo
  rirErrors?: number[];                // media de rirError por sesión, reciente→viejo
  performance?: Trend;
  minSessions?: number;
}): 'declining' | 'stable' | 'improving' {
  const minSessions = input.minSessions ?? 3;
  const rd = input.recentReadiness.slice(0, Math.max(minSessions, 4));
  if (rd.length < minSessions) return 'stable'; // evidencia insuficiente

  const lows = rd.filter(s => s === 'low').length;
  const highs = rd.filter(s => s === 'high').length;
  const mostlyLow = lows >= Math.ceil(rd.length / 2);
  const mostlyHigh = highs >= Math.ceil(rd.length / 2);

  const errs = input.rirErrors ?? [];
  const negErrs = errs.filter(e => e <= -1).length;
  const rirWorse = errs.length >= 2 && negErrs >= Math.ceil(errs.length / 2);
  const perfDown = input.performance === 'baja';
  const perfUp = input.performance === 'sube';

  if (mostlyLow && (rirWorse || perfDown)) return 'declining';
  if (mostlyHigh && !perfDown && (perfUp || !rirWorse)) return 'improving';
  return 'stable';
}

/**
 * Convierte la tendencia crónica en la Recovery que alimenta deriveMesocycleState. declining
 * → 'mala' (puede frenar progresión / adelantar deload); improving → 'buena'; stable → 'media'.
 * Si NO hay señal crónica fiable, el llamador puede pasar su fallback (p.ej. el check-in previo).
 */
export function chronicToRecovery(trend: 'declining' | 'stable' | 'improving', fallback: Recovery = 'media'): Recovery {
  return trend === 'declining' ? 'mala' : trend === 'improving' ? 'buena' : fallback;
}
