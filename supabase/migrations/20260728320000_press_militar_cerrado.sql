-- David: press-militar-barra-agarre-cerrado-hombro.mp4 NO es agarre supino, es agarre
-- CERRADO. Se renombra la variante press-militar-supino → press-militar-cerrado.
update public.exercise_videos set exercise_id='press-militar-cerrado'
  where video_url like '%press-militar-barra-agarresupino-hombro%' and exercise_id='press-militar-supino';
