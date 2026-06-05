-- Fase 1B · Perfil de entreno de un compañero conectado.
--
-- user_preferences tiene RLS "solo lo tuyo", así que un usuario no puede leer el
-- nivel/equipo de otro directamente. Esta función SECURITY DEFINER lo devuelve
-- SOLO si existe una conexión aceptada entre ambos — así la rutina de pareja se
-- genera con datos reales sin exponer perfiles de desconocidos.

CREATE OR REPLACE FUNCTION public.get_partner_profile(partner uuid)
RETURNS TABLE (nivel text, equipment_default jsonb)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pr.nivel, pr.equipment_default
  FROM public.user_preferences pr
  WHERE pr.user_id = partner
    AND EXISTS (
      SELECT 1 FROM public.user_partnerships p
      WHERE p.status = 'accepted'
        AND (
          (p.requester_id = auth.uid() AND p.addressee_id = partner)
          OR (p.requester_id = partner AND p.addressee_id = auth.uid())
        )
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_partner_profile(uuid) TO authenticated;
