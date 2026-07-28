-- David (corrección): jalon-de-triceps-con-liga-triceps-core.mp4 va en FACE PULL con banda
-- (lo había puesto en pullover con banda). Pullover con banda queda por grabar.
update public.exercise_videos set exercise_id='face-pull-banda'
  where video_url like '%jalon-de-triceps-con-liga-triceps-core%' and exercise_id='pullover-banda';
