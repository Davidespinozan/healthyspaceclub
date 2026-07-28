-- David: las dos máquinas de remo neutro sentado son distintas — remo-maquina-espalda-sentado
-- es de POLEA y remo-sentado-agarre-neutro-maquina-espalda es de DISCOS. Se separan en dos
-- variantes. El de polea pasa a la variante nueva 'En máquina (polea)'.
update public.exercise_videos set exercise_id='remo-maquina-neutro-polea'
  where video_url like '%remo-maquina-espalda-sentado%' and exercise_id='remo-maquina-sentado-neutro';
