-- Fase 1A · Identidad social: @usuario único en user_profiles.
--
-- Permite buscar y conectar usuarios reales (entrenar en pareja, seguir, club).
-- El handle es case-insensitive, único, y sigue el formato @[a-z0-9_]{3,20}.
-- Los usuarios actuales lo eligen contextualmente (pre-sugerido desde su nombre);
-- los nuevos, en onboarding.

-- 1. Columna username (nullable — los usuarios existentes aún no tienen).
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS username text;

COMMENT ON COLUMN public.user_profiles.username IS
  'Handle público único (@usuario), case-insensitive, formato [a-z0-9_]{3,20}. Lo reclama el usuario vía claim_username(). Base de búsqueda/conexión social.';

-- 2. Formato válido (permite NULL para quien aún no lo eligió).
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_username_format;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_username_format
  CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,20}$');

-- 3. Unicidad case-insensitive (índice parcial: ignora NULLs).
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_username_lower_uidx
  ON public.user_profiles (lower(username))
  WHERE username IS NOT NULL;

-- 4. ¿Está disponible? (SECURITY DEFINER para ver también perfiles privados —
--    si no, un handle tomado por un perfil privado se reportaría libre y luego
--    el índice único lo rechazaría.)
CREATE OR REPLACE FUNCTION public.is_username_available(candidate text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE lower(username) = lower(trim(candidate))
      AND user_id <> auth.uid()
  );
$$;

-- 5. Reclamar handle para el usuario actual — atómico y race-safe.
--    Devuelve 'ok' | 'taken' | 'invalid'.
CREATE OR REPLACE FUNCTION public.claim_username(candidate text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized text;
BEGIN
  normalized := lower(trim(candidate));
  IF normalized !~ '^[a-z0-9_]{3,20}$' THEN
    RETURN 'invalid';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE lower(username) = normalized AND user_id <> auth.uid()
  ) THEN
    RETURN 'taken';
  END IF;
  UPDATE public.user_profiles
    SET username = normalized, updated_at = now()
    WHERE user_id = auth.uid();
  RETURN 'ok';
EXCEPTION WHEN unique_violation THEN
  RETURN 'taken';
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_username(text) TO authenticated;
