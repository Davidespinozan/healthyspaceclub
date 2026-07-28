-- David: dejar Curl Martillo en Banca Scott y Curl Predicador banco inclinado martillo
-- como ejercicios separados (Scott = pad fijo, banco inclinado = respaldo en ángulo).
-- Se restaura el video de Scott que se había borrado.
insert into public.exercise_videos (exercise_id, variant_id, video_url, label, display_order)
select v.ex, null, v.url, 'Ejecución', 0 from (values
  ('curl-martillo-scott', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-banco-curlscott-neutro-mancuerna-curlmartilloenscott.mp4')
  ) as v(ex, url)
 where not exists (select 1 from public.exercise_videos e where e.video_url = v.url);
