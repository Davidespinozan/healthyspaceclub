-- ============================================================
-- Agregar comments_count a club_posts
-- ============================================================
-- Preparación para feature de comentarios (no funcional aún).
-- Default 0 para que existing rows queden consistentes.
-- ============================================================

ALTER TABLE club_posts
  ADD COLUMN IF NOT EXISTS comments_count integer NOT NULL DEFAULT 0;

-- Index para queries futuras que ordenen por engagement
CREATE INDEX IF NOT EXISTS idx_club_posts_comments_count
  ON club_posts(comments_count DESC)
  WHERE comments_count > 0;
