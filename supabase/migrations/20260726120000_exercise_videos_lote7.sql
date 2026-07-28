-- ═══════════════════════════════════════════════════════════════════════════
-- LOTE 7: videos nuevos de Magaly en el bucket GYM (.mp4). 36 subidos.
--
-- 26 con match CLARO a una variante que YA existe (ninguna tenía video → sin
-- duplicados). Idempotente por video_url. Los 36 verificados con HEAD 200.
--
-- 10 quedaron SIN conectar porque necesitan variante NUEVA (decisión de Magaly):
--   PECHO · Aperturas (4 cruces por altura/agarre, la variante 'Cruces en polea'
--     ya está tomada por el lote 6):
--     · cruces-de-polea-alta-agarre-neutro    (pecho medio)
--     · cruces-de-polea-alta-agarre-prono     (pecho inferior)
--     · cruces-de-polea-baja-agarre-supino    (pecho superior)
--     · cruces-de-polea-baja-apertura         (pecho superior)
--   ESPALDA · variantes en Smith / agarre que el banco no tiene:
--     · remo-con-barra-agarre-prono-en-maquina-smith   (Remo pronado en Smith)
--     · remo-con-barra-agarre-supino-en-maquina-smith  (Remo supino en Smith)
--     · remo-invertido-agarre-supino-en-maquina-smith  (Remo invertido supino)
--     · remo-pendlay-agarre-supino    (el Pendlay del banco es prono — ¿nueva?)
--   NUEVOS movimientos:
--     · sentadilla-con-press-unilateral-con-kettlebell (Thruster — no está en el banco)
--     · step-ups-con-elevacion-de-rodilla    (Step-up con rodilla — variante nueva)
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.exercise_videos (exercise_id, variant_id, video_url, label, display_order)
select v.ex, null, v.url, v.label, v.orden
  from (values
  ('devil-press', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/burpee-con-mancuernas-y-press-de-hombro-todo-el-cuerpo.mp4', 'Ejecución', 0),
  ('burpee-box-jump', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/burpee-con-salto-al-cajon-piernas-y-cardio.mp4', 'Ejecución', 0),
  ('shrugs-polea', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-de-biceps-con-barra-recta-en-polea-baja-en-maquina-biceps.mp4', 'Ejecución', 0),
  ('dominadas-pronadas', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/dominadas-agarre-prono-espalda.mp4', 'Ejecución', 0),
  ('dominadas-neutras', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/dominadas-agarre-neutro-espalda-y-biceps.mp4', 'Ejecución', 0),
  ('knee-raises', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/elevaciones-de-rodillas-colgado-abdomen.mp4', 'Ejecución', 0),
  ('elevacion-frontal-polea', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/elevaciones-frontales-con-barra-recta-en-polea-baja-en-maquina-hombros.mp4', 'Ejecución', 0),
  ('curl-martillo-polea-cuerda', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-martillo-con-cuerda-en-polea-baja-biceps.mp4', 'Ejecución', 0),
  ('vuelo-posterior-mancuernas-inclinado', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/elevaciones-posteriores-con-mancuernas-en-banco-hombro-posterior.mp4', 'Ejecución', 0),
  ('jalon-supinado', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/jalon-al-pecho-agarre-supino-en-maquina-espalda-y-biceps.mp4', 'Ejecución', 0),
  ('swing-americano', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/kettlebell-swing-americano-hombro-y-gluteo.mp4', 'Ejecución', 0),
  ('swing-ruso', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/kettlebell-swing-gluteo-y-piernas.mp4', 'Ejecución', 0),
  ('swing-unilateral', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/kettlebell-swing-unilateral-intercalado-gluteo-y-piernas.mp4', 'Ejecución', 0),
  ('burpee-sin-flexion', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/medio-burpee-con-salto-abdomen-y-piernas.mp4', 'Ejecución', 0),
  ('patada-gluteo-polea', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/patada-de-gluteo-en-polea-baja-en-maquina-gluteo.mp4', 'Ejecución', 0),
  ('patada-triceps-polea', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/patada-de-triceps-a-una-mano-en-polea-baja-en-maquina-triceps.mp4', 'Ejecución', 0),
  ('press-frances-barra-recta', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-frances-con-barra-en-banco-triceps.mp4', 'Ejecución', 0),
  ('press-frances-polea-cuerda', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-frances-con-cuerda-en-polea-baja-en-maquina-triceps.mp4', 'Ejecución', 0),
  ('press-frances-mancuerna', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-frances-con-mancuerna-a-dos-manos-en-banco-triceps.mp4', 'Ejecución', 0),
  ('press-frances-mancuernas-individuales', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-frances-unilateral-con-mancuerna-en-banco-triceps.mp4', 'Ejecución', 0),
  ('upright-row-polea', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/remo-al-menton-con-barra-z-en-polea-baja-hombros-trapecio.mp4', 'Ejecución', 0),
  ('remo-barra-pendlay', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/remo-con-barra-agarre-prono-espalda.mp4', 'Ejecución', 0),
  ('renegade-row', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/remo-en-plancha-con-mancuernas-espalda-y-abdomen.mp4', 'Ejecución', 0),
  ('remo-invertido-barra-baja', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/remo-invertido-agarre-prono-en-maquina-smith-espalda.mp4', 'Ejecución', 0),
  ('remo-polea-bajo-unilateral', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/remo-unilateral-en-polea-baja-agarre-neutro-en-maquina-espalda.mp4', 'Ejecución', 0),
  ('battle-ropes-doble-onda', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/simultaneo-cuerdas-de-batalla-con-ambas-manos-todo-el-cuerpo-y-cardio.mp4', 'Ejecución', 0)
  ) as v(ex, url, label, orden)
 where not exists (select 1 from public.exercise_videos e where e.video_url = v.url);
