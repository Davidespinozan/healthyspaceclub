-- Variante nueva: press horizontal en máquina con agarre neutro (énfasis tríceps).
-- Confirmado por David. Archivo en GYM/.
INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'press-horizontal-maquina-neutral',
       'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-horizontal-maquina-agarre-neutral-pecho-tricep.mp4',
       0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'press-horizontal-maquina-neutral');
