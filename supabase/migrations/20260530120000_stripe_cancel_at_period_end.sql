-- ════════════════════════════════════════════════════════════════════
-- 20260530120000_stripe_cancel_at_period_end.sql
-- ════════════════════════════════════════════════════════════════════
-- Purpose: Stripe-Cancel — cancelación in-app (cancel_at_period_end).
--          Agrega user_profiles.cancel_at_period_end (lo escribe el webhook de
--          Stripe en customer.subscription.updated/created/deleted). La UI lo lee
--          para mostrar "se cancelará el {fecha}". La edge stripe-cancel-subscription
--          NO escribe la DB — solo marca cancel_at_period_end:true en Stripe.
--
-- Suma cancel_at_period_end a las columnas billing protegidas por el trigger
-- guard_user_profiles_billing (solo service_role/postgres las escriben).
--
-- Run en Supabase Dashboard → SQL Editor. Idempotente: safe to re-run.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_profiles.cancel_at_period_end IS
  'true si la suscripción quedó marcada para cancelar al fin del período (cancel_at_period_end de Stripe). Lo escribe el webhook de Stripe (service_role). El cliente solo lo lee.';

-- ─── Candado de billing (trigger) — suma cancel_at_period_end ───────
-- INVOKER (NO security definer): así current_user refleja el rol REAL de la sesión.
-- PostgREST hace SET ROLE authenticated|service_role; las conexiones directas usan su rol.
create or replace function public.guard_user_profiles_billing()
returns trigger
language plpgsql
as $$
begin
  -- roles backend: permitir cualquier escritura
  if current_user in ('service_role', 'supabase_admin', 'postgres') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.stripe_customer_id is not null
       or new.subscription_status is distinct from 'none'
       or new.subscription_period_end is not null
       or new.plan_id is not null
       or new.billing_cycle is not null
       or new.cancel_at_period_end is distinct from false then
      raise exception 'user_profiles: las columnas de billing las gestiona el backend';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.stripe_customer_id       is distinct from old.stripe_customer_id
       or new.subscription_status     is distinct from old.subscription_status
       or new.subscription_period_end is distinct from old.subscription_period_end
       or new.plan_id                 is distinct from old.plan_id
       or new.billing_cycle           is distinct from old.billing_cycle
       or new.cancel_at_period_end    is distinct from old.cancel_at_period_end then
      raise exception 'user_profiles: las columnas de billing las gestiona el backend';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_user_profiles_billing on public.user_profiles;
create trigger guard_user_profiles_billing
  before insert or update on public.user_profiles
  for each row execute function public.guard_user_profiles_billing();