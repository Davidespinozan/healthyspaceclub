-- ════════════════════════════════════════════════════════════════
-- Corrección de mapeo: el archivo peso-muerto-rumano-barra.mp4 en realidad
-- muestra ENCOGIMIENTOS CON BARRA (trapecios), no peso muerto rumano (lo
-- confirmó David, que grabó el video). Lo remapeamos al ejercicio correcto:
-- la variante shrugs-barra del patrón "shrugs" (espalda).
--
-- peso-muerto-rumano queda sin video (no tenemos uno real de RDL aún).
-- Idempotente: si ya se corrigió, el WHERE no machea nada.
-- ════════════════════════════════════════════════════════════════

UPDATE exercise_videos
SET exercise_id = 'shrugs-barra'
WHERE exercise_id = 'peso-muerto-rumano-barra';
