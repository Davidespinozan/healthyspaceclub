-- ════════════════════════════════════════════════════════════════════
-- Tests de integración · 20261016120000_nutrition_weight_authority.sql
-- (sobre 20261014120000 y 20261015120000). Postgres DESECHABLE; nunca producción:
--   M=supabase/migrations; supabase/tests/run-local-pg.sh \
--     "$M/20261014120000_nutrition_adaptive_calibration.sql:$M/20261015120000_nutrition_adaptive_server_authority.sql:$M/20261016120000_nutrition_weight_authority.sql" \
--     supabase/tests/nutrition_weight_authority.test.sql
-- ════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
set client_min_messages = warning;

-- Stub mínimo de user_profiles (en producción ya existe con más columnas).
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
create or replace function t.payload(cycle int, d date, w numeric, prev_step int default 0) returns jsonb language sql as $$
  select jsonb_build_object(
    'cycle_index', cycle, 'checkin_date', d, 'objective', 'FAT_LOSS',
    'weight_kg', w, 'waist_cm', null, 'adherence_answer', 'PRACTICALLY_ALL', 'adherence_band', 'HIGH',
    'hunger', 'NORMAL', 'energy', 'NORMAL', 'performance', 'SAME', 'trains_strength', true,
    'strength_experience', null, 'recent_strength_continuity', null,
    'trajectory_sufficiency', 'SUFFICIENT_FOR_DECISION', 'previous_weight_kg', 82, 'elapsed_days', 17,
    'absolute_change_kg', w - 82, 'percent_change', -1, 'percent_change_per_week', -0.4, 'kg_per_month', -1.2,
    'trajectory_direction', 'DOWN', 'trajectory_classification', 'BORDERLINE_SLOW',
    'previous_waist_cm', null, 'waist_direction', null,
    'action', 'MAINTAIN', 'reason', 'BORDERLINE_SLOW_FIRST', 'previous_step', prev_step, 'proposed_step', prev_step,
    'blocked_action', null, 'blocked_reason', null,
    'trajectory_version', 1, 'checkin_domain_version', 1, 'adaptive_decision_version', 1)
$$;
grant execute on function t.payload(int, date, numeric, int) to service_role;

insert into auth.users (id) values
  ('aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002'),
  ('cccccccc-0000-0000-0000-000000000003');   -- C: sin fila de perfil
insert into public.user_profiles (user_id, ob_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '{"sex":"Hombre","goal":"Bajar grasa","edad":35,"estatura":178,"peso":82,"avoid":"lacteos","trainingModalities":"strength"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '{"sex":"Mujer","goal":"Bajar grasa","edad":40,"estatura":165,"peso":70}');
create table t.ids (k text primary key, v uuid);
grant all on t.ids to service_role;

-- authenticated sigue sin poder ejecutar las RPC (CREATE OR REPLACE conservó los grants)
do $$ begin
  perform t.ok(not has_function_privilege('authenticated', 'public.nutrition_server_start_calibration(uuid,uuid,text,date,date,numeric,numeric,smallint)', 'execute'), 'authenticated no ejecuta start');
  perform t.ok(not has_function_privilege('authenticated', 'public.nutrition_server_record_checkin(uuid,uuid,uuid,uuid,jsonb)', 'execute'), 'authenticated no ejecuta record');
  perform t.ok(has_function_privilege('service_role', 'public.nutrition_server_record_checkin(uuid,uuid,uuid,uuid,jsonb)', 'execute'), 'service_role ejecuta record');
end $$;

set role service_role;
do $$
declare r jsonb; r2 jsonb; cal uuid; c1 uuid; req uuid := gen_random_uuid(); reqc uuid := gen_random_uuid(); ob jsonb; n int;
  A uuid := 'aaaaaaaa-0000-0000-0000-000000000001'; B uuid := 'bbbbbbbb-0000-0000-0000-000000000002'; C uuid := 'cccccccc-0000-0000-0000-000000000003';
begin
  -- abrir: el peso base pasa a ser el peso nutricional; el resto de ob_data intacto
  r := public.nutrition_server_start_calibration(A, req, 'FAT_LOSS', '2026-10-01', '2026-10-04', 81.4, null, 2::smallint);
  perform t.ok(r->>'status' = 'STARTED' and (r->>'nutrition_weight_kg')::numeric = 81.4, 'start → STARTED con nutrition_weight_kg');
  cal := (r->>'calibration_id')::uuid;
  select ob_data into ob from public.user_profiles where user_id = A;
  perform t.ok((ob->>'peso')::numeric = 81.4, 'start fija ob_data.peso');
  perform t.ok(ob - 'peso' = '{"sex":"Hombre","goal":"Bajar grasa","edad":35,"estatura":178,"avoid":"lacteos","trainingModalities":"strength"}'::jsonb, 'start no pisa el resto de ob_data');
  select ob_data into ob from public.user_profiles where user_id = B;
  perform t.ok((ob->>'peso')::numeric = 70, 'el perfil de B no se toca');

  -- replay: mismo resultado y NO reescribe (aunque el perfil haya cambiado después)
  update public.user_profiles set ob_data = jsonb_set(ob_data, '{peso}', '80') where user_id = A;
  r2 := public.nutrition_server_start_calibration(A, req, 'FAT_LOSS', '2026-10-01', '2026-10-04', 81.4, null, 2::smallint);
  perform t.ok(r2 = r, 'replay de start → resultado idéntico');
  perform t.ok((select (ob_data->>'peso')::numeric from public.user_profiles where user_id = A) = 80, 'replay de start no reescribe el peso');
  -- ALREADY_ACTIVE no escribe
  r2 := public.nutrition_server_start_calibration(A, gen_random_uuid(), 'FAT_LOSS', '2026-10-02', '2026-10-04', 79, null, 2::smallint);
  perform t.ok(r2->>'status' = 'ALREADY_ACTIVE' and r2->'nutrition_weight_kg' is null, 'ALREADY_ACTIVE sin peso');
  perform t.ok((select (ob_data->>'peso')::numeric from public.user_profiles where user_id = A) = 80, 'ALREADY_ACTIVE no escribe el peso');

  -- check-in: el peso declarado pasa a ser el peso nutricional, en la misma transacción
  r := public.nutrition_server_record_checkin(A, reqc, cal, null, t.payload(1, '2026-10-18', 80.6));
  perform t.ok(r->>'status' = 'RECORDED' and (r->>'nutrition_weight_kg')::numeric = 80.6, 'check-in → RECORDED con nutrition_weight_kg');
  c1 := (r->>'checkin_id')::uuid;
  select ob_data into ob from public.user_profiles where user_id = A;
  perform t.ok((ob->>'peso')::numeric = 80.6, 'check-in fija ob_data.peso');
  perform t.ok(ob ? 'avoid' and ob->>'avoid' = 'lacteos' and ob->>'trainingModalities' = 'strength' and (ob->>'estatura')::int = 178, 'check-in no pisa el resto de ob_data');
  -- el peso no lo decide un user_id del payload: la escritura va a p_user_id (identidad de la Edge)
  perform t.ok((select (ob_data->>'peso')::numeric from public.user_profiles where user_id = B) = 70, 'el check-in de A no toca a B');

  -- replay del check-in: mismo resultado, sin reescribir
  update public.user_profiles set ob_data = jsonb_set(ob_data, '{peso}', '79.9') where user_id = A;
  perform t.ok(public.nutrition_server_record_checkin(A, reqc, cal, null, t.payload(1, '2026-10-18', 80.6)) = r, 'replay de check-in → resultado idéntico');
  perform t.ok((select (ob_data->>'peso')::numeric from public.user_profiles where user_id = A) = 79.9, 'replay de check-in no reescribe el peso');

  -- rechazos no escriben el peso
  perform t.ok(public.nutrition_server_record_checkin(A, gen_random_uuid(), cal, null, t.payload(2, '2026-11-01', 75))->>'status' = 'STALE_STATE', 'estado obsoleto');
  perform t.ok(public.nutrition_server_record_checkin(A, gen_random_uuid(), cal, c1, t.payload(2, '2026-11-01', 75) || '{"hunger":"X"}')->>'status' = 'INVALID_PAYLOAD', 'payload inválido');
  perform t.ok((select (ob_data->>'peso')::numeric from public.user_profiles where user_id = A) = 79.9, 'los rechazos no escriben el peso');

  -- sin perfil: todo se revierte (ni calibración ni check-in)
  r := public.nutrition_server_start_calibration(C, gen_random_uuid(), 'FAT_LOSS', '2026-10-01', '2026-10-04', 70, null, 2::smallint);
  perform t.ok(r->>'status' = 'PROFILE_NOT_FOUND', 'start sin perfil → PROFILE_NOT_FOUND');
  select count(*) into n from public.nutrition_calibrations where user_id = C;
  perform t.ok(n = 0, 'atomicidad: sin perfil no queda calibración');
end $$;
reset role;

-- check-in sin perfil: se crea la calibración con perfil y luego se borra el perfil → el check-in se revierte entero
do $$
declare r jsonb; cal uuid; n int; B uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
begin
  set local role service_role;
  r := public.nutrition_server_start_calibration(B, gen_random_uuid(), 'FAT_LOSS', '2026-10-01', '2026-10-04', 70, null, 2::smallint);
  cal := (r->>'calibration_id')::uuid;
  reset role;
  delete from public.user_profiles where user_id = B;
  set local role service_role;
  r := public.nutrition_server_record_checkin(B, gen_random_uuid(), cal, null, t.payload(1, '2026-10-18', 69));
  perform t.ok(r->>'status' = 'PROFILE_NOT_FOUND', 'check-in sin perfil → PROFILE_NOT_FOUND');
  select count(*) into n from public.nutrition_adaptive_checkins where user_id = B;
  perform t.ok(n = 0, 'atomicidad: sin perfil no queda check-in');
  perform t.ok((select current_step from public.nutrition_calibrations where id = cal) = 0 and (select last_checkin_id from public.nutrition_calibrations where id = cal) is null, 'atomicidad: el estado no avanzó');
  reset role;
end $$;

select 'ALL PASSED' as result;
