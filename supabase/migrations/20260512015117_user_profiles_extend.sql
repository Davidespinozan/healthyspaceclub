-- ════════════════════════════════════════════════════════════════════
-- supabase_user_profiles_extend.sql
-- ════════════════════════════════════════════════════════════════════
-- Purpose: Extend user_profiles to persist onboarding data per Supabase
--          Auth user. Without this, the user's onboarding state lives
--          only in localStorage and is lost on logout — forcing re-onboarding.
--
-- After SIGNED_IN, App.tsx fetches these fields and hydrates the Zustand
-- store. After finishOnboardingCalc, the store upserts these fields
-- keyed by auth.users.id (stringified UUID stored in user_id text).
--
-- ⚠️  user_id stays text (NOT migrated to uuid) until Prompt 3.
--    New rows will use UUID stringified; old slug-keyed rows remain
--    untouched. Coexistence is intentional during the transition.
--
-- Run this in Supabase Dashboard → SQL Editor AFTER supabase_tables.sql.
-- Idempotent: safe to re-run.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS ob_data jsonb,
  ADD COLUMN IF NOT EXISTS start_date text,
  ADD COLUMN IF NOT EXISTS tdee numeric,
  ADD COLUMN IF NOT EXISTS plan_goal numeric,
  ADD COLUMN IF NOT EXISTS meal_plan_key text,
  ADD COLUMN IF NOT EXISTS user_plan text,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- ─── Comentarios ───────────────────────────────────────────────────
COMMENT ON COLUMN user_profiles.ob_data IS
  'Respuestas crudas del onboarding (shape: { name, sex, edad, peso, estatura, goal, activity }). Hidratado a Zustand obData en SIGNED_IN.';

COMMENT ON COLUMN user_profiles.start_date IS
  'YYYY-MM-DD del momento en que finishOnboardingCalc corrió. Usado para decidir dashboard vs onboarding tras login.';

COMMENT ON COLUMN user_profiles.tdee IS
  'kcal/día de mantenimiento calculado por calcTDEE.';

COMMENT ON COLUMN user_profiles.plan_goal IS
  'kcal/día objetivo (tdee ± ajuste según goal).';

COMMENT ON COLUMN user_profiles.meal_plan_key IS
  'Plan de comidas asignado (planA | planB | planC).';

COMMENT ON COLUMN user_profiles.user_plan IS
  'Plan de suscripción: none | trial | basico | pro | elite.';

COMMENT ON COLUMN user_profiles.trial_ends_at IS
  'ISO timestamp del fin del trial. NULL si no hay trial.';
