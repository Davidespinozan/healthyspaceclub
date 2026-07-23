-- ►► CORRER EN: proyecto Supabase de HEALTHY — ref ltveorvqvvlyivjwxjlc
-- ============================================================================
-- EQUIPO (Fase 5a) — dar / quitar acceso admin
-- ============================================================================
-- Quién puede entrar al panel = user_profiles.is_admin. Cambiarlo es sensible
-- (es escalada de privilegios), así que va por RPC SECURITY DEFINER con dos
-- candados, al estilo de sala-studio:
--   1. hsc_is_admin(): solo un admin puede tocar el equipo.
--   2. ULTIMO_ADMIN: nunca dejar el Club sin ningún admin (si te quitas el
--      acceso siendo el único, quedarías afuera para siempre).
-- Deja rastro en la bitácora.
--
-- Correr en Supabase Dashboard → SQL Editor. Idempotente: safe to re-run.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_set_admin(p_user_id uuid, p_es_admin boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actual boolean;
  v_admins int;
  v_nombre text;
BEGIN
  IF NOT public.hsc_is_admin() THEN
    RAISE EXCEPTION 'no autorizado';
  END IF;

  SELECT is_admin INTO v_actual FROM public.user_profiles WHERE user_id = p_user_id;
  IF v_actual IS NULL THEN
    RAISE EXCEPTION 'socio no encontrado';
  END IF;

  -- No dejar el Club sin ningún admin.
  IF v_actual = true AND p_es_admin = false THEN
    SELECT count(*) INTO v_admins FROM public.user_profiles WHERE is_admin = true;
    IF v_admins <= 1 THEN
      RAISE EXCEPTION 'ULTIMO_ADMIN: no se puede quitar al último administrador del Club';
    END IF;
  END IF;

  -- No-op si ya está en ese valor (no ensucia la bitácora).
  IF v_actual = p_es_admin THEN
    RETURN;
  END IF;

  UPDATE public.user_profiles SET is_admin = p_es_admin WHERE user_id = p_user_id;

  SELECT coalesce(nullif(display_name, ''), username, left(p_user_id::text, 8))
    INTO v_nombre FROM public.user_profiles WHERE user_id = p_user_id;

  PERFORM public._bitacora_log(
    'equipo.admin', p_user_id, v_nombre,
    CASE WHEN p_es_admin THEN 'Dio acceso admin' ELSE 'Quitó acceso admin' END,
    jsonb_build_object('es_admin', p_es_admin));
END; $$;

REVOKE ALL ON FUNCTION public.admin_set_admin(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_admin(uuid, boolean) TO authenticated;

-- ============================================================================
-- TESTS
-- ============================================================================
DROP TABLE IF EXISTS _res_eq;

DO $$
DECLARE v_n int;
BEGIN
  CREATE TEMP TABLE _res_eq(n int, prueba text, resultado text) ON COMMIT PRESERVE ROWS;

  -- 1. La RPC existe y es SECURITY DEFINER
  SELECT count(*) INTO v_n FROM pg_proc
  WHERE proname = 'admin_set_admin' AND pronamespace = 'public'::regnamespace AND prosecdef = true;
  INSERT INTO _res_eq VALUES (1, 'admin_set_admin existe y es SECURITY DEFINER',
    CASE WHEN v_n = 1 THEN 'OK' ELSE 'FALLA' END);

  -- 2. anon/public NO pueden ejecutarla
  SELECT count(*) INTO v_n FROM information_schema.role_routine_grants
  WHERE routine_name = 'admin_set_admin' AND grantee IN ('anon', 'PUBLIC');
  INSERT INTO _res_eq VALUES (2, 'anon/PUBLIC no pueden ejecutar admin_set_admin',
    CASE WHEN v_n = 0 THEN 'OK' ELSE 'FALLA: hay grant' END);
END $$;

SELECT n AS "#", prueba, resultado FROM _res_eq ORDER BY n;
