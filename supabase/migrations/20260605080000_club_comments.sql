-- Comentarios en posts del Club. Cierra el loop social (la otra mitad de los
-- fires). El badge comments_count ya existía en club_posts; aquí lo poblamos
-- con datos reales y lo mantenemos en sync vía trigger.

CREATE TABLE IF NOT EXISTS club_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES club_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL DEFAULT '',
  avatar_url text DEFAULT '',
  text text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE club_comments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anyone can read comments" ON club_comments FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Anyone can insert comments" ON club_comments FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Anyone can delete comments" ON club_comments FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_club_comments_post
  ON club_comments (post_id, created_at);

-- Mantener club_posts.comments_count en sync (correcto entre clientes).
CREATE OR REPLACE FUNCTION sync_comments_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE club_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE club_posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_comments_count ON club_comments;
CREATE TRIGGER trg_sync_comments_count
  AFTER INSERT OR DELETE ON club_comments
  FOR EACH ROW EXECUTE FUNCTION sync_comments_count();
