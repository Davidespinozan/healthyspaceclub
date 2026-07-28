-- David: press-horizontal-maquina-agarre-neutral-pecho-tricep es Press Horizontal EN
-- MÁQUINA (agarre neutro), estaba a nivel de Press Cerrado.
update public.exercise_videos set exercise_id='press-horizontal-maquina'
  where video_url like '%press-horizontal-maquina-agarre-neutral-pecho-tricep%' and exercise_id='press-cerrado';
