-- ============================================================
-- Tabla user_milestones: tracking persistente de logros
-- desbloqueados por cada user
-- ============================================================
-- Cada fila representa UN milestone alcanzado por UN user
-- milestone_days es la cantidad de días (3, 7, 14, 30, 60, 90, 180, 365)
-- unlocked_at es cuándo lo alcanzó (timestamptz)
-- UNIQUE(user_id, milestone_days) garantiza que no se duplique
-- ============================================================

CREATE TABLE IF NOT EXISTS user_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_days integer NOT NULL CHECK (milestone_days IN (3, 7, 14, 30, 60, 90, 180, 365)),
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, milestone_days)
);

CREATE INDEX IF NOT EXISTS user_milestones_user_idx
  ON user_milestones(user_id, milestone_days);

CREATE INDEX IF NOT EXISTS user_milestones_unlocked_idx
  ON user_milestones(user_id, unlocked_at DESC);

ALTER TABLE user_milestones ENABLE ROW LEVEL SECURITY;

-- Policies:
-- SELECT: cualquier user autenticado puede leer milestones de cualquier user
--   (necesario para mostrar logros en perfil público)
-- INSERT/UPDATE/DELETE: solo el propio user puede modificar sus milestones

CREATE POLICY "Anyone authenticated can read milestones" ON user_milestones
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own milestones" ON user_milestones
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own milestones" ON user_milestones
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own milestones" ON user_milestones
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
