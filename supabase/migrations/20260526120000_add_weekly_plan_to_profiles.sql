-- ════════════════════════════════════════════════════════════════════
-- supabase_add_weekly_plan_to_profiles.sql
-- ════════════════════════════════════════════════════════════════════
-- Purpose: Persist weekly_plan + shopping_day to user_profiles so they
--          follow the user across devices.
--
-- Hasta ahora weeklyPlan + shoppingDay vivían solo en Zustand/localStorage.
-- Si el user entraba desde otro dispositivo, no veía su plan generado en
-- el primero. foodLog ya estaba en Supabase (food_log table) y sí seguía
-- al user. Sync-1 cierra ese gap para el resto del estado de nutrición
-- crítico.
--
-- weekly_plan es un objeto único por usuario (el plan vigente, no historia):
-- - jsonb es la decisión natural — encaja con el shape existente del store
--   ({ generatedAt, mealPlanKey, selectedDays[], shoppingList[], nota,
--     preferences }), evita una tabla nueva, y last-write-wins per
--   user_id es coherente (un solo plan vivo).
--
-- weekly_plan_updated_at se persiste explícitamente porque saveWeeklyPlan
-- ya guarda generatedAt en el jsonb, pero queremos un timestamp server-side
-- inmediatamente comparable (sin parsear el jsonb) para el algoritmo de
-- backfill push-then-pull en App.tsx — shouldUseRemotePlan compara timestamps.
--
-- shopping_day es el ancla del calendario semanal en WNP (0=Domingo..6=Sábado).
-- Vive aparte porque es un setting separado (lo setea el user en setup-day,
-- no se regenera con el plan).
--
-- RLS: user_profiles YA tiene RLS habilitado con policies estándar
-- (auth.uid() = user_id). Las columnas nuevas heredan esas policies —
-- NO hay que crear policies nuevas.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS. Safe re-run.
-- Run this in Supabase Dashboard → SQL Editor.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS weekly_plan jsonb;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS weekly_plan_updated_at timestamptz;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS shopping_day integer
    CHECK (shopping_day IS NULL OR shopping_day BETWEEN 0 AND 6);

COMMENT ON COLUMN user_profiles.weekly_plan IS
  'JSON con { generatedAt, mealPlanKey, selectedDays[], shoppingList[], nota, preferences }. Un único plan por user — last-write-wins natural.';

COMMENT ON COLUMN user_profiles.weekly_plan_updated_at IS
  'Timestamp de la última escritura del plan. Usado por shouldUseRemotePlan al login para decidir si pull/push/noop.';

COMMENT ON COLUMN user_profiles.shopping_day IS
  'Día anchor de la semana del calendario WNP (0=Dom..6=Sáb). Lo setea el user en setup-day del nutrition planner.';
