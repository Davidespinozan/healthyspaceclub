-- ═══════════════════════════════════════════════════════════════════════════
-- LOTE 6: los 44 videos nuevos que subió Magaly al bucket GYM (.mp4), conectados.
--
-- 38 con match a una variante/patrón que YA existía. Los otros 6 no tenían
-- variante equivalente, así que se crearon en el banco (src/data/exercises.ts):
--   · abduccion-cadera-acostada-lado        Abducción · Acostada de lado
--   · abduccion-cadera-cuadrupedia          Abducción · Patada lateral (fire hydrant)
--   · good-morning-smith                    Buenos Días · En Smith
--   · dominadas-asistidas-maquina-neutra    Tracción Neutra · Dominada asistida (máquina)
--   · boxer-jumps                           Saltos Básicos · Saltos de boxeador
--   · pogo-jumps                            Saltos Básicos · Saltos en puntas (pogo)
--
-- Ninguno tenía video antes → sin duplicados. Idempotente por video_url.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.exercise_videos (exercise_id, variant_id, video_url, label, display_order)
select v.ex, null, v.url, v.label, v.orden
  from (values
  ('crunch-con-peso', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/abdominales-crunch-declinado-con-disco-abdomen-alto-core.mp4', 'Ejecución', 0),
  ('core-mountain-climbers', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/escaladores-abdominales-abdomen-core-cardio.mp4', 'Ejecución', 0),
  ('russian-twist-balon', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/giros-rusos-con-balon-medicinal-oblicuos-abdomen-core.mp4', 'Ejecución', 0),
  ('abduccion-cadera-banda-tobillos', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/abduccion-de-cadera-de-pie-con-banda-gluteo-medio-estabilidad.mp4', 'Ejecución', 0),
  ('abduccion-cadera-banda-rodillas', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/abduccion-de-cadera-sentado-con-banda-gluteo-medio-aductores.mp4', 'Ejecución', 0),
  ('caminata-monstruo', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/caminata-lateral-en-sentadilla-con-banda-gluteos-piernas.mp4', 'Ejecución', 0),
  ('caminata-lateral', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/caminata-lateral-en-sentadilla-gluteos-piernas.mp4', 'Ejecución', 0),
  ('curl-femoral-banda', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-femoral-acostado-con-banda-elactica-isquiotibiales-gluteos.mp4', 'Ejecución', 0),
  ('patada-gluteo-banda', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/patada-de-gluteo-en-cuadrupedia-con-banda-gluteos-isquiotibiales.mp4', 'Ejecución', 0),
  ('patada-gluteo-cuadrupedia-sin-peso', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/patada-de-gluteo-en-cuadrupedia-gluteos-isquiotibiales.mp4', 'Ejecución', 0),
  ('peso-muerto-sumo-barra', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/peso-muerto-sumo-con-barra-gluteos-aductores-piernas.mp4', 'Ejecución', 0),
  ('hip-thrust-con-banda', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/puente-de-gluteo-con-banda-de-resistencia-gluteos-isquiotibiales.mp4', 'Ejecución', 0),
  ('sentadilla-goblet-mancuerna', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/sentadilla-sumo-con-mancuerna-gluteos-aductores-piernas.mp4', 'Ejecución', 0),
  ('curl-pie-banda', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-de-biceps-con-liga-agarre-supino-biceps.mp4', 'Ejecución', 0),
  ('curl-martillo-banda', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-martillo-con-liga-biceps-antebrazos.mp4', 'Ejecución', 0),
  ('patada-triceps-banda', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/extension-de-triceps-atras-con-liga-triceps.mp4', 'Ejecución', 0),
  ('triceps-push-down-banda', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/jalon-de-triceps-con-liga-triceps-core.mp4', 'Ejecución', 0),
  ('fondos-triceps-maquina', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/fondos-maquina-tricep.mp4', 'Ejecución', 0),
  ('pike-push-up', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/flexiones-en-pica-hombros-triceps.mp4', 'Ejecución', 0),
  ('flexiones-diamante-declinada', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/lagartijas-declinadas-diamante-en-escalones-triceps-pecho-alto.mp4', 'Ejecución', 0),
  ('press-declinado-flexiones-declinadas', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/lagartijas-declinadas-en-escalon-pecho-alto-hombros.mp4', 'Ejecución', 0),
  ('flexiones-diamante-rodillas', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/lagartijas-diamante-modificadas-pecho-triceps.mp4', 'Ejecución', 0),
  ('flexiones-diamante-estandar', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/lagartijas-diamante-triceps-pecho-medio-neutral.mp4', 'Ejecución', 0),
  ('press-inclinado-flexiones', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/lagartijas-inclinadas-pecho-inferior-triceps.mp4', 'Ejecución', 0),
  ('press-horizontal-flexiones-rodillas', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/lagartijas-modificadas-pecho-triceps.mp4', 'Ejecución', 0),
  ('press-declinado-mancuernas', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-banca-declinado-con-mancuernas-pecho-bajo-triceps.mp4', 'Ejecución', 0),
  ('press-inclinado-smith', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-banca-inclinado-en-maquina-smith-agarre-supino-pecho-alto-triceps.mp4', 'Ejecución', 0),
  ('press-horizontal-smith', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-banca-plano-en-maquina-smith-agarre-supino-pecho-medio-triceps.mp4', 'Ejecución', 0),
  ('elevacion-frontal-barra', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/elevaciones-frontales-con-barra-agarre-prono-hombro-anterior.mp4', 'Ejecución', 0),
  ('press-smith', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-militar-sentado-en-maquina-smith-hombros-triceps.mp4', 'Ejecución', 0),
  ('dominadas-asistidas-maquina', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/dominadas-asistidas-en-maquina-agarre-prono-espalda-alta-biceps.mp4', 'Ejecución', 0),
  ('remo-ergometro', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/remo-en-simulador-de-remo-cardio-espalda-piernas.mp4', 'Ejecución', 0),
  ('burpee-con-flexion', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/burpees-con-salto-full-body-cardio-resistencia.mp4', 'Ejecución', 0),
  ('jump-squat', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/sentadilla-con-salto-y-toque-de-suelo-intercalado-piernas-gluteos-cardio.mp4', 'Ejecución', 0),
  ('high-knees', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/skipping-alto-o-tijeras-con-salto-en-el-aire-cardio-piernas-abdomen.mp4', 'Ejecución', 0),
  ('superman-suelo', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/superman-espalda-baja-gluteos.mp4', 'Ejecución', 0),
  ('abduccion-cadera-acostada-lado', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/abduccion-de-cadera-acostada-de-lado-con-banda-gluteo-medio.mp4', 'Ejecución', 0),
  ('good-morning-smith', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/buenos-dias-en-maquina-smith-gluteos-femorales-espalda-baja.mp4', 'Ejecución', 0),
  ('abduccion-cadera-cuadrupedia', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/patada-lateral-en-cuadrupedia-con-banda-gluteo-medio.mp4', 'Ejecución', 0),
  ('dominadas-asistidas-maquina-neutra', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/dominadas-asistidas-en-maquina-agarre-neutro-dorsales-biceps.mp4', 'Ejecución', 0),
  ('boxer-jumps', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/saltos-de-boxeador-cardio-pantorrillas-coordinacion.mp4', 'Ejecución', 0),
  ('pogo-jumps', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/saltos-en-puntas-de-pies-cardio-pantorrillas.mp4', 'Ejecución', 0)
  ) as v(ex, url, label, orden)
 where not exists (select 1 from public.exercise_videos e where e.video_url = v.url);
