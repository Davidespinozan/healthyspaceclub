-- ════════════════════════════════════════════════════════════════════
-- supabase_user_preferences.sql
-- ════════════════════════════════════════════════════════════════════
-- Purpose: Capture deep knowledge about each user so the AI coach can
--          personalize beyond the basic obData captured in onboarding.
--
-- Today's obData only has: name, sex, edad, peso, estatura, goal,
-- activity. This table adds:
--   - level / years training
--   - permanent injuries (vs the daily discomfort/painArea)
--   - typical equipment availability (vs the day's selection)
--   - preferred + blocked exercises
--   - typical duration + days/week
--   - coaching style preference
--
-- One row per user (PRIMARY KEY = user_id).
--
-- Run this in Supabase Dashboard → SQL Editor.
-- Idempotent: safe to re-run.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Perfil físico extendido
  nivel text,
  experiencia_anos integer,

  -- Lesiones / restricciones permanentes
  lesiones jsonb DEFAULT '[]'::jsonb,

  -- Equipo disponible típico
  equipment_default jsonb DEFAULT '["gym"]'::jsonb,
  equipment_notes text,

  -- Preferencias de ejercicios
  preferred_exercises text[] DEFAULT ARRAY[]::text[],
  blocked_exercises text[] DEFAULT ARRAY[]::text[],

  -- Disponibilidad típica
  preferred_duration integer DEFAULT 45,
  preferred_days_per_week integer,

  -- Coaching style preference
  coaching_intensity text DEFAULT 'balanced',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ─── RLS ───────────────────────────────────────────────────────────
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own preferences" ON user_preferences;
CREATE POLICY "Users can read own preferences" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
CREATE POLICY "Users can insert own preferences" ON user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
CREATE POLICY "Users can update own preferences" ON user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- ─── Comentarios ───────────────────────────────────────────────────
COMMENT ON COLUMN user_preferences.nivel IS
  'principiante | intermedio | avanzado';

COMMENT ON COLUMN user_preferences.experiencia_anos IS
  'Años entrenando con cierta consistencia.';

COMMENT ON COLUMN user_preferences.lesiones IS
  'Lesiones permanentes — distintas del discomfort puntual del día. Shape: [{ area: "hombro", side: "derecho"|"izquierdo"|"ambos", severity: "leve"|"moderada"|"severa", notes: string }]';

COMMENT ON COLUMN user_preferences.equipment_default IS
  'Array JSON de equipos típicamente disponibles para el usuario (ej. ["gym","cuerpo","ligas"]). Distinto de la selección puntual del día.';

COMMENT ON COLUMN user_preferences.equipment_notes IS
  'Texto libre sobre setup. Ej. "tengo gym en casa con barra, mancuernas hasta 30kg, banco plano".';

COMMENT ON COLUMN user_preferences.preferred_exercises IS
  'IDs de ejercicios que al usuario le gustan — sesgar hacia estos cuando aplique.';

COMMENT ON COLUMN user_preferences.blocked_exercises IS
  'IDs de ejercicios que el usuario NO quiere recibir (ej. "no me gustan los burpees").';

COMMENT ON COLUMN user_preferences.preferred_duration IS
  'Duración típica preferida en minutos. Default 45.';

COMMENT ON COLUMN user_preferences.preferred_days_per_week IS
  'Cuántos días entrena por semana típicamente. Útil para detectar drift y motivar.';

COMMENT ON COLUMN user_preferences.coaching_intensity IS
  'gentle | balanced | intense — tono del coach IA. Default balanced.';
