-- ════════════════════════════════════════════════════════════════════
-- ROLLBACK de 20261017120000_nutrition_calibration_energy_base.sql      · BORRADOR · NO APLICADO
-- ════════════════════════════════════════════════════════════════════
-- Devuelve el schema exactamente al estado de 20261016120000 (Bloque 4):
--   · elimina la firma de 9 args y restaura la de 8 (cuerpo idéntico al de 20261016);
--   · restaura el guard de 20261015 (sin base_energy_raw);
--   · restaura el CHECK de reason sin 'SAFETY_FLOOR_REACHED';
--   · elimina la columna base_energy_raw (y con ella las bases congeladas que existan).
-- Precondición: ningún check-in con reason 'SAFETY_FLOOR_REACHED' (el CHECK viejo no lo admitiría);
-- si los hay, ABORTA (requiere decisión). Desplegar ANTES la Edge anterior (la que llama 8 args).
-- Run en Supabase Dashboard → SQL Editor — SOLO con autorización explícita.
-- ════════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if exists (select 1 from public.nutrition_adaptive_checkins where reason = 'SAFETY_FLOOR_REACHED') then
    raise exception 'rollback nutrition_calibration_energy_base: existen check-ins SAFETY_FLOOR_REACHED; requiere decisión';
  end if;
end $$;

drop function public.nutrition_server_start_calibration(uuid, uuid, text, date, date, numeric, numeric, smallint, numeric);

create function public.nutrition_server_start_calibration(
  p_user_id uuid,
  p_request_id uuid,
  p_objective text,
  p_baseline_date date,
  p_cycle_start date,
  p_baseline_weight_kg numeric,
  p_baseline_waist_cm numeric,
  p_calibration_version smallint
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  v_prev public.nutrition_calibrations%rowtype;
  v_active public.nutrition_calibrations%rowtype;
  v_new_id uuid;
begin
  if p_user_id is null or p_request_id is null then
    return jsonb_build_object('status', 'INVALID_PAYLOAD');
  end if;

  select * into v_prev from public.nutrition_calibrations
    where user_id = p_user_id and start_request_id = p_request_id;
  if found then
    return jsonb_build_object('status', 'STARTED', 'calibration_id', v_prev.id, 'nutrition_weight_kg', v_prev.baseline_weight_kg);
  end if;

  select * into v_active from public.nutrition_calibrations
    where user_id = p_user_id and status = 'ACTIVE' for update;
  if found and v_active.objective = p_objective then
    return jsonb_build_object('status', 'ALREADY_ACTIVE', 'calibration_id', v_active.id);
  end if;
  if found then
    update public.nutrition_calibrations set status = 'CLOSED', closed_at = now() where id = v_active.id;
  end if;

  insert into public.nutrition_calibrations
    (user_id, objective, baseline_date, cycle_start, baseline_weight_kg, baseline_waist_cm, calibration_version, start_request_id)
  values (p_user_id, p_objective, p_baseline_date, p_cycle_start, p_baseline_weight_kg, p_baseline_waist_cm, p_calibration_version, p_request_id)
  returning id into v_new_id;

  update public.user_profiles
    set ob_data = jsonb_set(coalesce(ob_data, '{}'::jsonb), '{peso}', to_jsonb(p_baseline_weight_kg), true),
        updated_at = now()
    where user_id = p_user_id;
  if not found then
    raise exception 'nutrition_server_start_calibration: perfil inexistente' using errcode = 'no_data_found';
  end if;

  return jsonb_build_object('status', 'STARTED', 'calibration_id', v_new_id, 'nutrition_weight_kg', p_baseline_weight_kg);
exception
  when check_violation or not_null_violation or foreign_key_violation then
    return jsonb_build_object('status', 'INVALID_PAYLOAD');
  when unique_violation then
    return jsonb_build_object('status', 'CONFLICT');
  when no_data_found then
    return jsonb_build_object('status', 'PROFILE_NOT_FOUND');
end $$;

revoke all on function public.nutrition_server_start_calibration(uuid, uuid, text, date, date, numeric, numeric, smallint) from public, anon, authenticated;
grant execute on function public.nutrition_server_start_calibration(uuid, uuid, text, date, date, numeric, numeric, smallint) to service_role;

create or replace function public.nutrition_calibrations_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status = 'CLOSED' then
    raise exception 'nutrition_calibrations: calibración cerrada' using errcode = 'check_violation';
  end if;
  if new.id <> old.id or new.user_id <> old.user_id or new.objective <> old.objective
     or new.cycle_start <> old.cycle_start or new.baseline_date <> old.baseline_date
     or new.baseline_weight_kg <> old.baseline_weight_kg
     or new.baseline_waist_cm is distinct from old.baseline_waist_cm
     or new.start_request_id <> old.start_request_id
     or new.calibration_version <> old.calibration_version or new.created_at <> old.created_at then
    raise exception 'nutrition_calibrations: identidad y línea base son inmutables' using errcode = 'check_violation';
  end if;
  return new;
end $$;

alter table public.nutrition_adaptive_checkins drop constraint nutrition_adaptive_checkins_reason_check;
alter table public.nutrition_adaptive_checkins add constraint nutrition_adaptive_checkins_reason_check check (reason in (
  'INSUFFICIENT_WINDOW','INSUFFICIENT_DATA','ADHERENCE_NOT_HIGH',
  'VERY_SLOW','BORDERLINE_SLOW_FIRST','BORDERLINE_SLOW_CONFIRMED','ON_TARGET',
  'DEFICIT_SYMPTOMS','FAST_FIRST','FAST_CONFIRMED','FAST_WITH_SYMPTOMS',
  'BELOW_TARGET','ABOVE_TARGET',
  'WITHIN_MAINTENANCE_BAND','BELOW_MAINTENANCE_BAND','ABOVE_MAINTENANCE_BAND','NEGATIVE_SIGNALS',
  'CONTRADICTORY_SIGNALS','PERFORMANCE_IMPROVING','PERFORMANCE_WORSE','NO_TRAINING_SIGNAL',
  'WAIST_IMPROVING','WAIST_WORSENING','NO_CLEAR_PROGRESS',
  'DIRECTION_REVERSAL_BLOCKED','CALIBRATION_LIMIT_REACHED'));

comment on column public.nutrition_calibrations.base_energy_kcal is null;
alter table public.nutrition_calibrations drop column base_energy_raw;

commit;
