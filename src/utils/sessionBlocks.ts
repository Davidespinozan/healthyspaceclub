// ─────────────────────────────────────────────────────────────────────────
// sessionBlocks — Fase 3 del rediseño de cardio.
//
// La sesión deja de ser "una lista plana" y pasa a ser una SECUENCIA DE BLOQUES:
//
//     [Calentamiento] → [Bloque principal] → [Finisher]
//
// Motor DETERMINISTA y MODULAR: cada bloque decide su modalidad, duración e
// intensidad de forma independiente. No llama a la IA (la IA arma el contenido del
// bloque principal; el código coloca warm-up y finisher alrededor).
//
// Anclajes de coaching (no opinión):
//  · Warm-up = protocolo RAMP (Jeffreys): Raise → Activate/Mobilise → Potentiate.
//  · Finisher = principio, no regla dura: "protege el estímulo prioritario y
//    administra la fatiga". Ganar músculo → poco cardio por defecto, SIN tope
//    artificial; perder grasa → más. La preferencia del usuario (Fase 4) mandará.
//  · Todo respeta el PRESUPUESTO TOTAL de tiempo (el main nunca baja de su piso).
// ─────────────────────────────────────────────────────────────────────────
import type { CardioStyle, Equipment, Exercise, MuscleGroup, SessionRole, TrainingGoal } from '../types';
import { cardioEquipmentFor, defaultCardioStyle, matchesCardioStyle, hasPlayableVariant, isReproducibleStation } from './workoutPlanner';

export type BlockIntensity = 'baja' | 'media' | 'alta';
export type RampPhase = 'raise' | 'mobilise' | 'potentiate';

export interface BlockExercise {
  id: string;
  /** Prescripción sugerida (cardio va por tiempo, no reps). Single finisher. */
  prescription?: string;
  /** Rol de la estación en un circuito multiformato ('resistencia'|'cardio'|'explosividad'). */
  label?: string;
}

export interface WarmupBlock {
  kind: 'warmup';
  minutes: number;
  intensity: BlockIntensity;      // siempre progresiva: baja → media
  /** Fases RAMP, en orden. Cada una con su ejercicio (si aplica) y su cue. */
  phases: Array<{ phase: RampPhase; exerciseId: string | null; note: string }>;
}

export interface FinisherBlock {
  kind: 'finisher';
  minutes: number;
  intensity: BlockIntensity;
  cardioStyle: CardioStyle;
  format: 'steady' | 'intervals' | 'circuit';
  /** Circuito multiformato: nº de rondas (Fase 5). Ausente en steady/intervals. */
  rounds?: number;
  /** 1 estación (steady/intervals) o 2-3 estaciones encadenadas (circuit). */
  exercises: BlockExercise[];
}

export interface MainBlock {
  kind: 'main';
  minutes: number;
  intensity: BlockIntensity;
}

export interface SessionPlan {
  totalMinutes: number;
  warmup: WarmupBlock | null;
  main: MainBlock;
  finisher: FinisherBlock | null;
  /** Minutos asignados por bloque (para el llamador: dimensionar el main). */
  budget: { warmup: number; main: number; finisher: number };
}

export interface SessionInput {
  totalMinutes: number;
  /** Día de fuerza (pesas/bandas/peso). false = día de cardio o yoga. */
  isStrengthDay: boolean;
  /** Día de yoga/recovery: sesión de una pieza, sin warm-up/finisher de cardio. */
  isYogaDay?: boolean;
  /** BODY GOAL crudo (obData.goal) → SOLO la DOSIS/estilo de cardio del finisher (dimensión
   *  cardio), acotada. NUNCA decide reps/estructura de resistencia (Fase 0). */
  objective: string;
  /** TRAINING GOAL de resistencia. Driver PRINCIPAL del finisher: 'fuerza' protege más el
   *  main lift (finisher menor, sin metcon). Default hipertrofia. */
  trainingGoal?: TrainingGoal;
  /** Músculos del día → warm-up específico (RAMP: activar lo que se va a usar). */
  dayMuscles: MuscleGroup[];
  equipment: Equipment[];
  /** Seguridad: edad/articulaciones → sin alto impacto ni riesgo de caída. */
  lowImpactMode?: boolean;
  /** P1 · semana de descarga → el finisher se recorta (no debe re-meter la fatiga ahorrada). */
  isDeload?: boolean;
  /** P6 · readiness aguda BAJA → recorta el finisher (no añadir fatiga en un mal día). */
  readinessLow?: boolean;
  /** Banco completo (para elegir cardio/activación de warm-up y finisher). */
  bank: Exercise[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ── Selección de cardio por rol/estilo/equipo (peso corporal universal) ──────

function cardioByRole(
  bank: Exercise[],
  role: SessionRole,
  equipment: Equipment[],
  lowImpactMode: boolean,
  style?: CardioStyle,
): Exercise[] {
  const eq = cardioEquipmentFor(equipment);
  return bank.filter(ex => {
    if (ex.muscleGroup !== 'cardio') return false;
    if (!(ex.roles ?? []).includes(role)) return false;
    if (!ex.equipment.some(e => eq.includes(e))) return false;
    if (lowImpactMode && (ex.impact === 'high' || ex.fallRisk === true)) return false;
    if (style && !matchesCardioStyle(ex, style)) return false;
    // REPRODUCIBILIDAD: un movimiento técnico sin video no debe llegar como estación de
    // warm-up/finisher. Se admite con video (demo) o si es cardio steady-state autoexplicativo.
    if (!isReproducibleStation(ex, eq)) return false;
    return true;
  });
}

/** Primer match por estilo; si el estilo no da, cae a cualquier cardio del rol. */
function pickCardio(
  bank: Exercise[],
  role: SessionRole,
  equipment: Equipment[],
  lowImpactMode: boolean,
  style?: CardioStyle,
): Exercise | null {
  const styled = style ? cardioByRole(bank, role, equipment, lowImpactMode, style) : [];
  const pool = styled.length ? styled : cardioByRole(bank, role, equipment, lowImpactMode);
  return pool[0] ?? null;
}

// ── Presupuesto de tiempo ────────────────────────────────────────────────────

/**
 * Reparte el tiempo total entre warm-up / main / finisher. El main tiene PISO
 * (protege el estímulo prioritario): si falta tiempo, se recorta primero el
 * finisher, luego el warm-up — nunca el main por debajo de su piso.
 */
export function finisherShare(
  objective: string,
  trainingGoal: TrainingGoal = 'hipertrofia',
  readinessLow = false,
): number {
  // BODY GOAL → DOSIS de cardio del finisher (acotada). El cut recibe MÁS cardio que ganar
  // músculo, pero NUNCA de forma desproporcionada: el main block siempre domina (antes el cut
  // llegaba a 0.35 = casi metcon; ahora tope 0.22 → el principal es ≥78% del tiempo útil).
  const o = (objective || '').toLowerCase();
  let share =
    /grasa|perder|adelgaz|quemar|definir/.test(o) ? 0.22
    : /manten|salud|resist|condic/.test(o) ? 0.18
    : /bienestar|general/.test(o) ? 0.20
    : /m[uú]sculo|ganar|hipertrof/.test(o) ? 0.10
    : 0.15;
  // TRAINING GOAL manda sobre el body goal: en FUERZA se protege más el main lift → finisher
  // a la mitad (nunca comprometer el levantamiento principal por meter cardio).
  if (trainingGoal === 'fuerza') share *= 0.5;
  // P6 · readiness aguda baja → menos finisher (no re-meter fatiga en un mal día).
  if (readinessLow) share *= 0.7;
  return share;
}

export function allocateTime(input: {
  totalMinutes: number;
  isStrengthDay: boolean;
  isYogaDay?: boolean;
  objective: string;
  trainingGoal?: TrainingGoal;
  readinessLow?: boolean;
  isDeload?: boolean;
}): { warmup: number; main: number; finisher: number } {
  const total = Math.max(10, Math.round(input.totalMinutes));
  if (input.isYogaDay) return { warmup: 0, main: total, finisher: 0 };

  let warmup = input.isStrengthDay
    ? clamp(Math.round(total * 0.14), 5, 15)
    : clamp(Math.round(total * 0.10), 3, 8);

  // Finisher solo en días de FUERZA (en un día de cardio, el cardio ES el main).
  let finisher = 0;
  if (input.isStrengthDay) {
    // DELOAD: el finisher re-mete fatiga que la descarga intenta ahorrar → se recorta a la
    // mitad y con tope bajo (queda algo de trabajo aeróbico ligero solo si el objetivo lo pide).
    const share = finisherShare(input.objective, input.trainingGoal ?? 'hipertrofia', input.readinessLow ?? false)
      * (input.isDeload ? 0.5 : 1);
    finisher = Math.round((total - warmup) * share);
    const cap = input.isDeload ? 10 : 30;
    finisher = finisher < 5 ? 0 : Math.min(finisher, cap); // <5 → se omite; tope = FATIGA, no meta
  }

  let main = total - warmup - finisher;
  const mainFloor = input.isStrengthDay ? 20 : 10;
  if (main < mainFloor) {
    const cutF = Math.min(finisher, mainFloor - main);
    finisher -= cutF; main += cutF;
    if (main < mainFloor) {
      const warmFloor = input.isStrengthDay ? 4 : 2;
      const cutW = Math.min(Math.max(0, warmup - warmFloor), mainFloor - main);
      warmup -= cutW; main += cutW;
    }
  }
  return { warmup, main, finisher };
}

// ── Warm-up (RAMP) ────────────────────────────────────────────────────────────

const ACTIVATION_TYPES = new Set(['activacion', 'movilidad']);

/** Ejercicio de activación/movilidad específico al día (Activate/Mobilise del RAMP).
 *  Prioridad: activación REAL específica del día → flujo de movilidad (saludo al sol,
 *  buen mobiliser general) → activación general → cualquier movilidad. Evita elegir
 *  una pose de yoga suelta solo porque comparte músculo con el día. */
function pickActivation(bank: Exercise[], dayMuscles: MuscleGroup[], equipment: Equipment[]): Exercise | null {
  const eq = cardioEquipmentFor(equipment);
  const usable = (ex: Exercise) => ex.equipment.some(e => eq.includes(e) || e === 'cuerpo');
  const isDayMuscle = (ex: Exercise) =>
    dayMuscles.includes(ex.muscleGroup) || (ex.secondaryMuscles ?? []).some(m => dayMuscles.includes(m));
  const activacion = bank.filter(ex => ex.type === 'activacion' && usable(ex));
  // 1) activación específica del día
  const specific = dayMuscles.length ? activacion.find(isDayMuscle) : null;
  if (specific) return specific;
  // 2) flujo de movilidad canónico (saludo al sol) — mobiliser general, no una pose suelta
  const flow = bank.find(ex => ACTIVATION_TYPES.has(ex.type) && /salutation|saludo|flow|flujo/i.test(ex.id + ' ' + ex.name));
  if (flow) return flow;
  // 3) activación general → 4) cualquier movilidad
  return activacion[0]
    ?? bank.find(ex => ex.type === 'movilidad' && !ex.isYoga && usable(ex))
    ?? bank.find(ex => ex.type === 'movilidad')
    ?? null;
}

/**
 * Warm-up con protocolo RAMP. Raise (elevar pulso, cardio bajo impacto) →
 * Mobilise/Activate (específico al día) → Potentiate (aproximación al trabajo).
 * En días de fuerza el Potentiate es una NOTA (series de aproximación al 1er
 * compuesto); en días de cardio es una ráfaga corta más intensa.
 */
export function buildWarmup(minutes: number, input: SessionInput): WarmupBlock {
  const { bank, equipment, dayMuscles, isStrengthDay } = input;
  // Raise: siempre bajo impacto (seguridad en frío), aunque no sea lowImpactMode.
  const raise = pickCardio(bank, 'warmup', equipment, true, 'lowImpact')
    ?? pickCardio(bank, 'warmup', equipment, true, 'correr');
  const activation = pickActivation(bank, dayMuscles, equipment);

  const phases: WarmupBlock['phases'] = [
    { phase: 'raise', exerciseId: raise?.id ?? null,
      note: 'Eleva pulso y temperatura — ritmo suave, nada de máximos en frío.' },
    { phase: 'mobilise', exerciseId: activation?.id ?? null,
      note: 'Moviliza y activa lo que vas a usar hoy — rango completo, control.' },
    { phase: 'potentiate', exerciseId: null,
      note: isStrengthDay
        ? 'Sube carga con 2–3 series de aproximación en tu primer compuesto antes de las efectivas.'
        : 'Sube el ritmo los últimos 30–60 s para llegar listo al bloque.' },
  ];
  return { kind: 'warmup', minutes, intensity: 'baja', phases };
}

// ── Finisher ──────────────────────────────────────────────────────────────────

/** Estilo del finisher según objetivo (distinto del día de cardio dedicado). */
function finisherStyle(objective: string, lowImpactMode: boolean): CardioStyle {
  if (lowImpactMode) return 'lowImpact';
  const o = (objective || '').toLowerCase();
  if (/grasa|perder|adelgaz|quemar|definir/.test(o)) return 'funcional';
  if (/m[uú]sculo|ganar|hipertrof/.test(o)) return 'lowImpact';
  return defaultCardioStyle(objective, false);
}

/** Estación de RESISTENCIA para un circuito: un compuesto/funcional (banda o peso
 *  corporal) con variante jugable para el equipo del usuario. */
function pickStrengthForCircuit(bank: Exercise[], equipment: Equipment[], dayMuscles: MuscleGroup[], lowImpact: boolean): Exercise | null {
  const isDay = (ex: Exercise) =>
    dayMuscles.includes(ex.muscleGroup) || (ex.secondaryMuscles ?? []).some(m => dayMuscles.includes(m)) || ex.muscleGroup === 'cuerpo-completo';
  const pool = bank.filter(ex =>
    (ex.type === 'compuesto' || ex.type === 'funcional') &&
    ex.muscleGroup !== 'cardio' && !ex.isYoga &&
    hasPlayableVariant(ex, equipment) &&
    !(lowImpact && (ex.impact === 'high' || ex.fallRisk === true)),
  );
  return (dayMuscles.length ? pool.find(isDay) : null) ?? pool[0] ?? null;
}

/**
 * CIRCUITO MULTIFORMATO (Fase 5): encadena resistencia (banda/peso) → cardio
 * funcional → explosividad, por rondas. Metcon de cuerpo entero — pega fuerte en
 * perder grasa y funciona igual con bandas (no necesita gym). null si no arma ≥2
 * estaciones válidas.
 */
export function buildCircuitFinisher(minutes: number, input: SessionInput, style: CardioStyle): FinisherBlock | null {
  const { bank, equipment, dayMuscles } = input;
  const resistencia = pickStrengthForCircuit(bank, equipment, dayMuscles, false);
  const cardio = pickCardio(bank, 'finisher', equipment, false, 'funcional')
    ?? pickCardio(bank, 'main', equipment, false, 'funcional');
  const explosividad = pickCardio(bank, 'main', equipment, false, 'explosividad');

  const raw: Array<[Exercise | null, string]> = [
    [resistencia, 'resistencia'], [cardio, 'cardio'], [explosividad, 'explosividad'],
  ];
  const stations = raw.filter(([ex]) => !!ex).map(([ex, label]) => ({ id: ex!.id, label }));
  // Evita duplicar el mismo ejercicio en dos estaciones.
  const uniq = stations.filter((s, i) => stations.findIndex(x => x.id === s.id) === i);
  if (uniq.length < 2) return null;

  const rounds = Math.max(3, Math.min(5, Math.round(minutes / 4)));
  return { kind: 'finisher', minutes, intensity: 'alta', cardioStyle: style, format: 'circuit', rounds, exercises: uniq };
}

/**
 * Finisher tras el bloque principal. Duración por presupuesto; formato por objetivo:
 * grasa + funcional + tiempo → CIRCUITO multiformato; grasa con poco tiempo →
 * intervalos; el resto → steady/zona 2.
 */
export function buildFinisher(minutes: number, input: SessionInput): FinisherBlock | null {
  if (minutes < 5) return null;
  const { bank, equipment, objective, lowImpactMode = false } = input;
  const style = finisherStyle(objective, lowImpactMode);
  const o = (objective || '').toLowerCase();
  const fatLoss = /grasa|perder|adelgaz|quemar|definir/.test(o);
  // El TRAINING GOAL gatea el metcon: en FUERZA nunca se convierte el finisher en circuito
  // (protege el main lift). Así el body goal ya NO decide POR SÍ SOLO "= metcon" (Fase 0).
  const isStrength = (input.trainingGoal ?? 'hipertrofia') === 'fuerza';

  // Circuito multiformato: metcon para perder grasa (training goal hipertrofia), sin bajo
  // impacto y con tiempo. En fuerza, jamás.
  if (fatLoss && !isStrength && style === 'funcional' && minutes >= 10 && !lowImpactMode) {
    const circuit = buildCircuitFinisher(minutes, input, style);
    if (circuit) return circuit;
  }

  const pick = pickCardio(bank, 'finisher', equipment, lowImpactMode, style)
    ?? pickCardio(bank, 'finisher', equipment, lowImpactMode);
  if (!pick) return null;

  const format: FinisherBlock['format'] = fatLoss && minutes <= 15 ? 'intervals' : 'steady';
  const intensity: BlockIntensity = format === 'intervals' ? 'alta' : (lowImpactMode ? 'baja' : 'media');
  const prescription = format === 'intervals'
    ? `${minutes} min en intervalos (ej. 30 s fuerte / 30 s suave)`
    : `${minutes} min continuos a ritmo sostenible (zona 2)`;

  return { kind: 'finisher', minutes, intensity, cardioStyle: style, format,
    exercises: [{ id: pick.id, prescription }] };
}

// ── Composición ────────────────────────────────────────────────────────────────

/**
 * Arma el plan de bloques completo. Punto de entrada del motor: dado el presupuesto
 * y el contexto, devuelve warm-up + main + finisher dimensionados. El llamador usa
 * `budget.main` para dimensionar cuántos ejercicios pide al bloque principal.
 */
export function composeSession(input: SessionInput): SessionPlan {
  const budget = allocateTime(input);
  const isYoga = input.isYogaDay ?? false;

  const warmup = !isYoga && budget.warmup > 0 ? buildWarmup(budget.warmup, input) : null;
  const finisher = !isYoga && budget.finisher >= 5 ? buildFinisher(budget.finisher, input) : null;
  // Si el finisher no pudo armarse (sin cardio válido), su tiempo vuelve al main.
  const finisherMin = finisher ? budget.finisher : 0;
  const mainMin = budget.main + (budget.finisher - finisherMin);

  const mainIntensity: BlockIntensity = input.isStrengthDay ? 'media' : 'media';
  return {
    totalMinutes: input.totalMinutes,
    warmup,
    main: { kind: 'main', minutes: mainMin, intensity: mainIntensity },
    finisher,
    budget: { warmup: warmup ? budget.warmup : 0, main: mainMin, finisher: finisherMin },
  };
}
