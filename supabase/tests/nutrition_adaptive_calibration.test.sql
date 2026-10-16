-- ════════════════════════════════════════════════════════════════════
-- Tests de integración · 20261014120000_nutrition_adaptive_calibration.sql
--
-- Se ejecutan contra un Postgres DESECHABLE con stubs mínimos de Supabase
-- (roles anon/authenticated, auth.users, auth.uid()). Nunca contra producción.
--   supabase/tests/run-local-pg.sh
-- Cada aseveración falla con RAISE; al final imprime «ALL PASSED».
-- ════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
set client_min_messages = warning;

create schema if not exists t;
grant usage on schema t to anon, authenticated;
create or replace function t.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', label; end if;
end $$;
grant execute on function t.ok(boolean, text) to anon, authenticated;

-- Payload válido: FAT_LOSS ON_TARGET, MAINTAIN, paso 0 → 0. Se modifica con ||.
create or replace function t.payload(cycle int, d date, prev_step int default 0) returns jsonb language sql as $$
  select jsonb_build_object(
    'cycle_index', cycle, 'checkin_date', d, 'objective', 'FAT_LOSS',
    'weight_kg', 69.3, 'waist_cm', null, 'adherence_answer', 'PRACTICALLY_ALL', 'adherence_band', 'HIGH',
    'hunger', 'NORMAL', 'energy', 'NORMAL', 'performance', 'SAME', 'trains_strength', true,
    'strength_experience', null, 'recent_strength_continuity', null,
    'trajectory_sufficiency', 'SUFFICIENT_FOR_DECISION', 'previous_weight_kg', 70, 'elapsed_days', 14,
    'absolute_change_kg', -0.7, 'percent_change', -1, 'percent_change_per_week', -0.5, 'kg_per_month', -1.521875,
    'trajectory_direction', 'DOWN', 'trajectory_classification', 'ON_TARGET',
    'previous_waist_cm', null, 'waist_direction', null,
    'action', 'MAINTAIN', 'reason', 'ON_TARGET', 'previous_step', prev_step, 'proposed_step', prev_step,
    'blocked_action', null, 'blocked_reason', null,
    'trajectory_version', 1, 'checkin_domain_version', 1, 'adaptive_decision_version', 1)
$$;
grant execute on function t.payload(int, date, int) to authenticated;

insert into auth.users (id) values
  ('aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002');

create table t.ids (k text primary key, v uuid);
grant all on t.ids to authenticated;

-- ── Socio A ────────────────────────────────────────────────────────────────
set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare r jsonb; cal uuid; c1 uuid; c2 uuid; n int; s record;
begin
  -- abrir calibración + reintento idempotente
  r := public.nutrition_start_calibration('FAT_LOSS', '2026-10-04', 70, null, 1::smallint);
  perform t.ok(r->>'status' = 'STARTED', 'start → STARTED');
  cal := (r->>'calibration_id')::uuid;
  r := public.nutrition_start_calibration('FAT_LOSS', '2026-10-04', 70, null, 1::smallint);
  perform t.ok(r->>'status' = 'ALREADY_ACTIVE' and (r->>'calibration_id')::uuid = cal, 'reintento idéntico → ALREADY_ACTIVE, sin duplicar');
  select count(*) into n from public.nutrition_calibrations;
  perform t.ok(n = 1, 'una sola calibración tras el reintento');
  select * into s from public.nutrition_calibrations where id = cal;
  perform t.ok(s.current_step = 0 and s.status = 'ACTIVE' and s.baseline_weight_kg = 70, 'estado inicial step 0');

  -- payload inválido: nada se escribe (enum, paso fuera de rango, acción/paso incoherentes, recomp sin cintura)
  perform t.ok(public.nutrition_record_checkin(cal, null, t.payload(1, '2026-10-18') || '{"hunger":"X"}')->>'status' = 'INVALID_PAYLOAD', 'enum inválido rechazado');
  perform t.ok(public.nutrition_record_checkin(cal, null, t.payload(1, '2026-10-18') || '{"weight_kg":"abc"}')->>'status' = 'INVALID_PAYLOAD', 'tipo inválido rechazado');
  perform t.ok(public.nutrition_record_checkin(cal, null, t.payload(1, '2026-10-18') || '{"action":"STEP_UP"}')->>'status' = 'INVALID_PAYLOAD', 'STEP_UP sin mover el paso rechazado');
  perform t.ok(public.nutrition_record_checkin(cal, null, t.payload(1, '2026-10-18') || '{"action":"STEP_UP","proposed_step":3}')->>'status' = 'INVALID_PAYLOAD', 'paso propuesto fuera de −2…+2 rechazado');
  perform t.ok(public.nutrition_record_checkin(cal, null, t.payload(1, '2026-10-18') || '{"trajectory_classification":"BELOW_TARGET"}')->>'status' = 'INVALID_PAYLOAD', 'clasificación ajena al objetivo rechazada');
  perform t.ok(public.nutrition_record_checkin(cal, null, t.payload(1, '2026-10-18') || '{"blocked_action":"STEP_UP"}')->>'status' = 'INVALID_PAYLOAD', 'paso bloqueado sin REVIEW ni razón rechazado');
  perform t.ok(public.nutrition_record_checkin(cal, null, t.payload(1, '2026-10-18') - 'adherence_answer')->>'status' = 'INVALID_PAYLOAD', 'campo requerido ausente rechazado');
  select count(*) into n from public.nutrition_adaptive_checkins;
  select * into s from public.nutrition_calibrations where id = cal;
  perform t.ok(n = 0 and s.last_checkin_id is null and s.current_step = 0, 'atomicidad: ningún rechazo dejó check-in ni movió el estado');

  -- orden y coherencia con el estado
  perform t.ok(public.nutrition_record_checkin(cal, null, t.payload(1, '2026-10-04'))->>'status' = 'OUT_OF_ORDER', 'check-in no posterior a la línea base');
  perform t.ok(public.nutrition_record_checkin(cal, null, t.payload(1, '2026-10-18', 1) || '{"proposed_step":1}')->>'status' = 'STEP_MISMATCH', 'previous_step ≠ estado');
  perform t.ok(public.nutrition_record_checkin(cal, null, t.payload(1, '2026-10-18') || '{"objective":"MAINTENANCE","trajectory_classification":"WITHIN_MAINTENANCE_BAND"}')->>'status' = 'OBJECTIVE_MISMATCH', 'objetivo ≠ calibración');

  -- ciclo 1: round-trip; user_id del payload ignorado
  r := public.nutrition_record_checkin(cal, null, t.payload(1, '2026-10-18') || '{"user_id":"bbbbbbbb-0000-0000-0000-000000000002","id":"00000000-0000-0000-0000-000000000009"}');
  perform t.ok(r->>'status' = 'RECORDED', 'ciclo 1 → RECORDED');
  c1 := (r->>'checkin_id')::uuid;
  select * into s from public.nutrition_adaptive_checkins where id = c1;
  perform t.ok(s.user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and s.id <> '00000000-0000-0000-0000-000000000009', 'user_id/id los pone el servidor, no el cliente');
  perform t.ok(s.weight_kg = 69.3 and s.waist_cm is null and s.adherence_band = 'HIGH' and s.trajectory_classification = 'ON_TARGET'
    and s.percent_change_per_week = -0.5 and s.reason = 'ON_TARGET', 'round-trip de campos; cintura nullable en FAT_LOSS');
  select * into s from public.nutrition_calibrations where id = cal;
  perform t.ok(s.last_checkin_id = c1 and s.current_step = 0 and s.last_applied_action is null, 'estado apunta al check-in; MAINTAIN no es paso aplicado');

  -- doble clic / reintento y estado obsoleto
  perform t.ok(public.nutrition_record_checkin(cal, null, t.payload(1, '2026-10-18'))->>'status' = 'DUPLICATE_CYCLE', 'mismo ciclo → DUPLICATE_CYCLE');
  perform t.ok(public.nutrition_record_checkin(cal, null, t.payload(2, '2026-11-01'))->>'status' = 'STALE_STATE', 'expected_last obsoleto → STALE_STATE');

  -- ciclo 2: STEP_DOWN aplicado
  r := public.nutrition_record_checkin(cal, c1, t.payload(2, '2026-11-01')
        || '{"trajectory_classification":"VERY_SLOW","action":"STEP_DOWN","reason":"VERY_SLOW","proposed_step":-1}');
  perform t.ok(r->>'status' = 'RECORDED' and (r->>'current_step')::int = -1, 'ciclo 2 STEP_DOWN → step −1');
  c2 := (r->>'checkin_id')::uuid;
  select * into s from public.nutrition_calibrations where id = cal;
  perform t.ok(s.current_step = -1 and s.last_applied_action = 'STEP_DOWN' and s.last_applied_at is not null and s.last_checkin_id = c2, 'paso aplicado registrado');
  perform t.ok(public.nutrition_record_checkin(cal, c2, t.payload(3, '2026-10-25', -1))->>'status' = 'OUT_OF_ORDER', 'fecha anterior al último check-in');

  -- ciclo 4 (el 3 se saltó): hueco permitido; REVIEW con paso bloqueado
  r := public.nutrition_record_checkin(cal, c2, t.payload(4, '2026-11-29', -1)
        || '{"trajectory_classification":"FAST","action":"REVIEW","reason":"DIRECTION_REVERSAL_BLOCKED","blocked_action":"STEP_UP","blocked_reason":"FAST_WITH_SYMPTOMS","hunger":"HIGH"}');
  perform t.ok(r->>'status' = 'RECORDED', 'ciclo saltado deja hueco; REVIEW con paso bloqueado');
  select * into s from public.nutrition_calibrations where id = cal;
  perform t.ok(s.current_step = -1 and s.last_applied_action = 'STEP_DOWN', 'REVIEW no mueve el paso ni el último paso aplicado');

  -- lecturas para MB3: anterior y dos ciclos atrás
  select cycle_index into n from public.nutrition_adaptive_checkins where calibration_id = cal order by cycle_index desc limit 1;
  perform t.ok(n = 4, 'check-in anterior = el de mayor cycle_index');
  select count(*) into n from public.nutrition_adaptive_checkins where calibration_id = cal and cycle_index = 4 - 2;
  perform t.ok(n = 1, 'dos ciclos atrás se lee por cycle_index');

  -- escritura directa prohibida
  begin
    insert into public.nutrition_adaptive_checkins (user_id, calibration_id) values (auth.uid(), cal);
    perform t.ok(false, 'insert directo debería fallar');
  exception when insufficient_privilege then null; end;
  begin
    update public.nutrition_calibrations set current_step = 2 where id = cal;
    perform t.ok(false, 'update directo debería fallar');
  exception when insufficient_privilege then null; end;
  begin
    delete from public.nutrition_adaptive_checkins where id = c1;
    perform t.ok(false, 'delete directo debería fallar');
  exception when insufficient_privilege then null; end;

  -- cambio de objetivo: cierra la activa, abre otra en step 0, historia intacta
  r := public.nutrition_start_calibration('RECOMPOSITION', '2026-12-06', 69, 88, 1::smallint);
  perform t.ok(r->>'status' = 'STARTED' and (r->>'closed_calibration_id')::uuid = cal, 'nuevo objetivo → STARTED y cierra la anterior');
  insert into t.ids values ('calA_old', cal), ('calA_new', (r->>'calibration_id')::uuid);
  select * into s from public.nutrition_calibrations where id = cal;
  perform t.ok(s.status = 'CLOSED' and s.closed_at is not null and s.current_step = -1, 'calibración anterior cerrada conserva su paso');
  select * into s from public.nutrition_calibrations where status = 'ACTIVE';
  perform t.ok(s.objective = 'RECOMPOSITION' and s.current_step = 0 and s.baseline_waist_cm = 88, 'nueva activa con step 0 y cintura base');
  select count(*) into n from public.nutrition_adaptive_checkins where calibration_id = cal;
  perform t.ok(n = 3, 'check-ins del objetivo anterior preservados');
  perform t.ok(public.nutrition_record_checkin(cal, c2, t.payload(5, '2026-12-13', -1))->>'status' = 'CALIBRATION_CLOSED', 'no se escribe en una calibración cerrada');

  -- requisitos por objetivo: recomp exige cintura
  perform t.ok(public.nutrition_record_checkin(s.id, null, t.payload(1, '2026-12-20') || '{"objective":"RECOMPOSITION","trajectory_classification":"RELATIVELY_STABLE"}')->>'status' = 'INVALID_PAYLOAD', 'recomp sin cintura rechazado');
  r := public.nutrition_record_checkin(s.id, null, t.payload(1, '2026-12-20') || '{"objective":"RECOMPOSITION","trajectory_sufficiency":"INSUFFICIENT_WINDOW","trajectory_classification":null,"waist_cm":87.5,"previous_waist_cm":88,"waist_direction":"SAME","action":"NO_ADJUSTMENT","reason":"INSUFFICIENT_WINDOW"}');
  perform t.ok(r->>'status' = 'RECORDED', 'recomp con cintura e INSUFFICIENT_WINDOW → RECORDED');
end $$;

-- ── Socio B: no ve ni toca lo de A ─────────────────────────────────────────
set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';
do $$
declare n int; cal uuid;
begin
  select count(*) into n from public.nutrition_calibrations;
  perform t.ok(n = 0, 'B no lee calibraciones de A');
  select count(*) into n from public.nutrition_adaptive_checkins;
  perform t.ok(n = 0, 'B no lee check-ins de A');
  select v into cal from t.ids where k = 'calA_new';
  perform t.ok(public.nutrition_record_checkin(cal, null, t.payload(2, '2027-01-03'))->>'status' = 'NOT_FOUND', 'B no escribe en la calibración de A');
  perform t.ok(public.nutrition_start_calibration('FAT_LOSS', '2026-10-04', 80, null, 1::smallint)->>'status' = 'STARTED', 'B abre la suya');
  select count(*) into n from public.nutrition_calibrations;
  perform t.ok(n = 1, 'B ve solo su calibración');
end $$;

-- ── anon: sin acceso ───────────────────────────────────────────────────────
reset role;
set role anon;
do $$
begin
  begin
    perform public.nutrition_start_calibration('FAT_LOSS', '2026-10-04', 70, null, 1::smallint);
    perform t.ok(false, 'anon no ejecuta la RPC');
  exception when insufficient_privilege then null; end;
  begin
    perform count(*) from public.nutrition_adaptive_checkins;
    perform t.ok(false, 'anon no lee check-ins');
  exception when insufficient_privilege then null; end;
end $$;

-- ── authenticated sin sesión (auth.uid() NULL) ─────────────────────────────
reset role;
set role authenticated;
set request.jwt.claim.sub = '';
do $$ begin
  perform t.ok(public.nutrition_start_calibration('FAT_LOSS', '2026-10-04', 70, null, 1::smallint)->>'status' = 'NOT_AUTHENTICATED', 'sin uid → NOT_AUTHENTICATED');
end $$;

-- ── Superusuario: inmutabilidad y cascada ──────────────────────────────────
reset role;
do $$
declare n int; cal uuid;
begin
  begin
    update public.nutrition_adaptive_checkins set hunger = 'LOW';
    perform t.ok(false, 'update de check-in debería fallar (append-only)');
  exception when check_violation then null; end;
  select v into cal from t.ids where k = 'calA_old';
  begin
    update public.nutrition_calibrations set current_step = 0 where id = cal;
    perform t.ok(false, 'update de calibración cerrada debería fallar');
  exception when check_violation then null; end;
  select v into cal from t.ids where k = 'calA_new';
  begin
    update public.nutrition_calibrations set baseline_weight_kg = 50 where id = cal;
    perform t.ok(false, 'línea base inmutable');
  exception when check_violation then null; end;
  begin
    insert into public.nutrition_calibrations (user_id, objective, cycle_start, baseline_weight_kg, calibration_version)
      values ('aaaaaaaa-0000-0000-0000-000000000001', 'MAINTENANCE', '2027-01-01', 70, 1);
    perform t.ok(false, 'segunda calibración ACTIVE debería fallar');
  exception when unique_violation then null; end;

  delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  select count(*) into n from public.nutrition_calibrations where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  perform t.ok(n = 0, 'borrar la cuenta borra sus calibraciones (cascada)');
  select count(*) into n from public.nutrition_adaptive_checkins where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  perform t.ok(n = 0, 'borrar la cuenta borra sus check-ins (cascada)');
  select count(*) into n from public.nutrition_calibrations;
  perform t.ok(n = 1, 'la calibración de B sobrevive');
end $$;

select 'ALL PASSED' as result;
