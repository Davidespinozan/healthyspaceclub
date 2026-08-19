// ─────────────────────────────────────────────────────────────────────────────
// DISPLAY del plan — DURACIÓN REAL + IDENTIDAD DE BLOQUES CARDIO (solo representación).
//
// Contrato (política de duración de HSC): selectedTime = "tengo HASTA X min disponibles".
// El motor produce la dosis FISIOLÓGICA correcta; la UI NUNCA promete X min: muestra la
// duración REAL planificada y, si es materialmente menor, comunica el early-end.
//
// NO toca P3/P4/volumen/headroom/fisiología. Puro display, derivado de metadata ya sellada.
// ─────────────────────────────────────────────────────────────────────────────

/** Metadata de un bloque cardio, sellada por buildCardioMain (viaja en el ejercicio). */
export interface CardioExerciseMeta {
  kind: string;        // steady | intervals | drills | power | recovery
  labelKey: string;    // clave i18n del builder (cardio.steady/tempo/intervals/circuit/power/drills/recovery)
  zone?: string;       // 'Zona 2' …
  minutes: number;     // duración total del bloque
  workSec?: number;
  restSec?: number;
  rounds?: number;
  intensity: string;   // baja | media | alta
  style: string;       // correr | funcional | lowImpact | explosividad
}

/** Bloque del cardioMainBlock persistido (misma forma que sella DailyTrainer al guardar la rutina). */
interface CardioBlockLike {
  kind: string; labelKey: string; zone?: string; minutes: number;
  workSec?: number; restSec?: number; rounds?: number; intensity: string; stationId?: string;
}

interface PlanLike {
  exercises: Array<{ sets?: number | string; rest?: number | string; reps?: unknown; cardio?: CardioExerciseMeta }>;
  warmupBlock?: { minutes: number } | null;
  cardioMainBlock?: { totalMinutes: number; earlyEnd?: boolean; earlyEndReason?: string; style?: string; blocks?: CardioBlockLike[] } | null;
  finisherBlock?: { minutes: number } | null;
}

/** ¿Es un plan de CARDIO dedicado (tiene main determinista por bloques)? */
export function isCardioPlan(plan: PlanLike): boolean {
  return !!plan.cardioMainBlock;
}

/**
 * ¿Mostrar la entrada persistente "Añadir cardio" en Hoy? Solo cuando ya hay actividad/rutina de
 * FUERZA del día (plan pendiente/en progreso NO-cardio, o alguna sesión completada NO-cardio). Día
 * completamente vacío → false (el flujo normal de generar rutina ya permite elegir modalidad).
 */
export function shouldOfferAddCardio(
  todayPlan: PlanLike | null,
  sessionsToday: Array<{ modality: string }>,
): boolean {
  if (todayPlan && !isCardioPlan(todayPlan)) return true;
  return sessionsToday.some((s) => s.modality !== 'cardio');
}

/** Fase inicial de DailyTrainer al montar. "Añadir cardio" (pendingModality) fuerza el wizard, aunque
 *  haya rutina de hoy → nunca cae al plan viejo. */
export function initialWorkoutPhase(
  pendingModality: string | null | undefined,
  hasWorkoutToday: boolean,
  partnerMode: boolean,
): 'plan' | 'modality' {
  if (pendingModality) return 'modality';
  if (!partnerMode && hasWorkoutToday) return 'plan';
  return 'modality';
}

/**
 * Metadata cardio EFECTIVA de un ejercicio, ROBUSTA a objetos legacy/cache.
 * Preferimos la metadata sellada en el ejercicio (`ex.cardio`, rutinas nuevas). Si NO viaja
 * (una rutina cacheada/persistida por una versión previa que no enriquecía los ejercicios), la
 * DERIVAMOS del `cardioMainBlock.blocks` — que SÍ está persistido — alineado por índice.
 * El alineado replica EXACTO a cardioBlocksToExercises: solo bloques con stationId, en orden.
 * Sin esto, un plan viejo (cardioMainBlock presente, ex.cardio ausente) volvería a mostrar el
 * stationId técnico ("Saltos Básicos · 51 min") y su video engañoso en la card.
 */
export function cardioMetaFor(plan: PlanLike, index: number): CardioExerciseMeta | undefined {
  const sealed = plan.exercises[index]?.cardio;
  if (sealed) return sealed;
  const blocks = (plan.cardioMainBlock?.blocks ?? []).filter(b => b.stationId);
  const b = blocks[index];
  if (!b) return undefined;
  return {
    kind: b.kind, labelKey: b.labelKey, zone: b.zone, minutes: b.minutes,
    workSec: b.workSec, restSec: b.restSec, rounds: b.rounds, intensity: b.intensity,
    style: plan.cardioMainBlock?.style ?? '',
  };
}

/** Nº de ejercicios/bloques a mostrar (para elegir "N ejercicios" vs "N bloques"). */
export function planItemCount(plan: PlanLike): number {
  return plan.exercises.length;
}

/**
 * DURACIÓN REAL planificada (minutos). Autoridad temporal según el tipo de sesión:
 *  · CARDIO: warmup + cardioMain.totalMinutes (+ finisher) — la MISMA autoridad que gobierna el
 *    timer del player. (Antes el header aplicaba el estimador de fuerza a bloques time-based → "25 min".)
 *  · RESISTENCIA: Σ sets × (40s trabajo + descanso). Estimador honesto de la sesión real.
 */
export function planPlannedMinutes(plan: PlanLike): number {
  if (isCardioPlan(plan)) {
    const warm = plan.warmupBlock?.minutes ?? 0;
    const main = plan.cardioMainBlock?.totalMinutes ?? 0;
    const fin = plan.finisherBlock?.minutes ?? 0;
    return Math.max(1, Math.round(warm + main + fin));
  }
  const secs = plan.exercises.reduce((sum, ex) => {
    const isTime = /seg|respiraci|\d\s*s\b|min/i.test(String(ex.reps ?? ''));
    const sets = typeof ex.sets === 'number' ? ex.sets : parseInt(String(ex.sets)) || 3;
    const rest = typeof ex.rest === 'number' ? ex.rest : parseInt(String(ex.rest)) || 60;
    // Ejercicios por tiempo dentro de fuerza (isométricos) → su "reps" ya es la duración; el
    // resto: ~40s trabajo + descanso por serie.
    return sum + (isTime ? sets * (parseInt(String(ex.reps)) || 40) : sets * (40 + rest));
  }, 0);
  return Math.max(1, Math.round(secs / 60));
}

/**
 * ¿La sesión termina MATERIALMENTE antes del tiempo solicitado? (early-end honesto).
 * Devuelve la duración real + el motivo, o null si la sesión ocupa ~el tiempo pedido.
 * Umbral: se comunica cuando la duración real < 75% de lo solicitado (banda razonable).
 */
export function planEarlyEnd(plan: PlanLike, requestedMinutes: number): { plannedMin: number; reasonKey: string } | null {
  const planned = planPlannedMinutes(plan);
  if (!requestedMinutes || planned >= requestedMinutes * 0.75) return null;
  // Motivo: cardio trae su razón estructurada; resistencia = dosis útil de hoy (volumen semanal).
  const reasonKey = isCardioPlan(plan)
    ? 'workout.earlyEnd.cardio'
    : 'workout.earlyEnd.resistance';
  return { plannedMin: planned, reasonKey };
}

// ── IDENTIDAD VISUAL DE BLOQUES CARDIO ───────────────────────────────────────
// Un bloque STEADY/INTERVAL nunca puede tomar como identidad el ejercicio que se usó como
// stationId técnico (p.ej. "Saltos Básicos · 81 min"). El título sale de kind × style × labelKey.

/** Clave i18n del TÍTULO del bloque (identidad real de la actividad, no el stationId). */
export function cardioBlockTitleKey(m: CardioExerciseMeta): string {
  const s = m.style;
  const k = m.kind;
  if (k === 'drills') return s === 'correr' ? 'workout.cardioBlock.runDrills' : s === 'explosividad' ? 'workout.cardioBlock.plyoPrep' : 'workout.cardioBlock.drills';
  if (k === 'intervals') return s === 'correr' ? 'workout.cardioBlock.runIntervals' : s === 'funcional' ? 'workout.cardioBlock.circuit' : 'workout.cardioBlock.intervals';
  if (k === 'power') return 'workout.cardioBlock.power';
  if (k === 'recovery') return s === 'correr' ? 'workout.cardioBlock.runRecovery' : 'workout.cardioBlock.recovery';
  // steady
  if (m.labelKey === 'cardio.tempo') return s === 'correr' ? 'workout.cardioBlock.runTempo' : 'workout.cardioBlock.tempo';
  if (s === 'correr') return 'workout.cardioBlock.runSteady';
  if (s === 'lowImpact') return 'workout.cardioBlock.lowImpactSteady';
  if (s === 'funcional') return 'workout.cardioBlock.funcionalSteady';
  return 'workout.cardioBlock.steady';
}

/**
 * ¿Mostrar el video del stationId en la card? Solo cuando el usuario REALMENTE ejecuta ESE
 * movimiento en repeticiones/rondas (drills; intervals/power NO-running). NUNCA para bloques
 * sostenidos (steady/recovery) ni para intervalos de CARRERA (el station es un proxy) — ahí un
 * clip de un drill durante 77 min es engañoso: mejor una card cardio estilizada sin video.
 */
export function cardioShowVideo(m: CardioExerciseMeta): boolean {
  if (m.kind === 'drills') return true;
  if ((m.kind === 'intervals' || m.kind === 'power') && m.style !== 'correr') return true;
  return false;
}

/**
 * ¿Mostrar el aviso "semana cubierta" ANTES de generar? Solo cuando AUTO (resistencia) detectó que
 * el volumen útil de la semana ya está prácticamente cubierto (`allCovered`). NUNCA en manual (foco
 * elegido) ni en cardio/yoga. NO cambia nada del motor: es solo la condición de UX.
 */
export function shouldShowWeekCoveredNotice(input: { allCovered: boolean; selectedModality: string; focus: string }): boolean {
  if (!input.allCovered) return false;
  return input.selectedModality === 'auto' || (input.selectedModality === 'fuerza' && input.focus === 'auto');
}
