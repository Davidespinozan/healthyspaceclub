// ─────────────────────────────────────────────────────────────────────────────
// cardioPlayability (F2C-6) · AUTORIDAD ÚNICA de si una estación puede EJECUTARSE en una fase
// de cardio. Unifica los tres criterios que antes vivían sueltos y en desacuerdo:
//   · cardioStationCapabilities(ex)[phase] — compatibilidad FISIOLÓGICA/semántica (manda primero)
//   · hasPlayableVariant                   — reproducibilidad por VIDEO real
//   · isReproducibleStation (branch B)     — reproducibilidad VIDEOLESS de cardio continuo auto-explicativo
//
// REGLA (fail-closed):
//   1. La CAPABILITY de fase manda: si la estación no puede servir esa fase → NO, aunque tenga video.
//      (VIDEO ≠ permiso fisiológico. plancha/burpee/escaladores NUNCA son steady/recovery/cooldown.)
//   2. Con capability OK: si tiene VIDEO para el equipo → playable (cualquier fase).
//   3. Sin video: SOLO fases CONTINUAS (steady/recovery/cooldown) y SOLO si la estación es cardio
//      continuous-safe, de equipo compatible, y el propio sistema ya la considera reproducible sin
//      demostración (isReproducibleStation branch B: marcha/paso — instrucciones + timer bastan).
//      interval/power/drill SIEMPRE exigen video (movimientos técnicos).
//
// No toca cardioMain, capabilities, pools internos, ledger ni Composer. Es puro y testeable.
// ─────────────────────────────────────────────────────────────────────────────
import type { Exercise, Equipment } from '../types';
import type { Implement } from './equipmentImplement';
import { cardioStationCapabilities, type CardioPhaseRole } from './cardioMain';
import { hasPlayableVariant, isReproducibleStation } from './workoutPlanner';
import { videoPolicyFor, type VideoPolicy } from './videoAvailability';

const CONTINUOUS_PHASES: readonly CardioPhaseRole[] = ['steady', 'recovery', 'cooldown'];
const isContinuousPhase = (p: CardioPhaseRole): boolean => CONTINUOUS_PHASES.includes(p);

/**
 * ¿La estación `ex` puede ejecutarse en la fase `phase` con este `equipment`?
 * Fail-closed: capability primero, luego video, y solo entonces la excepción videoless (política 'preferred').
 * F2C-9A · la decisión required/preferred sale de la POLÍTICA CENTRAL (`videoPolicyFor`), no está hardcodeada
 * aquí: cardio CONTINUO = 'preferred' (admite videoless seguro, F2C-6), intenso = 'required'. `videoPolicy`
 * es un override opcional para tests/futuro; sin él, el comportamiento es idéntico a F2C-6/7/8.
 */
export function isPlayableForCardioPhase(
  ex: Exercise,
  equipment: Equipment[],
  phase: CardioPhaseRole,
  allowed?: Set<Implement>,
  videoPolicy?: VideoPolicy,
): boolean {
  // 1) CAPABILITY de fase (autoridad fisiológica). Sin ella → fuera, tenga o no video.
  if (!cardioStationCapabilities(ex)[phase]) return false;
  // 2) VIDEO real para el equipo → reproducible en cualquier fase.
  if (hasPlayableVariant(ex, equipment, allowed)) return true;
  // 3) sin video: la POLÍTICA decide. 'required' → fuera; 'preferred' → se admite videoless SEGURO.
  const continuous = isContinuousPhase(phase);
  const policy = videoPolicy ?? videoPolicyFor({ role: continuous ? 'cardioContinuous' : 'cardioIntense' });
  if (policy === 'required') return false;                     // interval/power/drill (o flip futuro) exigen clip
  if (!continuous) return false;                               // guardia: videoless SOLO en fases continuas
  const equipOk = ex.equipment.some(e => equipment.includes(e));
  return ex.muscleGroup === 'cardio' && equipOk && isReproducibleStation(ex, equipment);
}

/** ¿La estación puede servir ALGUNA fase continua (steady/recovery/cooldown)? Base del support pool. */
export function isCardioSupportStation(
  ex: Exercise,
  equipment: Equipment[],
  allowed?: Set<Implement>,
): boolean {
  return CONTINUOUS_PHASES.some(p => isPlayableForCardioPhase(ex, equipment, p, allowed));
}

/**
 * Ensambla el SUPPORT POOL (estaciones para fases continuas) con PREFERENCIA de calidad:
 * las estaciones CON VIDEO (bici/elíptica/caminadora) mandan; las VIDELESS (marcha/paso) son
 * FALLBACK que solo entra cuando no hay ninguna con video para este equipo.
 *
 * Consecuencia deseada:
 *   · GYM (bici/elíptica con video) → withVideo no vacío → support pool IDÉNTICO a antes (byte-identical).
 *   · BODYWEIGHT (sin cardio continuo con video) → withVideo vacío → marcha/paso desbloquean el continuo.
 */
export function buildCardioSupportPool(
  bank: Exercise[],
  equipment: Equipment[],
  allowed?: Set<Implement>,
): Exercise[] {
  const all = bank.filter(e =>
    (e.type === 'cardio' || e.muscleGroup === 'cardio') && isCardioSupportStation(e, equipment, allowed));
  const withVideo = all.filter(e => hasPlayableVariant(e, equipment, allowed));
  return withVideo.length > 0 ? withVideo : all;
}
