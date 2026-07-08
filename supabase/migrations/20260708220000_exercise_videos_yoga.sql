-- ─────────────────────────────────────────────────────────────────────────
-- Videos de YOGA (carpeta storage YOGA/) → conectados a las poses del banco.
-- Videos por exercise_id (= id de la pose). Poses con 2+ videos usan
-- display_order para elegir el primario. Idempotente: limpia YOGA/ y reinserta.
-- FLOWS (secuencias) mapeados a la pose más representativa de la secuencia.
-- ─────────────────────────────────────────────────────────────────────────

DELETE FROM exercise_videos WHERE video_url LIKE '%/YOGA/%';

INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES
  -- ── Poses sueltas ──
  ('boat-pose',           'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/boat-pose.mp4', 0),
  ('bridge-pose',         'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/bridge-pose.mp4', 0),
  ('camel-pose',          'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/camel-pose.mp4', 0),
  ('cat-cow',             'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/cat-cow.mp4', 0),
  ('child-pose',          'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/child-pose.mp4', 0),
  ('child-pose',          'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/child-pose2.mp4', 1),
  ('lizard-lunge',        'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/lizard-lunge.mp4', 0),
  ('pigeon-pose',         'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/pigeon-pose.mp4', 0),
  ('pigeon-pose',         'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/pigeon-pose2.mp4', 1),
  ('puppy-pose',          'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/puppy-pose.mp4', 0),
  ('revolved-chair',      'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/revolved-chair.mp4', 0),
  ('seated-forward-fold', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/seated-forward-fold.mp4', 0),
  ('seated-twist',        'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/seated-twist.mp4', 0),
  ('side-plank-yoga',     'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/side-plank-yoga.mp4', 0),
  ('triangle-pose',       'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/triangle-pose.mp4', 0),
  ('wheel-pose',          'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/wheel-pose.mp4', 0),
  -- ── Saludos al sol ──
  ('sun-salutation-a',    'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/sun-salutation.mp4', 0),
  ('sun-salutation-a',    'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/sun-salutation2.mp4', 1),
  ('sun-salutation-a',    'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/sun-salutation3.mp4', 2),
  ('sun-salutation-a',    'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/warrior1-sun-salutation.mp4', 3),
  ('sun-salutation-b',    'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-sunsalutation-warrior1-warrior2-reversewarrior-.mp4', 0),
  -- ── Flows de guerrero ──
  ('warrior-i',           'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-warrior.mp4', 0),
  ('warrior-ii',          'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-warrior1-warrio2-reversewarrior-extendedsideangle-boundsideanglepose.mp4', 0),
  ('reverse-warrior',     'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/warrior1-warrior2-reversewarrior-.mov.mp4', 0),
  -- ── Otros flows → pose representativa ──
  ('low-lunge',           'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-lowlunge-revolvedlunge.mp4', 0),
  ('chair-pose',          'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-chair-revolvedchair.mp4', 0),
  ('supine-twist',        'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-happybaby-supinetwist.mp4', 0),
  ('child-pose',          'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-cierre-kneestochest.mp4', 2);
