-- ════════════════════════════════════════════════════════════════
-- Endurecimiento RLS (productización). Elimina políticas permisivas
-- (USING true) que dejaban a cualquier usuario escribir/borrar datos de
-- otros, y deja el set estricto por dueño. Idempotente.
-- ════════════════════════════════════════════════════════════════

-- ── user_profiles ──────────────────────────────────────────────
-- Lectura pública (necesaria para perfiles/sociales), pero escritura SOLO propia.
DROP POLICY IF EXISTS "Anyone can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Anyone can update profiles" ON user_profiles;
DO $$ BEGIN
  CREATE POLICY "Insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── club_posts ─────────────────────────────────────────────────
-- Insert/borrar solo el autor. UPDATE: autor O coautor (para aceptar colab).
DROP POLICY IF EXISTS "Anyone can insert posts" ON club_posts;
DROP POLICY IF EXISTS "Anyone can update posts" ON club_posts;
DROP POLICY IF EXISTS "Anyone can delete posts" ON club_posts;
DROP POLICY IF EXISTS "Users can insert own posts" ON club_posts;
DROP POLICY IF EXISTS "Users can update own posts" ON club_posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON club_posts;
DO $$ BEGIN
  CREATE POLICY "Insert own posts" ON club_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Author or coauthor updates post" ON club_posts FOR UPDATE
    USING (auth.uid() = user_id OR auth.uid() = coauthor_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Author deletes post" ON club_posts FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── club_fires ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can insert fires" ON club_fires;
DROP POLICY IF EXISTS "Anyone can delete fires" ON club_fires;
DO $$ BEGIN
  CREATE POLICY "Insert own fire" ON club_fires FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Delete own fire" ON club_fires FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── club_comments ──────────────────────────────────────────────
-- Insertar solo como uno mismo; borrar el autor del comentario O el dueño del post.
DROP POLICY IF EXISTS "Anyone can insert comments" ON club_comments;
DROP POLICY IF EXISTS "Anyone can delete comments" ON club_comments;
DO $$ BEGIN
  CREATE POLICY "Insert own comment" ON club_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Delete own comment or as post author" ON club_comments FOR DELETE
    USING (auth.uid() = user_id OR auth.uid() = (SELECT p.user_id FROM club_posts p WHERE p.id = post_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── notifications ──────────────────────────────────────────────
-- El cliente solo puede crear notificaciones COMO actor él mismo (las de
-- triggers/cron usan SECURITY DEFINER y bypassean RLS).
DROP POLICY IF EXISTS "Anyone can insert notifications" ON notifications;
DO $$ BEGIN
  CREATE POLICY "Insert notification as actor" ON notifications FOR INSERT WITH CHECK (auth.uid() = actor_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Contenido compartido: escritura solo autenticados (no anon) ─
-- exercise_videos / workout_cache / meal_recipes eran "Anyone can insert/update".
DROP POLICY IF EXISTS "Anyone can insert videos for now" ON exercise_videos;
DROP POLICY IF EXISTS "Anyone can update videos for now" ON exercise_videos;
DROP POLICY IF EXISTS "Anyone can insert cache" ON workout_cache;
DROP POLICY IF EXISTS "Anyone can update cache" ON workout_cache;
DO $$ BEGIN
  CREATE POLICY "Auth inserts cache" ON workout_cache FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Auth updates cache" ON workout_cache FOR UPDATE USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DROP POLICY IF EXISTS "Anyone can insert recipes" ON meal_recipes;
DO $$ BEGIN
  CREATE POLICY "Auth inserts recipes" ON meal_recipes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
