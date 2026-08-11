// ─────────────────────────────────────────────────────────────────────────
// mesocycle — P1 del rediseño del coach: la CAPA DE PLANIFICACIÓN LONGITUDINAL.
//
// El generador por sesión ya existe y NO se reescribe. Esta capa se pone ENCIMA y
// le da DIRECCIÓN en el tiempo: un bloque de 4-6 semanas que arranca suave, sube
// volumen/intensidad, y descarga.
//
// Ajuste clave (David): NO es una rampa rígida MEV→MRV por obligación. Hay una
// dirección planeada, pero la progresión puede AVANZAR, MANTENER o RETROCEDER según
// rendimiento, recuperación y adherencia. El deload es planeado PERO se adelanta si
// las señales lo justifican.
//
// CERO fuentes de verdad nuevas: todo se DERIVA de lo que ya existe —
//   · semana del bloque  ← deloadCheck().weeksAccumulated
//   · recuperación       ← check-in de energía/sueño (el mismo de la autorregulación)
//   · adherencia         ← sesiones/semana vs frecuencia real
//   · rendimiento        ← tendencia del volumen semanal (sube/estable/baja)
// No se persiste nada: se recalcula en cada generación.
// ─────────────────────────────────────────────────────────────────────────

export type MesoPhase = 'acumulacion' | 'intensificacion' | 'deload';
export type Progression = 'avanzar' | 'mantener' | 'retroceder' | 'deload';
export type Recovery = 'buena' | 'media' | 'mala';
export type Adherence = 'alta' | 'media' | 'baja';
export type Trend = 'sube' | 'estable' | 'baja';
export type IntensityBias = 'volumen' | 'equilibrio' | 'intensidad' | 'descarga';
export type Intensity = 'baja' | 'media' | 'alta';

export interface MesocycleState {
  week: number;                 // semana del bloque (1-based)
  phase: MesoPhase;
  progression: Progression;
  deload: boolean;
  volumeMultiplier: number;     // factor sobre el volumen base (targetCount / piso de series)
  intensityBias: IntensityBias;
  signals: { recovery: Recovery; adherence: Adherence; performance: Trend };
}

// ── Derivación de señales desde datos EXISTENTES (puras) ─────────────────────

/** Recuperación desde el check-in (mismos inputs que la autorregulación de intensidad). */
export function recoveryFromCheckin(energy?: string, sleep?: string): Recovery {
  const e = (energy ?? '').toLowerCase(), s = (sleep ?? '').toLowerCase();
  // Match EXACTO: 'normal' contiene la subcadena 'mal' → includes daría falso positivo.
  if (e === 'cansado' || s === 'mal' || s === 'muy mal') return 'mala';
  if (e === 'bien' && (s === 'muy bien' || s === 'normal')) return 'buena';
  return 'media';
}

/** Adherencia: sesiones en los últimos 7 días vs la frecuencia objetivo. */
export function adherenceFrom(sessionsLast7: number, freqTarget: number): Adherence {
  if (freqTarget <= 0) return 'media';
  if (sessionsLast7 >= freqTarget) return 'alta';
  if (sessionsLast7 >= freqTarget - 1) return 'media';
  return 'baja';
}

/** Rendimiento (proxy honesto y derivable): tendencia del volumen total entre la
 *  semana reciente y la previa. Sube = está acumulando trabajo; baja = se está cayendo. */
export function volumeTrend(setsLast7: number, setsPrev7: number): Trend {
  if (setsPrev7 <= 0) return setsLast7 > 0 ? 'sube' : 'estable';
  const r = setsLast7 / setsPrev7;
  if (r >= 1.1) return 'sube';
  if (r <= 0.9) return 'baja';
  return 'estable';
}

// ── El motor ─────────────────────────────────────────────────────────────────

const RAMP = [0.9, 1.0, 1.1, 1.15, 1.2, 1.2]; // volumen relativo por semana del bloque
const rampFor = (week: number): number => RAMP[Math.min(Math.max(week, 1), 6) - 1];

/**
 * Estado del mesociclo para HOY. Recibe la semana del bloque (deloadCheck) + las 3
 * señales derivadas. Decide fase, progresión, deload (planeado o adelantado) y los
 * factores que el generador aplica (volumen/intensidad).
 */
export function deriveMesocycleState(input: {
  weeksAccumulated: number;               // semanas duras completas (deloadCheck)
  recovery: Recovery;
  adherence: Adherence;
  performance: Trend;
}): MesocycleState {
  const { recovery, adherence, performance } = input;
  const week = Math.max(1, input.weeksAccumulated + 1); // semana EN CURSO del bloque

  // ── Deload autorregulado (ventana 4-6, adelantable) ──────────────────────
  const overreached = recovery === 'mala' && performance === 'baja';
  const deload =
    week >= 6 ? true                                       // tope duro: nunca más de 6 sin descarga
    : week >= 4 && (recovery !== 'buena' || performance === 'baja') ? true // 4-5: descarga si el cuerpo lo pide
    : week >= 3 && overreached ? true                      // adelantada si hay sobre-alcance claro
    : false;

  // ── Fase ──────────────────────────────────────────────────────────────────
  const phase: MesoPhase = deload
    ? 'deload'
    : (week >= 4 || (week === 3 && recovery === 'buena')) ? 'intensificacion' : 'acumulacion';

  // ── Progresión (avanzar / mantener / retroceder) ─────────────────────────
  const progression: Progression = deload
    ? 'deload'
    : (recovery === 'mala' || performance === 'baja') ? 'retroceder'
    // aquí ya sabemos: recovery ≠ mala y performance ≠ baja.
    : (recovery === 'buena' && adherence === 'alta') ? 'avanzar'
    : 'mantener';

  // ── Factores que aplica el generador ─────────────────────────────────────
  let volumeMultiplier: number;
  if (deload) volumeMultiplier = 0.55;
  else if (progression === 'avanzar') volumeMultiplier = rampFor(week);
  else if (progression === 'mantener') volumeMultiplier = rampFor(week - 1); // no sube, sostiene
  else volumeMultiplier = rampFor(week - 1) * 0.85;                          // retrocede
  // Intensificación: un poco menos de volumen a favor de la intensidad.
  if (phase === 'intensificacion' && !deload) volumeMultiplier *= 0.9;
  volumeMultiplier = Math.round(volumeMultiplier * 100) / 100;

  const intensityBias: IntensityBias = deload
    ? 'descarga'
    : phase === 'intensificacion' ? 'intensidad'
    : week <= 1 ? 'volumen' : 'equilibrio';

  return { week, phase, progression, deload, volumeMultiplier, intensityBias,
    signals: { recovery, adherence, performance } };
}

/**
 * Compone la intensidad del mesociclo con la que ya salió de la autorregulación
 * (energía/sueño). La RECUPERACIÓN MANDA: un usuario cansado (base 'baja') NO se
 * empuja aunque sea semana de intensificación. Solo sube el que llega descansado.
 */
export function composeIntensity(base: Intensity, bias: IntensityBias): Intensity {
  if (bias === 'descarga') return 'baja';
  if (bias === 'intensidad') return base === 'media' ? 'alta' : base; // baja se queda baja
  if (bias === 'volumen') return base === 'alta' ? 'media' : base;    // temprano: volumen > intensidad máx
  return base;
}
