-- ════════════════════════════════════════════════════════════════
-- SOCIAL-2A · Moderación automática pre-publicación del Club.
--
-- Autoridad de publicación 100% server-side: se ELIMINA el permiso de INSERT
-- directo de club_posts para clientes autenticados. A partir de aquí, el ÚNICO
-- creador normal de posts visibles es la Edge Function `club-moderate`
-- (service_role, bypassa RLS), que sube la imagen y crea el post SOLO tras un
-- veredicto ALLOW de Claude. Un cliente ya NO puede insertar un post directo vía
-- PostgREST/curl aunque tenga un JWT válido.
--
-- Los triggers de identidad/columnas de SOCIAL-1 quedan intactos:
--   set_club_post_identity (BEFORE INSERT) sigue derivando username/avatar/
--   streak/coauthor_* y forzando fire_count/comments_count/coauthor_accepted,
--   así que la Edge Function NO duplica autoridad de identidad.
-- ════════════════════════════════════════════════════════════════

-- ── Auditoría de moderación (NO guarda contenido: ni imagen, ni caption, ni
--    prompt, ni respuesta cruda, ni PII). Solo metadata operacional. ──────────
CREATE TABLE IF NOT EXISTS club_post_moderation (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id     uuid REFERENCES club_posts(id) ON DELETE SET NULL,
  decision    text NOT NULL CHECK (decision IN ('ALLOW','REVIEW','BLOCK','ERROR')),
  categories  text[] NOT NULL DEFAULT '{}',
  reason_code text,
  model       text NOT NULL,
  latency_ms  integer,
  image_count smallint NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Para el conteo de rate-limit por usuario/ventana y para el panel admin.
CREATE INDEX IF NOT EXISTS idx_club_post_moderation_user
  ON club_post_moderation (user_id, created_at DESC);

ALTER TABLE club_post_moderation ENABLE ROW LEVEL SECURITY;

-- SELECT: el usuario ve las suyas; el admin ve todas. NO hay policy de
-- INSERT/UPDATE/DELETE para authenticated → solo service_role escribe.
DO $$ BEGIN
  CREATE POLICY "Read own moderation" ON club_post_moderation FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admin reads moderation" ON club_post_moderation FOR SELECT
    USING (public.hsc_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TABLE club_post_moderation IS
  'Auditoría de moderación AI pre-publicación del Club. Solo metadata (decision/categories/reason/model/latency/image_count). SELECT propio o admin; escribe solo service_role.';

-- ── CRÍTICO: quitar la autoridad de INSERT directo de club_posts al cliente ──
-- Antes: "Insert own posts" WITH CHECK (auth.uid() = user_id) → cualquier JWT
-- podía crear un post visible sin pasar por moderación. Se elimina. La Edge
-- Function (service_role) sigue insertando porque bypassa RLS.
DROP POLICY IF EXISTS "Insert own posts" ON club_posts;

-- NOTA: NO se tocan las policies de SELECT/UPDATE/DELETE de club_posts, ni
-- fires/comments/reports/blocks, ni los triggers de identidad/guard.
