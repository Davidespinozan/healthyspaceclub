-- ============================================================
-- Reconciliación de RLS apretado en Bloque 2.1 (2026-05-14)
-- ============================================================
-- Esta migración documenta los cambios de RLS aplicados manualmente
-- en Supabase Studio durante la sesión de seguridad de Bloque 2.1.
-- Idempotente.
-- ============================================================

-- ============================================================
-- workout_cache — apretado a authenticated para escritura
-- ============================================================

DROP POLICY IF EXISTS "Public read/write cache" ON workout_cache;
DROP POLICY IF EXISTS "Anyone can insert cache" ON workout_cache;
DROP POLICY IF EXISTS "Anyone can read cache" ON workout_cache;
DROP POLICY IF EXISTS "Anyone can update cache" ON workout_cache;
DROP POLICY IF EXISTS "Authenticated can insert cache" ON workout_cache;
DROP POLICY IF EXISTS "Authenticated can update cache" ON workout_cache;

CREATE POLICY "Anyone can read cache" ON workout_cache
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can insert cache" ON workout_cache
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update cache" ON workout_cache
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- exercise_videos — solo admin puede escribir
-- ============================================================

DROP POLICY IF EXISTS "Anyone can insert videos for now" ON exercise_videos;
DROP POLICY IF EXISTS "Anyone can read exercise videos" ON exercise_videos;
DROP POLICY IF EXISTS "Anyone can update videos for now" ON exercise_videos;
DROP POLICY IF EXISTS "Anyone can read videos" ON exercise_videos;
DROP POLICY IF EXISTS "Admins can insert videos" ON exercise_videos;
DROP POLICY IF EXISTS "Admins can update videos" ON exercise_videos;
DROP POLICY IF EXISTS "Admins can delete videos" ON exercise_videos;

CREATE POLICY "Anyone can read videos" ON exercise_videos
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert videos" ON exercise_videos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can update videos" ON exercise_videos
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can delete videos" ON exercise_videos
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- ============================================================
-- meal_recipes — solo admin puede escribir
-- ============================================================

DROP POLICY IF EXISTS "Anyone can insert recipes" ON meal_recipes;
DROP POLICY IF EXISTS "Anyone can read recipes" ON meal_recipes;
DROP POLICY IF EXISTS "Admins can insert recipes" ON meal_recipes;
DROP POLICY IF EXISTS "Admins can update recipes" ON meal_recipes;
DROP POLICY IF EXISTS "Admins can delete recipes" ON meal_recipes;

CREATE POLICY "Anyone can read recipes" ON meal_recipes
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert recipes" ON meal_recipes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can update recipes" ON meal_recipes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can delete recipes" ON meal_recipes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );
