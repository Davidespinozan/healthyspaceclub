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
import type { Exercise, CardioStyle } from '../types';

export type CardioBlockKind = 'steady' | 'intervals' | 'drills' | 'power' | 'recovery';
export type CardioIntensity = 'baja' | 'media' | 'alta';

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
  earlyEndReason?: string;
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

/** Elige una estación del pool, prefiriendo bajo impacto cuando el bloque es sostenible/recuperación. */
function pickStation(pool: Exercise[], idx: number, preferLowImpact: boolean): string {
  if (!pool.length) return '';
  const safe = preferLowImpact ? pool.filter(e => e.impact !== 'high' && !e.fallRisk) : pool;
  const list = safe.length ? safe : pool;
  return list[idx % list.length].id;
}

const mkSteady = (minutes: number, stationId: string, intensity: CardioIntensity, labelKey: string, cue?: string): CardioBlock =>
  ({ kind: labelKey === 'cardio.recovery' ? 'recovery' : 'steady', minutes: round(minutes), stationId, intensity, labelKey, zone: ZONE[intensity], rpe: RPE[intensity], cue });

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

/**
 * Construye el CardioMainPlan determinista. `pool` = candidatos de cardio ya filtrados por
 * estilo/gear/seguridad (upstream). warmup/finisher se manejan fuera (composeSession).
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
}): CardioMainPlan {
  const budget = Math.max(5, round(input.mainBudgetMinutes));
  const style = input.style;
  const L = lvl(input.level);
  const readiness = input.readiness ?? 'normal';
  const intenseCap = intensityBudget(style, L, readiness, input.isDeload);
  // bodyGoal modula (§12): perder grasa/bienestar → aún más sesgo a sostenible (menos intenso);
  // ganar músculo → cardio conservador (no competir con recuperación). No sustituye al estilo.
  const goal = (input.bodyGoal ?? '').toLowerCase();
  const conservative = /m[uú]sculo|ganar|hipertrof/.test(goal);
  const steadyBias = /grasa|perder|bienestar|salud|manten/.test(goal);
  const intenseAllow = round(intenseCap * (conservative ? 0.7 : 1) * (steadyBias ? 0.85 : 1));

  const blocks: CardioBlock[] = [];
  let earlyEnd = false; let earlyEndReason: string | undefined;
  const pool = input.pool;

  if (!pool.length) {
    return { style, budgetMinutes: budget, totalMinutes: 0, intenseMinutes: 0, steadyMinutes: 0, earlyEnd: true, earlyEndReason: 'sin estaciones de cardio reproducibles con este equipo (content gap)', blocks: [] };
  }

  if (style === 'lowImpact') {
    // Todo sostenible (Zona 2). Ventana larga → 1-2 bloques largos (cambio de estación opcional).
    const zone: CardioIntensity = 'baja';
    if (budget <= 40) {
      blocks.push(mkSteady(budget, pickStation(pool, 0, true), zone, 'cardio.steady', 'Ritmo sostenible, podrías mantener una conversación.'));
    } else {
      const half = budget / 2;
      blocks.push(mkSteady(half, pickStation(pool, 0, true), zone, 'cardio.steady', 'Zona 2 sostenible.'));
      blocks.push(mkSteady(budget - round(half), pickStation(pool, 1, true), L === 'avanzado' ? 'media' : zone, 'cardio.steady', L === 'avanzado' ? 'Bloque tempo controlado, sigue de bajo impacto.' : 'Segundo bloque sostenible, cambia de estación si quieres.'));
    }
  } else if (style === 'correr') {
    const cap = TOTAL_CAP.correr(L);
    const planned = Math.min(budget, cap);
    if (planned < budget) { earlyEnd = true; earlyEndReason = 'principiante: volumen de carrera acotado por seguridad'; }
    // Drills cortos + bloque de calidad acotado + easy dominante.
    let remaining = planned;
    const drillsMin = Math.min(remaining, L === 'principiante' ? 4 : 5);
    blocks.push(mkDrills(drillsMin, pickStation(pool, 0, false), 'cardio.drills', 'Técnica de carrera: skipping, talones, zancada.')); remaining -= drillsMin;
    // Bloque de calidad acotado al TECHO intenso (crece con el nivel): avanzado = intervalos,
    // principiante/intermedio = tempo continuo. El resto del volumen es EASY dominante.
    const qMin = Math.min(intenseAllow, Math.max(0, remaining - 3));
    if (qMin >= 4) {
      // Avanzado = intervalos, PERO solo si cabe su tiempo total (work+rest); si no, tempo (encaja
      // mejor la misma dosis intensa en menos ventana). Garantiza planned ≤ budget.
      const useIntervals = L === 'avanzado' && remaining >= qMin * 1.5 + 3;
      if (useIntervals) {
        const rounds = clamp(round(qMin), 3, 20);   // ~60s trabajo/round → work ≈ qMin (techo intenso)
        const b = mkIntervals('intervals', rounds, 60, 30, pickStation(pool, 1, false), 'cardio.intervals', 'Series a ritmo fuerte, recupera trotando.');
        blocks.push(b); remaining -= b.minutes;
      } else {
        blocks.push(mkSteady(qMin, pickStation(pool, 1, false), 'alta', 'cardio.tempo', 'Bloque tempo: cómodamente duro.')); remaining -= qMin;
      }
    }
    if (remaining >= 3) blocks.push(mkSteady(remaining, pickStation(pool, 2, false), 'baja', 'cardio.steady', 'Rodaje suave, la mayor parte del volumen es fácil.'));
  } else if (style === 'explosividad') {
    const cap = TOTAL_CAP.explosividad(L);
    const planned = Math.min(budget, cap);
    if (planned < budget) { earlyEnd = true; earlyEndReason = 'explosividad = calidad/potencia, no volumen: dosis útil completada, el resto sería contraproducente'; }
    let remaining = planned;
    // Warm-up drills / técnica.
    const drillsMin = Math.min(remaining, L === 'principiante' ? 6 : 8);
    blocks.push(mkDrills(drillsMin, pickStation(pool, 0, false), 'cardio.drills', 'Preparación neural: saltos suaves, movilidad, técnica.')); remaining -= drillsMin;
    // Trabajo de potencia: work corto, descanso LARGO (calidad). Rounds acotados por el techo intenso.
    const roundsByCap = Math.floor((intenseAllow * 60) / 10);          // work ~10s por round
    const rounds = clamp(roundsByCap, L === 'principiante' ? 3 : 4, L === 'avanzado' ? 12 : 8);
    const power = mkIntervals('power', rounds, 10, L === 'principiante' ? 90 : 75, pickStation(pool, 1, false), 'cardio.power', 'Máxima calidad por repetición; descansa completo entre esfuerzos.');
    if (power.minutes <= remaining) { blocks.push(power); remaining -= power.minutes; }
    // Recuperación suave / técnica con el tiempo restante (NO más contactos).
    if (remaining >= 4) blocks.push(mkSteady(Math.min(remaining, 12), pickStation(pool, 2, true), 'baja', 'cardio.recovery', 'Recuperación activa y movilidad; no más saltos.'));
  } else { // funcional
    // Bloques: circuito intervalado (acotado) → recuperación → 2º circuito → steady/cooldown.
    let remaining = budget;
    const perCircuitIntense = Math.max(4, round(intenseAllow / 2));
    const circuit = (i: number) => mkIntervals('intervals', clamp(round(perCircuitIntense * 2), 4, 12), 40, 20, pickStation(pool, i, false), 'cardio.circuit', 'Circuito: 40s trabajo / 20s transición, técnica sólida.');
    let intenseUsed = 0;
    for (let i = 0; i < 2 && remaining > 8 && intenseUsed < intenseAllow; i++) {
      const c = circuit(i);
      if (c.minutes > remaining) break;
      blocks.push(c); remaining -= c.minutes; intenseUsed += intenseOf(c);
      // Recuperación entre circuitos (steady baja).
      if (remaining > 6 && (i === 0)) {
        const rec = Math.min(remaining, Math.max(4, round(c.minutes * 0.6)));
        blocks.push(mkSteady(rec, pickStation(pool, i + 3, true), 'baja', 'cardio.recovery', 'Recuperación activa entre bloques.')); remaining -= rec;
      }
    }
    // Cooldown / steady con el resto (densidad controlada, no más rounds).
    if (remaining >= 4) blocks.push(mkSteady(remaining, pickStation(pool, 5, true), 'baja', 'cardio.steady', 'Trabajo sostenible para cerrar; baja pulsaciones.'));
    if (budget - blocks.reduce((a, b) => a + b.minutes, 0) > budget * 0.15) { earlyEnd = true; earlyEndReason = 'dosis funcional útil alcanzada; densidad controlada'; }
  }

  // Ajuste final: nunca exceder el budget (recorta el último bloque steady/recovery si hiciera falta).
  let total = blocks.reduce((a, b) => a + b.minutes, 0);
  while (total > budget && blocks.length) {
    const last = blocks[blocks.length - 1];
    const over = total - budget;
    if ((last.kind === 'steady' || last.kind === 'recovery') && last.minutes - over >= 3) { last.minutes -= over; break; }
    if (last.kind === 'steady' || last.kind === 'recovery') { blocks.pop(); total = blocks.reduce((a, b) => a + b.minutes, 0); }
    else break;
  }
  total = blocks.reduce((a, b) => a + b.minutes, 0);
  const intenseMinutes = blocks.reduce((a, b) => a + intenseOf(b), 0);
  const steadyMinutes = blocks.filter(b => b.kind === 'steady' || b.kind === 'recovery').filter(b => b.intensity !== 'alta').reduce((a, b) => a + b.minutes, 0);
  if (!earlyEnd && budget - total > Math.max(6, budget * 0.15)) { earlyEnd = true; earlyEndReason = 'dosis útil de la modalidad alcanzada'; }

  return { style, budgetMinutes: budget, totalMinutes: total, intenseMinutes, steadyMinutes, earlyEnd, earlyEndReason, blocks };
}

/**
 * Convierte el CardioMainPlan en la lista de EJERCICIOS EJECUTABLES del workout (lo que el player
 * corre y lo que gatea la finalización). Cada bloque = un "ejercicio" TIME-BASED: steady/recovery/
 * drills → 1 serie por tiempo ("{min} min · Zona 2"); intervals/power → `rounds` series con work/rest.
 * CLAVE del fix: sin esto, el día de cardio ejecutaba la lista corta de la IA (~37 min) e ignoraba
 * el plan (112 min) — el bloque era solo un panel. Ahora el plan ES la sesión.
 */
export function cardioBlocksToExercises(plan: CardioMainPlan): Array<{ id: string; sets: number; reps: string; rest: number; tip_personalizado: string }> {
  return plan.blocks.filter(b => b.stationId).map(b => {
    if (b.kind === 'intervals' || b.kind === 'power') {
      return { id: b.stationId, sets: Math.max(1, b.rounds ?? 1), reps: `${b.workSec ?? 30} seg`, rest: b.restSec ?? 30, tip_personalizado: b.cue ?? '' };
    }
    return { id: b.stationId, sets: 1, reps: `${b.minutes} min${b.zone ? ` · ${b.zone}` : ''}`, rest: 0, tip_personalizado: b.cue ?? '' };
  });
}

/** Minutos que el player REALMENTE guía a ejecutar (suma de los bloques del plan). */
export const cardioPlayableMinutes = (plan: CardioMainPlan): number => plan.blocks.reduce((a, b) => a + b.minutes, 0);
