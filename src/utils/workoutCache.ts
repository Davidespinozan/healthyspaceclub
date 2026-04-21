import { supabase } from '../lib/supabase';

export const SCHEMA_VERSIONS = {
  yoga: 2,
  workout: 1,
} as const;

export interface CachedWorkout {
  type: string;
  intensity: string;
  exercises: Array<{
    id: string;
    sets: number;
    reps: string;
    rest: number;
    tip_personalizado?: string;
  }>;
  warmup: string;
  cooldown: string;
  note: string;
}

export async function getCachedWorkout(
  configHash: string,
  expectedSchema: 'yoga' | 'workout' = 'workout'
): Promise<CachedWorkout | null> {
  try {
    const { data, error } = await supabase
      .from('workout_cache')
      .select('workout_json, hits')
      .eq('config_hash', configHash)
      .single();

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
      }, { onConflict: 'config_hash' });
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
