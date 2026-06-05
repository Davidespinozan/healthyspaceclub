-- Fase 1B (fix) · Búsqueda de usuarios más tolerante.
--
-- Antes: si el usuario escribía "@pedro", el "@" entraba en la query y como los
-- handles se guardan sin "@", no encontraba nada (solo jalaba por display_name).
-- Ahora: se quita el "@", se busca por COINCIDENCIA PARCIAL (no exacta) tanto en
-- @usuario como en nombre, y se ordenan los más similares primero (prefijo gana).

CREATE OR REPLACE FUNCTION public.search_users(q text)
RETURNS TABLE (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  streak_count integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH norm AS (SELECT trim(replace(q, '@', '')) AS s)
  SELECT up.user_id, up.username, up.display_name, up.avatar_url, up.streak_count
  FROM public.user_profiles up, norm
  WHERE up.is_public = true
    AND up.username IS NOT NULL
    AND up.user_id <> auth.uid()
    AND length(norm.s) >= 1
    AND (
      up.username ILIKE '%' || norm.s || '%'
      OR coalesce(up.display_name, '') ILIKE '%' || norm.s || '%'
    )
  ORDER BY
    (up.username ILIKE norm.s || '%') DESC,            -- @usuario que empieza igual
    (up.username ILIKE '%' || norm.s || '%') DESC,     -- @usuario que contiene
    up.streak_count DESC NULLS LAST
  LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;
