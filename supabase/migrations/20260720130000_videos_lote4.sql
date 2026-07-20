-- ═══════════════════════════════════════════════════════════════════════════
-- 26 VIDEOS QUE ESTABAN EN STORAGE SIN CONECTAR
--
-- Había 43 archivos de video en el bucket que ningún ejercicio referenciaba:
-- grabados, subidos y nunca enlazados. 26 se pudieron mapear con el nombre del
-- archivo; los otros 17 quedan pendientes (ver nota al final).
--
-- Convención de esta tabla, que NO es obvia: `variant_id` va siempre NULL y
-- `exercise_id` lleva el id de la VARIANTE cuando el video muestra una variante
-- concreta, o el del patrón cuando sirve para toda la familia. El reproductor
-- consulta `.in('exercise_id', [patron, ...variantes])` y se queda con la fila de
-- la variante si existe, si no la del patrón, si no la primera por display_order.
-- (WorkoutPlayer.tsx:288-296)
--
-- Por eso el display_order importa: `press-horizontal-flexiones` recibe DOS
-- clips —la flexión estricta y la modificada en rodillas— y la estricta va en 0
-- para que sea la que se muestra por omisión. Los tres ids que ya tenían video
-- reciben el suyo en orden 1, para no desplazar al que ya estaba.

insert into public.exercise_videos (exercise_id, variant_id, video_url, label, display_order)
select v.ex, null, v.url, v.label, v.orden
  from (values
  ('bicycle-crunch', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/abdominales-bicicleta-abdomen-oblicuos-core.mov', 'Ejecución', 0),
  ('sit-up-con-peso', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/abdominales-completos-con-peso-o-sit-ups-con-mancuerna.mov', 'Ejecución', 0),
  ('burpee-sprawl', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/burpees.mov', 'Ejecución', 0),
  ('crunch-maquina', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/crunch-abdominal-en-maquina-abdomen.mov', 'Ejecución', 0),
  ('battle-ropes', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/cuerdas-de-batalla-en-sentadilla-hombros-core-piernas.mov', 'En sentadilla', 0),
  ('curl-pie', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-de-biceps-con-mancuernas.mp4', 'Con mancuernas', 0),
  ('curl-martillo-mancuernas', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-martillo-alterno-conisometrico-a90grados-pausaisometrica-bicep.mp4', 'Con pausa isométrica a 90°', 1),
  ('curl-muneca-flexion-barra', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-muneca-barra-atrasdeespalda.mp4', 'De pie, barra tras la espalda', 1),
  ('curl-muneca-extension-barra', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-muneca-enpronacion-barra-parado.mp4', 'De pie', 1),
  ('levantamiento-piernas-acostado', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/elevaciones-de-piernas-acostado-abdomen-inferior-core.mov', 'Ejecución', 0),
  ('elevacion-lateral-polea', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/elevaciones-laterales-polea-trapecio-hombro-lateral.mp4', 'Ejecución', 0),
  ('vuelo-posterior', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/elevaciones-posteriores-laterales-con-mancuerna-hombro-trapecio.mp4', 'Con mancuernas', 0),
  ('triceps-push-down', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/extension-tricep-polea-alta.mp4', 'Ejecución', 0),
  ('face-pull', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/face-pull-en-trx-agarre-prono-hombro-posterior-espalda-alta.mov', 'En TRX', 0),
  ('side-bend-mancuerna', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/flexion-lateral-de-tronco-con-discos-oblicuos.mov', 'Con discos', 0),
  ('press-horizontal-flexiones', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/lagartija-estricta-o-flexion-clasica-completa-core-hombros.mov', 'Ejecución', 0),
  ('press-horizontal-flexiones', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/flexiones-lagartijas-modificada-con-rodillas-abdomen.mp4', 'En rodillas (modificada)', 1),
  ('fondos-triceps', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/fondos-libres-en-banco-tricep.mp4', 'En banco', 0),
  ('flexiones-diamante-estandar', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/lagartijas-diamante-pecho-tricep-abdomen.mov', 'Ejecución', 0),
  ('vuelo-posterior-reverse-pec-deck', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/pajaros-en-maquina-trapecio-espalda-alta.mp4', 'Ejecución', 0),
  ('plancha-frontal', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/plancha.mov', 'Ejecución', 0),
  ('pullover-mancuerna-banco', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/pullover-con-mancuerna-en-banco-pecho-dorsal-ancho.mp4', 'Ejecución', 0),
  ('remo-unilateral', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/remo-con-mancuerna-una-mano-bicep-espalda.mp4', 'Con mancuerna', 0),
  ('remo-invertido-trx', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/remo-invertido-en-trx-agarre-neutro-espalda-alta-biceps.mov', 'Ejecución', 0),
  ('rotacion-con-peso', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/rotacion-torso-en-maquina-abdomen.mp4', 'En máquina', 0),
  ('wall-balls', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/sentadilla-con-salto-y-lanzamiento-de-balon-medicional-piernas-gluteos-hombros.mov', 'Con lanzamiento de balón', 0)
  ) as v(ex, url, label, orden)
 where not exists (
   select 1 from public.exercise_videos e where e.video_url = v.url
 );

-- ── Lo que NO se mapeó: 17 videos ──────────────────────────────────────────
-- 9 de core en el piso (in-and-out, tijeras, aleteo, toques de puntas, crunch
--   con piernas elevadas, sit-out): el banco cubre core con carga, colgado y
--   dinámico, pero no tiene la familia de piernas en el piso. Es el hueco real.
-- 1 cluster con barra: no hay ningún patrón de levantamiento combinado.
-- 3 de yoga con postura nombrada (shoulderstand/plow/ear-pressure, locust,
--   standing side bend): esas posturas no existen en el banco.
-- 4 `YOGA/IMG_*.mp4`: el nombre no dice nada. Alguien tiene que verlos.
--
-- Se prefirió dejarlos sin conectar antes que forzarlos a un ejercicio parecido:
-- ya hubo dos migraciones arreglando videos mal mapeados (fix_remo_banda_swap,
-- fix_ligas_shrugs_triceps) y un video equivocado enseña mal la técnica.
--
-- Aparte, sobra `GYM/abdominales-completos- con-peso-o-sit-ups-con mancuerna.mov`:
-- es el mismo clip que la versión sin espacios, con el nombre mal escrito.
