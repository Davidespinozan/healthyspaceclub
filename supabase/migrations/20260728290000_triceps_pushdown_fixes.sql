-- David: 1) extension-tricep-polea-alta es el push-down UNILATERAL (un brazo).
--        2) triceps-push-down-barra-recta.mp4 en realidad es BARRA RECTA (Magaly se equivocó);
--           el video con cuerda aún no se sube → la cuerda queda por grabar.
update public.exercise_videos set exercise_id='triceps-push-down-unilateral'
  where video_url like '%extension-tricep-polea-alta%' and exercise_id='triceps-push-down';
update public.exercise_videos set exercise_id='triceps-push-down-barra-recta'
  where video_url like '%triceps-push-down-barra-recta.mp4%' and exercise_id='triceps-push-down-cuerda';
