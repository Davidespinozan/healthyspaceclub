-- Posts colaborativos (estilo Instagram) + contexto enriquecido.
-- Un post de un entrenamiento en pareja puede tener un coautor: aparece en el
-- perfil público de AMBOS y se muestra con los dos perfiles en el Club.
-- También guardamos el contexto (workout/meal/free) y un resumen de comida.

ALTER TABLE club_posts
  ADD COLUMN IF NOT EXISTS coauthor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coauthor_username text DEFAULT '',
  ADD COLUMN IF NOT EXISTS coauthor_avatar_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS meal_summary text DEFAULT '',
  ADD COLUMN IF NOT EXISTS post_context text NOT NULL DEFAULT 'free'
    CHECK (post_context IN ('workout', 'meal', 'free'));

-- Para traer rápido los posts donde un usuario es coautor (su perfil público).
CREATE INDEX IF NOT EXISTS idx_club_posts_coauthor
  ON club_posts (coauthor_id, created_at DESC)
  WHERE coauthor_id IS NOT NULL;
