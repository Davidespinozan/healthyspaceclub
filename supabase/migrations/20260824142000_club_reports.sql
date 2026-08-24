-- ════════════════════════════════════════════════════════════════
-- SOCIAL-1 · Reportes de contenido (moderación mínima viable).
-- Un usuario autenticado puede reportar un post O un comentario. El status lo
-- gestiona un admin (no el cliente). Anti-spam: un reporter no puede reportar
-- dos veces el mismo target.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS club_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id     uuid REFERENCES club_posts(id) ON DELETE CASCADE,
  comment_id  uuid REFERENCES club_comments(id) ON DELETE CASCADE,
  reason      text NOT NULL CHECK (reason IN ('spam','harassment','inappropriate','misinformation','other')),
  details     text DEFAULT '',
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','actioned','dismissed')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- Exactamente uno de post_id/comment_id debe estar presente.
  CONSTRAINT club_reports_one_target CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR
    (post_id IS NULL AND comment_id IS NOT NULL)
  )
);

-- Anti-spam: un reporter no duplica reporte del mismo post ni del mismo comment.
CREATE UNIQUE INDEX IF NOT EXISTS uq_club_reports_reporter_post
  ON club_reports (reporter_id, post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_club_reports_reporter_comment
  ON club_reports (reporter_id, comment_id) WHERE comment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_club_reports_status ON club_reports (status, created_at DESC);

ALTER TABLE club_reports ENABLE ROW LEVEL SECURITY;

-- INSERT: solo como uno mismo.
DO $$ BEGIN
  CREATE POLICY "Insert own report" ON club_reports FOR INSERT
    WITH CHECK (auth.uid() = reporter_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SELECT: el reporter ve los suyos; el admin ve todos.
DO $$ BEGIN
  CREATE POLICY "Read own reports" ON club_reports FOR SELECT
    USING (auth.uid() = reporter_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admin reads reports" ON club_reports FOR SELECT
    USING (public.hsc_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- UPDATE (cambio de status): solo admin. El usuario normal NO puede.
DO $$ BEGIN
  CREATE POLICY "Admin updates reports" ON club_reports FOR UPDATE
    USING (public.hsc_is_admin()) WITH CHECK (public.hsc_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TABLE club_reports IS
  'Reportes de posts/comentarios del Club. INSERT propio; SELECT propio o admin; UPDATE (status) solo admin.';
