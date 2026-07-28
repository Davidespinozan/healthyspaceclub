-- David: upright-row-barra-al-pecho.mp4 es remo al mentón EN SMITH → variante nueva.
-- Resuelve la colisión de 'Con barra' (queda con remo-al-cuello-barra-hombro-trapecio).
update public.exercise_videos set exercise_id='upright-row-smith'
  where video_url like '%upright-row-barra-al-pecho%' and exercise_id='upright-row-barra';
