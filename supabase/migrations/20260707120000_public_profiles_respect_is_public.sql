-- ════════════════════════════════════════════════════════════════
-- public_profiles ignoraba is_public: exponía username/bio/avatar/racha/
-- fecha de alta de TODOS los perfiles (incluidos los marcados privados) a
-- anon + authenticated. search_users ya respeta is_public, así que la vista
-- era el hueco evadible. Se añade el filtro para que la privacidad sea real
-- y consistente. is_public es DEFAULT true → no oculta a nadie salvo a quien
-- se puso privado a propósito.
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
FROM user_profiles
WHERE is_public = true;

GRANT SELECT ON public_profiles TO anon, authenticated;
