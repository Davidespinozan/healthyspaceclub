-- ════════════════════════════════════════════════════════════════════
-- supabase_workout_log.sql
-- ════════════════════════════════════════════════════════════════════
-- Purpose: Persist every completed workout so the AI coach can reason
--          about the user's training history.
--
-- Currently the workout history lives only in Zustand + localStorage.
-- analyzeWorkoutHistory() in workoutPlanner.ts always reads an empty
-- array in production. This table turns that lights on.
--
-- Run this in Supabase Dashboard → SQL Editor.
-- Idempotent: safe to re-run.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS workout_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Cuándo
  completed_at timestamptz NOT NULL DEFAULT now(),
  date_local date NOT NULL,

  -- Tipo de sesión
  modality text NOT NULL,
  day_type text,
  duration_minutes integer NOT NULL,
  target_duration_minutes integer NOT NULL,

  -- Contexto del usuario al momento de generar
  equipment text NOT NULL,
  energy text,
  prior_exercise text,
  discomfort text,
  pain_area text,

  -- Estructura del workout (denormalizada para queries rápidas)
  exercises jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Métricas calculadas (denormalizadas)
  exercises_completed integer NOT NULL DEFAULT 0,
  exercises_total integer NOT NULL DEFAULT 0,
  total_volume_kg numeric,

  -- Razonamiento del coach
  generation_method text,
  coach_reason text,

  -- Reseña post-workout (V2 — opcional)
  user_feeling text,
  user_notes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Índices ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_workout_log_user_date
  ON workout_log(user_id, date_local DESC);

CREATE INDEX IF NOT EXISTS idx_workout_log_user_modality
  ON workout_log(user_id, modality, date_local DESC);

CREATE INDEX IF NOT EXISTS idx_workout_log_user_recent
  ON workout_log(user_id, completed_at DESC);

-- ─── RLS ───────────────────────────────────────────────────────────
ALTER TABLE workout_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own workout log" ON workout_log;
CREATE POLICY "Users can read own workout log" ON workout_log
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own workout entries" ON workout_log;
CREATE POLICY "Users can insert own workout entries" ON workout_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own workout entries" ON workout_log;
CREATE POLICY "Users can update own workout entries" ON workout_log
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own workout entries" ON workout_log;
CREATE POLICY "Users can delete own workout entries" ON workout_log
  FOR DELETE USING (auth.uid() = user_id);

-- ─── Comentarios ───────────────────────────────────────────────────
COMMENT ON COLUMN workout_log.date_local IS
  'Fecha en zona del usuario, NO completed_at::date. Crítico para queries "qué hice ayer".';

COMMENT ON COLUMN workout_log.modality IS
  'fuerza | cardio | yoga | auto';

COMMENT ON COLUMN workout_log.day_type IS
  'upper | lower | pull | push | legs | cardio | movilidad | power-vinyasa';

COMMENT ON COLUMN workout_log.equipment IS
  'gym | cuerpo | ligas';

COMMENT ON COLUMN workout_log.energy IS
  'cansado | normal | energico | NULL si no hubo check-in';

COMMENT ON COLUMN workout_log.prior_exercise IS
  'none | light | heavy';

COMMENT ON COLUMN workout_log.discomfort IS
  'none | mild | pain';

COMMENT ON COLUMN workout_log.exercises IS
  'JSONB con shape: [{ exercise_id, variant_id, order, planned: {sets,reps,rest,tip}, performed: {sets: [{reps,kg,rpe,notes}], skipped, completed_at} | null }]';

COMMENT ON COLUMN workout_log.total_volume_kg IS
  'Suma de reps*kg de todos los sets — solo fuerza con peso. NULL para yoga/cardio.';

COMMENT ON COLUMN workout_log.generation_method IS
  'cache_hit | ai_generated | manual — para analytics';

COMMENT ON COLUMN workout_log.coach_reason IS
  'La razón que el coach (decideTodayWorkout) dio al generar este workout';

COMMENT ON COLUMN workout_log.user_feeling IS
  'great | good | tough | too_hard | NULL — review opcional V2';
