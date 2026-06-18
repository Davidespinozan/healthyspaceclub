-- Fix: 2 videos estaban pegados al EJERCICIO BASE en vez de a una variante. Los
-- videos pegados al base se muestran para CUALQUIER equipo (el lookup siempre
-- incluye el id base), así que un usuario en casa veía el video de máquina de
-- hiperextensiones / press cerrado. Re-asignados a su variante de gym → ahora
-- solo se muestran a usuarios de gym (en casa se respeta el equipo).
--
-- hiperextensiones (extension-espalda-baja-maquina-core.mp4) → hiperextensiones-maquina
--   (display_order 1; el 0 ya lo tiene hiperextensiones-maquina-espalda-baja.mp4).
-- press-cerrado (agarre neutro máquina) → press-cerrado-barra-banca (variante gym).

UPDATE exercise_videos
SET exercise_id = 'hiperextensiones-maquina', display_order = 1
WHERE exercise_id = 'hiperextensiones';

UPDATE exercise_videos
SET exercise_id = 'press-cerrado-barra-banca'
WHERE exercise_id = 'press-cerrado';
