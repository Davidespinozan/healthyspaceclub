-- David (corrección final): pullover-con-liga-dorsal.mp4 es PULLOVER con
-- banda (no face pull). Se regresa a pullover-banda.
update public.exercise_videos set exercise_id='pullover-banda'
  where video_url like '%jalon-de-triceps-con-liga-triceps-core%' and exercise_id='face-pull-banda';
