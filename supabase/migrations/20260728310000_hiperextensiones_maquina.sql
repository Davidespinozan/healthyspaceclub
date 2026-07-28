-- David: extension-espalda-baja-maquina-core es hiperextensiones EN MÁQUINA (estaba a
-- nivel patrón). Se mueve a la variante hiperextensiones-maquina.
update public.exercise_videos set exercise_id='hiperextensiones-maquina'
  where video_url like '%extension-espalda-baja-maquina-core%' and exercise_id='hiperextensiones';
