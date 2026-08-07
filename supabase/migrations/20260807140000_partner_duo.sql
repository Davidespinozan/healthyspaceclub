-- ►► CORRER EN: proyecto Supabase de HEALTHY — ref ltveorvqvvlyivjwxjlc
-- ============================================================================
-- RACHA DE DÚO + PUSH PROACTIVO — cierra el modo "a distancia"
-- ============================================================================
-- 1. Columnas de racha de dúo en la conexión (días seguidos que AMBOS entrenaron).
-- 2. partner_on_active(): al volverte activo hoy (1ª vez del día), por cada
--    compañero aceptado: (a) le notifica que entrenaste (in-app + push vía trigger),
--    (b) si él TAMBIÉN entrenó hoy, sube la racha de dúo de esa conexión.
-- 3. partner_today_status ahora también devuelve duo_streak + duo_last_date.
--
-- Correr en Supabase Dashboard → SQL Editor. Idempotente: safe to re-run.
-- ============================================================================

-- ─── 1. Columnas de dúo ─────────────────────────────────────────────────────
ALTER TABLE public.user_partnerships
  ADD COLUMN IF NOT EXISTS duo_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duo_last_date date;

-- ─── 2. partner_on_active: notificar + subir la racha de dúo ─────────────────
CREATE OR REPLACE FUNCTION public.partner_on_active(day_local text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  me_username text;
  me_avatar text;
  today date := coalesce(nullif(day_local, '')::date, (now() AT TIME ZONE 'utc')::date);
  yest date := (coalesce(nullif(day_local, '')::date, (now() AT TIME ZONE 'utc')::date) - 1);
  r record;
  pa date;
BEGIN
  IF me IS NULL THEN RETURN; END IF;
  SELECT username, avatar_url INTO me_username, me_avatar FROM public.user_profiles WHERE user_id = me;

  FOR r IN
    SELECT id, CASE WHEN requester_id = me THEN addressee_id ELSE requester_id END AS other,
           duo_streak, duo_last_date
    FROM public.user_partnerships
    WHERE status = 'accepted' AND (requester_id = me OR addressee_id = me)
  LOOP
    -- (a) Notificar al compañero que entrené (in-app; el trigger dispara el push).
    INSERT INTO public.notifications (user_id, actor_id, actor_username, actor_avatar_url, type)
    VALUES (r.other, me, coalesce(me_username, ''), coalesce(me_avatar, ''), 'partner_trained');

    -- (b) ¿El compañero ya entrenó hoy? → se completa el par → sube racha de dúo.
    SELECT last_active_date INTO pa FROM public.user_profiles WHERE user_id = r.other;
    IF pa = today THEN
      UPDATE public.user_partnerships SET
        duo_streak = CASE
          WHEN duo_last_date = today THEN duo_streak            -- ya contado hoy
          WHEN duo_last_date = yest THEN coalesce(duo_streak, 0) + 1
          ELSE 1
        END,
        duo_last_date = today
      WHERE id = r.id;
    END IF;
  END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.partner_on_active(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_on_active(text) TO authenticated;

-- ─── 3. partner_today_status + racha de dúo ─────────────────────────────────
DROP FUNCTION IF EXISTS public.partner_today_status(uuid);
CREATE OR REPLACE FUNCTION public.partner_today_status(partner uuid)
RETURNS TABLE (last_active_date date, streak_count integer, duo_streak integer, duo_last_date date)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT up.last_active_date, up.streak_count,
    coalesce(pp.duo_streak, 0), pp.duo_last_date
  FROM public.user_profiles up
  LEFT JOIN LATERAL (
    SELECT p.duo_streak, p.duo_last_date
    FROM public.user_partnerships p
    WHERE p.status = 'accepted'
      AND ((p.requester_id = auth.uid() AND p.addressee_id = partner)
        OR (p.requester_id = partner AND p.addressee_id = auth.uid()))
    LIMIT 1
  ) pp ON true
  WHERE up.user_id = partner
    AND EXISTS (
      SELECT 1 FROM public.user_partnerships p2
      WHERE p2.status = 'accepted'
        AND ((p2.requester_id = auth.uid() AND p2.addressee_id = partner)
          OR (p2.requester_id = partner AND p2.addressee_id = auth.uid()))
    );
$$;
REVOKE ALL ON FUNCTION public.partner_today_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_today_status(uuid) TO authenticated;

-- ============================================================================
-- TESTS
-- ============================================================================
DROP TABLE IF EXISTS _res_duo;
DO $$
DECLARE v_n int;
BEGIN
  CREATE TEMP TABLE _res_duo(n int, prueba text, resultado text) ON COMMIT PRESERVE ROWS;

  SELECT count(*) INTO v_n FROM information_schema.columns
  WHERE table_name = 'user_partnerships' AND column_name IN ('duo_streak', 'duo_last_date');
  INSERT INTO _res_duo VALUES (1, 'Columnas de dúo', CASE WHEN v_n = 2 THEN 'OK' ELSE 'FALLA: ' || v_n END);

  SELECT count(*) INTO v_n FROM pg_proc
  WHERE proname IN ('partner_on_active', 'partner_today_status') AND pronamespace = 'public'::regnamespace;
  INSERT INTO _res_duo VALUES (2, 'RPCs (on_active + today_status)', CASE WHEN v_n = 2 THEN 'OK' ELSE 'FALLA: ' || v_n END);
END $$;
SELECT n AS "#", prueba, resultado FROM _res_duo ORDER BY n;
