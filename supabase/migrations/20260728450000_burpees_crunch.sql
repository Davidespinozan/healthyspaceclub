-- David:
-- 1) burpees.mov: eliminar (igual que burpees-con-salto-full-body, que se queda).
-- 2) medio-burpee-con-salto: es el SPRAWL (estaba en burpee-sin-flexión) → sprawl.
-- 3) abdominales-crunch-declinado-con-disco: es el ABDOMINAL DECLINADO (fusión con
--    crunch con disco) → decline-sit-up. Variante 'Crunch con disco' eliminada.
delete from public.exercise_videos where video_url like '%GYM/burpees.mov%';
update public.exercise_videos set exercise_id='sprawl'
  where video_url like '%medio-burpee-con-salto-abdomen-y-piernas%' and exercise_id='burpee-sin-flexion';
update public.exercise_videos set exercise_id='decline-sit-up'
  where video_url like '%abdominales-crunch-declinado-con-disco-abdomen-alto-core%' and exercise_id='crunch-con-peso';
delete from public.exercise_videos where exercise_id='crunch-con-peso';
