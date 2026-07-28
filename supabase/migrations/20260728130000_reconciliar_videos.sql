-- ═══════════════════════════════════════════════════════════════════════════
-- RECONCILIAR exercise_videos con el estado corregido del review.
-- Motivo: varias correcciones se hicieron editando migraciones YA aplicadas (que no
-- se re-ejecutan), y el lote 7 no se reflejó completo. La app quedó con mapeos viejos.
-- Esta migración fuerza la tabla viva a igualar el review. Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════
update public.exercise_videos set exercise_id='press-declinado-flexiones-declinadas' where video_url='https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/lagartijas-declinadas-en-escalon-pecho-alto-hombros.mp4' and exercise_id is distinct from 'press-declinado-flexiones-declinadas';
update public.exercise_videos set exercise_id='aperturas-pec-deck' where video_url='https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/pec-deck-en-maquina-pecho.mp4' and exercise_id is distinct from 'aperturas-pec-deck';
update public.exercise_videos set exercise_id='flexiones-diamante-estandar' where video_url='https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/flexiones-diamante-estandar-pecho-triceps.mp4' and exercise_id is distinct from 'flexiones-diamante-estandar';
update public.exercise_videos set exercise_id='jalon-neutro-triangulo' where video_url='https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/jalon-frontal-triangulo-maquina-espalda.mp4' and exercise_id is distinct from 'jalon-neutro-triangulo';
update public.exercise_videos set exercise_id='remo-mancuerna-banco' where video_url='https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/remo-unilateral-mancuerna-en-banco-espalda.mp4' and exercise_id is distinct from 'remo-mancuerna-banco';
update public.exercise_videos set exercise_id='hiperextensiones-maquina' where video_url='https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/extension-espalda-baja-maquina-core.mp4' and exercise_id is distinct from 'hiperextensiones';
update public.exercise_videos set exercise_id='hiperextensiones-banco-romano' where video_url='https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/hiperextensiones-banco-romano-espalda-baja.mp4' and exercise_id is distinct from 'hiperextensiones-banco-romano';
update public.exercise_videos set exercise_id='curl-martillo-mancuernas-isometrico' where video_url='https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-martillo-alterno-conisometrico-a90grados-pausaisometrica-bicep.mp4' and exercise_id is distinct from 'curl-martillo-mancuernas-isometrico';
update public.exercise_videos set exercise_id='press-cerrado' where video_url='https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-horizontal-maquina-agarre-neutral-pecho-tricep.mp4' and exercise_id is distinct from 'press-cerrado';

insert into public.exercise_videos (exercise_id, variant_id, video_url, label, display_order)
select v.ex, null, v.url, 'Ejecución', 0 from (values
  ('aperturas-polea-cruce', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/cruces-de-polea-alta-agarre-neutro-en-maquina-pecho-medio.mp4'),
  ('aperturas-cruce-baja-apertura', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/cruces-de-polea-baja-apertura-en-maquina-pecho-superior.mp4'),
  ('dominadas-pronadas', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/dominadas-agarre-prono-espalda.mp4'),
  ('jalon-supinado', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/jalon-al-pecho-agarre-supino-en-maquina-espalda-y-biceps.mp4'),
  ('dominadas-neutras', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/dominadas-agarre-neutro-espalda-y-biceps.mp4'),
  ('remo-barra-pendlay', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/remo-con-barra-agarre-prono-espalda.mp4'),
  ('remo-polea-bajo-unilateral', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/remo-unilateral-en-polea-baja-agarre-neutro-en-maquina-espalda.mp4'),
  ('remo-invertido-barra-baja', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/remo-invertido-agarre-prono-en-maquina-smith-espalda.mp4'),
  ('elevacion-frontal-polea', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/elevaciones-frontales-con-barra-recta-en-polea-baja-en-maquina-hombros.mp4'),
  ('vuelo-posterior-mancuernas-inclinado', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/elevaciones-posteriores-con-mancuernas-en-banco-hombro-posterior.mp4'),
  ('upright-row-polea', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/remo-al-menton-con-barra-recta-en-polea-baja-en-maquina-hombros-y-trapecio.mp4'),
  ('curl-pie-polea-barra', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-de-biceps-con-barra-recta-en-polea-baja-en-maquina-biceps.mp4'),
  ('curl-martillo-polea-cuerda', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-martillo-con-cuerda-en-polea-baja-biceps.mp4'),
  ('press-frances-barra-recta', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-frances-con-barra-en-banco-triceps.mp4'),
  ('press-frances-mancuerna', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-frances-con-mancuerna-a-dos-manos-en-banco-triceps.mp4'),
  ('press-frances-mancuernas-individuales', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-frances-unilateral-con-mancuerna-en-banco-triceps.mp4'),
  ('press-frances-polea-cuerda', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-frances-con-cuerda-en-polea-baja-en-maquina-triceps.mp4'),
  ('patada-triceps-polea', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/patada-de-triceps-a-una-mano-en-polea-baja-en-maquina-triceps.mp4'),
  ('patada-gluteo-polea', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/patada-de-gluteo-en-polea-baja-en-maquina-gluteo.mp4'),
  ('renegade-row', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/remo-en-plancha-con-mancuernas-espalda-y-abdomen.mp4'),
  ('knee-raises', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/elevaciones-de-rodillas-colgado-abdomen.mp4'),
  ('burpee-sin-flexion', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/medio-burpee-con-salto-abdomen-y-piernas.mp4'),
  ('burpee-box-jump', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/burpee-con-salto-al-cajon-piernas-y-cardio.mp4'),
  ('devil-press', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/burpee-con-mancuernas-y-press-de-hombro-todo-el-cuerpo.mp4'),
  ('swing-ruso', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/kettlebell-swing-gluteo-y-piernas.mp4'),
  ('swing-americano', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/kettlebell-swing-americano-hombro-y-gluteo.mp4'),
  ('swing-unilateral', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/kettlebell-swing-unilateral-intercalado-gluteo-y-piernas.mp4'),
  ('battle-ropes-doble-onda', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/simultaneo-cuerdas-de-batalla-con-ambas-manos-todo-el-cuerpo-y-cardio.mp4')
  ) as v(ex, url)
 where not exists (select 1 from public.exercise_videos e where e.video_url = v.url);
