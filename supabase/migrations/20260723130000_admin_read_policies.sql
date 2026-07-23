-- ►► CORRER EN: proyecto Supabase de HEALTHY — ref ltveorvqvvlyivjwxjlc
-- ============================================================================
-- LECTURA ADMIN — el panel de HSC lee el negocio desde el navegador
-- ============================================================================
-- El panel admin corre en el navegador como un usuario `authenticated` con
-- user_profiles.is_admin = true. Necesita LEER tres cosas que hoy no puede:
--   1. TODOS los user_profiles (no solo el suyo) — la lista/ficha de socios.
--   2. movimientos_dinero — el libro contable (hoy default-deny, service_role).
--   3. eventos_estado — el historial (hoy default-deny, service_role).
--
-- Patrón (tomado de sala-studio): el guard del cliente es solo UX; la muralla
-- real es esta RLS. Se GRANT SELECT a authenticated y una policy is_admin()
-- filtra: un socio normal ve CERO filas de estas tablas; un admin las ve todas.
-- La ESCRITURA sigue negada (INSERT/UPDATE/DELETE nunca se otorgan a
-- authenticated) — la hace el webhook/RPCs con service_role.
--
-- IMPORTANTE — recursión: la policy de user_profiles NO puede consultar
-- user_profiles inline (se llamaría a sí misma). Por eso el helper
-- hsc_is_admin() es SECURITY DEFINER: corre con permisos del dueño y NO dispara
-- la RLS de user_profiles, cortando la recursión.
--
-- Correr en Supabase Dashboard → SQL Editor. Idempotente: safe to re-run.
-- ============================================================================

-- ─── 1. Helper: ¿el que llama es admin? ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.hsc_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid() AND is_admin = true
  );
$$;

REVOKE ALL ON FUNCTION public.hsc_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hsc_is_admin() TO authenticated;

COMMENT ON FUNCTION public.hsc_is_admin() IS
  'TRUE si el usuario de la sesión es admin de HSC. SECURITY DEFINER para no recursar la RLS de user_profiles. Lo usan las policies de lectura del panel admin.';

-- ─── 2. user_profiles: un admin lee TODAS las filas ─────────────────────────
-- Aditiva (PERMISSIVE) a las policies existentes (self-read / perfil público):
-- no las toca, solo suma "si sos admin, ves todo".
DROP POLICY IF EXISTS up_admin_read_all ON public.user_profiles;
CREATE POLICY up_admin_read_all ON public.user_profiles
  FOR SELECT TO authenticated
  USING ( public.hsc_is_admin() );

-- ─── 3. movimientos_dinero: lectura admin ───────────────────────────────────
-- La migración del libro REVOCÓ ALL a authenticated. Se re-otorga SOLO SELECT
-- (nunca INSERT/UPDATE/DELETE) y la policy limita a admins.
GRANT SELECT ON public.movimientos_dinero TO authenticated;

DROP POLICY IF EXISTS mov_admin_read ON public.movimientos_dinero;
CREATE POLICY mov_admin_read ON public.movimientos_dinero
  FOR SELECT TO authenticated
  USING ( public.hsc_is_admin() );

-- ─── 4. eventos_estado: lectura admin ───────────────────────────────────────
GRANT SELECT ON public.eventos_estado TO authenticated;

DROP POLICY IF EXISTS evt_admin_read ON public.eventos_estado;
CREATE POLICY evt_admin_read ON public.eventos_estado
  FOR SELECT TO authenticated
  USING ( public.hsc_is_admin() );

-- ============================================================================
-- TESTS
-- ============================================================================
DROP TABLE IF EXISTS _res_adm;

DO $$
DECLARE
  v_n int;
BEGIN
  CREATE TEMP TABLE _res_adm(n int, prueba text, resultado text) ON COMMIT PRESERVE ROWS;

  -- 1. El helper existe y devuelve boolean sin sesión (auth.uid() NULL → false)
  BEGIN
    PERFORM public.hsc_is_admin();
    INSERT INTO _res_adm VALUES (1, 'hsc_is_admin() ejecuta', 'OK');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _res_adm VALUES (1, 'hsc_is_admin() ejecuta', 'FALLA: ' || SQLERRM);
  END;

  -- 2. Las tres policies de lectura admin quedaron creadas
  SELECT count(*) INTO v_n FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname IN ('up_admin_read_all', 'mov_admin_read', 'evt_admin_read');
  INSERT INTO _res_adm VALUES (2, 'Las 3 policies de lectura admin existen',
    CASE WHEN v_n = 3 THEN 'OK' ELSE 'FALLA: quedaron ' || v_n END);

  -- 3. authenticated tiene SELECT (y NO tiene INSERT) en movimientos_dinero
  SELECT count(*) INTO v_n FROM information_schema.role_table_grants
  WHERE table_name = 'movimientos_dinero' AND grantee = 'authenticated' AND privilege_type = 'SELECT';
  INSERT INTO _res_adm VALUES (3, 'authenticated puede SELECT movimientos_dinero',
    CASE WHEN v_n = 1 THEN 'OK' ELSE 'FALLA' END);

  SELECT count(*) INTO v_n FROM information_schema.role_table_grants
  WHERE table_name = 'movimientos_dinero' AND grantee = 'authenticated' AND privilege_type = 'INSERT';
  INSERT INTO _res_adm VALUES (4, 'authenticated NO puede INSERT movimientos_dinero (solo backend)',
    CASE WHEN v_n = 0 THEN 'OK' ELSE 'FALLA: dejó insertar' END);
END $$;

SELECT n AS "#", prueba, resultado FROM _res_adm ORDER BY n;
