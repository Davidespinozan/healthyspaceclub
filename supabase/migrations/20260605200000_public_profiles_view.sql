-- ════════════════════════════════════════════════════════════════
-- Cierre del leak de PII: user_profiles tenía lectura pública de TODAS las
-- columnas (ob_data, tdee, trial, etc.). Ahora:
--   1) Vista public_profiles → solo campos seguros, lectura abierta.
--   2) Tabla base user_profiles → lectura SOLO de la fila propia.
-- Las lecturas sociales (perfil público, coautor) usan la vista.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public_profiles AS
SELECT
  user_id,
  display_name,
  username,
  avatar_url,
  bio,
  streak_count,
  created_at,
  start_date
FROM user_profiles;

-- La vista corre con permisos del owner (no security_invoker) → expone los
-- campos seguros de todos los perfiles, sin tocar el PII de la tabla base.
GRANT SELECT ON public_profiles TO anon, authenticated;

-- Tabla base: lectura solo propia (protege ob_data/tdee/plan/trial).
DROP POLICY IF EXISTS "Anyone can read profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can read own profile or public" ON user_profiles;
DO $$ BEGIN
  CREATE POLICY "Read own profile" ON user_profiles FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
