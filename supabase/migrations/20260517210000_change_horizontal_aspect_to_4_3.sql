-- ============================================================
-- Cambiar el aspect ratio horizontal de 16:9 a 4:3
-- ============================================================
-- La cámara nativa del iPhone captura 4:3, no 16:9.
-- Cambiamos el CHECK constraint para aceptar 4:3 en vez de 16:9.
-- Posts viejos con 16:9 (si los hay) se migran a 4:3.
-- ============================================================

-- Migrar posts viejos con '16:9' a '4:3'
UPDATE club_posts SET aspect_ratio = '4:3' WHERE aspect_ratio = '16:9';

-- Recrear CHECK constraint
ALTER TABLE club_posts DROP CONSTRAINT IF EXISTS club_posts_aspect_ratio_check;
ALTER TABLE club_posts ADD CONSTRAINT club_posts_aspect_ratio_check
  CHECK (aspect_ratio IN ('1:1', '4:5', '4:3'));
