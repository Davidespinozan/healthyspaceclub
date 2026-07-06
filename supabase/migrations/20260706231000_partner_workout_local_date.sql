-- ════════════════════════════════════════════════════════════════════
-- partner_workout_local_date.sql
-- ════════════════════════════════════════════════════════════════════
-- deliver_partner_workout fechaba el daily_workout entregado con la fecha UTC
-- (now() AT TIME ZONE 'utc'), pero TODO el cliente compara dailyWorkout.date
-- contra dayKey() LOCAL. De noche en husos negativos (MX UTC-6) el RPC estampaba
-- "mañana" → al compañero la rutina de pareja no le aparecía hoy.
--
-- Ahora acepta day_local (el dayKey local del host que entrega) y lo usa para la
-- fecha. generatedAt (instante) sigue en UTC, que es correcto para un timestamp.
-- Fallback a UTC si no se pasa (compat). Idempotente.
-- ════════════════════════════════════════════════════════════════════

drop function if exists public.deliver_partner_workout(uuid, jsonb);

create or replace function public.deliver_partner_workout(partner uuid, plan jsonb, day_local text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me_name text;
  me_avatar text;
  w jsonb;
  ts text;
  d text;
begin
  if not exists (
    select 1 from public.user_partnerships p
    where p.status = 'accepted'
      and (
        (p.requester_id = auth.uid() and p.addressee_id = partner)
        or (p.requester_id = partner and p.addressee_id = auth.uid())
      )
  ) then
    return 'not-connected';
  end if;

  select display_name, avatar_url into me_name, me_avatar
  from public.user_profiles where user_id = auth.uid();

  -- mismo plan, pero los metadatos de pareja apuntan a MÍ (el que entrega)
  w := plan || jsonb_build_object(
    'partnerMode', true,
    'partnerName', coalesce(me_name, 'tu compañero'),
    'partnerAvatar', me_avatar,
    'partnerId', auth.uid()
  );

  ts := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  -- Fecha LOCAL del host (para que coincida con dayKey del cliente); fallback UTC.
  d  := coalesce(nullif(day_local, ''), to_char(now() at time zone 'utc', 'YYYY-MM-DD'));

  update public.user_profiles
    set daily_workout = jsonb_build_object('date', d, 'plan', w, 'generatedAt', ts),
        daily_workout_updated_at = now(),
        updated_at = now()
    where user_id = partner;

  return 'delivered';
end;
$$;

grant execute on function public.deliver_partner_workout(uuid, jsonb, text) to authenticated;
