-- ════════════════════════════════════════════════════════════════════
-- 20261002120000_energy_snapshot.sql
-- ════════════════════════════════════════════════════════════════════
-- Purpose: CAPA 1E · FASE C2 — añade `user_profiles.energy_snapshot` para
--          que la FASE C4 pueda persistir el resultado del nuevo motor
--          energético (DRI 2023 EER) con su trazabilidad.
--
-- Esta migración SOLO crea la columna. En C2 nadie la escribe y nadie la
-- lee: la autoridad energética sigue siendo la legacy
-- (`computeNutritionTargets` → `tdee` / `plan_goal`). El cambio de
-- autoridad ocurre en C4, y es entonces cuando esta columna empieza a
-- llenarse.
--
-- ⚠️  SEPARACIÓN DELIBERADA respecto a `ob_data`:
--    `ob_data`        = INPUTS declarados por el socio.
--    `energy_snapshot` = RESULTADO de un motor sobre esos inputs.
--    Meter el resultado dentro de `ob_data` crearía dos verdades de los
--    inputs y obligaría al mapper de nutrición a ignorar claves propias.
--
-- NULLABLE, SIN DEFAULT y SIN BACKFILL, a propósito:
--    NULL significa «este perfil no tiene snapshot del motor nuevo», es
--    decir un perfil legacy. C4 usa precisamente esa ausencia para saber
--    que NO puede confiar en el `plan_goal` guardado y que tiene que
--    recalcular. Si la columna tuviera un default o un backfill, la
--    existencia del snapshot dejaría de ser prueba de nada.
--
-- Forma del contenido (validada en código por `parseEnergySnapshot`, no
-- por Postgres — el esquema del JSON es del dominio, no de la tabla):
--    { schemaVersion, status, prescribedEnergy?, rawPrescribedEnergy?,
--      maintenance?, classification?, inputIdentity?, versions?,
--      computedAt }
--
-- RLS: no se añade ninguna policy nueva. La columna queda cubierta por
-- las policies existentes de `user_profiles` (el socio lee y escribe su
-- propia fila), igual que `ob_data` y `weekly_plan`.
--
-- NO toca: weekly_plan · ob_data · tdee · plan_goal · meal_plan_key ·
--          nutrition_day_summary.
--
-- Run en Supabase Dashboard → SQL Editor. Idempotente: safe to re-run.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS energy_snapshot jsonb;

COMMENT ON COLUMN public.user_profiles.energy_snapshot IS
  'CAPA 1E · EnergySnapshotV1 del motor energético nuevo (DRI 2023 EER). NULL = perfil sin snapshot nuevo (legacy) → la cifra guardada en plan_goal no es de fiar y hay que recalcular. Lo valida parseEnergySnapshot en el cliente; Postgres no impone su esquema. Resultado de motor, NO inputs: los inputs viven en ob_data.';
