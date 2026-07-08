-- ─────────────────────────────────────────────────────────────────────────
-- Videos de LIGAS / banda (carpeta storage LIGAS/) → conectados a las variantes
-- de banda del banco de ejercicios. Los videos de variante se guardan con
-- exercise_id = id de la variante (ej. 'press-horizontal-banda'), que es como
-- los busca WorkoutPlayer/WorkoutPlan (in exercise_id: [base, ...variantes]).
-- Idempotente: limpia los LIGAS/ previos y reinserta.
-- ─────────────────────────────────────────────────────────────────────────

DELETE FROM exercise_videos WHERE video_url LIKE '%/LIGAS/%';

INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES
  ('abduccion-cadera-banda-tobillos', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LIGAS/abduccion-cadera-pie-banda.mp4', 0),
  ('aperturas-banda',                 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LIGAS/aperturas-pecho-banda.mp4', 0),
  ('good-morning-banda',              'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LIGAS/buenos-dias-banda.mp4', 0),
  ('curl-pie-banda',                  'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LIGAS/curl-biceps-banda.mp4', 0),
  ('curl-concentrado-banda',          'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LIGAS/curl-biceps-concentrado-banda.mp4', 0),
  ('elevacion-frontal-banda',         'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LIGAS/elevaciones-frontales-banda.mp4', 0),
  ('elevacion-lateral-banda',         'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LIGAS/elevaciones-laterales-banda.mp4', 0),
  ('extension-cuadriceps-banda',      'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LIGAS/extension-pierna-sentado-banda.mp4', 0),
  ('triceps-push-down-banda',         'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LIGAS/extension-triceps-unilateral-banda.mp4', 0),
  ('face-pull-banda',                 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LIGAS/face-pull-banda.mp4', 0),
  ('patada-gluteo-banda',             'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LIGAS/patada-gluteo-banda.mp4', 0),
  ('patada-triceps-banda',            'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LIGAS/patada-triceps-banda.mp4', 0),
  ('peso-muerto-rumano-banda',        'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LIGAS/peso-muerto-banda.mp4', 0),
  ('peso-muerto-unilateral-banda',    'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LIGAS/peso-muerto-unilateral-banda.mp4', 0),
  ('press-banda',                     'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LIGAS/press-militar-unilateral-banda.mp4', 0),
  ('press-horizontal-banda',          'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LIGAS/press-pecho-banda.mp4', 0),
  ('vuelo-posterior-banda',           'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LIGAS/pull-apart-banda.mp4', 0),
  ('upright-row-banda',               'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LIGAS/remo-vertical-banda.mp4', 0),
  ('woodchopper-banda',               'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LIGAS/rotacion-core-banda.mp4', 0),
  ('sentadilla-con-banda',            'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LIGAS/sentadilla-banda.mp4', 0);

-- 4 variantes nuevas de banda (agregadas al banco en exercises.ts).
INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES
  ('curl-pie-banda-unilateral', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LIGAS/curl-biceps-unilateral-banda.mp4', 0),
  ('elevacion-diagonal-banda',  'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LIGAS/elevacion-diagonal-banda.mp4', 0),
  ('remo-horizontal-banda',     'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LIGAS/remo-banda.mp4', 0),
  ('remo-inclinado-banda',      'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LIGAS/remo-inclinado-banda.mp4', 0);
