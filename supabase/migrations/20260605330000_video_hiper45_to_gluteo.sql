-- La hiperextensión a 45° (espalda redondeada) es trabajo de GLÚTEO, no de
-- espalda baja. Se movió de la variante hiper-45 (de Hiperextensiones/espalda)
-- a un ejercicio propio de glúteo. Re-apuntar el video.
UPDATE exercise_videos
SET exercise_id = 'hiperextension-gluteo-maquina'
WHERE exercise_id = 'hiper-45';
