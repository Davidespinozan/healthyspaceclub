-- David: remo-maquina-espalda-sentado.mp4 es un remo NEUTRO sentado en máquina con pecho
-- apoyado (casi igual al remo-sentado-agarre-neutro). Se mueve a Remo Neutro · En máquina.
update public.exercise_videos set exercise_id='remo-maquina-sentado-neutro'
  where video_url like '%remo-maquina-espalda-sentado%' and exercise_id='remo-maquina-sentado';
