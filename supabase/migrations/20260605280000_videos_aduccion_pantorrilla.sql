-- Ejercicios nuevos en el banco (aducción + pantorrilla) → conectar sus videos.
-- Idempotente.
INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'aduccion-cadera-maquina',
       'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/aduccion-interna-pierna-maquina.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'aduccion-cadera-maquina');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'elevacion-talones-maquina-parada',
       'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/pantorrilla-maquina-parada.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'elevacion-talones-maquina-parada');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'elevacion-talones-smith',
       'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/elevacion-talones-smith-pantorrilla-pierna.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'elevacion-talones-smith');
