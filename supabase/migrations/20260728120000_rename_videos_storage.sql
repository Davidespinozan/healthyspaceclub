-- ═══════════════════════════════════════════════════════════════════════════
-- RENOMBRE DE ARCHIVOS EN STORAGE (David los renombró en el dashboard).
-- Magaly los había nombrado mal; ya estaban bien ubicados, solo cambió el archivo.
-- Reescribe video_url en la tabla viva (el storage ya tiene el nombre nuevo).
-- Idempotente: usa replace() sobre el substring, no toca filas ya migradas.
-- ═══════════════════════════════════════════════════════════════════════════
update public.exercise_videos set video_url = replace(video_url,
  'cristos-pec-fly-espalda-maquina.mp4', 'pec-deck-en-maquina-pecho.mp4')
  where video_url like '%cristos-pec-fly-espalda-maquina.mp4%';

update public.exercise_videos set video_url = replace(video_url,
  'dominadas-agarre-supino-espalda-y-biceps.mp4', 'dominadas-agarre-neutro-espalda-y-biceps.mp4')
  where video_url like '%dominadas-agarre-supino-espalda-y-biceps.mp4%';

update public.exercise_videos set video_url = replace(video_url,
  'hiperextensiones-maquina-espalda-baja.mp4', 'hiperextensiones-banco-romano-espalda-baja.mp4')
  where video_url like '%hiperextensiones-maquina-espalda-baja.mp4%';

update public.exercise_videos set video_url = replace(video_url,
  'lagartijas-diamante-triceps-pecho-medio-neutral.mp4', 'flexiones-diamante-estandar-pecho-triceps.mp4')
  where video_url like '%lagartijas-diamante-triceps-pecho-medio-neutral.mp4%';

update public.exercise_videos set video_url = replace(video_url,
  'remo-con-mancuerna-una-mano-bicep-espalda.mp4', 'remo-unilateral-mancuerna-en-banco-espalda.mp4')
  where video_url like '%remo-con-mancuerna-una-mano-bicep-espalda.mp4%';
