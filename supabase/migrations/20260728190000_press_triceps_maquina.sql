-- David: fondos-triceps-maquina.mp4 es un press de tríceps sentado en máquina (máquina
-- poco común) → ejercicio propio 'Press de Tríceps en Máquina'. Se mueve el video ahí.
update public.exercise_videos set exercise_id='press-triceps-maquina-sentado'
  where video_url like '%GYM/fondos-triceps-maquina.mp4%' and exercise_id='fondos-triceps-maquina';
