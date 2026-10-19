-- ════════════════════════════════════════════════════════════════════
-- 20261017120000_nutrition_calibration_energy_base.sql      · BORRADOR · NO APLICADO
-- ════════════════════════════════════════════════════════════════════
-- Purpose: ADAPTIVE NUTRITION · BLOQUE 5 — base de energía congelada CRUDA y suelo T1.
--
--   1 · nutrition_calibrations.base_energy_raw numeric NOT NULL · el `rawPrescribedEnergy` de
--       CAPA 1 calculado SERVER-SIDE (Edge `nutrition-checkin`) al abrir la calibración, con el
--       peso base que la misma RPC fija en ob_data.peso. Única base de los pasos adaptativos
--       (calibrada = base × (1 + 0.05·step), sin compounding). Inmutable. `base_energy_kcal`
--       (integer) queda sin autoridad: no se escribe ni se usa para calcular.
--   2 · nutrition_adaptive_checkins.reason admite 'SAFETY_FLOOR_REACHED': una bajada cuya energía
--       calibrada CRUDA quedaría ≤ 1200 se guarda como REVIEW, proposed_step = previous_step,
--       blocked_action = 'STEP_DOWN', blocked_reason = la razón original de MB3. Los CHECK
--       existentes ya garantizan esa forma; `record_checkin` no cambia (current_step = proposed_step
--       = previous_step → el paso no se mueve; last_applied_* solo cambia con STEP_UP/STEP_DOWN).
--   3 · nutrition_server_start_calibration recibe p_base_energy_raw (firma nueva). La firma de
--       8 argumentos se ELIMINA: ninguna ruta puede abrir una calibración sin base cruda.
--
-- Precondición: 0 calibraciones (auditoría read-only 2026-10-15: 0 calibraciones, 0 check-ins).
-- Si ya existieran filas, la migración ABORTA entera (requiere decisión de backfill).
-- Orden de despliegue: esta migración y, a continuación, la Edge `nutrition-checkin` que envía
-- p_base_energy_raw y aplica el suelo T1. Entre ambos pasos, abrir calibración devuelve UNAVAILABLE.
-- Sin cambios de RLS ni de grants (solo service_role ejecuta las RPC).
-- Run en Supabase Dashboard → SQL Editor (ledger drifted) — SOLO con autorización explícita.
-- ════════════════════════════════════════════════════════════════════

begin;

-- ── 0 · Precondición ────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from public.nutrition_calibrations) then
    raise exception 'nutrition_calibration_energy_base: ya existen calibraciones; requiere decisión de backfill antes de aplicar';
  end if;
end $$;

-- ── 1 · Base congelada CRUDA ────────────────────────────────────────────────
alter table public.nutrition_calibrations
  add column base_energy_raw numeric not null
    constraint nutrition_calibrations_base_energy_raw_check
    check (base_energy_raw > 0 and base_energy_raw <> 'NaN'::numeric and base_energy_raw <> 'Infinity'::numeric);

comment on column public.nutrition_calibrations.base_energy_raw is
  'Bloque 5 · rawPrescribedEnergy (CAPA 1, crudo, sin redondear) calculado server-side al abrir la calibración. Única base de los pasos adaptativos. Inmutable.';
comment on column public.nutrition_calibrations.base_energy_kcal is
  'Sin autoridad. No se escribe ni se usa para calcular; la base de los pasos es base_energy_raw.';

-- ── 2 · Inmutabilidad: la base cruda forma parte de la línea base ──────────
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
     or new.base_energy_raw is distinct from old.base_energy_raw
     or new.start_request_id <> old.start_request_id
     or new.calibration_version <> old.calibration_version or new.created_at <> old.created_at then
    raise exception 'nutrition_calibrations: identidad y línea base son inmutables' using errcode = 'check_violation';
  end if;
  return new;
end $$;

-- ── 3 · reason: + SAFETY_FLOOR_REACHED ──────────────────────────────────────
alter table public.nutrition_adaptive_checkins drop constraint nutrition_adaptive_checkins_reason_check;
alter table public.nutrition_adaptive_checkins add constraint nutrition_adaptive_checkins_reason_check check (reason in (
  'INSUFFICIENT_WINDOW','INSUFFICIENT_DATA','ADHERENCE_NOT_HIGH',
  'VERY_SLOW','BORDERLINE_SLOW_FIRST','BORDERLINE_SLOW_CONFIRMED','ON_TARGET',
  'DEFICIT_SYMPTOMS','FAST_FIRST','FAST_CONFIRMED','FAST_WITH_SYMPTOMS',
  'BELOW_TARGET','ABOVE_TARGET',
  'WITHIN_MAINTENANCE_BAND','BELOW_MAINTENANCE_BAND','ABOVE_MAINTENANCE_BAND','NEGATIVE_SIGNALS',
  'CONTRADICTORY_SIGNALS','PERFORMANCE_IMPROVING','PERFORMANCE_WORSE','NO_TRAINING_SIGNAL',
  'WAIST_IMPROVING','WAIST_WORSENING','NO_CLEAR_PROGRESS',
  'DIRECTION_REVERSAL_BLOCKED','CALIBRATION_LIMIT_REACHED',
  'SAFETY_FLOOR_REACHED'));

-- ── 4 · Abrir calibración con base cruda (firma nueva; la de 8 args se elimina) ──
drop function public.nutrition_server_start_calibration(uuid, uuid, text, date, date, numeric, numeric, smallint);

create function public.nutrition_server_start_calibration(
  p_user_id uuid,
  p_request_id uuid,
  p_objective text,
  p_baseline_date date,
  p_cycle_start date,
  p_baseline_weight_kg numeric,
  p_baseline_waist_cm numeric,
  p_calibration_version smallint,
  p_base_energy_raw numeric
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

  -- replay por start_request_id → mismo resultado, sin reescribir (ni peso ni base)
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

  -- BLOQUE 5 · la base cruda es obligatoria (NOT NULL + CHECK): sin ella no hay calibración.
  insert into public.nutrition_calibrations
    (user_id, objective, baseline_date, cycle_start, baseline_weight_kg, baseline_waist_cm, calibration_version, start_request_id, base_energy_raw)
  values (p_user_id, p_objective, p_baseline_date, p_cycle_start, p_baseline_weight_kg, p_baseline_waist_cm, p_calibration_version, p_request_id, p_base_energy_raw)
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

revoke all on function public.nutrition_server_start_calibration(uuid, uuid, text, date, date, numeric, numeric, smallint, numeric) from public, anon, authenticated;
grant execute on function public.nutrition_server_start_calibration(uuid, uuid, text, date, date, numeric, numeric, smallint, numeric) to service_role;

commit;
