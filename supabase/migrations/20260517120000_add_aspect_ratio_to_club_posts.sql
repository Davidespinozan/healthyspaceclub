-- ============================================================
-- Agregar aspect_ratio a club_posts
-- ============================================================
-- Posts viejos default a '1:1' (refleja lo que está realmente en storage:
-- compressImageSquare siempre escribió 1080×1080 cuadrado). El CSS forzaba
-- visualmente 4:5 con object-fit:cover, ocultando parte de la imagen.
-- Este cambio honra los bytes reales y agrega 4:5 + 16:9 como opciones para
-- posts nuevos.
--
-- text + CHECK (no enum) para que agregar un cuarto ratio en el futuro sea
-- un simple ALTER CONSTRAINT en lugar de ALTER TYPE bloqueante.
-- ============================================================

ALTER TABLE club_posts
  ADD COLUMN IF NOT EXISTS aspect_ratio text NOT NULL DEFAULT '1:1'
    CHECK (aspect_ratio IN ('1:1', '4:5', '16:9'));
