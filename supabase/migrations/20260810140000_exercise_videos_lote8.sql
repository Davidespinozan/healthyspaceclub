-- ═══════════════════════════════════════════════════════════════════════════
-- LOTE 8: videos nuevos que subió David al bucket GYM (.mp4), conectados.
--
-- Solo los que dan COBERTURA NUEVA (la variante no tenía ningún clip). Los
-- otros 6 archivos del lote mapean a variantes que YA tienen video (re-
-- grabaciones) y se resuelven aparte para no pisar clips que ya sirven.
--
--   · zancada-caminando-barra          Zancada · Caminando con barra
--   · shrugs-mancuernas                Encogimientos · Mancuernas
--   · face-pull-polea-cuerda           Jalón a la Cara · Polea con cuerda
--   · press-inclinado-maquina-neutro   Press Inclinado · Máquina agarre neutro (variante NUEVA)
--   · pullover-polea-pie               Pull-over · Polea alta de pie
--   · sentadilla-hack                  Sentadilla · Hack en máquina
--   · curl-pie-polea-doble-mano        Curl de Pie · Polea baja una en cada mano (variante NUEVA)
--   · triceps-push-down-cuerda         Tríceps Polea · Con cuerda (estaba por grabar, sin clip)
--
-- Idempotente por video_url (where not exists).
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.exercise_videos (exercise_id, variant_id, video_url, label, display_order)
select v.ex, null, v.url, v.label, v.orden
  from (values
  ('zancada-caminando-barra',        'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/desplantes-barra-caminando.mp4', 'Ejecución', 0),
  ('shrugs-mancuernas',              'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/encojimientos-con-mancuerna-trapecio.mp4', 'Ejecución', 0),
  ('face-pull-polea-cuerda',         'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/jalon-a-la-cara-polea-con-cuerda.mp4', 'Ejecución', 0),
  ('press-inclinado-maquina-neutro', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-inclinado-agarre-neutro-en-maquina-pecho.mp4', 'Ejecución', 0),
  ('pullover-polea-pie',             'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/pull-over-polea-alta-de-pie.mp4', 'Ejecución', 0),
  ('sentadilla-hack',                'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/sentadilla-hack-en-maquina.mp4', 'Ejecución', 0),
  ('curl-pie-polea-doble-mano',      'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-de-bicep-en-polea-baja.mp4', 'Ejecución', 0),
  ('triceps-push-down-cuerda',       'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/cuerda-tricep-polea.mp4', 'Ejecución', 0)
  ) as v(ex, url, label, orden)
 where not exists (select 1 from public.exercise_videos e where e.video_url = v.url);
