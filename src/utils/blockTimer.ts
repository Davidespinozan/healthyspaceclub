// ════════════════════════════════════════════════════════════════
// blockTimer — máquina de estados PURA para ejecutar contenido time-based
// (cardio y holds isométricos) en el player. El MOTOR sigue siendo la autoridad
// de la prescripción (buildCardioMain / prescribeSession); esto solo INTERPRETA
// su salida como una línea de tiempo ejecutable. Sin efectos, sin timers: recibe
// los segundos transcurridos (que el player calcula desde timestamps reales, robusto
// a background/pausa) y devuelve el estado. Así la lógica es testeable al 100%.
// ════════════════════════════════════════════════════════════════

export type TimerPhase = 'work' | 'rest' | 'done';

/**
 * Bloque cronometrado genérico = N rounds de `workSec` seg de trabajo, con `restSec`
 * de descanso ENTRE rounds (no después del último).
 *  · cardio steady/recovery/drills → { rounds:1, workSec: minutos*60, restSec:0 }
 *  · cardio intervals/power        → { rounds, workSec, restSec }
 *  · hold isométrico               → { rounds: sets, workSec: targetSec, restSec }
 */
export interface TimedBlock {
  rounds: number;
  workSec: number;
  restSec: number;
}

export interface TimerState {
  phase: TimerPhase;
  round: number;              // 1-based (el round de trabajo actual o el que precede al descanso)
  secondsLeftInPhase: number; // cuenta regresiva de la fase actual
  totalPrescribedSec: number; // trabajo + descansos prescritos del bloque completo
  elapsedWorkSec: number;     // segundos de TRABAJO efectivamente transcurridos (para logging real)
}

const clampBlock = (b: TimedBlock): TimedBlock => ({
  rounds: Math.max(1, Math.floor(b.rounds || 1)),
  workSec: Math.max(0, Math.round(b.workSec || 0)),
  restSec: Math.max(0, Math.round(b.restSec || 0)),
});

/** Total prescrito: N·work + (N-1)·rest (sin descanso tras el último trabajo). */
export function blockTotalSec(block: TimedBlock): number {
  const b = clampBlock(block);
  return b.rounds * b.workSec + (b.rounds - 1) * b.restSec;
}

/**
 * Estado del bloque a `elapsedSec` segundos de trabajo+descanso transcurridos.
 * La línea de tiempo es: work(1) rest(1) work(2) rest(2) … work(N).
 */
export function timerStateAt(block: TimedBlock, elapsedSec: number): TimerState {
  const b = clampBlock(block);
  const total = blockTotalSec(b);
  let t = Math.max(0, Math.floor(elapsedSec));
  let elapsedWork = 0;
  // recorre la secuencia acumulando
  for (let round = 1; round <= b.rounds; round++) {
    // fase de trabajo
    if (t < b.workSec) {
      return { phase: 'work', round, secondsLeftInPhase: b.workSec - t, totalPrescribedSec: total, elapsedWorkSec: elapsedWork + t };
    }
    t -= b.workSec;
    elapsedWork += b.workSec;
    // descanso entre rounds (no tras el último)
    if (round < b.rounds) {
      if (t < b.restSec) {
        return { phase: 'rest', round, secondsLeftInPhase: b.restSec - t, totalPrescribedSec: total, elapsedWorkSec: elapsedWork };
      }
      t -= b.restSec;
    }
  }
  return { phase: 'done', round: b.rounds, secondsLeftInPhase: 0, totalPrescribedSec: total, elapsedWorkSec: elapsedWork };
}

/** ¿Terminó el bloque completo a `elapsedSec`? */
export function isBlockDone(block: TimedBlock, elapsedSec: number): boolean {
  return elapsedSec >= blockTotalSec(block);
}

// ── Constructores desde la salida del motor ──────────────────────────────────
export interface CardioBlockLike {
  kind: string; minutes: number; workSec?: number; restSec?: number; rounds?: number;
}

/** Cardio block (buildCardioMain) → TimedBlock ejecutable. */
export function timedBlockFromCardio(b: CardioBlockLike): TimedBlock {
  if (b.kind === 'intervals' || b.kind === 'power') {
    return { rounds: Math.max(1, b.rounds ?? 1), workSec: b.workSec ?? 30, restSec: b.restSec ?? 30 };
  }
  // steady / recovery / drills → un solo tramo continuo
  return { rounds: 1, workSec: Math.round((b.minutes || 0) * 60), restSec: 0 };
}

/** Hold isométrico → TimedBlock (sets rounds de targetSec, descanso restSec entre sets). */
export function timedBlockFromHold(sets: number, targetSec: number, restSec: number): TimedBlock {
  return { rounds: Math.max(1, sets), workSec: Math.max(1, targetSec), restSec: Math.max(0, restSec) };
}

/** ¿Este ejercicio se ejecuta por tiempo? Convención del motor: 'seg' en las reps
 *  o prescriptionType 'time'. Misma señal que usa parseRepsToNumber para el logging. */
export function isTimeBasedReps(reps: string | undefined, prescriptionType?: string): boolean {
  return prescriptionType === 'time' || /\bseg\b|segundos|\bmin\b|minutos/i.test(String(reps ?? ''));
}

/**
 * Segundos objetivo por SERIE, derivados del MISMO string de reps que ya usa el motor
 * (última cifra = tope del rango, igual que parseRepsToNumber). Unifica cardio e isométricos:
 *   "20 min" → 1200 · "40 seg" → 40 · "30-45 seg" → 45 · "8-10" → null (no es por tiempo).
 * Devuelve null si el ejercicio NO es time-based (el player usa su flujo normal de reps).
 */
export function targetSecondsFromReps(reps: string | undefined, prescriptionType?: string): number | null {
  const s = String(reps ?? '');
  // Número ADYACENTE a la unidad (robusto a sufijos como "· Zona 2" / "RPE 7").
  // Rango "30-45 seg" → 45 (tope, misma política que parseRepsToNumber). "20 min · Zona 2" → 20.
  const secM = s.match(/(\d+)\s*(?:seg|segundos)\b/i);
  if (secM) return Number(secM[1]);
  const minM = s.match(/(\d+)\s*(?:min|minutos)\b/i);
  if (minM) return Number(minM[1]) * 60;
  if (prescriptionType === 'time') { const n = Number((s.match(/\d+/g) ?? []).pop()); return Number.isFinite(n) && n > 0 ? n : null; }
  return null;
}
