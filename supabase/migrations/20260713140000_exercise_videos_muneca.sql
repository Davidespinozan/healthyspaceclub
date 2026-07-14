-- ════════════════════════════════════════════════════════════════
-- Videos de CURL DE MUÑECA (antebrazo) — resubidos sin "ñ" (Supabase rechazaba el
-- nombre con ñ; los originales daban 400).
--   · supinación (palmas arriba) = FLEXIÓN de muñeca  → curl-muneca-flexion-barra
--   · pronación (palmas abajo)   = EXTENSIÓN de muñeca → curl-muneca-extension-barra
--
-- Idempotente: borra las filas de los exercise_id afectados y reinserta.
-- ════════════════════════════════════════════════════════════════

DELETE FROM exercise_videos WHERE exercise_id IN (
  'curl-muneca-flexion-barra',
  'curl-muneca-extension-barra'
);

INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES
  ('curl-muneca-flexion-barra',   'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-de-muneca-sentado-supinacion.mp4', 0),
  ('curl-muneca-extension-barra', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-de-muneca-sentado-pronacion.mp4', 0);
