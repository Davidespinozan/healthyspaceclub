-- David: cruces-de-polea-alta-agarre-prono simula el PRESS con mancuernas (no es apertura).
-- Polea alta + empuje al frente/abajo + pecho inferior = press declinado en polea.
-- Nueva variante press-declinado-polea → se conecta el video.
insert into public.exercise_videos (exercise_id, variant_id, video_url, label, display_order)
select v.ex, null, v.url, 'Ejecución', 0 from (values
  ('press-declinado-polea', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/cruces-de-polea-alta-agarre-prono-en-maquina-pecho-inferior.mp4')
  ) as v(ex, url)
 where not exists (select 1 from public.exercise_videos e where e.video_url = v.url);
