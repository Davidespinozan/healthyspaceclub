-- ════════════════════════════════════════════════════════════════════
-- add_daily_workout_to_profiles.sql  (Sync-3)
-- ════════════════════════════════════════════════════════════════════
-- Purpose: Persist dailyWorkout + dailyWorkoutRegenCount a user_profiles
--          para que la rutina generada siga al user entre dispositivos.
--
-- Hasta ahora dailyWorkout vivía solo en Zustand/localStorage: generabas
-- en la compu y el celular no la veía. Era la última pieza de estado sin
-- sync (food_log/weekly_plan/workout_log/meal_progress ya viajaban).
--
-- daily_workout es un objeto único por usuario (la rutina vigente del día,
-- no historia) → jsonb, last-write-wins per user_id, igual que weekly_plan.
-- Shape: { date, plan, generatedAt }.
--
-- daily_workout_updated_at: timestamp server-side comparable sin parsear el
-- jsonb, para el algoritmo shouldUseRemoteWorkout en App.tsx (pull/noop).
--
-- daily_workout_regen: el contador de regeneraciones del día (límite 3/día
-- por modalidad). Se sincroniza para que el límite sea consistente entre
-- devices. Shape: { date, countByModality, updatedAt }. Su propio
-- updated_at porque se escribe en un momento distinto al de la rutina.
--
-- RLS: user_profiles ya tiene RLS (auth.uid() = user_id). Las columnas
-- nuevas heredan esas policies — NO hay que crear policies nuevas.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS. Safe re-run.
-- Run this in Supabase Dashboard → SQL Editor.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS daily_workout jsonb;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS daily_workout_updated_at timestamptz;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS daily_workout_regen jsonb;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS daily_workout_regen_updated_at timestamptz;

COMMENT ON COLUMN user_profiles.daily_workout IS
  'JSON con { date, plan, generatedAt }. Una única rutina vigente por user — last-write-wins natural.';

COMMENT ON COLUMN user_profiles.daily_workout_updated_at IS
  'Timestamp de la última escritura de la rutina. Usado por shouldUseRemoteWorkout al login para decidir pull/noop.';

COMMENT ON COLUMN user_profiles.daily_workout_regen IS
  'JSON con { date, countByModality, updatedAt }. Contador de regeneraciones del día (límite por modalidad), sincronizado entre devices.';

COMMENT ON COLUMN user_profiles.daily_workout_regen_updated_at IS
  'Timestamp de la última escritura del contador de regeneraciones. Usado por shouldUseRemoteWorkout.';
