// ─────────────────────────────────────────────────────────────────────────
// cardioMain — FASE CARDIO MAIN · MOTOR DETERMINISTA DEL BLOQUE PRINCIPAL DE CARDIO.
//
// Antes el main de un día de cardio lo improvisaba la IA (solo recibía un conteo de ejercicios):
// 120 min pedidos → ~25-50 min de contenido, sin estructura steady/interval, sin techo de trabajo
// intenso. Este motor GOBIERNA la estructura: dado el presupuesto de tiempo + estilo + nivel +
// readiness + bodyGoal + gear, construye un CardioMainPlan de BLOQUES con duración/intensidad/
// work-rest deterministas. La IA solo explica/da cues; NO decide minutos, rounds ni intensidad.
//
// PRINCIPIO: duración de SESIÓN ≠ duración de ESFUERZO INTENSO. Más tiempo escala sobre todo el
// trabajo AERÓBICO SOSTENIBLE, no el intenso, que tiene TECHO por estilo×nivel×readiness. La
// explosividad puede terminar antes de la ventana (early end intencional): es calidad, no volumen.
//
// NO toca fuerza/hipertrofia/P1–P6 de resistencia. Reutiliza ideas del finisher (zona2/intervalos)
// SIN heredar sus caps (el finisher es un complemento; esto es el main).
// ─────────────────────────────────────────────────────────────────────────
import type { Exercise, CardioStyle, Equipment } from '../types';
import type { CardioExerciseMeta } from './workoutDisplay';
import { VIDEO_VARIANT_IDS } from '../data/videoAvailability';

export type CardioBlockKind = 'steady' | 'intervals' | 'drills' | 'power' | 'recovery' | 'cooldown';
export type CardioIntensity = 'baja' | 'media' | 'alta';

// ── F2C-5 · RAZÓN TIPADA de por qué terminó la sesión de cardio (observabilidad/UX, NO cambia la dosis).
// Distingue un fin FISIOLÓGICO/estructural (dosis/estilo/aeróbico) de un fin por CONTENIDO (no había
// estación continua reproducible). Autoridad única: la calcula buildCardioMain y viaja al plan/UI.
//   · AVAILABLE_TIME_FILLED — llenó ~el tiempo disponible (no hay early-end).
//   · DOSE_REACHED          — dosis útil cubierta con contenido disponible, aunque quedara tiempo.
//   · STYLE_QUALITY_CAP     — el estilo tiene tope deliberado (explosividad; correr-principiante).
//   · AEROBIC_CAP_REACHED   — tope aeróbico deliberado por nivel/política.
//   · CONTENT_LIMITED       — quedaba tiempo y quería una fase continua, pero NO había estación
//                             compatible/reproducible (caso bodyweight sin video de marcha/paso).
//   · EQUIPMENT_LIMITED     — DIFERIDO (v1): distinguirlo de CONTENT_LIMITED en runtime exigiría una
//                             auditoría de "existiría con otro equipo" que hoy no tenemos; v1 usa
//                             CONTENT_LIMITED para ambos. Se mantiene en la unión para no romper consumidores.
export type CardioEndReason =
  | 'AVAILABLE_TIME_FILLED' | 'DOSE_REACHED' | 'STYLE_QUALITY_CAP'
  | 'AEROBIC_CAP_REACHED' | 'CONTENT_LIMITED' | 'EQUIPMENT_LIMITED';

export interface CardioBlock {
  kind: CardioBlockKind;
  minutes: number;              // duración TOTAL del bloque (trabajo + descanso incluidos)
  stationId: string;            // ejercicio/estación (id del banco)
  intensity: CardioIntensity;
  labelKey: string;             // clave i18n del nombre del bloque (el player la traduce)
  zone?: string;                // 'Zona 2' (steady/recovery)
  rpe?: number;                 // 1-10 (esfuerzo percibido)
  workSec?: number;             // intervalos/power
  restSec?: number;
  rounds?: number;
  cue?: string;                 // nota determinista breve (opcional; la IA puede enriquecer)
}

export interface CardioMainPlan {
  style: CardioStyle;
  budgetMinutes: number;
  totalMinutes: number;         // suma real de los bloques (≤ budget)
  intenseMinutes: number;       // minutos de trabajo INTENSO (para el techo/invariantes)
  steadyMinutes: number;        // minutos aeróbicos sostenibles
  earlyEnd: boolean;            // terminó antes de la ventana a propósito
  earlyEndReason?: string;      // string interno de debug (console/diagnóstico); NO es user-facing
  endReason: CardioEndReason;   // F2C-5 · razón TIPADA (autoridad para el copy honesto de la UI)
  blocks: CardioBlock[];
}

type Level = 'principiante' | 'intermedio' | 'avanzado';
const lvl = (l?: string): Level => (l === 'principiante' || l === 'avanzado' ? l : 'intermedio');
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round = (v: number) => Math.round(v);

// ── Techos de TRABAJO INTENSO (min) por estilo, a nivel intermedio/normal ────────────────
// lowImpact: 0 (todo sostenible). correr/funcional/explosividad: dosis de calidad acotada.
const INTENSE_BASE: Record<CardioStyle, number> = { lowImpact: 0, correr: 14, funcional: 18, explosividad: 12 };
// Techo de MINUTOS TOTALES por estilo (Infinity = llena la ventana). Explosividad tiene tope duro.
const TOTAL_CAP: Record<CardioStyle, (l: Level) => number> = {
  lowImpact: () => Infinity,                                   // llena la ventana con steady
  correr: (l) => (l === 'principiante' ? 60 : Infinity),      // principiante no corre 120 min
  funcional: () => Infinity,                                   // llena con recuperación entre bloques
  explosividad: (l) => (l === 'principiante' ? 30 : l === 'avanzado' ? 60 : 45), // calidad, no volumen
};
const LEVEL_MULT: Record<Level, number> = { principiante: 0.5, intermedio: 1, avanzado: 1.4 };

/** Techo de minutos intensos, contextual (estilo × nivel × readiness). Deload/low lo recortan. */
export function intensityBudget(style: CardioStyle, level: string, readiness: 'low' | 'normal' | 'high' = 'normal', isDeload = false): number {
  if (isDeload) return 0;                                       // deload: cardio suave
  const base = INTENSE_BASE[style] * LEVEL_MULT[lvl(level)];
  const rMult = readiness === 'low' ? 0.4 : readiness === 'high' ? 1.1 : 1;
  return Math.max(0, round(base * rMult));
}

const RPE: Record<CardioIntensity, number> = { baja: 3, media: 6, alta: 9 };
const ZONE: Record<CardioIntensity, string> = { baja: 'Zona 2', media: 'Zona 3', alta: 'Zona 4-5' };

/** ¿La estación coincide REALMENTE con un estilo de cardio (a nivel ejercicio o variante)? Fuente de
 *  la IDENTIDAD ESTRICTA de cada modalidad: cada main usa SOLO estaciones de su estilo, nunca el
 *  fallback genérico del caller (que mezcla burpees/kettlebells/máquinas de otras modalidades). */
const matchesStyle = (e: Exercise, style: CardioStyle): boolean =>
  e.cardioStyle === style || (e.variants ?? []).some(v => v.cardioStyle === style);
function isRunningStation(e: Exercise): boolean { return matchesStyle(e, 'correr'); }
function isFunctionalStation(e: Exercise): boolean { return matchesStyle(e, 'funcional'); }
function isExplosiveStation(e: Exercise): boolean { return matchesStyle(e, 'explosividad'); }

// F2C-7 · el kind (fase) se deriva del labelKey → recovery / cooldown / steady son fases distintas
// con semántica propia (no un genérico "steady" con cue). Se preserva builder→persistencia→display→audit.
const continuousKindFor = (labelKey: string): CardioBlockKind =>
  labelKey === 'cardio.recovery' ? 'recovery' : labelKey === 'cardio.cooldown' ? 'cooldown' : 'steady';
const mkSteady = (minutes: number, stationId: string, intensity: CardioIntensity, labelKey: string, cue?: string): CardioBlock =>
  ({ kind: continuousKindFor(labelKey), minutes: round(minutes), stationId, intensity, labelKey, zone: ZONE[intensity], rpe: RPE[intensity], cue });

const mkIntervals = (kind: 'intervals' | 'power', rounds: number, workSec: number, restSec: number, stationId: string, labelKey: string, cue?: string): CardioBlock => {
  const minutes = round((rounds * (workSec + restSec)) / 60);
  return { kind, minutes, stationId, intensity: 'alta', labelKey, rpe: kind === 'power' ? 10 : 9, workSec, restSec, rounds, cue };
};

const mkDrills = (minutes: number, stationId: string, labelKey: string, cue?: string): CardioBlock =>
  ({ kind: 'drills', minutes: round(minutes), stationId, intensity: 'media', labelKey, rpe: RPE.media, cue });

/** Minutos INTENSOS reales de un bloque: work de intervals/power, o el total si es steady 'alta'. */
function intenseOf(b: CardioBlock): number {
  if (b.kind === 'intervals' || b.kind === 'power') return round(((b.rounds ?? 0) * (b.workSec ?? 0)) / 60);
  return b.intensity === 'alta' ? b.minutes : 0;
}

// ── CAPACIDADES DE ESTACIÓN (F2C-4) · autoridad ÚNICA de qué FASES puede cubrir una estación ──────
// LOW IMPACT MECÁNICO ≠ CARDIO SOSTENIBLE. Una plancha (core) o unos escaladores (funcional) son bajo
// impacto pero NO son trabajo CONTINUO. Arquitectura HÍBRIDA fail-closed:
//   1) `ex.cardioRoles` EXPLÍCITO manda si existe.
//   2) si no, DERIVACIÓN CONSERVADORA: continuous (steady/recovery/cooldown) SOLO si es muscleGroup='cardio',
//      mecánicamente seguro Y de estilo INHERENTEMENTE continuo (lowImpact/correr). funcional/explosividad/
//      core/no-cardio → NO continuous.
//   3) DESCONOCIDO → fail closed (no adquiere continuous por ausencia de metadata).
export type CardioPhaseRole = 'steady' | 'recovery' | 'cooldown' | 'interval' | 'power' | 'drill';
export interface CardioStationCapabilities {
  steady: boolean; recovery: boolean; cooldown: boolean;   // trabajo CONTINUO
  interval: boolean; power: boolean; drill: boolean;        // trabajo por esfuerzos
  maxContinuousMinutes: number;                             // tope de un bloque continuo (Infinity si ilimitado; 0 si no-continuous)
  demand: 'high' | 'normal';                                // coste/fatiga → acota la dosis de intervalos
}
export function cardioStationCapabilities(ex: Exercise): CardioStationCapabilities {
  const explicit = (ex as { cardioRoles?: CardioPhaseRole[] }).cardioRoles;
  const isCardio = ex.muscleGroup === 'cardio';
  const mechSafe = ex.impact !== 'high' && !ex.fallRisk;
  // CONTINUO derivado: cardio + seguro + estilo continuo por naturaleza (lowImpact/correr). NUNCA por impact solo.
  const continuous = isCardio && mechSafe && (matchesStyle(ex, 'lowImpact') || matchesStyle(ex, 'correr'));
  const derived = {
    steady: continuous, recovery: continuous, cooldown: continuous,
    interval: isCardio && (matchesStyle(ex, 'funcional') || matchesStyle(ex, 'correr') || matchesStyle(ex, 'explosividad')),
    power: matchesStyle(ex, 'explosividad'),
    drill: isCardio && (matchesStyle(ex, 'funcional') || matchesStyle(ex, 'correr') || matchesStyle(ex, 'explosividad')),
  };
  const roles = explicit
    ? { steady: explicit.includes('steady'), recovery: explicit.includes('recovery'), cooldown: explicit.includes('cooldown'), interval: explicit.includes('interval'), power: explicit.includes('power'), drill: explicit.includes('drill') }
    : derived;
  const anyContinuous = roles.steady || roles.recovery || roles.cooldown;
  const explicitMax = (ex as { maxContinuousMinutes?: number }).maxContinuousMinutes;
  // no-continuous → 0 (jamás recibe minutos continuos). Locomoción sostenible (correr/máquina gym) → ilimitado.
  // Marcha/paso-lateral en el lugar (bodyweight, tedioso en bloques largos) → tope 45'.
  const sustainableLoco = matchesStyle(ex, 'correr') || (ex.equipment ?? []).includes('gym');
  const maxContinuousMinutes = !anyContinuous ? 0 : (explicitMax ?? (sustainableLoco ? Infinity : 45));
  const demand: 'high' | 'normal' = (ex.impact === 'high' || ex.fallRisk === true) ? 'high' : 'normal';
  return { ...roles, maxContinuousMinutes, demand };
}
/** Compat + supportPool: ¿la estación soporta trabajo CONTINUO (steady/recovery/cooldown)? */
export function cardioStationRole(ex: Exercise): { sustainable: boolean; interval: boolean; power: boolean } {
  const c = cardioStationCapabilities(ex);
  return { sustainable: c.steady || c.recovery || c.cooldown, interval: c.interval, power: c.power };
}

/** Picker DETERMINISTA que reparte uso (diversidad) y NO usa fallback inseguro: devuelve null si no hay
 *  estación elegible (→ el motor acorta/omite el bloque; QUALITY > FILL RATE). */
function pickLeastUsed(pool: Exercise[], used: Map<string, number>, maxUses = 2): string | null {
  let best: Exercise | null = null; let bestUses = Infinity;
  for (const e of pool) {                                    // orden del pool = determinista (resume estable)
    const u = used.get(e.id) ?? 0;
    if (u < bestUses) { best = e; bestUses = u; }
  }
  if (!best || bestUses >= maxUses) return null;
  return best.id;
}
const bump = (used: Map<string, number>, id: string) => used.set(id, (used.get(id) ?? 0) + 1);

/** Etiqueta GLOBAL de intensidad de la sesión, derivada de la carga real (fracción intensa + presencia
 *  de bloques máximos). Hipótesis inicial (calibrable con la matriz): domina el trabajo, no un atributo. */
// F2C-7 · label SEMÁNTICO (representa el estímulo PROGRAMADO, no una fracción diluida por el aeróbico).
// Regla defendible: si hay trabajo intenso PROGRAMADO (power/intervals) o tempo/Z3, la sesión NUNCA es
// 'baja' — un HIIT no se etiqueta 'baja' porque el denominador incluya la base aeróbica. Solo una sesión
// puramente continua de Zona 2 (sin intervalos/potencia/tempo) es 'baja'.
export function sessionIntensityLabel(plan: Pick<CardioMainPlan, 'totalMinutes' | 'intenseMinutes' | 'blocks'>): CardioIntensity {
  if (plan.totalMinutes <= 0) return 'baja';
  const hasPower = plan.blocks.some(b => b.kind === 'power');
  const hasIntervals = plan.blocks.some(b => b.kind === 'intervals');
  // tempo/Z3 = bloque continuo de intensidad media/alta (bajo impacto avanzado, tempo de carrera).
  const hasTempoOrZ3 = plan.blocks.some(b => (b.kind === 'steady' || b.kind === 'recovery') && b.intensity !== 'baja');
  if (hasPower || plan.intenseMinutes >= 12) return 'alta';   // potencia o ≥2 circuitos = carga alta
  if (hasIntervals || hasTempoOrZ3) return 'media';           // cualquier estímulo intenso/tempo → no 'baja'
  return 'baja';                                              // Zona 2 continua pura
}

/**
 * Construye el CardioMainPlan determinista. `pool` = candidatos de cardio ya filtrados por
 * estilo/gear/seguridad (upstream). warmup/finisher se manejan fuera (composeSession).
 */
// ── F2C-3 · CAPS de ARQUITECTURA (calibrables) ────────────────────────────────────────────────
// Rondas MÁX por circuito/intervalo, por estilo×nivel. La cantidad REAL se DERIVA del techo intenso
// (abajo); este es solo el tope superior. Un 2º bloque intenso hay que GANARLO (avanzado + budget).
const ROUNDS_CAP: Record<CardioStyle, Record<Level, number>> = {
  funcional:    { principiante: 6, intermedio: 8, avanzado: 10 },
  correr:       { principiante: 6, intermedio: 10, avanzado: 14 },
  explosividad: { principiante: 5, intermedio: 8, avanzado: 12 },
  lowImpact:    { principiante: 0, intermedio: 0, avanzado: 0 },
};
// Tope de MINUTOS aeróbicos sostenibles de la SESIÓN (main) por nivel — evita 120' de Zona 2 a un
// principiante. avanzado sin tope (puede sostener volumen). QUALITY > FILL: si el budget excede el
// tope, se declara earlyEnd honesto (no se rellena a la fuerza).
const AEROBIC_CAP: Record<Level, number> = { principiante: 75, intermedio: 120, avanzado: Infinity };

// ── F2C-7 · PROGRAMACIÓN (distinta de la SEGURIDAD) ────────────────────────────────────────────
// PROGRAMMING CAP: cuántos minutos CONTINUOS seguidos conviene en UNA estación antes de rotar/cerrar
// la fase. Es una autoridad de PROGRAMACIÓN, NO de seguridad: aunque una bici soporte ∞ minutos
// (maxContinuousMinutes), 72' seguidos de bici NO es una buena prescripción. El bloque real usa
// min(maxContinuousMinutes de la estación, este cap). Style-aware: en lowImpact el continuo ES la
// sesión (tramos más largos, pero ondulados); en funcional el aeróbico es SOPORTE (tramos cortos).
const PROG_CONTINUOUS_CAP: Record<CardioStyle, number> = {
  funcional: 12,
  correr: 15,
  lowImpact: 30,   // continuo es el punto; tramos más largos válidos (§15), pero con rotación/cooldown
  explosividad: 8,
};
// AEROBIC SHARE: fracción del presupuesto principal (ventana) dedicada al DESARROLLO AERÓBICO
// (trabajo continuo no-intenso). Es un PHASE BUDGET calculado ANTES de elegir estaciones — el volumen
// aeróbico lo decide el template, NUNCA el residual (`remaining`). funcional: aeróbico secundario;
// lowImpact: aeróbico es el estímulo; correr: rodaje dominante; explosividad: mínimo.
const AEROBIC_SHARE: Record<CardioStyle, number> = {
  funcional: 0.42,   // conditioning-primary: el aeróbico es SOPORTE secundario
  correr: 0.62,      // rodaje dominante, con sitio para intervalos/tempo + cooldown
  lowImpact: 0.90,   // el continuo ES la sesión → llena la ventana, pero PROGRAMADO (fragmentado + cooldown)
  explosividad: 0.14,// mínimo (calidad, no volumen)
};

/**
 * Construye el CardioMainPlan determinista (F2C-3 · arquitectura por fases). `pool` = estaciones del
 * ESTILO (main work). `supportPool` = estaciones SOSTENIBLES cross-style (bici/marcha/…) para las fases
 * de SOPORTE (steady/recovery/cooldown). warmup/finisher se manejan fuera (composeSession/warmupBlock).
 * Reglas núcleo: techo intenso ESTRICTO (rounds derivadas del budget), estación sostenible OBLIGATORIA
 * para trabajo continuo (sin fallback inseguro), diversidad, earlyEnd honesto (no rellenar por llegar al budget).
 */
export function buildCardioMain(input: {
  mainBudgetMinutes: number;
  style: CardioStyle;
  level?: string;
  readiness?: 'low' | 'normal' | 'high';
  bodyGoal?: string;
  lowImpactMode?: boolean;
  isDeload?: boolean;
  pool: Exercise[];
  supportPool?: Exercise[];   // F2C-3 · estaciones SOSTENIBLES (cross-style) para steady/recovery/cooldown
}): CardioMainPlan {
  const budget = Math.max(5, round(input.mainBudgetMinutes));
  const style = input.style;
  const L = lvl(input.level);
  const readiness = input.readiness ?? 'normal';
  const intenseCap = intensityBudget(style, L, readiness, input.isDeload);
  const goal = (input.bodyGoal ?? '').toLowerCase();
  const conservative = /m[uú]sculo|ganar|hipertrof/.test(goal);
  const steadyBias = /grasa|perder|bienestar|salud|manten/.test(goal);
  let intenseAllow = round(intenseCap * (conservative ? 0.7 : 1) * (steadyBias ? 0.85 : 1));

  const pool = input.pool;
  const contentGap = (reason: string): CardioMainPlan =>
    ({ style, budgetMinutes: budget, totalMinutes: 0, intenseMinutes: 0, steadyMinutes: 0, earlyEnd: true, earlyEndReason: `content gap: ${reason}`, endReason: 'CONTENT_LIMITED', blocks: [] });
  if (!pool.length) return contentGap('sin estaciones de cardio reproducibles con este equipo');

  // CAPACIDADES por estación (autoridad única fail-closed). allStations = support cross-style + estilo.
  const seen = new Set<string>();
  const allStations: Exercise[] = [];
  for (const e of [...(input.supportPool ?? []), ...pool]) { if (!seen.has(e.id)) { seen.add(e.id); allStations.push(e); } }
  const capsById = new Map(allStations.map(e => [e.id, cardioStationCapabilities(e)]));
  const cap = (id: string) => capsById.get(id);
  // Pool CONTINUO por rol: SOLO estaciones con la capacidad requerida (fail closed). Nunca por impact solo.
  const continuousPool = (role: 'steady' | 'recovery' | 'cooldown') =>
    allStations.filter(e => capsById.get(e.id)![role] && capsById.get(e.id)!.maxContinuousMinutes >= 3);

  const blocks: CardioBlock[] = [];
  let earlyEnd = false; let earlyEndReason: string | undefined;
  const used = new Map<string, number>();
  let intenseUsed = 0;

  // Ventana de trabajo = budget acotado por el tope del estilo (explosividad/correr-principiante) y el
  // tope aeróbico del nivel (aeróbicos). Si es menor que el budget → earlyEnd honesto.
  const styleCap = TOTAL_CAP[style](L);
  const aerobicCap = style === 'explosividad' ? styleCap : AEROBIC_CAP[L];
  const window = Math.min(budget, styleCap, aerobicCap);
  if (window < budget) {
    earlyEnd = true;
    earlyEndReason = style === 'explosividad' ? 'explosividad = calidad/potencia, no volumen: la dosis útil ya está; más sería contraproducente'
      : window === styleCap ? 'volumen de la modalidad acotado por seguridad para el nivel'
      : 'dosis aeróbica útil para el nivel alcanzada; más tiempo no aporta';
  }
  let remaining = window;
  // DISTRIBUCIÓN global: el trabajo intenso nunca domina la sesión — techo adicional ~40% de la ventana
  // (una sesión de 20' no debe ser 12' de tempo). Además del techo por estilo×nivel×readiness.
  intenseAllow = Math.min(intenseAllow, Math.round(window * 0.4));

  const pushBlock = (b: CardioBlock) => { blocks.push(b); remaining -= b.minutes; bump(used, b.stationId); };

  // CONTINUO (steady/recovery/cooldown): rellena `minutes` a través de estaciones CON la capacidad del rol,
  // respetando maxContinuousMinutes de cada una (fragmenta a otra estación si el bloque excede el tope).
  // Sin estación compatible → NO se crea bloque (fail closed; jamás una estación incompatible). Devuelve lo llenado.
  // `progCap` (F2C-7) = tope de PROGRAMACIÓN por bloque (rotación); el bloque real respeta min(safety, progCap).
  const addContinuous = (minutes: number, role: 'steady' | 'recovery' | 'cooldown', intensity: CardioIntensity, labelKey: string, cue: string, poolOverride?: Exercise[], progCap = Infinity): number => {
    let filled = 0;
    while (minutes - filled >= 3 && remaining >= 3) {
      const id = pickLeastUsed(poolOverride ?? continuousPool(role), used, 2);
      if (!id) break;                                                   // sin estación compatible → parar (no rellenar mal)
      const stMax = Math.min(cap(id)!.maxContinuousMinutes, progCap);   // SEGURIDAD ∧ PROGRAMACIÓN
      const m = Math.min(minutes - filled, remaining, stMax);
      if (m < 3) break;
      pushBlock(mkSteady(m, id, intensity, labelKey, cue));
      filled += m;
    }
    return filled;
  };
  const roleOf = (labelKey: string): 'steady' | 'recovery' | 'cooldown' =>
    labelKey === 'cardio.recovery' ? 'recovery' : labelKey === 'cardio.cooldown' ? 'cooldown' : 'steady';
  const addSustainable = (minutes: number, intensity: CardioIntensity, labelKey: string, cue: string, progCap = Infinity): boolean =>
    addContinuous(minutes, roleOf(labelKey), intensity, labelKey, cue, undefined, progCap) >= 3;

  // INTENSO (intervals/power): estación con la capacidad requerida; rondas = MÁS RESTRICTIVO de {techo
  // estilo×nivel, readiness, DEMANDA de estación, techo intenso global}. Invariante intenseUsed+block ≤ techo.
  const addIntense = (kind: 'intervals' | 'power', workSec: number, restSec: number, roundsCapBase: number, labelKey: string, cue: string, mainPool: Exercise[]): boolean => {
    const roleWanted: 'interval' | 'power' = kind === 'power' ? 'power' : 'interval';
    const id = pickLeastUsed(mainPool.filter(e => capsById.get(e.id)?.[roleWanted]), used, 2);  // main work = ESTILO + capacidad
    if (!id) return false;
    // DEMANDA de estación: alta (impact high/fallRisk, p.ej. burpee) → menos rondas que un swing normal.
    const demandMult = cap(id)!.demand === 'high' ? 0.6 : 1;
    let roundsCap = readiness === 'low' ? Math.round(roundsCapBase * 0.6) : roundsCapBase;  // readiness baja → menos rondas
    roundsCap = Math.max(3, Math.round(roundsCap * demandMult));
    const intenseRemaining = intenseAllow - intenseUsed;
    if (intenseRemaining < 3 || roundsCap < 3) return false;          // sin budget intenso útil
    const byBudget = Math.floor((intenseRemaining * 60) / workSec);   // rondas cuyo TRABAJO cabe en el techo
    let rounds = clamp(Math.min(byBudget, roundsCap), 3, roundsCap);
    let blockIntense = round((rounds * workSec) / 60);
    while (rounds > 3 && intenseUsed + blockIntense > intenseAllow) { rounds--; blockIntense = round((rounds * workSec) / 60); }
    if (intenseUsed + blockIntense > intenseAllow) return false;      // INVARIANTE: nunca sobrepasar el techo
    const b = mkIntervals(kind, rounds, workSec, restSec, id, labelKey, cue);
    if (b.minutes > remaining) return false;
    pushBlock(b); intenseUsed += blockIntense;
    return true;
  };

  const addDrill = (minutes: number, cue: string, mainPool: Exercise[]): boolean => {
    const id = pickLeastUsed(mainPool.filter(e => capsById.get(e.id)?.drill), used, 2);
    const m = Math.min(minutes, remaining);
    if (!id || m < 2) return false;
    pushBlock(mkDrills(m, id, 'cardio.drills', cue));
    return true;
  };

  // ── F2C-7 · PROGRAMACIÓN POR FASES ───────────────────────────────────────────────────────────
  // Phase budgets calculados ANTES de elegir estaciones. El volumen AERÓBICO lo decide el TEMPLATE
  // (share del budget, acotado por progCap + rotación), NUNCA el residual (`remaining`). La sesión
  // PUEDE terminar antes del tiempo disponible si su estructura ya está completa (endReason honesto).
  // El trabajo PRINCIPAL usa SOLO estaciones del estilo (identidad estricta); el soporte cruza a continuo.
  const progCap = PROG_CONTINUOUS_CAP[style];
  const cooldownBudget = window >= 12 ? clamp(round(window * 0.08), 3, 5) : 0;   // fase COOLDOWN real (kind propio)
  const aerobicBudget = Math.max(0, round(window * AEROBIC_SHARE[style]));       // PHASE BUDGET aeróbico

  // Cierra la sesión con una fase de COOLDOWN explícita (kind='cooldown'); si no hay estación continua, se omite.
  const COOLDOWN_CUE = 'Vuelta a la calma; baja pulsaciones y respira.';
  const addCooldown = (): void => {
    if (cooldownBudget < 3 || remaining < 3) return;
    // 1) Ruta normal: rotación (pickLeastUsed, maxUses 2) — prefiere una estación no/menos usada.
    const filled = addContinuous(cooldownBudget, 'cooldown', 'baja', 'cardio.cooldown', COOLDOWN_CUE, undefined, progCap);
    if (filled >= 3) return;
    // 2) FALLBACK F2C-7 (SOLO kind='cooldown'): si la VARIEDAD se agotó (las estaciones ya se usaron en
    //    recovery/steady), permitir REUTILIZAR la última estación continuous-cooldown VÁLIDA para no perder
    //    el cooldown. `continuousPool('cooldown')` es fail-closed: capability.cooldown===true, cardio, segura
    //    y playable (nunca burpees/intervals/power/non-cardio). Un ÚNICO bloque con su budget propio; respeta
    //    safety maxContinuousMinutes ∧ progCap; NO devuelve remaining ni toca la rotación de otras fases.
    const cdPool = continuousPool('cooldown');
    if (!cdPool.length) return;                          // sin estación de cooldown compatible → se omite (fail closed)
    const id = pickLeastUsed(cdPool, used, Infinity);    // reutiliza la MENOS usada, ignorando solo aquí el cap de variedad
    if (!id) return;
    const m = Math.min(cooldownBudget, remaining, cap(id)!.maxContinuousMinutes, progCap);
    if (m < 3) return;
    pushBlock(mkSteady(m, id, 'baja', 'cardio.cooldown', COOLDOWN_CUE));
  };

  if (style === 'lowImpact') {
    // TEMPLATE: desarrollo aeróbico (ondulado, fragmentado/rotado por progCap) → progresión Z3 (avanzado) → cooldown
    if (!continuousPool('steady').length) return contentGap('sin estaciones de bajo impacto reproducibles con este equipo');
    const mainAerobic = Math.min(aerobicBudget, Math.max(0, window - cooldownBudget));
    if (L === 'avanzado' && mainAerobic >= 16) {
      const z3 = round(mainAerobic * 0.3);                                       // ondulación Z2/Z3 (bajo impacto ≠ baja intensidad)
      addSustainable(mainAerobic - z3, 'baja', 'cardio.steady', 'Zona 2 sostenible; podrías conversar.', progCap);
      addSustainable(z3, 'media', 'cardio.steady', 'Tramo tempo controlado, sigue de bajo impacto.', progCap);
    } else {
      addSustainable(mainAerobic, 'baja', 'cardio.steady', 'Zona 2 sostenible; podrías conversar.', progCap);
    }
    addCooldown();
  } else if (style === 'correr') {
    // TEMPLATE: drills → estímulo principal (intervalos/tempo) → rodaje aeróbico (acotado) → cooldown
    const runStations = pool.filter(isRunningStation);
    addDrill(L === 'principiante' ? 4 : 5, 'Técnica de carrera: skipping, talones, zancada.', runStations);
    if (L === 'avanzado') {
      addIntense('intervals', 60, 30, ROUNDS_CAP.correr[L], 'cardio.intervals', 'Series a ritmo fuerte, recupera trotando.', runStations);
    } else {
      const tempo = Math.min(intenseAllow, round(window * 0.18));
      const id = pickLeastUsed(runStations.filter(e => capsById.get(e.id)?.interval), used, 2);
      if (id && tempo >= 4 && intenseUsed + tempo <= intenseAllow) { pushBlock(mkSteady(tempo, id, 'alta', 'cardio.tempo', 'Bloque tempo: cómodamente duro.')); intenseUsed += tempo; }
    }
    // rodaje suave DOMINANTE (acotado por su phase budget): estaciones de CARRERA continuous PRIMERO.
    const runContinuous = continuousPool('steady').filter(e => matchesStyle(e, 'correr'));
    const easyCue = L === 'principiante' ? 'Alterna trote suave y caminata; la mayor parte es fácil.' : 'Rodaje suave; la mayor parte del volumen es fácil.';
    const easyBudget = Math.min(aerobicBudget, Math.max(0, remaining - cooldownBudget));
    if (easyBudget >= 3) addContinuous(easyBudget, 'steady', 'baja', 'cardio.steady', easyCue, [...runContinuous, ...continuousPool('steady')], progCap);
    addCooldown();
  } else if (style === 'explosividad') {
    // TEMPLATE: prep neural → potencia (calidad, no volumen) → cooldown breve. SIN relleno aeróbico → termina antes.
    const stn = pool.filter(isExplosiveStation);
    if (!stn.length) return contentGap('sin estaciones de explosividad reproducibles (el banco no tiene saltos/potencia con video)');
    addDrill(L === 'principiante' ? 6 : 8, 'Preparación neural: saltos suaves, movilidad, técnica.', stn);
    addIntense('power', 10, L === 'principiante' ? 90 : 75, ROUNDS_CAP.explosividad[L], 'cardio.power', 'Máxima calidad por repetición; descansa completo entre esfuerzos.', stn);
    addCooldown();
  } else { // funcional
    // TEMPLATE: circuito primario → recovery → circuito secundario (GANADO) → soporte aeróbico (acotado) → cooldown
    const stn = pool.filter(isFunctionalStation);
    if (!stn.length) return contentGap('sin estaciones funcionales reproducibles con este equipo');
    const built = addIntense('intervals', 40, 20, ROUNDS_CAP.funcional[L], 'cardio.circuit', 'Circuito: 40s trabajo / 20s transición, técnica sólida.', stn);
    // 2º circuito: SOLO avanzado (se gana con techo intenso + estación de recovery). intermedio/principiante
    // = 1 circuito programado + soporte aeróbico + cooldown (estructura, no densidad).
    const wantSecondary = built && L === 'avanzado'
      && (intenseAllow - intenseUsed) >= 4 && continuousPool('recovery').length > 0;
    if (wantSecondary) {
      addSustainable(3, 'baja', 'cardio.recovery', 'Recuperación activa entre circuitos.', progCap);  // ≥3 = piso de addContinuous
      addIntense('intervals', 40, 20, ROUNDS_CAP.funcional[L], 'cardio.circuit', 'Segundo circuito — mantén la técnica.', stn);
    }
    // Soporte aeróbico: PHASE BUDGET (share del estilo), fragmentado y ROTADO por progCap. NO es `remaining`.
    const aerobicSupport = Math.min(aerobicBudget, Math.max(0, remaining - cooldownBudget));
    if (aerobicSupport >= 4) addSustainable(aerobicSupport, 'baja', 'cardio.steady', 'Trabajo aeróbico sostenible en Zona 2.', progCap);
    addCooldown();
  }

  // Ajuste final: nunca exceder el budget (recorta el último bloque sostenible si hiciera falta).
  const isContinuousKind = (k: CardioBlockKind) => k === 'steady' || k === 'recovery' || k === 'cooldown';
  let total = blocks.reduce((a, b) => a + b.minutes, 0);
  while (total > budget && blocks.length) {
    const last = blocks[blocks.length - 1];
    const over = total - budget;
    if (isContinuousKind(last.kind) && last.minutes - over >= 3) { last.minutes -= over; break; }
    if (isContinuousKind(last.kind)) { blocks.pop(); total = blocks.reduce((a, b) => a + b.minutes, 0); }
    else break;
  }
  total = blocks.reduce((a, b) => a + b.minutes, 0);
  const intenseMinutes = blocks.reduce((a, b) => a + intenseOf(b), 0);
  const steadyMinutes = blocks.filter(b => isContinuousKind(b.kind) && b.intensity !== 'alta').reduce((a, b) => a + b.minutes, 0);
  if (!earlyEnd && budget - total > Math.max(6, budget * 0.15)) { earlyEnd = true; earlyEndReason = 'dosis útil de la modalidad alcanzada'; }

  // ── F2C-5 · CLASIFICACIÓN de la razón (NO altera bloques/dosis; deriva de estado ya calculado). ──
  // Precedencia: (1) sin early-end → llenó el tiempo; (2) explosividad = calidad, no volumen;
  // (3) llenó la VENTANA y la ventana (< budget) fue el límite → estilo/aeróbico; (4) quedó corto de la
  // ventana → si quería continuo y no había estación reproducible → CONTENT_LIMITED, si no → DOSE_REACHED.
  const continuousAvailable = continuousPool('steady').length > 0 || continuousPool('recovery').length > 0;
  const filledWindow = window - total <= Math.max(6, Math.round(window * 0.15));
  let endReason: CardioEndReason;
  if (!earlyEnd) {
    endReason = 'AVAILABLE_TIME_FILLED';
  } else if (style === 'explosividad') {
    endReason = 'STYLE_QUALITY_CAP';                                  // explosividad SIEMPRE es tope de estilo
  } else if (window < budget && filledWindow) {
    endReason = (window === styleCap && styleCap !== Infinity) ? 'STYLE_QUALITY_CAP' : 'AEROBIC_CAP_REACHED';
  } else {
    endReason = continuousAvailable ? 'DOSE_REACHED' : 'CONTENT_LIMITED';  // corto de la ventana: contenido vs dosis
  }

  return { style, budgetMinutes: budget, totalMinutes: total, intenseMinutes, steadyMinutes, earlyEnd, earlyEndReason, endReason, blocks };
}

/**
 * Convierte el CardioMainPlan en la lista de EJERCICIOS EJECUTABLES del workout (lo que el player
 * corre y lo que gatea la finalización). Cada bloque = un "ejercicio" TIME-BASED: steady/recovery/
 * drills → 1 serie por tiempo ("{min} min · Zona 2"); intervals/power → `rounds` series con work/rest.
 * CLAVE del fix: sin esto, el día de cardio ejecutaba la lista corta de la IA (~37 min) e ignoraba
 * el plan (112 min) — el bloque era solo un panel. Ahora el plan ES la sesión.
 */
export function cardioBlocksToExercises(plan: CardioMainPlan): Array<{ id: string; sets: number; reps: string; rest: number; tip_personalizado: string; cardio: CardioExerciseMeta }> {
  return plan.blocks.filter(b => b.stationId).map(b => {
    // IDENTIDAD DEL BLOQUE (kind/labelKey/zone/style/…) viaja con el ejercicio → la card muestra la
    // ACTIVIDAD real (correr/circuito/…), no el stationId técnico. El player sigue usando id/reps/sets
    // para el timer (campo `cardio` es solo display; no lo lee la ejecución).
    const cardio: CardioExerciseMeta = {
      kind: b.kind, labelKey: b.labelKey, zone: b.zone, minutes: b.minutes,
      workSec: b.workSec, restSec: b.restSec, rounds: b.rounds, intensity: b.intensity, style: plan.style,
    };
    if (b.kind === 'intervals' || b.kind === 'power') {
      return { id: b.stationId, sets: Math.max(1, b.rounds ?? 1), reps: `${b.workSec ?? 30} seg`, rest: b.restSec ?? 30, tip_personalizado: b.cue ?? '', cardio };
    }
    return { id: b.stationId, sets: 1, reps: `${b.minutes} min${b.zone ? ` · ${b.zone}` : ''}`, rest: 0, tip_personalizado: b.cue ?? '', cardio };
  });
}

/** Minutos que el player REALMENTE guía a ejecutar (suma de los bloques del plan). */
export const cardioPlayableMinutes = (plan: CardioMainPlan): number => plan.blocks.reduce((a, b) => a + b.minutes, 0);

// ── CAPABILITY GATE POR CONTENIDO REAL (§1) ──────────────────────────────────
export interface CardioCapabilities { correr: boolean; funcional: boolean; lowImpact: boolean; explosividad: boolean; }

/** ¿Existe una estación REPRODUCIBLE de este estilo para este equipo? Estricto: una VARIANTE con
 *  (a) video (VIDEO_VARIANT_IDS), (b) equipo compatible, (c) que sea de ESE estilo (variante o
 *  ejercicio). Para lowImpact, además el ejercicio nunca de alto impacto. "Existe en el catálogo"
 *  NO basta — sin media no es capacidad disponible. */
function styleStationAvailable(e: Exercise, style: CardioStyle, equipment: Equipment[]): boolean {
  if (style === 'lowImpact' && (e.impact === 'high' || e.fallRisk)) return false;
  return (e.variants ?? []).some(v =>
    VIDEO_VARIANT_IDS.has(v.id) &&
    (v.equipment ?? []).some(x => equipment.includes(x)) &&
    (v.cardioStyle === style || (e.cardioStyle === style && !v.cardioStyle)));
}

/**
 * FUENTE ÚNICA de disponibilidad de modalidades de cardio, derivada del CONTENIDO REAL con video.
 * `cardioEquipment` = los buckets ya reducidos (cardioEquipmentFor: ['gym','cuerpo'] o ['cuerpo']).
 * La UI (deshabilitar/ocultar) y el guard de generación deben consultar ESTO — sin hardcodes
 * dispersos. Añadir videos compatibles al banco habilita la capability sola (§8.10).
 */
export function getCardioCapabilities(bank: Exercise[], cardioEquipment: Equipment[]): CardioCapabilities {
  const cardio = bank.filter(e => e.muscleGroup === 'cardio');
  const avail = (style: CardioStyle) => cardio.some(e => styleStationAvailable(e, style, cardioEquipment));
  return { correr: avail('correr'), funcional: avail('funcional'), lowImpact: avail('lowImpact'), explosividad: avail('explosividad') };
}

/**
 * Resuelve el estilo de cardio a uno que TENGA contenido reproducible (caps[style]===true).
 * Blindaje de STATE: si el usuario dejó un estilo inválido (cambió el gear tras elegirlo) o
 * el estilo inferido no tiene contenido para este equipo, cae a uno disponible en vez de
 * llegar a buildCardioMain sin estaciones y disparar el guard de "content gap". Prioridad:
 * el pedido si sirve → funcional → correr → lowImpact → explosividad. Si NADA está disponible
 * (no debería: correr/funcional siempre lo están con peso corporal), devuelve el pedido.
 */
export function resolveCardioStyle(requested: CardioStyle, caps: CardioCapabilities): CardioStyle {
  if (caps[requested]) return requested;
  const order: CardioStyle[] = ['funcional', 'correr', 'lowImpact', 'explosividad'];
  return order.find(s => caps[s]) ?? requested;
}
