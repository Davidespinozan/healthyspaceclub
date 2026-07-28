-- David: remo-con-barra-agarre-prono-espalda.mp4 es un remo PENDLAY pronado
-- (estaba en remo-barra-abierto). Se mueve a la variante Pendlay.
update public.exercise_videos set exercise_id='remo-barra-pendlay'
  where video_url like '%remo-con-barra-agarre-prono-espalda%' and exercise_id='remo-barra-abierto';
