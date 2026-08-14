// ─────────────────────────────────────────────────────────────────────────
// techniques — Fase 6 · TÉCNICAS DE INTENSIDAD (avanzado, gated, deterministas).
//
// Diferenciador PREMIUM del avanzado — no por cantidad, por precisión. Antes las técnicas vivían
// solo en el prompt de la IA, SIN gate en código (un principiante podía recibir un drop set). Ahora
// el motor es la AUTORIDAD: asigna 0–2 técnicas por sesión, deterministas, solo cuando JUSTIFICAN su
// uso, y las renderiza por el canal EXISTENTE del player (campo `tecnica` = chip + instrucción en
// tip_personalizado; misma fidelidad que top-backoff — el usuario la ejecuta leyéndola).
//
// GATES (§6/§7/§23/§24): level=avanzado · goal=hipertrofia · phase≠deload · readiness≠low · rol=
// aislamiento/secundario (NUNCA main ni anchor) · tiempo/fatiga lo permiten. Frecuencia BAJA (§8):
// muchas sesiones avanzadas tienen 0; techo 2. Determinista, sin Math.random. NO conduce/cronometra
// sub-series (el player no lo soporta, §22) — solo instruye; por eso no se programa lo que no se puede
// reproducir. NO en fuerza (§9: fuerza se diferencia por top/backoff y precisión, no por técnicas).
// ─────────────────────────────────────────────────────────────────────────
import type { TrainingGoal } from '../types';
import type { Category, Phase, TrainingLevelLike } from './sessionPrescription';

export type IntensityTechnique = 'rest-pause' | 'drop-set' | 'myo-reps';

/** Etiqueta para el chip del player (vocabulario existente de workoutCache). */
export const TECHNIQUE_LABEL: Record<IntensityTechnique, string> = {
  'rest-pause': 'Rest-pause', 'drop-set': 'Drop set', 'myo-reps': 'Myo-reps',
};

/** Instrucción reproducible (prose) — el usuario la ejecuta leyéndola (no requiere UI nueva). */
export function techniqueInstruction(t: IntensityTechnique): string {
  switch (t) {
    case 'rest-pause': return 'Técnica (solo la última serie): llega a 1-2 reps del fallo, descansa 15 s y saca 3-4 reps más; repite una vez.';
    case 'drop-set':   return 'Técnica (solo la última serie): al acercarte al fallo, baja el peso ~20-30% y sigue sin descanso hasta el fallo técnico.';
    case 'myo-reps':   return 'Técnica (solo la última serie): serie de activación cerca del fallo, luego mini-series de 3-5 reps con 5-10 s de pausa (3-4 tandas).';
  }
}

export interface TechniqueContext {
  level?: TrainingLevelLike;
  trainingGoal: TrainingGoal;
  phase: Phase;
  readiness?: 'low' | 'normal' | 'high';
  anchorIds?: Set<string>;
  timeMinutes?: number;
  fatigueHeadroom?: boolean;   // false = el presupuesto de fatiga NO deja margen → 0 técnicas
}

/** ¿Se pueden usar técnicas HOY? (§6/§7/§23/§24). */
export function techniquesAllowed(ctx: TechniqueContext): boolean {
  return ctx.level === 'avanzado'
    && ctx.trainingGoal === 'hipertrofia'
    && ctx.phase !== 'deload'
    && ctx.readiness !== 'low'
    && ctx.fatigueHeadroom !== false
    && (ctx.timeMinutes ?? 60) >= 45;   // sesión demasiado corta → no hay margen para técnicas
}

export interface TechItem { id: string; category: Category; sets: number; grouped?: boolean }

/**
 * Asigna 0–2 técnicas a los ejercicios ELEGIBLES (aislamiento / secundario NO-anchor; nunca main ni
 * anchor; nunca agrupados en superserie). Determinista y de frecuencia baja. Devuelve id → técnica.
 */
export function assignTechniques(input: {
  items: TechItem[];
  ctx: TechniqueContext;
  maxTechniques?: number;
}): Map<string, { technique: IntensityTechnique; label: string; note: string }> {
  const out = new Map<string, { technique: IntensityTechnique; label: string; note: string }>();
  if (!techniquesAllowed(input.ctx)) return out;
  const anchors = input.ctx.anchorIds ?? new Set<string>();
  // Elegibles: aislamiento (o secundario) NO-anchor, NO-main, no agrupado, con ≥2 series.
  const eligible = input.items.filter(it =>
    !anchors.has(it.id) && !it.grouped && it.category !== 'main-compound' && it.sets >= 2 &&
    (it.category === 'isolation' || it.category === 'secondary-compound'));
  const isolations = eligible.filter(it => it.category === 'isolation');
  const pool = isolations.length ? isolations : eligible;
  // Frecuencia BAJA (§8): 0/1/2 según cuántos accesorios hay (pocos → 0). Muchas sesiones tendrán 0.
  const cap = Math.min(input.maxTechniques ?? 2, pool.length >= 4 ? 2 : pool.length >= 2 ? 1 : 0);
  if (cap <= 0) return out;
  const TYPES: IntensityTechnique[] = ['rest-pause', 'drop-set', 'myo-reps'];
  // Los ÚLTIMOS del pool = accesorios finales de la sesión (donde una técnica cierra sin comprometer
  // el trabajo principal). Técnica determinista por hash del id (sin random, varía sin repetir).
  const chosen = pool.slice(-cap);
  chosen.forEach((it, i) => {
    const h = [...it.id].reduce((a, c) => a + c.charCodeAt(0), 0);
    const t = TYPES[(h + i) % TYPES.length];
    out.set(it.id, { technique: t, label: TECHNIQUE_LABEL[t], note: techniqueInstruction(t) });
  });
  return out;
}
