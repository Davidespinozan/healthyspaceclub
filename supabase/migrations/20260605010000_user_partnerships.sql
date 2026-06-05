-- Fase 1B · Conexiones sociales: buscar usuarios, invitar, aceptar, listar.
--
-- Una "conexión" es una invitación dirigida (requester → addressee) que pasa de
-- 'pending' a 'accepted'/'declined'. La unicidad evita invitaciones duplicadas;
-- los RPC chequean ambas direcciones para no cruzar invitaciones A→B y B→A.

-- ── Tabla ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_partnerships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT user_partnerships_distinct CHECK (requester_id <> addressee_id),
  CONSTRAINT user_partnerships_unique UNIQUE (requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS user_partnerships_addressee_idx
  ON public.user_partnerships (addressee_id, status);
CREATE INDEX IF NOT EXISTS user_partnerships_requester_idx
  ON public.user_partnerships (requester_id, status);

ALTER TABLE public.user_partnerships ENABLE ROW LEVEL SECURITY;

-- ── RLS: cada parte ve y gestiona lo suyo ────────────────────────────────────
DROP POLICY IF EXISTS "read own partnerships" ON public.user_partnerships;
CREATE POLICY "read own partnerships" ON public.user_partnerships
  FOR SELECT USING (auth.uid() IN (requester_id, addressee_id));

DROP POLICY IF EXISTS "insert as requester" ON public.user_partnerships;
CREATE POLICY "insert as requester" ON public.user_partnerships
  FOR INSERT WITH CHECK (auth.uid() = requester_id AND status = 'pending');

-- El destinatario puede cambiar el status (aceptar/rechazar).
DROP POLICY IF EXISTS "addressee responds" ON public.user_partnerships;
CREATE POLICY "addressee responds" ON public.user_partnerships
  FOR UPDATE USING (auth.uid() = addressee_id);

-- Cualquiera de las dos partes puede borrar (cancelar invitación / desconectar).
DROP POLICY IF EXISTS "either party deletes" ON public.user_partnerships;
CREATE POLICY "either party deletes" ON public.user_partnerships
  FOR DELETE USING (auth.uid() IN (requester_id, addressee_id));

-- ── Buscar usuarios por @usuario o nombre (solo perfiles públicos) ───────────
-- SECURITY DEFINER para devolver solo columnas seguras y aplicar el filtro de
-- privacidad de forma consistente. Excluye al propio usuario.
CREATE OR REPLACE FUNCTION public.search_users(q text)
RETURNS TABLE (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  streak_count integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.user_id, up.username, up.display_name, up.avatar_url, up.streak_count
  FROM public.user_profiles up
  WHERE up.is_public = true
    AND up.username IS NOT NULL
    AND up.user_id <> auth.uid()
    AND length(trim(q)) >= 2
    AND (up.username ILIKE trim(q) || '%' OR up.display_name ILIKE '%' || trim(q) || '%')
  ORDER BY (up.username ILIKE trim(q) || '%') DESC, up.streak_count DESC NULLS LAST
  LIMIT 20;
$$;

-- ── Enviar invitación — chequea ambas direcciones ───────────────────────────
-- Devuelve 'sent' | 'self' | 'exists' | 'error'.
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
  IF EXISTS (
    SELECT 1 FROM public.user_partnerships
    WHERE (requester_id = auth.uid() AND addressee_id = target)
       OR (requester_id = target AND addressee_id = auth.uid())
  ) THEN
    RETURN 'exists';
  END IF;
  INSERT INTO public.user_partnerships (requester_id, addressee_id, status)
  VALUES (auth.uid(), target, 'pending');
  RETURN 'sent';
EXCEPTION WHEN unique_violation THEN
  RETURN 'exists';
END;
$$;

-- ── Responder invitación (solo el destinatario) ─────────────────────────────
-- Devuelve 'accepted' | 'declined' | 'notfound'.
CREATE OR REPLACE FUNCTION public.respond_partner_invite(partnership uuid, accept boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_status text;
BEGIN
  new_status := CASE WHEN accept THEN 'accepted' ELSE 'declined' END;
  UPDATE public.user_partnerships
    SET status = new_status, responded_at = now()
    WHERE id = partnership AND addressee_id = auth.uid() AND status = 'pending';
  IF NOT FOUND THEN
    RETURN 'notfound';
  END IF;
  RETURN new_status;
END;
$$;

-- ── Listar mis conexiones con el perfil de la otra parte ─────────────────────
CREATE OR REPLACE FUNCTION public.list_partnerships()
RETURNS TABLE (
  partnership_id uuid,
  other_id uuid,
  other_username text,
  other_name text,
  other_avatar text,
  other_streak integer,
  status text,
  direction text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    CASE WHEN p.requester_id = auth.uid() THEN p.addressee_id ELSE p.requester_id END,
    op.username, op.display_name, op.avatar_url, op.streak_count,
    p.status,
    CASE WHEN p.requester_id = auth.uid() THEN 'outgoing' ELSE 'incoming' END,
    p.created_at
  FROM public.user_partnerships p
  JOIN public.user_profiles op
    ON op.user_id = (CASE WHEN p.requester_id = auth.uid() THEN p.addressee_id ELSE p.requester_id END)
  WHERE auth.uid() IN (p.requester_id, p.addressee_id)
  ORDER BY p.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_partner_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_partner_invite(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_partnerships() TO authenticated;
