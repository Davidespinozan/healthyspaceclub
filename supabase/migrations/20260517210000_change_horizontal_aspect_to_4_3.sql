-- ============================================================
-- Alinear aspect ratios con la cámara nativa del iPhone
-- ============================================================
-- iPhone captura 3:4 (portrait) y 4:3 (landscape) por default. Antes
-- usábamos '4:5' y '16:9' que requerían crop del frame original.
-- Migramos posts viejos y actualizamos el CHECK constraint.
-- ============================================================

-- Migrar posts viejos a los nuevos valores
UPDATE club_posts SET aspect_ratio = '3:4' WHERE aspect_ratio = '4:5';
UPDATE club_posts SET aspect_ratio = '4:3' WHERE aspect_ratio = '16:9';

-- Recrear CHECK constraint
ALTER TABLE club_posts DROP CONSTRAINT IF EXISTS club_posts_aspect_ratio_check;
ALTER TABLE club_posts ADD CONSTRAINT club_posts_aspect_ratio_check
  CHECK (aspect_ratio IN ('1:1', '3:4', '4:3'));
