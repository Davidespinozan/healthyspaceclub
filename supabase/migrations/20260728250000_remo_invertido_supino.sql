-- David: remo-invertido-agarre-supino... → variante 'Agarre supino' de Remo Invertido
-- (lo que lo diferencia es el agarre supino, no el Smith).
insert into public.exercise_videos (exercise_id, variant_id, video_url, label, display_order)
select v.ex, null, v.url, 'Ejecución', 0 from (values
  ('remo-invertido-supino', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/remo-invertido-agarre-supino-en-maquina-smith-espalda-y-biceps.mp4')
  ) as v(ex, url)
 where not exists (select 1 from public.exercise_videos e where e.video_url = v.url);
