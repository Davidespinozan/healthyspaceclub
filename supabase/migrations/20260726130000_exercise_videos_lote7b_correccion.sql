-- ═══════════════════════════════════════════════════════════════════════════
-- LOTE 7b · CORRECCIÓN de mapeo (usando criterio de gym, no el nombre del archivo)
--
-- 1) cristos-pec-fly-espalda-maquina.mp4 → es un PEC DECK, no cruces en polea.
--    Estaba mal en aperturas-polea-cruce; se mueve a aperturas-pec-deck.
-- 2) Las 4 "cruces de polea" (por altura/agarre) son todas el MISMO ejercicio:
--    aperturas por altura/agarre → 4 variantes propias (David: que cada una tenga su tarjeta).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Mover el pec deck a su ejercicio correcto (el registro viejo trae el nombre
--    de archivo suelto, sin URL completa).
delete from public.exercise_videos where video_url = 'cristos-pec-fly-espalda-maquina.mp4';

insert into public.exercise_videos (exercise_id, variant_id, video_url, label, display_order)
select v.ex, null, v.url, 'Ejecución', 0
  from (values
  ('aperturas-pec-deck', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/cristos-pec-fly-espalda-maquina.mp4'),
  ('aperturas-polea-cruce', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/cruces-de-polea-alta-agarre-neutro-en-maquina-pecho-medio.mp4'),
  ('aperturas-cruce-baja-apertura', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/cruces-de-polea-baja-apertura-en-maquina-pecho-superior.mp4')
  ) as v(ex, url)
 where not exists (select 1 from public.exercise_videos e where e.video_url = v.url);

-- Correcciones de mapeo en la DB (por si esos videos ya se aplicaron con el id viejo).
-- Idempotentes: solo tocan la fila si aún tiene el exercise_id equivocado.
update public.exercise_videos set exercise_id='hiperextensiones-banco-romano'
  where video_url like '%hiperextensiones-maquina-espalda-baja%' and exercise_id='hiperextensiones-maquina';
update public.exercise_videos set exercise_id='remo-mancuerna-banco'
  where video_url like '%remo-con-mancuerna-una-mano-bicep-espalda%' and exercise_id='remo-unilateral';
update public.exercise_videos set exercise_id='dominadas-neutras'
  where video_url like '%dominadas-agarre-supino-espalda-y-biceps%' and exercise_id='dominadas-supinadas';
delete from public.exercise_videos where video_url like '%lagartijas-diamante-pecho-tricep-abdomen%';
update public.exercise_videos set exercise_id='flexiones-diamante-estandar' where video_url like '%lagartijas-diamante-triceps-pecho-medio-neutral%';
update public.exercise_videos set exercise_id='jalon-neutro-triangulo'
  where video_url like '%jalon-frontal-triangulo-maquina-espalda%' and exercise_id <> 'jalon-neutro-triangulo';
-- David: cruces-de-polea-alta-a-baja no es pec deck → desconectar (queda "sin conectar" hasta decidir).
delete from public.exercise_videos where video_url like '%cruces-de-polea-alta-a-baja-pecho-inferior-hombros%';
