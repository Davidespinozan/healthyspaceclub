// ─────────────────────────────────────────────────────────────────────────
// musclePriority — P5: PRIORIDAD DE PUNTO DÉBIL / MÚSCULO PRIORITARIO.
//
// Sesga volumen, orden y selección hacia uno o varios músculos SIN romper P1–P4 ni
// crear un segundo motor de volumen. La prioridad fluye:
//   prioridad muscular → ajuste del target semanal (P3) → prioridad en la sesión
//   (allocateSessionVolume/primaryMuscles de P4) → orden/selección.
//
// Dos fuentes:
//  · EXPLÍCITA — el usuario elige un músculo/zona (señal fuerte y estable, persistida).
//  · INFERIDA  — el sistema SOSPECHA un rezago (conservadora, evidencia longitudinal).
//    NUNCA "va por debajo del target" = rezago: eso puede ser sesiones perdidas, deload,
//    poco tiempo, adherencia… Se exige EXPOSICIÓN suficiente + fuerza estancada mientras
//    otros progresan, durante varias semanas. Sin evidencia → none.
//
// Seguridad, recuperación y restricciones GANAN sobre prioridad.
// ─────────────────────────────────────────────────────────────────────────
import type { Recovery, Adherence } from './mesocycle';
import type { VolumeTargets } from './volumeLandmarks';

export type PriorityLevel = 'none' | 'moderate' | 'high';
export type Priorities = Record<string, PriorityLevel>;

/** Máx de músculos que se priorizan de verdad a la vez (más = se diluye el sesgo). */
export const MAX_EFFECTIVE_PRIORITIES = 2;

/**
 * Multiplicador de volumen por prioridad — moderado y acotado (no abandona el resto). Fase 6 · el
 * AVANZADO especializa MÁS (§5): sesga con más fuerza hacia el músculo prioritario (más volumen →
 * más slots → aparece antes), sin llegar a monopolizar. Principiante/intermedio: baseline validado.
 */
export function priorityMultiplier(level: PriorityLevel, trainingLevel?: string): number {
  if (trainingLevel === 'avanzado') return level === 'high' ? 1.28 : level === 'moderate' ? 1.15 : 1.0;
  return level === 'high' ? 1.18 : level === 'moderate' ? 1.10 : 1.0;
}

/**
 * Resuelve las prioridades EFECTIVAS combinando explícitas (fuertes) + inferidas
 * (moderadas), y aplicando conflictos: demasiadas → recorta al máximo efectivo;
 * dolor/restricción → fuera (seguridad manda); mala recuperación / deload / sesión
 * corta → baja el nivel (la recuperación gana sobre la prioridad).
 */
export function resolvePriorities(input: {
  explicit: string[];
  inferred?: string[];
  recovery?: Recovery;
  isDeload?: boolean;
  painMuscles?: string[];
  shortSession?: boolean;
}): Priorities {
  const pain = new Set(input.painMuscles ?? []);
  const out: Priorities = {};

  // Explícitas primero (señal más fuerte). DEMASIADAS → recorta al máximo efectivo Y
  // baja el nivel a 'moderate' (el sesgo se diluye). Las primeras marcadas ganan.
  const explicit = input.explicit.filter(m => !pain.has(m));
  const explicitLevel: PriorityLevel = explicit.length > MAX_EFFECTIVE_PRIORITIES ? 'moderate' : 'high';
  for (const m of explicit.slice(0, MAX_EFFECTIVE_PRIORITIES)) out[m] = explicitLevel;
  let count = Object.keys(out).length;
  // Inferidas: moderadas, solo si queda cupo y no chocan con dolor.
  for (const m of (input.inferred ?? [])) {
    if (count >= MAX_EFFECTIVE_PRIORITIES) break;
    if (pain.has(m) || out[m]) continue;
    out[m] = 'moderate';
    count++;
  }

  // Seguridad/recuperación: bajan el nivel (no destruyen el resto del cuerpo).
  const downgrade = (input.recovery === 'mala') || input.isDeload || input.shortSession;
  if (downgrade) {
    for (const m of Object.keys(out)) out[m] = out[m] === 'high' ? 'moderate' : 'none';
  }
  // Limpia los que quedaron en 'none'.
  for (const m of Object.keys(out)) if (out[m] === 'none') delete out[m];
  return out;
}

/**
 * Modula el weeklyTarget individualizado de P3 por la prioridad. Sube SOLO los músculos
 * prioritarios (acotado al rango operativo); el resto queda intacto → priorizar no es
 * abandonar. Reutiliza los rangos min/max de P3.
 */
export function applyMusclePriority(targets: VolumeTargets, priorities: Priorities, trainingLevel?: string): VolumeTargets {
  const out: VolumeTargets = {};
  for (const m of Object.keys(targets)) {
    const t = targets[m];
    const mult = priorityMultiplier(priorities[m] ?? 'none', trainingLevel);
    const target = Math.min(t.max, Math.round(t.target * mult * 10) / 10);
    out[m] = { ...t, target };
  }
  return out;
}

/**
 * Sospecha de rezago (possibleWeakPoint) — CONSERVADORA y longitudinal. Un músculo
 * califica solo si: hubo EXPOSICIÓN suficiente (volumen adecuado ≥3 de las últimas
 * semanas → descarta sesiones perdidas/deload), su fuerza está ESTANCADA/cayendo, y la
 * MAYORÍA de los otros músculos con datos SÍ progresan. Sin ≥minWeeks de historial o con
 * adherencia baja → [] (la evidencia no alcanza).
 */
export function possibleWeakPoint(input: {
  series: Record<string, number>[];              // volumen semanal por músculo, reciente→viejo
  targets: Record<string, number>;               // target semanal por músculo (P3)
  muscleE1RM: Record<string, number[]>;          // e1RM por músculo por semana con carga, reciente→viejo
  adherence: Adherence;
  minWeeks?: number;
}): string[] {
  const minWeeks = input.minWeeks ?? 4;
  const weeksWithData = input.series.filter(wk => Object.keys(wk).length > 0).length;
  if (weeksWithData < minWeeks || input.adherence === 'baja') return []; // evidencia insuficiente

  // Tendencia de fuerza por músculo (ratio reciente/viejo), solo con ≥2 puntos.
  const trendOf = (vals?: number[]): 'sube' | 'estable' | 'baja' | null => {
    const v = (vals ?? []).filter(x => x > 0);
    if (v.length < 2) return null;
    const recent = v[0], old = v[v.length - 1];
    if (recent >= old * 1.03) return 'sube';
    if (recent <= old * 0.97) return 'baja';
    return 'estable';
  };
  const trends: Record<string, 'sube' | 'estable' | 'baja' | null> = {};
  for (const m of Object.keys(input.muscleE1RM)) trends[m] = trendOf(input.muscleE1RM[m]);

  // ¿La mayoría de los OTROS músculos progresan?
  const withData = Object.keys(trends).filter(m => trends[m] != null);
  const out: string[] = [];
  for (const m of Object.keys(input.muscleE1RM)) {
    const t = trends[m];
    if (t == null || t === 'sube') continue;                       // sin datos o progresando → no
    // exposición: semanas con volumen adecuado (≥70% del target) → no es "faltó/deload"
    const target = input.targets[m] ?? 0;
    const exposure = input.series.filter(wk => (wk[m] ?? 0) >= target * 0.7 && target > 0).length;
    if (exposure < 3) continue;                                    // shortfall por exposición, no debilidad
    const others = withData.filter(x => x !== m);
    const othersProgressing = others.length > 0 && others.filter(x => trends[x] === 'sube').length >= Math.ceil(others.length / 2);
    if (othersProgressing) out.push(m);
  }
  return out;
}
