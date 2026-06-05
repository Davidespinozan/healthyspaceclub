-- Grafo social: seguir usuarios (estilo Instagram). Habilita el feed de
-- "Siguiendo" en el Club y los contadores de seguidores/seguidos en el perfil.

CREATE TABLE IF NOT EXISTS follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Lectura abierta (contadores y listas públicas). Insert/Delete solo como uno mismo.
DO $$ BEGIN
  CREATE POLICY "Anyone can read follows" ON follows FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Follow as yourself" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Unfollow your own" ON follows FOR DELETE USING (auth.uid() = follower_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows (following_id);

-- Notificar al seguido en vivo (centro de notificaciones).
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('fire', 'comment', 'collab', 'partner_invite', 'partner_accept', 'follow'));

CREATE OR REPLACE FUNCTION notify_on_follow() RETURNS trigger AS $$
DECLARE
  disp record;
BEGIN
  IF NEW.follower_id = NEW.following_id THEN RETURN NULL; END IF;
  SELECT * INTO disp FROM notif_actor_display(NEW.follower_id);
  INSERT INTO notifications (user_id, actor_id, actor_username, actor_avatar_url, type)
  VALUES (NEW.following_id, NEW.follower_id, disp.username, disp.avatar_url, 'follow');
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_on_follow ON follows;
CREATE TRIGGER trg_notify_on_follow
  AFTER INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION notify_on_follow();
