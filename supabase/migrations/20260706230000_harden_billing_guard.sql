-- ════════════════════════════════════════════════════════════════════
-- harden_billing_guard.sql
-- ════════════════════════════════════════════════════════════════════
-- Cierra dos huecos en guard_user_profiles_billing:
--
-- 1) is_admin NO estaba protegido. La RLS de user_profiles permite a un usuario
--    UPDATE de su propia fila (WITH CHECK auth.uid() = user_id), así que cualquiera
--    podía hacer  update({ is_admin: true })  y auto-otorgarse:
--       · IA sin límite (ai-proxy salta rate limit si is_admin)  → costo a cuenta del proyecto
--       · políticas RLS de admin sobre datos de OTROS usuarios (20260514130000)
--    Escalada de privilegios real. is_admin solo debe setearlo el backend (service_role).
--
-- 2) cancel_at_period_end volvió a quedar desprotegido: 20260530120000 lo añadió al
--    guard, pero 20260602130000 hizo create-or-replace de la misma función omitiéndolo
--    (el último replace gana). Un cliente podía revertir el "cancelar al fin del periodo".
--
-- Re-crea el guard con el cuerpo completo + ambas columnas. Idempotente.
-- ════════════════════════════════════════════════════════════════════

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
       or new.payment_past_due is distinct from false
       or new.cancel_at_period_end is distinct from false
       or new.is_admin is distinct from false then
      raise exception 'user_profiles: las columnas de billing/admin las gestiona el backend';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.stripe_customer_id       is distinct from old.stripe_customer_id
       or new.subscription_status     is distinct from old.subscription_status
       or new.subscription_period_end is distinct from old.subscription_period_end
       or new.plan_id                 is distinct from old.plan_id
       or new.billing_cycle           is distinct from old.billing_cycle
       or new.payment_past_due        is distinct from old.payment_past_due
       or new.cancel_at_period_end    is distinct from old.cancel_at_period_end
       or new.is_admin                is distinct from old.is_admin then
      raise exception 'user_profiles: las columnas de billing/admin las gestiona el backend';
    end if;
  end if;

  return new;
end;
$$;
