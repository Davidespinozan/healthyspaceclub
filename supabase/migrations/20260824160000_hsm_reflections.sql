-- ════════════════════════════════════════════════════════════════
-- MINDSET-1 · Persistencia durable de "Tu Espacio" (reflexiones HSM).
-- Contenido de journal = dato SENSIBLE. Tablas user-scoped, RLS own-only
-- (sin lectura anon, sin admin de rutina, nunca en public_profiles/Club).
-- Patrón espejo de nutrition_day_summary. Aditiva e idempotente.
-- ════════════════════════════════════════════════════════════════

-- ── RAW: una fila por pregunta respondida por día ───────────────────────────
CREATE TABLE IF NOT EXISTS hsm_reflections (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reflection_date date NOT NULL,                 -- dayKey local del dispositivo
  dimension_id   text NOT NULL,                  -- id ESTABLE (no título localizado)
  question_index smallint NOT NULL DEFAULT -1,   -- índice en el banco, -1 si legacy/desconocido
  question_key   text NOT NULL,                  -- identidad estable de pregunta
  question_text  text NOT NULL DEFAULT '',       -- SNAPSHOT histórico (sobrevive cambios de banco)
  response       text NOT NULL CHECK (char_length(response) <= 2000),
  safety_level   text NOT NULL DEFAULT 'NORMAL' CHECK (safety_level IN ('NORMAL','CONCERNING','URGENT')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, reflection_date, question_key)   -- idempotencia + clave de edición
);
CREATE INDEX IF NOT EXISTS idx_hsm_reflections_user_date
  ON hsm_reflections (user_id, reflection_date);

ALTER TABLE hsm_reflections ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "hsm_reflections select own" ON hsm_reflections FOR SELECT USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "hsm_reflections insert own" ON hsm_reflections FOR INSERT WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "hsm_reflections update own" ON hsm_reflections FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "hsm_reflections delete own" ON hsm_reflections FOR DELETE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── DERIVED: reseña diaria (una por día) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS hsm_daily_reviews (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reflection_date date NOT NULL,
  review         text NOT NULL DEFAULT '',
  source         text NOT NULL DEFAULT 'base' CHECK (source IN ('ai','base','safe')),
  model          text,
  safety_level   text NOT NULL DEFAULT 'NORMAL' CHECK (safety_level IN ('NORMAL','CONCERNING','URGENT')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, reflection_date)
);
ALTER TABLE hsm_daily_reviews ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "hsm_daily_reviews select own" ON hsm_daily_reviews FOR SELECT USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "hsm_daily_reviews insert own" ON hsm_daily_reviews FOR INSERT WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "hsm_daily_reviews update own" ON hsm_daily_reviews FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "hsm_daily_reviews delete own" ON hsm_daily_reviews FOR DELETE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── DERIVED: perfil acumulado (uno por usuario) ─────────────────────────────
CREATE TABLE IF NOT EXISTS hsm_profiles (
  user_id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  profile              text NOT NULL DEFAULT '',
  source_response_count integer NOT NULL DEFAULT 0,
  model                text,
  generated_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE hsm_profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "hsm_profiles select own" ON hsm_profiles FOR SELECT USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "hsm_profiles insert own" ON hsm_profiles FOR INSERT WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "hsm_profiles update own" ON hsm_profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "hsm_profiles delete own" ON hsm_profiles FOR DELETE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TABLE hsm_reflections IS 'MINDSET-1 · reflexiones HSM (journal). RLS own-only; nunca público/Club/admin-rutina.';
