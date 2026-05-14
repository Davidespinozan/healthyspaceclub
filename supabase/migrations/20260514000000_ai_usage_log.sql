-- ============================================================
-- HSC AI Proxy — migración para ai_usage_log + is_admin
-- Created: 2026-05-14
-- ============================================================
-- Esta migración debe correrse ANTES de deployar la Edge Function
-- ai-proxy, porque la función referencia ai_usage_log y user_profiles.is_admin.
-- ============================================================

-- 1. Añadir is_admin a user_profiles (si no existe)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- 2. Crear tabla ai_usage_log
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  endpoint text NOT NULL,
  model text,
  tokens_in integer,
  tokens_out integer,
  success boolean NOT NULL DEFAULT true,
  error_code text,
  latency_ms integer
);

-- 3. Índices para queries del rate limit
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date
  ON ai_usage_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_date
  ON ai_usage_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_success_date
  ON ai_usage_log(user_id, success, created_at DESC)
  WHERE success = true;
  -- ↑ este índice acelera específicamente el COUNT(*) WHERE success=true del rateLimit

-- 4. RLS habilitada
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

-- 5. Policies
-- Users pueden leer su propio log (útil para futura UI de "uso esta semana")
CREATE POLICY "Users read own usage" ON ai_usage_log
  FOR SELECT
  USING (user_id = auth.uid());

-- INSERT bloqueado para clientes (service role bypassa RLS automáticamente)
CREATE POLICY "Block client inserts" ON ai_usage_log
  FOR INSERT
  WITH CHECK (false);

-- UPDATE/DELETE bloqueados para clientes
CREATE POLICY "Block client updates" ON ai_usage_log
  FOR UPDATE
  USING (false);
CREATE POLICY "Block client deletes" ON ai_usage_log
  FOR DELETE
  USING (false);

-- 6. Setear is_admin = true para David y Magaly (cuando existan en auth.users)
-- ⚠️ COMENTADO — David debe correr manualmente con sus user_id reales después de aplicar la migración:
-- UPDATE user_profiles SET is_admin = true WHERE user_id = '<david_uuid>';
-- UPDATE user_profiles SET is_admin = true WHERE user_id = '<magaly_uuid>';

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN (correr en SQL Editor de Supabase Studio):
--
-- 1. Confirma columna is_admin existe:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'user_profiles' AND column_name = 'is_admin';
--
-- 2. Confirma tabla ai_usage_log existe:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'ai_usage_log'
-- ORDER BY ordinal_position;
--
-- 3. Confirma policies:
-- SELECT policyname, cmd, roles FROM pg_policies
-- WHERE tablename = 'ai_usage_log';
--
-- 4. Confirma índices:
-- SELECT indexname FROM pg_indexes
-- WHERE tablename = 'ai_usage_log';
-- ============================================================
