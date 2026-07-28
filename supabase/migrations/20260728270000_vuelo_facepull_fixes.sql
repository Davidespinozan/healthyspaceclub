-- David: correcciones de Jalón a la Cara y Vuelo Posterior.
-- 1) face-pull en TRX → variante propia 'En TRX' (estaba a nivel patrón).
update public.exercise_videos set exercise_id='face-pull-trx'
  where video_url like '%face-pull-en-trx%' and exercise_id='face-pull';
-- 2) vuelo posterior mancuernas: separar inclinado (banco) vs sentado.
update public.exercise_videos set exercise_id='vuelo-posterior-mancuernas-inclinado'
  where video_url like '%elevaciones-posteriores-con-mancuernas-en-banco%' and exercise_id='vuelo-posterior-mancuernas-sentado';
update public.exercise_videos set exercise_id='vuelo-posterior-mancuernas-sentado'
  where video_url like '%elevaciones-posteriores-laterales-con-mancuerna%' and exercise_id='vuelo-posterior';
-- 3) Curls duplicados/mal ejecutados a eliminar (David).
delete from public.exercise_videos where video_url like '%curl-de-biceps-con-mancuernas.mp4%';
delete from public.exercise_videos where video_url like '%curl-banco-curlscott-neutro-mancuerna-curlmartilloenscott%';
