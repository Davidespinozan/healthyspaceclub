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
      // Orden de músculo FIJO (región coherente), no primera aparición → el tren
      // inferior queda junto y el superior junto, sin rebotar entre ellos.
      order.sort((a, b) => muscleRank(a) - muscleRank(b));
      for (const m of order) result.push(...byMuscle.get(m)!);
    }
  }
  return result;
}

// Compuestos PESADOS que NUNCA deben ir en superserie (barra principal): press de
// banca, sentadilla, peso muerto, dominada, press militar, remo con barra/pesado.
// Se detectan por id o nombre; si no matchea, se deja como está (no hay daño).
const HEAVY_COMPOUND = /sentadilla|peso.?muerto|press.?(de.?)?(banca|militar|hombro.*barra)|dominada|remo.*(barra|pendlay|pesad)/i;

// Orden de músculo/región para que la sesión FLUYA y no rebote (pierna → upper →
// pierna). Tren inferior junto → superior grande → brazos → core al final. Fijo, NO
// depende del orden que mandó la IA: ese rebote era la queja principal.
const MUSCLE_ORDER: Record<string, number> = {
  cuadriceps: 0, isquios: 1, gluteo: 2, pantorrillas: 3,   // tren inferior
  espalda: 10, pecho: 11, hombros: 12,                     // tren superior grande
  triceps: 20, biceps: 21, antebrazo: 22,                  // brazos
  'cuerpo-completo': 50, cardio: 80, core: 90,             // core/cardio al final
};
const muscleRank = (m?: string): number => MUSCLE_ORDER[m ?? ''] ?? 40;
const LOWER_MUSCLES = new Set(['cuadriceps', 'isquios', 'gluteo', 'pantorrillas']);
const UPPER_MUSCLES = new Set(['pecho', 'espalda', 'hombros', 'biceps', 'triceps', 'antebrazo']);
const regionOf = (m?: string): 'lower' | 'upper' | 'other' =>
  m && LOWER_MUSCLES.has(m) ? 'lower' : m && UPPER_MUSCLES.has(m) ? 'upper' : 'other';

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
  opts: { hasWeights?: boolean; compoundSetFloor?: number } = {},
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

  // (2b) Superserie INCOHERENTE: en día con pesas, un group que mezcla tren
  // inferior y superior (sin lógica antagonista) no tiene sentido → se deshace en
  // series rectas. Antagonistas del mismo tren (pecho/espalda, bíceps/tríceps,
  // cuádriceps/isquios) y mismo músculo se PRESERVAN. En peso corporal/circuito no
  // aplica (ahí mezclar todo el cuerpo es válido).
  if (hasWeights) {
    const regionsByGroup = new Map<string, Set<string>>();
    for (const ex of work) if (ex.group) {
      if (!regionsByGroup.has(ex.group)) regionsByGroup.set(ex.group, new Set());
      regionsByGroup.get(ex.group)!.add(regionOf(muscleOf(ex)));
    }
    for (const [g, regions] of regionsByGroup) {
      if (regions.has('lower') && regions.has('upper')) {
        for (const ex of work) if (ex.group === g) delete ex.group;
        fixes.push(`Superserie ${g}: mezclaba tren superior e inferior → deshecha (series rectas)`);
      }
    }
  }

  // (2c) Piso de series en COMPUESTOS (B): la queja "rutinas flojas" — un compuesto
  // con 1-2 series subdosifica a un intermedio/avanzado. En fuerza/hipertrofia se sube
  // al piso. Red de seguridad determinista sobre lo que mande la IA.
  const setFloor = opts.compoundSetFloor ?? 0;
  if (setFloor > 0) for (const ex of work) {
    if (typeOf(ex) === 'compuesto' && (ex.sets ?? 0) < setFloor) {
      ex.sets = setFloor;
      fixes.push(`"${nameOf(ex)}": series subidas a ${setFloor} (piso de compuesto)`);
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
  interface Unit { items: T[]; rank: number; mrank: number; }
  const units: Unit[] = [];
  for (let i = 0; i < work.length; i++) {
    const ex = work[i];
    if (ex.group) {
      if (seen.has(ex.group)) continue;
      seen.add(ex.group);
      const items = work.filter(e => e.group === ex.group);
      const rank = Math.min(...items.map(e => phaseRank(typeOf(e), muscleOf(e))));
      const mrank = Math.min(...items.map(e => muscleRank(muscleOf(e))));
      units.push({ items, rank, mrank });
    } else {
      units.push({ items: [ex], rank: phaseRank(typeOf(ex), muscleOf(ex)), mrank: muscleRank(muscleOf(ex)) });
    }
  }
  const before = work.map(e => e.id).join('|');
  // Orden: (1) fase — compuesto → aislamiento → core; (2) DENTRO de la fase, por
  // región/músculo fijo (tren inferior junto, superior junto); (3) estable por índice.
  const sorted = units
    .map((u, idx) => ({ u, idx }))
    .sort((a, b) => a.u.rank - b.u.rank || a.u.mrank - b.u.mrank || a.idx - b.idx)
    .flatMap(({ u }) => u.items);
  if (sorted.map(e => e.id).join('|') !== before) {
    fixes.push('Reordenado a fases élite: compuestos → aislamiento → core al final');
  }
  work = sorted;

  // (5) Anti-enfriamiento: aislados del mismo músculo consecutivos (dentro de fase).
  work = clusterIndividualsByMuscle(work, bank);

  return { exercises: work, fixes };
}
