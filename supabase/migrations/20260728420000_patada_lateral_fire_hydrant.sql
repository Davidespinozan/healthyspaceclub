-- David: dos fire hydrant (patada lateral en cuadrupedia): uno peso corporal, uno con banda.
-- 1) patada-de-gluteo-en-cuadrupedia (bodyweight) estaba mal en Patada de Glúteo → es fire
--    hydrant → abduccion-cadera-cuadrupedia.
-- 2) patada-lateral-en-cuadrupedia-con-banda → variante con banda nueva.
update public.exercise_videos set exercise_id='abduccion-cadera-cuadrupedia'
  where video_url like '%patada-de-gluteo-en-cuadrupedia-gluteos-isquiotibiales%' and exercise_id='patada-gluteo-cuadrupedia-sin-peso';
update public.exercise_videos set exercise_id='abduccion-cadera-cuadrupedia-banda'
  where video_url like '%patada-lateral-en-cuadrupedia-con-banda-gluteo-medio%' and exercise_id='abduccion-cadera-cuadrupedia';
