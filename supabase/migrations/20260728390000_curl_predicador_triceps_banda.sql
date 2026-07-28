-- David: 1) curl-de-biceps-con-apoyo-en-banco-inclinado es predicador banco inclinado
--           AGARRE NORMAL (supino), no curl araña. Curl araña queda vacío (sin video).
--        2) curl-martillo-...-banco-inclinado es el mismo pero MARTILLO (ya en su variante).
--        3) extension-de-triceps-atras-con-liga es extensión de tríceps EN POLEA con banda
--           (no sobre cabeza) → triceps-push-down-banda.
update public.exercise_videos set exercise_id='curl-predicador-banco-inclinado-supino'
  where video_url like '%curl-de-biceps-con-apoyo-en-banco-inclinado%' and exercise_id='curl-predicador-spider';
update public.exercise_videos set exercise_id='triceps-push-down-banda'
  where video_url like '%extension-de-triceps-atras-con-liga-triceps%' and exercise_id='extensiones-banda-anclada';
