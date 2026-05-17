-- ============================================================
-- Tabla weight_log: tracking semanal del peso del user
-- ============================================================
-- Persiste el peso registrado por el user a lo largo del tiempo.
-- UNIQUE(user_id, date) previene duplicados intra-día y permite
-- upsert por (user_id, date) — si el user pesa 2 veces el mismo
-- día, el segundo registro actualiza al primero.
-- ============================================================

CREATE TABLE IF NOT EXISTS weight_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  kg numeric(5,2) NOT NULL CHECK (kg BETWEEN 30 AND 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS weight_log_user_date_idx
  ON weight_log(user_id, date DESC);

ALTER TABLE weight_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own weight_log" ON weight_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weight_log" ON weight_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weight_log" ON weight_log
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own weight_log" ON weight_log
  FOR DELETE USING (auth.uid() = user_id);
