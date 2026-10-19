-- ════════════════════════════════════════════════════════════════════
-- 20261015120000_nutrition_adaptive_server_authority.sql
-- ════════════════════════════════════════════════════════════════════
-- Purpose: ADAPTIVE NUTRITION · BLOQUE 2 — la autoridad de la calibración pasa
--          al servidor.
--
-- ANTES (MB4): dos RPC SECURITY DEFINER ejecutables por `authenticated`. El
-- cliente calculaba trayectoria y decisión y la RPC solo validaba forma/rango:
-- un cliente podía persistir cualquier decisión coherente.
--
-- AHORA: la ÚNICA vía de escritura es la Edge Function `nutrition-checkin`
-- (JWT → user_id), que recalcula MB1–MB3 con el motor compartido y llama a las
-- RPC de abajo con service_role. `authenticated` y `anon` no pueden ejecutarlas;
-- las RPC de MB4 se ELIMINAN (no quedan dos caminos de escritura).
--
-- Cambios de modelo (ENERGY_CALIBRATION_VERSION 2; las tablas no tienen filas):
--   · baseline_date: fecha real de la línea base; cycle_start = primer domingo
--     en o después de ella (CHECK). El check-in n vence en cycle_start + 14·n y
--     se acepta de 1 día antes a 6 días después (CHECK en la RPC).
--   · start_request_id / request_id: idempotencia por petición (doble clic,
--     reintento, respuesta perdida, dos pestañas).
--
-- SAFETY_FLOOR_REACHED NO se añade todavía: sin la capa energética no existe
-- cuándo dispararlo, y ningún contrato persistido lo necesita hoy.
--
-- NO toca: user_profiles · plan_goal · energy_snapshot · weight_log · energía.
-- Run en Supabase Dashboard → SQL Editor (ledger drifted). Falla si hay filas.
-- ════════════════════════════════════════════════════════════════════

begin;

-- ── 0 · Precondición: modelo v1 sin datos (las columnas nuevas son NOT NULL) ─
do $$ begin
  if exists (select 1 from public.nutrition_calibrations) or exists (select 1 from public.nutrition_adaptive_checkins) then
    raise exception 'Bloque 2: nutrition_calibrations / nutrition_adaptive_checkins deben estar vacías';
  end if;
end $$;

-- ── 1 · Cerrar el camino de escritura de MB4 ───────────────────────────────
drop function if exists public.nutrition_start_calibration(text, date, numeric, numeric, smallint);
drop function if exists public.nutrition_record_checkin(uuid, uuid, jsonb);

-- ── 2 · Modelo v2 ──────────────────────────────────────────────────────────
alter table public.nutrition_calibrations
  add column baseline_date date not null,
  add column start_request_id uuid not null,
  add constraint nutrition_calibrations_cycle_start_sunday check (extract(isodow from cycle_start) = 7),
  add constraint nutrition_calibrations_cycle_start_after_baseline check (cycle_start - baseline_date between 0 and 6),
  add constraint nutrition_calibrations_start_request unique (user_id, start_request_id);

alter table public.nutrition_adaptive_checkins
  add column request_id uuid not null,
  add constraint nutrition_adaptive_checkins_request unique (user_id, request_id);

-- Identidad, línea base y petición de origen son inmutables (amplía la guarda de MB4).
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

-- ── 3 · RPC server-only: abrir calibración ─────────────────────────────────
-- La Edge Function ya derivó objetivo (perfil), fechas y elegibilidad. Aquí:
-- replay por start_request_id → mismo resultado; activa con el mismo objetivo →
-- ALREADY_ACTIVE (no se reinicia); objetivo distinto → cierra y abre en step 0.
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
    return jsonb_build_object('status', 'STARTED', 'calibration_id', v_prev.id);
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

  return jsonb_build_object('status', 'STARTED', 'calibration_id', v_new_id);
exception
  when check_violation or not_null_violation or foreign_key_violation then
    return jsonb_build_object('status', 'INVALID_PAYLOAD');
  when unique_violation then
    return jsonb_build_object('status', 'CONFLICT');
end $$;

-- ── 4 · RPC server-only: registrar check-in (check-in + estado, atómico) ───
-- p_checkin es la fila que calculó la Edge Function. Replay por request_id →
-- el MISMO resultado. Bloquea la calibración, valida estado esperado, ventana de
-- ciclo, objetivo, paso y orden, inserta y avanza el estado en una transacción.
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
      'action', v_row.action, 'reason', v_row.reason, 'current_step', v_row.proposed_step);
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

  return jsonb_build_object('status', 'RECORDED', 'checkin_id', v_row.id, 'cycle_index', v_row.cycle_index,
    'action', v_row.action, 'reason', v_row.reason, 'current_step', v_row.proposed_step);
exception
  when unique_violation then
    return jsonb_build_object('status', 'DUPLICATE_CYCLE');
  when check_violation or not_null_violation or foreign_key_violation
    or invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow
    or invalid_datetime_format then
    return jsonb_build_object('status', 'INVALID_PAYLOAD');
end $$;

-- ── 5 · Grants: solo service_role ejecuta; los clientes solo leen lo suyo ──
revoke all on function public.nutrition_server_start_calibration(uuid, uuid, text, date, date, numeric, numeric, smallint) from public, anon, authenticated;
revoke all on function public.nutrition_server_record_checkin(uuid, uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.nutrition_server_start_calibration(uuid, uuid, text, date, date, numeric, numeric, smallint) to service_role;
grant execute on function public.nutrition_server_record_checkin(uuid, uuid, uuid, uuid, jsonb) to service_role;
revoke all on function public.nutrition_calibrations_guard() from public, anon, authenticated;

comment on table public.nutrition_calibrations is
  'Adaptive Nutrition · periodos de calibración (v2); la fila ACTIVE es el estado vigente. Escritura SOLO por la Edge Function nutrition-checkin (service_role). base_energy_kcal reservado: sin autoridad sobre energía.';
comment on table public.nutrition_adaptive_checkins is
  'Adaptive Nutrition · check-ins procesados, append-only. Calculados en servidor (MB1–MB3) por la Edge Function nutrition-checkin; escritura solo service_role.';

commit;
