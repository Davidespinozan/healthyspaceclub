// ─────────────────────────────────────────────────────────────────────────
// sessionPrescription — P4: PRESCRIPCIÓN ESTRUCTURADA POR SESIÓN (determinista).
//
// Series, reps, descansos y REPARTO de volumen dejan de depender del free-hand de la
// IA. La cadena, integrando P1+P2+P3:
//
//   mesociclo (P1) → target semanal por músculo (P3) → déficit semanal →
//   dosis de HOY (allocateSessionVolume) → esquema series/reps/carga/descanso.
//
// La IA solo ELIGE candidatos, explica y da cues. La lógica crítica es determinista.
// ─────────────────────────────────────────────────────────────────────────
import type { Exercise, TrainingGoal } from '../types';
import { HEAVY_COMPOUND } from './exerciseOrder';
import { roleOf, roleToCategory } from './exerciseRole';
import { prescribeLoad, roundToIncrement } from './loadEngine';
import type { Recovery } from './mesocycle';

export type Category = 'main-compound' | 'secondary-compound' | 'isolation';
export type SetScheme = 'top-backoff' | 'straight';
export type Phase = 'acumulacion' | 'intensificacion' | 'deload';
/** Nivel de entrenamiento (Fase 6). String laxo para no acoplar con workoutPlanner (evita ciclo). */
export type TrainingLevelLike = 'principiante' | 'intermedio' | 'avanzado' | string;

export interface ExercisePrescription {
  sets: number;
  reps: string;
  rest: number;       // segundos
  rir: number;
  scheme: SetScheme;
  topKg?: number;     // top-backoff con historial de carga (P2); o carga recta reducida en deload
  backoffKg?: number;
  schemeNote?: string; // ej. "1 top set + 2 backoffs"
  isDeloadLoad?: boolean; // P1 · topKg es una carga de descarga reducida (todas las series igual)
}

// DELOAD: factor de reducción de la carga de trabajo (guardrail/default, ~12.5% menos → ~87.5%
// de la carga normal). No es ley universal; reduce fatiga manteniendo práctica técnica.
export const DELOAD_LOAD_FACTOR = 0.875;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ── Categoría (rol) — Fase 3.1: AUTORIDAD = metadata explícita (exerciseRole), NO el nombre ──
// `roleOf` resuelve rol explícito → mapa del banco → fallback legacy (type + HEAVY_COMPOUND) SOLO
// para contenido nuevo no etiquetado. Renombrar un ejercicio ya no cambia su categoría.
export function categorize(ex: Pick<Exercise, 'id' | 'name' | 'type'> & { exerciseRole?: string }): Category {
  return roleToCategory(roleOf(ex, HEAVY_COMPOUND));
}

// ── REPARTO DE VOLUMEN (el corazón de P4) ────────────────────────────────────
/**
 * Series que recibe HOY cada músculo del día. Reparte el DÉFICIT semanal (target P3 −
 * hecho) entre las sesiones que razonablemente quedan que entrenen ese músculo.
 * Evita los dos errores: (1) meter todo el faltante hoy → divide por las veces que se
 * volverá a entrenar; (2) quedarse corto → piso por sesión y, en la ÚLTIMA sesión de la
 * semana, alcanza lo que falta (acotado por el límite de sesión).
 */
export function allocateSessionVolume(input: {
  weeklyTarget: Record<string, number>;      // P3
  doneThisWeek: Record<string, number>;      // computeWeeklyVolume 7d
  dayMuscles: string[];
  primaryMuscles?: string[];                 // los que llevan el trabajo directo hoy
  freqTarget: number;
  sessionsThisWeekDone: number;
  muscleWeeklyFreq: Record<string, number>;  // veces/sem que se entrena cada músculo (del split)
  recovery?: Recovery;
  isDeload?: boolean;
  maxSetsPerMuscle?: number;                 // límite por sesión
}): Record<string, number> {
  const cap = input.maxSetsPerMuscle ?? 10;
  const freqWk = Math.max(1, Math.round(input.freqTarget));
  const sessionsLeft = Math.max(1, freqWk - input.sessionsThisWeekDone); // incl hoy
  const weekFraction = sessionsLeft / freqWk;
  const primary = input.primaryMuscles ? new Set(input.primaryMuscles) : null;
  const out: Record<string, number> = {};
  for (const m of input.dayMuscles) {
    const remaining = Math.max(0, (input.weeklyTarget[m] ?? 0) - (input.doneThisWeek[m] ?? 0));
    if (remaining <= 0) { out[m] = primary && !primary.has(m) ? 0 : (input.isDeload ? 0 : 2); continue; } // en target → mínimo mantenimiento
    const freq = Math.max(1, input.muscleWeeklyFreq[m] ?? 2);
    const expectedRemainingHits = Math.max(1, Math.round(freq * weekFraction));
    let dose = remaining / expectedRemainingHits;
    const isSecondary = primary ? !primary.has(m) : false;
    if (isSecondary) dose *= 0.6;                     // el secundario recibe mucho INDIRECTO de compuestos
    if ((input.recovery ?? 'media') === 'mala') dose *= 0.85;
    if (input.isDeload) dose *= 0.6;                   // deload: recorte claro
    const floor = input.isDeload ? 0 : (isSecondary ? 1 : 2);
    out[m] = clamp(Math.round(dose), floor, cap);
  }
  return out;
}

// ── Reps / RIR / descanso por categoría × TRAINING GOAL × fase ───────────────
/** Rango de reps. Depende SOLO del TRAINING GOAL tipado (hipertrofia|fuerza) — nunca del
 *  body goal: un string de composición corporal ("perder grasa") NO puede cambiar las reps
 *  de resistencia (Fase 0). La fase desplaza el rango (intensificación lo baja). */
export function repRangeFor(cat: Category, trainingGoal: TrainingGoal, phase: Phase): string {
  // FUERZA (Fase 1): rangos por ROL. El aislamiento NO se convierte en 3-5 — sigue moderado/alto
  // (soporte muscular, no fuerza máxima). HIPERTROFIA conserva su filosofía validada.
  if (trainingGoal === 'fuerza') {
    if (cat === 'main-compound') return phase === 'intensificacion' ? '3-5' : '4-6';     // deload: 4-6 (carga reducida)
    if (cat === 'secondary-compound') return phase === 'intensificacion' ? '5-7' : '6-8';
    // isolation: acumulación 8-12 · intensificación 8-10 · deload 10-15
    return phase === 'deload' ? '10-15' : phase === 'intensificacion' ? '8-10' : '8-12';
  }
  // HIPERTROFIA (sin cambios respecto a la línea base validada)
  if (cat === 'main-compound') return phase === 'intensificacion' ? '5-7' : '6-10';
  if (cat === 'secondary-compound') return phase === 'intensificacion' ? '7-10' : '8-12';
  return phase === 'intensificacion' ? '10-12' : '12-15'; // isolation
}

export function restFor(cat: Category, trainingGoal: TrainingGoal, phase: Phase): number {
  // FUERZA: descansos largos para preservar rendimiento en las series pesadas (nunca se recortan
  // por tiempo aquí — el recorte de sesión corta elimina EJERCICIOS, no el descanso crítico).
  if (trainingGoal === 'fuerza') {
    if (cat === 'main-compound') return phase === 'deload' ? 150 : phase === 'intensificacion' ? 240 : 210; // 180-300
    if (cat === 'secondary-compound') return phase === 'deload' ? 120 : 150;                                 // 120-180
    return 90; // isolation 60-120
  }
  // HIPERTROFIA (sin cambios)
  if (cat === 'main-compound') return phase === 'deload' ? 120 : phase === 'intensificacion' ? 180 : 150;
  if (cat === 'secondary-compound') return 90;
  return 60; // isolation
}

export function rirFor(cat: Category, trainingGoal: TrainingGoal, phase: Phase, level?: TrainingLevelLike): number {
  // Invariante: un compuesto principal NUNCA va a RIR 0 rutinariamente (mín 2 en intensificación).
  if (phase === 'deload') return cat === 'isolation' && trainingGoal === 'fuerza' ? 3 : 4; // lejos del fallo
  if (trainingGoal === 'fuerza') {
    if (cat === 'main-compound') return phase === 'intensificacion' ? 2 : 3;   // 1-2 / 2-3 (calidad del lift)
    if (cat === 'secondary-compound') return 2;
    return 1;                                                                   // isolation puede acercarse al fallo
  }
  // HIPERTROFIA — baseline (intermedio / sin nivel): SIN CAMBIOS respecto a la línea validada.
  let rir = phase === 'intensificacion' ? (cat === 'isolation' ? 1 : 2) : (cat === 'main-compound' ? 3 : 2);
  // FASE 6 · matiz por NIVEL (solo hipertrofia, fuera de deload). Pequeño y acotado (§10):
  //  · PRINCIPIANTE → más conservador en COMPUESTOS (aprende con margen); el main jamás al fallo.
  //  · AVANZADO → aislamiento/secundario ALGO más cerca del fallo cuando corresponde; el main protegido.
  if (level === 'principiante' && cat !== 'isolation') rir += 1;                // margen técnico en compuestos
  else if (level === 'avanzado' && cat !== 'main-compound') rir = Math.max(0, rir - 1); // acerca aislamiento/2rio
  return rir;
}

// ── Esquema + prescripción por ejercicio ─────────────────────────────────────
/**
 * top-backoff SOLO donde tiene sentido: compuesto principal CON historial de carga
 * (P2) fuera de deload. Peso corporal, bandas, secundarios y aislamiento → series
 * rectas (su progresión es por reps/dificultad/tensión, no por %1RM).
 */
export function schemeFor(cat: Category, hasLoadedHistory: boolean, phase: Phase): SetScheme {
  return cat === 'main-compound' && hasLoadedHistory && phase !== 'deload' ? 'top-backoff' : 'straight';
}

export function prescribeExercise(input: {
  category: Category;
  sets: number;              // series asignadas por el reparto (ya distribuidas)
  trainingGoal: TrainingGoal; // Fase 0 · reps de resistencia salen SOLO de aquí (no body goal)
  phase: Phase;
  level?: TrainingLevelLike; // Fase 6 · matiz de RIR por nivel (solo hipertrofia; main protegido)
  lastSets?: { reps: number; kg: number; rir?: number }[]; // P2 — historial CON RIR real (canal único)
}): ExercisePrescription {
  const { category, trainingGoal, phase } = input;
  const sets = Math.max(2, input.sets);
  const reps = repRangeFor(category, trainingGoal, phase);
  const rest = restFor(category, trainingGoal, phase);
  const rir = rirFor(category, trainingGoal, phase, input.level);
  const hasLoad = (input.lastSets ?? []).some(s => s.kg > 0);
  const scheme = schemeFor(category, hasLoad, phase);
  // BLOQUE 2 · el sesgo de carga se calcula UNA vez y alimenta AMBAS ramas (top-backoff y deload)
  // → misma fuente, el deload nunca diverge del trabajo normal. FUERZA · el compuesto principal
  // sesga a INTENSIDAD (serie tope más pesada) aun en acumulación; HIPERTROFIA sigue el sesgo por fase.
  const bias = (phase === 'intensificacion' || (trainingGoal === 'fuerza' && category === 'main-compound'))
    ? 'intensidad' : 'equilibrio';

  if (scheme === 'top-backoff') {
    const load = prescribeLoad(input.lastSets, reps, bias); // RIR-aware, sin calibración (canal único)
    const backoffs = clamp(sets - 1, 1, 3);
    return {
      sets, reps, rest, rir, scheme,
      topKg: load?.topKg, backoffKg: load?.backoffKg,
      schemeNote: `1 serie tope + ${backoffs} backoff${backoffs > 1 ? 's' : ''}`,
    };
  }
  // DELOAD con carga comparable: reduce EXPLÍCITAMENTE la carga de trabajo (~87.5% de la
  // normal) en series rectas. MISMA fuente de carga (prescribeLoad RIR-aware) que el resto → el
  // deload y el trabajo normal no divergen. Sin carga comparable (bandas/corporal) → recto sin kg.
  if (phase === 'deload' && hasLoad) {
    const normal = prescribeLoad(input.lastSets, reps, bias); // MISMO sesgo que el trabajo normal
    if (normal) {
      const deloadKg = roundToIncrement(normal.topKg * DELOAD_LOAD_FACTOR, 2.5);
      return {
        sets, reps, rest, rir, scheme: 'straight',
        topKg: deloadKg, isDeloadLoad: true,
        schemeNote: 'descarga: carga reducida (~12% menos), mismas series',
      };
    }
  }
  return { sets, reps, rest, rir, scheme: 'straight' };
}

// ── Orquestación: reparte, prescribe y RESPETA EL TIEMPO ─────────────────────
export interface PrescribedItem<T> { ex: T; category: Category; prescription: ExercisePrescription; }

/** Minutos estimados de una prescripción (trabajo por serie + descanso). */
function minutesOf(p: ExercisePrescription): number {
  return p.sets * (0.7 + p.rest / 60);
}

/**
 * Aplica el reparto de volumen a los ejercicios YA elegidos (agrupados por músculo),
 * les asigna esquema/reps/descanso, y RECORTA para caber en el presupuesto del bloque
 * principal — quitando series de accesorios/aislamiento antes que de compuestos.
 */
export function prescribeSession<T extends { id: string; muscleGroup: string }>(input: {
  exercises: T[];                                  // con id + muscleGroup (del banco)
  bankById: Map<string, Pick<Exercise, 'id' | 'name' | 'type'>>;
  allocation: Record<string, number>;             // series por músculo (allocateSessionVolume)
  trainingGoal: TrainingGoal;                      // Fase 0 · reps por adaptación de resistencia (no body goal)
  phase: Phase;
  level?: TrainingLevelLike;                        // Fase 6 · matiz de RIR por nivel
  mainMinutes: number;                             // presupuesto del bloque principal
  lastPerf?: Record<string, { sets: { reps: number; kg: number; rir?: number }[] }>;
}): PrescribedItem<T>[] {
  // Distribución de series por rol. FUERZA concentra MÁS en el compuesto principal y menos en
  // accesorios (menos volumen accesorio, más calidad en el lift); es un factor pequeño, acotado
  // y testeado — NO un segundo motor de volumen (P3/P4 siguen fijando el total por músculo).
  const CAT_WEIGHT: Record<Category, number> = input.trainingGoal === 'fuerza'
    ? { 'main-compound': 2.0, 'secondary-compound': 1.1, isolation: 0.7 }
    : { 'main-compound': 1.6, 'secondary-compound': 1.2, isolation: 1.0 };
  const items: PrescribedItem<T>[] = [];

  // 1) Series por ejercicio: repartir la dosis del músculo entre sus ejercicios por peso
  //    de categoría (el compuesto principal se lleva más).
  const byMuscle = new Map<string, T[]>();
  for (const ex of input.exercises) {
    if (!byMuscle.has(ex.muscleGroup)) byMuscle.set(ex.muscleGroup, []);
    byMuscle.get(ex.muscleGroup)!.push(ex);
  }
  const setsByEx = new Map<string, number>();
  const catByEx = new Map<string, Category>();
  for (const [muscle, exs] of byMuscle) {
    const budget = input.allocation[muscle] ?? exs.length * 3; // sin target → 3/ej
    const cats = exs.map(e => categorize(input.bankById.get(e.id) ?? { id: e.id, name: e.id, type: 'compuesto' }));
    exs.forEach((e, i) => catByEx.set(e.id, cats[i]));
    const totalW = cats.reduce((a, c) => a + CAT_WEIGHT[c], 0);
    exs.forEach((e, i) => {
      const raw = totalW > 0 ? budget * (CAT_WEIGHT[cats[i]] / totalW) : budget / exs.length;
      // Fase 5A · cap por ROL: evita concentración absurda (un solo ejercicio con 6-7 series
      // porque quedó solo). main ≤5, secondary/isolation ≤4. Si sobra dosis, el nº de ejercicios
      // (sessionExerciseCount) ya añadió un segundo movimiento compatible — no se infla aquí.
      const roleMax = cats[i] === 'main-compound' ? 5 : 4;
      setsByEx.set(e.id, clamp(Math.round(raw), 2, roleMax));
    });
  }

  // 2) Prescripción por ejercicio.
  for (const ex of input.exercises) {
    const cat = catByEx.get(ex.id) ?? 'isolation';
    const prescription = prescribeExercise({
      category: cat,
      sets: setsByEx.get(ex.id) ?? 3,
      trainingGoal: input.trainingGoal,
      phase: input.phase,
      level: input.level,
      lastSets: input.lastPerf?.[ex.id]?.sets,
    });
    items.push({ ex, category: cat, prescription });
  }

  // 3) TIEMPO (BLOQUE 5 · D2/F2): "TIEMPO CORTO → MENOS COSAS, NO TODO HECHO PEOR".
  // Jerarquía de recorte: (a) bajar series de menor prioridad hacia el piso; (b) ELIMINAR
  // ejercicios completos (aislamiento → secundario → compuesto de menos series como último
  // recurso), preservando ≥1 compuesto y el trabajo importante. JAMÁS se recorta el descanso
  // crítico de un compuesto para fingir que cabe. Tolerancia pequeña y EXPLÍCITA.
  const PRIORITY: Record<Category, number> = { isolation: 0, 'secondary-compound': 1, 'main-compound': 2 };
  const TIME_TOLERANCE = 2; // minutos — cota explícita, no un colchón que esconda el problema
  const recompute = () => items.reduce((a, it) => a + minutesOf(it.prescription), 0);
  let total = recompute();

  // (a) baja series (nunca <2) empezando por lo de menor prioridad y más series.
  let guard = 200;
  while (total > input.mainMinutes && guard-- > 0) {
    const cand = items
      .filter(it => it.prescription.sets > 2)
      .sort((a, b) => PRIORITY[a.category] - PRIORITY[b.category] || b.prescription.sets - a.prescription.sets)[0];
    if (!cand) break;
    cand.prescription.sets -= 1;
    total = recompute();
  }

  // (b) si aún no cabe (todos en el piso de series), ELIMINA ejercicios completos: primero
  // aislamiento, luego secundario; solo como ÚLTIMO recurso un compuesto (el de MENOS series,
  // que ≈ el menos prioritario — el priorizado recibió más dosis), preservando siempre ≥1.
  guard = 200;
  while (total > input.mainMinutes + TIME_TOLERANCE && items.length > 1 && guard-- > 0) {
    const nonMain = items.filter(it => it.category !== 'main-compound');
    const pool = nonMain.length > 0 ? nonMain : items; // solo-compuestos → recorta el menor
    const victim = pool.sort((a, b) => PRIORITY[a.category] - PRIORITY[b.category] || a.prescription.sets - b.prescription.sets)[0];
    items.splice(items.indexOf(victim), 1);
    total = recompute();
  }
  return items;
}

/**
 * MINUTOS ÚTILES estimados de la sesión de HOY para un split, ANTES de generar y SIN IA.
 * Corre la MISMA prescripción determinista que la generación real (allocateSessionVolume →
 * prescribeSession → Σ minutesOf), con ejercicios representativos del banco. Es la fuente FIEL
 * (el estimador lineal `series×const` erraba ~11 min); aquí el error ≈ 0 porque es la misma función.
 * Permite a AUTO saber, antes de elegir el día, qué split encaja en el tiempo disponible.
 */
export function estimatedSessionMinutes(input: {
  dayMuscles: string[];
  bank: Array<Pick<Exercise, 'id' | 'name' | 'type' | 'muscleGroup'>>;
  weeklyTarget: Record<string, number>;
  doneThisWeek: Record<string, number>;
  freqTarget: number;
  sessionsThisWeekDone?: number;
  trainingGoal: TrainingGoal;
  phase: Phase;
  level?: TrainingLevelLike;
  isDeload?: boolean;
}): number {
  const dayMuscles = input.dayMuscles;
  const alloc = allocateSessionVolume({
    weeklyTarget: input.weeklyTarget, doneThisWeek: input.doneThisWeek,
    dayMuscles, primaryMuscles: dayMuscles, freqTarget: input.freqTarget,
    sessionsThisWeekDone: input.sessionsThisWeekDone ?? 1,
    muscleWeeklyFreq: Object.fromEntries(dayMuscles.map((m) => [m, 2])),
    recovery: 'buena', isDeload: input.isDeload,
  });
  const exercises = input.bank.filter((e) => dayMuscles.includes(e.muscleGroup)).map((e) => ({ id: e.id, muscleGroup: e.muscleGroup }));
  if (exercises.length === 0) return 0;
  const bankById = new Map(input.bank.map((e) => [e.id, { id: e.id, name: e.name, type: e.type }]));
  const items = prescribeSession({
    exercises, bankById, allocation: alloc, trainingGoal: input.trainingGoal,
    phase: input.phase, level: input.level, mainMinutes: 999, lastPerf: {},
  });
  return Math.round(items.reduce((a, it) => a + minutesOf(it.prescription), 0));
}
