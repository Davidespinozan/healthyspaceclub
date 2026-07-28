-- David: dos press militar en Smith — parado y sentado. El sentado sale a su variante nueva.
update public.exercise_videos set exercise_id='press-smith-sentado'
  where video_url like '%press-militar-sentado-en-maquina-smith-hombros-triceps%' and exercise_id='press-smith';
