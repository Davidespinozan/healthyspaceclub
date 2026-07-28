-- David: eliminar 'Remo Pronado Cerrado' (el agarre cerrado en remo no se ve bien; el
-- pronado ya queda completo en 'Remo Pronado Abierto' con barra, pendlay y máquina).
-- El video remo-enpronacion-...agarrecerrado estuvo mal ejecutado → se elimina.
delete from public.exercise_videos
  where video_url like '%remo-enpronacion-barra-espalda-agarrecerrado-espaldamediabaja%';
-- por si quedara alguna fila en la variante eliminada:
delete from public.exercise_videos where exercise_id='remo-barra-pronado';
