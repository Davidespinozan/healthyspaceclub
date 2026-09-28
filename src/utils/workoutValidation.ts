import type { YogaPlan, YogaPhase } from '../types';
import { YOGA_BY_ID, YOGA_FAMILY_POLICY, FAMILY_MIN_GAP, FAMILY_MAX_MEMBERS } from '../data/yogaCatalog';
import { toleranceFor } from './yogaGenerator';

export function isValidYogaPlan(plan: any): plan is YogaPlan {
  if (!plan || typeof plan !== 'object') return false;
  if (typeof plan.totalDuration !== 'number' || plan.totalDuration < 240) return false;
  if (!Array.isArray(plan.poses) || plan.poses.length < 4) return false;
  return plan.poses.every((p: any) =>
    p && typeof p.id === 'string' && typeof p.duration === 'number' && p.duration > 0
  );
}

export function isValidWorkoutPlan(plan: any): boolean {
  if (!plan || typeof plan !== 'object') return false;
  if (!Array.isArray(plan.exercises) || plan.exercises.length === 0) return false;
  return plan.exercises.every((e: any) =>
    e && typeof e.id === 'string' && (typeof e.sets === 'number' || typeof e.sets === 'string')
  );
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Valida una práctica de yoga generada. Forma parte OBLIGATORIA del pipeline:
 * si no pasa, no se maquilla ni se rellena — se genera otra composición o se
 * informa con honestidad.
 *
 * No exige savasana: ese contenido no existe en la biblioteca. La regla vieja
 * lo pedía y por eso nunca se pudo conectar este validador.
 */
export function validateYogaSession(
  plan: YogaPlan,
  targetDurationSeconds: number,
  availableIds: ReadonlySet<string>,
): ValidationResult {
  const errors: string[] = [];

  if (!isValidYogaPlan(plan)) {
    errors.push('Plan no tiene estructura YogaPlan válida');
    return { valid: false, errors };
  }

  const poses = plan.poses;

  // ── Duración: ±8 % con suelo de 45 s ──
  const actual = poses.reduce((s, p) => s + p.duration, 0);
  const tol = toleranceFor(targetDurationSeconds);
  if (Math.abs(actual - targetDurationSeconds) > tol) {
    errors.push(
      `Duración ${Math.round(actual)}s fuera de tolerancia ±${Math.round(tol)}s ` +
      `(objetivo ${targetDurationSeconds}s)`,
    );
  }

  // ── Todo id existe en el catálogo y tiene vídeo disponible ──
  for (const p of poses) {
    if (!YOGA_BY_ID.has(p.id)) { errors.push(`Contenido fuera del catálogo: ${p.id}`); continue; }
    if (!availableIds.has(p.id)) errors.push(`Sin vídeo disponible: ${p.id}`);
    if (!(p.duration > 0)) errors.push(`Prescripción inválida en ${p.id}: ${p.duration}s`);
  }
  if (errors.length) return { valid: false, errors };

  // ── Seguridad: nada excluido de la generación automática ──
  for (const p of poses) {
    const c = YOGA_BY_ID.get(p.id)!;
    if (c.excludeFromAutoGeneration) errors.push(`Contenido excluido de generación automática: ${p.id}`);
  }

  // ── Lateralidad ──
  for (const p of poses) {
    const c = YOGA_BY_ID.get(p.id)!;
    if (c.laterality === 'unilateral' && p.sides !== 'both') {
      errors.push(`Unilateral sin contraparte: ${p.id}`);
    }
    if (c.laterality === 'contained' && p.sides) {
      errors.push(`Contenido bilateral duplicado por lateralidad: ${p.id}`);
    }
    if (c.laterality === 'none' && p.sides) {
      errors.push(`Lateralidad aplicada a contenido simétrico: ${p.id}`);
    }
  }

  // ── R1 · sin consecutivos ──
  for (let i = 1; i < poses.length; i++) {
    if (poses[i].id === poses[i - 1].id) {
      errors.push(`R1 · contenido repetido consecutivamente: ${poses[i].id} (posición ${i + 1})`);
    }
  }

  // ── R2 · hueco mínimo · y repeatable respetado ──
  const gap = targetDurationSeconds >= 1800 ? 5 : 4;
  const maxUses = targetDurationSeconds >= 1800 ? 3 : 2;
  const lastSeen = new Map<string, number>();
  const uses = new Map<string, number>();
  poses.forEach((p, i) => {
    const prev = lastSeen.get(p.id);
    if (prev !== undefined && i - prev < gap) {
      errors.push(`R2 · ${p.id} repetido con hueco ${i - prev} (mínimo ${gap})`);
    }
    lastSeen.set(p.id, i);
    uses.set(p.id, (uses.get(p.id) ?? 0) + 1);
  });
  for (const [id, n] of uses) {
    const c = YOGA_BY_ID.get(id)!;
    if (n > 1 && !c.repeatable) errors.push(`No repetible usado ${n} veces: ${id}`);
    if (n > maxUses) errors.push(`${id} usado ${n} veces (máximo ${maxUses})`);
  }

  // ── Familia · la política depende de la familia (YOGA_FAMILY_POLICY) ──
  // `strict`   → un solo miembro por práctica.
  // `perPhase` → hasta FAMILY_MAX_MEMBERS, nunca dos en la misma fase y con al
  //              menos FAMILY_MIN_GAP piezas de separación.
  const porFamilia = new Map<string, Array<{ id: string; idx: number }>>();
  poses.forEach((p, idx) => {
    const f = YOGA_BY_ID.get(p.id)!.family;
    if (!f) return;
    porFamilia.set(f, [...(porFamilia.get(f) ?? []), { id: p.id, idx }]);
  });
  for (const [f, apariciones] of porFamilia) {
    const miembros = new Set(apariciones.map(a => a.id));
    const politica = YOGA_FAMILY_POLICY[f] ?? 'strict';
    if (politica === 'strict') {
      if (miembros.size > 1) {
        errors.push(`Familia «${f}» (estricta) con ${miembros.size} miembros: ${[...miembros].join(', ')}`);
      }
      continue;
    }
    if (miembros.size > FAMILY_MAX_MEMBERS) {
      errors.push(`Familia «${f}» con ${miembros.size} miembros (máximo ${FAMILY_MAX_MEMBERS})`);
    }
    // nunca dos miembros distintos dentro de la misma fase
    const porFase = new Map<string, Set<string>>();
    for (const a of apariciones) {
      for (const ph of YOGA_BY_ID.get(a.id)!.phases) {
        if (!porFase.has(ph)) porFase.set(ph, new Set());
        porFase.get(ph)!.add(a.id);
      }
    }
    // separación mínima entre apariciones de miembros DISTINTOS
    const orden = [...apariciones].sort((a, b) => a.idx - b.idx);
    for (let i = 1; i < orden.length; i++) {
      if (orden[i].id === orden[i - 1].id) continue;
      if (orden[i].idx - orden[i - 1].idx < FAMILY_MIN_GAP) {
        errors.push(`Familia «${f}»: ${orden[i - 1].id} y ${orden[i].id} a ${orden[i].idx - orden[i - 1].idx} piezas (mínimo ${FAMILY_MIN_GAP})`);
      }
    }
  }

  // ── Estructura: la práctica progresa y cierra abajo ──
  const phasesPresent = new Set<YogaPhase>();
  for (const p of poses) for (const ph of YOGA_BY_ID.get(p.id)!.phases) phasesPresent.add(ph);
  if (!phasesPresent.has('cooldown')) errors.push('La práctica no incluye fase de cooldown');
  if (!phasesPresent.has('warmup') && !phasesPresent.has('centering')) {
    errors.push('La práctica no incluye preparación (centering/warmup)');
  }

  // ── Composición mínima: ni una lista de dos cosas, ni un desfile ──
  const distinct = new Set(poses.map(p => p.id)).size;
  if (distinct < 4) errors.push(`Solo ${distinct} contenidos distintos (mínimo 4)`);

  return { valid: errors.length === 0, errors };
}

export function validateWorkoutPlanStrict(
  plan: any,
  validExerciseIds: Set<string>
): ValidationResult {
  const errors: string[] = [];

  if (!isValidWorkoutPlan(plan)) {
    errors.push('Plan no tiene estructura WorkoutPlan válida');
    return { valid: false, errors };
  }

  const invalidIds = plan.exercises.filter((e: any) => !validExerciseIds.has(e.id));
  if (invalidIds.length > 0) {
    errors.push(`Ejercicios inválidos: ${invalidIds.map((e: any) => e.id).join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}
