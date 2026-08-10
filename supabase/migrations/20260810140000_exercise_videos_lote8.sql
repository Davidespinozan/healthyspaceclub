-- ═══════════════════════════════════════════════════════════════════════════
-- LOTE 8: videos nuevos que subió David al bucket GYM (.mp4), conectados.
--
-- Cobertura NUEVA + reacomodos que David confirmó viendo el comparador:
--
--   · zancada-caminando-barra            Zancada · Caminando con barra
--   · shrugs-mancuernas                  Encogimientos · Mancuernas
--   · face-pull-polea-cuerda             Jalón a la Cara · Polea con cuerda
--   · press-inclinado-maquina-neutro     Press Inclinado · Máquina agarre neutro (variante NUEVA)
--   · pullover-polea-pie                 Pull-over · Polea alta de pie
--   · sentadilla-hack                    Sentadilla · Hack en máquina
--   · curl-pie-polea-doble-mano          Curl de Pie · Polea baja una en cada mano (variante NUEVA)
--   · triceps-push-down-cuerda           Tríceps Polea · Con cuerda (estaba por grabar, sin clip)
--   · press-horizontal-maquina-acostado  Press Horizontal · Máquina acostado (variante NUEVA)
--   · press-horizontal-maquina-neutro    Press Horizontal · Máquina agarre neutro (se separa del sentado)
--
-- Descartados por David (el clip actual es mejor): barra-tricep-polea (queda
-- triceps-push-down-barra-recta) y press-inclinado-con-maquina (queda el actual).
--
-- Idempotente por video_url (where not exists).
-- ═══════════════════════════════════════════════════════════════════════════

-- El clip de AGARRE NEUTRO estaba colgado en press-horizontal-maquina (que es el
-- press SENTADO normal). Se borra para re-crearlo abajo bajo su propia variante
-- press-horizontal-maquina-neutro (así el review estático y la app coinciden).
delete from public.exercise_videos
 where video_url like '%press-horizontal-maquina-agarre-neutral-pecho-tricep%';

insert into public.exercise_videos (exercise_id, variant_id, video_url, label, display_order)
select v.ex, null, v.url, v.label, v.orden
  from (values
  ('zancada-caminando-barra',            'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/desplantes-barra-caminando.mp4', 'Ejecución', 0),
  ('shrugs-mancuernas',                  'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/encojimientos-con-mancuerna-trapecio.mp4', 'Ejecución', 0),
  ('face-pull-polea-cuerda',             'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/jalon-a-la-cara-polea-con-cuerda.mp4', 'Ejecución', 0),
  ('press-inclinado-maquina-neutro',     'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-inclinado-agarre-neutro-en-maquina-pecho.mp4', 'Ejecución', 0),
  ('pullover-polea-pie',                 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/pull-over-polea-alta-de-pie.mp4', 'Ejecución', 0),
  ('sentadilla-hack',                    'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/sentadilla-hack-en-maquina.mp4', 'Ejecución', 0),
  ('curl-pie-polea-doble-mano',          'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-de-bicep-en-polea-baja.mp4', 'Ejecución', 0),
  ('triceps-push-down-cuerda',           'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/cuerda-tricep-polea.mp4', 'Ejecución', 0),
  -- Press Horizontal máquina: el SENTADO se queda en press-horizontal-maquina; ACOSTADO y NEUTRO son variantes propias.
  ('press-horizontal-maquina-acostado',  'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-maquina-pecho.mp4', 'Ejecución', 0),
  ('press-horizontal-maquina-neutro',    'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-horizontal-maquina-agarre-neutral-pecho-tricep.mp4', 'Ejecución', 0)
  ) as v(ex, url, label, orden)
 where not exists (select 1 from public.exercise_videos e where e.video_url = v.url);
