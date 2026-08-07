-- ►► CORRER EN: proyecto Supabase de HEALTHY — ref ltveorvqvvlyivjwxjlc
-- ============================================================================
-- ESTADO DE HOY DEL COMPAÑERO — "reto del día" (modo a distancia)
-- ============================================================================
-- Para el accountability a distancia: ¿mi compañero ya entrenó hoy? Necesito su
-- last_active_date + racha, pero user_profiles.SELECT es solo-tu-fila. Esta RPC
-- SECURITY DEFINER lo devuelve SOLO si hay conexión aceptada (mismo patrón que
-- get_partner_profile). No expone nada de desconocidos.
--
-- Correr en Supabase Dashboard → SQL Editor. Idempotente: safe to re-run.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.partner_today_status(partner uuid)
RETURNS TABLE (last_active_date date, streak_count integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.last_active_date, up.streak_count
  FROM public.user_profiles up
  WHERE up.user_id = partner
    AND EXISTS (
      SELECT 1 FROM public.user_partnerships p
      WHERE p.status = 'accepted'
        AND (
          (p.requester_id = auth.uid() AND p.addressee_id = partner)
          OR (p.requester_id = partner AND p.addressee_id = auth.uid())
        )
    );
$$;

REVOKE ALL ON FUNCTION public.partner_today_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_today_status(uuid) TO authenticated;

-- ============================================================================
-- TEST
-- ============================================================================
DROP TABLE IF EXISTS _res_pts;
DO $$
DECLARE v_n int;
BEGIN
  CREATE TEMP TABLE _res_pts(n int, prueba text, resultado text) ON COMMIT PRESERVE ROWS;
  SELECT count(*) INTO v_n FROM pg_proc
  WHERE proname = 'partner_today_status' AND pronamespace = 'public'::regnamespace;
  INSERT INTO _res_pts VALUES (1, 'RPC partner_today_status existe', CASE WHEN v_n = 1 THEN 'OK' ELSE 'FALLA' END);
END $$;
SELECT n AS "#", prueba, resultado FROM _res_pts ORDER BY n;
