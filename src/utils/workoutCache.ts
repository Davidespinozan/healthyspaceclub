import { supabase } from '../lib/supabase';

export const SCHEMA_VERSIONS = {
  yoga: 3, // v3: Power Vinyasa por FLOWS (video corrido + poses sostenidas), determinista
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
    phases: Array<{ phase: string; name: string | null; note: string }>;
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
    blocks: Array<{
      kind: string;               // steady | intervals | drills | power | recovery
      minutes: number;
      stationId: string;
      stationName: string;        // nombre localizado (resuelto al construir)
      intensity: string;          // baja | media | alta
      labelKey: string;           // clave i18n del nombre del bloque
      zone?: string; rpe?: number;
      workSec?: number; restSec?: number; rounds?: number;
      cue?: string;
    }>;
  };
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

export async function getCachedWorkout(
  configHash: string,
  expectedSchema: 'yoga' | 'workout' = 'workout'
): Promise<CachedWorkout | null> {
  try {
    // Race con timeout 5s — cache lookup debería ser instantáneo.
    // Si Supabase tarda más, asumimos miss y dejamos que se genere fresh.
    const queryPromise = supabase
      .from('workout_cache')
      .select('workout_json, hits')
      .eq('config_hash', configHash)
      // maybeSingle (no single): en cache miss devuelve data:null sin error.
      // single tiraba 406 (Not Acceptable) en 0 filas → ruido en consola.
      .maybeSingle();

    const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) => {
      setTimeout(() => resolve({ data: null, error: { message: 'cache lookup timeout' } }), 5000);
    });

    const { data, error } = (await Promise.race([queryPromise, timeoutPromise])) as
      | { data: { workout_json: unknown; hits: number } | null; error: unknown }
      | { data: null; error: { message: string } };

    if (error || !data) return null;

    // Schema version check
    const cachedVersion = (data.workout_json as any)?.__schemaVersion;
    const currentVersion = SCHEMA_VERSIONS[expectedSchema];
    if (cachedVersion !== currentVersion) {
      console.warn(`[cache] version mismatch: cached=${cachedVersion} vs current=${currentVersion} — ignoring`);
      return null;
    }

    supabase
      .from('workout_cache')
      .update({ hits: (data.hits || 0) + 1, updated_at: new Date().toISOString() })
      .eq('config_hash', configHash)
      .then(() => {});

    return data.workout_json as CachedWorkout;
  } catch (e) {
    console.warn('[cache] read failed:', e);
    return null;
  }
}

export async function saveWorkoutToCache(params: {
  configHash: string;
  duration: number;
  equipment: string;
  goal: string;
  dayType: string;
  workout: CachedWorkout;
  schemaType: 'yoga' | 'workout';
}): Promise<void> {
  try {
    const workoutWithVersion = {
      ...params.workout,
      __schemaVersion: SCHEMA_VERSIONS[params.schemaType],
    };
    await supabase
      .from('workout_cache')
      .upsert({
        config_hash: params.configHash,
        duration: params.duration,
        equipment: params.equipment,
        goal: params.goal,
        day_type: params.dayType,
        workout_json: workoutWithVersion,
        hits: 1,
        updated_at: new Date().toISOString(),
        // INSERT-only: si ya existe esa config, NO se sobrescribe (ignoreDuplicates).
        // La caché es compartida; permitir UPDATE dejaba que cualquier usuario
        // envenenara la entrada de otros. El primero que la genera la fija.
      }, { onConflict: 'config_hash', ignoreDuplicates: true });
  } catch (e) {
    console.warn('[cache] write failed:', e);
  }
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
