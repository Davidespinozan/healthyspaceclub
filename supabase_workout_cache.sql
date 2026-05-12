-- ════════════════════════════════════════════════════════════════════
-- supabase_workout_cache.sql
-- ════════════════════════════════════════════════════════════════════
-- Purpose: Document the workout_cache table that ALREADY exists in
--          production but was never migrated through the repo.
--
-- The table is consumed by src/utils/workoutCache.ts:
--   - getCachedWorkout()  reads by config_hash
--   - saveWorkoutToCache() upserts by config_hash
--
-- Cache is shared across users — the same config produces the same
-- workout regardless of who asks.
--
-- Run this in Supabase Dashboard → SQL Editor.
-- Idempotent: safe to re-run.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS workout_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_hash text UNIQUE NOT NULL,
  duration integer NOT NULL,
  equipment text NOT NULL,
  goal text NOT NULL,
  day_type text NOT NULL,
  workout_json jsonb NOT NULL,
  hits integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Índices ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_workout_cache_hash
  ON workout_cache(config_hash);

CREATE INDEX IF NOT EXISTS idx_workout_cache_hits
  ON workout_cache(hits DESC);

-- ─── RLS ───────────────────────────────────────────────────────────
ALTER TABLE workout_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read cache" ON workout_cache;
CREATE POLICY "Anyone can read cache" ON workout_cache
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert cache" ON workout_cache;
CREATE POLICY "Anyone can insert cache" ON workout_cache
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update cache" ON workout_cache;
CREATE POLICY "Anyone can update cache" ON workout_cache
  FOR UPDATE USING (true);

-- ─── Comentarios ───────────────────────────────────────────────────
COMMENT ON COLUMN workout_cache.config_hash IS
  'djb2 hash de las 13 variables del contexto (ver buildConfigHash en src/utils/workoutPlanner.ts)';

COMMENT ON COLUMN workout_cache.workout_json IS
  'JSON del workout completo. Incluye __schemaVersion (yoga: 2, workout: 1) — ver SCHEMA_VERSIONS en src/utils/workoutCache.ts';

COMMENT ON COLUMN workout_cache.hits IS
  'Número de veces que este config_hash devolvió cache hit. Útil para identificar combinaciones populares.';
