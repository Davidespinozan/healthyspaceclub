-- ════════════════════════════════════════════════════════════════════
-- Tests de integración · 20261015120000_nutrition_adaptive_server_authority.sql
-- (aplicada SOBRE 20261014120000_nutrition_adaptive_calibration.sql)
--
-- Postgres DESECHABLE con stubs de Supabase. Nunca contra producción:
--   supabase/tests/run-local-pg.sh \
--     supabase/migrations/20261014120000_nutrition_adaptive_calibration.sql:supabase/migrations/20261015120000_nutrition_adaptive_server_authority.sql \
--     supabase/tests/nutrition_adaptive_server_authority.test.sql
-- ════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
set client_min_messages = warning;

create schema if not exists t;
grant usage on schema t to anon, authenticated, service_role;
create or replace function t.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', label; end if;
end $$;
grant execute on function t.ok(boolean, text) to anon, authenticated, service_role;

-- Fila calculada por la Edge Function: FAT_LOSS ON_TARGET, MAINTAIN, paso prev → prev.
create or replace function t.payload(cycle int, d date, prev_step int default 0) returns jsonb language sql as $$
  select jsonb_build_object(
    'cycle_index', cycle, 'checkin_date', d, 'objective', 'FAT_LOSS',
    'weight_kg', 69.3, 'waist_cm', null, 'adherence_answer', 'PRACTICALLY_ALL', 'adherence_band', 'HIGH',
    'hunger', 'NORMAL', 'energy', 'NORMAL', 'performance', 'SAME', 'trains_strength', true,
    'strength_experience', null, 'recent_strength_continuity', null,
    'trajectory_sufficiency', 'SUFFICIENT_FOR_DECISION', 'previous_weight_kg', 70, 'elapsed_days', 17,
    'absolute_change_kg', -0.7, 'percent_change', -1, 'percent_change_per_week', -0.411765, 'kg_per_month', -1.253309,
    'trajectory_direction', 'DOWN', 'trajectory_classification', 'BORDERLINE_SLOW',
    'previous_waist_cm', null, 'waist_direction', null,
    'action', 'MAINTAIN', 'reason', 'BORDERLINE_SLOW_FIRST', 'previous_step', prev_step, 'proposed_step', prev_step,
    'blocked_action', null, 'blocked_reason', null,
    'trajectory_version', 1, 'checkin_domain_version', 1, 'adaptive_decision_version', 1)
$$;
grant execute on function t.payload(int, date, int) to service_role;

insert into auth.users (id) values
  ('aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002');
create table t.ids (k text primary key, v uuid);
grant all on t.ids to service_role, authenticated;

-- ── El camino de MB4 ya no existe; los clientes no ejecutan las RPC nuevas ──
do $$ begin
  perform t.ok(to_regprocedure('public.nutrition_start_calibration(text,date,numeric,numeric,smallint)') is null, 'RPC start de MB4 eliminada');
  perform t.ok(to_regprocedure('public.nutrition_record_checkin(uuid,uuid,jsonb)') is null, 'RPC record de MB4 eliminada');
  perform t.ok(not has_function_privilege('authenticated', 'public.nutrition_server_start_calibration(uuid,uuid,text,date,date,numeric,numeric,smallint)', 'execute'), 'authenticated no ejecuta start');
  perform t.ok(not has_function_privilege('authenticated', 'public.nutrition_server_record_checkin(uuid,uuid,uuid,uuid,jsonb)', 'execute'), 'authenticated no ejecuta record');
  perform t.ok(not has_function_privilege('anon', 'public.nutrition_server_record_checkin(uuid,uuid,uuid,uuid,jsonb)', 'execute'), 'anon no ejecuta record');
  perform t.ok(has_function_privilege('service_role', 'public.nutrition_server_record_checkin(uuid,uuid,uuid,uuid,jsonb)', 'execute'), 'service_role ejecuta record');
end $$;

set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$ begin
  begin
    perform public.nutrition_server_start_calibration('aaaaaaaa-0000-0000-0000-000000000001', gen_random_uuid(), 'FAT_LOSS', '2026-10-01', '2026-10-04', 70, null, 2::smallint);
    perform t.ok(false, 'authenticated llamó a la RPC de mutación');
  exception when insufficient_privilege then null; end;
  begin
    perform public.nutrition_server_record_checkin('aaaaaaaa-0000-0000-0000-000000000001', gen_random_uuid(), gen_random_uuid(), null, '{}'::jsonb);
    perform t.ok(false, 'authenticated llamó a record');
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role anon;
do $$ begin
  begin
    perform public.nutrition_server_start_calibration('aaaaaaaa-0000-0000-0000-000000000001', gen_random_uuid(), 'FAT_LOSS', '2026-10-01', '2026-10-04', 70, null, 2::smallint);
    perform t.ok(false, 'anon llamó a la RPC de mutación');
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── service_role (Edge Function) ───────────────────────────────────────────
set role service_role;
do $$
declare r jsonb; r2 jsonb; cal uuid; c1 uuid; req1 uuid := gen_random_uuid(); reqc1 uuid := gen_random_uuid(); n int; s record;
  A uuid := 'aaaaaaaa-0000-0000-0000-000000000001'; B uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
begin
  -- abrir: invariantes de calendario
  perform t.ok(public.nutrition_server_start_calibration(A, gen_random_uuid(), 'FAT_LOSS', '2026-10-01', '2026-10-05', 70, null, 2::smallint)->>'status' = 'INVALID_PAYLOAD', 'cycle_start que no es domingo');
  perform t.ok(public.nutrition_server_start_calibration(A, gen_random_uuid(), 'FAT_LOSS', '2026-09-20', '2026-10-04', 70, null, 2::smallint)->>'status' = 'INVALID_PAYLOAD', 'línea base a más de 6 días del domingo');
  r := public.nutrition_server_start_calibration(A, req1, 'FAT_LOSS', '2026-10-01', '2026-10-04', 70, null, 2::smallint);
  perform t.ok(r->>'status' = 'STARTED', 'start → STARTED');
  cal := (r->>'calibration_id')::uuid;
  perform t.ok(public.nutrition_server_start_calibration(A, req1, 'FAT_LOSS', '2026-10-01', '2026-10-04', 70, null, 2::smallint) = r, 'replay del mismo requestId → mismo resultado');
  r2 := public.nutrition_server_start_calibration(A, gen_random_uuid(), 'FAT_LOSS', '2026-10-02', '2026-10-04', 71, null, 2::smallint);
  perform t.ok(r2->>'status' = 'ALREADY_ACTIVE' and (r2->>'calibration_id')::uuid = cal, 'otra pestaña, mismo objetivo → ALREADY_ACTIVE (no reinicia)');
  select count(*) into n from public.nutrition_calibrations where user_id = A;
  perform t.ok(n = 1, 'una sola calibración');
  select * into s from public.nutrition_calibrations where id = cal;
  perform t.ok(s.current_step = 0 and s.baseline_date = '2026-10-01' and s.cycle_start = '2026-10-04' and s.start_request_id = req1, 'estado inicial');

  -- check-in: ventana, estado esperado, atomicidad
  perform t.ok(public.nutrition_server_record_checkin(A, gen_random_uuid(), cal, null, t.payload(1, '2026-10-16'))->>'status' = 'OUT_OF_WINDOW', 'antes de la ventana (vence 18, abre 17)');
  perform t.ok(public.nutrition_server_record_checkin(A, gen_random_uuid(), cal, null, t.payload(1, '2026-10-25'))->>'status' = 'OUT_OF_WINDOW', 'después de la ventana (cierra 24)');
  perform t.ok(public.nutrition_server_record_checkin(A, gen_random_uuid(), cal, null, t.payload(1, '2026-10-18') || '{"hunger":"X"}')->>'status' = 'INVALID_PAYLOAD', 'payload inválido');
  perform t.ok(public.nutrition_server_record_checkin(A, gen_random_uuid(), cal, null, t.payload(1, '2026-10-18', 1) || '{"proposed_step":1}')->>'status' = 'STEP_MISMATCH', 'paso ≠ estado');
  perform t.ok(public.nutrition_server_record_checkin(B, gen_random_uuid(), cal, null, t.payload(1, '2026-10-18'))->>'status' = 'NOT_FOUND', 'B no opera la calibración de A');
  select count(*) into n from public.nutrition_adaptive_checkins;
  perform t.ok(n = 0, 'atomicidad: ningún rechazo escribió');

  r := public.nutrition_server_record_checkin(A, reqc1, cal, null, t.payload(1, '2026-10-17') || '{"user_id":"bbbbbbbb-0000-0000-0000-000000000002","request_id":"00000000-0000-0000-0000-000000000009"}');
  perform t.ok(r->>'status' = 'RECORDED' and (r->>'cycle_index')::int = 1 and r->>'action' = 'MAINTAIN' and (r->>'current_step')::int = 0, 'ciclo 1 (1 día antes) → RECORDED');
  c1 := (r->>'checkin_id')::uuid;
  select * into s from public.nutrition_adaptive_checkins where id = c1;
  perform t.ok(s.user_id = A and s.request_id = reqc1, 'user_id y request_id los pone el servidor, no el payload');

  -- idempotencia: respuesta perdida / doble clic / dos pestañas
  perform t.ok(public.nutrition_server_record_checkin(A, reqc1, cal, null, t.payload(1, '2026-10-17')) = r, 'replay mismo requestId → resultado idéntico');
  perform t.ok(public.nutrition_server_record_checkin(A, reqc1, cal, c1, t.payload(2, '2026-11-01')) = r, 'replay aunque cambie el payload → el resultado original');
  perform t.ok(public.nutrition_server_record_checkin(A, gen_random_uuid(), cal, null, t.payload(1, '2026-10-18'))->>'status' = 'DUPLICATE_CYCLE', 'otra pestaña, mismo ciclo → DUPLICATE_CYCLE');
  perform t.ok(public.nutrition_server_record_checkin(A, gen_random_uuid(), cal, null, t.payload(2, '2026-11-01'))->>'status' = 'STALE_STATE', 'estado esperado obsoleto → STALE_STATE');
  select count(*) into n from public.nutrition_adaptive_checkins;
  perform t.ok(n = 1, 'sigue habiendo un solo check-in');

  -- ciclo saltado (3 → hueco desde el 1); STEP_DOWN avanza el estado
  r := public.nutrition_server_record_checkin(A, gen_random_uuid(), cal, c1, t.payload(3, '2026-11-15')
         || '{"trajectory_classification":"VERY_SLOW","action":"STEP_DOWN","reason":"VERY_SLOW","proposed_step":-1}');
  perform t.ok(r->>'status' = 'RECORDED' and (r->>'current_step')::int = -1, 'ciclo saltado permitido; STEP_DOWN → −1');
  select * into s from public.nutrition_calibrations where id = cal;
  perform t.ok(s.current_step = -1 and s.last_applied_action = 'STEP_DOWN' and s.last_checkin_id = (r->>'checkin_id')::uuid, 'estado avanzado');
  insert into t.ids values ('calA_fat', cal);

  -- request_id es único POR socio: B puede usar el mismo valor
  r := public.nutrition_server_start_calibration(B, req1, 'MAINTENANCE', '2026-10-04', '2026-10-04', 80, null, 2::smallint);
  perform t.ok(r->>'status' = 'STARTED' and (r->>'calibration_id')::uuid <> cal, 'mismo requestId de otro socio → su propia calibración');

  -- cambio de objetivo: cierra, abre en step 0; la cerrada no admite check-ins
  r := public.nutrition_server_start_calibration(A, gen_random_uuid(), 'RECOMPOSITION', '2026-11-20', '2026-11-22', 69, 88, 2::smallint);
  perform t.ok(r->>'status' = 'STARTED', 'nuevo objetivo → STARTED');
  select * into s from public.nutrition_calibrations where id = cal;
  perform t.ok(s.status = 'CLOSED' and s.current_step = -1, 'la anterior queda cerrada con su paso');
  select * into s from public.nutrition_calibrations where user_id = A and status = 'ACTIVE';
  perform t.ok(s.objective = 'RECOMPOSITION' and s.current_step = 0, 'la nueva arranca en 0');
  perform t.ok(public.nutrition_server_record_checkin(A, gen_random_uuid(), cal, (select last_checkin_id from public.nutrition_calibrations where id = cal), t.payload(4, '2026-11-29', -1))->>'status' = 'CALIBRATION_CLOSED', 'calibración cerrada');
  perform t.ok(public.nutrition_server_record_checkin(A, gen_random_uuid(), s.id, null, t.payload(1, '2026-12-06'))->>'status' = 'OBJECTIVE_MISMATCH', 'objetivo del payload ≠ calibración');
end $$;
reset role;

-- ── Lectura: cada socio solo lo suyo ───────────────────────────────────────
set role authenticated;
set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';
do $$ declare n int; begin
  select count(*) into n from public.nutrition_calibrations;
  perform t.ok(n = 1, 'B ve solo su calibración');
  select count(*) into n from public.nutrition_adaptive_checkins;
  perform t.ok(n = 0, 'B no ve check-ins de A');
  begin
    insert into public.nutrition_adaptive_checkins (user_id) values (auth.uid());
    perform t.ok(false, 'insert directo de authenticated');
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Inmutabilidad (superusuario) ───────────────────────────────────────────
do $$ declare cal uuid; begin
  select id into cal from public.nutrition_calibrations where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and status = 'ACTIVE';
  begin
    update public.nutrition_calibrations set start_request_id = gen_random_uuid() where id = cal;
    perform t.ok(false, 'start_request_id inmutable');
  exception when check_violation then null; end;
  begin
    update public.nutrition_calibrations set baseline_date = '2026-11-21' where id = cal;
    perform t.ok(false, 'baseline_date inmutable');
  exception when check_violation then null; end;
  begin
    update public.nutrition_adaptive_checkins set request_id = gen_random_uuid();
    perform t.ok(false, 'check-ins append-only');
  exception when check_violation then null; end;
end $$;

select 'ALL PASSED' as result;
