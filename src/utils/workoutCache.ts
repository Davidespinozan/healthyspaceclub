import type { CardioStyle } from '../types';
import type { SessionEndReason } from './sessionEndReason';

export const SCHEMA_VERSIONS = {
  yoga: 5, // v5: generador V2 — apertura curada por modalidad (`openerFor`) en vez de
          // la fase `centering`, elección por shortlist ponderada en vez de argmax, y
          // política de familia por fase. Misma receta de salida, composición distinta.
          // Yoga NO lee esta caché (isCacheHit la excluye), así que el bump no cambia
          // nada hoy: invalida las filas v4 por si algún día se activa la lectura.
          // v4: generador por CATÁLOGO — 33 contenidos con fases/focus/prescripción.
  workout: 14, // v14: "At Home" sin-soportes por defecto (gear=[] ya no asume muebles) → invalida cache con semántica vieja de infraestructura
} as const;

// Formato de coordinación de un ejercicio cuando se entrena en pareja:
//  - 'juntos'    → ambos lo hacen a la vez (cada quien con su carga/reps).
//  - 'alternado' → uno trabaja mientras el otro descansa, se turnan por set.
//  - 'asistido'  → uno ejecuta y el otro asiste (spotter / resistencia / conteo).
export type PartnerFormat = 'juntos' | 'alternado' | 'asistido';

export interface CachedWorkout {
  type: string;
  intensity: string;
  exercises: Array<{
    id: string;
    sets: number;
    reps: string;
    rest: number;
    tip_personalizado?: string;
    // P6 · RIR prescrito (P4) y si esta serie es RELEVANTE para pedir RIR real (top set
    // de compuesto principal con carga). El player solo prompta RIR donde rirRelevant.
    rir?: number;
    rirRelevant?: boolean;
    // BLOQUE 2 · FUENTE ÚNICA DE CARGA (P2): peso de trabajo (top set) y backoff, RIR-aware.
    // El player, la IA, el trace y el deload consumen ESTOS valores — no hay un segundo motor.
    topKg?: number;
    backoffKg?: number;
    // P1 · carga de DESCARGA reducida (kg): el player la muestra en vez de la progresión
    // normal. Solo en semana de deload y con carga comparable (= topKg × 0.875).
    deloadKg?: number;
    // Agrupación para superseries/biseries/triseries. Ejercicios con el mismo
    // `group` (ej. "A") se hacen encadenados (sin descanso entre ellos, descanso
    // al cerrar la vuelta). Ausente = serie recta.
    group?: string;
    // Técnica de intensidad opcional (aislamiento/accesorios): "21s", "Drop set",
    // "Rest-pause", "Myo-reps", "Parciales", "Tempo", "Isométrico", "Giant set".
    // Se muestra como chip; la explicación va en tip_personalizado.
    tecnica?: string;
    // ── Modo pareja (solo presentes cuando partnerMode = true) ──
    // Mismos ejercicios para ambos; la IA ajusta la PRESCRIPCIÓN por persona.
    // `reps`/`tip_personalizado` son los de quien usa el dispositivo (persona A).
    format?: PartnerFormat;
    repsB?: string; // reps sugeridas para el compañero (persona B) si difieren
    tipB?: string;  // cue breve para el compañero
    // CARDIO DEDICADO · identidad del bloque (kind/labelKey/zone/style/…) para el DISPLAY de la card
    // (título de la actividad real + gate de video). El player usa id/reps/sets para el timer; este
    // campo NO afecta la ejecución. Ver utils/workoutDisplay.ts.
    cardio?: import('./workoutDisplay').CardioExerciseMeta;
    // VARIANTE ELEGIDA por el usuario (p.ej. remo↔bici↔elíptica dentro de "Cardio en Máquina").
    // Si está y sigue siendo jugable/compatible, selectVariantForEquipment la respeta en TODAS las
    // vistas (card/detalle/player) — así la elección llega a la ejecución. Fallback seguro al
    // selector normal (isDefault) si el id deja de ser válido. NO cambia la prescripción del bloque
    // (duración/zona/intensidad/rounds permanecen); solo qué estación/máquina se muestra y ejecuta.
    variantId?: string;
  }>;
  warmup: string;
  cooldown: string;
  note: string;
  // P1 · sesión de DESCARGA (deload): el player muestra el aviso y las cargas reducidas, y
  // el registro NO actualiza el baseline de fuerza (no enseñar "pérdida" al sistema).
  isDeload?: boolean;
  // ── Sesión por bloques (Fase 3) — render-ready, nombres ya localizados ──
  // Deterministas (código, no IA). Opcionales: rutinas viejas no los traen.
  warmupBlock?: {
    minutes: number;
    // F2C-9C.2B.1 · una fase es EJECUTABLE si trae `exerciseId` + `prescription` (raise/mobilise). Sin
    // esos campos = preview legacy (name+note). Additive: cache viejo funciona igual. warmup NUNCA entra
    // a exercises[] ni se loguea (cero training credit por construcción; ExecutionRole 9C.1 dormido aquí).
    phases: Array<{
      phase: string; name: string | null; note: string;
      exerciseId?: string; variantId?: string;
      prescription?: import('./warmupSelection').PhaseMovementPrescription;
      // F2C-9C.2C · SERIES DE APROXIMACIÓN ejecutables (fase potentiate) derivadas del topKg del working
      // lift (mismo exerciseId/variantId). Additive: sin `ramp` = nota legacy. NUNCA se loguea (cero credit).
      ramp?: import('./rampPrescription').RampPrescription;
    }>;
  };
  // F2C-9C.2A · vuelta a la calma de FUERZA (PREVIEW · no ejecutable, no LoggedSet, no ExecutionRole,
  // cero training credit). Movimientos de cooldown seleccionados por capability (roles⊇cooldown).
  // Additive: rutinas legacy sin este campo funcionan igual.
  cooldownBlock?: {
    minutes: number;
    // F2C-9C.2B.2 · `prescription` (additive) vuelve un movimiento EJECUTABLE (overlay post-sello, nivel
    // WorkoutPlan). Sin prescription = preview legacy. Cooldown NUNCA entra a exercises[]/CompletedSession
    // ni produce LoggedSet/ExecutionRole → cero training credit por construcción.
    movements: Array<{ exerciseId: string; variantId?: string; name: string; note?: string; prescription?: import('./warmupSelection').PhaseMovementPrescription }>;
  };
  finisherBlock?: {
    minutes: number;
    cardioStyle: string;
    format: string;      // 'steady' | 'intervals' | 'circuit'
    rounds?: number;     // circuito multiformato (Fase 5)
    // 1 estación (steady/intervals) o 2-3 encadenadas (circuit). Nombres localizados.
    stations: Array<{ name: string; label?: string; prescription?: string }>;
  };
  // ── CARDIO DEDICADO (Fase Cardio Main) — main determinista por bloques, render-ready ──
  // El motor (buildCardioMain) gobierna duración/intensidad/work-rest; la IA NO decide estructura.
  cardioMainBlock?: {
    style: string;
    totalMinutes: number;         // suma planificada (≤ presupuesto; puede terminar antes a propósito)
    intenseMinutes: number;
    earlyEnd: boolean;
    earlyEndReason?: string;
    endReason?: import('./cardioMain').CardioEndReason; // F2C-5 · razón tipada (opcional: planes legacy sin ella)
    blocks: Array<{
      kind: string;               // steady | intervals | drills | power | recovery | cooldown
      minutes: number;
      stationId: string;
      variantId?: string;         // F2C-8 · máquina concreta (cardio-maquina → cardio-bici/…); opcional (legacy sin él)
      stationName: string;        // nombre localizado (resuelto al construir)
      intensity: string;          // baja | media | alta
      labelKey: string;           // clave i18n del nombre del bloque
      zone?: string; rpe?: number;
      workSec?: number; restSec?: number; rounds?: number;
      cue?: string;
    }>;
  };
  // ── SESSION COMPOSER (F2B-1) · decisiones per-usuario/día SELLADAS en el plan del día ──
  // CRÍTICO: estos campos son per-usuario (dependen de completedSessions/readiness/deload) → NUNCA se
  // escriben en la caché COMPARTIDA (workout_cache). DailyTrainer los adjunta SOLO al objeto de
  // dailyWorkout, DESPUÉS de saveWorkoutToCache. La caché conserva el workout genérico (con finisher).
  //
  // Recomendación de cardio estructurado para HOY. Autoridad ÚNICA tras generar: no se recomputa en
  // reload (minutes/style/intensityCeiling sellados). Se ejecuta como CompletedSession SEPARADA
  // (modality='cardio') — no contamina fuerza. `done=true` tras completarse → no re-ofrecer.
  composedCardio?: {
    minutes: number;
    style: CardioStyle;
    intensityCeiling: 'zona2' | 'moderate';
    done?: boolean;
  };
  // Motivo REAL por el que la fuerza terminó (sustituye la heurística CASE F `planned < 75%`). Lo
  // consume WorkoutPlan para el banner honesto. Puede ser HYBRID_COMPLETE si se colocó cardio.
  sessionEndReason?: SessionEndReason;
  // ── Metadatos de modo pareja ──
  partnerMode?: boolean;
  // Id del GENERADOR (persona A). Estampado al generar; viaja en el JSON entregado a B.
  // Cada dispositivo compara su propio id: myId===ownerId → A; myId!==ownerId → compañero B.
  // Fuente de verdad estable de identidad A/B (ver partnerView.ts).
  ownerId?: string | null;
  partnerName?: string;
  partnerAvatar?: string | null; // foto del compañero (para la tarjeta de hoy)
  partnerId?: string | null;     // cuenta del compañero conectado (null si invitado)
}

// MB1-C1 · CACHÉ COMPARTIDA DESACTIVADA. `workout_cache` era una caché global (una fila por
// config_hash, entre usuarios) en la que cualquier cuenta autenticada podía insertar o actualizar
// filas: el hash es determinista y se calcula en el cliente, así que una fila manipulada podía servir
// a otros usuarios una selección que no pasa sus filtros (nivel, bajo impacto, dolor) y textos
// arbitrarios. Hasta rediseñarla, Training V1 no lee ni escribe la tabla: toda generación es un
// MISS y se genera para el usuario actual. Se conservan las firmas para no tocar el generador.
// La migración 20261016120000_workout_cache_close_client_writes.sql retira las políticas abiertas.

/** Siempre MISS: no se lee la caché compartida (ver nota MB1-C1). */
export async function getCachedWorkout(
  _configHash: string,
  _expectedSchema: 'yoga' | 'workout' = 'workout'
): Promise<CachedWorkout | null> {
  return null;
}

/** No escribe en la caché compartida (ver nota MB1-C1). */
export async function saveWorkoutToCache(_params: {
  configHash: string;
  duration: number;
  equipment: string;
  goal: string;
  dayType: string;
  workout: CachedWorkout;
  schemaType: 'yoga' | 'workout';
}): Promise<void> {
  return;
}

export function validateWorkout(
  workout: CachedWorkout,
  validIds: Set<string>
): boolean {
  if (!workout || !Array.isArray(workout.exercises)) return false;
  if (workout.exercises.length === 0) return false;

  const allValid = workout.exercises.every(ex =>
    ex.id && validIds.has(ex.id) &&
    // `typeof x === 'number'` es LAX: NaN, Infinity y negativos lo pasan. Endurecemos el único
    // campo numérico que validateWorkout valida (sets): entero finito y > 0.
    typeof ex.sets === 'number' && Number.isFinite(ex.sets) && ex.sets > 0 &&
    typeof ex.reps === 'string' && ex.reps.trim().length > 0
  );

  return allValid;
}
