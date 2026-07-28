-- David: cuerdas-de-batalla-en-sentadilla = onda alterna (estaba a nivel patrón);
-- simultaneo-cuerdas = slams (estaba en doble onda). 'Doble onda' se elimina (= slams).
update public.exercise_videos set exercise_id='battle-ropes-onda-alterna'
  where video_url like '%cuerdas-de-batalla-en-sentadilla-hombros-core-piernas%' and exercise_id='battle-ropes';
update public.exercise_videos set exercise_id='battle-ropes-slams'
  where video_url like '%simultaneo-cuerdas-de-batalla-con-ambas-manos%' and exercise_id='battle-ropes-doble-onda';
delete from public.exercise_videos where exercise_id='battle-ropes-doble-onda';
