-- ════════════════════════════════════════════════════════════════
-- LOTE 3b exercise_videos — 6 videos de GYM/ que NO tenían variante en el banco.
-- Se crearon las variantes en src/data/exercises.ts (regla de David: cada agarre /
-- posición / implemento distinto = ejercicio distinto):
--   · curl-inclinado (PATRÓN NUEVO, bíceps): mancuernas supino + martillo neutro
--   · curl-pie-mancuernas-isometrico (bíceps)
--   · extensiones-mancuerna-unilateral (tríceps, copa a una mano)
--   · press-landmine-unilateral (hombros)
--   · sentadilla-sumo-landmine (cuádriceps)
--
-- Idempotente: borra las filas de los exercise_id afectados y reinserta.
-- ════════════════════════════════════════════════════════════════

DELETE FROM exercise_videos WHERE exercise_id IN (
  'curl-inclinado-mancuernas',
  'curl-inclinado-martillo',
  'curl-pie-mancuernas-isometrico',
  'extensiones-mancuerna-unilateral',
  'press-landmine-unilateral',
  'sentadilla-sumo-landmine'
);

INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES
  ('curl-inclinado-mancuernas',        'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-de-bicep-en-banco-inclinado.mp4', 0),
  ('curl-inclinado-martillo',          'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-martillo-biceps-con-apoyo-en-banco-inclinado.mp4', 0),
  ('curl-pie-mancuernas-isometrico',   'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/Curl-de-bicep-con-isometrico.mp4', 0),
  ('extensiones-mancuerna-unilateral', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/copa-una-mano-triceps.mp4', 0),
  ('press-landmine-unilateral',        'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/ladminepress-conunamano-hombro.mp4', 0),
  ('sentadilla-sumo-landmine',         'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/sentadilla-en-sumo-con-mina.terrestre.mp4', 0);
