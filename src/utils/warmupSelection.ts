// ─────────────────────────────────────────────────────────────────────────────
// F2C-9C.2A · CAPABILITY-DRIVEN WARMUP SELECTION + STRENGTH COOLDOWN (preview).
//
// Hace PRODUCTIVO el eje `warmupPhases` (9B.1, hasta ahora dead): la ELEGIBILIDAD de una fase de
// preparación (raise/mobilise/activate) o de cooldown se decide por MovementCapabilities, no por
// `type`/`muscleGroup` legacy. Rollout ADITIVO: los callers combinan capability OR legacy → con 0
// overrides nuevos la selección es EXACTAMENTE la actual (equivalencia Phase-1); la metadata GREEN
// (Phase-2) refina deliberadamente.
//
// Autoridad de selección: capability → context → safety → equipment → video/reproducibilidad → dose.
// NUNCA video→capability. Puro, determinista, sin mutación. NO conoce training credit (ExecutionRole
// 9C.1), ni e1RM, ni progression, ni cardioMain. NO inyecta cardioStyle ni crea IDs sintéticos.
//
// 9C.2A es PREVIEW: warmup/cooldown NO son ejecutables, NO producen LoggedSet ni ExecutionRole.
// ─────────────────────────────────────────────────────────────────────────────
import type { Exercise, Equipment, WarmupPhase } from '../types';
import { resolveMovementCapabilities } from './movementCapabilities';
import { isReproducibleStation, cardioEquipmentFor } from './workoutPlanner';

/** ¿La CAPABILITY del movimiento declara esta fase de warmup? (raise/mobilise/activate/potentiate). */
export function hasWarmupPhase(ex: Exercise, phase: WarmupPhase): boolean {
  return (resolveMovementCapabilities(ex).warmupPhases ?? []).includes(phase);
}

/** SAFETY fail-closed para cualquier movimiento de preparación (en frío): nunca alto impacto / caída. */
export function warmupSafe(ex: Exercise): boolean {
  return ex.impact !== 'high' && ex.fallRisk !== true;
}

// ── RAISE ────────────────────────────────────────────────────────────────────
/**
 * ¿`ex` es elegible como RAISE? capability(`warmupPhases⊇raise`) OR legacy(`roles⊇warmup`), SIEMPRE
 * cardio + safe + equipo + reproducible. El OR-legacy garantiza equivalencia Phase-1 (las máquinas ya
 * eran raise por su `roles` SessionRole); la metadata `warmupPhases:['raise']` lo vuelve capability-driven.
 */
export function isRaiseEligible(ex: Exercise, equipment: Equipment[]): boolean {
  const eq = cardioEquipmentFor(equipment);
  const capOrLegacy = hasWarmupPhase(ex, 'raise') || (ex.roles ?? []).includes('warmup');
  return ex.muscleGroup === 'cardio' && capOrLegacy && warmupSafe(ex) &&
    ex.equipment.some(e => eq.includes(e)) && isReproducibleStation(ex, eq);
}

// ── ACTIVATE / MOBILISE ──────────────────────────────────────────────────────
/**
 * ¿`ex` es elegible como ACTIVATE? capability(`warmupPhases⊇activate`) OR legacy(`type==='activacion'`),
 * + no yoga + equipo + reproducible. OR-legacy → equivalencia Phase-1 (activación por type sigue igual).
 */
export function isActivateEligible(ex: Exercise, equipment: Equipment[]): boolean {
  const eq = cardioEquipmentFor(equipment);
  const capOrLegacy = hasWarmupPhase(ex, 'activate') || ex.type === 'activacion';
  return capOrLegacy && !ex.isYoga && ex.equipment.some(e => eq.includes(e) || e === 'cuerpo') &&
    isReproducibleStation(ex, eq);
}

// ── COOLDOWN (strength preview) ──────────────────────────────────────────────
/**
 * ¿`ex` es un movimiento de COOLDOWN honesto? Requiere AFIRMACIÓN capability explícita:
 * role 'cooldown' Y `warmupPhases` VACÍO (los movilidad DERIVAN phase mobilise → una pose dinámica o
 * skill NO es cooldown). Solo las poses estáticas/gentiles con override `{roles:['cooldown'],
 * warmupPhases:[]}` califican → excluye por construcción skill/balance (chaturanga/crow/wheel) y
 * dinámicas (cat-cow). No video-gated aquí: el preview solo NOMBRA (policy 'preferred').
 */
export function isCooldownMovement(ex: Exercise): boolean {
  const caps = resolveMovementCapabilities(ex);
  return caps.roles.includes('cooldown') && (caps.warmupPhases ?? []).length === 0;
}

/**
 * Selecciona hasta `count` movimientos de cooldown (preview) para las zonas trabajadas. Determinista:
 * prefiere los que tienen video, orden estable del banco. Context best-effort (los yoga son
 * muscleGroup grueso → degrada a cuerpo-completo, honesto). PURO, no muta.
 */
export function selectCooldown(bank: Exercise[], equipment: Equipment[], count = 2): Exercise[] {
  const eq = cardioEquipmentFor(equipment);
  const usable = (ex: Exercise) => ex.equipment.some(e => eq.includes(e) || e === 'cuerpo');
  const pool = bank.filter(ex => isCooldownMovement(ex) && usable(ex));
  // Preferencia de calidad: con video primero (clip real), luego el resto (preview los nombra igual).
  const withVideo = pool.filter(ex => isReproducibleStation(ex, eq));
  const ordered = [...withVideo, ...pool.filter(ex => !withVideo.includes(ex))];
  return ordered.slice(0, Math.max(0, count));
}
