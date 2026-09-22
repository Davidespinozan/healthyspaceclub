-- ═══════════════════════════════════════════════════════════════════════════
-- Los .mov del bucket GYM se reconvirtieron a .mp4 y se volvieron a subir con
-- el MISMO nombre; los .mov originales se borraron del storage. La tabla
-- exercise_videos seguía apuntando al .mov, así que estos 21 ejercicios
-- cargaban un vídeo inexistente (el storage devuelve 400).
--
-- Verificado antes de escribir esta migración, una petición por fila:
--   · las 21 URLs .mov  -> 400 (borradas)
--   · las 21 URLs .mp4  -> 206 (existen, mismo nombre y misma ruta)
--
-- Ejercicios afectados: plancha-frontal, flexiones-diamante-estandar,
-- levantamiento-piernas-acostado, crunch-maquina, wall-balls,
-- side-bend-mancuerna, remo-invertido-trx, press-horizontal-flexiones,
-- face-pull-trx, battle-ropes-onda-alterna, sit-up-con-peso, bicycle-crunch,
-- core-tijera-cruzada, core-in-and-out-mancuerna, core-toques-de-puntas,
-- core-crunch-piernas-elevadas, core-aleteo-vertical, core-tijera-horizontal,
-- core-sit-out, cluster-barra-completo, core-in-and-out-manos.
--
-- Solo cambia la extensión al final de la URL. Idempotente: al re-ejecutarse
-- ya no queda ninguna fila que termine en .mov, así que no toca nada.
-- ═══════════════════════════════════════════════════════════════════════════

update public.exercise_videos
   set video_url = left(video_url, length(video_url) - 4) || '.mp4',
       updated_at = now()
 where video_url like '%.mov';

-- Mismo tratamiento para las miniaturas, por si alguna se añade apuntando a
-- un .mov. Hoy están todas a null, así que no afecta a ninguna fila.
update public.exercise_videos
   set thumbnail_url = left(thumbnail_url, length(thumbnail_url) - 4) || '.mp4',
       updated_at = now()
 where thumbnail_url like '%.mov';
