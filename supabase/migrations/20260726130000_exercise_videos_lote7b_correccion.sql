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
  ('aperturas-cruce-alta-neutro', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/cruces-de-polea-alta-agarre-neutro-en-maquina-pecho-medio.mp4'),
  ('aperturas-cruce-alta-prono', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/cruces-de-polea-alta-agarre-prono-en-maquina-pecho-inferior.mp4'),
  ('aperturas-cruce-baja-supino', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/cruces-de-polea-baja-agarre-supino-en-maquina-pecho-superior.mp4'),
  ('aperturas-cruce-baja-apertura', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/cruces-de-polea-baja-apertura-en-maquina-pecho-superior.mp4')
  ) as v(ex, url)
 where not exists (select 1 from public.exercise_videos e where e.video_url = v.url);
