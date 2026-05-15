-- ════════════════════════════════════════════════════════════════════
-- supabase_exercise_videos.sql
-- ════════════════════════════════════════════════════════════════════
-- Purpose: Store video URLs per exercise + optional variant.
--          Supports the future "pattern + variants" model where one
--          movement pattern (e.g. 'press-horizontal') has N variants
--          (barra, mancuernas, máquina, etc.) — each variant may have
--          its own video.
--
-- ⚠️  THIS FILE OVERWRITES the previous supabase_exercise_videos.sql
--     whose schema (exercise_name, variation, equipment) was not what
--     the application actually uses. The application queries by
--     exercise_id + label + display_order — matching this new schema.
--
-- Run this in Supabase Dashboard → SQL Editor.
-- Idempotent: safe to re-run.
-- ⚠️  If your production table already has the OLD shape, you must
--     migrate the data before applying this. See the migration notes
--     at the bottom of this file.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS exercise_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id text NOT NULL,
  variant_id text,
  video_url text NOT NULL,
  label text NOT NULL DEFAULT 'Ejecución',
  thumbnail_url text,
  display_order integer NOT NULL DEFAULT 0,
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- One video per (exercise, variant, slot)
  UNIQUE(exercise_id, variant_id, display_order)
);

-- ─── Índices ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_exercise_videos_exercise
  ON exercise_videos(exercise_id);

CREATE INDEX IF NOT EXISTS idx_exercise_videos_variant
  ON exercise_videos(exercise_id, variant_id);

-- ─── RLS ───────────────────────────────────────────────────────────
ALTER TABLE exercise_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read exercise videos" ON exercise_videos;
CREATE POLICY "Anyone can read exercise videos" ON exercise_videos
  FOR SELECT USING (true);

-- For now anon can write — tighten when admin auth exists
DROP POLICY IF EXISTS "Anyone can insert videos for now" ON exercise_videos;
CREATE POLICY "Anyone can insert videos for now" ON exercise_videos
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update videos for now" ON exercise_videos;
CREATE POLICY "Anyone can update videos for now" ON exercise_videos
  FOR UPDATE USING (true);

-- ─── Comentarios ───────────────────────────────────────────────────
COMMENT ON COLUMN exercise_videos.exercise_id IS
  'ID del patrón en exercises.ts (ej. "press-horizontal"). El código consulta por esta columna.';

COMMENT ON COLUMN exercise_videos.variant_id IS
  'ID de la variante específica (ej. "press-horizontal-barra"). NULL si el video aplica al patrón en general.';

COMMENT ON COLUMN exercise_videos.label IS
  'Etiqueta visible del video: "Ejecución" (default) | "Ángulo lateral" | "Vista superior" | etc.';

COMMENT ON COLUMN exercise_videos.display_order IS
  'Orden de aparición en el carrusel del popout. 0 = primero. Único por (exercise_id, variant_id).';

COMMENT ON COLUMN exercise_videos.duration_seconds IS
  'Duración del video en segundos (opcional, para UI).';

-- ─── Notas de migración desde el schema anterior ───────────────────
-- El schema anterior tenía: (exercise_name text, variation text,
-- video_url text, equipment text, UNIQUE(exercise_name, variation)).
--
-- Para migrar datos existentes (si tu tabla en producción aún tiene
-- el schema viejo), ejecuta MANUALMENTE algo como:
--
--   ALTER TABLE exercise_videos RENAME COLUMN exercise_name TO exercise_id;
--   ALTER TABLE exercise_videos RENAME COLUMN variation TO variant_id;
--   ALTER TABLE exercise_videos ALTER COLUMN variant_id DROP NOT NULL;
--   ALTER TABLE exercise_videos ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT 'Ejecución';
--   ALTER TABLE exercise_videos ADD COLUMN IF NOT EXISTS thumbnail_url text;
--   ALTER TABLE exercise_videos ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;
--   ALTER TABLE exercise_videos ADD COLUMN IF NOT EXISTS duration_seconds integer;
--   ALTER TABLE exercise_videos ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
--   ALTER TABLE exercise_videos DROP COLUMN IF EXISTS equipment;
--   ALTER TABLE exercise_videos DROP CONSTRAINT IF EXISTS exercise_videos_exercise_name_variation_key;
--   ALTER TABLE exercise_videos ADD CONSTRAINT exercise_videos_unique_slot UNIQUE(exercise_id, variant_id, display_order);
--
-- Verifica con SELECT * FROM exercise_videos LIMIT 5; antes y después.
