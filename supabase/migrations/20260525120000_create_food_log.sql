-- ════════════════════════════════════════════════════════════════════
-- supabase_food_log.sql
-- ════════════════════════════════════════════════════════════════════
-- Purpose: Persist what the user actually ate so the AI coach can
--          reason about real food intake, not just the suggested plan.
--
-- Hasta ahora foodLog vivía solo en Zustand/localStorage (dormido — el
-- shape estaba, el coach ya lo leía, pero nadie escribía). El feature
-- "comí otra cosa" (food logger con estimación IA de macros) empieza a
-- poblar foodLog. Esta tabla evita que se pierda data si el user limpia
-- cache, cambia de device, o reinstala.
--
-- Diferencias con weight_log:
-- - NO UNIQUE(user_id, date): un user registra N comidas por día.
-- - INSERT-only por id (cada entry es una comida específica), no upsert
--   por (user_id, date).
--
-- "desc" es palabra reservada en ANSI SQL (ORDER BY DESC) — Postgres
-- la permite como nombre de columna sin quotes, pero la columna se
-- renombró a "description" por claridad. El shape en el store sigue
-- siendo {desc}; el mapeo desc ↔ description ocurre en addFoodLog/
-- hydration al borde del sync (1 línea de remap, cero impacto en los
-- consumidores: coach.ts, TabCoach welcome).
--
-- Run this in Supabase Dashboard → SQL Editor.
-- Idempotent: safe to re-run.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS food_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Cuándo
  date date NOT NULL,

  -- Qué comió (texto libre del user)
  description text NOT NULL,

  -- Macros estimados (por IA o manual)
  kcal integer NOT NULL CHECK (kcal >= 0 AND kcal <= 10000),
  prot numeric(6,1) NOT NULL DEFAULT 0 CHECK (prot >= 0),
  carbs numeric(6,1) NOT NULL DEFAULT 0 CHECK (carbs >= 0),
  fat numeric(6,1) NOT NULL DEFAULT 0 CHECK (fat >= 0),

  -- Origen de la estimación
  source text NOT NULL CHECK (source IN ('manual', 'ai')),

  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Índices ───────────────────────────────────────────────────────
-- Query principal: "comidas del user en últimos N días" — App.tsx
-- hidrata 14 días al SIGNED_IN, el coach prompt lee solo el día actual.
CREATE INDEX IF NOT EXISTS food_log_user_date_idx
  ON food_log(user_id, date DESC);

-- ─── RLS ───────────────────────────────────────────────────────────
-- Mismo patrón que weight_log/workout_log: cada user solo ve SU comida.
ALTER TABLE food_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own food_log" ON food_log;
CREATE POLICY "Users can read own food_log" ON food_log
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own food_log" ON food_log;
CREATE POLICY "Users can insert own food_log" ON food_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own food_log" ON food_log;
CREATE POLICY "Users can update own food_log" ON food_log
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own food_log" ON food_log;
CREATE POLICY "Users can delete own food_log" ON food_log
  FOR DELETE USING (auth.uid() = user_id);

-- ─── Comentarios ───────────────────────────────────────────────────
COMMENT ON COLUMN food_log.date IS
  'Fecha en zona del usuario (YYYY-MM-DD). Crítico para que el coach lea "qué comí hoy" con el mismo string que genera el cliente.';

COMMENT ON COLUMN food_log.description IS
  'Lo que el user escribió en el food logger ("comí pizza", "ensalada de atún"). Se mapea a foodLog[].desc en el cliente.';

COMMENT ON COLUMN food_log.source IS
  'manual | ai — manual si el user editó las macros, ai si vinieron del estimador IA (buildFoodEstimatePrompt).';

COMMENT ON COLUMN food_log.kcal IS
  'Estimación conservadora. Si el texto del user es vago, la IA estima bajo. Clamp [0, 10000] como red de seguridad contra outliers.';
