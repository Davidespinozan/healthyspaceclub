// ─────────────────────────────────────────────────────────────────────────
// headroom — Fase 5E · ESCALADO VOLUMEN ↔ TIEMPO (solo HIPERTROFIA).
//
// El tiempo disponible es CAPACIDAD de trabajo útil, no obligación de llenar ni variable
// irrelevante. Tras prescribeSession (que reparte la dosis P4 y RECORTA para caber), puede sobrar
// tiempo ("headroom"): 60 min con 8×2 series, o 90 min con 3 ejercicios / 32 min. Esta capa decide
// si ese headroom se usa PRODUCTIVAMENTE — PROFUNDIDAD antes que variedad: +series a mains/secondary
// (fatiga sistémica NEUTRA: el coste sistémico es por-ejercicio, no por-serie) y solo añade un
// ejercicio si un role cap ya se alcanzó y aún hay dosis útil. Todo dentro de P3/P4: nunca supera el
// volumen semanal ni el mesociclo/readiness. Si no hay trabajo útil, TERMINA ANTES a propósito.
//
// NO es un segundo motor de volumen: P3 manda el semanal, P4 la dosis de hoy; esto solo COMPLETA/
// adelanta-poco dentro de esos límites. Fuerza NO se toca (ya usa bien 60/90). Deload/readiness-low
// NO rellenan. NO incluye técnicas de intensidad, resistanceProfile ni content (fases futuras).
// ─────────────────────────────────────────────────────────────────────────
import type { Exercise, TrainingGoal } from '../types';
import type { Category, PrescribedItem, Phase } from './sessionPrescription';
import { movementPatternOf } from './movementPattern';
import { exerciseFatigue } from './fatigueBudget';
import { patternCap } from './sessionSlots';
import { bestCandidate } from './exerciseQuality';

/** Minutos por SERIE de un ejercicio (trabajo + descanso). Misma fórmula que sessionPrescription. */
const perSetMin = (rest: number) => 0.7 + rest / 60;
const roleCap = (cat: Category) => (cat === 'main-compound' ? 5 : 4);   // Fase 5E · §13 caps intactos

export interface HeadroomResult<T> {
  items: PrescribedItem<T>[];
  decisions: string[];
  availableMin: number;
  prescribedMin: number;
  headroomMin: number;          // headroom RESTANTE tras las decisiones
  endedEarly: boolean;          // sobra tiempo pero NO hay trabajo útil → terminar antes a propósito
  addedSets: number;
  addedExercises: number;
}

/**
 * Decide cómo usar el headroom de una sesión de HIPERTROFIA ya prescrita. Determinista y explicable.
 *  1) PROFUNDIDAD: +1 serie al mejor candidato elegible (main/secondary primero, luego prioritario,
 *     luego aislamiento), hasta role cap y hasta el techo por músculo (dosis de hoy, o el semanal
 *     pendiente si acumulación + readiness no-baja → adelanto controlado). Cada serie cuesta tiempo.
 *  2) EJERCICIO: solo si un músculo con dosis pendiente tiene TODOS sus ejercicios en cap; añade uno
 *     complementario (ranking 5C, respeta pattern cap y fatigue budget). Máx 2.
 * Fuerza / deload / readiness-low → no toca nada (return con endedEarly=false).
 */
export function allocateHeadroom<T extends { id: string; muscleGroup: string }>(input: {
  items: PrescribedItem<T>[];
  bankById: Map<string, Exercise>;
  allocation: Record<string, number>;        // dosis P4 de HOY por músculo
  weeklyRemaining: Record<string, number>;   // target semanal P3 − hecho esta semana (antes de hoy)
  availableMainMinutes: number;              // sessionPlan.budget.main
  trainingGoal: TrainingGoal;
  phase: Phase;
  readiness: 'low' | 'normal' | 'high';
  priorityMuscles?: Set<string>;
  anchorIds?: Set<string>;
  candidates?: Exercise[];                    // pool ranqueado para AÑADIR ejercicio (opcional)
  fatigueBudgetValue?: number;               // presupuesto de fatiga sistémica (para añadir ejercicio)
  ctxQuality?: { trainingGoal: TrainingGoal; level?: string };
  makeItem?: (id: string, cat: Category, sets: number) => PrescribedItem<T> | null;
}): HeadroomResult<T> {
  const items = input.items.map(it => ({ ...it, prescription: { ...it.prescription } }));
  const availableMin = input.availableMainMinutes;
  const minutesOf = (its: PrescribedItem<T>[]) => its.reduce((a, it) => a + it.prescription.sets * perSetMin(it.prescription.rest), 0);
  const prescribedMin = minutesOf(items);
  const base = { items, decisions: [] as string[], availableMin, prescribedMin, headroomMin: Math.max(0, availableMin - prescribedMin), endedEarly: false, addedSets: 0, addedExercises: 0 };

  // Fuerza / deload / readiness-low: NO se rellena (§9/§10/§11/§20).
  if (input.trainingGoal !== 'hipertrofia' || input.phase === 'deload' || input.readiness === 'low') return base;

  let headroom = availableMin - prescribedMin;
  if (headroom < perSetMin(60)) return base; // ni una serie barata cabe → la sesión ya llena el tiempo

  const decisions: string[] = [];
  const setsByMuscle = () => {
    const m: Record<string, number> = {};
    for (const it of items) m[it.ex.muscleGroup] = (m[it.ex.muscleGroup] ?? 0) + it.prescription.sets;
    return m;
  };
  // Techo de series por músculo: restaurar hasta la dosis de hoy SIEMPRE; adelantar hasta el semanal
  // pendiente SOLO en acumulación + readiness no-baja (§7/§8). Nunca supera 10/músculo ni el semanal.
  const bringForward = input.phase === 'acumulacion';   // readiness-low ya retornó arriba
  const ceilingOf = (m: string) => {
    const weekly = input.weeklyRemaining[m] ?? Infinity;
    const today = input.allocation[m] ?? Infinity;
    return Math.min(10, weekly, bringForward ? Infinity : today);
  };

  // ── 1) PROFUNDIDAD ─────────────────────────────────────────────────────────
  // Score de prioridad (menor = antes): mains/secondaries a mínimo útil, luego prioritario, luego
  // profundizar mains, luego aislamiento. Prefiere lo NO agrupado (los groups se sincronizan aparte).
  const priorityScore = (it: PrescribedItem<T>) => {
    const compound = it.category !== 'isolation';
    const prio = input.priorityMuscles?.has(it.ex.muscleGroup) ? -0.5 : 0;
    const grouped = it.ex && (it as { group?: string }).group ? 0.25 : 0;
    if (compound && it.prescription.sets < 3) return 0 + prio + grouped;   // llevar compuestos a 3
    if (input.priorityMuscles?.has(it.ex.muscleGroup) && it.prescription.sets < roleCap(it.category)) return 1 + grouped;
    if (compound && it.prescription.sets < 4) return 2 + prio + grouped;   // profundizar a 4
    if (compound && it.prescription.sets < 5) return 3 + prio + grouped;   // main a 5
    return 4 + grouped;                                                    // aislamiento
  };
  let guard = 0;
  while (guard++ < 200) {
    const sbm = setsByMuscle();
    const eligible = items.filter(it =>
      it.prescription.sets < roleCap(it.category) &&
      (sbm[it.ex.muscleGroup] ?? 0) < ceilingOf(it.ex.muscleGroup) &&
      perSetMin(it.prescription.rest) <= headroom);
    if (!eligible.length) break;
    eligible.sort((a, b) => priorityScore(a) - priorityScore(b) || b.prescription.rest - a.prescription.rest);
    const pick = eligible[0];
    pick.prescription.sets += 1;
    headroom -= perSetMin(pick.prescription.rest);
    base.addedSets++;
    decisions.push(`+1 serie ${pick.ex.id} (${pick.category}, ${pick.ex.muscleGroup}) → ${pick.prescription.sets} · profundidad`);
  }

  // ── 2) EJERCICIO (solo si un role cap bloquea y aún hay dosis + slot valioso) ─
  // §4/§12: no "sobra tiempo → otro ejercicio". Requiere: músculo con semanal pendiente por encima
  // de lo que ya recibe, TODOS sus ejercicios en cap, candidato válido (patrón bajo cap, fatiga ok).
  if (input.candidates?.length && input.makeItem && input.ctxQuality) {
    const cap = patternCap('hipertrofia');
    let sysFat = items.reduce((a, it) => a + (input.bankById.get(it.ex.id) ? exerciseFatigue(input.bankById.get(it.ex.id)!) : 0), 0);
    const budget = input.fatigueBudgetValue ?? Infinity;
    let added = 0;
    while (added < 2 && headroom >= 3 * perSetMin(90)) {
      const sbm = setsByMuscle();
      const patCounts: Record<string, number> = {};
      for (const it of items) { const p = movementPatternOf(input.bankById.get(it.ex.id) ?? { id: it.ex.id, muscleGroup: it.ex.muscleGroup, isYoga: false } as Exercise); if (p) patCounts[p] = (patCounts[p] ?? 0) + 1; }
      // músculo más "hambriento" cuyos ejercicios están TODOS al tope
      const need = Object.keys(sbm)
        .filter(m => (input.weeklyRemaining[m] ?? 0) - sbm[m] >= 3)                       // dosis útil pendiente
        .filter(m => items.filter(it => it.ex.muscleGroup === m).every(it => it.prescription.sets >= roleCap(it.category)))
        .sort((a, b) => ((input.weeklyRemaining[b] ?? 0) - sbm[b]) - ((input.weeklyRemaining[a] ?? 0) - sbm[a]))[0];
      if (!need) break;
      const present = new Set(items.map(it => it.ex.id));
      const pool = input.candidates.filter(c => !present.has(c.id) && c.muscleGroup === need
        && (() => { const p = movementPatternOf(c); return !p || (patCounts[p] ?? 0) < cap; })());
      const pick = bestCandidate(pool, input.ctxQuality);
      if (!pick) break;
      const fat = exerciseFatigue(pick);
      if (sysFat + fat > budget) break;                                                   // §27 fatiga intacta
      const startSets = Math.min(3, Math.max(2, Math.floor(headroom / perSetMin(90))));
      const cat: Category = (pick.type === 'compuesto' ? 'secondary-compound' : 'isolation');
      const item = input.makeItem(pick.id, cat, startSets);
      if (!item) break;
      items.push(item);
      headroom -= startSets * perSetMin(item.prescription.rest);
      sysFat += fat;
      base.addedExercises++; added++;
      decisions.push(`+ejercicio ${pick.id} (${cat}, ${need}) ${startSets} series · role cap alcanzado, dosis pendiente`);
    }
  }

  const headroomMin = Math.max(0, availableMin - minutesOf(items));
  const endedEarly = headroomMin >= perSetMin(90) && base.addedSets === 0 && base.addedExercises === 0
    ? true
    : headroomMin >= perSetMin(90); // sobra tiempo tras hacer lo útil → fin anticipado intencional
  return { items, decisions, availableMin, prescribedMin, headroomMin, endedEarly, addedSets: base.addedSets, addedExercises: base.addedExercises };
}
