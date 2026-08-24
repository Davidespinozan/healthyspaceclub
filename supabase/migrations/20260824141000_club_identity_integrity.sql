-- ════════════════════════════════════════════════════════════════
-- SOCIAL-1 · Club integridad de identidad + contrato de UPDATE + privacidad
-- de comentarios + moderación admin. Todo idempotente. NO toca nutrición,
-- billing, auth ni training.
--
-- Cierra 4 huecos del audit GATE A:
--   (a) identidad denormalizada (username/avatar/streak/coauthor_*) era
--       client-supplied → un cliente modificado podía publicar como "Cristiano"
--       con avatar ajeno y streak 999999.
--   (b) fire_count/comments_count eran escribibles por el autor/coautor vía el
--       UPDATE genérico de fila → inflables.
--   (c) coautor podía reescribir texto/foto del post del autor.
--   (d) comentarios eran anon-readable (SELECT USING true).
--
-- Estrategia (misma familia que guard_user_profiles_billing): la identidad y
-- los contadores son DB-authoritative vía triggers SECURITY DEFINER; el cliente
-- NO puede fijarlos ni mutarlos. El único UPDATE de cliente legítimo es el
-- coautor aceptando/rechazando una colaboración (campos coauthor_*).
-- ════════════════════════════════════════════════════════════════

-- ── (a) Identidad server-derivada en club_posts (BEFORE INSERT) ──────────────
-- Ignora lo que mande el cliente en username/avatar_url/streak/coauthor_* y los
-- deriva de user_profiles por user_id / coauthor_id. Fuerza contadores a 0 y
-- coauthor_accepted a false (el coautor lo acepta después vía su propio UPDATE).
CREATE OR REPLACE FUNCTION public.set_club_post_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a_name text; a_avatar text; a_streak int;
  c_name text; c_avatar text;
BEGIN
  -- NOTA: esta función es SECURITY DEFINER, así que current_user SIEMPRE es el
  -- dueño (no el rol de sesión); por eso NO se puede filtrar por current_user
  -- aquí. La identidad se deriva SIEMPRE en cada INSERT → el cliente no puede
  -- fijar username/avatar/streak/contadores arbitrarios.
  SELECT COALESCE(NULLIF(up.display_name, ''), '') , COALESCE(up.avatar_url, ''), COALESCE(up.streak_count, 0)
    INTO a_name, a_avatar, a_streak
    FROM user_profiles up WHERE up.user_id = NEW.user_id;

  NEW.username   := COALESCE(a_name, '');
  NEW.avatar_url := COALESCE(a_avatar, '');
  NEW.streak     := COALESCE(a_streak, 0);
  NEW.fire_count := 0;
  NEW.comments_count := 0;
  NEW.coauthor_accepted := false;

  IF NEW.coauthor_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(up.username, ''), NULLIF(up.display_name, ''), ''), COALESCE(up.avatar_url, '')
      INTO c_name, c_avatar
      FROM user_profiles up WHERE up.user_id = NEW.coauthor_id;
    NEW.coauthor_username   := COALESCE(c_name, '');
    NEW.coauthor_avatar_url := COALESCE(c_avatar, '');
  ELSE
    NEW.coauthor_username   := '';
    NEW.coauthor_avatar_url := '';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_club_post_identity ON club_posts;
CREATE TRIGGER trg_set_club_post_identity
  BEFORE INSERT ON club_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_club_post_identity();

-- ── (a') Identidad server-derivada en club_comments (BEFORE INSERT) ──────────
CREATE OR REPLACE FUNCTION public.set_club_comment_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE a_name text; a_avatar text;
BEGIN
  -- SECURITY DEFINER: no filtrar por current_user (ver set_club_post_identity).
  SELECT COALESCE(NULLIF(up.display_name, ''), ''), COALESCE(up.avatar_url, '')
    INTO a_name, a_avatar
    FROM user_profiles up WHERE up.user_id = NEW.user_id;
  NEW.username   := COALESCE(a_name, '');
  NEW.avatar_url := COALESCE(a_avatar, '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_club_comment_identity ON club_comments;
CREATE TRIGGER trg_set_club_comment_identity
  BEFORE INSERT ON club_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_club_comment_identity();

-- ── (b)+(c) Contrato de UPDATE en club_posts (BEFORE UPDATE column-guard) ────
-- Congela toda columna server-owned: solo pueden cambiar los campos coauthor_*
-- (acepta/rechaza colab). Cualquier intento de tocar user_id/username/avatar/
-- streak/contadores/texto/foto/fechas se revierte silenciosamente a OLD.
CREATE OR REPLACE FUNCTION public.guard_club_post_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Solo congelar en updates de CLIENTE (rol authenticated/anon). Los triggers
  -- de contadores (sync_fire_count/sync_comments_count) son SECURITY DEFINER y
  -- corren como el rol dueño → NO deben congelarse, o los fires/comentarios
  -- dejarían de contar.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  NEW.user_id        := OLD.user_id;
  NEW.username       := OLD.username;
  NEW.avatar_url     := OLD.avatar_url;
  NEW.streak         := OLD.streak;
  NEW.workout_summary := OLD.workout_summary;
  NEW.meal_summary   := OLD.meal_summary;
  NEW.post_context   := OLD.post_context;
  NEW.photo_url      := OLD.photo_url;
  NEW.photo_urls     := OLD.photo_urls;
  NEW.text           := OLD.text;
  NEW.fire_count     := OLD.fire_count;
  NEW.comments_count := OLD.comments_count;
  NEW.aspect_ratio   := OLD.aspect_ratio;
  NEW.created_at     := OLD.created_at;
  -- Se permiten: coauthor_id, coauthor_username, coauthor_avatar_url, coauthor_accepted.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_club_post_columns ON club_posts;
CREATE TRIGGER trg_guard_club_post_columns
  BEFORE UPDATE ON club_posts
  FOR EACH ROW EXECUTE FUNCTION public.guard_club_post_columns();

-- ── (d) Comentarios NO anon-readable ────────────────────────────────────────
-- Reemplaza "Anyone can read comments" USING (true) por solo-autenticados,
-- consistente con club_posts SELECT.
DROP POLICY IF EXISTS "Anyone can read comments" ON club_comments;
DO $$ BEGIN
  CREATE POLICY "Auth reads comments" ON club_comments FOR SELECT
    USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── (e) Moderación admin: DELETE de contenido reportado ─────────────────────
-- Reutiliza public.hsc_is_admin() (SECURITY DEFINER ya existente). Un usuario
-- normal sigue borrando SOLO lo suyo; un admin puede retirar cualquier post/
-- comentario reportado.
DO $$ BEGIN
  CREATE POLICY "Admin deletes any post" ON club_posts FOR DELETE
    USING (public.hsc_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admin deletes any comment" ON club_comments FOR DELETE
    USING (public.hsc_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
