-- ════════════════════════════════════════════════════════════════
-- SHARED-1 · Gate B-1 · El bloqueo (SOCIAL-1) se vuelve un límite interpersonal
-- GLOBAL: la capa de pareja lo respeta en búsqueda/invitación/entrega/notif/
-- status/perfil. Además: integridad de par (no A→B y B→A a la vez) y el bloqueo
-- borra la conexión de pareja. NO toca P1–P6, nutrición, billing, auth ni Club.
-- Idempotente.
--
-- Contrato de privacidad (§8): is_public gobierna SOLO la descoverabilidad
-- (search). Una conexión YA aceptada sigue funcionando aunque un lado se vuelva
-- privado. El BLOQUEO siempre gana sobre la conexión.
-- ════════════════════════════════════════════════════════════════

-- ── Helper bilateral (yo↔other). SECURITY DEFINER: lee user_blocks sin RLS. ──
CREATE OR REPLACE FUNCTION public.hsc_is_blocked(other uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks b
    WHERE (b.blocker_id = auth.uid() AND b.blocked_id = other)
       OR (b.blocker_id = other AND b.blocked_id = auth.uid())
  );
$$;
REVOKE ALL ON FUNCTION public.hsc_is_blocked(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hsc_is_blocked(uuid) TO authenticated;

-- ── search_users: excluir bloqueados (ambos sentidos) ───────────────────────
CREATE OR REPLACE FUNCTION public.search_users(q text)
RETURNS TABLE (user_id uuid, username text, display_name text, avatar_url text, streak_count integer)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH norm AS (SELECT trim(replace(q, '@', '')) AS s)
  SELECT up.user_id, up.username, up.display_name, up.avatar_url, up.streak_count
  FROM public.user_profiles up, norm
  WHERE up.is_public = true
    AND up.username IS NOT NULL
    AND up.user_id <> auth.uid()
    AND NOT public.hsc_is_blocked(up.user_id)
    AND length(norm.s) >= 1
    AND (up.username ILIKE '%' || norm.s || '%' OR coalesce(up.display_name, '') ILIKE '%' || norm.s || '%')
  ORDER BY (up.username ILIKE norm.s || '%') DESC, (up.username ILIKE '%' || norm.s || '%') DESC, up.streak_count DESC NULLS LAST
  LIMIT 10;
$$;
GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;

-- ── send_partner_invite: no invitar a/desde un bloqueado ────────────────────
CREATE OR REPLACE FUNCTION public.send_partner_invite(target uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF target = auth.uid() THEN RETURN 'self'; END IF;
  IF public.hsc_is_blocked(target) THEN RETURN 'blocked'; END IF;
  DELETE FROM public.user_partnerships
  WHERE status = 'declined'
    AND ((requester_id = auth.uid() AND addressee_id = target) OR (requester_id = target AND addressee_id = auth.uid()));
  IF EXISTS (SELECT 1 FROM public.user_partnerships
    WHERE status IN ('pending', 'accepted')
      AND ((requester_id = auth.uid() AND addressee_id = target) OR (requester_id = target AND addressee_id = auth.uid()))) THEN
    RETURN 'exists';
  END IF;
  INSERT INTO public.user_partnerships (requester_id, addressee_id, status) VALUES (auth.uid(), target, 'pending');
  RETURN 'sent';
EXCEPTION WHEN unique_violation THEN
  UPDATE public.user_partnerships SET status = 'pending', responded_at = NULL
    WHERE requester_id = auth.uid() AND addressee_id = target AND status = 'declined';
  IF FOUND THEN RETURN 'sent'; END IF;
  RETURN 'exists';
END; $$;
REVOKE ALL ON FUNCTION public.send_partner_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_partner_invite(uuid) TO authenticated;

-- ── deliver_partner_workout: no entregar a un bloqueado ─────────────────────
CREATE OR REPLACE FUNCTION public.deliver_partner_workout(partner uuid, plan jsonb, day_local text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me_name text; me_avatar text; w jsonb; ts text; d text; existing jsonb;
BEGIN
  IF public.hsc_is_blocked(partner) THEN RETURN 'blocked'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_partnerships p
    WHERE p.status = 'accepted'
      AND ((p.requester_id = auth.uid() AND p.addressee_id = partner) OR (p.requester_id = partner AND p.addressee_id = auth.uid()))) THEN
    RETURN 'not-connected';
  END IF;
  ts := to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  d  := coalesce(nullif(day_local, ''), to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD'));
  SELECT daily_workout INTO existing FROM public.user_profiles WHERE user_id = partner;
  IF existing IS NOT NULL AND existing->>'date' = d AND coalesce((existing#>>'{plan,partnerMode}')::boolean, false) = false THEN
    RETURN 'has-own';
  END IF;
  SELECT display_name, avatar_url INTO me_name, me_avatar FROM public.user_profiles WHERE user_id = auth.uid();
  w := plan || jsonb_build_object('partnerMode', true, 'partnerName', coalesce(me_name, 'tu compañero'), 'partnerAvatar', me_avatar, 'partnerId', auth.uid());
  UPDATE public.user_profiles
    SET daily_workout = jsonb_build_object('date', d, 'plan', w, 'generatedAt', ts), daily_workout_updated_at = now(), updated_at = now()
    WHERE user_id = partner;
  RETURN 'delivered';
END; $$;
REVOKE ALL ON FUNCTION public.deliver_partner_workout(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deliver_partner_workout(uuid, jsonb, text) TO authenticated;

-- ── get_partner_profile / recent_daytypes / today_status: bloqueo excluye ───
CREATE OR REPLACE FUNCTION public.get_partner_profile(partner uuid)
RETURNS TABLE (nivel text, equipment_default jsonb)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT pr.nivel, pr.equipment_default FROM public.user_preferences pr
  WHERE pr.user_id = partner AND NOT public.hsc_is_blocked(partner)
    AND EXISTS (SELECT 1 FROM public.user_partnerships p WHERE p.status = 'accepted'
      AND ((p.requester_id = auth.uid() AND p.addressee_id = partner) OR (p.requester_id = partner AND p.addressee_id = auth.uid())));
$$;
GRANT EXECUTE ON FUNCTION public.get_partner_profile(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_partner_recent_daytypes(partner uuid)
RETURNS text[] LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(DISTINCT wl.day_type), '{}') FROM public.workout_log wl
  WHERE wl.user_id = partner AND wl.day_type IS NOT NULL AND wl.date_local >= (current_date - 1)
    AND NOT public.hsc_is_blocked(partner)
    AND EXISTS (SELECT 1 FROM public.user_partnerships p WHERE p.status = 'accepted'
      AND ((p.requester_id = auth.uid() AND p.addressee_id = partner) OR (p.requester_id = partner AND p.addressee_id = auth.uid())));
$$;
GRANT EXECUTE ON FUNCTION public.get_partner_recent_daytypes(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.partner_today_status(partner uuid)
RETURNS TABLE (last_active_date date, streak_count integer, duo_streak integer, duo_last_date date)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT up.last_active_date, up.streak_count, coalesce(pp.duo_streak, 0), pp.duo_last_date
  FROM public.user_profiles up
  LEFT JOIN LATERAL (SELECT p.duo_streak, p.duo_last_date FROM public.user_partnerships p
    WHERE p.status = 'accepted' AND ((p.requester_id = auth.uid() AND p.addressee_id = partner) OR (p.requester_id = partner AND p.addressee_id = auth.uid())) LIMIT 1) pp ON true
  WHERE up.user_id = partner AND NOT public.hsc_is_blocked(partner)
    AND EXISTS (SELECT 1 FROM public.user_partnerships p2 WHERE p2.status = 'accepted'
      AND ((p2.requester_id = auth.uid() AND p2.addressee_id = partner) OR (p2.requester_id = partner AND p2.addressee_id = auth.uid())));
$$;
REVOKE ALL ON FUNCTION public.partner_today_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_today_status(uuid) TO authenticated;

-- ── partner_on_active: no notificar/contar dúo con bloqueados ───────────────
CREATE OR REPLACE FUNCTION public.partner_on_active(day_local text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid(); me_username text; me_avatar text;
  today date := coalesce(nullif(day_local, '')::date, (now() AT TIME ZONE 'utc')::date);
  yest date := (coalesce(nullif(day_local, '')::date, (now() AT TIME ZONE 'utc')::date) - 1);
  r record; pa date;
BEGIN
  IF me IS NULL THEN RETURN; END IF;
  SELECT username, avatar_url INTO me_username, me_avatar FROM public.user_profiles WHERE user_id = me;
  FOR r IN
    SELECT id, CASE WHEN requester_id = me THEN addressee_id ELSE requester_id END AS other, duo_streak, duo_last_date
    FROM public.user_partnerships
    WHERE status = 'accepted' AND (requester_id = me OR addressee_id = me)
  LOOP
    IF public.hsc_is_blocked(r.other) THEN CONTINUE; END IF;   -- SHARED-1: sin interacción con bloqueados
    INSERT INTO public.notifications (user_id, actor_id, actor_username, actor_avatar_url, type)
    VALUES (r.other, me, coalesce(me_username, ''), coalesce(me_avatar, ''), 'partner_trained');
    SELECT last_active_date INTO pa FROM public.user_profiles WHERE user_id = r.other;
    IF pa = today THEN
      UPDATE public.user_partnerships SET
        duo_streak = CASE WHEN duo_last_date = today THEN duo_streak WHEN duo_last_date = yest THEN coalesce(duo_streak, 0) + 1 ELSE 1 END,
        duo_last_date = today
      WHERE id = r.id;
    END IF;
  END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.partner_on_active(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_on_active(text) TO authenticated;

-- ── on_user_block: bloquear también ROMPE la conexión de pareja ─────────────
-- (además de follows, que ya borraba). Aditivo — no afecta al Club.
CREATE OR REPLACE FUNCTION public.on_user_block()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM follows
   WHERE (follower_id = NEW.blocker_id AND following_id = NEW.blocked_id)
      OR (follower_id = NEW.blocked_id AND following_id = NEW.blocker_id);
  DELETE FROM public.user_partnerships
   WHERE (requester_id = NEW.blocker_id AND addressee_id = NEW.blocked_id)
      OR (requester_id = NEW.blocked_id AND addressee_id = NEW.blocker_id);
  RETURN NEW;
END; $$;

-- ── §7 · Integridad de par: no A→B y B→A a la vez (índice de par canónico) ──
-- Previene el duplicado en dirección inversa que el UNIQUE(requester,addressee)
-- ordenado no cubría. Si hay duplicados históricos, este índice fallará al crear
-- → Gate C dedupea antes de aplicar.
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_partnerships_canonical_pair
  ON public.user_partnerships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
