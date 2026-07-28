-- David: la flexión en rodillas buena es lagartijas-modificadas-pecho-triceps.mp4
-- (ya bien ubicada en 'En rodillas'). El otro video de rodillas
-- (flexiones-lagartijas-modificada-con-rodillas-abdomen) sobra → se elimina.
delete from public.exercise_videos
  where video_url like '%flexiones-lagartijas-modificada-con-rodillas-abdomen%';
