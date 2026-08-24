-- ════════════════════════════════════════════════════════════════
-- SOCIAL-1 · photo_urls schema closure.
-- CreatePostModal/PostCard ya usan `photo_urls` (multi-imagen) en producción,
-- pero la columna nunca se versionó en migrations → una BD fresca provisionada
-- desde migrations rompía en cada INSERT de post ("column photo_urls does not
-- exist"). Esta migration es ADITIVA e IDEMPOTENTE y cierra ese drift.
--
-- Contrato:
--   • photo_url  (legacy, single-image) sigue siendo válido y se sigue leyendo.
--   • photo_urls (text[] NULL) permite multi-imagen; NULL = post single/legacy.
--   • posts históricos no se reescriben.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE club_posts
  ADD COLUMN IF NOT EXISTS photo_urls text[];

COMMENT ON COLUMN club_posts.photo_urls IS
  'Multi-imagen (array de URLs públicas del bucket club). NULL = post single-image (usa photo_url).';
