import { supabase } from '../lib/supabase';

export const SCHEMA_VERSIONS = {
  yoga: 2,
  workout: 13, // v13: bloque de equipo consciente del goal (cardio sin pesas → progresión por intensidad, no tempo)
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
  }>;
  warmup: string;
  cooldown: string;
  note: string;
  // ── Metadatos de modo pareja ──
  partnerMode?: boolean;
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
    typeof ex.sets === 'number' &&
    typeof ex.reps === 'string'
  );

  return allValid;
}
