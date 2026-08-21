// ─────────────────────────────────────────────────────────────────────────────
// F2C-9B.3 · CONDITIONING ADAPTER — traduce MovementCapabilities (9B.1) al contrato LEGACY que
// el planner de cardio (cardioMain, F2C-4→8) ya sabe consumir, SIN crear una segunda autoridad y
// SIN editar cardioMain/cardioStationCapabilities.
//
// Responde SOLO: "este movimiento (variante) declara capability conditioning + interval → puede
// servir como estación de INTERVALO funcional". El planner existente sigue decidiendo si puede
// usarse AQUÍ/AHORA (fase, dosis, equipo, video, seguridad). La modalidad de sesión decide a qué
// ledger acredita (9B.2). Capability ≠ video ≠ prescription ≠ training credit.
//
// MAPPING mínimo (fail-closed): roles⊇conditioning ∧ workModes⊇interval → INTERVAL. NADA más:
//   NO steady/recovery/cooldown/continuous, NO power, NO locomotion, NO drill. `reps` por sí solo
//   NO convierte un movimiento en interval de cardio.
//
// La vista adaptada es EFÍMERA y a nivel EXERCISE (spread, no mutación). NUNCA escribe
// variant.cardioStyle (dispararía isCardioMachineBank → expansión de máquinas F2C-8). El campo
// `cardioRoles` (hook explícito que cardioStationCapabilities ya lee por cast) queda como detalle
// INTERNO del adapter — no se añade al tipo público Exercise.
// ─────────────────────────────────────────────────────────────────────────────
import type { Exercise, ExerciseVariant, Equipment } from '../types';
import type { Implement } from './equipmentImplement';
import { variantAllowedByGear } from './equipmentImplement';
import { resolveMovementCapabilities } from './movementCapabilities';
import { hasVideo } from './videoAvailability';
import type { CardioPhaseRole } from './cardioMain';

/** Vista efímera con el hook interno `cardioRoles` (no forma parte del tipo público Exercise). */
type ConditioningStationView = Exercise & { cardioRoles?: CardioPhaseRole[] };

/** ¿Es un movimiento de identidad cardio? (marcha/burpee/máquinas). Esos NO pasan por el adapter:
 *  ya los gobierna F2C-4 por su propia metadata. */
function isCardioIdentity(ex: Exercise): boolean {
  return ex.muscleGroup === 'cardio' || ex.type === 'cardio';
}

/**
 * ¿La VARIANTE declara capability conditioning + interval? (autoridad 9B.1, resuelta por variante).
 * Fail-closed: reps solo NO basta; exige AMBOS (role conditioning ∧ workMode interval).
 */
export function isConditioningIntervalVariant(ex: Exercise, variant: ExerciseVariant): boolean {
  const caps = resolveMovementCapabilities(ex, variant);
  return caps.roles.includes('conditioning') && caps.workModes.includes('interval');
}

/**
 * ¿ALGUNA variante (o el propio ejercicio) declara conditioning + interval? — señal de ADMISIÓN
 * al pool de cardio (capability pura, sin equipo/video). VARIANT-AWARE: un parent se admite solo
 * porque una variante concreta lo declara; NO abre las demás variantes.
 */
export function hasConditioningIntervalCapability(ex: Exercise): boolean {
  if (isCardioIdentity(ex)) return false;   // cardio nativo se admite por la vía legacy, no por aquí
  const exLevel = resolveMovementCapabilities(ex);
  if (exLevel.roles.includes('conditioning') && exLevel.workModes.includes('interval')) return true;
  return (ex.variants ?? []).some(v => isConditioningIntervalVariant(ex, v));
}

/**
 * La VARIANTE concreta prescribible como conditioning interval para este equipo AHORA:
 * capability conditioning+interval ∧ segura (no alto impacto / fallRisk) ∧ equipo compatible ∧
 * gear compatible ∧ VIDEO real (interval = policy 'required'; NO fallback videoless).
 * Devuelve null si ninguna → CAPABILITY VALID ≠ PRESCRIBABLE (CONTENT_LIMITED). VARIANT-AWARE:
 * solo abre la(s) variante(s) autorizada(s), nunca las pesadas hermanas.
 */
export function conditioningVariantFor(
  ex: Exercise,
  equipment: Equipment[],
  allowed?: Set<Implement>,
): ExerciseVariant | null {
  if (isCardioIdentity(ex)) return null;
  // SAFETY fail-closed: la capability NO bypassa seguridad (alto impacto / riesgo de caída fuera).
  if (ex.impact === 'high' || ex.fallRisk === true) return null;
  for (const v of ex.variants ?? []) {
    if (!isConditioningIntervalVariant(ex, v)) continue;
    if (!v.equipment.some(e => equipment.includes(e))) continue;      // equipo respetado (variant-aware)
    if (allowed && !variantAllowedByGear(v, allowed, ex.name)) continue;
    if (!hasVideo(v.id)) continue;                                    // interval ⇒ video REQUIRED
    return v;
  }
  return null;
}

/**
 * Vista efímera de ESTACIÓN de intervalo funcional para el planner. A nivel EXERCISE:
 * `cardioStyle:'funcional'` (para el pool de estilo funcional y matchesStyle) + `cardioRoles:['interval']`
 * (para que cardioStationCapabilities conceda SOLO interval, bypass de isCardio SIN editar F2C-4).
 * `variants` restringidas a la variante autorizada; `equipment` = el de esa variante. NO muta el banco.
 */
export function toConditioningStation(ex: Exercise, variant: ExerciseVariant): ConditioningStationView {
  return {
    ...ex,
    cardioStyle: 'funcional',
    cardioRoles: ['interval'],
    equipment: [...variant.equipment],
    variants: [variant],
  };
}

/**
 * Enriquece un pool de candidatos: sustituye cada movimiento NO-cardio con variante conditioning
 * prescribible por su estación efímera de intervalo funcional. El resto (cardio nativo o sin
 * capability/video) pasa INTACTO (misma referencia). Puro, determinista, no-mutante. INERTE cuando
 * no hay overrides de capabilities (equivalencia exacta con el pool legacy).
 */
export function enrichConditioningPool(
  pool: Exercise[],
  equipment: Equipment[],
  allowed?: Set<Implement>,
): Exercise[] {
  return pool.map(ex => {
    const v = conditioningVariantFor(ex, equipment, allowed);
    return v ? toConditioningStation(ex, v) : ex;
  });
}

/**
 * variantId de la variante conditioning para una estación (post cardioBlocksToExercises): el player
 * la respeta (selectVariantForEquipment honra preferredVariantId con video) → muestra la variante
 * bodyweight correcta, no la hermana pesada. undefined si la estación no es conditioning aquí.
 */
export function conditioningVariantIdFor(
  stationId: string,
  bank: Exercise[],
  equipment: Equipment[],
  allowed?: Set<Implement>,
): string | undefined {
  const ex = bank.find(e => e.id === stationId);
  if (!ex) return undefined;
  return conditioningVariantFor(ex, equipment, allowed)?.id;
}
