-- Video de ejecución para el ejercicio "Press Horizontal" (pecho).
INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'press-horizontal',
       'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CONTENCION_comprimido.mp4',
       0
WHERE NOT EXISTS (
  SELECT 1 FROM exercise_videos
  WHERE exercise_id = 'press-horizontal'
    AND video_url = 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CONTENCION_comprimido.mp4'
);
