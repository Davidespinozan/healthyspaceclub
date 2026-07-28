-- David: remo-pendlay-agarre-supino → variante 'Pendlay (supino)' en Remo Supino.
insert into public.exercise_videos (exercise_id, variant_id, video_url, label, display_order)
select v.ex, null, v.url, 'Ejecución', 0 from (values
  ('remo-barra-pendlay-supino', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/remo-pendlay-agarre-supino-espalda-y-biceps.mp4')
  ) as v(ex, url)
 where not exists (select 1 from public.exercise_videos e where e.video_url = v.url);
