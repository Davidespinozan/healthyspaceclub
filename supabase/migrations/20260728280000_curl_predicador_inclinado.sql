-- David: curl-martillo-biceps-con-apoyo-en-banco-inclinado.mp4 es un predicador con banca
-- inclinada (variación del scott con mancuerna una mano), NO el curl araña ni el curl
-- inclinado martillo (ese aún falta grabar). Se mueve a la variante nueva.
update public.exercise_videos set exercise_id='curl-predicador-banco-inclinado'
  where video_url like '%curl-martillo-biceps-con-apoyo-en-banco-inclinado%' and exercise_id='curl-inclinado-martillo';
