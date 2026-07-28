-- David: 1) curl-de-biceps-con-barra-recta-en-polea-baja... en realidad es ENCOGIMIENTOS
--           de trapecio con barra en polea (mal nombrado) → shrugs-polea.
--        2) curl-de-biceps-con-liga-agarre-supino: eliminar (mismo que unilateral con banda).
update public.exercise_videos set exercise_id='shrugs-polea'
  where video_url like '%curl-de-biceps-con-barra-recta-en-polea-baja-en-maquina-biceps%' and exercise_id='curl-pie-polea-barra';
delete from public.exercise_videos where video_url like '%curl-de-biceps-con-liga-agarre-supino-biceps%';
