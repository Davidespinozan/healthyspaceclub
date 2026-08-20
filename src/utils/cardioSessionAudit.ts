// ─────────────────────────────────────────────────────────────────────────
// cardioSessionAudit (F2C-3) · AUDITOR DE CALIDAD de un CardioMainPlan. Detecta PROPIEDADES malas de
// una sesión (no nombres de ejercicios): rondas excesivas, intensidad mal distribuida, recovery/steady
// sobre estación incompatible (impacto/fallRisk), repetición absurda entre roles, etc. Puro; pensado
// para tests/harness (no persiste en producción). Es el criterio de "calidad", no solo "verde".
// ─────────────────────────────────────────────────────────────────────────
import type { Exercise } from '../types';
import type { CardioMainPlan, CardioBlock } from './cardioMain';
import { cardioStationRole } from './cardioMain';

export type CardioAuditFlag =
  | 'excessiveRounds'                 // un bloque intenso con demasiadas rondas
  | 'excessiveHighIntensityMinutes'   // demasiados minutos totales a alta intensidad
  | 'excessiveRecovery'               // recovery demasiado largo o sin siguiente estímulo intenso
  | 'incompatibleStationRole'         // bloque continuo (steady/recovery/cooldown) sobre estación no sostenible
  | 'unsupportedContinuousStation'    // alias explícito del caso "saltos usados como steady largo"
  | 'unsafeFallback'                  // steady/recovery sobre estación impact='high'/fallRisk
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

const CONTINUOUS: CardioBlock['kind'][] = ['steady', 'recovery'];
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

  // 7) estación incompatible con bloque CONTINUO (steady/recovery/cooldown) — el bug central
  for (const b of blocks) {
    if (!CONTINUOUS.includes(b.kind)) continue;
    if (b.intensity === 'alta') continue; // un tempo 'alta' no es continuo sostenible; se juzga por intensidad
    const ex = stationsById.get(b.stationId);
    if (!ex) continue;
    const sustainable = cardioStationRole(ex).sustainable;
    if (!sustainable) { flags.add('incompatibleStationRole'); flags.add('unsupportedContinuousStation'); }
    if (ex.impact === 'high' || ex.fallRisk) flags.add('unsafeFallback');
  }

  // 8) recovery: largo o sin siguiente bloque intenso que justifique la recuperación
  blocks.forEach((b, i) => {
    if (b.kind !== 'recovery') return;
    if (b.minutes > 8) flags.add('excessiveRecovery');
    const hasNextIntense = blocks.slice(i + 1).some(n => INTENSE_KINDS.includes(n.kind));
    if (!hasNextIntense && b.minutes > 6) flags.add('excessiveRecovery'); // recovery largo sin estímulo posterior
  });

  // 9) repetición absurda: misma estación en ≥3 bloques (un steady largo es UN bloque → no penaliza)
  for (const [, count] of stationCount) if (count >= 3) flags.add('repeatedStation');
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
  'incompatibleStationRole', 'unsupportedContinuousStation', 'unsafeFallback',
  'repeatedStation', 'poorIntensityDistribution', 'suspiciousLongSession',
  'suspiciousShortSession', 'intensityBudgetExceeded', 'exceedsBudget',
];
