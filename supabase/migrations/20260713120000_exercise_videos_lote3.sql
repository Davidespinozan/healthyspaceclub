-- ════════════════════════════════════════════════════════════════
-- LOTE 3 exercise_videos — 12 videos nuevos de la carpeta GYM/ (subidos por David).
-- Bíceps (concentrado, mancuernas simultáneo/alternado, martillo, araña), tríceps
-- (patada), pecho (press inclinado mancuernas), hombros (remo al mentón mancuernas),
-- espalda (T-bar agarre estrecho), pierna (búlgara, step-up con salto y mancuernas).
--
-- Cierra 3 de los patrones que NO tenían NINGÚN video: curl-concentrado,
-- sentadilla-unilateral (búlgara) y step-up.
--
-- Idempotente: borra las filas de los exercise_id afectados y reinserta.
-- ════════════════════════════════════════════════════════════════

DELETE FROM exercise_videos WHERE exercise_id IN (
  'curl-concentrado-mancuerna',
  'curl-pie-mancuernas-simultaneo',
  'curl-pie-mancuernas-alternado',
  'curl-predicador-spider',
  'curl-martillo-mancuernas',
  'patada-triceps-mancuerna-banco',
  'press-inclinado-mancuernas',
  'upright-row-mancuernas',
  'remo-t-bar',
  'sentadilla-bulgara-mancuernas',
  'step-up-explosivo',
  'step-up-mancuernas'
);

INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES
  ('curl-concentrado-mancuerna',     'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/concentrado-mancuerna-bicep.mp4', 0),
  ('curl-pie-mancuernas-simultaneo', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/Curl-de-bicep-parado-con-mancuernas-al-ismo-tiempo.mp4', 0),
  ('curl-pie-mancuernas-alternado',  'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/Curl-de-bicep-parado-con-mancurna-uno-por-uno.mp4', 0),
  ('curl-predicador-spider',         'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-de-biceps-con-apoyo-en-banco-inclinado.mp4', 0),
  ('curl-martillo-mancuernas',       'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/martillo-bicep-parado-uno-por-uno.mp4', 0),
  ('patada-triceps-mancuerna-banco', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/patada-mancuerna-tricep.mp4', 0),
  ('press-inclinado-mancuernas',     'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-pecho-mancuerna-inclinado.mp4', 0),
  ('upright-row-mancuernas',         'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/remo-al-menton-con-mancuernas.mp4', 0),
  ('remo-t-bar',                     'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/remo-en-punta-con-agarre-estrecho-espalda.mp4', 0),
  ('sentadilla-bulgara-mancuernas',  'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/sentadilla.bulgara.mp4', 0),
  ('step-up-explosivo',              'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/setup-consalto-o-subida-a-banco-con-salto.mp4', 0),
  ('step-up-mancuernas',             'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/setup-pierna-con-banco-con-mancuerna.mp4', 0);
