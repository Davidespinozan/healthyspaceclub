-- Corrección (David): los dos videos de remo con banda estaban al revés.
--   remo-banda.mp4           → en realidad es remo INCLINADO  → remo-inclinado-banda
--   remo-inclinado-banda.mp4 → en realidad es remo HORIZONTAL → remo-horizontal-banda
-- Idempotente (fija por video_url).

UPDATE exercise_videos SET exercise_id = 'remo-inclinado-banda'
  WHERE video_url LIKE '%LIGAS/remo-banda.mp4';

UPDATE exercise_videos SET exercise_id = 'remo-horizontal-banda'
  WHERE video_url LIKE '%LIGAS/remo-inclinado-banda.mp4';
