-- ════════════════════════════════════════════════════════════════════
-- add_payment_past_due.sql  (Billing-PastDue)
-- ════════════════════════════════════════════════════════════════════
-- Purpose: señal separada para mostrarle al user que su pago falló y que
--          actualice su tarjeta, SIN cambiar su acceso.
--
-- subscription_status colapsa 'past_due' → 'pro' a propósito (gracia: el
-- user mantiene acceso mientras el dunning de Stripe reintenta). Pero así
-- el cliente no puede distinguir past_due → no le avisa. payment_past_due
-- captura ese estado (lo escribe el webhook desde sub.status === 'past_due')
-- para mostrar un banner con CTA a actualizar tarjeta.
--
-- Protegida por el trigger guard_user_profiles_billing (igual que el resto
-- de las columnas de billing): solo el backend (service_role) la escribe.
--
-- Idempotente. Run in Supabase Dashboard → SQL Editor.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS payment_past_due boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_profiles.payment_past_due IS
  'true cuando la suscripción está en past_due (pago fallido, en dunning). Lo escribe el webhook. Acceso NO cambia (subscription_status sigue pro); solo dispara el banner de "actualizá tu tarjeta".';

-- Re-crear el guard para incluir payment_past_due en las columnas de billing
-- que el cliente NO puede escribir (solo backend). Mismo cuerpo + la columna nueva.
create or replace function public.guard_user_profiles_billing()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('service_role', 'supabase_admin', 'postgres') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.stripe_customer_id is not null
       or new.subscription_status is distinct from 'none'
       or new.subscription_period_end is not null
       or new.plan_id is not null
       or new.billing_cycle is not null
       or new.payment_past_due is distinct from false then
      raise exception 'user_profiles: las columnas de billing las gestiona el backend';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.stripe_customer_id       is distinct from old.stripe_customer_id
       or new.subscription_status     is distinct from old.subscription_status
       or new.subscription_period_end is distinct from old.subscription_period_end
       or new.plan_id                 is distinct from old.plan_id
       or new.billing_cycle           is distinct from old.billing_cycle
       or new.payment_past_due        is distinct from old.payment_past_due then
      raise exception 'user_profiles: las columnas de billing las gestiona el backend';
    end if;
  end if;

  return new;
end;
$$;
