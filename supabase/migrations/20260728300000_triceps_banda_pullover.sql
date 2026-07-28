-- David: 1) extension-de-triceps-atras-con-liga es la extensión sobre cabeza con banda
--           (estaba mal en patada con banda).
--        2) jalon-de-triceps-con-liga-core en realidad es un pullover con banda
--           (estaba en push-down con banda).
update public.exercise_videos set exercise_id='extensiones-banda-anclada'
  where video_url like '%extension-de-triceps-atras-con-liga-triceps%' and exercise_id='patada-triceps-banda';
update public.exercise_videos set exercise_id='pullover-banda'
  where video_url like '%jalon-de-triceps-con-liga-triceps-core%' and exercise_id='triceps-push-down-banda';
