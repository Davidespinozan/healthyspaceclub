-- Sesión de pareja: el entrenador debe evitar los músculos que CADA quien
-- entrenó recientemente. El host no puede leer el workout_log del compañero
-- (RLS), así que esta función SECURITY DEFINER devuelve los day_type recientes
-- del compañero (últimas ~36h) — solo si están conectados (aceptados).

CREATE OR REPLACE FUNCTION public.get_partner_recent_daytypes(partner uuid)
RETURNS text[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(DISTINCT wl.day_type), '{}')
  FROM public.workout_log wl
  WHERE wl.user_id = partner
    AND wl.day_type IS NOT NULL
    AND wl.date_local >= (current_date - 1)
    AND EXISTS (
      SELECT 1 FROM public.user_partnerships p
      WHERE p.status = 'accepted'
        AND (
          (p.requester_id = auth.uid() AND p.addressee_id = partner)
          OR (p.requester_id = partner AND p.addressee_id = auth.uid())
        )
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_partner_recent_daytypes(uuid) TO authenticated;
