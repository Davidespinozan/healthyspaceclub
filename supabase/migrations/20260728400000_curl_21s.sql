-- David: método 21s de bíceps con barra = 3 fases (inferior/superior/completo).
-- El 'superior' sale de Curl de Pie · Barra recta; el 'completo' se comparte (va en Barra
-- recta Y en 21s · Completo). video_url NO es único (unique es por exercise_id+variant).
update public.exercise_videos set exercise_id='curl-21s-superior'
  where video_url like '%bicep-barra-superior-curl.mp4%' and exercise_id='curl-pie-barra';
insert into public.exercise_videos (exercise_id, variant_id, video_url, label, display_order)
select v.ex, null, v.url, 'Ejecución', 0 from (values
  ('curl-21s-completo', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/bicep-barra-curl-completo.mp4')
  ) as v(ex, url)
 where not exists (select 1 from public.exercise_videos e where e.exercise_id = v.ex);
