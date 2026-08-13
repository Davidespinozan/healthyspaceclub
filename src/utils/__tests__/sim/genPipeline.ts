// ─────────────────────────────────────────────────────────────────────────
// genPipeline — réplica FIEL de la parte determinista del pipeline de GENERACIÓN de
// DailyTrainer.handleGenerate (selección de candidatos + validación de equipo/tiempo),
// para el banco REAL. Es el nivel de test B (¿puede generar cualquier sesión seleccionable?),
// separado del test longitudinal A (mesociclos por semanas). No llama a la IA: valida que
// TODO candidato entregado a la IA supere después las validaciones deterministas.
// ─────────────────────────────────────────────────────────────────────────
import type { Exercise, Equipment, Goal, Modality, MuscleGroup, CardioStyle } from '../../../types';
import {
  filterByModality, cardioEquipmentFor, matchesCardioStyle, hasPlayableVariant,
  filterWithProgressiveRelaxation, orderCandidatesForVariety, orderByChallenge,
  capByMovementFamily, selectVariantForEquipment,
} from '../../workoutPlanner';
import { allocateTime } from '../../sessionBlocks';

export type Level = 'principiante' | 'intermedio' | 'avanzado';

/** Equipo efectivo que arma la app (cardio+ligas → añade peso corporal). */
export function equipmentListFor(sel: Equipment, modality: Modality): Equipment[] {
  return sel === 'ligas' && modality === 'cardio' ? ['ligas', 'cuerpo'] : [sel];
}

/** ¿Es un ejercicio de cardio? (misma señal que usa la app para expandir equipo). */
export const isCardioExercise = (ex: Exercise): boolean => ex.muscleGroup === 'cardio' || ex.type === 'cardio';

/**
 * fitsEquipment REAL (con el fix): los ejercicios de cardio se validan con el equipo
 * EXPANDIDO (cardioEquipmentFor), el resto con el crudo. Exige variante jugable (con video,
 * salvo yoga). Devuelve el primer ejercicio que NO pasa (o null si todos pasan).
 */
export function firstUnfit(exs: Exercise[], equipmentList: Equipment[], cardioSession = false): Exercise | null {
  for (const ex of exs) {
    const eq = (cardioSession || isCardioExercise(ex)) ? cardioEquipmentFor(equipmentList) : equipmentList;
    if (!hasPlayableVariant(ex, eq)) return ex;
  }
  return null;
}

/** ¿El ejercicio RESUELVE a una variante reproducible (video/equipo) en este contexto? */
export function resolvesToPlayable(ex: Exercise, equipmentList: Equipment[], cardioSession = false): boolean {
  const eq = (cardioSession || isCardioExercise(ex)) ? cardioEquipmentFor(equipmentList) : equipmentList;
  if (ex.isYoga) return ex.equipment.some(e => eq.includes(e)); // yoga: sin requisito de video
  const v = selectVariantForEquipment(ex, eq);
  return !!v; // selectVariantForEquipment devuelve solo variantes jugables (con video)
}

// ── Selección de candidatos por modalidad (réplica) ───────────────────────────
export function selectStrengthCandidates(input: {
  bank: Exercise[]; equipmentList: Equipment[]; muscleGroups: MuscleGroup[];
  goal: Goal; level: Level; lowImpactMode: boolean; time: number;
}): Exercise[] {
  const modalityFiltered = filterByModality(input.bank, 'fuerza');
  const res = filterWithProgressiveRelaxation({
    exercises: modalityFiltered.length > 0 ? modalityFiltered : input.bank,
    equipment: input.equipmentList, muscleGroups: input.muscleGroups, goal: input.goal,
    excludeMuscles: [], minCandidates: 3, primaryOnly: false, difficulty: input.level,
    lowImpactMode: input.lowImpactMode,
  });
  let c = res.exercises;
  c = orderCandidatesForVariety(c, new Set());
  c = orderByChallenge(c, input.level, input.equipmentList);
  c = capByMovementFamily(c, input.time <= 30 ? 1 : 2);
  // INVARIANTE selection⊆validation (igual que el fix en DailyTrainer): solo jugables.
  c = c.filter(ex => hasPlayableVariant(ex, input.equipmentList));
  return c;
}

export function selectCardioCandidates(input: {
  bank: Exercise[]; equipmentList: Equipment[]; style: CardioStyle; lowImpactMode: boolean;
}): Exercise[] {
  const modalityFiltered = filterByModality(input.bank, 'cardio');
  const cardioEq = cardioEquipmentFor(input.equipmentList);
  const pool = modalityFiltered.filter(ex =>
    ex.equipment.some(e => cardioEq.includes(e)) &&
    !(input.lowImpactMode && (ex.impact === 'high' || ex.fallRisk === true)) &&
    hasPlayableVariant(ex, cardioEq),
  );
  const styled = pool.filter(ex => matchesCardioStyle(ex, input.style));
  return styled.length >= 3 ? styled : [...styled, ...pool.filter(ex => !styled.includes(ex))];
}

/** Presupuesto de tiempo (réplica de composeSession/allocateTime). */
export function timeBudget(input: { minutes: number; modality: Modality; objective: string; isDeload: boolean }) {
  const isStrengthDay = input.modality === 'fuerza';
  const isYogaDay = input.modality === 'yoga';
  return allocateTime({ totalMinutes: input.minutes, isStrengthDay, isYogaDay, objective: input.objective, isDeload: input.isDeload });
}
