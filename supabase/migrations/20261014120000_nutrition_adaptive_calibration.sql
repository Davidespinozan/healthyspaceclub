-- ════════════════════════════════════════════════════════════════════
-- 20261014120000_nutrition_adaptive_calibration.sql
-- ════════════════════════════════════════════════════════════════════
-- Purpose: ADAPTIVE NUTRITION · MICROBLOQUE 4 — persistencia del check-in
--          quincenal y del estado de calibración.
--
-- SOLO PERSISTENCIA. Nadie lee estas tablas para decidir energía: no tocan
-- plan_goal, energy_snapshot, ob_data, weekly_plan ni weight_log. El motor
-- (MB1–MB3) no está conectado a ningún usuario todavía.
--
-- MODELO
--   nutrition_calibrations      · un PERIODO de calibración por fila. La fila
--                                 ACTIVE es el estado vigente (una por socio,
--                                 índice único parcial). Cambiar de objetivo
--                                 CIERRA la activa y abre otra con step 0; las
--                                 cerradas quedan como historia inmutable.
--                                 La línea base (fecha, peso, cintura) se
--                                 congela al abrir: el ciclo 1 se compara con ella.
--   nutrition_adaptive_checkins · append-only. Una fila = un check-in ya
--                                 procesado: respuestas declaradas + trayectoria
--                                 + decisión, tal como HSC las conoció ese día.
--
-- CICLO: lo identifica (calibration_id, cycle_index). El caller calcula
-- cycle_index desde cycle_start por calendario (14 días, alineado a domingo);
-- un check-in saltado deja un hueco. Los dos ciclos atrás se leen del historial.
--
-- ESCRITURA: SOLO por las RPC SECURITY DEFINER de abajo, que derivan el socio
-- de auth.uid() (nunca de un user_id del cliente) y escriben check-in + estado
-- en UNA transacción. Para el cliente las tablas son de solo lectura (RLS own).
-- Borrado de cuenta: ON DELETE CASCADE desde auth.users, como el resto.
--
-- Valores derivados que se CONGELAN a propósito (no se recalculan al leer):
--   adherence_band, métricas de trayectoria, clasificación, waist_direction,
--   previous_weight_kg / previous_waist_cm y la decisión. Dependen de reglas
--   versionadas (bandas, umbrales, tolerancia ±0.5 cm); recalcularlos con la
--   versión de mañana reescribiría lo que HSC sabía ayer.
--
-- Run en Supabase Dashboard → SQL Editor (ledger drifted). Solo crea objetos
-- nuevos; no modifica tablas existentes.
-- ════════════════════════════════════════════════════════════════════

begin;

-- ── 1 · Periodos de calibración (estado vigente = fila ACTIVE) ─────────────
create table if not exists public.nutrition_calibrations (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  objective           text not null check (objective in ('FAT_LOSS','RECOMPOSITION','MUSCLE_GAIN','MAINTENANCE')),
  status              text not null default 'ACTIVE' check (status in ('ACTIVE','CLOSED')),
  cycle_start         date not null,
  baseline_weight_kg  numeric not null check (baseline_weight_kg > 0),
  baseline_waist_cm   numeric check (baseline_waist_cm > 0),
  current_step        smallint not null default 0 check (current_step between -2 and 2),
  -- RESERVADO para MB5. Sin autoridad sobre la energía mientras sea NULL.
  base_energy_kcal    integer check (base_energy_kcal > 0),
  last_checkin_id     uuid,   -- sin FK a propósito (referencia circular); lo mantiene la RPC
  last_applied_action text check (last_applied_action in ('STEP_UP','STEP_DOWN')),
  last_applied_at     timestamptz,
  calibration_version smallint not null check (calibration_version >= 1),
  created_at          timestamptz not null default now(),
  closed_at           timestamptz,
  unique (id, user_id),
  check ((status = 'CLOSED') = (closed_at is not null)),
  check ((last_applied_action is null) = (last_applied_at is null))
);

create unique index if not exists nutrition_calibrations_one_active
  on public.nutrition_calibrations (user_id) where status = 'ACTIVE';
create index if not exists nutrition_calibrations_user_created
  on public.nutrition_calibrations (user_id, created_at desc);

-- ── 2 · Check-ins procesados (append-only) ─────────────────────────────────
create table if not exists public.nutrition_adaptive_checkins (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references auth.users(id) on delete cascade,
  calibration_id            uuid not null,
  cycle_index               integer not null check (cycle_index >= 1),
  checkin_date              date not null,
  objective                 text not null check (objective in ('FAT_LOSS','RECOMPOSITION','MUSCLE_GAIN','MAINTENANCE')),

  -- respuestas declaradas (MB2)
  weight_kg                 numeric not null check (weight_kg > 0),
  waist_cm                  numeric check (waist_cm > 0),
  adherence_answer          text not null check (adherence_answer in ('PRACTICALLY_ALL','ALMOST_ALWAYS','MOST_DAYS','SOMETIMES','VERY_LITTLE')),
  adherence_band            text not null check (adherence_band in ('HIGH','MEDIUM','LOW')),
  hunger                    text not null check (hunger in ('LOW','NORMAL','HIGH')),
  energy                    text not null check (energy in ('LOW','NORMAL','GOOD')),
  performance               text not null check (performance in ('WORSE','SAME','BETTER','NOT_APPLICABLE')),
  trains_strength           boolean,
  strength_experience       text check (strength_experience in ('BEGINNER','INTERMEDIATE','ADVANCED')),
  recent_strength_continuity text check (recent_strength_continuity in ('YES','NO')),

  -- trayectoria evaluada (MB1), congelada
  trajectory_sufficiency    text not null check (trajectory_sufficiency in ('SUFFICIENT_FOR_DECISION','INSUFFICIENT_WINDOW','INSUFFICIENT_DATA')),
  previous_weight_kg        numeric check (previous_weight_kg > 0),
  elapsed_days              numeric check (elapsed_days > 0),
  absolute_change_kg        numeric,
  percent_change            numeric,
  percent_change_per_week   numeric,
  kg_per_month              numeric,
  trajectory_direction      text check (trajectory_direction in ('DOWN','STABLE','UP')),
  trajectory_classification text,

  -- cintura comparada (MB3), congelada
  previous_waist_cm         numeric check (previous_waist_cm > 0),
  waist_direction           text check (waist_direction in ('LOWER','SAME','HIGHER')),

  -- decisión (MB3)
  action                    text not null check (action in ('MAINTAIN','STEP_UP','STEP_DOWN','REVIEW','NO_ADJUSTMENT')),
  reason                    text not null check (reason in (
    'INSUFFICIENT_WINDOW','INSUFFICIENT_DATA','ADHERENCE_NOT_HIGH',
    'VERY_SLOW','BORDERLINE_SLOW_FIRST','BORDERLINE_SLOW_CONFIRMED','ON_TARGET',
    'DEFICIT_SYMPTOMS','FAST_FIRST','FAST_CONFIRMED','FAST_WITH_SYMPTOMS',
    'BELOW_TARGET','ABOVE_TARGET',
    'WITHIN_MAINTENANCE_BAND','BELOW_MAINTENANCE_BAND','ABOVE_MAINTENANCE_BAND','NEGATIVE_SIGNALS',
    'CONTRADICTORY_SIGNALS','PERFORMANCE_IMPROVING','PERFORMANCE_WORSE','NO_TRAINING_SIGNAL',
    'WAIST_IMPROVING','WAIST_WORSENING','NO_CLEAR_PROGRESS',
    'DIRECTION_REVERSAL_BLOCKED','CALIBRATION_LIMIT_REACHED')),
  previous_step             smallint not null check (previous_step between -2 and 2),
  proposed_step             smallint not null check (proposed_step between -2 and 2),
  blocked_action            text check (blocked_action in ('STEP_UP','STEP_DOWN')),
  blocked_reason            text,

  -- versiones de los contratos que produjeron la fila
  trajectory_version        smallint not null check (trajectory_version >= 1),
  checkin_domain_version    smallint not null check (checkin_domain_version >= 1),
  adaptive_decision_version smallint not null check (adaptive_decision_version >= 1),

  created_at                timestamptz not null default now(),

  unique (calibration_id, cycle_index),
  foreign key (calibration_id, user_id) references public.nutrition_calibrations (id, user_id) on delete cascade,

  -- el paso propuesto es coherente con la acción
  check (
    (action = 'STEP_UP'   and proposed_step = previous_step + 1) or
    (action = 'STEP_DOWN' and proposed_step = previous_step - 1) or
    (action not in ('STEP_UP','STEP_DOWN') and proposed_step = previous_step)
  ),
  -- un paso bloqueado solo existe dentro de un REVIEW y trae su razón original
  check ((blocked_action is null) = (blocked_reason is null)),
  check (blocked_action is null or action = 'REVIEW'),
  -- métricas de trayectoria: todas o ninguna
  check (num_nulls(previous_weight_kg, elapsed_days, absolute_change_kg, percent_change,
                   percent_change_per_week, kg_per_month, trajectory_direction) in (0, 7)),
  -- clasificación solo cuando la trayectoria fue suficiente, y propia del objetivo
  check ((trajectory_classification is not null) = (trajectory_sufficiency = 'SUFFICIENT_FOR_DECISION')),
  check (trajectory_sufficiency <> 'SUFFICIENT_FOR_DECISION' or previous_weight_kg is not null),
  check (trajectory_classification is null
    or (objective = 'FAT_LOSS'      and trajectory_classification in ('VERY_SLOW','BORDERLINE_SLOW','ON_TARGET','FAST'))
    or (objective = 'MUSCLE_GAIN'   and trajectory_classification in ('BELOW_TARGET','ON_TARGET','ABOVE_TARGET'))
    or (objective = 'RECOMPOSITION' and trajectory_classification in ('DOWN','RELATIVELY_STABLE','UP'))
    or (objective = 'MAINTENANCE'   and trajectory_classification in ('BELOW_MAINTENANCE_BAND','WITHIN_MAINTENANCE_BAND','ABOVE_MAINTENANCE_BAND'))),
  -- la dirección de cintura solo existe con dos medidas
  check (waist_direction is null or (waist_cm is not null and previous_waist_cm is not null)),
  -- requisitos del check-in por objetivo (MB2)
  check (objective <> 'RECOMPOSITION' or waist_cm is not null),
  check (objective <> 'MUSCLE_GAIN' or strength_experience is not null)
);

create index if not exists nutrition_adaptive_checkins_user_cal_cycle
  on public.nutrition_adaptive_checkins (user_id, calibration_id, cycle_index desc);

-- ── 3 · Inmutabilidad ──────────────────────────────────────────────────────
create or replace function public.nutrition_checkins_append_only()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'nutrition_adaptive_checkins es append-only' using errcode = 'check_violation';
end $$;

drop trigger if exists nutrition_checkins_no_update on public.nutrition_adaptive_checkins;
create trigger nutrition_checkins_no_update
  before update on public.nutrition_adaptive_checkins
  for each row execute function public.nutrition_checkins_append_only();

-- Una calibración cerrada no cambia; en la activa, identidad y línea base son fijas.
create or replace function public.nutrition_calibrations_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status = 'CLOSED' then
    raise exception 'nutrition_calibrations: calibración cerrada' using errcode = 'check_violation';
  end if;
  if new.id <> old.id or new.user_id <> old.user_id or new.objective <> old.objective
     or new.cycle_start <> old.cycle_start or new.baseline_weight_kg <> old.baseline_weight_kg
     or new.baseline_waist_cm is distinct from old.baseline_waist_cm
     or new.calibration_version <> old.calibration_version or new.created_at <> old.created_at then
    raise exception 'nutrition_calibrations: identidad y línea base son inmutables' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists nutrition_calibrations_guard on public.nutrition_calibrations;
create trigger nutrition_calibrations_guard
  before update on public.nutrition_calibrations
  for each row execute function public.nutrition_calibrations_guard();

-- ── 4 · RLS: el socio solo LEE lo suyo; no hay policies de escritura ───────
alter table public.nutrition_calibrations enable row level security;
alter table public.nutrition_adaptive_checkins enable row level security;

drop policy if exists "nutrition_calibrations select own" on public.nutrition_calibrations;
create policy "nutrition_calibrations select own" on public.nutrition_calibrations
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "nutrition_adaptive_checkins select own" on public.nutrition_adaptive_checkins;
create policy "nutrition_adaptive_checkins select own" on public.nutrition_adaptive_checkins
  for select to authenticated using (auth.uid() = user_id);

revoke all on public.nutrition_calibrations, public.nutrition_adaptive_checkins from anon;
revoke insert, update, delete, truncate on public.nutrition_calibrations, public.nutrition_adaptive_checkins from authenticated;

-- ── 5 · RPC: abrir calibración (inicio o cambio de objetivo) ───────────────
-- Cierra la activa (si la hay) y abre otra con step 0 y la línea base dada.
-- Reintento idéntico sobre una activa sin check-ins → ALREADY_ACTIVE (no duplica).
create or replace function public.nutrition_start_calibration(
  p_objective text,
  p_cycle_start date,
  p_baseline_weight_kg numeric,
  p_baseline_waist_cm numeric,
  p_calibration_version smallint
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_active public.nutrition_calibrations%rowtype;
  v_new_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('status', 'NOT_AUTHENTICATED');
  end if;

  select * into v_active from public.nutrition_calibrations
    where user_id = v_uid and status = 'ACTIVE' for update;

  if found and v_active.objective = p_objective and v_active.cycle_start = p_cycle_start
     and v_active.baseline_weight_kg = p_baseline_weight_kg
     and v_active.baseline_waist_cm is not distinct from p_baseline_waist_cm
     and v_active.calibration_version = p_calibration_version
     and v_active.last_checkin_id is null then
    return jsonb_build_object('status', 'ALREADY_ACTIVE', 'calibration_id', v_active.id);
  end if;

  if found then
    update public.nutrition_calibrations set status = 'CLOSED', closed_at = now() where id = v_active.id;
  end if;

  insert into public.nutrition_calibrations
    (user_id, objective, cycle_start, baseline_weight_kg, baseline_waist_cm, calibration_version)
  values (v_uid, p_objective, p_cycle_start, p_baseline_weight_kg, p_baseline_waist_cm, p_calibration_version)
  returning id into v_new_id;

  return jsonb_build_object('status', 'STARTED', 'calibration_id', v_new_id,
                            'closed_calibration_id', case when v_active.id is null then null else v_active.id end);
exception
  when check_violation or not_null_violation then
    return jsonb_build_object('status', 'INVALID_PAYLOAD');
  when unique_violation then
    return jsonb_build_object('status', 'CONFLICT');
end $$;

-- ── 6 · RPC: registrar un check-in procesado (check-in + estado, atómico) ──
-- p_expected_last_checkin_id = el last_checkin_id que el caller leyó (NULL si
-- no había). Si el estado cambió entretanto → STALE_STATE y no se escribe nada.
create or replace function public.nutrition_record_checkin(
  p_calibration_id uuid,
  p_expected_last_checkin_id uuid,
  p_checkin jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_cal public.nutrition_calibrations%rowtype;
  v_row public.nutrition_adaptive_checkins%rowtype;
  v_last public.nutrition_adaptive_checkins%rowtype;
  v_existing uuid;
begin
  if v_uid is null then
    return jsonb_build_object('status', 'NOT_AUTHENTICATED');
  end if;

  select * into v_cal from public.nutrition_calibrations
    where id = p_calibration_id and user_id = v_uid for update;
  if not found then
    return jsonb_build_object('status', 'NOT_FOUND');
  end if;
  if v_cal.status <> 'ACTIVE' then
    return jsonb_build_object('status', 'CALIBRATION_CLOSED');
  end if;

  -- columnas desde el payload; identidad y tiempos los pone el servidor
  v_row := jsonb_populate_record(null::public.nutrition_adaptive_checkins, p_checkin);
  v_row.id := gen_random_uuid();
  v_row.user_id := v_uid;
  v_row.calibration_id := v_cal.id;
  v_row.created_at := now();

  select id into v_existing from public.nutrition_adaptive_checkins
    where calibration_id = v_cal.id and cycle_index = v_row.cycle_index;
  if found then
    return jsonb_build_object('status', 'DUPLICATE_CYCLE', 'checkin_id', v_existing);
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

  select * into v_last from public.nutrition_adaptive_checkins where id = v_cal.last_checkin_id;
  if v_row.checkin_date is null or v_row.checkin_date <= v_cal.cycle_start
     or (v_last.id is not null and (v_row.cycle_index <= v_last.cycle_index or v_row.checkin_date <= v_last.checkin_date)) then
    return jsonb_build_object('status', 'OUT_OF_ORDER');
  end if;

  insert into public.nutrition_adaptive_checkins select v_row.*;

  update public.nutrition_calibrations set
    current_step = v_row.proposed_step,
    last_checkin_id = v_row.id,
    last_applied_action = case when v_row.action in ('STEP_UP','STEP_DOWN') then v_row.action else last_applied_action end,
    last_applied_at = case when v_row.action in ('STEP_UP','STEP_DOWN') then now() else last_applied_at end
  where id = v_cal.id;

  return jsonb_build_object('status', 'RECORDED', 'checkin_id', v_row.id, 'current_step', v_row.proposed_step);
exception
  when unique_violation then
    return jsonb_build_object('status', 'DUPLICATE_CYCLE');
  when check_violation or not_null_violation or foreign_key_violation
    or invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow
    or invalid_datetime_format then
    return jsonb_build_object('status', 'INVALID_PAYLOAD');
end $$;

revoke all on function public.nutrition_start_calibration(text, date, numeric, numeric, smallint) from public, anon;
revoke all on function public.nutrition_record_checkin(uuid, uuid, jsonb) from public, anon;
revoke all on function public.nutrition_checkins_append_only() from public, anon, authenticated;
revoke all on function public.nutrition_calibrations_guard() from public, anon, authenticated;
grant execute on function public.nutrition_start_calibration(text, date, numeric, numeric, smallint) to authenticated;
grant execute on function public.nutrition_record_checkin(uuid, uuid, jsonb) to authenticated;

comment on table public.nutrition_calibrations is
  'Adaptive Nutrition MB4 · periodos de calibración; la fila ACTIVE es el estado vigente (una por socio). Escritura solo por RPC. base_energy_kcal reservado: sin autoridad sobre energía.';
comment on table public.nutrition_adaptive_checkins is
  'Adaptive Nutrition MB4 · check-ins procesados, append-only. Respuestas declaradas + trayectoria + decisión congeladas. Escritura solo por nutrition_record_checkin.';

commit;
