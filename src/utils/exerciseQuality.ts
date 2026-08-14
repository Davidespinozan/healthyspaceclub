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
import type { Exercise, TrainingGoal } from '../types';
import { roleOf } from './exerciseRole';
import { setupClass } from './supersetEngine';
import { HEAVY_COMPOUND } from './exerciseOrder';

export type QualityTier = 'preferred' | 'good' | 'acceptable' | 'fallback';

export interface QualityContext {
  trainingGoal: TrainingGoal;
  level?: 'principiante' | 'intermedio' | 'avanzado' | string;
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
  // CARGABLE = tiene variante con carga (barra/mancuerna/máquina = bucket 'gym'). El id base de un
  // compuesto no lleva sufijo de implemento, así que se lee del equipo del patrón (fiable).
  const loadable = (ex.equipment ?? []).includes('gym');

  // ESTABILIDAD: pliométrico/balance no puntúan. Aislamiento cargable (máquina/polea/mancuerna) =
  // muy estable (+2); compuesto cargable = estable moderado (+1, más demanda de equilibrio);
  // peso corporal/banda = neutro. (setupClass es poco fiable en ids base → se usa loadable+rol.)
  if (plyometric || balance) { /* sin bono de estabilidad */ }
  else if (setup === 'machine-cable') { score += 2; reasons.push('estable (máquina/polea)'); }
  else if (loadable) { score += compound ? 1 : 2; reasons.push(compound ? 'estable (compuesto cargable)' : 'estable (aislamiento controlado)'); }

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
