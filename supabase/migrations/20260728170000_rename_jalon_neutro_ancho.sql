-- David renombró en storage: jalon-neutro-amplio... → jalon-al-pecho-polea-alta-agarre-neutro-ancho...
-- (es el jalón al pecho en polea alta, agarre neutro ancho). Reescribe la URL en la tabla viva.
update public.exercise_videos set video_url = replace(video_url,
  'jalon-neutro-amplio-espalda-maquina.mp4', 'jalon-al-pecho-polea-alta-agarre-neutro-ancho-espalda.mp4')
  where video_url like '%jalon-neutro-amplio-espalda-maquina.mp4%';
