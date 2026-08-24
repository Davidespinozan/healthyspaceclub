-- NUTRITION-N10.2A.2 · autoridad cross-device del resumen diario de EVIDENCIA de adherencia.
--
-- nutrition_day_summary es un CACHE DERIVADO de food_log + meal_progress (esas siguen siendo la autoridad
-- de evidencia). Su ÚNICO valor no-reconstruible es target_kcal: el objetivo calórico congelado del día
-- (planGoal cambia después y no se versiona por día). NO duplica food_log ni meal_progress.
--
-- target_kcal es FIRST-WRITE-WINS: el cliente inserta ON CONFLICT DO NOTHING (fija el target la 1ª vez) y
-- luego hace UPDATE SOLO de los campos de evidencia (nunca target_kcal). Así un device stale no puede
-- pisar el target histórico. NO cambia calorías: esta tabla es SOLO historia de lectura/escritura.
--
-- Idempotente: CREATE TABLE IF NOT EXISTS + DROP POLICY IF EXISTS. Aplicar por SQL Editor (ledger drifted).

CREATE TABLE IF NOT EXISTS nutrition_day_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  target_kcal integer NOT NULL,                    -- INMUTABLE tras el 1er insert (snapshot histórico)
  logged_kcal integer NOT NULL DEFAULT 0,          -- derivado de food_log
  measured_slots smallint NOT NULL DEFAULT 0,      -- derivado de food_log.meal_index + meal_progress
  total_slots smallint NOT NULL DEFAULT 0,
  evidence_class text NOT NULL CHECK (evidence_class IN
    ('NO_DATA', 'CHECK_ONLY', 'LOGGED_PARTIAL', 'LOGGED_STRONG', 'MIXED')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE nutrition_day_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own nutrition_day_summary" ON nutrition_day_summary;
CREATE POLICY "Users can read own nutrition_day_summary" ON nutrition_day_summary
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own nutrition_day_summary" ON nutrition_day_summary;
CREATE POLICY "Users can insert own nutrition_day_summary" ON nutrition_day_summary
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own nutrition_day_summary" ON nutrition_day_summary;
CREATE POLICY "Users can update own nutrition_day_summary" ON nutrition_day_summary
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own nutrition_day_summary" ON nutrition_day_summary;
CREATE POLICY "Users can delete own nutrition_day_summary" ON nutrition_day_summary
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE nutrition_day_summary IS
  'NUTRITION-N10.2A.2 · cache derivado de evidencia diaria. Autoridad = food_log + meal_progress; único snapshot no-reconstruible = target_kcal (first-write-wins). No cambia calorías.';
