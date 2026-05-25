-- ════════════════════════════════════════════════════════════════════
-- supabase_create_meal_progress.sql
-- ════════════════════════════════════════════════════════════════════
-- Purpose: Persist mealChecks + mealResolvedByLog across devices.
--
-- Sync-1 llevó weeklyPlan + shopping_day a user_profiles. Faltaba el
-- progreso del día: los checks ✓ del plan (mealChecks) y los dot ámbar
-- "comí otra cosa" (mealResolvedByLog) vivían solo en localStorage.
-- Si el user marcaba algo en su laptop, su teléfono no lo veía.
--
-- ARQUITECTURA — tabla estructurada, no jsonb:
-- - Granularidad fina por (user_id, date, meal_index): si el user marca
--   Desayuno en device A y Cena en device B el mismo día, los upsert
--   no se pisan (afectan filas distintas).
-- - Una fila combina ambos flags (checked + resolved_by_log) porque
--   semánticamente describen el mismo "slot" (una comida del plan en
--   un día), y muchas veces el toggle de uno coexiste con el otro.
-- - UNIQUE(user_id, date, meal_index) habilita upsert por ese tripleto.
-- - 0..9 en CHECK porque hoy el plan tiene 5 meals, pero un futuro
--   plan con más comidas (snacks extras) no romperá la constraint.
--
-- TOGGLE — fire-and-forget desde el cliente:
-- El toggle es 1-tap, no podemos await Supabase para cada tap. Cada
-- toggle dispara optimistic local + upsert en background. Si falla,
-- log y siguiente sync recupera. Consistencia eventual.
--
-- RIESGO DE CONFLICTO (mitigado):
-- - Dos devices toggleando la MISMA comida-día → last-write-wins por
--   updated_at (aceptable: el último gesto humano gana).
-- - Hidratación al login: merge "true wins" (si local o remote dice
--   checked=true, el resultado merged es true). Garantiza que un check
--   hecho en cualquier device NO se pierde por sync.
--
-- RLS — mismo patrón que food_log/weight_log: cada user solo ve SU
-- progreso. 4 policies (read/insert/update/delete) con auth.uid().
--
-- Idempotente: CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS.
-- Run this in Supabase Dashboard → SQL Editor.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS meal_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identificación del slot
  date date NOT NULL,
  meal_index integer NOT NULL CHECK (meal_index BETWEEN 0 AND 9),

  -- Los dos flags semánticamente independientes pero co-ubicados
  checked boolean NOT NULL DEFAULT false,
  resolved_by_log boolean NOT NULL DEFAULT false,

  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, date, meal_index)
);

-- ─── Índice ────────────────────────────────────────────────────────
-- Query principal: "progreso del user de los últimos N días" — App.tsx
-- hidrata 14 días al SIGNED_IN (mismo cut-off que food_log).
CREATE INDEX IF NOT EXISTS meal_progress_user_date_idx
  ON meal_progress(user_id, date DESC);

-- ─── RLS ───────────────────────────────────────────────────────────
ALTER TABLE meal_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own meal_progress" ON meal_progress;
CREATE POLICY "Users can read own meal_progress" ON meal_progress
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own meal_progress" ON meal_progress;
CREATE POLICY "Users can insert own meal_progress" ON meal_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own meal_progress" ON meal_progress;
CREATE POLICY "Users can update own meal_progress" ON meal_progress
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own meal_progress" ON meal_progress;
CREATE POLICY "Users can delete own meal_progress" ON meal_progress
  FOR DELETE USING (auth.uid() = user_id);

-- ─── Comentarios ───────────────────────────────────────────────────
COMMENT ON COLUMN meal_progress.date IS
  'Fecha del meal en zona del user (YYYY-MM-DD). Crítico: misma fecha que el cliente usa para key meal-${date}-${index}.';

COMMENT ON COLUMN meal_progress.meal_index IS
  'Índice del meal en el día del plan (0=Desayuno..4=Cena hoy). Permite 0..9 para futuros planes con más slots.';

COMMENT ON COLUMN meal_progress.checked IS
  'true si el user marcó ✓ siguió el meal del plan. Toggle por tap. Default false.';

COMMENT ON COLUMN meal_progress.resolved_by_log IS
  'true si el user resolvió esta franja registrando otra comida en foodLog (Food-4 / dot ámbar). Set automático al guardar foodLog.';
