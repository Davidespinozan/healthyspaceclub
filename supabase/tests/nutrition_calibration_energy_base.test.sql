-- ════════════════════════════════════════════════════════════════════
-- Tests de integración · 20261017120000_nutrition_calibration_energy_base.sql (BORRADOR)
-- (sobre 20261014 → 20261015 → 20261016). Postgres DESECHABLE; nunca producción:
--   M=supabase/migrations; supabase/tests/run-local-pg.sh \
--     "$M/20261014120000_nutrition_adaptive_calibration.sql:$M/20261015120000_nutrition_adaptive_server_authority.sql:$M/20261016120000_nutrition_weight_authority.sql:$M/20261017120000_nutrition_calibration_energy_base.sql" \
--     supabase/tests/nutrition_calibration_energy_base.test.sql
-- ════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
set client_min_messages = warning;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ob_data jsonb,
  updated_at timestamptz
);

create schema if not exists t;
grant usage on schema t to service_role, authenticated;
create or replace function t.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', label; end if;
end $$;
grant execute on function t.ok(boolean, text) to service_role, authenticated;
-- check-in FAT_LOSS con la decisión indicada (forma de buildCheckinRecord)
create or replace function t.payload(cycle int, d date, w numeric, act text, rsn text, prev_step int, prop_step int,
  b_action text default null, b_reason text default null) returns jsonb language sql as $$
  select jsonb_build_object(
    'cycle_index', cycle, 'checkin_date', d, 'objective', 'FAT_LOSS',
    'weight_kg', w, 'waist_cm', null, 'adherence_answer', 'PRACTICALLY_ALL', 'adherence_band', 'HIGH',
    'hunger', 'NORMAL', 'energy', 'NORMAL', 'performance', 'SAME', 'trains_strength', true,
    'strength_experience', null, 'recent_strength_continuity', null,
    'trajectory_sufficiency', 'SUFFICIENT_FOR_DECISION', 'previous_weight_kg', 82, 'elapsed_days', 17,
    'absolute_change_kg', w - 82, 'percent_change', -0.1, 'percent_change_per_week', -0.05, 'kg_per_month', -0.2,
    'trajectory_direction', 'STABLE', 'trajectory_classification', 'VERY_SLOW',
    'previous_waist_cm', null, 'waist_direction', null,
    'action', act, 'reason', rsn, 'previous_step', prev_step, 'proposed_step', prop_step,
    'blocked_action', b_action, 'blocked_reason', b_reason,
    'trajectory_version', 1, 'checkin_domain_version', 1, 'adaptive_decision_version', 1)
$$;
grant execute on function t.payload(int, date, numeric, text, text, int, int, text, text) to service_role;

insert into auth.users (id) values ('aaaaaaaa-0000-0000-0000-000000000001'), ('bbbbbbbb-0000-0000-0000-000000000002');
insert into public.user_profiles (user_id, ob_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '{"sex":"Hombre","goal":"Bajar grasa","peso":82}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '{"sex":"Mujer","goal":"Bajar grasa","peso":70}');

-- schema y privilegios
do $$ begin
  perform t.ok(to_regprocedure('public.nutrition_server_start_calibration(uuid,uuid,text,date,date,numeric,numeric,smallint)') is null, 'la firma de 8 args ya no existe');
  perform t.ok(to_regprocedure('public.nutrition_server_start_calibration(uuid,uuid,text,date,date,numeric,numeric,smallint,numeric)') is not null, 'existe la firma de 9 args');
  perform t.ok(not has_function_privilege('authenticated', 'public.nutrition_server_start_calibration(uuid,uuid,text,date,date,numeric,numeric,smallint,numeric)', 'execute'), 'authenticated no ejecuta start');
  perform t.ok(not has_function_privilege('anon', 'public.nutrition_server_start_calibration(uuid,uuid,text,date,date,numeric,numeric,smallint,numeric)', 'execute'), 'anon no ejecuta start');
  perform t.ok(has_function_privilege('service_role', 'public.nutrition_server_start_calibration(uuid,uuid,text,date,date,numeric,numeric,smallint,numeric)', 'execute'), 'service_role ejecuta start');
  perform t.ok((select is_nullable = 'NO' and data_type = 'numeric' from information_schema.columns
    where table_schema = 'public' and table_name = 'nutrition_calibrations' and column_name = 'base_energy_raw'), 'base_energy_raw numeric NOT NULL');
end $$;

set role service_role;
do $$
declare r jsonb; r2 jsonb; cal uuid; c1 uuid; req uuid := gen_random_uuid(); n int; st int;
  A uuid := 'aaaaaaaa-0000-0000-0000-000000000001'; B uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
begin
  -- A · la base CRUDA se persiste exacta (sin redondear)
  r := public.nutrition_server_start_calibration(A, req, 'FAT_LOSS', '2026-10-01', '2026-10-04', 81.4, null, 2::smallint, 2473.371234);
  perform t.ok(r->>'status' = 'STARTED', 'start → STARTED');
  cal := (r->>'calibration_id')::uuid;
  perform t.ok((select base_energy_raw from public.nutrition_calibrations where id = cal) = 2473.371234, 'base cruda exacta');
  -- B · el entero no se escribe (sin autoridad)
  perform t.ok((select base_energy_kcal is null from public.nutrition_calibrations where id = cal), 'base_energy_kcal sigue NULL');

  -- replay: mismo resultado, la base no se reescribe
  r2 := public.nutrition_server_start_calibration(A, req, 'FAT_LOSS', '2026-10-01', '2026-10-04', 81.4, null, 2::smallint, 9999);
  perform t.ok(r2 = r, 'replay → resultado idéntico');
  perform t.ok((select base_energy_raw from public.nutrition_calibrations where id = cal) = 2473.371234, 'replay no reescribe la base');

  -- base inválida → INVALID_PAYLOAD y no se crea nada (usuario B sin calibración)
  perform t.ok(public.nutrition_server_start_calibration(B, gen_random_uuid(), 'FAT_LOSS', '2026-10-01', '2026-10-04', 70, null, 2::smallint, null)->>'status' = 'INVALID_PAYLOAD', 'base NULL rechazada');
  perform t.ok(public.nutrition_server_start_calibration(B, gen_random_uuid(), 'FAT_LOSS', '2026-10-01', '2026-10-04', 70, null, 2::smallint, 0)->>'status' = 'INVALID_PAYLOAD', 'base 0 rechazada');
  perform t.ok(public.nutrition_server_start_calibration(B, gen_random_uuid(), 'FAT_LOSS', '2026-10-01', '2026-10-04', 70, null, 2::smallint, 'NaN'::numeric)->>'status' = 'INVALID_PAYLOAD', 'base NaN rechazada');
  perform t.ok(public.nutrition_server_start_calibration(B, gen_random_uuid(), 'FAT_LOSS', '2026-10-01', '2026-10-04', 70, null, 2::smallint, 'Infinity'::numeric)->>'status' = 'INVALID_PAYLOAD', 'base Infinity rechazada');
  select count(*) into n from public.nutrition_calibrations where user_id = B;
  perform t.ok(n = 0, 'sin base válida no hay calibración');
  perform t.ok((select (ob_data->>'peso')::numeric from public.user_profiles where user_id = B) = 70, 'un rechazo no escribe el peso');

  -- D · suelo T1: REVIEW · SAFETY_FLOOR_REACHED, el paso no se mueve, sin last_applied
  r := public.nutrition_server_record_checkin(A, gen_random_uuid(), cal, null,
         t.payload(1, '2026-10-18', 81.3, 'REVIEW', 'SAFETY_FLOOR_REACHED', 0, 0, 'STEP_DOWN', 'VERY_SLOW'));
  perform t.ok(r->>'status' = 'RECORDED' and r->>'reason' = 'SAFETY_FLOOR_REACHED' and (r->>'current_step')::int = 0, 'SAFETY_FLOOR_REACHED se registra como REVIEW');
  c1 := (r->>'checkin_id')::uuid;
  select current_step into st from public.nutrition_calibrations where id = cal;
  perform t.ok(st = 0, 'el paso NO se mueve');
  perform t.ok((select last_applied_action is null and last_applied_at is null from public.nutrition_calibrations where id = cal), 'no cuenta como paso aplicado');
  perform t.ok((select blocked_action = 'STEP_DOWN' and blocked_reason = 'VERY_SLOW' from public.nutrition_adaptive_checkins where id = c1), 'conserva la bajada bloqueada y su razón');

  -- forma incoherente: SAFETY_FLOOR con el paso movido → rechazado por los CHECK existentes
  perform t.ok(public.nutrition_server_record_checkin(A, gen_random_uuid(), cal, c1,
         t.payload(2, '2026-11-01', 81.2, 'REVIEW', 'SAFETY_FLOOR_REACHED', 0, -1, 'STEP_DOWN', 'VERY_SLOW'))->>'status' = 'INVALID_PAYLOAD', 'REVIEW con paso movido → INVALID_PAYLOAD');
  perform t.ok(public.nutrition_server_record_checkin(A, gen_random_uuid(), cal, c1,
         t.payload(2, '2026-11-01', 81.2, 'REVIEW', 'NO_EXISTE', 0, 0))->>'status' = 'INVALID_PAYLOAD', 'reason desconocida → INVALID_PAYLOAD');

  -- E · una bajada válida sí mueve el paso (el CHECK nuevo no afecta lo demás)
  r := public.nutrition_server_record_checkin(A, gen_random_uuid(), cal, c1, t.payload(2, '2026-11-01', 81.2, 'STEP_DOWN', 'VERY_SLOW', 0, -1));
  perform t.ok(r->>'status' = 'RECORDED' and (r->>'current_step')::int = -1, 'STEP_DOWN válido → paso −1');

  -- base inmutable
  begin
    update public.nutrition_calibrations set base_energy_raw = 2000 where id = cal;
    perform t.ok(false, 'la base cruda debió ser inmutable');
  exception when check_violation then null;
  end;
  perform t.ok((select base_energy_raw from public.nutrition_calibrations where id = cal) = 2473.371234, 'base intacta tras intento de cambio');

  -- J · cambio de objetivo → nueva calibración con NUEVA base congelada; la anterior se cierra intacta
  r := public.nutrition_server_start_calibration(A, gen_random_uuid(), 'MAINTENANCE', '2026-11-05', '2026-11-08', 80.9, null, 2::smallint, 2890.5);
  perform t.ok(r->>'status' = 'STARTED', 'cambio de objetivo → STARTED');
  perform t.ok((select status = 'CLOSED' and base_energy_raw = 2473.371234 from public.nutrition_calibrations where id = cal), 'la anterior se cierra con su base');
  perform t.ok((select base_energy_raw = 2890.5 and current_step = 0 from public.nutrition_calibrations where id = (r->>'calibration_id')::uuid), 'la nueva tiene su propia base y paso 0');
end $$;
reset role;

select 'ALL PASSED' as result;
