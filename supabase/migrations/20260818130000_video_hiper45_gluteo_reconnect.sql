-- ════════════════════════════════════════════════════════════════════════════
-- RECONEXIÓN del video de hiperextensión a 45° (glúteo/cadena posterior).
--
-- El video GYM/hiperextensiones-gluteo-maquina.mp4 (confirmado visualmente: back-extension a 45°
-- en banco romano, patrón hip-extension) se re-apuntó del id legacy 'hiper-45' a la variante real
-- 'hiperextension-gluteo-maquina' vía UPDATE en 20260605330000. La DB quedó correcta, PERO el
-- generador de VIDEO_VARIANT_IDS (scripts/build_videos_review_data.mjs) solo parsea tuplas INSERT
-- ('id','url') — NO entiende UPDATE — así que el MOTOR nunca reconoció el remap y la variante
-- quedó sin video reproducible (hiperextension-gluteo muerto en gym pese a tener clip).
--
-- Esta migración conecta la variante mediante un INSERT explícito (parseable por el generador),
-- idempotente: borra cualquier fila del video (legacy hiper-45 o la propia variante) y la reinserta
-- una sola vez → sin doble mapping. NO toca el archivo físico, NO duplica el video, NO crea ejercicio.
-- ════════════════════════════════════════════════════════════════════════════

DELETE FROM exercise_videos
WHERE video_url LIKE '%healthyspaceclub/GYM/hiperextensiones-gluteo-maquina.mp4%'
  AND exercise_id IN ('hiper-45', 'hiperextension-gluteo-maquina');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
VALUES ('hiperextension-gluteo-maquina', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/hiperextensiones-gluteo-maquina.mp4', 0);
