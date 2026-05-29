-- ════════════════════════════════════════════════════════════════════
-- 20260529120000_stripe_billing_columns.sql
-- ════════════════════════════════════════════════════════════════════
-- Purpose: Stripe-0 — fundación de pagos. Añade las columnas de billing a
--          user_profiles que el webhook de Stripe escribirá en Stripe-1/2.
--          NO contiene lógica de pago: solo schema + candado de seguridad.
--
-- Las columnas de billing las gestiona EXCLUSIVAMENTE el backend
-- (edge functions vía service_role). El cliente las LEE (SELECT permitido
-- por la policy RLS existente) pero NO las escribe.
--
-- ⚠️  Candado de columna vía TRIGGER, no vía REVOKE de columna:
--    Supabase otorga UPDATE/INSERT a nivel de TABLA a authenticated/anon
--    por default. En Postgres un privilegio de tabla tiene precedencia
--    sobre un REVOKE de columna → el REVOKE solo sería un no-op (falsa
--    seguridad). El trigger BEFORE INSERT/UPDATE es efectivo, no enumera
--    columnas, sobrevive columnas futuras y no toca las policies RLS.
--
-- Backfill: las filas existentes quedan con subscription_status='none'
-- por el DEFAULT. Intencional — el cliente ignora estas columnas hasta
-- Stripe-2.
--
-- Run en Supabase Dashboard → SQL Editor. Idempotente: safe to re-run.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. Columnas de billing ─────────────────────────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'none'
    CHECK (subscription_status IN ('none', 'trial', 'pro')),
  ADD COLUMN IF NOT EXISTS subscription_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS plan_id text,
  ADD COLUMN IF NOT EXISTS billing_cycle text
    CHECK (billing_cycle IS NULL OR billing_cycle IN ('monthly', 'annual'));

-- ─── 2. Índice único parcial sobre el customer de Stripe ────────────
-- Un customer de Stripe ↔ un user. NULL permitido (filas sin Stripe aún).
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_stripe_customer_id_key
  ON public.user_profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- ─── 3. Comentarios (todas las escribe el webhook de Stripe) ────────
COMMENT ON COLUMN public.user_profiles.stripe_customer_id IS
  'ID del Customer de Stripe (cus_...). Lo escribe el webhook de Stripe (service_role) al crear el checkout. El cliente solo lo lee.';

COMMENT ON COLUMN public.user_profiles.subscription_status IS
  'Estado de suscripción: none | trial | pro. DEFAULT none. Lo escribe el webhook de Stripe (service_role) según los eventos de suscripción. El cliente solo lo lee.';

COMMENT ON COLUMN public.user_profiles.subscription_period_end IS
  'Fin del período pagado actual (current_period_end de Stripe). Lo escribe el webhook de Stripe (service_role). El cliente solo lo lee.';

COMMENT ON COLUMN public.user_profiles.plan_id IS
  'price_id activo de Stripe (price_...). Lo escribe el webhook de Stripe (service_role) al confirmarse la suscripción. El cliente solo lo lee.';

COMMENT ON COLUMN public.user_profiles.billing_cycle IS
  'Ciclo de cobro: monthly | annual (NULL si no hay suscripción). Lo escribe el webhook de Stripe (service_role). El cliente solo lo lee.';

-- ─── 4. Candado de billing (trigger) ────────────────────────────────
-- Solo el backend (service_role / postgres) escribe columnas de billing.
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
       or new.billing_cycle is not null then
      raise exception 'user_profiles: las columnas de billing las gestiona el backend';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.stripe_customer_id       is distinct from old.stripe_customer_id
       or new.subscription_status     is distinct from old.subscription_status
       or new.subscription_period_end is distinct from old.subscription_period_end
       or new.plan_id                 is distinct from old.plan_id
       or new.billing_cycle           is distinct from old.billing_cycle then
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
