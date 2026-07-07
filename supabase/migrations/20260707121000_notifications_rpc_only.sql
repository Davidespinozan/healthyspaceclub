-- ════════════════════════════════════════════════════════════════
-- notifications: la política de INSERT solo validaba actor_id = auth.uid(),
-- pero el cliente ponía user_id (destinatario), actor_username, actor_avatar_url,
-- type y preview. Cualquiera podía crear notificaciones a cualquiera SUPLANTANDO
-- a otro (nombre/avatar libres) — y eso dispara web-push (phishing).
--
-- Fix: el ÚNICO insert directo del cliente (invitación/aceptación de pareja) pasa
-- a un RPC SECURITY DEFINER que (1) deriva actor_username/avatar del servidor,
-- (2) exige que exista una relación de pareja entre actor y destinatario, y
-- (3) restringe el type. Luego se REVOCA el INSERT directo: los demás caminos
-- (triggers de fire/comment/collab/follow y el motor de recordatorios) ya son
-- SECURITY DEFINER / service-role y siguen funcionando.
-- ════════════════════════════════════════════════════════════════

create or replace function public.notify_partner(recipient uuid, notif_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  me_username text;
  me_avatar text;
begin
  if me is null or me = recipient then return; end if;
  if notif_type not in ('partner_invite', 'partner_accept') then
    raise exception 'notify_partner: type no permitido';
  end if;

  -- Debe existir una relación de pareja entre ambos (pending para invitación,
  -- accepted para aceptación). Sin relación → no se puede notificar (anti-spam).
  if not exists (
    select 1 from public.user_partnerships p
    where (p.requester_id = me and p.addressee_id = recipient)
       or (p.requester_id = recipient and p.addressee_id = me)
  ) then
    return;
  end if;

  -- Actor derivado del SERVIDOR (no del cliente) → no se puede suplantar.
  select username, avatar_url into me_username, me_avatar
  from public.user_profiles where user_id = me;

  insert into public.notifications (user_id, actor_id, actor_username, actor_avatar_url, type)
  values (recipient, me, coalesce(me_username, ''), coalesce(me_avatar, ''), notif_type);
end;
$$;

grant execute on function public.notify_partner(uuid, text) to authenticated;

-- Cerrar el insert directo del cliente. Los triggers/motores server-side
-- (SECURITY DEFINER / service_role) insertan igual porque bypassean RLS.
drop policy if exists "Insert notification as actor" on public.notifications;
drop policy if exists "Anyone can insert notifications" on public.notifications;
