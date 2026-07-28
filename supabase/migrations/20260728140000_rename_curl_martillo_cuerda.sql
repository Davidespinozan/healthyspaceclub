-- David renombró en storage: elevaciones-laterales... (mal nombrado por Magaly) →
-- curl-martillo-con-cuerda... (es curl martillo con cuerda en polea, no elevación lateral).
-- Reescribe la URL en la tabla viva. Idempotente.
update public.exercise_videos set video_url = replace(video_url,
  'elevaciones-laterales-a-una-mano-en-polea-baja-en-maquina-hombro.mp4', 'curl-martillo-con-cuerda-en-polea-baja-biceps.mp4')
  where video_url like '%elevaciones-laterales-a-una-mano-en-polea-baja-en-maquina-hombro.mp4%';
