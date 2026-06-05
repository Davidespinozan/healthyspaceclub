-- Colaboración estilo Instagram con ACEPTACIÓN. Un post colaborativo queda
-- pendiente para el coautor; solo aparece en SU perfil público (y muestra la
-- atribución dual) cuando ÉL la acepta.

ALTER TABLE club_posts
  ADD COLUMN IF NOT EXISTS coauthor_accepted boolean NOT NULL DEFAULT false;

-- Los colab que ya existían (antes de esta regla) se daban por aceptados
-- automáticamente — los marcamos como aceptados para no hacerlos desaparecer.
UPDATE club_posts
  SET coauthor_accepted = true
  WHERE coauthor_id IS NOT NULL AND coauthor_accepted = false;

-- Índice: traer rápido las colaboraciones ACEPTADAS donde un usuario es coautor.
CREATE INDEX IF NOT EXISTS idx_club_posts_coauthor_accepted
  ON club_posts (coauthor_id, created_at DESC)
  WHERE coauthor_id IS NOT NULL AND coauthor_accepted = true;
