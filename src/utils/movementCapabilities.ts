// ─────────────────────────────────────────────────────────────────────────────
// F2C-9B.1 · MOVEMENT CAPABILITY MODEL (foundation, ADITIVO, sin consumidores productivos).
//
// Separa MOVEMENT (Exercise/Variant) de CAPABILITY (qué estímulos puede soportar FÍSICAMENTE).
// `deriveMovementCapabilities` infiere capabilities de la metadata física existente (goals/type/
// cardioStyle/impact/fallRisk/equipment/prescriptionType), reusando la autoridad de cardio F2C-4
// (`cardioStationCapabilities`) para los workModes de cardio. `resolveMovementCapabilities` aplica
// el override declarativo opcional (`ex/variant.capabilities`) que REEMPLAZA el eje derivado.
//
// NO decide session role, prescription, safety, equipment-eligibility ni video (F2C-9A) — esos son
// ejes ortogonales que consultan OTRAS autoridades. Puro, determinista, fail-closed, sin mutación.
// Este gate crea la foundation; NINGÚN motor productivo lo consume todavía (9B.2/9B.3 lo harán).
// ─────────────────────────────────────────────────────────────────────────────
import type {
  Exercise, ExerciseVariant, CardioStyle, MovementRole, WorkMode, WarmupPhase, MovementCapabilities,
} from '../types';
import { cardioStationCapabilities } from './cardioMain';   // F2C-4 · autoridad física de cardio (reuso, no duplico)

// Orden determinista para normalización (mismos inputs → deepEqual).
const ROLE_ORDER: readonly MovementRole[] = ['strength', 'conditioning', 'power', 'locomotion', 'warmup', 'cooldown', 'skill'];
const WORKMODE_ORDER: readonly WorkMode[] = ['reps', 'isometric', 'interval', 'continuous'];
const PHASE_ORDER: readonly WarmupPhase[] = ['raise', 'mobilise', 'activate', 'potentiate'];

function sortUnique<T>(arr: readonly T[], order: readonly T[]): T[] {
  return [...new Set(arr)].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}
function normalize(roles: MovementRole[], workModes: WorkMode[], warmupPhases: WarmupPhase[]): MovementCapabilities {
  const out: MovementCapabilities = { roles: sortUnique(roles, ROLE_ORDER), workModes: sortUnique(workModes, WORKMODE_ORDER) };
  if (warmupPhases.length) out.warmupPhases = sortUnique(warmupPhases, PHASE_ORDER);
  return out;
}

/**
 * Deriva capabilities de la metadata FÍSICA (pura/determinista/fail-closed). Acepta `variant` para
 * refinar (F2C-8): la variante puede tener su propio cardioStyle/equipment (ej. cardio-maquina →
 * caminadora='correr'/locomoción; remo='lowImpact'/no-locomoción). NO muta Exercise/Variant.
 */
export function deriveMovementCapabilities(ex: Exercise, variant?: ExerciseVariant): MovementCapabilities {
  // Vista EFECTIVA de la variante (leaf) — mismo patrón que F2C-8 expandContinuousStations.
  const effStyle: CardioStyle | undefined = variant?.cardioStyle ?? ex.cardioStyle;
  const effEquipment = variant?.equipment ?? ex.equipment ?? [];
  const eff = variant
    ? ({ ...ex, id: variant.id, cardioStyle: effStyle, equipment: effEquipment, variants: [] } as Exercise)
    : ex;

  const goals = ex.goals ?? [];
  const type = ex.type;
  const isCardio = ex.muscleGroup === 'cardio' || type === 'cardio';
  const mechSafe = ex.impact !== 'high' && ex.fallRisk !== true;

  const roles: MovementRole[] = [];
  const workModes: WorkMode[] = [];
  const warmupPhases: WarmupPhase[] = [];

  // ── ROLES ──
  if (goals.includes('fuerza') || goals.includes('hipertrofia') || type === 'compuesto' || type === 'aislamiento') roles.push('strength');
  if (goals.includes('condicion')) roles.push('conditioning');
  if (type === 'movilidad') { roles.push('warmup', 'cooldown'); warmupPhases.push('mobilise'); }
  if (type === 'activacion') { roles.push('warmup'); warmupPhases.push('activate'); }
  if (effStyle === 'explosividad') roles.push('power');
  // LOCOMOTION = locomoción por GAIT: correr (trote/cinta) o marcha/paso bodyweight de bajo impacto.
  // Máquinas estacionarias (bici/elíptica/remo) NO son locomoción aunque sean lowImpact continuas.
  const isGait = effStyle === 'correr' || (effStyle === 'lowImpact' && effEquipment.includes('cuerpo'));
  if (isCardio && mechSafe && isGait) roles.push('locomotion');
  // skill NO se deriva (solo override).

  // ── WORK MODES ──
  // Cardio: REUSA la autoridad física F2C-4 (continuous/interval/power por variante).
  if (isCardio) {
    const caps = cardioStationCapabilities(eff);
    if (caps.steady || caps.recovery || caps.cooldown) workModes.push('continuous');
    if (caps.interval) workModes.push('interval');
    if (caps.power && effStyle === 'explosividad') roles.push('power');
  }
  // Reps: movimientos por repeticiones (fuerza/funcional). Isometric: solo si la metadata lo declara.
  if (type === 'compuesto' || type === 'aislamiento' || type === 'funcional') workModes.push('reps');
  if (ex.prescriptionType === 'time') workModes.push('isometric');

  return normalize(roles, workModes, warmupPhases);
}

/**
 * Capabilities RESUELTAS = derive + override declarativo. El override (variant.capabilities ganan sobre
 * ex.capabilities) REEMPLAZA por EJE: si trae `roles`, reemplaza roles; idem workModes/warmupPhases.
 * Semántica simple y auditable (sin merges mágicos). Para agregar-conservando-lo-derivado, la metadata
 * declara el set final explícito. NO muta; NO conoce ids concretos.
 */
export function resolveMovementCapabilities(ex: Exercise, variant?: ExerciseVariant): MovementCapabilities {
  const derived = deriveMovementCapabilities(ex, variant);
  const override = variant?.capabilities ?? ex.capabilities;
  if (!override) return derived;
  return normalize(
    override.roles ?? derived.roles,
    override.workModes ?? derived.workModes,
    override.warmupPhases ?? derived.warmupPhases ?? [],
  );
}

/** Consulta pura de capabilities. Sin video, sin equipment, sin safety, sin contexto de usuario. */
export function hasMovementCapability(caps: MovementCapabilities, role: MovementRole, workMode?: WorkMode): boolean {
  return caps.roles.includes(role) && (workMode === undefined || caps.workModes.includes(workMode));
}
