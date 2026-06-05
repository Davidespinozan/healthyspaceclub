-- Parte 1 · Sesión de pareja compartida: entregar la rutina al compañero.
--
-- Cuando A genera la rutina de pareja, ÉSTA debe llegarle también a B para que
-- los dos vean la misma (B no genera). A no puede escribir el daily_workout de B
-- (RLS), así que esta función SECURITY DEFINER lo hace — SOLO si están conectados
-- (aceptados). Reescribe los metadatos de pareja para que, del lado de B, el
-- "compañero" sea A (nombre/foto/id del que entrega).

CREATE OR REPLACE FUNCTION public.deliver_partner_workout(partner uuid, plan jsonb)
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
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_partnerships p
    WHERE p.status = 'accepted'
      AND (
        (p.requester_id = auth.uid() AND p.addressee_id = partner)
        OR (p.requester_id = partner AND p.addressee_id = auth.uid())
      )
  ) THEN
    RETURN 'not-connected';
  END IF;

  SELECT display_name, avatar_url INTO me_name, me_avatar
  FROM public.user_profiles WHERE user_id = auth.uid();

  -- mismo plan, pero los metadatos de pareja apuntan a MÍ (el que entrega)
  w := plan || jsonb_build_object(
    'partnerMode', true,
    'partnerName', coalesce(me_name, 'tu compañero'),
    'partnerAvatar', me_avatar,
    'partnerId', auth.uid()
  );

  ts := to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  d  := to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD');

  UPDATE public.user_profiles
    SET daily_workout = jsonb_build_object('date', d, 'plan', w, 'generatedAt', ts),
        daily_workout_updated_at = now(),
        updated_at = now()
    WHERE user_id = partner;

  RETURN 'delivered';
END;
$$;

GRANT EXECUTE ON FUNCTION public.deliver_partner_workout(uuid, jsonb) TO authenticated;
