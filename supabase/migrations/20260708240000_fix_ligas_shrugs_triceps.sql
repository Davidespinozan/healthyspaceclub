-- Correcciones de mapeo (David, revisando los videos):
--   elevacion-diagonal-banda.mp4        → es ENCOGIMIENTOS de trapecio  → shrugs-banda
--   extension-triceps-unilateral-banda  → es tríceps COPA (sobre cabeza) → extensiones-banda-anclada
-- Idempotente (fija por video_url).

UPDATE exercise_videos SET exercise_id = 'shrugs-banda'
  WHERE video_url LIKE '%LIGAS/elevacion-diagonal-banda.mp4';

UPDATE exercise_videos SET exercise_id = 'extensiones-banda-anclada'
  WHERE video_url LIKE '%LIGAS/extension-triceps-unilateral-banda.mp4';
