-- ════════════════════════════════════════════════════════════════
-- SOCIAL-1 · Bloqueo de usuarios (mínimo viable).
-- Si A bloquea B: A deja de ver contenido de B (y B el de A, ocultamiento
-- bilateral en el feed vía RPC). El bloqueo también rompe la relación de follow
-- en ambos sentidos (limpieza), para que un bloqueado no siga apareciendo como
-- follower/following. NO toca partnerships de entrenamiento.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT user_blocks_not_self CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks (blocked_id);

ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

-- INSERT/DELETE/SELECT: solo la fila donde YO soy el bloqueador. Un usuario NO
-- puede ver quién lo bloqueó (privacidad del bloqueo).
DO $$ BEGIN
  CREATE POLICY "Insert own block" ON user_blocks FOR INSERT
    WITH CHECK (auth.uid() = blocker_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Delete own block" ON user_blocks FOR DELETE
    USING (auth.uid() = blocker_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Read own blocks" ON user_blocks FOR SELECT
    USING (auth.uid() = blocker_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Al bloquear, romper follows en ambos sentidos (limpieza social). SECURITY
-- DEFINER: opera sobre follows del par sin depender de la RLS de follows.
CREATE OR REPLACE FUNCTION public.on_user_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM follows
   WHERE (follower_id = NEW.blocker_id AND following_id = NEW.blocked_id)
      OR (follower_id = NEW.blocked_id AND following_id = NEW.blocker_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_user_block ON user_blocks;
CREATE TRIGGER trg_on_user_block
  AFTER INSERT ON user_blocks
  FOR EACH ROW EXECUTE FUNCTION public.on_user_block();

-- RPC: ids a ocultar para el usuario de la sesión = {los que bloqueé} ∪ {los
-- que me bloquearon}. Bilateral SIN revelar quién me bloqueó (solo devuelve el
-- conjunto fusionado). SECURITY DEFINER para poder leer la dirección inversa.
CREATE OR REPLACE FUNCTION public.hsc_blocked_ids()
RETURNS TABLE (user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT blocked_id AS user_id FROM user_blocks WHERE blocker_id = auth.uid()
  UNION
  SELECT blocker_id AS user_id FROM user_blocks WHERE blocked_id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.hsc_blocked_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hsc_blocked_ids() TO authenticated;

COMMENT ON FUNCTION public.hsc_blocked_ids() IS
  'Ids a ocultar para la sesión: unión de a-quién-bloqueé y quién-me-bloqueó. No revela la dirección. Lo usa el feed/comentarios del Club.';
