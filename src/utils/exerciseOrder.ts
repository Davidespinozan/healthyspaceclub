import type { Exercise } from '../types';

interface WorkoutExercise {
  id: string;
  group?: string;
  sets?: number;
  rest?: number;
  tecnica?: string;
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

// Compuestos PESADOS que NUNCA deben ir en superserie (barra principal): press de
// banca, sentadilla, peso muerto, dominada, press militar, remo con barra/pesado.
// Se detectan por id o nombre; si no matchea, se deja como está (no hay daño).
const HEAVY_COMPOUND = /sentadilla|peso.?muerto|press.?(de.?)?(banca|militar|hombro.*barra)|dominada|remo.*(barra|pendlay|pesad)/i;

// Fase del ejercicio para el orden élite: compuesto primero, aislamiento después,
// core SIEMPRE al final. Menor = más temprano en la sesión.
function phaseRank(type: string | undefined, muscle: string | undefined): number {
  if (muscle === 'core') return 4; // core/abdomen al final, pase lo que pase
  switch (type) {
    case 'activacion': return 0;
    case 'compuesto':
    case 'funcional': return 1;
    case 'aislamiento': return 2;
    case 'cardio':
    case 'movilidad': return 3;
    default: return 2;
  }
}

/**
 * Validador estructural + AUTO-REPARACIÓN determinista. Garantiza las reglas de
 * coach de élite que el prompt sólo *sugiere* (y que la IA a veces incumple), sin
 * costo ni llamadas extra. Repara en sitio y devuelve la lista de arreglos aplicados.
 *
 * Reglas que garantiza:
 * 1. Orden por fases: compuestos → aislamiento → core al final (grupos como unidad).
 * 2. Compuestos PESADOS nunca en superserie (los saca del group → serie recta).
 * 3. Técnicas de intensidad SOLO en aislamiento (las quita de compuestos).
 * 4. Integridad de superserie: mismo group ⇒ mismos sets y mismo rest (iguala al máx).
 * 5. Anti-enfriamiento: aislados del mismo músculo consecutivos (vía cluster).
 */
export function repairWorkoutStructure<T extends WorkoutExercise>(
  exercises: T[],
  bank: Exercise[],
  opts: { hasWeights?: boolean } = {},
): { exercises: T[]; fixes: string[] } {
  // hasWeights: la regla "compuesto pesado nunca en superserie" es por SEGURIDAD con
  // carga externa (barra/mancuerna). En peso corporal/ligas NO aplica — ahí los
  // circuitos y superseries de sentadillas/dominadas son válidos y deseables.
  const hasWeights = opts.hasWeights ?? true;
  const meta = new Map(bank.map(e => [e.id, e]));
  const typeOf = (ex: T): string | undefined => meta.get(ex.id)?.type;
  const muscleOf = (ex: T): string | undefined => meta.get(ex.id)?.muscleGroup;
  const nameOf = (ex: T): string => meta.get(ex.id)?.name ?? ex.id;
  const fixes: string[] = [];

  let work = exercises.map(e => ({ ...e }));

  // (2) Compuesto pesado en superserie → sácalo del group (serie recta). Solo con pesas.
  if (hasWeights) for (const ex of work) {
    const isCompound = typeOf(ex) === 'compuesto';
    const isHeavy = HEAVY_COMPOUND.test(ex.id) || HEAVY_COMPOUND.test(nameOf(ex));
    if (ex.group && isCompound && isHeavy) {
      fixes.push(`"${nameOf(ex)}": compuesto pesado sacado de superserie → serie recta`);
      delete ex.group;
    }
  }

  // (3) Técnica de intensidad en un compuesto → quítala (solo van en aislamiento).
  for (const ex of work) {
    if (ex.tecnica && (typeOf(ex) === 'compuesto' || typeOf(ex) === 'funcional')) {
      fixes.push(`"${nameOf(ex)}": técnica "${ex.tecnica}" quitada (solo en aislamiento)`);
      delete ex.tecnica;
    }
  }

  // (4) Integridad de superserie: mismo group ⇒ mismos sets y mismo rest (al máx).
  const groups = new Map<string, T[]>();
  for (const ex of work) if (ex.group) {
    if (!groups.has(ex.group)) groups.set(ex.group, []);
    groups.get(ex.group)!.push(ex);
  }
  for (const [g, members] of groups) {
    if (members.length < 2) { delete members[0].group; continue; } // group huérfano = serie recta
    const maxSets = Math.max(...members.map(m => m.sets ?? 0));
    const maxRest = Math.max(...members.map(m => m.rest ?? 0));
    let touched = false;
    for (const m of members) {
      if ((m.sets ?? 0) !== maxSets) { m.sets = maxSets; touched = true; }
      if ((m.rest ?? 0) !== maxRest) { m.rest = maxRest; touched = true; }
    }
    if (touched) fixes.push(`Superserie ${g}: igualadas series/descanso (${maxSets}×, ${maxRest}s)`);
  }

  // (1) Orden por fases con grupos como UNIDAD atómica (primera aparición), estable.
  const seen = new Set<string>();
  interface Unit { items: T[]; rank: number; }
  const units: Unit[] = [];
  for (let i = 0; i < work.length; i++) {
    const ex = work[i];
    if (ex.group) {
      if (seen.has(ex.group)) continue;
      seen.add(ex.group);
      const items = work.filter(e => e.group === ex.group);
      const rank = Math.min(...items.map(e => phaseRank(typeOf(e), muscleOf(e))));
      units.push({ items, rank });
    } else {
      units.push({ items: [ex], rank: phaseRank(typeOf(ex), muscleOf(ex)) });
    }
  }
  const before = work.map(e => e.id).join('|');
  const sorted = units
    .map((u, idx) => ({ u, idx }))
    .sort((a, b) => a.u.rank - b.u.rank || a.idx - b.idx) // estable: preserva orden en misma fase
    .flatMap(({ u }) => u.items);
  if (sorted.map(e => e.id).join('|') !== before) {
    fixes.push('Reordenado a fases élite: compuestos → aislamiento → core al final');
  }
  work = sorted;

  // (5) Anti-enfriamiento: aislados del mismo músculo consecutivos (dentro de fase).
  work = clusterIndividualsByMuscle(work, bank);

  return { exercises: work, fixes };
}
