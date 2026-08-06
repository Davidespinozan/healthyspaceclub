-- ►► CORRER EN: proyecto Supabase de HEALTHY — ref ltveorvqvvlyivjwxjlc
-- ============================================================================
-- HIGIENE DE PAREJA (Tier 3) — 3 fixes de servidor
-- ============================================================================
-- 1. RE-INVITAR tras un rechazo: send_partner_invite devolvía 'exists' con
--    CUALQUIER fila (incluida 'declined') → un "no" bloqueaba para siempre.
--    Ahora borra la declinada y permite invitar de nuevo.
-- 2. GUARD ANTI-CLOBBER: deliver_partner_workout PISABA el daily_workout del
--    compañero sin condición → si él ya había hecho SU rutina hoy, la perdía.
--    Ahora NO sobreescribe una rutina PROPIA de hoy (devuelve 'has-own').
-- 3. RLS UPDATE endurecida: "addressee responds" no tenía WITH CHECK → un
--    addressee podía, pegándole directo a PostgREST, mutar estados arbitrarios.
--    Ahora solo puede tocar filas 'pending' y dejarlas en 'accepted'/'declined'.
--
-- Correr en Supabase Dashboard → SQL Editor. Idempotente: safe to re-run.
-- ============================================================================

-- ─── 1. Re-invitar tras rechazo ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.send_partner_invite(target uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF target = auth.uid() THEN
    RETURN 'self';
  END IF;

  -- Una relación DECLINADA no debe bloquear para siempre: se borra para permitir
  -- re-invitar (en cualquier dirección).
  DELETE FROM public.user_partnerships
  WHERE status = 'declined'
    AND ((requester_id = auth.uid() AND addressee_id = target)
      OR (requester_id = target AND addressee_id = auth.uid()));

  -- Si queda una ACTIVA (pendiente o aceptada), no dupliques.
  IF EXISTS (
    SELECT 1 FROM public.user_partnerships
    WHERE status IN ('pending', 'accepted')
      AND ((requester_id = auth.uid() AND addressee_id = target)
        OR (requester_id = target AND addressee_id = auth.uid()))
  ) THEN
    RETURN 'exists';
  END IF;

  INSERT INTO public.user_partnerships (requester_id, addressee_id, status)
  VALUES (auth.uid(), target, 'pending');
  RETURN 'sent';
EXCEPTION WHEN unique_violation THEN
  -- Carrera con una fila vieja: intenta reciclarla a pending si es mía y declinada.
  UPDATE public.user_partnerships
    SET status = 'pending', responded_at = NULL
    WHERE requester_id = auth.uid() AND addressee_id = target AND status = 'declined';
  IF FOUND THEN RETURN 'sent'; END IF;
  RETURN 'exists';
END;
$$;
REVOKE ALL ON FUNCTION public.send_partner_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_partner_invite(uuid) TO authenticated;

-- ─── 2. Guard anti-clobber en la entrega de rutina ──────────────────────────
DROP FUNCTION IF EXISTS public.deliver_partner_workout(uuid, jsonb, text);
CREATE OR REPLACE FUNCTION public.deliver_partner_workout(partner uuid, plan jsonb, day_local text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me_name text;
  me_avatar text;
  w jsonb;
  ts text;
  d text;
  existing jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_partnerships p
    WHERE p.status = 'accepted'
      AND ((p.requester_id = auth.uid() AND p.addressee_id = partner)
        OR (p.requester_id = partner AND p.addressee_id = auth.uid()))
  ) THEN
    RETURN 'not-connected';
  END IF;

  ts := to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  d  := coalesce(nullif(day_local, ''), to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD'));

  -- Anti-clobber: no pisar una rutina PROPIA del compañero de HOY. Solo entregamos
  -- si no tiene rutina, es de otro día, o la de hoy YA es una rutina de pareja.
  SELECT daily_workout INTO existing FROM public.user_profiles WHERE user_id = partner;
  IF existing IS NOT NULL
     AND existing->>'date' = d
     AND coalesce((existing#>>'{plan,partnerMode}')::boolean, false) = false THEN
    RETURN 'has-own';
  END IF;

  SELECT display_name, avatar_url INTO me_name, me_avatar
  FROM public.user_profiles WHERE user_id = auth.uid();

  w := plan || jsonb_build_object(
    'partnerMode', true,
    'partnerName', coalesce(me_name, 'tu compañero'),
    'partnerAvatar', me_avatar,
    'partnerId', auth.uid()
  );

  UPDATE public.user_profiles
    SET daily_workout = jsonb_build_object('date', d, 'plan', w, 'generatedAt', ts),
        daily_workout_updated_at = now(),
        updated_at = now()
    WHERE user_id = partner;

  RETURN 'delivered';
END;
$$;
REVOKE ALL ON FUNCTION public.deliver_partner_workout(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deliver_partner_workout(uuid, jsonb, text) TO authenticated;

-- ─── 3. RLS UPDATE endurecida ───────────────────────────────────────────────
-- El addressee solo puede tocar filas PENDIENTES y dejarlas en accepted/declined
-- (antes: USING sin WITH CHECK → mutación arbitraria vía PostgREST directo).
-- respond_partner_invite (SECURITY DEFINER) sigue funcionando: corre como owner.
DROP POLICY IF EXISTS "addressee responds" ON public.user_partnerships;
CREATE POLICY "addressee responds" ON public.user_partnerships
  FOR UPDATE
  USING (auth.uid() = addressee_id AND status = 'pending')
  WITH CHECK (auth.uid() = addressee_id AND status IN ('accepted', 'declined'));

-- ============================================================================
-- TESTS
-- ============================================================================
DROP TABLE IF EXISTS _res_ph;
DO $$
DECLARE v_n int;
BEGIN
  CREATE TEMP TABLE _res_ph(n int, prueba text, resultado text) ON COMMIT PRESERVE ROWS;

  SELECT count(*) INTO v_n FROM pg_proc
  WHERE proname IN ('send_partner_invite', 'deliver_partner_workout') AND pronamespace = 'public'::regnamespace;
  INSERT INTO _res_ph VALUES (1, 'RPCs recreadas', CASE WHEN v_n = 2 THEN 'OK' ELSE 'FALLA: ' || v_n END);

  -- La política UPDATE ahora tiene WITH CHECK (qual + with_check no nulos)
  SELECT count(*) INTO v_n FROM pg_policies
  WHERE tablename = 'user_partnerships' AND policyname = 'addressee responds' AND with_check IS NOT NULL;
  INSERT INTO _res_ph VALUES (2, 'UPDATE con WITH CHECK', CASE WHEN v_n = 1 THEN 'OK' ELSE 'FALLA' END);
END $$;
SELECT n AS "#", prueba, resultado FROM _res_ph ORDER BY n;
