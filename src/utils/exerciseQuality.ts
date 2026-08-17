// ─────────────────────────────────────────────────────────────────────────
// exerciseQuality — Fase 5C · RANKING DE CALIDAD DENTRO DEL SLOT (SFR práctico).
//
// La elegibilidad (gear/pain/lowImpact/pattern/role/slots/anchors/fatiga/video) ya la deciden
// otras capas. ESTE módulo responde, entre los ejercicios que YA son válidos para un slot:
// "¿cuál es la mejor opción para ESTE usuario/objetivo/sesión?" — NO "¿el mejor universal?".
//
// Política CONTEXTUAL y explicable con metadata REAL (role, pattern, setup, impact, fallRisk,
// difficulty). Sin score decimal falso: tiers discretos + razones. Reutiliza la clasificación
// (roleOf/movementPatternOf/setupClass) — no inventa fisiología ni resistanceProfile.
//
// Uso: (1) elección INICIAL del anchor; (2) orden de candidatos del pool (mejor primero, con la
// variedad/recencia como DESEMPATE); (3) reemplazo por fatiga (Fase 5B) — mejor alternativa, no la
// primera. Variedad es SEGUNDA: quality gap grande → no rota; gap pequeño → recency puede decidir.
// ─────────────────────────────────────────────────────────────────────────
import type { Exercise, TrainingGoal, Equipment } from '../types';
import { roleOf } from './exerciseRole';
import { setupClass } from './supersetEngine';
import { HEAVY_COMPOUND } from './exerciseOrder';

export type QualityTier = 'preferred' | 'good' | 'acceptable' | 'fallback';

export interface QualityContext {
  trainingGoal: TrainingGoal;
  level?: 'principiante' | 'intermedio' | 'avanzado' | string;
  /**
   * Equipo REAL del usuario (equipmentList: ej. ['cuerpo','gym'] o ['cuerpo']). Cuando se pasa,
   * "cargable" exige que el usuario tenga acceso a carga ('gym'), no solo que el PATRÓN tenga una
   * variante gym. Sin este campo se cae al comportamiento previo (unión del patrón) por compat.
   */
  equipment?: Equipment[];
}

const BALANCE_RE = /sissy|equilibrio/;                         // inestable por balance/técnica
const TECHNICAL_RE = /sissy|equilibrio|unilateral|bulgara|pliometr|z-press|zercher/; // exigente para novato

/**
 * Calidad de un ejercicio para su rol/slot, dado el contexto. Devuelve tier + score + razones.
 * PLIOMETRÍA/conditioning y alto impacto se penalizan fuerte (no son estímulo controlado normal);
 * máquina/polea = estable; cargable = progresable. Ajustado por trainingGoal y nivel.
 */
export function exerciseQuality(
  ex: Pick<Exercise, 'id' | 'name' | 'type' | 'muscleGroup' | 'isYoga' | 'impact' | 'fallRisk' | 'difficulty' | 'equipment'>,
  ctx: QualityContext,
): { tier: QualityTier; score: number; reasons: string[] } {
  const role = roleOf(ex, HEAVY_COMPOUND);
  const setup = setupClass(ex.id);
  const reasons: string[] = [];
  let score = 0;

  const plyometric = role === 'conditioning' || ex.impact === 'high' || ex.fallRisk === true;
  const balance = BALANCE_RE.test(ex.id);
  const compound = role === 'main' || role === 'secondary';
  // CARGABLE = existe una variante con carga (bucket 'gym') Y el usuario tiene ese equipo. Antes se
  // leía SOLO la unión del patrón (ex.equipment), sin contexto → un patrón con variante gym puntuaba
  // como "cargable" incluso para un usuario de peso corporal (heredaba puntos gym → hiperextensiones
  // dominaba también los pools bodyweight). Con contexto, se exige que el equipo del usuario incluya
  // 'gym'; sin contexto se cae a la unión del patrón (compat con llamadores que no pasan equipo).
  const userHasGym = ctx.equipment ? ctx.equipment.includes('gym') : true;
  const loadable = (ex.equipment ?? []).includes('gym') && userHasGym;

  // ESTABILIDAD / JERARQUÍA DE PATRÓN: pliométrico/balance no puntúan. Máquina/polea = muy estable
  // (+2; aislamiento productivo y controlado, ej. femoral/extensión/polea). Cargable libre: el
  // COMPUESTO (el mover del día) pesa MÁS que el aislamiento accesorio (+2 vs +1). ANTES era al revés
  // (+1 compuesto / +2 aislamiento): eso volvía a aislamientos estables (hiperextensiones, pullover,
  // shrugs) anchors universales por ENCIMA de sentadilla/press/remo. La estabilidad de un accesorio
  // no debe superar al mover principal. (Magnitud igual, solo se reasigna quién recibe el +2.)
  if (plyometric || balance) { /* sin bono de estabilidad */ }
  else if (setup === 'machine-cable') { score += 2; reasons.push('estable (máquina/polea)'); }
  else if (loadable) { score += compound ? 2 : 1; reasons.push(compound ? 'estable (compuesto cargable)' : 'estable (aislamiento cargable)'); }

  // PLIOMETRÍA / ALTO IMPACTO: no es estímulo controlado para un slot normal de fuerza/hipertrofia.
  if (plyometric) { score -= 5; reasons.push('pliométrico/alto impacto — conditioning, no slot controlado'); }
  // BALANCE-heavy (sissy/equilibrio): limita el esfuerzo sobre el objetivo.
  if (balance) { score -= 3; reasons.push('inestable (balance limita el estímulo)'); }

  // PROGRESABILIDAD / CARGABILIDAD.
  if (loadable) { score += 1; reasons.push('progresable (cargable)'); }
  else reasons.push('progresa por dificultad/tensión (no cargable)');

  // TRAINING GOAL: ambos prefieren carga/estímulo controlado; jamás pliometría en el slot.
  if (loadable) score += 1;
  if (plyometric) score -= 2;

  // NOTA: el compuesto ya lidera al aislamiento por el swap de estabilidad (+2 vs +1). NO se añade
  // un bono estático extra por role 'main': `role` es propiedad del EJERCICIO, no del slot actual, y
  // ese +1 sobre-promovía compuestos hacia slots accesorios (expulsaba aislamiento) y a splits donde
  // el ejercicio solo entra por músculo secundario. La jerarquía correcta la da la estabilidad.

  // NIVEL (leve; el advanced engine completo es fase futura).
  if (ctx.level === 'principiante') {
    if (setup === 'machine-cable') { score += 1; reasons.push('simple de aprender'); }
    if (plyometric || TECHNICAL_RE.test(ex.id)) { score -= 2; reasons.push('técnico para principiante'); }
  } else if (ctx.level === 'avanzado') {
    if (/unilateral|bulgara/.test(ex.id)) score += 0.5; // tolera variantes más específicas, con razón
  }

  const tier: QualityTier = score >= 4 ? 'preferred' : score >= 2 ? 'good' : score >= 0 ? 'acceptable' : 'fallback';
  return { tier, score, reasons };
}

/** Puntaje numérico (para ordenar/comparar). */
export function qualityScore(ex: Parameters<typeof exerciseQuality>[0], ctx: QualityContext): number {
  return exerciseQuality(ex, ctx).score;
}

/**
 * Ordena candidatos por CALIDAD (mejor primero), STABLE: preserva el orden previo (recencia/variedad)
 * ante empate de calidad → CALIDAD PRIMERO, VARIEDAD SEGUNDO (§14/§28). No usa Math.random.
 */
export function rankCandidates<T extends Pick<Exercise, 'id' | 'name' | 'type' | 'muscleGroup' | 'isYoga' | 'impact' | 'fallRisk' | 'difficulty' | 'equipment'>>(
  candidates: T[],
  ctx: QualityContext,
): T[] {
  return candidates
    .map((ex, idx) => ({ ex, idx, s: qualityScore(ex, ctx) }))
    .sort((a, b) => (b.s - a.s) || (a.idx - b.idx))  // calidad desc; empate → orden previo (recencia)
    .map(x => x.ex);
}

/** Mejor candidato por calidad (o null). Para reemplazos/selección determinista. */
export function bestCandidate<T extends Pick<Exercise, 'id' | 'name' | 'type' | 'muscleGroup' | 'isYoga' | 'impact' | 'fallRisk' | 'difficulty' | 'equipment'>>(
  candidates: T[],
  ctx: QualityContext,
): T | null {
  return rankCandidates(candidates, ctx)[0] ?? null;
}
