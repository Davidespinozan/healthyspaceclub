-- Centro de notificaciones in-app: el multiplicador de retención. Convierte
-- cada acción social (fire, comentario, colab) en un motivo para volver.
-- Las notificaciones se crean automáticamente vía triggers (robusto, no
-- depende del cliente). Las de pareja (invite/accept) se insertan desde las
-- funciones de utils/partners.ts.

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,      -- destinatario
  actor_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,              -- quién la genera
  actor_username text DEFAULT '',
  actor_avatar_url text DEFAULT '',
  type text NOT NULL CHECK (type IN ('fire', 'comment', 'collab', 'partner_invite', 'partner_accept')),
  post_id uuid REFERENCES club_posts(id) ON DELETE CASCADE,
  preview text DEFAULT '',                                                -- texto corto (ej: comentario)
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Cada quien lee/actualiza solo SUS notificaciones. Insert vía triggers
-- (SECURITY DEFINER) o desde funciones de pareja; permitimos insert abierto
-- igual que el resto de tablas del Club (cliente confiable).
DO $$ BEGIN
  CREATE POLICY "Read own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Delete own notifications" ON notifications FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Anyone can insert notifications" ON notifications FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications (user_id) WHERE read = false;

-- Realtime: el badge de la campana se actualiza en vivo.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Helper: datos de display del actor (username + avatar) ──────────
CREATE OR REPLACE FUNCTION notif_actor_display(actor uuid)
RETURNS TABLE (username text, avatar_url text) AS $$
  SELECT COALESCE(username, ''), COALESCE(avatar_url, '')
  FROM user_profiles WHERE user_id = actor;
$$ LANGUAGE sql SECURITY DEFINER;

-- ── Trigger: fire → notifica al autor del post ──────────────────────
CREATE OR REPLACE FUNCTION notify_on_fire() RETURNS trigger AS $$
DECLARE
  author uuid;
  disp record;
BEGIN
  SELECT user_id INTO author FROM club_posts WHERE id = NEW.post_id;
  IF author IS NULL OR author = NEW.user_id THEN RETURN NULL; END IF;  -- no auto-notificar
  SELECT * INTO disp FROM notif_actor_display(NEW.user_id);
  INSERT INTO notifications (user_id, actor_id, actor_username, actor_avatar_url, type, post_id)
  VALUES (author, NEW.user_id, disp.username, disp.avatar_url, 'fire', NEW.post_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_on_fire ON club_fires;
CREATE TRIGGER trg_notify_on_fire
  AFTER INSERT ON club_fires
  FOR EACH ROW EXECUTE FUNCTION notify_on_fire();

-- ── Trigger: comentario → notifica al autor (y al coautor si colab) ──
CREATE OR REPLACE FUNCTION notify_on_comment() RETURNS trigger AS $$
DECLARE
  author uuid;
  coauthor uuid;
  disp record;
  preview_text text;
BEGIN
  SELECT user_id, coauthor_id INTO author, coauthor FROM club_posts WHERE id = NEW.post_id;
  SELECT * INTO disp FROM notif_actor_display(NEW.user_id);
  preview_text := left(NEW.text, 80);
  IF author IS NOT NULL AND author <> NEW.user_id THEN
    INSERT INTO notifications (user_id, actor_id, actor_username, actor_avatar_url, type, post_id, preview)
    VALUES (author, NEW.user_id, disp.username, disp.avatar_url, 'comment', NEW.post_id, preview_text);
  END IF;
  IF coauthor IS NOT NULL AND coauthor <> NEW.user_id AND coauthor <> author THEN
    INSERT INTO notifications (user_id, actor_id, actor_username, actor_avatar_url, type, post_id, preview)
    VALUES (coauthor, NEW.user_id, disp.username, disp.avatar_url, 'comment', NEW.post_id, preview_text);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_on_comment ON club_comments;
CREATE TRIGGER trg_notify_on_comment
  AFTER INSERT ON club_comments
  FOR EACH ROW EXECUTE FUNCTION notify_on_comment();

-- ── Trigger: post colaborativo → notifica al coautor ────────────────
CREATE OR REPLACE FUNCTION notify_on_collab() RETURNS trigger AS $$
DECLARE
  disp record;
BEGIN
  IF NEW.coauthor_id IS NULL OR NEW.coauthor_id = NEW.user_id THEN RETURN NULL; END IF;
  SELECT * INTO disp FROM notif_actor_display(NEW.user_id);
  INSERT INTO notifications (user_id, actor_id, actor_username, actor_avatar_url, type, post_id)
  VALUES (NEW.coauthor_id, NEW.user_id, disp.username, disp.avatar_url, 'collab', NEW.id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_on_collab ON club_posts;
CREATE TRIGGER trg_notify_on_collab
  AFTER INSERT ON club_posts
  FOR EACH ROW EXECUTE FUNCTION notify_on_collab();
