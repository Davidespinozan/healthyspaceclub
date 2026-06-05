import type { Exercise } from '../types';

interface WorkoutExercise {
  id: string;
  group?: string;
  [k: string]: unknown;
}

/**
 * Anti-enfriamiento DETERMINISTA. La IA a veces intercala músculos en ejercicios
 * INDIVIDUALES (pecho → espalda → espalda → pecho), lo que enfría el músculo.
 * Regla: los ejercicios individuales del mismo músculo deben ir SEGUIDOS hasta
 * terminar. La única forma válida de intercalar dos músculos es vía biserie/
 * triserie/superserie (ejercicios con el mismo `group`) — esos NO se tocan.
 *
 * Reordena solo dentro de cada corrida de individuales consecutivos, agrupando
 * por músculo y conservando el orden de primera aparición (estable). Los bloques
 * agrupados (superseries) se preservan intactos y en su posición.
 */
export function clusterIndividualsByMuscle<T extends WorkoutExercise>(
  exercises: T[],
  bank: Exercise[],
): T[] {
  const muscleById = new Map(bank.map(e => [e.id, e.muscleGroup]));
  const muscleOf = (ex: T): string => muscleById.get(ex.id) ?? 'zzz';

  const result: T[] = [];
  let i = 0;
  while (i < exercises.length) {
    const g = exercises[i].group;
    if (g) {
      // Bloque agrupado (biserie/triserie/superserie): se copia tal cual.
      while (i < exercises.length && exercises[i].group === g) {
        result.push(exercises[i]);
        i++;
      }
    } else {
      // Corrida de individuales: agrupar por músculo (primera aparición).
      const run: T[] = [];
      while (i < exercises.length && !exercises[i].group) {
        run.push(exercises[i]);
        i++;
      }
      const order: string[] = [];
      const byMuscle = new Map<string, T[]>();
      for (const ex of run) {
        const m = muscleOf(ex);
        if (!byMuscle.has(m)) { byMuscle.set(m, []); order.push(m); }
        byMuscle.get(m)!.push(ex);
      }
      for (const m of order) result.push(...byMuscle.get(m)!);
    }
  }
  return result;
}
