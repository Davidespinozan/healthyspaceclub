// ─────────────────────────────────────────────────────────────────────────
// cardioSessionAudit (F2C-3) · AUDITOR DE CALIDAD de un CardioMainPlan. Detecta PROPIEDADES malas de
// una sesión (no nombres de ejercicios): rondas excesivas, intensidad mal distribuida, recovery/steady
// sobre estación incompatible (impacto/fallRisk), repetición absurda entre roles, etc. Puro; pensado
// para tests/harness (no persiste en producción). Es el criterio de "calidad", no solo "verde".
// ─────────────────────────────────────────────────────────────────────────
import type { Exercise } from '../types';
import type { CardioMainPlan, CardioBlock } from './cardioMain';
import { cardioStationCapabilities } from './cardioMain';

export type CardioAuditFlag =
  | 'excessiveRounds'                 // un bloque intenso con demasiadas rondas
  | 'excessiveHighIntensityMinutes'   // demasiados minutos totales a alta intensidad
  | 'excessiveRecovery'               // recovery demasiado largo o sin siguiente estímulo intenso
  | 'incompatibleStationRole'         // bloque continuo sobre estación sin la capacidad requerida
  | 'unsupportedContinuousStation'    // alias del caso "movimiento no-continuo usado como steady largo"
  | 'unsupportedSteadyStation'        // steady sobre estación sin capacidad steady
  | 'unsupportedRecoveryStation'      // recovery sobre estación sin capacidad recovery
  | 'unsupportedCooldownStation'      // cooldown sobre estación sin capacidad cooldown
  | 'nonCardioStationInCardio'        // bloque cuya estación no es muscleGroup='cardio'
  | 'continuousDurationExceeded'      // bloque continuo > maxContinuousMinutes de la estación
  | 'intervalDoseExceededForStation'  // rondas por encima de lo que la demanda de la estación admite
  | 'unsafeFallback'                  // steady/recovery sobre estación impact='high'/fallRisk
  | 'inappropriatePhaseRole'          // cualquier bloque cuya estación no soporta ese rol de fase
  | 'repeatedStation'                 // misma estación en ≥3 bloques (repetición absurda entre roles)
  | 'redundantBlocks'                 // dos bloques adyacentes idénticos (kind+station) sin razón
  | 'poorIntensityDistribution'       // fracción intensa demasiado alta para una sesión aeróbica
  | 'suspiciousLongSession'           // sesión larga con demasiado HIIT (debería ser aeróbica)
  | 'suspiciousShortSession'          // sesión corta incoherente (varios bloques intensos, sin estructura)
  | 'intensityBudgetExceeded'         // (con budget provisto) minutos intensos > techo permitido
  | 'exceedsBudget';                  // totalMinutes > budget

export interface CardioAuditMetrics {
  blocks: number;
  totalMinutes: number;
  intenseMinutes: number;
  intenseFraction: number;
  recoveryMinutes: number;
  steadyMinutes: number;
  maxRounds: number;
  totalIntenseBlocks: number;
  distinctStations: number;
}
export interface CardioSessionAudit { flags: CardioAuditFlag[]; metrics: CardioAuditMetrics; }

const CONTINUOUS: CardioBlock['kind'][] = ['steady', 'recovery', 'cooldown'];  // F2C-7 · cooldown = fase continua
const INTENSE_KINDS: CardioBlock['kind'][] = ['intervals', 'power'];
const intenseMinOf = (b: CardioBlock) => (INTENSE_KINDS.includes(b.kind) ? Math.round(((b.rounds ?? 0) * (b.workSec ?? 0)) / 60) : b.intensity === 'alta' ? b.minutes : 0);

/**
 * Audita un CardioMainPlan. `stationsById` da la metadata (impact/fallRisk/cardioStyle) para juzgar
 * elegibilidad de estación por rol. `intenseAllow` opcional habilita el flag intensityBudgetExceeded.
 */
export function auditCardioSession(
  plan: CardioMainPlan,
  stationsById: Map<string, Exercise>,
  intenseAllow?: number,
): CardioSessionAudit {
  const flags = new Set<CardioAuditFlag>();
  const blocks = plan.blocks;
  const total = plan.totalMinutes;

  const intenseMinutes = blocks.reduce((a, b) => a + intenseMinOf(b), 0);
  const recoveryMinutes = blocks.filter(b => b.kind === 'recovery').reduce((a, b) => a + b.minutes, 0);
  const steadyMinutes = blocks.filter(b => b.kind === 'steady' && b.intensity !== 'alta').reduce((a, b) => a + b.minutes, 0);
  const intenseBlocks = blocks.filter(b => INTENSE_KINDS.includes(b.kind));
  const maxRounds = blocks.reduce((m, b) => Math.max(m, b.rounds ?? 0), 0);
  const stationCount = new Map<string, number>();
  for (const b of blocks) if (b.stationId) stationCount.set(b.stationId, (stationCount.get(b.stationId) ?? 0) + 1);
  const intenseFraction = total > 0 ? intenseMinutes / total : 0;

  // 1) exceso de rondas: por bloque (>14) O acumuladas en la sesión (>18 → densidad de intervalos excesiva,
  //    p.ej. dos circuitos de 12 = 24). Detecta el "12×40/20 → 12×40/20" del caso real.
  const totalRounds = intenseBlocks.reduce((a, b) => a + (b.rounds ?? 0), 0);
  if (maxRounds > 14 || totalRounds > 20) flags.add('excessiveRounds');   // 2×10=20 avanzado OK; 2×12=24 no
  // 2) demasiados minutos intensos absolutos
  if (intenseMinutes > 30) flags.add('excessiveHighIntensityMinutes');
  if (intenseAllow != null && intenseMinutes > intenseAllow + 1) flags.add('intensityBudgetExceeded');
  // 3) distribución de intensidad: >45% intenso ≠ sesión aeróbica bien programada (salvo que sea corta)
  if (intenseFraction > 0.45 && total >= 20) flags.add('poorIntensityDistribution');
  // 4) sesión larga con demasiado HIIT
  if (total >= 60 && (intenseBlocks.length >= 3 || intenseFraction > 0.35)) flags.add('suspiciousLongSession');
  // 5) sesión corta incoherente: <15' con ≥2 bloques intensos
  if (total > 0 && total < 15 && intenseBlocks.length >= 2) flags.add('suspiciousShortSession');
  // 6) exceso de budget
  if (total > plan.budgetMinutes) flags.add('exceedsBudget');

  // 7) capacidad de estación por FASE (F2C-4) — el bug central. Cada bloque exige que su estación
  //    declare/derive la capacidad de ese rol; si no → flag (fail closed). Continuo = steady/recovery/cooldown.
  for (const b of blocks) {
    const ex = stationsById.get(b.stationId);
    if (!ex) continue;
    const caps = cardioStationCapabilities(ex);
    // ninguna estación de cardio puede ser muscleGroup ≠ cardio (core/fuerza colada por relajación)
    if (ex.muscleGroup !== 'cardio') flags.add('nonCardioStationInCardio');
    if (CONTINUOUS.includes(b.kind) && b.intensity !== 'alta') { // 'alta' = tempo, se juzga por intensidad
      const isRecovery = b.kind === 'recovery';
      const roleOk = isRecovery ? caps.recovery : caps.steady; // cooldown = steady kind en el motor
      if (!roleOk) {
        flags.add('incompatibleStationRole'); flags.add('inappropriatePhaseRole');
        flags.add('unsupportedContinuousStation');
        flags.add(isRecovery ? 'unsupportedRecoveryStation' : 'unsupportedSteadyStation');
        if (isRecovery) flags.add('unsupportedCooldownStation'); // conservador: recovery/cooldown comparten capacidad
      }
      if (caps.maxContinuousMinutes > 0 && b.minutes > caps.maxContinuousMinutes) flags.add('continuousDurationExceeded');
      if (ex.impact === 'high' || ex.fallRisk) flags.add('unsafeFallback');
    }
    if (INTENSE_KINDS.includes(b.kind)) {
      if (b.kind === 'power' && !caps.power) { flags.add('inappropriatePhaseRole'); }
      else if (b.kind === 'intervals' && !caps.interval) { flags.add('inappropriatePhaseRole'); }
      // dosis por demanda: una estación de ALTA demanda no debería superar ~8 rondas
      if (caps.demand === 'high' && (b.rounds ?? 0) > 8) flags.add('intervalDoseExceededForStation');
    }
  }

  // 8) recovery: largo o sin siguiente bloque intenso que justifique la recuperación
  blocks.forEach((b, i) => {
    if (b.kind !== 'recovery') return;
    if (b.minutes > 8) flags.add('excessiveRecovery');
    const hasNextIntense = blocks.slice(i + 1).some(n => INTENSE_KINDS.includes(n.kind));
    if (!hasNextIntense && b.minutes > 6) flags.add('excessiveRecovery'); // recovery largo sin estímulo posterior
  });

  // 9) repetición absurda: misma estación en ≥3 bloques NO-cooldown (un steady largo es UN bloque → no
  //    penaliza). El COOLDOWN es una fase de cierre distinta (F2C-7): reutilizar la estación para bajar
  //    pulsaciones no es repetición absurda, así que no cuenta aquí (sí sigue atrapando abuso real, p.ej.
  //    la misma estación intensa en 3 bloques principales).
  const nonCooldownCount = new Map<string, number>();
  for (const b of blocks) if (b.stationId && b.kind !== 'cooldown') nonCooldownCount.set(b.stationId, (nonCooldownCount.get(b.stationId) ?? 0) + 1);
  for (const [, count] of nonCooldownCount) if (count >= 3) flags.add('repeatedStation');
  // 10) bloques adyacentes idénticos (kind+station)
  for (let i = 1; i < blocks.length; i++) {
    if (blocks[i].kind === blocks[i - 1].kind && blocks[i].stationId === blocks[i - 1].stationId) flags.add('redundantBlocks');
  }

  return {
    flags: [...flags],
    metrics: {
      blocks: blocks.length, totalMinutes: total, intenseMinutes,
      intenseFraction: Math.round(intenseFraction * 100) / 100,
      recoveryMinutes, steadyMinutes, maxRounds,
      totalIntenseBlocks: intenseBlocks.length, distinctStations: stationCount.size,
    },
  };
}

/** Subconjunto de flags CRÍTICOS (una sesión con cualquiera de estos está mal programada). */
export const CRITICAL_CARDIO_FLAGS: CardioAuditFlag[] = [
  'excessiveRounds', 'excessiveHighIntensityMinutes', 'excessiveRecovery',
  'incompatibleStationRole', 'unsupportedContinuousStation', 'unsupportedSteadyStation',
  'unsupportedRecoveryStation', 'unsupportedCooldownStation', 'nonCardioStationInCardio',
  'continuousDurationExceeded', 'intervalDoseExceededForStation', 'unsafeFallback',
  'inappropriatePhaseRole', 'repeatedStation', 'poorIntensityDistribution',
  'suspiciousLongSession', 'suspiciousShortSession', 'intensityBudgetExceeded', 'exceedsBudget',
];

// ── F2C-7 · QUALITY WARNINGS (PROGRAMACIÓN, no seguridad) ───────────────────────────────────────
// Detectan una sesión VÁLIDA pero MAL PROGRAMADA (minute-filler): steady residual dominante, un bloque
// continuo eterno, bloques redundantes, falta de cooldown, label engañosa, distribución de fases pobre.
// NO son CRITICAL: una sesión con estos flags sigue siendo segura/ejecutable; señalan calidad premium.
// Detección por PROPIEDADES (no IDs) y STYLE-AWARE (lowImpact con mucho continuo NO es un defecto).
export type CardioQualityFlag =
  | 'residualSteadyDominatesSession'   // sesión de acondicionamiento >75% steady (no lowImpact)
  | 'excessiveSingleStationDuration'   // un bloque continuo demasiado largo en una estación (tedio)
  | 'redundantContinuousBlocks'        // ≥2 bloques continuos adyacentes de la MISMA estación
  | 'poorPhaseDistribution'            // hay intervalos/potencia pero sin fase primaria material o sin cooldown
  | 'intensityLabelMismatch'           // label 'baja' con intervalos/potencia presentes
  | 'missingCooldownSemantics';        // sesión con trabajo intenso y sin fase de cooldown explícita

export interface CardioQualityAudit { flags: CardioQualityFlag[]; }

// STYLE-AWARE (§15): lowImpact tolera tramos continuos más largos (el continuo ES el estímulo).
const SINGLE_STATION_MAX = (style: CardioMainPlan['style']) => (style === 'lowImpact' ? 40 : 30);
const STEADY_DOMINANCE = 0.75;   // en sesión de acondicionamiento, >75% continuo = mal balanceada

/**
 * Auditoría de CALIDAD de PROGRAMACIÓN (F2C-7). Separada de auditCardioSession (safety). `label` = la
 * etiqueta de intensidad ya calculada (sessionIntensityLabel). Devuelve solo warnings; nunca bloquea.
 */
export function auditCardioQuality(
  plan: CardioMainPlan,
  label: 'baja' | 'media' | 'alta',
): CardioQualityAudit {
  const flags = new Set<CardioQualityFlag>();
  const blocks = plan.blocks;
  const isLowImpact = plan.style === 'lowImpact';
  const hasIntense = blocks.some(b => b.kind === 'intervals' || b.kind === 'power');
  const hasCooldown = blocks.some(b => b.kind === 'cooldown');
  const continuousMin = blocks.filter(b => b.kind === 'steady' || b.kind === 'recovery' || b.kind === 'cooldown').reduce((a, b) => a + b.minutes, 0);

  // 1) steady residual domina una sesión de ACONDICIONAMIENTO con capacidad intensa material (>3' intenso).
  //    No aplica a lowImpact (el continuo ES el estímulo) ni a sesiones donde el intenso es mínimo por nivel.
  if (!isLowImpact && hasIntense && plan.intenseMinutes >= 5 && plan.totalMinutes > 0 && continuousMin / plan.totalMinutes > STEADY_DOMINANCE) {
    flags.add('residualSteadyDominatesSession');
  }
  // 2) bloque continuo excesivamente largo en una estación (style-aware; safety es aparte).
  for (const b of blocks) {
    if ((b.kind === 'steady' || b.kind === 'recovery' || b.kind === 'cooldown') && b.minutes > SINGLE_STATION_MAX(plan.style)) {
      flags.add('excessiveSingleStationDuration');
    }
  }
  // 3) bloques continuos adyacentes de la MISMA estación (fragmentación sin rotación = redundante).
  for (let i = 1; i < blocks.length; i++) {
    const a = blocks[i - 1], c = blocks[i];
    const bothContinuous = (a.kind === 'steady' || a.kind === 'recovery' || a.kind === 'cooldown') &&
                           (c.kind === 'steady' || c.kind === 'recovery' || c.kind === 'cooldown');
    if (bothContinuous && a.stationId === c.stationId) flags.add('redundantContinuousBlocks');
  }
  // 4) distribución de fases: trabajo intenso presente pero sin cooldown, o sin nada continuo de soporte.
  if (hasIntense && plan.totalMinutes >= 20 && !hasCooldown) flags.add('missingCooldownSemantics');
  if (hasIntense && plan.intenseMinutes < 3) flags.add('poorPhaseDistribution');
  // 5) label engañosa (con la fórmula F2C-7 no debería ocurrir; guard de regresión).
  if (label === 'baja' && hasIntense) flags.add('intensityLabelMismatch');

  return { flags: [...flags] };
}
