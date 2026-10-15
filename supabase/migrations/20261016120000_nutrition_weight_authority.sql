-- ════════════════════════════════════════════════════════════════════
-- 20261016120000_nutrition_weight_authority.sql
-- ════════════════════════════════════════════════════════════════════
-- Purpose: ADAPTIVE NUTRITION · BLOQUE 4 — autoridad del peso nutricional.
--
-- `weight_log` pasa a ser SOLO historial (eso vive en el cliente). El peso
-- nutricional (`user_profiles.ob_data.peso`) lo fija el servidor en:
--   · nutrition_server_start_calibration  → el peso base declarado al abrir
--   · nutrition_server_record_checkin     → el peso declarado en el check-in
-- con una escritura ESTRECHA (`jsonb_set` de la clave `peso`, nunca el ob_data
-- completo) dentro de la MISMA transacción que la calibración / el check-in.
-- Si el perfil no existe, todo se revierte (PROFILE_NOT_FOUND).
--
-- Las respuestas devuelven `nutrition_weight_kg` (el peso efectivo) para que el
-- cliente lo aplique antes de cualquier upsert de ob_data. Un replay devuelve el
-- mismo peso SIN reescribirlo; ALREADY_ACTIVE no escribe.
--
-- Solo reemplaza el CUERPO de las dos RPC: mismas firmas, mismos grants
-- (CREATE OR REPLACE conserva los privilegios: solo service_role). No cambia
-- tablas, columnas, constraints ni RLS. No conecta current_step a kcal.
-- Run en Supabase Dashboard → SQL Editor (ledger drifted).
-- ════════════════════════════════════════════════════════════════════

begin;

create or replace function public.nutrition_server_start_calibration(
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

  -- BLOQUE 4 · el peso base declarado pasa a ser el peso nutricional. Escritura ESTRECHA:
  -- solo la clave `peso`; el resto de ob_data no se toca. Misma transacción que la calibración.
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

create or replace function public.nutrition_server_record_checkin(
  p_user_id uuid,
  p_request_id uuid,
  p_calibration_id uuid,
  p_expected_last_checkin_id uuid,
  p_checkin jsonb
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  v_cal public.nutrition_calibrations%rowtype;
  v_row public.nutrition_adaptive_checkins%rowtype;
  v_last public.nutrition_adaptive_checkins%rowtype;
  v_offset integer;
begin
  if p_user_id is null or p_request_id is null then
    return jsonb_build_object('status', 'INVALID_PAYLOAD');
  end if;

  select * into v_row from public.nutrition_adaptive_checkins
    where user_id = p_user_id and request_id = p_request_id;
  if found then
    return jsonb_build_object('status', 'RECORDED', 'checkin_id', v_row.id, 'cycle_index', v_row.cycle_index,
      'action', v_row.action, 'reason', v_row.reason, 'current_step', v_row.proposed_step,
      'nutrition_weight_kg', v_row.weight_kg);
  end if;

  select * into v_cal from public.nutrition_calibrations
    where id = p_calibration_id and user_id = p_user_id for update;
  if not found then
    return jsonb_build_object('status', 'NOT_FOUND');
  end if;
  if v_cal.status <> 'ACTIVE' then
    return jsonb_build_object('status', 'CALIBRATION_CLOSED');
  end if;

  v_row := jsonb_populate_record(null::public.nutrition_adaptive_checkins, p_checkin);
  v_row.id := gen_random_uuid();
  v_row.user_id := p_user_id;
  v_row.calibration_id := v_cal.id;
  v_row.request_id := p_request_id;
  v_row.created_at := now();

  if exists (select 1 from public.nutrition_adaptive_checkins where calibration_id = v_cal.id and cycle_index = v_row.cycle_index) then
    return jsonb_build_object('status', 'DUPLICATE_CYCLE');
  end if;
  if v_cal.last_checkin_id is distinct from p_expected_last_checkin_id then
    return jsonb_build_object('status', 'STALE_STATE');
  end if;
  if v_row.objective is distinct from v_cal.objective then
    return jsonb_build_object('status', 'OBJECTIVE_MISMATCH');
  end if;
  if v_row.previous_step is distinct from v_cal.current_step then
    return jsonb_build_object('status', 'STEP_MISMATCH');
  end if;

  -- ventana del ciclo: [cycle_start + 14·n − 1, cycle_start + 14·n + 6]
  v_offset := v_row.checkin_date - v_cal.cycle_start;
  if v_row.cycle_index is null or v_offset is null
     or v_offset < 14 * v_row.cycle_index - 1 or v_offset > 14 * v_row.cycle_index + 6 then
    return jsonb_build_object('status', 'OUT_OF_WINDOW');
  end if;

  select * into v_last from public.nutrition_adaptive_checkins where id = v_cal.last_checkin_id;
  if v_last.id is not null and (v_row.cycle_index <= v_last.cycle_index or v_row.checkin_date <= v_last.checkin_date) then
    return jsonb_build_object('status', 'OUT_OF_ORDER');
  end if;

  insert into public.nutrition_adaptive_checkins select v_row.*;

  update public.nutrition_calibrations set
    current_step = v_row.proposed_step,
    last_checkin_id = v_row.id,
    last_applied_action = case when v_row.action in ('STEP_UP','STEP_DOWN') then v_row.action else last_applied_action end,
    last_applied_at = case when v_row.action in ('STEP_UP','STEP_DOWN') then now() else last_applied_at end
  where id = v_cal.id;

  -- BLOQUE 4 · el peso declarado en el check-in pasa a ser el peso nutricional. Escritura
  -- ESTRECHA (solo `peso`), en la misma transacción que el check-in y el estado.
  update public.user_profiles
    set ob_data = jsonb_set(coalesce(ob_data, '{}'::jsonb), '{peso}', to_jsonb(v_row.weight_kg), true),
        updated_at = now()
    where user_id = p_user_id;
  if not found then
    raise exception 'nutrition_server_record_checkin: perfil inexistente' using errcode = 'no_data_found';
  end if;

  return jsonb_build_object('status', 'RECORDED', 'checkin_id', v_row.id, 'cycle_index', v_row.cycle_index,
    'action', v_row.action, 'reason', v_row.reason, 'current_step', v_row.proposed_step,
    'nutrition_weight_kg', v_row.weight_kg);
exception
  when unique_violation then
    return jsonb_build_object('status', 'DUPLICATE_CYCLE');
  when no_data_found then
    return jsonb_build_object('status', 'PROFILE_NOT_FOUND');
  when check_violation or not_null_violation or foreign_key_violation
    or invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow
    or invalid_datetime_format then
    return jsonb_build_object('status', 'INVALID_PAYLOAD');
end $$;

-- Defensa: los privilegios se conservan con CREATE OR REPLACE, pero se reafirman.
revoke all on function public.nutrition_server_start_calibration(uuid, uuid, text, date, date, numeric, numeric, smallint) from public, anon, authenticated;
revoke all on function public.nutrition_server_record_checkin(uuid, uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.nutrition_server_start_calibration(uuid, uuid, text, date, date, numeric, numeric, smallint) to service_role;
grant execute on function public.nutrition_server_record_checkin(uuid, uuid, uuid, uuid, jsonb) to service_role;

commit;
