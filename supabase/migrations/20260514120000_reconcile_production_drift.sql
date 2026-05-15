-- ============================================================
-- Reconciliación de drift histórico HSC
-- Created: 2026-05-14
-- ============================================================
-- Esta migración documenta cambios aplicados manualmente en Supabase
-- Studio durante el desarrollo, que no estaban reflejados en las
-- migraciones originales del repo. Idempotente (IF NOT EXISTS para
-- columnas, DROP IF EXISTS + CREATE para policies).
--
-- Verificado vía information_schema 2026-05-14:
-- - user_profiles.is_public agregada manualmente
-- - club_posts.fire_count agregada manualmente
-- - Policies de user_profiles, club_posts, club_fires apretadas manualmente
-- ============================================================

-- ============================================================
-- 1. COLUMNAS AGREGADAS MANUALMENTE
-- ============================================================

-- user_profiles.is_public (control de visibilidad en feeds)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true;

-- club_posts.fire_count (denormalización del conteo de fires)
ALTER TABLE club_posts
  ADD COLUMN IF NOT EXISTS fire_count integer NOT NULL DEFAULT 0;

-- ============================================================
-- 2. POLICIES APRETADAS — user_profiles
-- ============================================================
-- Las policies originales eran USING (true) — reescritas manualmente
-- a estrictas por user. Esta sección las recrea declarativamente.

DROP POLICY IF EXISTS "Anyone can read profiles" ON user_profiles;
DROP POLICY IF EXISTS "Anyone can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Anyone can update profiles" ON user_profiles;
DROP POLICY IF EXISTS "Anyone can delete profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can read own profile or public" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON user_profiles;

CREATE POLICY "Users can read own profile or public" ON user_profiles
  FOR SELECT
  USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own profile" ON user_profiles
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 3. POLICIES APRETADAS — club_posts
-- ============================================================

DROP POLICY IF EXISTS "Anyone can read posts" ON club_posts;
DROP POLICY IF EXISTS "Anyone can insert posts" ON club_posts;
DROP POLICY IF EXISTS "Anyone can update posts" ON club_posts;
DROP POLICY IF EXISTS "Anyone can delete posts" ON club_posts;
DROP POLICY IF EXISTS "Authenticated users can read posts" ON club_posts;
DROP POLICY IF EXISTS "Users can insert own posts" ON club_posts;
DROP POLICY IF EXISTS "Users can update own posts" ON club_posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON club_posts;

CREATE POLICY "Authenticated users can read posts" ON club_posts
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own posts" ON club_posts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts" ON club_posts
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts" ON club_posts
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 4. POLICIES APRETADAS — club_fires
-- ============================================================

DROP POLICY IF EXISTS "Anyone can read fires" ON club_fires;
DROP POLICY IF EXISTS "Anyone can insert fires" ON club_fires;
DROP POLICY IF EXISTS "Anyone can delete fires" ON club_fires;
DROP POLICY IF EXISTS "Authenticated users can read fires" ON club_fires;
DROP POLICY IF EXISTS "Users can insert own fires" ON club_fires;
DROP POLICY IF EXISTS "Users can delete own fires" ON club_fires;

CREATE POLICY "Authenticated users can read fires" ON club_fires
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own fires" ON club_fires
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own fires" ON club_fires
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- NOTA: workout_cache, exercise_videos, meal_recipes
-- ============================================================
-- Estas tablas también tuvieron policies apretadas manualmente HOY
-- (Bloque 2.1, sesión 2026-05-14). Pero ya están reflejadas en el
-- timestamp posterior 20260514130000 (próxima migración a crear
-- si querés también reconciliar esas). Por ahora se quedan fuera de
-- este archivo para mantener separación de concerns.
-- ============================================================
