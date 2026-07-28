-- David: los dos cruces "sin conectar" son woodchoppers (leñador rotacional):
--   cruces-de-polea-baja-agarre-supino → woodchopper polea baja
--   cruces-de-polea-alta-a-baja        → woodchopper polea alta
insert into public.exercise_videos (exercise_id, variant_id, video_url, label, display_order)
select v.ex, null, v.url, 'Ejecución', 0 from (values
  ('woodchopper-polea-baja', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/woodchopper-polea-baja-oblicuos-core.mp4'),
  ('woodchopper-polea-alta', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/woodchopper-polea-alta-oblicuos-core.mp4')
  ) as v(ex, url)
 where not exists (select 1 from public.exercise_videos e where e.video_url = v.url);
-- el "alta" tenía una fila vieja en aperturas-polea-cruce → moverla
update public.exercise_videos set exercise_id='woodchopper-polea-alta'
  where video_url like '%cruces-de-polea-alta-a-baja-pecho-inferior-hombros%' and exercise_id<>'woodchopper-polea-alta';
